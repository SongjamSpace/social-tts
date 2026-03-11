"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Search, RefreshCw, AlertCircle } from "lucide-react";
import { type PumpFunCoin } from "@/types/pumpfun";
import LiveTokenGrid from "@/components/LiveTokenGrid";

export default function LiveTokensPage() {
  const [coins, setCoins] = useState<PumpFunCoin[]>([]);
  const [viewerCounts, setViewerCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const isFetchingViewers = useRef(false);

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
              Real-time token launches with active live streams. Track viewer counts and engagement before they bond.
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
      </div>
    </div>
  );
}
