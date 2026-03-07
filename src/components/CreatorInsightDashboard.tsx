"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Users,
  TrendingUp,
  MessageSquare,
  Video,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Sparkles,
  Crown,
  BarChart3,
} from "lucide-react";
import type {
  ParticipantInsight,
  CreatorInsightResponse,
  CreatorInsightCoin,
} from "@/types/pumpfun";

/* ── colour helpers ─────────────────────────────────────────── */

const PALETTE = [
  "#a855f7", "#22d3ee", "#f472b6", "#34d399", "#facc15",
  "#fb923c", "#818cf8", "#e879f9", "#2dd4bf", "#f87171",
  "#60a5fa", "#4ade80", "#c084fc", "#fbbf24", "#38bdf8",
];

function scoreColor(score: number) {
  if (score >= 80) return "#22d3ee";
  if (score >= 50) return "#a855f7";
  if (score >= 25) return "#f472b6";
  return "#64748b";
}

function fmtCompact(v: number) {
  if (v >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(2) + "K";
  return v.toFixed(2);
}

function shortAddr(addr: string) {
  if (addr.length <= 10) return addr;
  return addr.slice(0, 4) + "…" + addr.slice(-4);
}

/* ── Treemap via ECharts ─────────────────────────────────────── */

function MindTreeChart({
  participants,
  onSelect,
}: {
  participants: ParticipantInsight[];
  onSelect: (p: ParticipantInsight) => void;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [echartsCore, { TreemapChart }, componentsModule] =
        await Promise.all([
          import("echarts/core"),
          import("echarts/charts"),
          import("echarts/components"),
        ]);
      const { CanvasRenderer } = await import("echarts/renderers");

      // Register ECharts modules — must call use() on the core module
      echartsCore.use([TreemapChart, componentsModule.TooltipComponent, CanvasRenderer]);

      if (cancelled || !chartRef.current) return;

      // dispose previous
      if (instanceRef.current) instanceRef.current.dispose();

      const chart = echartsCore.init(chartRef.current, undefined, { renderer: "canvas" });
      instanceRef.current = chart;

      const data = participants.slice(0, 50).map((p, i) => ({
        name: p.username || shortAddr(p.address),
        value: p.contributionScore,
        itemStyle: { color: PALETTE[i % PALETTE.length], borderColor: "#111113", borderWidth: 2 },
        _participant: p,
      }));

      chart.setOption({
        tooltip: {
          backgroundColor: "#111113",
          borderColor: "rgba(255,255,255,0.08)",
          textStyle: { color: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 12 },
          extraCssText: "border-radius:12px;padding:12px 16px;box-shadow:0 8px 32px rgba(0,0,0,0.5)",
          formatter: (params: any) => {
            const p = params.data._participant as ParticipantInsight;
            return `<div style="font-size:13px;font-weight:600;margin-bottom:6px">${
              p.username || shortAddr(p.address)
            }</div>
            <div style="color:#94a3b8;font-size:11px;line-height:1.6">
              Score: <span style="color:#22d3ee">${p.contributionScore}</span><br/>
              Buys: ${p.buyCount} (${fmtCompact(p.buyVolumeSol)} SOL)<br/>
              Sells: ${p.sellCount} (${fmtCompact(p.sellVolumeSol)} SOL)<br/>
              Messages: ${p.messageCount}
            </div>`;
          },
        },
        series: [
          {
            type: "treemap",
            data,
            roam: false,
            nodeClick: false,
            breadcrumb: { show: false },
            label: {
              show: true,
              formatter: "{b}",
              color: "#fff",
              fontSize: 11,
              fontWeight: 600,
              fontFamily: "'DM Sans', sans-serif",
            },
            itemStyle: { borderRadius: 6 },
            levels: [
              {
                itemStyle: {
                  borderColor: "#111113",
                  borderWidth: 3,
                  gapWidth: 3,
                },
              },
            ],
          },
        ],
      });

      chart.on("click", (params: any) => {
        if (params.data?._participant) {
          onSelect(params.data._participant);
        }
      });

      const ro = new ResizeObserver(() => chart.resize());
      ro.observe(chartRef.current);
      return () => { ro.disconnect(); };
    })();

    return () => {
      cancelled = true;
      instanceRef.current?.dispose();
    };
  }, [participants, onSelect]);

  return (
    <div
      ref={chartRef}
      className="w-full rounded-2xl overflow-hidden"
      style={{ height: 420, background: "rgba(255,255,255,0.02)" }}
    />
  );
}

