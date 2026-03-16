"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import { AGENT_CONNECT_ANDROID_DOWNLOAD_URL } from "@/lib/openclaw-downloads";

export default function AndroidDownloadPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t")?.trim();

  if (!token) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-[#060608] text-white px-4 py-8 flex flex-col items-center justify-center">
        <div className="max-w-lg w-full text-center space-y-6">
          <h1 className="text-xl font-bold text-white">Android download</h1>
          <p className="text-amber-200/90 text-sm">
            Invalid or missing link. Use the spawn page in your wallet to get a fresh link.
          </p>
          <p className="text-zinc-500 text-xs">
            Return to the spawn page in your wallet and tap &quot;Download for Android (APK + .droplet)&quot; again to get a new link.
          </p>
        </div>
      </div>
    );
  }

  const dropletFileUrl = `/api/openclaw/droplet-file?t=${encodeURIComponent(token)}`;

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#060608] text-white px-4 py-8 flex flex-col items-center justify-center">
      <div className="max-w-lg w-full text-center space-y-6">
        <h1 className="text-xl font-bold text-white">Android download</h1>
        <p className="text-zinc-400 text-sm">
          Tap below to save your connection file, then download the app.
        </p>
        <div className="flex flex-col gap-3">
          <a
            href={dropletFileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-5 text-sm"
          >
            Download .droplet file
          </a>
          <a
            href={AGENT_CONNECT_ANDROID_DOWNLOAD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold py-3 px-5 text-sm border border-white/20"
          >
            Download Agent Connect (Android APK)
          </a>
        </div>
        <p className="text-zinc-500 text-xs">
          The .droplet link works once; after use it will expire.
        </p>
      </div>
    </div>
  );
}
