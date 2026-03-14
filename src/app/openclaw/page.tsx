"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { LLM_PROVIDERS } from "@/lib/llmProviders";
import OpenClawChat from "@/components/OpenClawChat";
import OpenClawLaunch from "@/components/OpenClawLaunch";
import type { OpenClawCollectedPayload, ChatMessage } from "./types";

export type { OpenClawCollectedPayload, ChatMessage };

export default function OpenClawPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [apiKey, setApiKey] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [collectedPayload, setCollectedPayload] = useState<OpenClawCollectedPayload | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const handleStart = () => {
    const key = apiKey.trim();
    if (!key) {
      alert("Please enter your API key.");
      return;
    }
    setStep(2);
    setMessages([]);
    setCollectedPayload(null);
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center bg-[#060608] text-white px-4 py-8">
      <div className="w-full max-w-2xl relative">
        <div className="text-center mb-10">
          <h1
            className="text-3xl sm:text-4xl font-black tracking-tight mb-2"
            style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
          >
            OpenClaw for Normies
          </h1>
          <p className="text-zinc-400 text-sm sm:text-base">
            Launch your tokenized AI agent in minutes. Creator fees go to your wallet for inference.
          </p>
        </div>

        {step === 1 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-6">
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
            <button
              type="button"
              onClick={handleStart}
              className="w-full rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-4 text-sm transition-colors cursor-pointer relative z-10"
            >
              Seed your Agent
            </button>
          </div>
        ) : (
          <OpenClawChat
            apiKey={apiKey.trim()}
            messages={messages}
            setMessages={setMessages}
            collectedPayload={collectedPayload}
            setCollectedPayload={setCollectedPayload}
            imageFile={imageFile}
            setImageFile={setImageFile}
            onBack={() => setStep(1)}
            onLaunchSuccess={() => router.push("/profile")}
          />
        )}
      </div>

      <footer className="mt-auto shrink-0 py-3 border-t border-white/5">
        <div className="flex items-center justify-center gap-3 text-[10px] text-zinc-700">
          <span>© {new Date().getFullYear()} Eve · 4mVbX7EZonRcEfiyFbbw2ByrYc7xAkUMp3NKWhDwpump</span>
          <a
            href="https://discord.com/invite/n7vBHFf5VF"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-zinc-600 hover:text-zinc-400 transition-colors"
            aria-label="Join Eve Army on Discord"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
            Discord
          </a>
        </div>
      </footer>
    </div>
  );
}