/* ── Pie chart — buy vs sell ─────────────────────────────────── */

function VolumeBreakdownPie({
  totalBuy,
  totalSell,
}: {
  totalBuy: number;
  totalSell: number;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [echartsCore, { PieChart }, componentsModule] =
        await Promise.all([
          import("echarts/core"),
          import("echarts/charts"),
          import("echarts/components"),
        ]);
      const { CanvasRenderer } = await import("echarts/renderers");

      // Register ECharts modules — must call use() on the core module
      echartsCore.use([PieChart, componentsModule.TooltipComponent, componentsModule.LegendComponent, CanvasRenderer]);

      if (cancelled || !chartRef.current) return;
      if (instanceRef.current) instanceRef.current.dispose();

      const chart = echartsCore.init(chartRef.current, undefined, { renderer: "canvas" });
      instanceRef.current = chart;

      chart.setOption({
        tooltip: {
          backgroundColor: "#111113",
          borderColor: "rgba(255,255,255,0.08)",
          textStyle: { color: "#fff", fontSize: 12 },
          extraCssText: "border-radius:12px;padding:10px 14px;box-shadow:0 8px 32px rgba(0,0,0,0.5)",
        },
        legend: {
          bottom: 0,
          textStyle: { color: "#94a3b8", fontSize: 11 },
        },
        series: [
          {
            type: "pie",
            radius: ["45%", "72%"],
            center: ["50%", "45%"],
            avoidLabelOverlap: true,
            itemStyle: { borderRadius: 8, borderColor: "#111113", borderWidth: 3 },
            label: {
              show: true,
              color: "#e2e8f0",
              fontSize: 12,
              formatter: "{b}: {d}%",
            },
            data: [
              { value: +totalBuy.toFixed(2), name: "Buy Volume", itemStyle: { color: "#22d3ee" } },
              { value: +totalSell.toFixed(2), name: "Sell Volume", itemStyle: { color: "#f472b6" } },
            ],
          },
        ],
      });

      const ro = new ResizeObserver(() => chart.resize());
      ro.observe(chartRef.current);
      return () => ro.disconnect();
    })();
    return () => {
      cancelled = true;
      instanceRef.current?.dispose();
    };
  }, [totalBuy, totalSell]);

  return (
    <div
      ref={chartRef}
      className="w-full rounded-2xl overflow-hidden"
      style={{ height: 300, background: "rgba(255,255,255,0.02)" }}
    />
  );
}

