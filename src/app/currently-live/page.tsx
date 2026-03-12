"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Search, RefreshCw, AlertCircle } from "lucide-react";
import { type PumpFunCoin } from "@/types/pumpfun";
import LiveTokenGrid from "@/components/LiveTokenGrid";
import {
  PumpfunLivestreamSimulator,
  type SimulatorState
} from "@/lib/pumpfunSimulator";

export default function LiveTokensPage() {
  const [coins, setCoins] = useState<PumpFunCoin[]>([]);
  const [viewerCounts, setViewerCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [simState, setSimState] = useState<SimulatorState>(() => ({
    initialCapital: 5,
    capital: 5,
    riskPct: 0.02,
    positions: {},
    trades: [],
    logs: [],
    lastByMint: {},
    summary: {
      totalTrades: 0,
      winRate: 0,
      totalPnLSol: 0,
      avgHoldMs: 0
    }
  }));

  const isFetchingViewers = useRef(false);
  const simulatorRef = useRef<PumpfunLivestreamSimulator | null>(null);

  if (!simulatorRef.current) {
    simulatorRef.current = new PumpfunLivestreamSimulator(5, 0.02);
  }

  const fetchViewerCountsSequentially = async (coinsList: PumpFunCoin[]) => {
    if (isFetchingViewers.current) return;
    isFetchingViewers.current = true;

    try {
      for (const coin of coinsList) {
        let success = false;
        while (!success) {
          try {
            const res = await fetch(`/api/viewers/${coin.mint}`);
            if (res.ok) {
              const data = await res.json();
              setViewerCounts(prev => ({
                ...prev,
                [coin.mint]: data.count ?? data
              }));
              success = true;
            } else {
              // If we get an error (like 429), wait longer before retrying
              console.warn(`Fetch failed for ${coin.mint}, retrying in 2s...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          } catch (err) {
            console.error(`Error fetching viewers for ${coin.mint}:`, err);
            // Wait before retry on network error too
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
        // Small delay between successful requests to be safe
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } finally {
      isFetchingViewers.current = false;
    }
  };

  const fetchLiveTokens = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/pumpfun/live-streams");
      if (!res.ok) throw new Error("Failed to fetch live tokens");
      const data = await res.json();
      
      setCoins(data);
      setLastUpdated(new Date());
      
      // Trigger sequential viewer count fetching
      fetchViewerCountsSequentially(data);
    } catch (err) {
      console.error("Error fetching live tokens:", err);
      setError("Failed to load live streams. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveTokens();
    const interval = setInterval(fetchLiveTokens, 60000); // Auto-refresh every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (coins.length === 0) return;
    const simulator = simulatorRef.current;
    if (!simulator) return;

    let processed = false;
    for (const coin of coins) {
      const viewer_count = viewerCounts[coin.mint];
      if (typeof viewer_count !== "number") continue;
      const market_cap = coin.usd_market_cap;
      if (!Number.isFinite(market_cap) || market_cap <= 0) continue;

      const createdMs =
        coin.created_timestamp > 1e12 ? coin.created_timestamp : coin.created_timestamp * 1000;
      const token_age = Math.max(0, (Date.now() - createdMs) / 1000);
      const buy_tx_last_30s = Number((coin as { buy_tx_last_30s?: number }).buy_tx_last_30s ?? 0);
      const sell_tx_last_30s = Number((coin as { sell_tx_last_30s?: number }).sell_tx_last_30s ?? 0);

      simulator.update({
        mint: coin.mint,
        name: coin.name,
        symbol: coin.symbol,
        viewer_count,
        market_cap,
        timestamp: Date.now(),
        token_age,
        buy_tx_last_30s,
        sell_tx_last_30s
      });
      processed = true;
    }

    if (processed) {
      setSimState(simulator.getState());
    }
  }, [coins, viewerCounts]);

  const fmtSol = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(3)} SOL`;
  const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(2)}%`;
  const fmtDuration = (ms: number) => {
    if (ms <= 0) return "0m";
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };
  const fmtCompact = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return v.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-[#060608] pt-6 pb-20">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-500 text-xs font-bold uppercase tracking-widest">Live Streams</span>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
              Currently Live <sup className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{coins.length} Online</sup>
            </h1>
            <p className="text-zinc-500 mt-1 max-w-xl">
              Recently traded tokens with active live streams. Track viewer counts and engagement before they bond.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-2 bg-white/[0.03] border border-white/10 rounded-xl flex items-center gap-3">
              <span className="text-[10px] text-zinc-500 font-mono uppercase">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
              <button
                onClick={fetchLiveTokens}
                disabled={loading}
                className={`p-1.5 rounded-lg hover:bg-white/5 text-zinc-400 transition-all ${loading ? 'animate-spin' : ''}`}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <AnimatePresence mode="wait">
          {loading && coins.length === 0 ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-40 gap-4"
            >
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-2 border-white/5 border-t-blue-500 animate-spin" />
                <Activity className="w-6 h-6 text-blue-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Scanning Pump.fun for live streams...</p>
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-40 gap-4 text-center"
            >
              <div className="p-4 rounded-full bg-red-500/10 border border-red-500/20 text-red-500">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">Connection Error</h3>
                <p className="text-zinc-500 text-sm">{error}</p>
              </div>
              <button
                onClick={fetchLiveTokens}
                className="px-6 py-2 rounded-xl bg-white text-black font-bold hover:bg-zinc-200 transition-all"
              >
                Try Again
              </button>
            </motion.div>
          ) : coins.length > 0 ? (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <LiveTokenGrid coins={coins} viewerCounts={viewerCounts} />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-40 gap-4 text-center"
            >
              <div className="p-4 rounded-full bg-white/5 border border-white/10 text-zinc-500">
                <Search className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">No Live Streams Found</h3>
                <p className="text-zinc-500 text-sm">There are no tokens currently live on pump.fun that haven't bonded yet.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Simulation Section */}
        {coins.length > 0 && (
          <div className="mt-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-black text-white tracking-tight">Paper Trading Simulator</h2>
                <p className="text-zinc-500 text-sm">
                  Starting capital: {simState.initialCapital.toFixed(2)} SOL • Position size: {(simState.riskPct * 100).toFixed(1)}% of capital
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 bg-white/[0.03] border border-white/10 rounded-xl">
                  <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Current Capital</div>
                  <div className="text-white font-mono font-bold text-lg">
                    {simState.capital.toFixed(3)} SOL
                  </div>
                </div>
                <div className="px-4 py-2 bg-white/[0.03] border border-white/10 rounded-xl">
                  <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Total PnL</div>
                  <div className={`font-mono font-bold text-lg ${simState.summary.totalPnLSol >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {fmtSol(simState.summary.totalPnLSol)}
                  </div>
                </div>
                <div className="px-4 py-2 bg-white/[0.03] border border-white/10 rounded-xl">
                  <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Win Rate</div>
                  <div className="text-white font-mono font-bold text-lg">
                    {simState.summary.winRate.toFixed(1)}%
                  </div>
                </div>
                <div className="px-4 py-2 bg-white/[0.03] border border-white/10 rounded-xl">
                  <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Avg Hold</div>
                  <div className="text-white font-mono font-bold text-lg">
                    {fmtDuration(simState.summary.avgHoldMs)}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white/[0.03] border border-white/10 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-bold">Trades</h3>
                  <span className="text-xs text-zinc-500 font-mono uppercase">
                    {simState.summary.totalTrades} total
                  </span>
                </div>
                <div className="space-y-2">
                  {simState.trades.length === 0 ? (
                    <div className="text-zinc-500 text-sm py-6 text-center">No trades yet.</div>
                  ) : (
                    simState.trades.map((trade) => (
                      <div
                        key={`${trade.mint}-${trade.exitTimestamp}`}
                        className="flex flex-col md:flex-row md:items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/5"
                      >
                        <div className="min-w-0">
                          <div className="text-white font-bold truncate">
                            {trade.name} <span className="text-zinc-500 font-mono text-xs">${trade.symbol}</span>
                          </div>
                          <div className="text-[11px] text-zinc-500 font-mono">
                            Buy {new Date(trade.entryTimestamp).toLocaleTimeString()} • Sell {new Date(trade.exitTimestamp).toLocaleTimeString()} • {trade.exitReason.replace("_", " ")}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-xs text-zinc-500 uppercase">PnL</div>
                            <div className={`font-mono font-bold ${trade.pnlSol >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {fmtSol(trade.pnlSol)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-zinc-500 uppercase">PnL %</div>
                            <div className={`font-mono font-bold ${trade.pnlRatio >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {fmtPct(trade.pnlRatio)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-zinc-500 uppercase">Mcap</div>
                            <div className="font-mono font-bold text-white">
                              {fmtCompact(trade.entryMarketCap)} → {fmtCompact(trade.exitMarketCap)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-bold">Open Positions</h3>
                  <span className="text-xs text-zinc-500 font-mono uppercase">
                    {Object.keys(simState.positions).length} open
                  </span>
                </div>
                <div className="space-y-2">
                  {Object.keys(simState.positions).length === 0 ? (
                    <div className="text-zinc-500 text-sm py-6 text-center">No open positions.</div>
                  ) : (
                    Object.values(simState.positions).map((pos) => {
                      const last = simState.lastByMint[pos.mint];
                      const unrealized = last ? (last.market_cap - pos.entryMarketCap) / pos.entryMarketCap : 0;
                      return (
                        <div key={pos.mint} className="px-3 py-2 rounded-xl bg-white/[0.02] border border-white/5">
                          <div className="flex items-center justify-between">
                            <div className="min-w-0">
                              <div className="text-white font-bold truncate">
                                {pos.name} <span className="text-zinc-500 font-mono text-xs">${pos.symbol}</span>
                              </div>
                              <div className="text-[11px] text-zinc-500 font-mono">
                                Bought {new Date(pos.entryTimestamp).toLocaleTimeString()}
                              </div>
                            </div>
                            <div className={`font-mono font-bold ${unrealized >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {fmtPct(unrealized)}
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-zinc-500 font-mono">
                            Mcap {fmtCompact(pos.entryMarketCap)} → {last ? fmtCompact(last.market_cap) : "—"} • Viewers {pos.entryViewers} → {last ? last.viewer_count : "—"}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Condition Logs Section */}
        <div className="mt-10 bg-white/[0.03] border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-500" />
                Buy Condition Logs
              </h2>
              <p className="text-zinc-500 text-sm">Real-time breakdown of entry criteria for each live token check</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase">Pass</span>
              <span className="px-2 py-1 rounded-md bg-red-500/10 text-red-500 text-[10px] font-bold uppercase">Fail</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {simState.logs.length === 0 ? (
              <div className="col-span-full py-12 text-center text-zinc-500 border border-dashed border-white/5 rounded-xl uppercase tracking-widest text-xs font-bold">
                Waiting for token updates to log conditions...
              </div>
            ) : (
              [...simState.logs]
                .sort((a, b) => {
                  const aScore = a.results.filter((r) => r.status === "pass").length;
                  const bScore = b.results.filter((r) => r.status === "pass").length;
                  return bScore - aScore;
                })
                .slice(0, 24)
                .map((log, i) => (
                  <div key={`${log.mint}-${log.timestamp}-${i}`} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col h-full hover:border-white/10 transition-colors group">
                  <div className="flex items-center justify-between mb-3">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white truncate group-hover:text-blue-400 transition-colors uppercase tracking-tight">{log.name}</div>
                      <div className="text-[10px] text-zinc-500 font-mono tracking-wider">${log.symbol}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${log.passed ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/20' : 'bg-white/5 text-zinc-400'}`}>
                        {log.results.filter(r => r.status === 'pass').length}/{log.results.length} MET
                      </div>
                      {log.passed && (
                        <div className="text-[9px] font-black text-emerald-500 uppercase tracking-tighter animate-pulse">
                          EXECUTED
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-1.5 flex-grow">
                    {log.results.map((res, j) => (
                      <div key={j} className={`flex items-center justify-between text-[11px] p-1 rounded ${res.status === 'pass' ? 'bg-emerald-500/5' : 'bg-transparent'}`}>
                        <span className={`transition-colors ${res.status === 'pass' ? 'text-zinc-300' : 'text-zinc-600'}`}>{res.condition}</span>
                        <div className="flex items-center gap-2">
                          <span className={`font-mono text-[10px] ${res.status === 'pass' ? 'text-emerald-400 font-bold' : 'text-zinc-700'}`}>
                            {typeof res.value === 'number' && res.value > 1000 ? (res.value / 1000).toFixed(1) + 'k' : res.value}
                            <span className="text-[9px] opacity-40 ml-1 italic">/{typeof res.threshold === 'number' && res.threshold > 1000 ? (res.threshold / 1000).toFixed(1) + 'k' : res.threshold}</span>
                          </span>
                          <div className={`w-1 h-1 rounded-full ${res.status === 'pass' ? 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]' : 'bg-zinc-800'}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-white/5 text-[9px] text-zinc-600 font-mono text-right">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
