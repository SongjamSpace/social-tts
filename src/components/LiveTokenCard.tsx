"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, ExternalLink, Activity } from "lucide-react";
import { type PumpFunCoin } from "@/types/pumpfun";

interface LiveTokenCardProps {
  coin: PumpFunCoin;
  viewers?: number;
}

export default function LiveTokenCard({ coin, viewers }: LiveTokenCardProps) {
  const loadingViewers = viewers === undefined;

  const fmtCompact = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return v.toLocaleString();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className="group relative bg-white/[0.03] border border-white/10 rounded-2xl p-4 overflow-hidden transition-all hover:bg-white/[0.06] hover:border-white/20"
    >
      {/* Dynamic Background Blur Effect */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-[80px] group-hover:bg-blue-500/20 transition-all" />
      
      <div className="relative z-10">
        <div className="flex items-start gap-4 mb-4">
          <div className="relative shrink-0">
            <img 
              src={coin.image_uri} 
              alt={coin.name} 
              className="w-16 h-16 rounded-xl object-cover border border-white/10 shadow-lg"
            />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-red-500 border-2 border-[#060608] flex items-center justify-center animate-pulse">
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold text-lg truncate group-hover:text-blue-400 transition-colors">
              {coin.name}
            </h3>
            <div className="flex items-center gap-2 text-zinc-500 font-mono text-sm">
              <span>${coin.symbol}</span>
              <span className="text-zinc-700">•</span>
              <span className="text-emerald-500 font-bold">${fmtCompact(coin.usd_market_cap)}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white/5 border border-white/5 rounded-xl p-2.5">
            <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-1 flex items-center gap-1.5">
              <Users className="w-3 h-3" /> Viewers
            </p>
            <p className="text-white font-mono font-bold">
              {loadingViewers ? (
                <span className="inline-block w-8 h-4 bg-white/10 animate-pulse rounded" />
              ) : viewers !== null ? (
                fmtCompact(viewers)
              ) : (
                "0"
              )}
            </p>
          </div>
          <div className="bg-white/5 border border-white/5 rounded-xl p-2.5">
            <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-1 flex items-center gap-1.5">
              <Activity className="w-3 h-3" /> Replies
            </p>
            <p className="text-white font-mono font-bold">{fmtCompact(coin.reply_count)}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 mt-2">
          <div className="text-[10px] text-zinc-500">
            Minted {Math.floor((Date.now() - (coin.created_timestamp > 1e12 ? coin.created_timestamp : coin.created_timestamp * 1000)) / (1000 * 60))}m ago
          </div>
          <a
            href={`https://pump.fun/coin/${coin.mint}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-bold hover:bg-blue-500 hover:text-white transition-all group/btn"
          >
            <span>Invest</span>
            <ExternalLink className="w-3 h-3 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
          </a>
        </div>
      </div>
    </motion.div>
  );
}
