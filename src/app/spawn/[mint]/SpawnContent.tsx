"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useWallets } from "@privy-io/react-auth/solana";

export default function SpawnContent({
  params,
}: {
  params: Promise<{ mint: string }>;
}) {
  const { wallets } = useWallets();
  const wallet = wallets?.[0];
  const walletAddress = wallet?.address;
  const [mint, setMint] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { mint: m } = await params;
      setMint(m ? decodeURIComponent(m) : null);
    })();
  }, [params]);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center bg-[#060608] text-white px-4">
      <p className="text-zinc-400 text-sm mb-2">Spawn page loaded.</p>
      <p className="text-zinc-500 text-xs mb-1">{"Mint: " + (mint || "loading...")}</p>
      <p className="text-zinc-500 text-xs mb-4">{"Wallet: " + (walletAddress || "not connected")}</p>
      <Link href="/profile" className="text-red-400 hover:text-red-300 text-sm">Back to profile</Link>
    </div>
  );
}
