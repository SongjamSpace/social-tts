"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useWallets } from "@privy-io/react-auth/solana";

interface SeedPayload {
  name?: string;
  ticker?: string;
  description?: string;
  twitter?: string;
  website?: string;
  telegram?: string;
  tone?: string;
  imagePrompt?: string;
}

export default function HatchOnboardingPage({
  params,
}: {
  params: Promise<{ mint: string }>;
}) {
  const router = useRouter();
  const { wallets } = useWallets();
  const [mint, setMint] = useState<string | null>(null);
  const [payload, setPayload] = useState<SeedPayload>({});
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [hatching, setHatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentUrl, setAgentUrl] = useState<string | null>(null);
  const [gatewayToken, setGatewayToken] = useState<string | null>(null);
  const [storedAgentUrl, setStoredAgentUrl] = useState<string | null>(null);
  const [hatchComplete, setHatchComplete] = useState(false);
  const [intentPaid, setIntentPaid] = useState(false);
  const [deployStatus, setDeployStatus] = useState<"deploying" | null>(null);
  const [deployMessage, setDeployMessage] = useState<string>("");

  const wallet = wallets?.[0]?.address;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { mint: m } = await params;
      setMint(decodeURIComponent(m));
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);

  useEffect(() => {
    if (!mint) return;
    let cancelled = false;
    (async () => {
      try {
        const [intentRes, launchRes] = await Promise.all([
          fetch(`/api/openclaw/hatch-intent?mint=${encodeURIComponent(mint)}`),
          fetch(`/api/openclaw/launch/${encodeURIComponent(mint)}`),
        ]);
        if (cancelled) return;
        const intentData = await intentRes.json();
        setIntentPaid(intentData.status === "paid");
        if (!launchRes.ok) {
          setError("Launch record not found");
          setLoading(false);
          return;
        }
        const launchJson = await launchRes.json();
        const launchData = launchJson.launch;
        const seed = (launchData?.seedPayload ?? {}) as SeedPayload;
        const url = launchData?.agentUrl && typeof launchData.agentUrl === "string" ? launchData.agentUrl.trim() : null;
        if (url) setStoredAgentUrl(url);
        const storedToken = launchData?.gatewayToken && typeof launchData.gatewayToken === "string" ? launchData.gatewayToken.trim() : null;
        if (storedToken) setGatewayToken(storedToken);
        if (launchData?.hatchStatus === "deploying") {
          setDeployStatus("deploying");
          setDeployMessage("Checking deployment status…");
        }
        setPayload({
          name: seed.name ?? "",
          ticker: seed.ticker ?? "",
          description: seed.description ?? "",
          twitter: seed.twitter ?? "",
          website: seed.website ?? "",
          telegram: seed.telegram ?? "",
          tone: seed.tone ?? "",
          imagePrompt: seed.imagePrompt ?? "",
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mint, router]);

  const handleHatch = async () => {
    if (!mint || !wallet) return;
    setHatching(true);
    setError(null);
    setDeployStatus(null);
    try {
      const res = await fetch("/api/openclaw/hatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mint,
          wallet,
          apiKey: apiKey.trim() || undefined,
          seedPayload: payload,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Hatch failed");
        return;
      }
      if (data.status === "deploying") {
        setDeployStatus("deploying");
        setDeployMessage(data.message ?? "App created. Deployment in progress…");
        const deployingToken = data?.gatewayToken && typeof data.gatewayToken === "string" ? data.gatewayToken.trim() : null;
        if (deployingToken) setGatewayToken(deployingToken);
        setHatching(false);
        return;
      }
      const url = data?.agentUrl && typeof data.agentUrl === "string" ? data.agentUrl.trim() : "";
      if (!url) {
        setError(data?.error ?? "Deployment failed. No agent URL returned.");
        return;
      }
      const token = data?.gatewayToken && typeof data.gatewayToken === "string" ? data.gatewayToken.trim() : null;
      setGatewayToken(token || null);
      setHatchComplete(true);
      setAgentUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hatch failed");
    } finally {
      setHatching(false);
    }
  };

  useEffect(() => {
    if (!mint || deployStatus !== "deploying") return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/openclaw/hatch-status?mint=${encodeURIComponent(mint)}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.status === "live") {
          setDeployStatus(null);
          const url = data?.agentUrl && typeof data.agentUrl === "string" ? data.agentUrl.trim() : null;
          const token = data?.gatewayToken && typeof data.gatewayToken === "string" ? data.gatewayToken.trim() : null;
          if (url) {
            setAgentUrl(url);
            setGatewayToken(token ?? null);
            setHatchComplete(true);
          }
          return;
        }
        if (data.status === "deleted") {
          setDeployStatus(null);
          setError(data?.message ?? "The deployment was removed. You can hatch again to create a new agent.");
          return;
        }
        if (data.status === "deploying" && data.message) {
          setDeployMessage(data.message);
        }
      } catch {
        if (!cancelled) setDeployMessage("Checking again…");
      }
    };
    void poll();
    const interval = setInterval(() => {
      if (!cancelled) void poll();
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [mint, deployStatus]);

  if (loading || !mint) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center bg-[#060608] text-white px-4">
        <p className="text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center bg-[#060608] text-white px-4">
        <p className="text-zinc-400 text-sm mb-4">Connect your wallet to continue.</p>
        <Link href="/profile" className="text-red-400 hover:text-red-300 text-sm">
          Back to profile
        </Link>
      </div>
    );
  }

  if (hatchComplete) {
    // OpenClaw Control UI hydrates auth from URL hash (#token=), not query (per OpenClaw docs and issue #17526).
    const successHref = agentUrl
      ? (gatewayToken
          ? `${agentUrl.replace(/#.*/, "")}#token=${encodeURIComponent(gatewayToken)}`
          : agentUrl)
      : "";
    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-[#060608] text-white px-4 py-8">
        <div className="max-w-md mx-auto text-center">
          <h1 className="text-xl font-bold text-white mb-2">Agent hatched</h1>
          <p className="text-zinc-500 text-sm mb-6">
            {agentUrl
              ? "Your OpenClaw agent is live. Open it below to complete onboarding and try it in the browser before connecting to Telegram or WhatsApp."
              : "Hatch recorded. Check your profile for deployment status."}
          </p>
          {agentUrl ? (
            <>
              <a
                href={successHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 text-sm"
              >
                Open your agent — complete onboarding in the UI
              </a>
              {gatewayToken ? (
                <p className="text-zinc-500 text-xs mt-3">
                  The link above includes your gateway token so the Control UI can connect. Save the token if you need to open the dashboard from another device.
                </p>
              ) : null}
              {gatewayToken ? (
                <div className="mt-4 p-4 rounded-xl border border-white/10 bg-white/[0.02] text-left">
                  <p className="text-zinc-400 text-xs mb-2">
                    Gateway token (for manual paste if needed):
                  </p>
                  <code className="block text-xs text-white break-all select-all font-mono bg-white/5 px-3 py-2 rounded">
                    {gatewayToken}
                  </code>
                </div>
              ) : null}
              <p className="text-zinc-500 text-xs mt-3">
                Chat with your agent here first, then use the same agent on other interfaces.
              </p>
            </>
          ) : null}
          <Link href="/profile" className="block mt-6 text-zinc-500 hover:text-zinc-400 text-sm">
            Back to profile
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#060608] text-white px-4 py-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-xl font-bold text-white mb-2">OpenClaw onboarding</h1>
        <p className="text-zinc-500 text-sm mb-6">
          {intentPaid
            ? "Set tone and optional API key, then deploy your agent."
            : "The token is already on-chain. Set up tone and API key, then continue to payment to hatch."}
        </p>
        {error && (
          <p className="text-red-400 text-sm mb-4">{error}</p>
        )}
        {deployStatus === "deploying" && (
          <div className="mb-6 p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 shrink-0 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
              <div>
                <p className="text-white font-medium">Deploying your agent</p>
                <p className="text-zinc-400 text-sm mt-0.5">{deployMessage}</p>
              </div>
            </div>
            <p className="text-zinc-500 text-xs mt-4">
              DigitalOcean is building and starting your container. This page updates every few seconds.
            </p>
          </div>
        )}
        {storedAgentUrl && (
          <div className="mb-6 p-4 rounded-xl border border-white/10 bg-white/[0.02]">
            <p className="text-zinc-400 text-xs mb-2">Current agent URL (if it doesn’t open, use Hatch agent below to get a new one)</p>
            <a
              href={gatewayToken ? `${storedAgentUrl.replace(/#.*/, "")}#token=${encodeURIComponent(gatewayToken)}` : storedAgentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-semibold py-2 px-4"
            >
              Open your agent
            </a>
          </div>
        )}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-zinc-500">Name</span>
              <p className="text-white font-medium truncate" title={payload.name ?? ""}>{payload.name || "—"}</p>
            </div>
            <div>
              <span className="text-zinc-500">Ticker</span>
              <p className="text-white font-medium">{payload.ticker || "—"}</p>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Tone / personality</label>
            <input
              type="text"
              value={payload.tone ?? ""}
              onChange={(e) => setPayload((p) => ({ ...p, tone: e.target.value }))}
              placeholder="e.g. friendly, professional"
              className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">LLM API key (optional)</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="For the agent to use on the VPS. Not stored from seed."
              className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500"
            />
          </div>
          {intentPaid ? (
            <button
              type="button"
              onClick={handleHatch}
              disabled={hatching || deployStatus === "deploying"}
              className="w-full rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold py-3 px-4 text-sm"
            >
              {hatching ? "Hatching…" : "Hatch agent"}
            </button>
          ) : (
            <Link
              href={`/hatch/${encodeURIComponent(mint!)}`}
              className="block w-full rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-4 text-sm text-center"
            >
              Continue to payment
            </Link>
          )}
        </div>
        <Link
          href="/profile"
          className="mt-6 inline-block text-zinc-500 hover:text-zinc-400 text-sm"
        >
          Back to profile
        </Link>
      </div>
    </div>
  );
}
