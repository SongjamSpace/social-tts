"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallets } from "@privy-io/react-auth/solana";
import Link from "next/link";

/**
 * My profile: redirect to /profile/[wallet] when connected, else prompt to connect.
 */
export default function ProfilePage() {
  const router = useRouter();
  const { wallets } = useWallets();
  const wallet = wallets?.[0]?.address;

  useEffect(() => {
    if (wallet) {
      router.replace(`/profile/${encodeURIComponent(wallet)}`);
    }
  }, [wallet, router]);

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
        Connect your wallet to see your tokenized agents and hatch status.
      </p>
      <Link
        href="/openclaw"
        className="rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 px-4 text-sm"
      >
        Connect on OpenClaw
      </Link>
      <p className="text-zinc-500 text-xs mt-4">
        Or connect from the Eve home page.
      </p>
    </div>
  );
}
