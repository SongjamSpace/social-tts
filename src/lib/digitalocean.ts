/**
 * DigitalOcean App Platform and Droplet API helpers for hatching OpenClaw agents.
 * App Platform: one app per hatch from a container image with env vars.
 * Droplet: one droplet per hatch with cloud-init that runs the same container + bootstrap.
 */

const DO_API_BASE = "https://api.digitalocean.com/v2";

/** Default OpenClaw gateway bootstrap Node one-liner (writes config + SOUL.md, used by App run_command and Droplet container). */
function getOpenClawBootstrapNodeCode(): string {
  return 'const fs=require("fs");const t=(process.env.OPENCLAW_GATEWAY_TOKEN||"").trim();if(!t)process.exit(1);fs.mkdirSync("/home/node/.openclaw",{recursive:true});var cfg={gateway:{controlUi:{dangerouslyAllowHostHeaderOriginFallback:true,dangerouslyDisableDeviceAuth:true},auth:{mode:"token",token:t}}};if(process.env.OPENAI_API_KEY){cfg.models={providers:{openai:{apiKey:"$OPENAI_API_KEY",baseUrl:"https://api.openai.com/v1",models:[]}}};cfg.agents={defaults:{model:{primary:"openai/gpt-4o"}}};}else if(process.env.ANTHROPIC_API_KEY){cfg.models={providers:{anthropic:{apiKey:"$ANTHROPIC_API_KEY",baseUrl:"https://api.anthropic.com",models:[]}}};cfg.agents={defaults:{model:{primary:"anthropic/claude-sonnet-4-5"}}};}var seed=null;try{var s=process.env.SEED_MEMORIES_JSON;if(s)seed=JSON.parse(s);}catch(e){}var agentName=(seed&&typeof seed.name==="string"&&seed.name.trim())?seed.name.trim().slice(0,120):"Agent";var theme=(seed&&(typeof seed.tone==="string"&&seed.tone.trim()||typeof seed.description==="string"&&seed.description.trim()))?(""+(seed.tone||seed.description)).trim().slice(0,300):"helpful assistant";cfg.identity={name:agentName,theme:theme};fs.writeFileSync("/home/node/.openclaw/openclaw.json",JSON.stringify(cfg));fs.mkdirSync("/home/node/.openclaw/workspace",{recursive:true});var lines=["# Agent identity"];if(agentName!=="Agent")lines.push("- **Name:** "+agentName);if(theme!=="helpful assistant")lines.push("- **Tone / personality:** "+theme);var desc=(seed&&typeof seed.description==="string"&&seed.description.trim())?seed.description.trim().slice(0,2000):"";if(desc)lines.push("- **Purpose:** "+desc);if(lines.length>1)fs.writeFileSync("/home/node/.openclaw/workspace/SOUL.md",lines.join(String.fromCharCode(10)));';
}

