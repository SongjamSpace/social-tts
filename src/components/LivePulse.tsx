"use client";

import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, TrendingUp, Users, Map as MapIcon, ShieldCheck, ShieldAlert, UserCheck, ExternalLink } from "lucide-react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { type PumpFunCoin, type CreatorAggregate, type VolumeByWindow } from "@/types/pumpfun";

interface LivePulseProps {
  coins: PumpFunCoin[];
  velocity: number; // launches per minute
  successRate: number; // % of bonded in last window
  onCoinClick?: (coin: PumpFunCoin) => void;
  knownCreators: Record<string, CreatorAggregate>;
  marketActivity?: Record<string, VolumeByWindow>;
}

const fmtCompact = (v: number) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString();
};

const VelocityGauge = ({ value }: { value: number }) => {
  const option: EChartsOption = {
    series: [
      {
        type: 'gauge',
        startAngle: 180,
        endAngle: 0,
        min: 0,
        max: 100,
        splitNumber: 5,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: '#22c55e' },
              { offset: 0.5, color: '#eab308' },
              { offset: 1, color: '#ef4444' }
            ]
          }
        },
        progress: { show: true, width: 8 },
        pointer: { show: false },
        axisLine: { lineStyle: { width: 8, color: [[1, 'rgba(255,255,255,0.05)']] } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        anchor: { show: false },
        title: { show: false },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, -10],
          fontSize: 24,
          fontWeight: 'bold',
          color: '#fff',
          formatter: '{value}',
          fontFamily: "'JetBrains Mono', monospace"
        },
        data: [{ value }]
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: "120px", width: "100%" }} />;
};

const MomentumGauge = ({ value }: { value: number }) => {
  const option: EChartsOption = {
    series: [
      {
        type: 'gauge',
        startAngle: 180,
        endAngle: 0,
        min: 0,
        max: 200,
        splitNumber: 5,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: '#3b82f6' },
              { offset: 0.5, color: '#a855f7' },
              { offset: 1, color: '#ec4899' }
            ]
          }
        },
        progress: { show: true, width: 8 },
        pointer: { show: false },
        axisLine: { lineStyle: { width: 8, color: [[1, 'rgba(255,255,255,0.05)']] } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        anchor: { show: false },
        title: { show: false },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, -10],
          fontSize: 24,
          fontWeight: 'bold',
          color: '#fff',
          formatter: '{value}%',
          fontFamily: "'JetBrains Mono', monospace"
        },
        data: [{ value: Math.min(value, 200) }]
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: "120px", width: "100%" }} />;
};

const CreatorBadge = ({ creator, knownCreators }: { creator: string; knownCreators: Record<string, CreatorAggregate> }) => {
  const profile = knownCreators[creator];
  if (!profile) return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-white/5">New</span>
    </div>
  );

  const tokenCount = profile.token_count || 0;
  const bondedCount = profile.bonded || 0;
  const successRate = tokenCount > 0 ? Math.round((bondedCount / tokenCount) * 100) : 0;
  
  const isGodTier = profile.total_ath_market_cap > 500_000 || (tokenCount > 5 && (bondedCount / tokenCount) > 0.6);
  const isExperienced = tokenCount > 2;
  const followers = profile.followers_count;

  return (
    <div className="flex items-center gap-2">
      {isGodTier ? (
        <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-bold uppercase tracking-wider">
          <ShieldCheck className="w-2.5 h-2.5" /> God Tier
        </span>
      ) : isExperienced ? (
        <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold uppercase tracking-wider">
          <UserCheck className="w-2.5 h-2.5" /> Exp.
        </span>
      ) : (
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-white/5">Known</span>
      )}
      
      {tokenCount > 0 && (
        <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 border border-white/5 font-mono">
          {successRate}% SR • {tokenCount} Tkn
        </span>
      )}

      {followers !== undefined && followers > 0 && (
        <span className="flex items-center gap-1 text-[9px] text-zinc-500 font-mono">
          <Users className="w-2.5 h-2.5" /> {fmtCompact(followers)}
        </span>
      )}
    </div>
  );
};

type SortKey = "newest" | "vol5m" | "vol1h" | "marketCap";

