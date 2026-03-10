"use client";

import React, { useState } from "react";
import Link from "next/link";
import { LLM_PROVIDERS } from "@/lib/llmProviders";
import OpenClawLaunch from "@/components/OpenClawLaunch";

export default function OpenClawPage() {
  const [apiKey, setApiKey] = useState("");
  const [tokenName, setTokenName] = useState("");
  const [ticker, setTicker] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [launchSuccess, setLaunchSuccess] = useState<{ mint: string; agentUrl?: string } | null>(null);

  const pumpUrl = launchSuccess ? `https://pump.fun/coin/${launchSuccess.mint}` : null;

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center bg-[#060608] text-white px-4 py-8">
      <div className="w-full max-w-2xl">
        {/* Hero */}
        <div className="text-center mb-10">
          <h1
            className="text-3xl sm:text-4xl font-black tracking-tight mb-2"
            style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
          >
            OpenClaw for Normies
          </h1>
          <p className="text-zinc-400 text-sm sm:text-base">
            Launch your token and AI agent in minutes. Creator fees go to your wallet.
          </p>
        </div>

        {!launchSuccess ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-6">
            {/* Step 1: API key */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                API key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste your LLM API key"
                className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500/50"
                autoComplete="off"
              />
            </div>

            {/* Provider table */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">
                Need an API key?
              </p>
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.03]">
                      <th className="px-3 py-2 font-semibold text-zinc-400">Provider</th>
                      <th className="px-3 py-2 font-semibold text-zinc-400">Models</th>
                      <th className="px-3 py-2 font-semibold text-zinc-400">Price</th>
                      <th className="px-3 py-2 font-semibold text-zinc-400">Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {LLM_PROVIDERS.map((p) => (
                      <tr key={p.slug} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="px-3 py-2 text-white font-medium">{p.name}</td>
                        <td className="px-3 py-2 text-zinc-400">{p.models.slice(0, 2).join(", ")}</td>
                        <td className="px-3 py-2 text-zinc-400">{p.priceText}</td>
                        <td className="px-3 py-2">
                          <a
                            href={p.getApiKeyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-red-400 hover:text-red-300"
                          >
                            Get key
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Step 2: Token info */}
            <div className="space-y-4 pt-2">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                Token info
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-zinc-400 text-xs mb-1">Token name</label>
                  <input
                    type="text"
                    value={tokenName}
                    onChange={(e) => setTokenName(e.target.value)}
                    placeholder="My Agent"
                    className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500/50"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 text-xs mb-1">Ticker</label>
                  <input
                    type="text"
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value.toUpperCase().slice(0, 10))}
                    placeholder="AGENT"
                    className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-zinc-400 text-xs mb-1">Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-white/10 file:text-white"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="block text-zinc-400 text-xs mb-1">Website</label>
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500/50"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 text-xs mb-1">Twitter</label>
                  <input
                    type="text"
                    value={twitter}
                    onChange={(e) => setTwitter(e.target.value)}
                    placeholder="@handle or URL"
                    className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-zinc-400 text-xs mb-1">Telegram (optional)</label>
                <input
                  type="text"
                  value={telegram}
                  onChange={(e) => setTelegram(e.target.value)}
                  placeholder="t.me/..."
                  className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500/50"
                />
              </div>
            </div>

            {/* Step 3: Launch */}
            <OpenClawLaunch
              apiKey={apiKey}
              tokenName={tokenName}
              symbol={ticker}
              imageFile={imageFile}
              websiteUrl={website}
              twitterUrl={twitter}
              telegramUrl={telegram}
              onSuccess={(mint, agentUrl) => setLaunchSuccess({ mint, agentUrl })}
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
            <h2 className="text-xl font-bold text-white">You&apos;re live</h2>
            <p className="text-zinc-400 text-sm">
              Your token is on Pump.fun and your agent is deploying.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href={pumpUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-red-500/20 text-red-400 px-4 py-2 text-sm font-semibold hover:bg-red-500/30"
              >
                View token on pump.fun
              </a>
              {launchSuccess.agentUrl && (
                <a
                  href={launchSuccess.agentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-white/10 text-white px-4 py-2 text-sm font-semibold hover:bg-white/15"
                >
                  Open your agent
                </a>
              )}
            </div>
            <button
              type="button"
              onClick={() => setLaunchSuccess(null)}
              className="text-zinc-500 hover:text-zinc-300 text-sm"
            >
              Launch another
            </button>
          </div>
        )}
      </div>

      <footer className="mt-auto pt-8 text-center text-[10px] text-zinc-600">
        <Link href="/" className="hover:text-zinc-400">
          Eve
        </Link>
        {" · "}
        <a
          href="https://discord.com/invite/n7vBHFf5VF"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-zinc-400"
        >
          Discord
        </a>
      </footer>
    </div>
  );
}
