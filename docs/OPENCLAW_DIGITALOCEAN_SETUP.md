# OpenClaw + DigitalOcean Setup Guide

This guide covers the environment variables and DigitalOcean setup needed so the **hatch** flow can deploy OpenClaw agents. You can use either **Droplets** (recommended) or **App Platform**.

---

## 1. What goes in `.env.local`

Add these to your `.env.local` (and to your production env, e.g. Vercel):

| Variable | Required | Description |
|----------|----------|-------------|
| `DIGITALOCEAN_TOKEN` | **Yes** (for real deploys) | DigitalOcean API token with read/write access to create and manage Droplets or App Platform apps. |
| `OPENCLAW_AGENT_IMAGE` | **Yes** (for real deploys) | Container image for the agent. Docker Hub: `your-dockerhub-user/openclaw-agent:latest`. Official OpenClaw: `ghcr.io/openclaw/openclaw:latest`. |
| `OPENCLAW_DEPLOY_TARGET` | No | Default is Droplets. Set to `app` to use App Platform instead. |
| `OPENCLAW_AGENT_HTTP_PORT` | No | Port the container listens on (default: `8080`). Use `18789` when using the official OpenClaw Gateway image. |
| `DIGITALOCEAN_APP_REGION` | No | App Platform region when using App (default: `nyc`). Ignored for Droplets. |
| `DIGITALOCEAN_DROPLET_REGION` | No | Droplet region when using Droplets (default: `nyc1`). Examples: `nyc1`, `sfo3`, `ams3`. |
| `DIGITALOCEAN_DROPLET_SIZE` | No | Droplet size when using Droplets (default: `s-1vcpu-1gb`). |
| `DIGITALOCEAN_DROPLET_IMAGE` | No | Droplet image slug for cloud-init (default: `docker-20-04`). Use an Ubuntu or Docker image so cloud-init and Docker are available. |
| `NEXT_PUBLIC_OPENCLAW_AGENT_STUB_URL` | No | Fallback URL shown when DO is not configured or deploy fails (e.g. a placeholder or docs link). |
| `BLOB_READ_WRITE_TOKEN` | No (recommended for Android) | Vercel Blob token. When set, the one-time .droplet download is served via redirect to Blob storage so Android’s download manager receives the file from the CDN (avoids “Download unsuccessful”). Create a Blob store in the Vercel project and add the token to env. |

**Minimal example (custom minimal agent, port 8080):**

```bash
# .env.local

DIGITALOCEAN_TOKEN=your_do_api_token_here
OPENCLAW_AGENT_IMAGE=your-dockerhub-user/openclaw-agent:latest

# Optional
DIGITALOCEAN_APP_REGION=nyc
```

**Official OpenClaw stack (Control UI, onboarding, channels, skills) on Droplets (recommended):**

```bash
# .env.local – Droplet + full OpenClaw Gateway + Control UI

DIGITALOCEAN_TOKEN=your_do_api_token_here
OPENCLAW_AGENT_IMAGE=ghcr.io/openclaw/openclaw:latest
OPENCLAW_AGENT_HTTP_PORT=18789
OPENCLAW_DEPLOY_TARGET=droplet

# Optional Droplet settings
DIGITALOCEAN_DROPLET_REGION=nyc1
DIGITALOCEAN_DROPLET_SIZE=s-1vcpu-1gb
DIGITALOCEAN_DROPLET_IMAGE=docker-20-04
```

**Legacy: App Platform (set `OPENCLAW_DEPLOY_TARGET=app` or omit to use App):**

```bash
# .env.local – App Platform

DIGITALOCEAN_TOKEN=your_do_api_token_here
OPENCLAW_AGENT_IMAGE=ghcr.io/openclaw/openclaw:latest
OPENCLAW_AGENT_HTTP_PORT=18789
DIGITALOCEAN_APP_REGION=nyc
```

The hatch API automatically sets `OPENCLAW_HOST=0.0.0.0` in the container when using port 18789 so the Gateway listens on all interfaces (and, for App Platform, passes health checks).

### Droplet deployment (when `OPENCLAW_DEPLOY_TARGET=droplet`)

Each hatch creates a **DigitalOcean Droplet** with cloud-init that installs Docker, pulls the OpenClaw image, and runs the same bootstrap (gateway token, identity, SOUL.md, model config) as the App Platform path. The agent URL is **`http://<droplet_public_ip>:18789`** (no HTTPS unless you add a reverse proxy such as Caddy or nginx on the droplet). If you lock down the droplet with a firewall, open **port 18789** so the Control UI is reachable.