const CreatorSidebarItem = ({ creator, profile, isSelected, onSelect }: { creator: string; profile: any; isSelected: boolean; onSelect: (c: string) => void }) => {
  const displayName = profile?.username || creator.slice(0, 6);
  const avatar = profile?.profile_image || `https://pump.mypinata.cloud/ipfs/QmeSzchzEPqCU1jwTnsipwcBAeH7S4bmVvFGfF65iA1BY1`;

  return (
    <button
      onClick={() => onSelect(creator)}
      className={`w-full flex items-center gap-2 p-2 rounded-xl transition-all ${
        isSelected ? "bg-white/10 border border-white/10" : "hover:bg-white/5 border border-transparent"
      }`}
    >
      <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-white/10 bg-zinc-900">
        <img src={avatar} alt="" className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className="text-[11px] font-bold text-white truncate">{displayName}</p>
        <p className="text-[9px] text-zinc-500 font-mono truncate">{creator.slice(0, 4)}...{creator.slice(-4)}</p>
      </div>
    </button>
  );
};

const CreatorTokensView = ({ creator, onBack }: { creator: string; onBack: () => void }) => {
  const [tokens, setTokens] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [offset, setOffset] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(true);
  const LIMIT = 50;

  const fetchTokens = React.useCallback(async (newOffset: number) => {
    try {
      if (newOffset === 0) setLoading(true);
      else setLoadingMore(true);

      const res = await fetch(`https://frontend-api-v3.pump.fun/coins-v2/user-created-coins/${creator}?limit=${LIMIT}&offset=${newOffset}&includeNsfw=false`);
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      const newTokens = data.coins || data || [];
      
      setTokens(prev => newOffset === 0 ? newTokens : [...prev, ...newTokens]);
      setHasMore(newTokens.length === LIMIT);
    } catch (err) {
      console.error("Tokens fetch error:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [creator]);

  React.useEffect(() => {
    fetchTokens(0);
  }, [fetchTokens]);

  const loadMore = () => {
    const nextOffset = offset + LIMIT;
    setOffset(nextOffset);
    fetchTokens(nextOffset);
  };

  return (
    <div className="flex flex-col h-full bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-colors">
            <TrendingUp className="w-4 h-4 rotate-180" />
          </button>
          <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Creator Tokens</h3>
        </div>
        <span className="text-[10px] font-mono text-zinc-500">{tokens.length} DEPLOYED</span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
             <div className="w-8 h-8 rounded-full border-2 border-white/5 border-t-blue-500 animate-spin" />
             <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Fetching Deployments...</p>
          </div>
        ) : tokens.length > 0 ? (
          <>
            {tokens.map((token) => (
              <div key={token.mint} className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all group">
                <img src={token.image_uri} className="w-10 h-10 rounded-lg object-cover border border-white/10" alt="" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white truncate">{token.name}</h4>
                      <span className="text-[10px] text-zinc-500 font-mono">${token.symbol}</span>
                    </div>
                    <a 
                      href={`https://pump.fun/coin/${token.mint}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-emerald-500 font-bold">${fmtCompact(token.usd_market_cap)} MC</span>
                    <span className="text-[10px] text-zinc-600 font-mono">•</span>
                    <span className="text-[10px] text-zinc-500">{new Date(token.created_timestamp).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}
            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full py-4 text-center text-[10px] text-zinc-500 hover:text-white uppercase tracking-widest font-bold transition-all border border-dashed border-white/5 rounded-xl hover:bg-white/5"
              >
                {loadingMore ? "Loading More..." : "Load More Deployments"}
              </button>
            )}
          </>
        ) : (
          <div className="py-20 text-center text-zinc-600 text-[10px] uppercase font-bold tracking-widest">
            No tokens found
          </div>
        )}
      </div>
    </div>
  );
};

export default function LivePulse({ coins, velocity, successRate, onCoinClick, knownCreators, marketActivity }: LivePulseProps) {
  const [sortKey, setSortKey] = React.useState<SortKey>("newest");
  const [selectedCreator, setSelectedCreator] = React.useState<string | null>(null);
  const [profilesCache, setProfilesCache] = React.useState<Record<string, any>>({});

  // De-duplicate coins by mint
  const distinctCoins = useMemo(() => {
    const seen = new Set();
    return coins.filter(c => {
      if (seen.has(c.mint)) return false;
      seen.add(c.mint);
      return true;
    });
  }, [coins]);

  const sortedCoins = useMemo(() => {
    const list = [...distinctCoins];
    return list.sort((a, b) => {
      const tsA = a.created_timestamp > 1e12 ? a.created_timestamp : a.created_timestamp * 1000;
      const tsB = b.created_timestamp > 1e12 ? b.created_timestamp : b.created_timestamp * 1000;
      if (sortKey === "newest") return tsB - tsA;
      if (sortKey === "vol5m") return (marketActivity?.[b.mint]?.volume5m || 0) - (marketActivity?.[a.mint]?.volume5m || 0);
      if (sortKey === "vol1h") return (marketActivity?.[b.mint]?.volume1h || 0) - (marketActivity?.[a.mint]?.volume1h || 0);
      if (sortKey === "marketCap") return b.usd_market_cap - a.usd_market_cap;
      return 0;
    });
  }, [distinctCoins, sortKey, marketActivity]);

  // Unique creators from current list
  const uniqueCreators = useMemo(() => {
    return [...new Set(distinctCoins.map(c => c.creator))];
  }, [distinctCoins]);

  // Fetch profiles for all unique creators
  React.useEffect(() => {
    const fetchProfiles = async () => {
      const missing = uniqueCreators.filter(c => !profilesCache[c]);
      if (missing.length === 0) return;

      // Fetch individually for now as there's no bulk endpoint
      // We can batch these or use a smaller set
      const batch = missing.slice(0, 10); // Don't overwhelm
      const results = await Promise.all(
        batch.map(async (creator) => {
          try {
            const res = await fetch(`https://frontend-api-v3.pump.fun/users/${creator}`);
            if (!res.ok) return [creator, null];
            const data = await res.json();
            return [creator, data];
          } catch {
            return [creator, null];
          }
        })
      );

      setProfilesCache(prev => ({
        ...prev,
        ...Object.fromEntries(results)
      }));
    };

    fetchProfiles();
  }, [uniqueCreators, profilesCache]);

  // Alpha Spotlight: Top 3 creators in current feed by success rate
  const alphaSpotlight = useMemo(() => {
    const creatorsInFeed = [...new Set(distinctCoins.map(c => c.creator))];
    const stats = creatorsInFeed.map(addr => {
      const p = knownCreators[addr];
      const profile = profilesCache[addr];
      if (!p || !p.token_count) return null;
      return {
        address: addr,
        displayName: profile?.username || p.creator_display_name || addr.slice(0, 6),
        successRate: Math.round((p.bonded / p.token_count) * 100),
        tokens: p.token_count,
        bonded: p.bonded,
        image: profile?.profile_image || p.profile_image || p.avatar_url
      };
    }).filter(Boolean) as any[];

    return stats
      .sort((a, b) => b.successRate - a.successRate || b.tokens - a.tokens)
      .slice(0, 3);
  }, [distinctCoins, knownCreators, profilesCache]);

  // Repurpose velocity as "Momentum Score"
  const momentumValue = Math.min(100, (velocity * 10)); 

  return (
    <div className="flex gap-4 h-full">
      {/* Left Sidebar: Creators */}
      <div className="w-64 shrink-0 flex flex-col gap-4">
        <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-white/5">
            <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
               <Users className="w-3.5 h-3.5" /> Recent Creators
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {uniqueCreators.map(creator => (
              <CreatorSidebarItem 
                key={creator} 
                creator={creator} 
                profile={profilesCache[creator]}
                isSelected={selectedCreator === creator}
                onSelect={setSelectedCreator}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0">
        <AnimatePresence mode="wait">
          {selectedCreator ? (
            <motion.div
              key="creator-detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-full"
            >
              <CreatorTokensView 
                creator={selectedCreator} 
                onBack={() => setSelectedCreator(null)} 
              />
            </motion.div>
          ) : (
            <motion.div
              key="main-pulse"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full"
            >
              {/* Left Column: Velocity & Stats */}
              <div className="lg:col-span-1 space-y-4">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Zap className="w-12 h-12 text-blue-500" />
                  </div>
                  <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-1 flex items-center gap-2">
                    <Zap className="w-3 h-3 text-blue-500" /> Momentum Heat
                  </h3>
                  <p className="text-xs text-zinc-500 mb-4">Launch intensity vs average</p>
                  
                  <div className="flex flex-col items-center">
                    <MomentumGauge value={momentumValue + 50} />
                    <div className="text-center -mt-4">
                      <span className="text-[10px] text-zinc-500 font-mono">ACTIVITY {momentumValue > 20 ? 'SURGING' : 'STABLE'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <ShieldCheck className="w-12 h-12 text-emerald-500" />
                  </div>
                  <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-1 flex items-center gap-2">
                    <Users className="w-3 h-3 text-emerald-500" /> Alpha Spotlight
                  </h3>
                  <p className="text-xs text-zinc-500 mb-4">Top performers in feed</p>
                  
                  <div className="space-y-3">
                    {alphaSpotlight.length > 0 ? (
                      alphaSpotlight.map((creator, i) => (
                        <div key={creator.address} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5 transition-all hover:bg-white/10 cursor-pointer" onClick={() => setSelectedCreator(creator.address)}>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-zinc-800 border border-white/10 overflow-hidden shrink-0">
                              {creator.image ? <img src={creator.image} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-500">{i+1}</div>}
                            </div>
                            <span className="text-[10px] font-bold text-white truncate max-w-[80px]">{creator.displayName}</span>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] font-bold text-emerald-400">{creator.bonded}/{creator.tokens} Bonded</div>
                            <div className="text-[8px] text-zinc-500 uppercase font-mono">{creator.successRate}% Success</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-zinc-600 text-[10px] uppercase font-bold tracking-widest">
                        Scanning for Alpha...
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Live Feed */}
              <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl flex flex-col overflow-hidden">
                <div className="p-4 border-b border-white/5 flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Live Coins
                    </h3>
                    <span className="text-[10px] font-mono text-zinc-500">{distinctCoins.length} DISTINCT COINS</span>
                  </div>

                  {/* Sorting Controls */}
                  <div className="flex items-center gap-2 p-1 bg-white/[0.03] rounded-lg border border-white/5 self-start">
                    {[
                      { key: "newest", label: "Newest" },
                      { key: "vol5m", label: "5m Vol" },
                      { key: "vol1h", label: "1h Vol" },
                      { key: "marketCap", label: "MC" },
                    ].map((s) => (
                      <button
                        key={s.key}
                        onClick={() => setSortKey(s.key as SortKey)}
                        className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
                          sortKey === s.key 
                          ? "bg-white/10 text-white shadow-sm" 
                          : "text-zinc-500 hover:text-zinc-400"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                  <AnimatePresence mode="popLayout">
                    {sortedCoins.map((coin) => {
                      const vol = marketActivity?.[coin.mint];
                      const hasVol = vol && (vol.volume5m > 0 || vol.volume1h > 0);
                      const progress = Math.min(100, (coin.usd_market_cap / 60000) * 100);
                      
                      return (
                        <motion.div
                          key={coin.mint}
                          layout
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          onClick={() => onCoinClick?.(coin)}
                          className={`group relative flex items-center gap-4 p-3 rounded-xl bg-white/[0.02] border transition-all cursor-pointer overflow-hidden ${
                            (knownCreators[coin.creator]?.bonded / knownCreators[coin.creator]?.token_count) > 0.5 
                            ? "border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.05)]" 
                            : "border-white/5 hover:bg-white/[0.05] hover:border-white/10"
                          }`}
                        >
                          {/* Progress background bar */}
                          <div className="absolute bottom-0 left-0 h-[2px] bg-emerald-500/20 w-full">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${coin.complete ? 100 : progress}%` }}
                              className="h-full bg-emerald-500/50"
                            />
                          </div>

                          <div className="relative shrink-0">
                            <img src={coin.image_uri} className="w-10 h-10 rounded-lg object-cover border border-white/10" alt="" />
                            {coin.complete && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#111113] flex items-center justify-center">
                                <ShieldCheck className="w-2 h-2 text-white" />
                              </div>
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <div className="flex items-center gap-2 truncate">
                                <h4 className="text-sm font-bold text-white truncate">{coin.name}</h4>
                                <span className="text-[10px] text-zinc-500 font-mono">${coin.symbol}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {hasVol && (
                                  <div className="flex gap-1">
                                    {vol.volume5m > 0 && (
                                      <span className="text-[8px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">5m: ${fmtCompact(vol.volume5m)}</span>
                                    )}
                                    {vol.volume1h > 0 && (
                                      <span className="text-[8px] px-1 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold">1h: ${fmtCompact(vol.volume1h)}</span>
                                    )}
                                  </div>
                                )}
                                <a 
                                  href={`https://pump.fun/coin/${coin.mint}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-1 px-2 rounded-lg bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-all flex items-center gap-1.5"
                                >
                                  <span className="text-[9px] font-bold uppercase tracking-wider">Pump.fun</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <CreatorBadge creator={coin.creator} knownCreators={knownCreators} />
                              <span className="text-[10px] text-zinc-600 font-mono">•</span>
                              <span className="text-[10px] text-zinc-500 font-mono">${fmtCompact(coin.usd_market_cap)} MC</span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <p className="text-[10px] text-zinc-500 font-mono mb-1">
                              {Math.floor((Date.now() - (coin.created_timestamp > 1e12 ? coin.created_timestamp : coin.created_timestamp * 1000)) / 1000)}s ago
                            </p>
                            <div className="flex items-center gap-1 justify-end text-zinc-400 group-hover:text-white transition-colors">
                              <Users className="w-3 h-3" />
                              <span className="text-[10px] font-bold">{coin.reply_count}</span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

