"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import type { OpenClawCollectedPayload, ChatMessage } from "@/app/openclaw/types";
import { usePrivyAvailable } from "@/components/providers";
import OpenClawConnectAndLaunch from "@/components/OpenClawConnectAndLaunch";

const DEFAULT_LOGO_PROMPT = "Professional token logo, minimal, clean design, square, suitable for cryptocurrency token";

/** Generate or re-generate logo via OpenAI (DALL-E). User can add prompt details and regenerate. */
function GenerateLogoBlock({
  apiKey,
  agentName,
  imageUrl,
  initialPromptDetail,
  onImageUrl,
}: {
  apiKey: string;
  agentName: string;
  imageUrl?: string;
  /** Pre-fill from what the user told the chatbot (e.g. "cartoon, blue and gold"). */
  initialPromptDetail?: string;
  onImageUrl: (url: string) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promptDetail, setPromptDetail] = useState(initialPromptDetail ?? "");
  useEffect(() => {
    if (initialPromptDetail != null && initialPromptDetail !== "") setPromptDetail(initialPromptDetail);
  }, [initialPromptDetail]);

  const buildPrompt = () => {
    const base = `Professional token logo for "${agentName}", ${DEFAULT_LOGO_PROMPT}`;
    const extra = promptDetail.trim();
    return extra ? `${base}. ${extra}` : base;
  };

  const handleGenerate = async () => {
    if (!apiKey || !agentName.trim()) return;
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/openclaw/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          prompt: buildPrompt(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Image generation failed");
        return;
      }
      if (data?.url) onImageUrl(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image generation failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-3">
      <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Logo</p>
      {imageUrl && (
        <div className="flex items-center gap-2">
          <img src={imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover border border-white/10 shrink-0" />
          <span className="text-xs text-zinc-400">Current logo</span>
        </div>
      )}
      <div>
        <label className="block text-xs text-zinc-500 mb-1">Extra prompt details (optional)</label>
        <input
          type="text"
          value={promptDetail}
          onChange={(e) => setPromptDetail(e.target.value)}
          placeholder="e.g. cartoon style, blue and gold, mascot"
          className="w-full rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500/50"
        />
      </div>
      <button
        type="button"
        onClick={handleGenerate}
        disabled={generating}
        className="w-full rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-white text-sm font-medium py-2 px-3 disabled:opacity-50"
      >
        {generating ? "Generating…" : imageUrl ? "Regenerate logo" : "Generate logo"}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

export interface OpenClawChatProps {
  apiKey: string;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  collectedPayload: OpenClawCollectedPayload | null;
  setCollectedPayload: React.Dispatch<React.SetStateAction<OpenClawCollectedPayload | null>>;
  imageFile: File | null;
  setImageFile: React.Dispatch<React.SetStateAction<File | null>>;
  onBack: () => void;
  onLaunchSuccess: (mint: string, agentUrl?: string) => void;
}

export default function OpenClawChat({
  apiKey,
  messages,
  setMessages,
  collectedPayload,
  setCollectedPayload,
  imageFile,
  setImageFile,
  onBack,
  onLaunchSuccess,
}: OpenClawChatProps) {
  const privyAvailable = usePrivyAvailable();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const initialGreetStartedRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  /** Consume NDJSON stream from chat API: { chunk } for text, { done, collected? } at end. */
  const streamChat = async (
    requestMessages: ChatMessage[],
    onChunk: (text: string) => void,
    onDone: (collected?: Record<string, unknown>) => void,
    onError: (err: string) => void
  ) => {
    const res = await fetch("/api/openclaw/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, messages: requestMessages }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      onError(data?.error ?? res.statusText);
      return;
    }
    const reader = res.body?.getReader();
    if (!reader) {
      onError("No response body");
      return;
    }
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line) as { chunk?: string; done?: boolean; collected?: Record<string, unknown>; error?: string };
            if (data.error) {
              onError(data.error);
              return;
            }
            if (typeof data.chunk === "string") onChunk(data.chunk);
            if (data.done) {
              onDone(data.collected);
              return;
            }
          } catch {
            // skip malformed lines
          }
        }
      }
      onDone();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  };

  // Send first "I'm ready" and get agent greeting when chat mounts (messages empty). Use ref to avoid double run in React Strict Mode.
  useEffect(() => {
    if (initialGreetStartedRef.current || messages.length > 0) return;
    initialGreetStartedRef.current = true;
    const greet = async () => {
      setLoading(true);
      setMessages([
        { role: "user", content: "I'm ready to set up my token." },
        { role: "assistant", content: "" },
      ]);
      try {
        await streamChat(
          [{ role: "user", content: "I'm ready to set up my token." }],
          (chunk) => {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "assistant") next[next.length - 1] = { ...last, content: last.content + chunk };
              return next;
            });
          },
          (collected) => {
            if (collected && typeof collected === "object") {
              setCollectedPayload((prev) => ({ ...(prev ?? {}), ...collected } as OpenClawCollectedPayload));
            }
          },
          (err) => {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "assistant") next[next.length - 1] = { ...last, content: last.content || err + " You can try again or go back." };
              return next;
            });
          }
        );
      } catch (e) {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant") next[next.length - 1] = { ...last, content: (e instanceof Error ? e.message : String(e)) + " You can try again or go back." };
          return next;
        });
      } finally {
        setLoading(false);
      }
    };
    greet();
  }, [apiKey, messages.length]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const newUserMessage: ChatMessage = { role: "user", content: text };
    const nextMessages = [...messages, newUserMessage];
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setLoading(true);
    try {
      await streamChat(
        nextMessages,
        (chunk) => {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === "assistant") next[next.length - 1] = { ...last, content: last.content + chunk };
            return next;
          });
        },
        (collected) => {
          if (collected && typeof collected === "object") {
            setCollectedPayload((prev) => ({ ...(prev ?? {}), ...collected } as OpenClawCollectedPayload));
          }
        },
        (err) => {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === "assistant") next[next.length - 1] = { ...last, content: last.content || "Error: " + err };
            return next;
          });
        }
      );
    } catch (e) {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant") next[next.length - 1] = { ...last, content: "Error: " + (e instanceof Error ? e.message : String(e)) };
        return next;
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] flex flex-col overflow-hidden" style={{ minHeight: "420px" }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <button
          type="button"
          onClick={onBack}
          className="text-zinc-400 hover:text-white text-sm"
        >
          ← Back
        </button>
        <span className="text-sm font-medium text-white">Seed Agent Chat</span>
        <div className="w-10" />
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[240px] max-h-[360px]">
        {messages.length === 0 && !loading && (
          <p className="text-zinc-500 text-sm">Starting conversation...</p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-red-500/20 text-white"
                  : "bg-white/[0.06] text-zinc-200 border border-white/10"
              }`}
            >
              {m.content}
              {m.role === "assistant" && loading && i === messages.length - 1 && (
                <span className="animate-pulse opacity-90" aria-hidden>▌</span>
              )}
            </div>
          </div>
        ))}
        {loading && messages.length > 0 && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="rounded-xl px-3 py-2 text-sm bg-white/[0.06] text-zinc-400 border border-white/10">
              ...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 border-t border-white/10 space-y-3">
        {collectedPayload?.name && collectedPayload?.ticker ? (
          <>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs space-y-1">
              <p className="text-zinc-500 uppercase tracking-wider font-semibold">Collected info</p>
              <p><span className="text-zinc-400">Name:</span> {collectedPayload.name}</p>
              <p><span className="text-zinc-400">Ticker:</span> {collectedPayload.ticker}</p>
              {collectedPayload.description && <p><span className="text-zinc-400">Description:</span> {collectedPayload.description}</p>}
              {(collectedPayload.website || collectedPayload.twitter || collectedPayload.telegram) && (
                <p><span className="text-zinc-400">Links:</span> {[collectedPayload.website, collectedPayload.twitter, collectedPayload.telegram].filter(Boolean).join(", ") || "—"}</p>
              )}
            </div>
            <GenerateLogoBlock
              apiKey={apiKey}
              agentName={collectedPayload.name}
              imageUrl={collectedPayload.imageUrl}
              initialPromptDetail={collectedPayload.imagePrompt}
              onImageUrl={(url) => setCollectedPayload((prev) => prev ? { ...prev, imageUrl: url } : null)}
            />
            {privyAvailable ? (
              <OpenClawConnectAndLaunch
                apiKey={apiKey}
                tokenName={collectedPayload.name}
                symbol={collectedPayload.ticker}
                imageFile={imageFile}
                imageUrl={collectedPayload.imageUrl}
                websiteUrl={collectedPayload.website ?? ""}
                twitterUrl={collectedPayload.twitter ?? ""}
                telegramUrl={collectedPayload.telegram ?? ""}
                description={collectedPayload.description}
                onSuccess={onLaunchSuccess}
              />
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-400">
                Connect your wallet on the{" "}
                <Link href="/" className="text-red-400 hover:text-red-300 underline">
                  Eve home page
                </Link>
                first, then return here to deploy.
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="Type a message..."
                className="flex-1 bg-white/[0.06] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500/50"
                disabled={loading}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={loading}
                className="rounded-xl bg-red-500 hover:bg-red-600 disabled:bg-red-500/50 text-white font-bold py-2.5 px-4 text-sm"
              >
                Send
              </button>
            </div>
            <div>
              <label className="block text-zinc-500 text-xs mb-1">Image (when agent asks)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-white/10 file:text-white"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