If `DIGITALOCEAN_TOKEN` or `OPENCLAW_AGENT_IMAGE` is missing, the hatch API still runs but does not create a real app; it will set `agentUrl` to `NEXT_PUBLIC_OPENCLAW_AGENT_STUB_URL` (or `null`) so you can test the flow without DO.

### What you get with the official OpenClaw image

When you set `OPENCLAW_AGENT_IMAGE=ghcr.io/openclaw/openclaw:latest` and `OPENCLAW_AGENT_HTTP_PORT=18789`, each hatched app runs the **official [OpenClaw](https://github.com/openclaw/openclaw) stack**: the Gateway serves the **Control UI** at the agent URL (chat, config, exec approvals). Onboarding (skills, Gateway, channels, workspace, model/auth) follows the same flow as in the [OpenClaw onboarding docs](https://docs.openclaw.ai/start/onboarding-overview); if the Control UI does not show a built-in wizard in the browser, users can complete setup via the Control UI’s config and chat. The hatch API generates a **gateway token** per hatch, passes it to the container as `OPENCLAW_GATEWAY_TOKEN`, and at startup the container writes it into `~/.openclaw/openclaw.json` (with `OPENCLAW_CONFIG_PATH` set so the Gateway reads that file). The token is returned in the hatch response and stored in the launch record; the “Open agent” link includes it as `#token=...` in the URL hash (per OpenClaw Control UI docs) so the Control UI can connect without a manual paste. The written config sets `gateway.controlUi.dangerouslyDisableDeviceAuth: true` so token-only auth works without device pairing (avoids “pairing required” on remote HTTPS). If the user provides an LLM API key during hatch, it is passed as `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` (inferred from the key format: `sk-ant-` → Anthropic, otherwise OpenAI), and the bootstrap writes `models.providers` and `agents.defaults.model.primary` so the default agent uses that provider (e.g. `openai/gpt-4o` or `anthropic/claude-sonnet-4-5`) and no “No API key found for provider” error appears. The bootstrap also reads `SEED_MEMORIES_JSON` (the seed payload from onboarding: name, ticker, description, tone, etc.) and sets the gateway agent **identity** (name and theme/personality) and writes `~/.openclaw/workspace/SOUL.md` with name, tone, and purpose (description) so the agent starts with its intended identity and personality. If you still see “gateway token missing”, use an OpenClaw image that includes the [token-from-URL fix](https://github.com/openclaw/openclaw/issues/17526) (e.g. `ghcr.io/openclaw/openclaw:latest` or a 2026.2.23+ build), ensure the app was created with the current hatch flow (run command writes the config), and that the component has `OPENCLAW_GATEWAY_TOKEN` set in the DigitalOcean app spec.

### Droplet and App limits (DigitalOcean)

- **Droplets:** Account droplet limits apply. If hatch fails with a limit or 429 error when using Droplets, delete one or more droplets in [Droplets](https://cloud.digitalocean.com/droplets), then try again.
- **App Platform:** Allows **10 apps per account** on the default plan. If hatch fails with “app limit reached” or a 429 error when using App, delete one or more unused apps in [Apps](https://cloud.digitalocean.com/apps), then try again.

### Backward compatibility: minimal vs official

- **Default / full experience:** Use the official image and port above so new hatches get the full OpenClaw onboarding and Control UI.
- **Minimal agent (optional):** The **`openclaw-agent/`** directory in this repo remains available as an optional “minimal” image: simple chat UI only, no Gateway or channels. Set `OPENCLAW_AGENT_IMAGE=your-dockerhub-user/openclaw-agent:latest` and leave `OPENCLAW_AGENT_HTTP_PORT` unset (or `8080`) for that experience.

---

## 2. How to get `DIGITALOCEAN_TOKEN` (step-by-step)

1. **Log in to DigitalOcean**  
   Go to [https://cloud.digitalocean.com](https://cloud.digitalocean.com) and sign in.

2. **Open API tokens**  
   - Click your profile/avatar (top right) → **API**  
   - Or go directly: [https://cloud.digitalocean.com/account/api/tokens](https://cloud.digitalocean.com/account/api/tokens)

3. **Create a new token**  
   - Click **Generate New Token**.  
   - Choose a name (e.g. `OpenClaw Hatch`).  
   - Set scope to **Full Access** (or a custom scope that includes App Platform read/write; Full Access is simplest for getting started).  
   - Click **Generate Token**.

4. **Copy the token once**  
   The token is shown only once. Copy it and paste it into `.env.local` as `DIGITALOCEAN_TOKEN`.  
   If you lose it, create a new token and revoke the old one.

5. **Add to `.env.local`**  
   ```bash
   DIGITALOCEAN_TOKEN=dop_v1_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

---

## 3. `OPENCLAW_AGENT_IMAGE` – what it is and how to set it

The hatch flow creates a **DigitalOcean App Platform** app that runs a **single container**. That container is specified by `OPENCLAW_AGENT_IMAGE`.

- **Format:** `[registry/]repository[:tag]`  
  - Docker Hub: `username/repo-name` or `username/repo-name:latest`  
  - With registry: `docker.io/username/repo-name:latest`

- **Examples:**  
  - Docker Hub: `myorg/openclaw-agent:latest`, `docker.io/myorg/openclaw-agent:v1.0`  
  - GitHub Container Registry (official OpenClaw): `ghcr.io/openclaw/openclaw:latest`

**Minimal agent in this repo:** The repository includes a complete OpenClaw agent server in the **`openclaw-agent/`** directory. It serves a chat UI and streams LLM responses (OpenAI or Anthropic) using `SEED_MEMORIES_JSON` as the agent’s identity and `LLM_API_KEY` (or a visitor-supplied key) for the API. Build the image **for linux/amd64** (required by DigitalOcean App Platform):

From the **`openclaw-agent/`** directory you can use the helper script (uses your Docker Hub image name):

```bash
cd openclaw-agent
./build-for-do.sh your-dockerhub-username/openclaw-agent:latest
docker push your-dockerhub-username/openclaw-agent:latest
```

Or from the repo root:

```bash
docker buildx build --platform linux/amd64 -t your-dockerhub-username/openclaw-agent:latest ./openclaw-agent
docker push your-dockerhub-username/openclaw-agent:latest
```

If you build without `--platform linux/amd64` (e.g. plain `docker build` on Apple Silicon), DO will fail with "Container Image Platform Mismatch". You can also copy the contents of `openclaw-agent/` into your own project and build there with the same platform flag. The app listens on port 8080 and reads env vars: `TOKEN_MINT`, `SEED_MEMORIES_JSON`, and optionally `LLM_API_KEY`. After rebuilding and pushing the image, hatch-created apps will serve the full chat agent.

---

## 4. Optional: `DIGITALOCEAN_APP_REGION`

- Default: `nyc`.  
- Set this if you want apps in another region, e.g. `sfo`, `ams`, `sgp`.  
- Must be a valid [App Platform region](https://docs.digitalocean.com/products/app-platform/how-to/choose-datacenter-region/).

---

## 5. Checklist

- [ ] DigitalOcean account created.  
- [ ] API token created and copied into `DIGITALOCEAN_TOKEN` in `.env.local`.  
- [ ] Agent container image chosen: `OPENCLAW_AGENT_IMAGE` set (Docker Hub or `ghcr.io/openclaw/openclaw:latest` for official stack).  
- [ ] If using official OpenClaw image: set `OPENCLAW_AGENT_HTTP_PORT=18789`.  
- [ ] (Droplet) Set `OPENCLAW_DEPLOY_TARGET=droplet` to use Droplets; optionally set `DIGITALOCEAN_DROPLET_REGION`, `DIGITALOCEAN_DROPLET_SIZE`, `DIGITALOCEAN_DROPLET_IMAGE`.
- [ ] (App) If using App Platform, (optional) `DIGITALOCEAN_APP_REGION` set if not using `nyc`.  
- [ ] (Optional) `NEXT_PUBLIC_OPENCLAW_AGENT_STUB_URL` set if you want a fallback when DO deploy is skipped or fails.  
- [ ] Restart Next.js after changing `.env.local` (e.g. `npm run dev`).

After this, when a user completes the hatch payment and onboarding, `POST /api/openclaw/hatch` will create a **Droplet** (if `OPENCLAW_DEPLOY_TARGET=droplet`) or an **App Platform** app, and store the agent URL (and gateway token for official OpenClaw) in Firestore. The agent URL is `http://<droplet_ip>:18789` for Droplets or the App default ingress for App Platform. Show the user the **gateway token** once (e.g. on the success or “Open agent” screen) so they can paste it into the Control UI when prompted. The “Open agent” link then opens the agent’s Control UI (or minimal chat, depending on the image).
