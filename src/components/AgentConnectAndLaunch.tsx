"use client";

import React, { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import OpenClawLaunch, { type OpenClawLaunchProps } from "@/components/OpenClawLaunch";

/**
 * When info is collected, show Connect wallet in the same chat UI.
 * Once connected, show the launch button (gas only, no dev buys/splits/Eve fee for MVP).
 */
export default function AgentConnectAndLaunch(props: OpenClawLaunchProps) {
  const { ready, connectWallet } = usePrivy();
  const { wallets } = useWallets();
  const [connecting, setConnecting] = useState(false);

  const isConnected = Boolean(wallets?.length);

  const handleConnect = async () => {
    if (!ready || isConnected) return;
    setConnecting(true);
    try {
      await connectWallet();
    } catch (e) {
      console.warn("Connect wallet error:", e);
    } finally {
      setConnecting(false);
    }
  };

  if (isConnected) {
    return <OpenClawLaunch {...props} />;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-500">
        Connect your wallet to deploy. You'll only pay gas — no liquidity seeding, dev buys, or fees for this MVP.
      </p>
      <button
        type="button"
        onClick={handleConnect}
        disabled={!ready || connecting}
        className="w-full rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-bold py-3 px-4 text-sm transition-colors disabled:opacity-50"
      >
        {connecting ? "Connecting..." : "Connect wallet"}
      </button>
    </div>
  );
}
