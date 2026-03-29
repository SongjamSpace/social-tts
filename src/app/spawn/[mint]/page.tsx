"use client";

import dynamic from "next/dynamic";

const SpawnContent = dynamic(() => import("./SpawnContent"), {
  ssr: false,
  loading: () => (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center bg-[#060608] text-white">
      <p className="text-zinc-400">Loading...</p>
    </div>
  ),
});

export default function SpawnPage({
  params,
}: {
  params: Promise<{ mint: string }>;
}) {
  return <SpawnContent params={params} />;
}
