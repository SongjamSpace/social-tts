"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import Link from "next/link";

/**
 * My profile: redirect to /profile/[wallet] when connected, else prompt to connect.
 */
export default function ProfilePage() {
  const router = useRouter();
  const { ready, connectWallet } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets?.[0]?.address;
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (wallet) {
      router.replace(`/profile/${encodeURIComponent(wallet)}`);
    }
  }, [wallet, router]);

  const handleConnect = async () => {
    if (!ready || wallet) return;
    setConnecting(true);
    try {
      await connectWallet();
    } catch (e) {
      console.warn("Connect wallet error:", e);
    } finally {
      setConnecting(false);
    }
  };

  if (wallet) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center bg-[#060608] text-white px-4">
        <p className="text-zinc-400">Loading your profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center bg-[#060608] text-white px-4">
      <h1 className="text-xl font-bold text-white mb-2">My Profile</h1>
      <p className="text-zinc-400 text-sm text-center max-w-md mb-6">
        Connect your wallet to see your tokenized agents and spawn status.
      </p>
      <button
        type="button"
        onClick={handleConnect}
        disabled={!ready || connecting}
        className="rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold py-2.5 px-4 text-sm transition-colors"
      >
        {connecting ? "Connecting..." : "Connect wallet"}
      </button>
      <p className="text-zinc-500 text-xs mt-4">
        Or connect from the{" "}
        <Link href="/openclaw" className="text-red-400 hover:text-red-300 underline">
          OpenClaw
        </Link>{" "}
        or Eve home page.
      </p>
    </div>
  );
}
