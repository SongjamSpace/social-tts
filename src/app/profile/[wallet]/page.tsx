"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

interface Coin {
  mint: string;
  symbol: string;
  name: string;
  image_uri?: string;
  complete: boolean;
  usd_market_cap?: number;
}

interface LaunchRecord {
  mint: string;
  creator: string;
  seedPayload: Record<string, unknown>;
  createdAt: number | null;
  agentUrl: string | null;
  hatchStatus: string | null;
  dropletIp: string | null;
}

export default function ProfileWalletPage({
  params,
}: {
  params: Promise<{ wallet: string }>;
}) {
  const [wallet, setWallet] = useState<string | null>(null);
  const [coins, setCoins] = useState<Coin[]>([]);
  const [launches, setLaunches] = useState<LaunchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { wallet: w } = await params;
      const decoded = decodeURIComponent(w);
      setWallet(decoded);
      try {
        const [tokensRes, launchesRes] = await Promise.all([
          fetch(`/api/pumpfun/creator-tokens/${encodeURIComponent(decoded)}`),
          fetch(`/api/openclaw/launches?creator=${encodeURIComponent(decoded)}`),
        ]);
        if (cancelled) return;
        const tokensJson = await tokensRes.json();
        const launchesJson = await launchesRes.json();
        if (tokensJson.coins) setCoins(tokensJson.coins);
        if (launchesJson.launches) setLaunches(launchesJson.launches);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);

  const launchByMint = new Map(launches.map((l) => [l.mint, l]));
  const coinByMint = new Map(coins.map((c) => [c.mint, c]));
  // Prefer launches (Firestore) so OpenClaw agents show; fallback to all creator coins if no launch records yet
  const agentTokens =
    launches.length > 0
      ? launches.map((launch) => {
          const coin = coinByMint.get(launch.mint);
          const payload = launch.seedPayload || {};
          return {
            mint: launch.mint,
            name: coin?.name ?? (payload.name as string) ?? "OpenClaw Agent",
            symbol: coin?.symbol ?? (payload.ticker as string) ?? "—",
            image_uri: (payload.imageUrl as string) || coin?.image_uri,
            complete: coin?.complete ?? false,
            usd_market_cap: coin?.usd_market_cap,
          };
        })
      : coins.map((coin) => ({
          mint: coin.mint,
          name: coin.name,
          symbol: coin.symbol,
          image_uri: coin.image_uri,
          complete: coin.complete,
          usd_market_cap: coin.usd_market_cap,
        }));

  // Testing: pretend these mints are bonded with overridden market cap so hatch/Agent Connect UI is visible
  const TEST_MINT_BONDED_OVERRIDES: Record<string, number> = {
    "GGbtYtBp9i6PpGPgMFz3nPvMovs5d1bmkKjcQYY8seve": 100_000,
    "3nWgb7QMtUziSc7qXkxAGrxPdqU7RaMJah4bC7aoseve": 286_000,
  };
  const displayTokens = agentTokens.map((item) => {
    const overrideCap = TEST_MINT_BONDED_OVERRIDES[item.mint];
    if (overrideCap != null) return { ...item, complete: true, usd_market_cap: overrideCap };
    return item;
  });

  function formatMarketCap(mcap: number | undefined): string {
    if (mcap == null || !Number.isFinite(mcap)) return "—";
    if (mcap >= 1_000_000) return `$${(mcap / 1_000_000).toFixed(2)}M`;
    if (mcap >= 1_000) return `$${(mcap / 1_000).toFixed(2)}K`;
    return `$${mcap.toFixed(2)}`;
  }

  if (loading || !wallet) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center bg-[#060608] text-white px-4">
        <p className="text-zinc-400">Loading profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center bg-[#060608] text-white px-4">
        <p className="text-red-400 text-sm">{error}</p>
        <Link href="/profile" className="mt-4 text-zinc-400 hover:text-white text-sm">
          Back to profile
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#060608] text-white px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Profile</h1>
          <p className="text-zinc-500 text-sm font-mono truncate" title={wallet}>
            {wallet.slice(0, 8)}…{wallet.slice(-6)}
          </p>
        </div>

        <section>
          <h2 className="text-lg font-semibold text-white mb-4">My agents</h2>
          {agentTokens.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-zinc-500 text-sm">
              No OpenClaw agents yet.{" "}
              <Link href="/openclaw" className="text-red-400 hover:text-red-300">
                Launch one
              </Link>
              .
            </div>
          ) : (
            <ul className="space-y-3">
              {displayTokens.map((item) => {
                const launch = launchByMint.get(item.mint);
                const coin = item;
                const bonded = coin.complete === true;
                const hasDroplet = Boolean(launch?.dropletIp || launch?.hatchStatus === "spawned" || launch?.hatchStatus === "spawning");
                return (
                  <li
                    key={coin.mint}
                    className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex items-center gap-4"
                  >
                    {coin.image_uri ? (
                      <img
                        src={coin.image_uri}
                        alt=""
                        className="w-14 h-14 rounded-lg object-cover border border-white/10 shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg border border-white/10 bg-white/5 shrink-0 flex items-center justify-center text-zinc-500 text-xs">
                        —
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white truncate">
                        {coin.name} ({coin.symbol})
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[10px] text-zinc-400">
                          MCap: {formatMarketCap(coin.usd_market_cap)}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                            bonded ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-zinc-400"
                          }`}
                        >
                          {bonded ? "Bonded" : "Not bonded"}
                        </span>
                        {hasDroplet && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-red-500/20 text-red-400">
                            Droplet
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col gap-1 items-end">
                      {hasDroplet ? (
                        <Link
                          href={`/spawn/${encodeURIComponent(coin.mint)}`}
                          className="rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold px-3 py-2 text-center"
                        >
                          SSH instructions
                        </Link>
                      ) : bonded && launch ? (
                        <Link
                          href={`/spawn/${encodeURIComponent(coin.mint)}`}
                          className="rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-semibold px-3 py-2 text-center"
                        >
                          Spawn droplet
                        </Link>
                      ) : null}
                      {bonded && (
                        <a
                          href="/agent-connect/releases/latest"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold px-3 py-2 text-center"
                        >
                          Agent Connect
                        </a>
                      )}
                      <a
                        href={`https://pump.fun/coin/${coin.mint}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-zinc-500 hover:text-zinc-400"
                      >
                        View on pump.fun
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <footer className="mt-12 pt-6 border-t border-white/5 text-center text-[10px] text-zinc-600">
          <Link href="/" className="hover:text-zinc-400">
            Eve
          </Link>
          {" · "}
          <Link href="/openclaw" className="hover:text-zinc-400">
            OpenClaw
          </Link>
        </footer>
      </div>
    </div>
  );
}
