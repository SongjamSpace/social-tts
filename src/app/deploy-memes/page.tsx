"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { JetBrains_Mono, Chakra_Petch } from "next/font/google";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
});

const chakraPetch = Chakra_Petch({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
});

interface Trend {
  trend_name: string;
  summary: string;
  heat_score: number;
  sentiment: string;
  tweet_count: number;
  centroid_tweet_id: string;
}

interface MemeMetadata {
  id: string;
  name: string;
  symbol: string;
  description: string;
  imageColor: string;
  tier: "platinum" | "gold" | "silver";
  heat: number;
}

const generateMemeMetadata = (trend: Trend): MemeMetadata => {
  const words = trend.trend_name.split(" ");
  const symbol = words[0].toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
  
  let tier: "platinum" | "gold" | "silver" = "silver";
  if (trend.heat_score >= 8.5) tier = "platinum";
  else if (trend.heat_score >= 6.0) tier = "gold";

  const colors = [
    "from-purple-500 to-blue-500",
    "from-cyan-400 to-emerald-400",
    "from-rose-500 to-orange-500",
    "from-amber-400 to-yellow-600",
    "from-indigo-600 to-purple-700"
  ];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];

  return {
    id: Math.random().toString(36).substr(2, 9),
    name: trend.trend_name,
    symbol: `$${symbol}`,
    description: trend.summary.length > 100 ? trend.summary.slice(0, 100) + "..." : trend.summary,
    imageColor: randomColor,
    tier,
    heat: trend.heat_score,
  };
};

