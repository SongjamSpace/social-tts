"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Libre_Baskerville, JetBrains_Mono } from "next/font/google";

const libreBaskerville = Libre_Baskerville({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
});

interface Trend {
  trend_name: string;
  summary: string;
  heat_score: number;
  sentiment: "Positive" | "Negative" | "Neutral" | string;
  tweet_count: number;
  cluster_id: number;
  cycle_start: string;
  centroid_tweet_id: string;
  top_tweet_ids: string[];
  updated_at: string;
}

export default function LiveTrendsPage() {
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);
  const [tickerIndex, setTickerIndex] = useState(0);

  useEffect(() => {
    async function fetchTrends() {
      try {
        const res = await fetch("https://songjamspace-leaderboard.logesh-063.workers.dev/live_trends");
        if (res.ok) {
          const data = await res.json();
          setTrends(data.sort((a: Trend, b: Trend) => b.heat_score - a.heat_score));
        }
      } catch (e) {
        console.error("Failed to fetch trends", e);
      } finally {
        setLoading(false);
      }
    }
    fetchTrends();
    const interval = setInterval(fetchTrends, 60000);
    return () => clearInterval(interval);
  }, []);

  // Cycle ticker every 10 seconds
  useEffect(() => {
    if (trends.length === 0) return;
    const interval = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % trends.length);
    }, 10000);
    return () => clearInterval(interval);
  }, [trends]);

  const getSentimentStyle = (sentiment: string) => {
    switch (sentiment?.toLowerCase()) {
      case "positive":
        return "bg-[#eaf4ea] border-[#c0dcc0]";
      case "negative":
        return "bg-[#f4eaea] border-[#dcc0c0]";
      default:
        return "bg-[#f4f1ea] border-[#d1cdc2]";
    }
  };

  const getGridSpan = (heat: number) => {
    if (heat >= 9) return "md:col-span-3 md:row-span-2";
    if (heat >= 7) return "md:col-span-2 md:row-span-1";
    return "md:col-span-1 md:row-span-1";
  };

  return (
    <div className={`min-h-screen bg-[#f4f1ea] text-[#1a1a1a] ${libreBaskerville.className} selection:bg-black selection:text-[#f4f1ea]`}>
      <style jsx global>{`
        .newspaper-divider {
          border-top: 1px solid #1a1a1a;
          border-bottom: 1px solid #1a1a1a;
          height: 4px;
          margin: 0.5rem 0;
        }
        .vertical-divider {
          border-left: 1px solid #d1cdc2;
        }
        .drop-cap::first-letter {
          float: left;
          font-size: 4.5rem;
          line-height: 1;
          padding-top: 4px;
          padding-right: 8px;
          padding-left: 3px;
          font-weight: 700;
          color: #1a1a1a;
        }
        @media (max-width: 768px) {
          .vertical-divider {
            border-left: none;
            border-top: 1px solid #d1cdc2;
            padding-top: 1.5rem;
          }
        }
      `}</style>

      {/* Masthead Header */}
      <header className="max-w-7xl mx-auto px-4 pt-8 pb-4 border-b border-[#1a1a1a]">
        <div className={`flex justify-between items-center text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-2 ${jetbrainsMono.className}`}>
          <div>VOL. MMXXVI • NO. 84</div>
          <div className="hidden sm:block">LATEST DISPATCHES FROM THE FRONTLINE</div>
          <div>EST. PRICE $1.00</div>
        </div>
        
        <div className="newspaper-divider"></div>
        
        <div className="flex flex-col md:flex-row justify-between items-center py-6 gap-8">
          {/* Header AD Left */}
          <div className="hidden lg:flex w-64 h-24 border border-[#d1cdc2] border-dashed items-center justify-center text-[10px] text-[#999] tracking-[0.2em] font-mono hover:bg-white/50 transition-colors cursor-help">
            SPONSOR SPOTLIGHT
          </div>

          <h1 className="text-5xl sm:text-7xl lg:text-9xl font-bold tracking-tighter text-center leading-[0.85] select-none">
            THE DAILY TREND
          </h1>

          {/* Header AD Right */}
          <div className="w-full md:w-64 h-24 border border-[#d1cdc2] border-dashed flex items-center justify-center text-[10px] text-[#999] tracking-[0.2em] font-mono hover:bg-white/50 transition-colors cursor-help">
            ADVERTISEMENT SPACE
          </div>
        </div>

        <div className="newspaper-divider"></div>

        <div className={`flex justify-between items-center py-2 text-xs font-bold ${jetbrainsMono.className}`}>
          <span>SOLANA, CRYPTO</span>
          <span className="uppercase">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
          <span>LIVE UPDATES • 24/7</span>
        </div>
      </header>

      {/* Live Ticker */}
      <div className="bg-[#1a1a1a] text-[#f4f1ea] py-2 overflow-hidden sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-4">
          <span className={`text-[10px] font-bold bg-[#f4f1ea] text-[#1a1a1a] px-2 py-0.5 whitespace-nowrap ${jetbrainsMono.className}`}>
            BREAKING DISPATCH
          </span>
          <div className="relative h-6 flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              {trends.length > 0 && (
                <motion.div
                  key={tickerIndex}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                  className={`text-sm lg:text-base font-medium whitespace-nowrap overflow-hidden text-ellipsis ${libreBaskerville.className}`}
                >
                  {trends[tickerIndex].trend_name}: {trends[tickerIndex].summary}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <main className="max-w-7xl mx-auto px-4 py-12">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="w-12 h-12 border-4 border-[#1a1a1a] border-t-transparent rounded-full animate-spin"></div>
            <p className="font-bold tracking-widest text-[#1a1a1a]">PRINTING THE NEWS...</p>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-12">
            {/* News Stream */}
            <div className="flex-1">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-12">
                {trends.map((trend, idx) => (
                  <article 
                    key={idx} 
                    className={`${getGridSpan(trend.heat_score)} group relative`}
                  >
                    <div className={`h-full border border-[#1a1a1a] p-6 shadow-[4px_4px_0px_#1a1a1a] group-hover:shadow-[8px_8px_0px_#1a1a1a] transition-all ${getSentimentStyle(trend.sentiment)}`}>
                      <div className="flex justify-between items-start mb-4">
                        <span className={`text-[10px] font-bold border border-[#1a1a1a] px-2 py-0.5 tracking-tighter ${jetbrainsMono.className}`}>
                          {trend.sentiment.toUpperCase()} • {trend.tweet_count} REPS
                        </span>
                        <span className={`text-[10px] font-bold ${jetbrainsMono.className}`}>
                          HEAT {trend.heat_score}/10
                        </span>
                      </div>

                      <h2 className={`font-bold leading-[1.1] group-hover:underline underline-offset-4 decoration-2 mb-4 
                        ${trend.heat_score >= 9 ? 'text-4xl lg:text-6xl' : 
                          trend.heat_score >= 7 ? 'text-3xl lg:text-4xl' : 'text-xl lg:text-2xl'}`}
                      >
                        {trend.trend_name}
                      </h2>

                      <p className={`text-[#333] leading-relaxed text-justify hyphens-auto ${trend.heat_score >= 8 ? 'drop-cap text-lg' : 'text-sm'}`}>
                        {trend.summary}
                      </p>

                      <div className={`mt-6 pt-4 border-t border-[#1a1a1a]/10 flex justify-between items-center text-[10px] font-bold ${jetbrainsMono.className}`}>
                        <span className="opacity-50">TRANSCRIPT REF: {trend.centroid_tweet_id.slice(-6)}</span>
                        <motion.button 
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="hover:underline"
                        >
                          READ MORE →
                        </motion.button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            {/* Right Sidebar Ad Columns */}
            <aside className="hidden lg:block w-[300px] space-y-8">
              <div className="sticky top-20">
                <div className="border border-[#1a1a1a] p-4 bg-white shadow-[4px_4px_0px_#1a1a1a]">
                  <h3 className={`text-center text-xs font-bold border-b border-[#1a1a1a] pb-2 mb-4 tracking-[0.3em] ${jetbrainsMono.className}`}>
                    SPONSORED LINKS
                  </h3>
                  
                  {/* Sidebar AD 1 */}
                  <div className="aspect-[3/4] border border-[#d1cdc2] border-dashed mb-6 flex flex-col items-center justify-center p-6 text-center group cursor-pointer hover:bg-[#f4f1ea] transition-colors">
                    <div className="text-[10px] text-[#999] font-mono mb-4">PREMIUM AD PLACEMENT</div>
                    <div className="text-lg font-bold leading-tight mb-2">Build Your Next Vision Here</div>
                    <div className="text-xs text-[#666]">Contact our desk for sponsorship opportunities.</div>
                  </div>

                  {/* Sidebar AD 2 */}
                  <div className="aspect-square border border-[#d1cdc2] border-dashed flex flex-col items-center justify-center p-6 text-center group cursor-pointer hover:bg-[#f4f1ea] transition-colors">
                    <div className="text-[10px] text-[#999] font-mono mb-4">PARTNER SHOWCASE</div>
                    <div className="text-base font-bold leading-tight mb-2">EVE ANALYTICS</div>
                    <div className="text-[10px] text-[#666] tracking-widest">REAL-TIME ALPHA PLATFORM</div>
                  </div>

                  <div className="mt-8 pt-4 border-t border-[#1a1a1a] text-center">
                    <p className={`text-[9px] text-[#999] leading-tight ${jetbrainsMono.className}`}>
                      © 2026 THE DAILY TREND. ALL RIGHTS RESERVED. PULSED FROM THE BLOCKCHAIN.
                    </p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>

      {/* Footer Branding */}
      <footer className="max-w-7xl mx-auto px-4 py-8 border-t-2 border-[#1a1a1a]">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-4xl font-bold tracking-tighter">THE DAILY TREND</div>
          <div className={`flex gap-6 text-[10px] font-bold tracking-widest ${jetbrainsMono.className}`}>
            <a href="#" className="hover:underline">ARCHIVES</a>
            <a href="#" className="hover:underline">ADVERTISING</a>
            <a href="#" className="hover:underline">CORRECTIONS</a>
            <a href="#" className="hover:underline">CONTACT</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