/* ── Summary stat card ─────────────────────────────────────── */

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="relative group rounded-2xl border border-white/[0.06] p-4 overflow-hidden"
      style={{ background: "rgba(255,255,255,0.02)" }}
    >
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle at 50% 0%, ${color}15 0%, transparent 70%)`,
        }}
      />
      <div className="relative flex items-start gap-3">
        <div
          className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: `${color}18`, color }}
        >
          {icon}
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-widest text-zinc-500 mb-0.5">
            {label}
          </p>
          <p className="text-xl font-bold text-white">{value}</p>
          {sub && (
            <p className="text-[11px] text-zinc-500 mt-0.5">{sub}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Participant detail drawer ─────────────────────────────── */

function ParticipantDrawer({
  participant,
  onClose,
}: {
  participant: ParticipantInsight | null;
  onClose: () => void;
}) {
  if (!participant) return null;
  const p = participant;

  return (
    <AnimatePresence>
      <motion.div
        key={p.address}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed top-0 right-0 bottom-0 w-[380px] max-w-full z-50 border-l border-white/[0.06] p-6 overflow-y-auto"
        style={{ background: "#0d0d10" }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
        >
          ✕
        </button>

        <div className="flex items-center gap-3 mb-6">
          {p.profileImage ? (
            <img
              src={p.profileImage}
              alt=""
              className="w-10 h-10 rounded-full border border-white/10"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-white/[0.06] flex items-center justify-center text-white/40 text-sm font-bold">
              {(p.username || p.address)[0].toUpperCase()}
            </div>
          )}
          <div>
            <h3 className="text-white font-bold text-sm">
              {p.username || shortAddr(p.address)}
            </h3>
            <p className="text-[11px] text-zinc-500 font-mono">{shortAddr(p.address)}</p>
          </div>
        </div>

        {/* Score */}
        <div className="mb-6">
          <p className="text-[11px] uppercase tracking-widest text-zinc-500 mb-2">
            Contribution Score
          </p>
          <div className="w-full h-3 rounded-full bg-white/[0.04] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${p.contributionScore}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{
                background: `linear-gradient(90deg, ${scoreColor(
                  p.contributionScore
                )}, ${scoreColor(p.contributionScore)}88)`,
              }}
            />
          </div>
          <p className="text-right text-xs font-bold mt-1" style={{ color: scoreColor(p.contributionScore) }}>
            {p.contributionScore}
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[
            { label: "Buys", value: p.buyCount, color: "#22d3ee", icon: <ArrowUpRight className="w-3.5 h-3.5" /> },
            { label: "Sells", value: p.sellCount, color: "#f472b6", icon: <ArrowDownRight className="w-3.5 h-3.5" /> },
            { label: "Buy Vol (SOL)", value: fmtCompact(p.buyVolumeSol), color: "#22d3ee" },
            { label: "Sell Vol (SOL)", value: fmtCompact(p.sellVolumeSol), color: "#f472b6" },
            { label: "Buy Vol (USD)", value: "$" + fmtCompact(p.buyVolumeUsd), color: "#22d3ee" },
            { label: "Sell Vol (USD)", value: "$" + fmtCompact(p.sellVolumeUsd), color: "#f472b6" },
            { label: "Net (SOL)", value: fmtCompact(p.netVolumeSol), color: p.netVolumeSol >= 0 ? "#34d399" : "#f87171" },
            { label: "Messages", value: p.messageCount, color: "#a855f7" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-white/[0.04] p-3"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                {s.label}
              </p>
              <p className="text-sm font-bold mt-0.5" style={{ color: s.color }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-zinc-600">
          First seen: {new Date(p.firstSeen).toLocaleDateString()}
        </p>
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Sortable table ─────────────────────────────────────────── */

type SortKey = "contributionScore" | "buyVolumeSol" | "sellVolumeSol" | "messageCount" | "buyCount" | "sellCount";

function ParticipantTable({
  participants,
  onSelect,
}: {
  participants: ParticipantInsight[];
  onSelect: (p: ParticipantInsight) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("contributionScore");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    const copy = [...participants];
    copy.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return copy;
  }, [participants, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortIcon = sortAsc ? ChevronUp : ChevronDown;

  const cols: { key: SortKey; label: string; color: string }[] = [
    { key: "contributionScore", label: "Score", color: "#22d3ee" },
    { key: "buyCount", label: "Buys", color: "#34d399" },
    { key: "sellCount", label: "Sells", color: "#f472b6" },
    { key: "buyVolumeSol", label: "Buy SOL", color: "#22d3ee" },
    { key: "sellVolumeSol", label: "Sell SOL", color: "#f472b6" },
    { key: "messageCount", label: "Msgs", color: "#a855f7" },
  ];

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.06]" style={{ background: "rgba(255,255,255,0.02)" }}>
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-white/[0.06]">
            <th className="px-4 py-3 text-zinc-500 font-medium">#</th>
            <th className="px-4 py-3 text-zinc-500 font-medium">Participant</th>
            {cols.map((c) => (
              <th
                key={c.key}
                className="px-3 py-3 text-zinc-500 font-medium cursor-pointer hover:text-white transition-colors select-none whitespace-nowrap"
                onClick={() => toggleSort(c.key)}
              >
                <span className="flex items-center gap-1">
                  {c.label}
                  {sortKey === c.key && <SortIcon className="w-3 h-3" />}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((p, i) => (
            <motion.tr
              key={p.address}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => onSelect(p)}
              className="border-b border-white/[0.03] cursor-pointer hover:bg-white/[0.03] transition-colors"
            >
              <td className="px-4 py-3 text-zinc-600 font-mono">{i + 1}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {p.profileImage ? (
                    <img src={p.profileImage} alt="" className="w-6 h-6 rounded-full" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-white/[0.06] flex items-center justify-center text-[10px] font-bold text-white/30">
                      {(p.username || p.address)[0].toUpperCase()}
                    </div>
                  )}
                  <span className="text-white font-medium truncate max-w-[120px]">
                    {p.username || shortAddr(p.address)}
                  </span>
                </div>
              </td>
              {cols.map((c) => (
                <td key={c.key} className="px-3 py-3 font-mono" style={{ color: c.color }}>
                  {c.key.includes("Volume") || c.key === "contributionScore"
                    ? fmtCompact(p[c.key])
                    : p[c.key]}
                </td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Top Contributors ──────────────────────────────────────── */

function TopContributors({ participants }: { participants: ParticipantInsight[] }) {
  const top = participants.slice(0, 5);
  const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];

  return (
    <div className="space-y-2">
      {top.map((p, i) => (
        <motion.div
          key={p.address}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}
          className="flex items-center gap-3 rounded-xl border border-white/[0.04] p-3"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <span className="text-lg">{medals[i]}</span>
          {p.profileImage ? (
            <img src={p.profileImage} alt="" className="w-8 h-8 rounded-full" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-bold text-white/30">
              {(p.username || p.address)[0].toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {p.username || shortAddr(p.address)}
            </p>
            <p className="text-[10px] text-zinc-500 font-mono">
              {shortAddr(p.address)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold" style={{ color: scoreColor(p.contributionScore) }}>
              {p.contributionScore}
            </p>
            <p className="text-[10px] text-zinc-500">score</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* ── Coin Header ───────────────────────────────────────────── */

function CoinHeader({ coin }: { coin: CreatorInsightCoin }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-4 rounded-2xl border border-white/[0.06] p-4"
      style={{ background: "rgba(255,255,255,0.02)" }}
    >
      {coin.image_uri ? (
        <img
          src={coin.image_uri}
          alt={coin.name}
          className="w-14 h-14 rounded-xl border border-white/10 object-cover"
        />
      ) : (
        <div className="w-14 h-14 rounded-xl bg-white/[0.06] flex items-center justify-center text-white/30 text-lg font-bold">
          {coin.symbol?.[0] ?? "?"}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-white truncate">{coin.name}</h2>
          <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-white/[0.06] text-zinc-400">
            ${coin.symbol}
          </span>
          {coin.complete && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400">
              Graduated
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 mt-1 text-[11px] text-zinc-500">
          <span>
            MCap: <span className="text-white font-semibold">${fmtCompact(coin.usd_market_cap)}</span>
          </span>
          <span>
            ATH: <span className="text-cyan-400 font-semibold">${fmtCompact(coin.ath_market_cap)}</span>
          </span>
          <span>
            Replies: <span className="text-white">{coin.reply_count}</span>
          </span>
        </div>
      </div>
      <a
        href={`https://pump.fun/coin/${coin.mint}`}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 p-2 rounded-lg hover:bg-white/[0.06] transition-colors text-zinc-500 hover:text-white"
      >
        <ExternalLink className="w-4 h-4" />
      </a>
    </motion.div>
  );
}

