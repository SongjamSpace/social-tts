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
          border-left: 1px solid #1a1a1a;
        }
        .drop-cap::first-letter {
          float: left;
          font-size: 5rem;
          line-height: 0.8;
          padding-top: 8px;
          padding-right: 12px;
          padding-left: 3px;
          font-weight: 800;
          color: #1a1a1a;
          font-family: serif;
        }
        .market-brief-item:hover {
          background: rgba(26, 26, 26, 0.03);
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-12">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="w-12 h-12 border-4 border-[#1a1a1a] border-t-transparent rounded-full animate-spin"></div>
            <p className="font-bold tracking-widest text-[#1a1a1a]">RETRIEVING DISPATCHES...</p>
          </div>
        ) : (
          <div className="space-y-24">
            {/* FRONT PAGE SECTION (Top 15 Trends) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
              
              {/* LEFT SIDEBAR: MARKET BRIEFS (Trends 1-5) */}
              <aside className="md:col-span-3 space-y-8">
                <div className="border-t-4 border-b-2 border-[#1a1a1a] py-2 mb-6">
                  <h3 className={`text-center text-sm font-black tracking-[0.2em] ${jetbrainsMono.className}`}>
                    TOP TRENDS
                  </h3>
                </div>
                
                <div className="space-y-6">
                  {trends.slice(1, 7).map((trend, i) => (
                    <article key={i} className="market-brief-item border-b border-dashed border-[#d1cdc2] pb-4 last:border-0 group cursor-pointer">
                      <h4 className="font-bold text-base leading-tight group-hover:underline uppercase mb-2">
                        {trend.trend_name}
                      </h4>
                      <div className="flex justify-between items-center">
                        <span className={`text-[10px] font-bold ${jetbrainsMono.className}`}>
                          {trend.tweet_count} REPS
                        </span>
                        {/* <span className={`text-xs font-black ${jetbrainsMono.className}`}>
                          {trend.heat_score}🔥
                        </span> */}
                      </div>
                    </article>
                  ))}
                  <div className="pt-4 text-center">
                    <button className="text-[10px] font-bold hover:underline tracking-widest uppercase">VIEW ALL TRENDS</button>
                  </div>
                </div>

                <div className="mt-12 bg-[#1a1a1a] p-1">
                   <div className="border border-[#f4f1ea] p-4 text-[#f4f1ea] text-center">
                      <div className="text-[10px] font-bold tracking-[0.3em] mb-2 uppercase opacity-60 italic">SPECIAL REPORT</div>
                      <div className="font-bold text-lg leading-tight uppercase">Bitcoin Up or Down?</div>
                      <div className="text-[10px] mt-2 opacity-50">9:30AM-9:45AM ET: SO CLOSE</div>
                   </div>
                </div>
              </aside>

              {/* CENTER COLUMN: FEATURED STORY (Trend 0) */}
              <section className="md:col-span-6 space-y-8 md:border-x md:border-[#d1cdc2] md:px-8">
                {trends[0] && (
                  <article className="space-y-6">
                    <div className="text-center">
                       {trends[0].sentiment === "Negative" && (
                         <span className="inline-block bg-[#7f1d1d] text-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest mb-4">
                           ⁕ CONTESTED ⁕
                         </span>
                       )}
                       <h2 className="text-4xl md:text-6xl font-black tracking-tighter leading-[0.9] uppercase mb-4">
                         {trends[0].trend_name}
                       </h2>
                       <div className={`flex justify-center items-center gap-3 text-[10px] font-bold uppercase tracking-widest mb-6 ${jetbrainsMono.className}`}>
                         <span>BY EVE ARMY</span>
                         <span className="w-1 h-1 bg-[#1a1a1a] rounded-full"></span>
                         <span>NEW YORK ({new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase()})</span>
                       </div>
                    </div>

                    <div className="border border-[#1a1a1a] p-1">
                      <div className="aspect-[4/3] relative overflow-hidden bg-[#d1cdc2]">
                        <img 
                          src="/Users/logeshrajappa/.gemini/antigravity/brain/cea95b15-f233-47de-9696-0e58b6b7a39d/insect_decline_newspaper_1774327560270.png" 
                          alt="Featured Illustration" 
                          className="w-full h-full object-cover grayscale contrast-125"
                        />
                      </div>
                      <div className="py-2 text-center text-[8px] font-bold uppercase tracking-widest opacity-60 italic">
                        Visualizing the impact of {trends[0].trend_name.split(' ')[0]} in real-time
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-8">
                       <p className="drop-cap text-lg leading-relaxed text-justify hyphens-auto">
                         {trends[0].summary} {trends[0].summary.split('.')[0]}
                       </p>
                       
                       <div className="flex flex-col md:flex-row gap-8 items-start">
                          <blockquote className="flex-1 border-y border-[#1a1a1a] py-6 px-4">
                            <p className="text-2xl font-black italic leading-tight text-center">
                              "The ledger does not lie. The sentiment of this dispatch is clear."
                            </p>
                          </blockquote>
                          <div className="flex-1 text-xs leading-relaxed italic opacity-80">
                            Further data aggregation from the centroid tweet {trends[0].centroid_tweet_id} indicates a coordinated wave of activity within the cluster {trends[0].cluster_id}. Our desk recommends extreme caution as the cycle progresses.
                          </div>
                       </div>
                    </div>
                  </article>
                )}
              </section>

              {/* RIGHT SIDEBAR: NEWSLETTER & SIDE STORIES (Trends 7-10) */}
              <aside className="md:col-span-3 space-y-12">
                <div className="border border-[#1a1a1a] p-6 text-center space-y-4">
                  <h3 className="text-3xl font-black leading-none">The Daily Dispatch</h3>
                  <p className="text-[10px] italic leading-tight opacity-70">
                    Receive the morrow's intelligence and exclusive predictions directly to your telegraph office.
                  </p>
                  <div className="pt-2">
                    <input 
                      type="text" 
                      placeholder="Your electronic address" 
                      className="w-full bg-transparent border-b border-[#1a1a1a] py-2 text-xs italic text-center focus:outline-none"
                    />
                    <button className="w-full bg-[#1a1a1a] text-[#f4f1ea] py-3 text-[10px] font-bold uppercase tracking-[0.3em] mt-4 hover:opacity-90">
                      SUBSCRIBE
                    </button>
                  </div>
                </div>

                <div className="bg-[#1a1a1a] text-[#f4f1ea] p-6 shadow-[8px_8px_0px_#d1cdc2]">
                  <div className="text-[8px] font-bold tracking-[0.3em] uppercase opacity-60 mb-8 border-b border-[#f4f1ea]/20 pb-2">THE FEDERAL RESERVE</div>
                  <div className="text-center py-4">
                    <div className="text-6xl font-black tracking-tighter text-[#d4af37]">HOLD</div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] mt-4 opacity-80">CONSENSUS 95%</div>
                  </div>
                  <button className="w-full border border-[#f4f1ea]/30 py-2 text-[8px] font-bold uppercase tracking-widest mt-8 hover:bg-[#f4f1ea]/10">
                    SEE PREDICTIONS
                  </button>
                </div>

                <div className="space-y-8">
                  {trends.slice(7, 10).map((trend, i) => (
                    <article key={i} className="space-y-3">
                      <h4 className="font-bold text-sm leading-tight uppercase underline underline-offset-4 decoration-1">
                        {trend.trend_name}
                      </h4>
                      <p className="text-[10px] leading-tight opacity-80">
                        {trend.summary.slice(0, 100)}...
                      </p>
                    </article>
                  ))}
                </div>
              </aside>
            </div>

            <div className="newspaper-divider"></div>

            {/* SEPARATE CARDS SECTION (Rest of Trends) */}
            <section className="space-y-12">
              <div className="flex items-center gap-8">
                <div className="h-px bg-[#1a1a1a] flex-1"></div>
                <h2 className={`text-sm font-black tracking-[0.5em] uppercase ${jetbrainsMono.className}`}>
                  LATEST DISPATCHES
                </h2>
                <div className="h-px bg-[#1a1a1a] flex-1"></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
                {trends.slice(10).map((trend, idx) => (
                  <article 
                    key={idx} 
                    className="group relative"
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

                      <h2 className="font-bold text-2xl leading-[1.1] group-hover:underline underline-offset-4 decoration-2 mb-4 uppercase">
                        {trend.trend_name}
                      </h2>

                      <p className="text-[#333] text-sm leading-relaxed text-justify hyphens-auto">
                        {trend.summary}
                      </p>

                      <div className={`mt-6 pt-4 border-t border-[#1a1a1a]/10 flex justify-between items-center text-[10px] font-bold ${jetbrainsMono.className}`}>
                        <span className="opacity-50">REF: {trend.centroid_tweet_id.slice(-6)}</span>
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
            </section>
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
