"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink } from "lucide-react";
import { Loader2 } from "lucide-react";
import type { MetricKey, METRIC_LABELS as ML } from "@/lib/dummyData";
import { type CreatorAggregate, type DeployerAnalytics } from "@/types/pumpfun";

interface Props {
  deployer: CreatorAggregate | null;
  metricLabels: typeof ML;
  onClose: () => void;
}

function fmt(v: number, unit: string): string {
  if (unit === "SOL") {
    return v >= 1000 ? `${(v / 1000).toFixed(1)}K SOL` : `${v.toLocaleString()} SOL`;
  }
  return v.toFixed(1);
}

export default function DeployerDetail({ deployer, metricLabels, onClose }: Props) {
  const [analytics, setAnalytics] = React.useState<DeployerAnalytics | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!deployer) {
      setAnalytics(null);
      return;
    }
    
    let isMounted = true;
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/deployer/${deployer.creator}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        if (isMounted && json.success) {
          setAnalytics(json.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    
    fetchAnalytics();
    return () => { isMounted = false; };
  }, [deployer]);

  return (
    <AnimatePresence>
      {deployer && (
        <>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
          />
          <motion.aside
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="fixed right-0 top-0 bottom-0 z-[70] w-full max-w-md bg-[#0a0a0c] border-l border-white/5 overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">Deployer Details</h2>
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                  <X className="w-4 h-4 text-zinc-400" />
                </button>
              </div>

              <div className="mb-6">
                <p className="text-sm font-semibold text-white mb-1">{deployer.creator_display_name}</p>
                <div className="flex items-center gap-2">
                  <code className="text-[11px] text-zinc-500 font-mono break-all">{deployer.creator}</code>
                  <a
                    href={`https://solscan.io/account/${deployer.creator}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-zinc-500 hover:text-red-400 transition-colors"
                    aria-label="View on Solscan"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {([
                  ["totalVolume", "SOL"],
                  ["totalMarketCap", "SOL"],
                  ["totalCreatorFees", "SOL"],
                  ["mindshare", ""],
                ] as [MetricKey, string][]).map(([key, unit]) => {
                  let value = 0;
                  if (key === "totalVolume") value = deployer.volume;
                  if (key === "totalMarketCap") value = deployer.usd_market_cap;
                  if (key === "totalCreatorFees") value = deployer.creator_fees;
                  if (key === "mindshare") value = deployer.mindshare;

                  return (
                    <div key={key} className="rounded-xl bg-white/[0.03] border border-white/5 px-4 py-3">
                      <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">{metricLabels[key]}</p>
                      <p className="text-sm font-bold text-white">{fmt(value, unit)}</p>
                    </div>
                  );
                })}
                <div className="rounded-xl bg-white/[0.03] border border-white/5 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Tokens Deployed</p>
                  <p className="text-sm font-bold text-white">{deployer.token_count}</p>
                </div>
              </div>

              {/* Analytics Section */}
              <div className="mb-6">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Live Profile Analytics</h3>
                {loading ? (
                  <div className="flex items-center justify-center p-6 bg-white/[0.02] border border-white/5 rounded-xl">
                    <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
                  </div>
                ) : analytics ? (
                  <div className="space-y-3">
                    {/* Net Worth */}
                    <div className="flex flex-col sm:flex-row gap-3 rounded-xl bg-gradient-to-br from-white/[0.04] to-transparent border border-white/5 px-4 py-3">
                      <div className="flex-1">
                        <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Estimated Net Worth</p>
                        <p className="text-lg font-bold text-emerald-400">${analytics.balanceSummary?.total_value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}</p>
                      </div>
                      <div className="flex-1 sm:text-right">
                        <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">SOL Balance</p>
                        <p className="text-lg font-bold text-white">{analytics.balanceSummary?.native_balance?.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 }) || "0.000"} <span className="text-xs text-zinc-500 font-normal">SOL</span></p>
                      </div>
                    </div>

                    {/* Followers & Following */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-xl bg-white/[0.02] border border-white/5 px-4 py-3">
                        <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Followers</p>
                        <p className="text-sm font-bold text-white">{analytics.followers?.length || 0}</p>
                      </div>
                      <div className="rounded-xl bg-white/[0.02] border border-white/5 px-4 py-3">
                        <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Following</p>
                        <p className="text-sm font-bold text-white">{analytics.following?.length || 0}</p>
                      </div>
                      <div className="rounded-xl bg-white/[0.02] border border-white/5 px-4 py-3">
                        <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Total Fees</p>
                        <p className="text-sm font-bold text-white">
                          {analytics.fees?.totalFeesSOL ? `${parseFloat(analytics.fees.totalFeesSOL).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} SOL` : "0 SOL"}
                        </p>
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="text-center p-4 bg-white/[0.02] border border-white/5 rounded-xl text-xs text-zinc-500">
                    Failed to load analytics
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Top Tokens</h3>
                <div className="space-y-2">
                  {deployer.top_tokens.map((t) => (
                    <div key={t.symbol} className="flex items-center justify-between rounded-xl bg-white/[0.02] border border-white/5 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{t.name}</p>
                        <p className="text-[11px] text-zinc-500">${t.symbol}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-white">{fmt(t.usd_market_cap, "SOL")}</p>
                        <p className="text-[10px] text-zinc-500">Vol: {fmt(t.volume, "SOL")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