/* ── Main exported dashboard ────────────────────────────────── */

export default function CreatorInsightDashboard() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CreatorInsightResponse | null>(null);
  const [selectedParticipant, setSelectedParticipant] =
    useState<ParticipantInsight | null>(null);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const addr = address.trim();
      if (!addr) return;
      setLoading(true);
      setError(null);
      setData(null);
      setSelectedParticipant(null);
      try {
        const res = await fetch(
          `/api/pumpfun/creator?address=${encodeURIComponent(addr)}`
        );
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Failed to fetch creator insights");
        }
        setData(json.data as CreatorInsightResponse);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [address]
  );

  return (
    <div className="min-h-screen pt-4 pb-16 px-4 md:px-8 max-w-7xl mx-auto">
      {/* ── Search bar ──────── */}
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="relative group">
          <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-purple-500/20 via-cyan-500/20 to-pink-500/20 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity blur-sm" />
          <div className="relative flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-[#111113] px-4 py-3">
            <Search className="w-4 h-4 text-zinc-500 shrink-0" />
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Paste creator wallet address…"
              className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 outline-none font-mono"
            />
            <button
              type="submit"
              disabled={loading || !address.trim()}
              className="shrink-0 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-30"
              style={{
                background: "linear-gradient(135deg, #a855f7, #22d3ee)",
                color: "#fff",
              }}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Analyse"
              )}
            </button>
          </div>
        </div>
      </motion.form>

      {/* ── Loading skeleton ── */}
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-32 gap-4"
        >
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-2 border-white/[0.06]" />
            <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-transparent border-t-purple-500 animate-spin" />
          </div>
          <p className="text-sm text-zinc-500">
            Fetching trades, streams & chat history…
          </p>
          <p className="text-[11px] text-zinc-600">This can take 10-30 seconds</p>
        </motion.div>
      )}

      {/* ── Error ──────────── */}
      {error && !loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400 text-center"
        >
          {error}
        </motion.div>
      )}

      {/* ── Dashboard ──────── */}
      {data && !loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          {/* Coin Header */}
          <CoinHeader coin={data.coin} />

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              icon={<Users className="w-4 h-4" />}
              label="Participants"
              value={data.totalParticipants.toLocaleString()}
              color="#a855f7"
              delay={0}
            />
            <StatCard
              icon={<TrendingUp className="w-4 h-4" />}
              label="Buy Volume"
              value={fmtCompact(data.totalBuyVolumeSol) + " SOL"}
              color="#22d3ee"
              delay={0.05}
            />
            <StatCard
              icon={<TrendingUp className="w-4 h-4" />}
              label="Sell Volume"
              value={fmtCompact(data.totalSellVolumeSol) + " SOL"}
              color="#f472b6"
              delay={0.1}
            />
            <StatCard
              icon={<MessageSquare className="w-4 h-4" />}
              label="Messages"
              value={data.totalMessages.toLocaleString()}
              sub={`${data.totalClips} clips`}
              color="#facc15"
              delay={0.15}
            />
          </div>

          {/* Treemap + Top Contributors / Pie */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Treemap */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white">Contribution Mindtree</h3>
                <span className="text-[10px] text-zinc-600 ml-1">Click a tile for details</span>
              </div>
              <MindTreeChart
                participants={data.participants}
                onSelect={setSelectedParticipant}
              />
            </div>

            {/* Right sidebar */}
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Crown className="w-4 h-4 text-yellow-400" />
                  <h3 className="text-sm font-bold text-white">Top Contributors</h3>
                </div>
                <TopContributors participants={data.participants} />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white">Volume Breakdown</h3>
                </div>
                <VolumeBreakdownPie
                  totalBuy={data.totalBuyVolumeSol}
                  totalSell={data.totalSellVolumeSol}
                />
              </div>
            </div>
          </div>

          {/* Participant Table */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-bold text-white">All Participants</h3>
              <span className="text-[10px] text-zinc-600 ml-1">
                {data.totalParticipants} total — click row for detail
              </span>
            </div>
            <ParticipantTable
              participants={data.participants}
              onSelect={setSelectedParticipant}
            />
          </div>
        </motion.div>
      )}

      {/* ── Participant Detail Drawer ── */}
      <ParticipantDrawer
        participant={selectedParticipant}
        onClose={() => setSelectedParticipant(null)}
      />

      {/* Overlay when drawer is open */}
      <AnimatePresence>
        {selectedParticipant && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedParticipant(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
