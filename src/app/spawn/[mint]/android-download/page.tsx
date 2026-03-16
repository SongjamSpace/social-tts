"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AGENT_CONNECT_ANDROID_DOWNLOAD_URL } from "@/lib/openclaw-downloads";

type Status = "idle" | "downloading" | "done" | "error";

export default function AndroidDownloadPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t")?.trim();
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("Invalid or missing link. Use the spawn page in your wallet to get a fresh link.");
      return;
    }

    let cancelled = false;

    const run = async () => {
      setStatus("downloading");
      try {
        const res = await fetch(`/api/openclaw/droplet-file?t=${encodeURIComponent(token)}`);
        if (cancelled) return;

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setErrorMessage((data?.error as string) || "Link expired or already used.");
          setStatus("error");
          return;
        }

        const blob = await res.blob();
        if (cancelled) return;

        const disposition = res.headers.get("Content-Disposition");
        const match = disposition?.match(/filename="?([^";]+)"?/);
        const filename = match?.[1]?.trim() || "openclaw-droplet.droplet";

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        if (!cancelled) setStatus("done");
      } catch (e) {
        if (!cancelled) {
          setErrorMessage(e instanceof Error ? e.message : "Download failed.");
          setStatus("error");
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#060608] text-white px-4 py-8 flex flex-col items-center justify-center">
      <div className="max-w-lg w-full text-center space-y-6">
        <h1 className="text-xl font-bold text-white">Android download</h1>

        {status === "idle" && (
          <p className="text-zinc-400 text-sm">Preparing...</p>
        )}

        {status === "downloading" && (
          <p className="text-zinc-400 text-sm">Downloading .droplet file...</p>
        )}

        {status === "done" && (
          <>
            <p className="text-zinc-400 text-sm">
              Your .droplet file should have downloaded. If not, the link was already used—go back to the spawn page in your wallet and try again.
            </p>
            <p className="text-zinc-400 text-sm">Download the Agent Connect app for Android:</p>
            <a
              href={AGENT_CONNECT_ANDROID_DOWNLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-5 text-sm"
            >
              Download Agent Connect (Android APK)
            </a>
          </>
        )}

        {status === "error" && (
          <>
            <p className="text-amber-200/90 text-sm">{errorMessage}</p>
            <p className="text-zinc-500 text-xs">
              Return to the spawn page in your wallet and tap &quot;Download for Android (APK + .droplet)&quot; again to get a new link.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
