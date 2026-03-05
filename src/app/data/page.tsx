"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  CreatorAggregate,
  CreatorAggregateToken,
  DeployerAnalytics,
  PumpFunCoin,
} from "@/types/pumpfun";

const fmt = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
      ? `${(n / 1_000).toFixed(2)}K`
      : n.toLocaleString();

const fmtUsd = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type SortKey = "mindshare" | "token_count" | "bonded" | "volume" | "usd_market_cap" | "creator_fees" | "creator_display_name" | "followers_count" | "likes_received";

const NUMERIC_COLS: { key: SortKey; label: string }[] = [
  { key: "mindshare", label: "Mindshare" },
  { key: "token_count", label: "Tokens" },
  { key: "bonded", label: "Bonded" },
  { key: "followers_count", label: "Followers" },
  { key: "likes_received", label: "Likes" },
  { key: "volume", label: "Volume" },
  { key: "usd_market_cap", label: "Market Cap (USD)" },
  { key: "creator_fees", label: "Creator Fees" },
];

export default function DataPage() {
  const [deployers, setDeployers] = useState<CreatorAggregate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("mindshare");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expandedAddr, setExpandedAddr] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDeployers() {
      try {
        const res = await fetch("https://songjamspace-leaderboard.logesh-063.workers.dev/pumpfun_2k");
        const coins: any[] = await res.json();

        if (!Array.isArray(coins)) throw new Error("API returned unexpected format");

        const creatorMap = new Map<string, CreatorAggregate>();

        coins.forEach((coin) => {
          const c = coin.creator;
          if (!c || c === "11111111111111111111111111111111") return;

          if (!creatorMap.has(c)) {
            creatorMap.set(c, {
              creator: c,
              creator_display_name: `${c.slice(0, 4)}...${c.slice(-4)}`,
              token_count: 0,
              bonded: 0,
              volume: 0,
              usd_market_cap: 0,
              total_ath_market_cap: 0,
              creator_fees: 0,
              mindshare: 0,
              top_tokens: [],
              bonded_tokens: [],
            });
          }

          const d = creatorMap.get(c)!;
          d.token_count += 1;
          if (coin.complete === true) d.bonded += 1;
          d.usd_market_cap += coin.usd_market_cap || 0;
          d.total_ath_market_cap += coin.ath_market_cap || 0;

          const tokenEntry = {
            name: coin.name || "Unknown",
            symbol: coin.symbol || "UNK",
            usd_market_cap: coin.usd_market_cap || 0,
            volume: 0,
          };
          d.top_tokens.push(tokenEntry);
          if (coin.complete === true) d.bonded_tokens.push(tokenEntry);
        });

        const aggregated = Array.from(creatorMap.values()).map((d) => {
          d.mindshare = d.usd_market_cap / 1000;
          d.top_tokens = d.top_tokens
            .sort((a, b) => b.usd_market_cap - a.usd_market_cap)
            .slice(0, 10);
          return d;
        });

        const sorted = aggregated.sort((a, b) => b.usd_market_cap - a.usd_market_cap);
        setDeployers(sorted);

        // Enrich top 50 with pump.fun user profiles (non-blocking)
        try {
          const top50 = sorted.slice(0, 50);
          const profileRes = await fetch("/api/pumpfun/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ addresses: top50.map((d) => d.creator) }),
          });
          if (profileRes.ok) {
            const { profiles } = await profileRes.json();
            if (profiles) {
              setDeployers((prev) =>
                prev.map((d) => {
                  const p = profiles[d.creator];
                  if (!p) return d;
                  return {
                    ...d,
                    creator_display_name: p.username || d.creator_display_name,
                    avatar_url: p.profile_image || d.avatar_url,
                    username: p.username || undefined,
                    followers_count: p.followers ?? undefined,
                    following_count: p.following ?? undefined,
                    likes_received: p.likes_received ?? undefined,
                    x_username: p.x_username || undefined,
                    bio: p.bio || undefined,
                  };
                })
              );
            }
          }
        } catch (profileErr) {
          console.warn("Failed to fetch creator profiles:", profileErr);
        }
      } catch (err: any) {
        console.error("Failed to fetch deployers:", err);
        setError(err.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    }
    fetchDeployers();
  }, []);

  const sorted = useMemo(() => {
    const copy = [...deployers];
    copy.sort((a, b) => {
      const av = a[sortKey as keyof CreatorAggregate] ?? 0;
      const bv = b[sortKey as keyof CreatorAggregate] ?? 0;
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "desc" ? bv - av : av - bv;
      }
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "desc" ? bv.localeCompare(av) : av.localeCompare(bv);
      }
      return 0;
    });
    return copy;
  }, [deployers, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const arrow = (key: SortKey) =>
    sortKey === key ? (sortDir === "desc" ? " ▼" : " ▲") : "";

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060608] text-white flex items-center justify-center">
        <p className="text-zinc-400 animate-pulse">Loading deployer data from Pump.fun...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#060608] text-white flex items-center justify-center">
        <p className="text-red-400">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060608] text-white p-6">
      <div className="max-w-[1800px] mx-auto">
        <h1 className="text-2xl font-bold mb-1">Creator Data Explorer</h1>
        <p className="text-zinc-400 text-sm mb-6">
          {sorted.length} deployers &middot; sorted by{" "}
          <span className="text-white font-medium">
            {NUMERIC_COLS.find((c) => c.key === sortKey)?.label ?? sortKey}
          </span>{" "}
          ({sortDir}) &middot; click a row to expand
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-zinc-400">
                <th className="py-2 px-3 font-medium">#</th>
                <th className="py-2 px-3 font-medium w-10"></th>
                <th
                  className="py-2 px-3 font-medium cursor-pointer hover:text-white select-none"
                  onClick={() => toggleSort("creator_display_name")}
                >
                  Creator{arrow("creator_display_name")}
                </th>
                <th className="py-2 px-3 font-medium">X</th>
                <th className="py-2 px-3 font-medium">Address</th>
                {NUMERIC_COLS.map((c) => (
                  <th
                    key={c.key}
                    className="py-2 px-3 font-medium text-right cursor-pointer hover:text-white select-none whitespace-nowrap"
                    onClick={() => toggleSort(c.key)}
                  >
                    {c.label}
                    {arrow(c.key)}
                  </th>
                ))}
                <th className="py-2 px-3 font-medium text-center">Details</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((d, i) => {
                const isExpanded = expandedAddr === d.creator;
                return (
                  <Frag key={d.creator}>
                    <tr
                      className="border-b border-zinc-800/50 hover:bg-zinc-900/50 cursor-pointer"
                      onClick={() => setExpandedAddr(isExpanded ? null : d.creator)}
                    >
                      <td className="py-2 px-3 text-zinc-500">{i + 1}</td>
                      <td className="py-2 px-3">
                        {d.avatar_url ? (
                          <img
                            src={d.avatar_url}
                            alt=""
                            className="w-7 h-7 rounded-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).src = "https://pump.mypinata.cloud/ipfs/QmeSzchzEPqCU1jwTnsipwcBAeH7S4bmVvFGfF65iA1BY1"; }}
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-zinc-700" />
                        )}
                      </td>
                      <td className="py-2 px-3 font-medium">{d.creator_display_name}</td>
                      <td className="py-2 px-3 text-xs text-zinc-400">
                        {d.x_username ? (
                          <a
                            href={`https://x.com/${d.x_username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-blue-400"
                            onClick={(e) => e.stopPropagation()}
                          >
                            @{d.x_username}
                          </a>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-mono text-xs text-zinc-400">
                        <a
                          href={`https://pump.fun/profile/${d.creator}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-blue-400"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {d.creator.slice(0, 6)}...{d.creator.slice(-4)}
                        </a>
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {d.mindshare.toFixed(1)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">{d.token_count}</td>
                      <td className="py-2 px-3 text-right font-mono">{d.bonded}</td>
                      <td className="py-2 px-3 text-right font-mono">{d.followers_count != null ? fmt(d.followers_count) : "—"}</td>
                      <td className="py-2 px-3 text-right font-mono">{d.likes_received != null ? fmt(d.likes_received) : "—"}</td>
                      <td className="py-2 px-3 text-right font-mono">{fmt(d.volume)}</td>
                      <td className="py-2 px-3 text-right font-mono">{fmtUsd(d.usd_market_cap)}</td>
                      <td className="py-2 px-3 text-right font-mono">{fmt(d.creator_fees)}</td>
                      <td className="py-2 px-3 text-center text-zinc-400 text-xs">
                        {isExpanded ? "▾ hide" : `▸ ${d.top_tokens.length} tokens`}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-zinc-900/30">
                        <td colSpan={100} className="p-4">
                          <ExpandedDetail deployer={d} />
                        </td>
                      </tr>
                    )}
                  </Frag>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Frag({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function ExpandedDetail({ deployer }: { deployer: CreatorAggregate }) {
  const [analytics, setAnalytics] = useState<DeployerAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/deployer/${deployer.creator}`);
        const json = await res.json();
        if (mounted && json.success) setAnalytics(json.data);
        else if (mounted) setError(true);
      } catch {
        if (mounted) setError(true);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [deployer.creator]);

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs">
        <Stat label="Mindshare" value={deployer.mindshare.toFixed(1)} />
        <Stat label="Tokens Deployed" value={String(deployer.token_count)} />
        <Stat label="Bonded" value={String(deployer.bonded)} />
        <Stat label="Volume" value={fmt(deployer.volume)} />
        <Stat label="Market Cap (USD)" value={fmtUsd(deployer.usd_market_cap)} />
        <Stat label="Creator Fees" value={fmt(deployer.creator_fees)} />
      </div>

      {/* Full address + links */}
      <div className="text-xs text-zinc-400 flex flex-wrap gap-3 items-center">
        <span className="font-mono break-all">{deployer.creator}</span>
        <a
          href={`https://pump.fun/profile/${deployer.creator}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:underline"
        >
          pump.fun
        </a>
        <a
          href={`https://solscan.io/account/${deployer.creator}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:underline"
        >
          solscan
        </a>
      </div>

      {/* Live analytics from /api/deployer */}
      {loading ? (
        <p className="text-xs text-zinc-500 animate-pulse">Loading live profile analytics...</p>
      ) : error ? (
        <p className="text-xs text-red-400">Failed to load profile analytics</p>
      ) : analytics ? (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-zinc-300">Live Profile Analytics</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <Stat
              label="Estimated Net Worth"
              value={fmtUsd(analytics.balanceSummary?.total_value ?? 0)}
            />
            <Stat
              label="SOL Balance"
              value={`${(analytics.balanceSummary?.native_balance ?? 0).toFixed(3)} SOL`}
            />
            <Stat label="Followers" value={String(analytics.followers?.length ?? 0)} />
            <Stat label="Following" value={String(analytics.following?.length ?? 0)} />
            {analytics.balanceSummary?.portfolioPnL != null && (
              <Stat
                label="Portfolio PnL"
                value={fmtUsd(analytics.balanceSummary.portfolioPnL)}
              />
            )}
            <Stat
              label="Token Holdings"
              value={String(analytics.balanceSummary?.token_count ?? 0)}
            />
            {analytics.fees?.totalFeesSOL && (
              <Stat
                label="Total Creator Fees"
                value={`${analytics.fees.totalFeesSOL} SOL`}
              />
            )}
            {analytics.fees?.totalFees && (
              <Stat
                label="Total Fees (USD)"
                value={fmtUsd(parseFloat(analytics.fees.totalFees))}
              />
            )}
          </div>

          {/* Token balances */}
          {analytics.balances.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-zinc-300 mb-2">
                Token Balances ({analytics.balances.length})
              </h4>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-left text-zinc-500 border-b border-zinc-800">
                    <th className="py-1 px-2">Token</th>
                    <th className="py-1 px-2">Mint</th>
                    <th className="py-1 px-2 text-right">Amount</th>
                    <th className="py-1 px-2 text-right">USD Value</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.balances.map((b, i) => (
                    <tr key={b.mint ?? `bal-${i}`} className="border-b border-zinc-800/30">
                      <td className="py-1 px-2">{b.name || b.symbol || "—"}</td>
                      <td className="py-1 px-2 font-mono text-zinc-500">
                        {b.mint ? `${b.mint.slice(0, 6)}...${b.mint.slice(-4)}` : "—"}
                      </td>
                      <td className="py-1 px-2 text-right font-mono">{fmt(b.amount)}</td>
                      <td className="py-1 px-2 text-right font-mono">{fmtUsd(b.usd_value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Created coins */}
          {analytics.createdCoins.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-zinc-300 mb-2">
                Created Coins ({analytics.createdCoins.length})
              </h4>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-left text-zinc-500 border-b border-zinc-800">
                    <th className="py-1 px-2">Name</th>
                    <th className="py-1 px-2">Symbol</th>
                    <th className="py-1 px-2">Mint</th>
                    <th className="py-1 px-2 text-right">Market Cap (USD)</th>
                    <th className="py-1 px-2 text-right">ATH Market Cap</th>
                    <th className="py-1 px-2 text-right">Replies</th>
                    <th className="py-1 px-2 text-center">Complete</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.createdCoins
                    .sort((a, b) => (b.usd_market_cap ?? 0) - (a.usd_market_cap ?? 0))
                    .map((c, i) => (
                      <tr key={c.mint ?? `coin-${i}`} className="border-b border-zinc-800/30 hover:bg-zinc-800/20">
                        <td className="py-1 px-2">{c.name ?? "—"}</td>
                        <td className="py-1 px-2 font-mono text-zinc-400">{c.symbol ?? "—"}</td>
                        <td className="py-1 px-2 font-mono text-zinc-500">
                          {c.mint ? (
                            <a
                              href={`https://pump.fun/coin/${c.mint}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-blue-400"
                            >
                              {c.mint.slice(0, 6)}...{c.mint.slice(-4)}
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-1 px-2 text-right font-mono">{fmtUsd(c.usd_market_cap)}</td>
                        <td className="py-1 px-2 text-right font-mono">{fmtUsd(c.ath_market_cap)}</td>
                        <td className="py-1 px-2 text-right font-mono">{c.reply_count}</td>
                        <td className="py-1 px-2 text-center">
                          {c.complete ? (
                            <span className="text-emerald-400">✓</span>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Followers list */}
          {analytics.followers.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-zinc-300 mb-2">
                Followers ({analytics.followers.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {analytics.followers.map((f) => (
                  <a
                    key={f.address}
                    href={`https://pump.fun/profile/${f.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono bg-zinc-800/50 px-2 py-1 rounded hover:bg-zinc-700/50 text-zinc-400 hover:text-white"
                  >
                    {f.username || `${f.address.slice(0, 4)}...${f.address.slice(-4)}`}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Top tokens from aggregate */}
      <div>
        <h4 className="text-xs font-semibold text-zinc-300 mb-2">
          Top Tokens — Aggregated ({deployer.top_tokens.length})
        </h4>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-left text-zinc-500 border-b border-zinc-800">
              <th className="py-1 px-2">#</th>
              <th className="py-1 px-2">Name</th>
              <th className="py-1 px-2">Symbol</th>
              <th className="py-1 px-2 text-right">Market Cap (USD)</th>
              <th className="py-1 px-2 text-right">Volume</th>
            </tr>
          </thead>
          <tbody>
            {deployer.top_tokens.map((t, i) => (
              <tr key={`${t.symbol}-${i}`} className="border-b border-zinc-800/30">
                <td className="py-1 px-2 text-zinc-500">{i + 1}</td>
                <td className="py-1 px-2">{t.name}</td>
                <td className="py-1 px-2 font-mono text-zinc-400">{t.symbol}</td>
                <td className="py-1 px-2 text-right font-mono">{fmtUsd(t.usd_market_cap)}</td>
                <td className="py-1 px-2 text-right font-mono">{fmt(t.volume)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-800/40 rounded px-3 py-2">
      <div className="text-zinc-500">{label}</div>
      <div className="font-mono text-white">{value}</div>
    </div>
  );
}