export default function DeployMemesPage() {
  const [tokens, setTokens] = useState<MemeMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [deployingId, setDeployingId] = useState<string | null>(null);
  const [deployedIds, setDeployedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchTrends() {
      try {
        const res = await fetch("https://songjamspace-leaderboard.logesh-063.workers.dev/live_trends");
        if (res.ok) {
          const data = await res.json();
          const mapped = data
            .sort((a: Trend, b: Trend) => b.heat_score - a.heat_score)
            .map((t: Trend) => generateMemeMetadata(t));
          setTokens(mapped);
        }
      } catch (e) {
        console.error("Failed to fetch trends", e);
      } finally {
        setLoading(false);
      }
    }
    fetchTrends();
  }, []);

  const handleDeploy = (id: string) => {
    setDeployingId(id);
    
    // Simulate deployment process
    setTimeout(() => {
      setDeployedIds(prev => new Set(prev).add(id));
      setDeployingId(null);
      
      // After deployment, replace this token with a "new" one (simulation)
      setTimeout(() => {
        setTokens(prev => prev.map(t => {
          if (t.id === id) {
            // Generate a slightly different "new" version or a placeholder
            return {
              ...t,
              id: Math.random().toString(36).substr(2, 9),
              name: "Upcoming Alpha",
              symbol: "$NEXT",
              description: "The next big trend is emerging from the social abyss. Be ready to snipe.",
              tier: "gold",
              heat: 9.9,
              imageColor: "from-gray-700 to-black"
            };
          }
          return t;
        }));
        // Remove from deployed set so it resets for the "new" card
        setDeployedIds(prev => {
           const next = new Set(prev);
           next.delete(id);
           return next;
        });
      }, 2000);
    }, 1500);
  };

  return (
    <div className={`min-h-screen bg-[#020617] text-slate-100 ${chakraPetch.className} selection:bg-cyan-500/30 overflow-x-hidden`}>
      {/* Animated Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(168,85,247,0.1),transparent)] animate-pulse"></div>
        <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
      </div>

      <header className="relative z-10 max-w-7xl mx-auto px-4 py-12 text-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-block"
        >
          <span className="text-cyan-400 text-xs font-bold tracking-[0.5em] uppercase mb-4 block">LIVE TREND TERMINAL</span>
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-4 italic uppercase">
            Deploy <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-500 to-amber-400 animate-gradient-x">Memes</span>
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg">
            AHOY! The social ledger has shifted. High-velocity trends detected. Select a vessel and launch it into the decentralized abyss.
          </p>
        </motion.div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 pb-24">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-8 shadow-[0_0_20px_rgba(6,182,212,0.5)]"></div>
            <p className="text-cyan-400 animate-pulse font-bold tracking-widest uppercase">Scanning Social Frequency...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <AnimatePresence mode="popLayout">
              {tokens.map((token, index) => (
                <MemeCard 
                  key={token.id} 
                  token={token} 
                  index={index}
                  isDeploying={deployingId === token.id}
                  isDeployed={deployedIds.has(token.id)}
                  onDeploy={() => handleDeploy(token.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      <footer className="relative z-10 border-t border-slate-800 py-12 bg-slate-950/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-2xl font-black tracking-tighter italic">EVE.AHOY</div>
          <div className={`flex gap-8 text-[10px] font-bold tracking-[0.3em] uppercase opacity-50 ${jetbrainsMono.className}`}>
            <span>System Status: 100% Functional</span>
            <span>Uptime: 24/7</span>
            <span>Alpha: Unlimited</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function MemeCard({ token, index, isDeploying, isDeployed, onDeploy }: { 
  token: MemeMetadata; 
  index: number; 
  isDeploying: boolean;
  isDeployed: boolean;
  onDeploy: () => void;
}) {
  const tierClass = token.tier === "platinum" ? "glow-platinum" : token.tier === "gold" ? "glow-gold" : "border-slate-800";
  const tierLabel = token.tier.toUpperCase();
  const tierColor = token.tier === "platinum" ? "text-cyan-400" : token.tier === "gold" ? "text-amber-400" : "text-slate-400";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, filter: "blur(10px)" }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -10, transition: { duration: 0.2 } }}
      className={`glass group relative p-6 rounded-2xl transition-all duration-300 ${tierClass} shimmer-overlay`}
    >
      {/* Tier Badge */}
      <div className="flex justify-between items-start mb-6">
        <div className={`px-3 py-1 rounded-full bg-slate-950/50 border border-slate-700 text-[10px] font-bold tracking-widest ${tierColor}`}>
          ● {tierLabel} TIER
        </div>
        <div className={`text-xs font-bold ${jetbrainsMono.className} text-cyan-400 flex items-center gap-1`}>
          HEAT {token.heat.toFixed(1)} <span className="animate-pulse">🔥</span>
        </div>
      </div>

      {/* Coin Visual */}
      <div className="relative mb-6 flex justify-center">
        <div className={`w-32 h-32 rounded-full bg-gradient-to-br ${token.imageColor} shadow-2xl flex items-center justify-center p-1 group-hover:scale-110 transition-transform duration-500`}>
          <div className="w-full h-full rounded-full bg-slate-950/40 backdrop-blur-sm flex items-center justify-center border border-white/10">
            <span className="text-4xl font-black italic text-white drop-shadow-lg">{token.symbol[1]}</span>
          </div>
        </div>
        {/* Decorative rings */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center opacity-20 group-hover:opacity-40 transition-opacity">
          <div className="w-40 h-40 border border-cyan-400 rounded-full animate-[spin_10s_linear_infinite]"></div>
          <div className="absolute w-48 h-48 border border-purple-500/30 rounded-full animate-[spin_15s_linear_infinite_reverse]"></div>
        </div>
      </div>

      {/* Token Info */}
      <div className="space-y-4 relative z-10">
        <div className="text-center">
          <h2 className="text-2xl font-black tracking-tight uppercase group-hover:text-cyan-400 transition-colors">
            {token.name}
          </h2>
          <span className={`text-sm font-bold ${jetbrainsMono.className} opacity-60 tracking-widest`}>
            {token.symbol}
          </span>
        </div>

        <p className="text-slate-400 text-sm leading-relaxed text-center h-12 line-clamp-2">
          {token.description}
        </p>

        <button
          onClick={onDeploy}
          disabled={isDeploying || isDeployed}
          className={`w-full py-4 rounded-xl font-black uppercase tracking-[0.2em] transition-all relative overflow-hidden group/btn ${
            isDeployed 
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50" 
              : "bg-slate-100 text-slate-950 hover:bg-cyan-400 hover:shadow-[0_0_30px_rgba(6,182,212,0.6)]"
          }`}
        >
          {isDeploying ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
              <span>DEPLOYING...</span>
            </div>
          ) : isDeployed ? (
            "✓ DEPLOYED"
          ) : (
            "ONE-CLICK DEPLOY"
          )}
          
          {/* Glitch effect on hover */}
          {!isDeploying && !isDeployed && (
            <div className="absolute inset-0 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300 bg-cyan-400 flex items-center justify-center pointer-events-none">
               DEPLOY {token.symbol}
            </div>
          )}
        </button>
      </div>

      {/* Background Decorative Element */}
      <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-cyan-500/10 blur-[60px] pointer-events-none rounded-full group-hover:bg-cyan-500/20 transition-all"></div>
    </motion.div>
  );
}
