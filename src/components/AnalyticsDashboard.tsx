"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, DollarSign, Brain } from "lucide-react";
import type { EChartsOption, ECharts } from "echarts";
import {
  DEPLOYERS,
  METRIC_LABELS,
  METRIC_UNITS,
  type MetricKey,
  type Deployer,
} from "@/lib/dummyData";
import DeployerDetail from "./DeployerDetail";

const METRICS: { key: MetricKey; icon: React.ReactNode }[] = [
  { key: "totalVolume", icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { key: "totalMarketCap", icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { key: "totalCreatorFees", icon: <DollarSign className="w-3.5 h-3.5" /> },
  { key: "mindshare", icon: <Brain className="w-3.5 h-3.5" /> },
];

function fmtCompact(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString();
}

export default function AnalyticsDashboard() {
  const [metric, setMetric] = useState<MetricKey>("mindshare");
  const [selected, setSelected] = useState<Deployer | null>(null);
  const chartRef = useRef<ECharts | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [chartReady, setChartReady] = useState(false);

  const totals = useMemo(() => ({
    deployers: DEPLOYERS.length,
    volume: DEPLOYERS.reduce((s, d) => s + d.totalVolume, 0),
    marketCap: DEPLOYERS.reduce((s, d) => s + d.totalMarketCap, 0),
    fees: DEPLOYERS.reduce((s, d) => s + d.totalCreatorFees, 0),
  }), []);

  const mindshareMax = useMemo(() => Math.max(...DEPLOYERS.map((d) => d.mindshare), 1), []);

  const option: EChartsOption = useMemo(() => {
    const unit = METRIC_UNITS[metric];
    return {
      tooltip: {
        formatter: (params: any) => {
          const d = params.data?.deployer as Deployer | undefined;
          if (!d) return "";
          return `
            <div style="font-family:'DM Sans',sans-serif;font-size:12px;line-height:1.6">
              <strong style="font-size:14px">${d.displayName}</strong><br/>
              <span style="color:#a1a1aa">Volume:</span> ${fmtCompact(d.totalVolume)} SOL<br/>
              <span style="color:#a1a1aa">Market Cap:</span> ${fmtCompact(d.totalMarketCap)} SOL<br/>
              <span style="color:#a1a1aa">Creator Fees:</span> ${fmtCompact(d.totalCreatorFees)} SOL<br/>
              <span style="color:#a1a1aa">Mindshare:</span> ${d.mindshare}<br/>
              <span style="color:#a1a1aa">Tokens:</span> ${d.tokenCount}
            </div>`;
        },
        backgroundColor: "#111113",
        borderColor: "rgba(255,255,255,0.08)",
        textStyle: { color: "#fff" },
        extraCssText: "border-radius:12px;padding:12px 16px;box-shadow:0 8px 32px rgba(0,0,0,0.5)",
      },
      series: [
        {
          type: "treemap",
          roam: false,
          nodeClick: false as any,
          breadcrumb: { show: false },
          itemStyle: {
            borderColor: "#060608",
            borderWidth: 2,
            gapWidth: 2,
          },
          label: {
            show: true,
            formatter: (p: any) => {
              const d = p.data?.deployer as Deployer | undefined;
              if (!d) return "";
              const val = d[metric];
              return `{name|${d.displayName}}\n{val|${fmtCompact(val)}${unit ? " " + unit : ""}}`;
            },
            rich: {
              name: {
                fontSize: 13,
                fontWeight: 700,
                color: "#fff",
                lineHeight: 20,
                fontFamily: "'DM Sans', sans-serif",
              },
              val: {
                fontSize: 11,
                color: "rgba(255,255,255,0.5)",
                lineHeight: 16,
                fontFamily: "'JetBrains Mono', monospace",
              },
            },
            align: "left" as const,
            verticalAlign: "top" as const,
            padding: [8, 10],
          },
          data: DEPLOYERS.map((d) => {
            const norm = d.mindshare / mindshareMax;
            const r = Math.round(70 + norm * 169);
            const g = Math.round(20 + (1 - norm) * 20);
            const b = Math.round(60 + (1 - norm) * 140);
            return {
              name: d.displayName,
              value: d[metric],
              deployer: d,
              itemStyle: {
                color: `rgb(${r},${g},${b})`,
                borderRadius: 6,
              },
            };
          }),
        },
      ],
    };
  }, [metric, mindshareMax]);

  useEffect(() => {
    if (!containerRef.current) return;
    let instance: ECharts;
    (async () => {
      const echarts = await import("echarts/core");
      const { TreemapChart } = await import("echarts/charts");
      const { TooltipComponent } = await import("echarts/components");
      const { CanvasRenderer } = await import("echarts/renderers");
      echarts.use([TreemapChart, TooltipComponent, CanvasRenderer]);

      instance = echarts.init(containerRef.current!, undefined, { renderer: "canvas" });
      chartRef.current = instance;
      instance.setOption(option);
      setChartReady(true);

      instance.on("click", (params: any) => {
        const d = params.data?.deployer as Deployer | undefined;
        if (d) setSelected(d);
      });

      const ro = new ResizeObserver(() => instance.resize());
      ro.observe(containerRef.current!);
      return () => ro.disconnect();
    })();
    return () => {
      instance?.dispose();
      chartRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (chartRef.current && chartReady) {
      chartRef.current.setOption(option, { replaceMerge: ["series"] });
    }
  }, [option, chartReady]);

  const STAT_CARDS = [
    { label: "Deployers", value: totals.deployers.toString(), unit: "" },
    { label: "Total Volume", value: fmtCompact(totals.volume), unit: "SOL" },
    { label: "Total Market Cap", value: fmtCompact(totals.marketCap), unit: "SOL" },
    { label: "Creator Fees", value: fmtCompact(totals.fees), unit: "SOL" },
  ];

  return (
    <div className="min-h-screen bg-[#060608] text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1
            className="text-4xl sm:text-5xl font-black tracking-tight mb-2"
            style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
          >
            Top Pump.fun{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: "linear-gradient(135deg, #ef4444 0%, #c026d3 50%, #6366f1 100%)",
              }}
            >
              Deployers
            </span>
          </h1>
          <p className="text-sm text-zinc-500 max-w-xl">
            Real-time analytics on the most impactful token deployers on pump.fun.
            Click any deployer to drill down into their portfolio.
          </p>
        </motion.div>

        {/* Summary stats */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"
        >
          {STAT_CARDS.map((s, i) => (
            <div
              key={s.label}
              className="rounded-2xl bg-white/[0.025] border border-white/5 px-5 py-4"
            >
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">{s.label}</p>
              <p className="text-xl font-bold text-white">
                {s.value}
                {s.unit && <span className="text-xs text-zinc-500 ml-1 font-normal">{s.unit}</span>}
              </p>
            </div>
          ))}
        </motion.div>

        {/* Metric selector */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex flex-wrap gap-2 mb-4"
        >
          {METRICS.map((m) => {
            const active = metric === m.key;
            return (
              <button
                key={m.key}
                onClick={() => setMetric(m.key)}
                className={`relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-colors border ${
                  active
                    ? "text-white border-red-500/30 bg-red-500/10"
                    : "text-zinc-500 border-white/5 bg-white/[0.02] hover:text-zinc-300 hover:border-white/10"
                }`}
              >
                {m.icon}
                {METRIC_LABELS[m.key]}
              </button>
            );
          })}
          <p className="flex items-center text-[10px] text-zinc-600 ml-2">
            Rectangle size = {METRIC_LABELS[metric].toLowerCase()} &middot; colour = mindshare score
          </p>
        </motion.div>

        {/* Treemap */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-white/5 bg-white/[0.015] overflow-hidden"
        >
          <div ref={containerRef} className="w-full" style={{ height: "clamp(400px, 60vh, 720px)" }} />
        </motion.div>

        <p className="text-[10px] text-zinc-700 mt-2 text-center">
          Click a deployer to see detailed stats and top tokens
        </p>
      </div>

      <footer className="mt-auto py-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-center gap-3 text-xs text-zinc-800">
          <span>© {new Date().getFullYear()} Eve Army · 4mVbX7EZonRcEfiyFbbw2ByrYc7xAkUMp3NKWhDwpump</span>
          <a
            href="https://discord.com/invite/n7vBHFf5VF"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-zinc-600 hover:text-zinc-400 transition-colors"
            aria-label="Join Eve Army on Discord"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
            Discord
          </a>
        </div>
      </footer>

      <DeployerDetail deployer={selected} metricLabels={METRIC_LABELS} onClose={() => setSelected(null)} />
    </div>
  );
}