/** Escape a value for use inside single-quoted bash variable: ' becomes '\'' */
function escapeBashSingleQuoted(s: string): string {
  return s.replace(/'/g, "'\\''");
}

export interface CreateOpenClawAppOptions {
  /** Token mint (Solana). */
  mint: string;
  /** LLM API key for the agent (optional). */
  apiKey?: string;
  /** Seed payload as JSON string (memories for the agent). */
  seedMemoriesJson: string;
  /** Gateway token for official OpenClaw Control UI auth (optional; when set, passed as OPENCLAW_GATEWAY_TOKEN). */
  gatewayToken?: string;
}

export interface CreateOpenClawAppResult {
  appId: string;
  /** Default ingress URL (may be active after deployment completes). */
  defaultIngress: string | null;
}

/**
 * Create an App Platform app from the OpenClaw agent container image.
 * Requires: DIGITALOCEAN_TOKEN, OPENCLAW_AGENT_IMAGE (Docker Hub: "username/openclaw-agent:latest" or "docker.io/username/openclaw-agent:latest"; GHCR: "ghcr.io/openclaw/openclaw:latest").
 * Optional: OPENCLAW_AGENT_HTTP_PORT (default 8080; use 18789 for official OpenClaw Gateway).
 */
export async function createOpenClawApp(
  options: CreateOpenClawAppOptions
): Promise<CreateOpenClawAppResult> {
  const token = process.env.DIGITALOCEAN_TOKEN?.trim();
  if (!token) {
    throw new Error("DIGITALOCEAN_TOKEN is not set");
  }
  const imageRef = process.env.OPENCLAW_AGENT_IMAGE?.trim();
  if (!imageRef) {
    throw new Error("OPENCLAW_AGENT_IMAGE is not set");
  }

  const { mint, apiKey, seedMemoriesJson, gatewayToken } = options;
  // DO app name must match ^[a-z][a-z0-9-]{0,30}[a-z0-9]$ (lowercase, no trailing hyphen). Add random suffix to avoid 409 when re-hatching same mint.
  const base = mint
    .slice(0, 8)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const suffix = Array.from({ length: 6 }, () =>
    "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]
  ).join("");
  const rawName = `openclaw-${base || "agent"}-${suffix}`.slice(0, 32);
  const safeName = rawName.endsWith("-") ? rawName.slice(0, -1) : rawName;
  const envs: { key: string; value: string; type?: string }[] = [
    { key: "TOKEN_MINT", value: mint, type: "GENERAL" },
    { key: "SEED_MEMORIES_JSON", value: seedMemoriesJson, type: "GENERAL" },
  ];
  if (apiKey) {
    envs.push({ key: "LLM_API_KEY", value: apiKey, type: "SECRET" });
    // OpenClaw expects OPENAI_API_KEY or ANTHROPIC_API_KEY; set the one that matches so the agent finds the key.
    const isAnthropic = apiKey.startsWith("sk-ant-");
    if (isAnthropic) {
      envs.push({ key: "ANTHROPIC_API_KEY", value: apiKey, type: "SECRET" });
    } else {
      envs.push({ key: "OPENAI_API_KEY", value: apiKey, type: "SECRET" });
    }
  }
  if (gatewayToken) {
    envs.push({ key: "OPENCLAW_GATEWAY_TOKEN", value: gatewayToken, type: "SECRET" });
  }

  const httpPort = Math.min(
    65535,
    Math.max(1, parseInt(process.env.OPENCLAW_AGENT_HTTP_PORT ?? "8080", 10) || 8080)
  );

  // Official OpenClaw Gateway binds to 127.0.0.1 by default; must bind to 0.0.0.0 for DO health checks.
  if (httpPort === 18789) {
    envs.push({ key: "OPENCLAW_HOST", value: "0.0.0.0", type: "GENERAL" });
    envs.push({ key: "OPENCLAW_GATEWAY_HOST", value: "0.0.0.0", type: "GENERAL" });
    envs.push({ key: "OPENCLAW_CONFIG_PATH", value: "/home/node/.openclaw/openclaw.json", type: "GENERAL" });
  }

  // Parse image ref: ghcr.io/owner/repo[:tag] or docker.io/user/repo[:tag] or user/repo[:tag]
  const isGhcr = /^ghcr\.io\//i.test(imageRef);
  let registry_type: "DOCKER_HUB" | "GHCR" = "DOCKER_HUB";
  let registry = "library";
  let repository = "openclaw-agent";
  let tag = "latest";

  if (isGhcr) {
    registry_type = "GHCR";
    const withoutHost = imageRef.replace(/^ghcr\.io\/?/i, "");
    const [repoPart, tagPart] = withoutHost.includes(":")
      ? withoutHost.split(":")
      : [withoutHost, "latest"];
    tag = (tagPart ?? "latest").trim() || "latest";
    const slashIdx = repoPart.indexOf("/");
    if (slashIdx > 0) {
      registry = repoPart.slice(0, slashIdx).trim();
      repository = repoPart.slice(slashIdx + 1).trim();
    } else {
      registry = "";
      repository = repoPart.trim();
    }
  } else {
    const withoutScheme = imageRef.replace(/^docker\.io\/?/i, "");
    const [repoPart, tagPart] = withoutScheme.includes(":")
      ? withoutScheme.split(":")
      : [withoutScheme, "latest"];
    tag = (tagPart ?? "latest").trim() || "latest";
    const slashIdx = repoPart.indexOf("/");
    registry = slashIdx > 0 ? repoPart.slice(0, slashIdx).trim() : "";
    repository = slashIdx > 0 ? repoPart.slice(slashIdx + 1).trim() : repoPart.trim();
  }

  const spec = {
    name: safeName,
    region: process.env.DIGITALOCEAN_APP_REGION?.trim() || "nyc",
    services: [
      {
        name: "agent",
        image: {
          registry_type,
          registry: registry || "library",
          repository: repository || "openclaw-agent",
          tag,
        },
        instance_count: 1,
        instance_size_slug: "basic-xxs",
        http_port: httpPort,
        ...(httpPort === 18789 && (() => {
          const nodeCode = getOpenClawBootstrapNodeCode();
          const escaped = nodeCode.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
          const run_command = `sh -c 'mkdir -p /home/node/.openclaw && node -e "${escaped}" && exec node openclaw.mjs gateway --allow-unconfigured --bind lan'`;
          return { run_command };
        })()),
        envs: envs.map((e) => ({
          key: e.key,
          value: e.value,
          type: (e.type || "GENERAL").toUpperCase(),
        })),
        ...(httpPort === 18789 && {
          // TCP-only (no http_path) so we only check port is open; Gateway can be slow to serve HTTP.
          health_check: {
            initial_delay_seconds: 120,
            period_seconds: 15,
            timeout_seconds: 10,
            failure_threshold: 6,
          },
        }),
      },
    ],
  };

  const res = await fetch(`${DO_API_BASE}/apps`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ spec }),
  });

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 429) {
      const parsed = (() => {
        try {
          return JSON.parse(err) as { message?: string };
        } catch {
          return {};
        }
      })();
      const msg = parsed.message ?? err;
      if (/app count|exceeds limit|ResourceExhausted/i.test(msg)) {
        throw new Error(
          "DigitalOcean app limit reached (10 apps per account). Delete one or more unused apps in the DigitalOcean dashboard, then try hatching again."
        );
      }
    }
    throw new Error(`DigitalOcean API error: ${res.status} ${err}`);
  }

  const data = (await res.json()) as {
    app?: {
      id?: string;
      default_ingress?: string;
      live_url?: string;
      updated_at?: string;
      spec?: { name?: string };
    };
  };
  const app = data.app;
  const appId = app?.id ?? "";
  let defaultIngress: string | null =
    app?.default_ingress ?? (app as { live_url?: string })?.live_url ?? null;

  // DO assigns default_ingress only after deployment is live; poll until we get a URL or timeout
  const delays = [4000, 8000, 12000, 20000]; // ~44s total
  for (const delayMs of delays) {
    if (defaultIngress) break;
    await new Promise((r) => setTimeout(r, delayMs));
    const getRes = await fetch(`${DO_API_BASE}/apps/${appId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (getRes.ok) {
      const getData = (await getRes.json()) as {
        app?: { default_ingress?: string; live_url?: string };
      };
      defaultIngress =
        getData.app?.default_ingress ?? getData.app?.live_url ?? null;
    }
  }

  // Only return a URL from the API; do not construct one - DNS exists only after DO assigns it
  return { appId, defaultIngress };
}

export interface AppDeploymentStatus {
  /** Live URL when deployment is active. */
  defaultIngress: string | null;
  /** Deployment phase from DO (e.g. PENDING_BUILD, BUILDING, DEPLOYING, ACTIVE). */
  phase: string | null;
  /** Progress string if available (e.g. "1/2"). */
  progress: string | null;
  /** True when the app no longer exists (e.g. deleted in DO dashboard). */
  appNotFound?: boolean;
}

/**
 * Fetch current app and active deployment status from DigitalOcean.
 * Use for polling after hatch when defaultIngress is not yet assigned.
 */
export async function getAppDeploymentStatus(
  appId: string
): Promise<AppDeploymentStatus> {
  const token = process.env.DIGITALOCEAN_TOKEN?.trim();
  if (!token || !appId) {
    return { defaultIngress: null, phase: null, progress: null };
  }
  const [appRes, deploymentsRes] = await Promise.all([
    fetch(`${DO_API_BASE}/apps/${appId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    fetch(`${DO_API_BASE}/apps/${appId}/deployments`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  ]);
  if (appRes.status === 404) {
    return { defaultIngress: null, phase: null, progress: null, appNotFound: true };
  }
  let defaultIngress: string | null = null;
  if (appRes.ok) {
    const appData = (await appRes.json()) as {
      app?: { default_ingress?: string; live_url?: string };
    };
    defaultIngress =
      appData.app?.default_ingress ?? appData.app?.live_url ?? null;
  }
  let phase: string | null = null;
  let progress: string | null = null;
  if (deploymentsRes.ok) {
    const depData = (await deploymentsRes.json()) as {
      deployments?: Array<{
        phase?: string;
        progress?: string | { current_phase?: string };
      }>;
    };
    const latest = depData.deployments?.[0];
    if (latest) {
      phase = latest.phase ?? null;
      const p = latest.progress;
      progress =
        typeof p === "string" ? p : p?.current_phase ?? null;
    }
  }
  return { defaultIngress, phase, progress };
}

/** Deploy target: "droplet" uses Droplets API; "app" or unset uses App Platform. */
const OPENCLAW_DEPLOY_TARGET = process.env.OPENCLAW_DEPLOY_TARGET?.trim().toLowerCase();

export interface CreateOpenClawDropletResult {
  dropletId: string;
  /** http://<droplet_ip>:18789 when droplet is active and IP known; null if still booting. */
  agentUrl: string | null;
}

/**
 * Create a Droplet with cloud-init that runs the OpenClaw gateway container (same bootstrap as App).
 * Requires: DIGITALOCEAN_TOKEN, OPENCLAW_AGENT_IMAGE.
 * Optional: DIGITALOCEAN_DROPLET_REGION, DIGITALOCEAN_DROPLET_SIZE, DIGITALOCEAN_DROPLET_IMAGE.
 */
export async function createOpenClawDroplet(
  options: CreateOpenClawAppOptions
): Promise<CreateOpenClawDropletResult> {
  const token = process.env.DIGITALOCEAN_TOKEN?.trim();
  if (!token) throw new Error("DIGITALOCEAN_TOKEN is not set");
  const imageRef = process.env.OPENCLAW_AGENT_IMAGE?.trim();
  if (!imageRef) throw new Error("OPENCLAW_AGENT_IMAGE is not set");

  const { mint, apiKey, seedMemoriesJson, gatewayToken } = options;
  const region = process.env.DIGITALOCEAN_DROPLET_REGION?.trim() || "nyc1";
  const size = process.env.DIGITALOCEAN_DROPLET_SIZE?.trim() || "s-1vcpu-1gb";
  const dropletImage = process.env.DIGITALOCEAN_DROPLET_IMAGE?.trim() || "docker-20-04";

  const base = mint.slice(0, 8).toLowerCase().replace(/[^a-z0-9]/g, "");
  const suffix = Array.from({ length: 6 }, () =>
    "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]
  ).join("");
  const name = `openclaw-${base || "agent"}-${suffix}`.slice(0, 32).replace(/-$/, "a");

  const nodeCode = getOpenClawBootstrapNodeCode();
  const nodeB64 = Buffer.from(nodeCode, "utf-8").toString("base64");

  const envLines: string[] = [
    `export OPENCLAW_GATEWAY_TOKEN='${escapeBashSingleQuoted(gatewayToken ?? "")}'`,
    `export SEED_MEMORIES_JSON='${escapeBashSingleQuoted(seedMemoriesJson)}'`,
    `export NODE_B64='${nodeB64}'`,
    "export OPENCLAW_HOST='0.0.0.0'",
    "export OPENCLAW_GATEWAY_HOST='0.0.0.0'",
    "export OPENCLAW_CONFIG_PATH='/home/node/.openclaw/openclaw.json'",
  ];
  if (apiKey) {
    if (apiKey.startsWith("sk-ant-")) {
      envLines.push(`export ANTHROPIC_API_KEY='${escapeBashSingleQuoted(apiKey)}'`);
    } else {
      envLines.push(`export OPENAI_API_KEY='${escapeBashSingleQuoted(apiKey)}'`);
    }
  }

  const apiKeyEnv = apiKey
    ? (apiKey.startsWith("sk-ant-")
        ? "-e ANTHROPIC_API_KEY \\\n  "
        : "-e OPENAI_API_KEY \\\n  ")
    : "";
  const userData = `#!/bin/bash
set -e
${envLines.join("\n")}
apt-get update -qq && apt-get install -y -qq docker.io > /dev/null 2>&1
docker pull ${imageRef}
docker run -d --restart unless-stopped -p 18789:18789 \\
  -e OPENCLAW_GATEWAY_TOKEN -e SEED_MEMORIES_JSON -e NODE_B64 \\
  -e OPENCLAW_HOST -e OPENCLAW_GATEWAY_HOST -e OPENCLAW_CONFIG_PATH \\
  ${apiKeyEnv}${imageRef} \\
  sh -c 'mkdir -p /home/node/.openclaw && node -e "$(echo "$NODE_B64" | base64 -d)" && exec node openclaw.mjs gateway --allow-unconfigured --bind lan'
`;

  const createRes = await fetch(`${DO_API_BASE}/droplets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name,
      region,
      size,
      image: dropletImage,
      user_data: userData,
      tags: ["openclaw-hatch"],
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    if (createRes.status === 429) {
      const parsed = (() => {
        try {
          return JSON.parse(err) as { message?: string };
        } catch {
          return {};
        }
      })();
      const msg = parsed.message ?? err;
      if (/limit|ResourceExhausted/i.test(msg)) {
        throw new Error(
          "DigitalOcean droplet limit reached. Delete one or more droplets in the DigitalOcean dashboard, then try again."
        );
      }
    }
    throw new Error(`DigitalOcean API error: ${createRes.status} ${err}`);
  }

  const createData = (await createRes.json()) as { droplet?: { id?: number } };
  const dropletId = String(createData.droplet?.id ?? "");
  if (!dropletId) throw new Error("DigitalOcean did not return a droplet id");

  const delays = [5000, 8000, 10000, 15000, 20000, 25000];
  let agentUrl: string | null = null;
  for (const delayMs of delays) {
    await new Promise((r) => setTimeout(r, delayMs));
    const status = await getDropletStatus(dropletId);
    if (status.dropletNotFound) break;
    if (status.agentUrl) {
      agentUrl = status.agentUrl;
      break;
    }
  }
  return { dropletId, agentUrl };
}

export interface DropletStatusResult {
  agentUrl: string | null;
  /** Public IPv4 when droplet is active (for spawn flow: use as dropletIp). */
  publicIp?: string | null;
  status: string;
  dropletNotFound?: boolean;
}

/**
 * Fetch droplet by id; return agentUrl and publicIp when active and IP is available.
 */
export async function getDropletStatus(dropletId: string): Promise<DropletStatusResult> {
  const token = process.env.DIGITALOCEAN_TOKEN?.trim();
  if (!token || !dropletId) {
    return { agentUrl: null, status: "" };
  }
  const res = await fetch(`${DO_API_BASE}/droplets/${dropletId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) {
    return { agentUrl: null, status: "", dropletNotFound: true };
  }
  if (!res.ok) {
    return { agentUrl: null, status: "error" };
  }
  const data = (await res.json()) as {
    droplet?: {
      status?: string;
      networks?: { v4?: Array<{ ip_address?: string; type?: string }> };
    };
  };
  const droplet = data.droplet;
  const status = droplet?.status ?? "";
  if (status !== "active") {
    return { agentUrl: null, status };
  }
  const v4 = droplet?.networks?.v4;
  const publicIp = v4?.find((n) => n.type === "public")?.ip_address ?? v4?.[0]?.ip_address;
  if (!publicIp) {
    return { agentUrl: null, status: "active" };
  }
  return {
    agentUrl: `http://${publicIp}:18789`,
    publicIp,
    status: "active",
  };
}

export interface CreateSpawnDropletResult {
  dropletId: string;
}

/**
 * Create a minimal Ubuntu Droplet (no OpenClaw container, no gateway token).
 * Used by the spawn flow: user SSHs in and installs OpenClaw per guide.
 * Size: "2gb" → s-1vcpu-2gb, "4gb" → s-2vcpu-4gb.
 */
export async function createSpawnDroplet(options: {
  mint: string;
  size: "2gb" | "4gb";
  sshPublicKey?: string;
}): Promise<CreateSpawnDropletResult> {
  const token = process.env.DIGITALOCEAN_TOKEN?.trim();
  if (!token) throw new Error("DIGITALOCEAN_TOKEN is not set");

  const { mint, size, sshPublicKey } = options;
  const region = process.env.DIGITALOCEAN_DROPLET_REGION?.trim() || "nyc1";
  const sizeSlug = size === "4gb" ? "s-2vcpu-4gb" : "s-1vcpu-2gb";
  const dropletImage = process.env.DIGITALOCEAN_DROPLET_IMAGE?.trim() || "ubuntu-22-04-x64";

  const base = mint.slice(0, 8).toLowerCase().replace(/[^a-z0-9]/g, "");
  const suffix = Array.from({ length: 6 }, () =>
    "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]
  ).join("");
  const name = `openclaw-${base || "agent"}-${suffix}`.slice(0, 32).replace(/-$/, "a");

  // Escape the SSH public key for safe use in a heredoc / bash (one line, no single quotes in key content).
  const keyLine =
    sshPublicKey && sshPublicKey.length > 0 && sshPublicKey.length < 10000
      ? sshPublicKey.replace(/\r?\n/g, "").trim()
      : "";
  const sshBlock =
    keyLine.length > 0
      ? `
mkdir -p /root/.ssh
chmod 700 /root/.ssh
echo '${keyLine.replace(/'/g, "'\"'\"'")}' >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
`
      : "";

  // Key-only SSH: disable password auth, lock root, PAM no_pass_expiry (no "current password" prompt), late re-lock via systemd.
  const keyOnlyBlock =
    keyLine.length > 0
      ? `
mkdir -p /etc/ssh/sshd_config.d
echo 'PasswordAuthentication no' > /etc/ssh/sshd_config.d/99-no-password.conf
echo 'ChallengeResponseAuthentication no' >> /etc/ssh/sshd_config.d/99-no-password.conf
systemctl reload ssh || true
sed -i 's/\\(pam_unix\\.so\\)/\\1 no_pass_expiry/' /etc/pam.d/common-account 2>/dev/null || true
passwd -l root
chage -d -1 root || true
mkdir -p /etc/systemd/system
echo '[Unit]' > /etc/systemd/system/openclaw-root-lock.service
echo 'Description=Lock root for key-only access' >> /etc/systemd/system/openclaw-root-lock.service
echo 'After=cloud-init.service cloud-init.target' >> /etc/systemd/system/openclaw-root-lock.service
echo 'Before=multi-user.target' >> /etc/systemd/system/openclaw-root-lock.service
echo '[Service]' >> /etc/systemd/system/openclaw-root-lock.service
echo 'Type=oneshot' >> /etc/systemd/system/openclaw-root-lock.service
echo 'ExecStart=/bin/sh -c "passwd -l root; chage -d -1 root"' >> /etc/systemd/system/openclaw-root-lock.service
echo 'RemainAfterExit=yes' >> /etc/systemd/system/openclaw-root-lock.service
echo '[Install]' >> /etc/systemd/system/openclaw-root-lock.service
echo 'WantedBy=multi-user.target' >> /etc/systemd/system/openclaw-root-lock.service
systemctl daemon-reload
systemctl enable --now openclaw-root-lock.service || true
`
      : "";

  const userData = `#!/bin/bash
set -e
${sshBlock}
${keyOnlyBlock}
apt-get update -qq && apt-get upgrade -y -qq > /dev/null 2>&1 || true
`;

  const createRes = await fetch(`${DO_API_BASE}/droplets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name,
      region,
      size: sizeSlug,
      image: dropletImage,
      user_data: userData,
      tags: ["openclaw-spawn"],
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    if (createRes.status === 429) {
      const parsed = (() => {
        try {
          return JSON.parse(err) as { message?: string };
        } catch {
          return {};
        }
      })();
      const msg = parsed.message ?? err;
      if (/limit|ResourceExhausted/i.test(msg)) {
        throw new Error(
          "DigitalOcean droplet limit reached. Delete one or more droplets in the DigitalOcean dashboard, then try again."
        );
      }
    }
    throw new Error(`DigitalOcean API error: ${createRes.status} ${err}`);
  }

  const createData = (await createRes.json()) as { droplet?: { id?: number } };
  const dropletId = String(createData.droplet?.id ?? "");
  if (!dropletId) throw new Error("DigitalOcean did not return a droplet id");

  return { dropletId };
}

/** True when deploy target is droplet (default when OPENCLAW_DEPLOY_TARGET is unset or "droplet"; set to "app" for App Platform). */
export function useDropletDeploy(): boolean {
  return OPENCLAW_DEPLOY_TARGET !== "app";
}
