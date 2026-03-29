"use client";

import React from "react";
import Link from "next/link";

export default function SpawnContent({
  params,
}: {
  params: Promise<{ mint: string }>;
}) {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center bg-[#060608] text-white px-4">
      <p className="text-zinc-400 text-sm mb-4">Spawn page loaded successfully.</p>
      <Link href="/profile" className="text-red-400 hover:text-red-300 text-sm">Back to profile</Link>
    </div>
  );
}
