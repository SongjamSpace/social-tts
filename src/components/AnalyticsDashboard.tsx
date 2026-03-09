"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, DollarSign, Brain, Grid3X3, Link, Trophy, Percent, Zap, Users, MessageCircle, SlidersHorizontal, X, Radio } from "lucide-react";
import type { EChartsOption } from "echarts";
import LivePulse from "./LivePulse";
import {
  METRIC_LABELS,
  METRIC_UNITS,
  type MetricKey
} from "@/lib/dummyData";
import { type CreatorAggregate, type CreatorAggregateToken, type PumpFunCoin, type VolumeByWindow } from "@/types/pumpfun";
import DeployerDetail from "./DeployerDetail";

type ChartType = "treemap" | "bar" | "barH" | "pie" | "scatter" | "radar" | "sunburst" | "funnel" | "packed" | "line" | "heatmap";

const CHART_TYPES: { key: ChartType; label: string; icon: React.ReactNode }[] = [
  { key: "treemap", label: "Treemap", icon: <Grid3X3 className="w-3.5 h-3.5" /> },
];

const METRICS: { key: MetricKey; icon: React.ReactNode }[] = [
  { key: "totalVolume", icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { key: "totalMarketCap", icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { key: "totalAthMarketCap", icon: <Trophy className="w-3.5 h-3.5" /> },
  { key: "bonded", icon: <Link className="w-3.5 h-3.5" /> },
  { key: "bondRate", icon: <Percent className="w-3.5 h-3.5" /> },
  { key: "athEfficiency", icon: <Zap className="w-3.5 h-3.5" /> },
  { key: "followers", icon: <Users className="w-3.5 h-3.5" /> },
  { key: "engagement", icon: <MessageCircle className="w-3.5 h-3.5" /> },
  { key: "totalCreatorFees", icon: <DollarSign className="w-3.5 h-3.5" /> },
  { key: "mindshare", icon: <Brain className="w-3.5 h-3.5" /> },
];

/** Metrics not yet available — shown as disabled with "Coming soon" tooltip */
const DISABLED_METRICS: Set<MetricKey> = new Set(["mindshare", "totalVolume", "engagement", "totalCreatorFees"]);

/** Token Quality filters (Exclude NSFW, Exclude Banned, Min Replies, Min SOL Reserves, Min Liq. Ratio) only apply when using coin-level data. They do not affect these API-based metrics. */
const METRICS_TOKEN_QUALITY_DISABLED: Set<MetricKey> = new Set(["bonded", "totalMarketCap", "totalAthMarketCap", "bondRate", "athEfficiency"]);

/** Min Followers filter uses profile data (profileMap) which is only fetched for creators from allCoins. API-based metrics do not get this enrichment, so the filter is disabled for them. */
const METRICS_FOLLOWERS_DISABLED: Set<MetricKey> = new Set(["bonded", "totalMarketCap", "totalAthMarketCap", "bondRate", "athEfficiency"]);

/** Pump.fun creator avatar: IPFS gateway + creator address */
const PUMP_AVATAR_BASE = "https://pump.mypinata.cloud/ipfs/";
/** Fallback when creator avatar cannot be retrieved */
const PUMP_AVATAR_FALLBACK = "https://pump.mypinata.cloud/ipfs/QmeSzchzEPqCU1jwTnsipwcBAeH7S4bmVvFGfF65iA1BY1";
const MARKET_ACTIVITY_MINTS_CAP = 1500;

interface CoinFilters {
  athMarketCapMin: number | null;
  athMarketCapMax: number | null;
  marketCapMin: number | null;
  marketCapMax: number | null;
  bondedOnly: boolean;
  notBondedOnly: boolean;
  createdAfter: string;
  lastTradedAfter: string;
  minReplyCount: number | null;
  excludeNsfw: boolean;
  excludeBanned: boolean;
  minRealSolReserves: number | null;
  minLiquidityRatio: number | null;
  minTokenCount: number | null;
  maxTokenCount: number | null;
  minBondRate: number | null;
  hasPfpOnly: boolean;
  minFollowers: number | null;
}

const DEFAULT_FILTERS: CoinFilters = {
  athMarketCapMin: null,
  athMarketCapMax: null,
  marketCapMin: null,
  marketCapMax: null,
  bondedOnly: false,
  notBondedOnly: false,
  createdAfter: "",
  lastTradedAfter: "",
  minReplyCount: null,
  excludeNsfw: false,
  excludeBanned: false,
  minRealSolReserves: null,
  minLiquidityRatio: null,
  minTokenCount: null,
  maxTokenCount: null,
  minBondRate: null,
  hasPfpOnly: false,
  minFollowers: null,
};

// Slider ranges for filter panel
const MARKET_CAP_SLIDER_MAX = 5_000_000;
const MARKET_CAP_SLIDER_STEP = 50_000;
const ATH_MARKET_CAP_SLIDER_MAX = 10_000_000;
const ATH_MARKET_CAP_SLIDER_STEP = 100_000;
const TOKEN_COUNT_SLIDER_MAX = 10_000;
const BOND_RATE_SLIDER_MAX = 100;
const FOLLOWERS_SLIDER_MAX = 10_000;
const FOLLOWERS_SLIDER_STEP = 100;

const DUAL_RANGE_CSS = `
.dual-range { position: relative; height: 8px; }
.dual-range .track { position: absolute; inset: 0; border-radius: 9999px; background: rgba(255,255,255,0.1); }
.dual-range .fill { position: absolute; height: 100%; border-radius: 9999px; background: #f59e0b; }
.dual-range input[type="range"] {
  position: absolute; width: 100%; top: 0; height: 8px; margin: 0; padding: 0;
  -webkit-appearance: none; appearance: none; background: transparent; pointer-events: none; z-index: 2;
}
.dual-range input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none; height: 16px; width: 16px; border-radius: 50%;
  background: #f59e0b; border: 2px solid #111113; cursor: pointer; pointer-events: all;
  box-shadow: 0 0 4px rgba(0,0,0,0.4);
}
.dual-range input[type="range"]::-moz-range-thumb {
  height: 16px; width: 16px; border-radius: 50%;
  background: #f59e0b; border: 2px solid #111113; cursor: pointer; pointer-events: all;
  box-shadow: 0 0 4px rgba(0,0,0,0.4);
}
`;

function DualRangeSlider({ label, min, max, step, valueMin, valueMax, defaultMin, defaultMax, formatValue, onChange }: {
  label: string;
  min: number;
  max: number;
  step: number;
  valueMin: number | null;
  valueMax: number | null;
  defaultMin: number;
  defaultMax: number;
  formatValue: (v: number | null, isMax: boolean) => string;
  onChange: (lo: number | null, hi: number | null) => void;
}) {
  const lo = valueMin ?? defaultMin;
  const hi = valueMax ?? defaultMax;
  const leftPct = ((lo - min) / (max - min)) * 100;
  const rightPct = 100 - ((hi - min) / (max - min)) * 100;

  return (
    <div className="mb-1">
      <div className="flex justify-between text-zinc-500 mb-1.5">
        <span>{label}</span>
        <span className="font-mono text-white text-[10px]">
          {formatValue(valueMin, false)} – {formatValue(valueMax, true)}
        </span>
      </div>
      <div className="dual-range">
        <div className="track" />
        <div className="fill" style={{ left: `${leftPct}%`, right: `${rightPct}%` }} />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={lo}
          onChange={(e) => {
            const v = e.target.valueAsNumber;
            onChange(v <= defaultMin ? null : v, valueMax);
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={hi}
          onChange={(e) => {
            const v = e.target.valueAsNumber;
            onChange(valueMin, v >= defaultMax ? null : v);
          }}
        />
      </div>
    </div>
  );
}

function countActiveFilters(f: CoinFilters): number {
  let n = 0;
  if (f.athMarketCapMin != null) n++;
  if (f.athMarketCapMax != null) n++;
  if (f.marketCapMin != null) n++;
  if (f.marketCapMax != null) n++;
  if (f.bondedOnly) n++;
  if (f.notBondedOnly) n++;
  if (f.createdAfter) n++;
  if (f.lastTradedAfter) n++;
  if (f.minReplyCount != null) n++;
  if (f.excludeNsfw) n++;
  if (f.excludeBanned) n++;
  if (f.minRealSolReserves != null) n++;
  if (f.minLiquidityRatio != null) n++;
  if (f.minTokenCount != null) n++;
  if (f.maxTokenCount != null) n++;
  if (f.minBondRate != null) n++;
  if (f.hasPfpOnly) n++;
  if (f.minFollowers != null) n++;
  return n;
}

function passesCoinFilter(coin: any, f: CoinFilters): boolean {
  const ath = coin.ath_market_cap || 0;
  const mcap = coin.usd_market_cap || 0;
  if (f.athMarketCapMin != null && ath < f.athMarketCapMin) return false;
  if (f.athMarketCapMax != null && ath > f.athMarketCapMax) return false;
  if (f.marketCapMin != null && mcap < f.marketCapMin) return false;
  if (f.marketCapMax != null && mcap > f.marketCapMax) return false;
  if (f.bondedOnly && coin.complete !== true) return false;
  if (f.notBondedOnly && coin.complete === true) return false;
  if (f.createdAfter) {
    const raw = coin.created_timestamp || 0;
    const tsMs = raw > 1e12 ? raw : raw * 1000;
    if (tsMs < new Date(f.createdAfter).getTime()) return false;
  }
  if (f.lastTradedAfter) {
    const raw = coin.last_trade_timestamp || 0;
    const tsMs = raw > 1e12 ? raw : raw * 1000;
    if (tsMs < new Date(f.lastTradedAfter).getTime()) return false;
  }
  if (f.minReplyCount != null && (coin.reply_count || 0) < f.minReplyCount) return false;
  if (f.excludeNsfw && coin.nsfw === true) return false;
  if (f.excludeBanned && coin.is_banned === true) return false;
  if (f.minRealSolReserves != null && (coin.real_sol_reserves || 0) < f.minRealSolReserves) return false;
  if (f.minLiquidityRatio != null) {
    const virt = coin.virtual_sol_reserves || 0;
    const ratio = virt > 0 ? (coin.real_sol_reserves || 0) / virt : 0;
    if (ratio < f.minLiquidityRatio) return false;
  }
  return true;
}

function tokenPassesDateFilters(t: { created_timestamp?: number; last_trade_timestamp?: number }, f: CoinFilters): boolean {
  if (f.createdAfter) {
    const raw = t.created_timestamp ?? 0;
    const tsMs = raw > 1e12 ? raw : raw * 1000;
    if (tsMs < new Date(f.createdAfter).getTime()) return false;
  }
  if (f.lastTradedAfter) {
    const raw = t.last_trade_timestamp ?? 0;
    const tsMs = raw > 1e12 ? raw : raw * 1000;
    if (tsMs < new Date(f.lastTradedAfter).getTime()) return false;
  }
  return true;
}

/** True if this token's ATH and current mcap fall within the filter ranges (when set). Used to find creators that have at least one token in range. */
function tokenPassesMarketCapFilters(t: { ath_market_cap?: number; usd_market_cap?: number }, f: CoinFilters): boolean {
  const ath = t.ath_market_cap ?? t.usd_market_cap ?? 0;
  const mcap = t.usd_market_cap ?? 0;
  if (f.athMarketCapMin != null && ath < f.athMarketCapMin) return false;
  if (f.athMarketCapMax != null && ath > f.athMarketCapMax) return false;
  if (f.marketCapMin != null && mcap < f.marketCapMin) return false;
  if (f.marketCapMax != null && mcap > f.marketCapMax) return false;
  return true;
}

function passesCreatorFilter(d: CreatorAggregate, f: CoinFilters): boolean {
  if (f.athMarketCapMin != null || f.athMarketCapMax != null || f.marketCapMin != null || f.marketCapMax != null) {
    const tokens = [...(d.top_tokens ?? []), ...(d.bonded_tokens ?? [])];
    const hasTokenInRange = tokens.some((t) => tokenPassesMarketCapFilters(t, f));
    if (!hasTokenInRange) return false;
  }
  if (f.bondedOnly) {
    const tokens = [...(d.top_tokens ?? []), ...(d.bonded_tokens ?? [])];
    const hasBonded = tokens.some((t) => t.complete === true);
    if (!hasBonded) return false;
  }
  if (f.notBondedOnly) {
    const tokens = [...(d.top_tokens ?? []), ...(d.bonded_tokens ?? [])];
    const hasNotBonded = tokens.some((t) => t.complete !== true);
    if (!hasNotBonded) return false;
  }
  if (f.minTokenCount != null && d.token_count < f.minTokenCount) return false;
  if (f.maxTokenCount != null && d.token_count > f.maxTokenCount) return false;
  if (f.minBondRate != null) {
    const rate = d.token_count > 0 ? (d.bonded / d.token_count) * 100 : 0;
    if (rate < f.minBondRate) return false;
  }
  if (f.hasPfpOnly) {
    const avatarUrl = d.profile_image ?? d.avatar_url;
    if (!avatarUrl || avatarUrl === PUMP_AVATAR_FALLBACK || avatarUrl === pumpAvatarUrl(d.creator)) return false;
  }
  if (f.minFollowers != null && (d.followers_count ?? 0) < f.minFollowers) return false;
  if (f.createdAfter || f.lastTradedAfter) {
    const tokens = [...(d.top_tokens ?? []), ...(d.bonded_tokens ?? [])];
    const hasTokenPassing = tokens.some((t) => tokenPassesDateFilters(t, f));
    if (!hasTokenPassing) return false;
  }
  return true;
}

function pumpAvatarUrl(creatorAddress: string): string {
  return `${PUMP_AVATAR_BASE}${creatorAddress}`;
}

const circleAvatarCache = new Map<string, string>();

function circleAvatarDataUri(url: string, size: number): Promise<string> {
  const key = `${url}:${size}`;
  if (circleAvatarCache.has(key)) return Promise.resolve(circleAvatarCache.get(key)!);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, 0, 0, size, size);
      const dataUri = canvas.toDataURL("image/png");
      circleAvatarCache.set(key, dataUri);
      resolve(dataUri);
    };
    img.onerror = () => {
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, 0, 0, size, size);
        const dataUri = canvas.toDataURL("image/png");
        circleAvatarCache.set(key, dataUri);
        resolve(dataUri);
      };
      img.onerror = () => resolve("");
      img.src = PUMP_AVATAR_FALLBACK;
    };
    img.src = url;
  });
}

const sparklineCache = new Map<string, string>();

/** Sparkline size tiers so the line scales with rectangle size (value). */
const SPARKLINE_SIZES = {
  small: { width: 40, height: 10 },
  medium: { width: 56, height: 16 },
  large: { width: 72, height: 20 },
} as const;
type SparklineTier = keyof typeof SPARKLINE_SIZES;

function drawVolumeRampSparkline(
  volumeProfile: number[],
  width: number,
  height: number,
  lineColor: string
): string {
  const key = `${volumeProfile.join(",")}|${width}|${height}|${lineColor}`;
  if (sparklineCache.has(key)) return sparklineCache.get(key)!;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const max = Math.max(...volumeProfile, 1);
  const xs = [0.25, 0.5, 0.75, 1].map((t) => t * width);
  const ys = volumeProfile.map((v) => height * (1 - v / max));
  const lineWidth = Math.max(1, (width / 56) * 1.5);
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, height);
  for (let i = 0; i < 4; i++) ctx.lineTo(xs[i], ys[i]);
  ctx.stroke();
  const dataUri = canvas.toDataURL("image/png");
  sparklineCache.set(key, dataUri);
  return dataUri;
}

function fmtCompact(v: number | undefined | null): string {
  const n = v == null || Number.isNaN(v) ? 0 : Number(v);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function deployerColor(d: CreatorAggregate, maxMs: number): string {
  const norm = d.mindshare / maxMs;
  const r = Math.round(70 + norm * 169);
  const g = Math.round(20 + (1 - norm) * 20);
  const b = Math.round(60 + (1 - norm) * 140);
  return `rgb(${r},${g},${b})`;
}

const TOOLTIP_BASE = {
  backgroundColor: "#111113",
  borderColor: "rgba(255,255,255,0.08)",
  textStyle: { color: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 12 },
  extraCssText: "border-radius:12px;padding:12px 16px;box-shadow:0 8px 32px rgba(0,0,0,0.5)",
};

function richTooltip(d: CreatorAggregate): string {
  const avatarUrl = d.avatar_url || PUMP_AVATAR_FALLBACK;
  const avatar = `<img src="${avatarUrl}" onerror="this.src='${PUMP_AVATAR_FALLBACK}'" alt="" style="width:40px;height:40px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:10px" />`;
  const xLine = d.x_username ? `<span style="color:#a1a1aa">X:</span> @${d.x_username}<br/>` : "";
  const followLine = d.followers_count != null ? `<span style="color:#a1a1aa">Followers:</span> ${fmtCompact(d.followers_count)}<br/>` : "";
  return `<div style="font-family:'DM Sans',sans-serif;font-size:12px;line-height:1.6">
    <div style="margin-bottom:8px">${avatar}<strong style="font-size:14px;vertical-align:middle">${d.creator_display_name}</strong></div>
    ${xLine}${followLine}<span style="color:#a1a1aa">Market Cap:</span> $${fmtCompact(d.usd_market_cap)}<br/>
    <span style="color:#a1a1aa">ATH Market Cap:</span> $${fmtCompact(d.total_ath_market_cap)}<br/>
    <span style="color:#a1a1aa">Bonded:</span> ${d.bonded}<br/>
    <span style="color:#a1a1aa">Tokens:</span> ${d.token_count}<br/>
    <span style="color:#a1a1aa">Engagement:</span> ${Math.round((d.engagement ?? 0) * 100)}%
  </div>`;
}

/**
 * Generate a plausible dummy price curve anchored at currentMcap with a peak at athMcap.
 * Used for the "Latest Token" mini sparkline until real historical data is available.
 */
function generateDummyPriceCurve(currentMcap: number, athMcap: number, days = 14): number[] {
  const seed = Math.abs(Math.round(currentMcap * 7 + athMcap * 13)) % 1000;
  const rng = (i: number) => {
    const x = Math.sin(seed + i * 9301 + 49297) * 233280;
    return x - Math.floor(x);
  };
  const athDay = Math.floor(days * 0.25 + rng(0) * days * 0.45);
  const points: number[] = [];
  for (let i = 0; i < days; i++) {
    let base: number;
    if (i <= athDay) {
      const t = athDay > 0 ? i / athDay : 1;
      base = currentMcap * 0.3 + (athMcap - currentMcap * 0.3) * t;
    } else {
      const t = (days - 1 - athDay) > 0 ? (i - athDay) / (days - 1 - athDay) : 1;
      base = athMcap - (athMcap - currentMcap) * t;
    }
    points.push(Math.max(0, base * (0.92 + rng(i + 1) * 0.16)));
  }
  return points;
}

function formatRelativeTime(ts: number | undefined): string {
  if (!ts) return "—";
  const msTs = ts > 1e12 ? ts : ts * 1000;
  const ms = Date.now() - msTs;
  if (ms < 0) return "just now";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

function formatDate(ts: number | undefined): string {
  if (!ts) return "—";
  const msTs = ts > 1e12 ? ts : ts * 1000;
  return new Date(msTs).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

type MarketActivityEntry = { volume5m: number; volume1h: number; volume6h: number; volume24h: number };

function buildDrilldownOption(
  deployer: CreatorAggregate,
  mindshareMax: number,
  onBack: () => void,
  marketActivityMap?: Record<string, MarketActivityEntry>
): EChartsOption {
  const color = deployerColor(deployer, mindshareMax);
  const tokens = drilldownTokens(deployer);
  const tokenAth = (t: CreatorAggregateToken) => t.ath_market_cap || t.usd_market_cap || 0;
  const maxVal = Math.max(...tokens.map(tokenAth), 1);

  const socials: { label: string; url: string }[] = [];
  socials.push({ label: "pump.fun", url: `https://pump.fun/profile/${deployer.creator}` });
  socials.push({ label: "Solscan", url: `https://solscan.io/account/${deployer.creator}` });
  if (deployer.x_username) socials.push({ label: `@${deployer.x_username}`, url: `https://x.com/${deployer.x_username}` });
  else if (deployer.twitter_url) socials.push({ label: "X / Twitter", url: deployer.twitter_url });
  if (deployer.telegram_url) socials.push({ label: "Telegram", url: deployer.telegram_url });
  if (deployer.website_url) socials.push({ label: "Website", url: deployer.website_url });

  const metrics: { label: string; value: string }[] = [
    { label: "ATH Mcap", value: `$${fmtCompact(deployer.total_ath_market_cap)}` },
    { label: "Market Cap", value: `$${fmtCompact(deployer.usd_market_cap)}` },
    { label: "Bonded", value: deployer.bonded.toString() },
    { label: "Tokens", value: deployer.token_count.toString() },
    { label: "Engagement", value: `${Math.round((deployer.engagement ?? 0) * 100)}%` },
    { label: "Followers", value: fmtCompact(deployer.followers_count) },
    { label: "Following", value: fmtCompact(deployer.following_count) },
    { label: "Likes", value: fmtCompact(deployer.likes_received) },
    { label: "Mentions", value: fmtCompact(deployer.mentions_received) },
  ];

  const graphic: any[] = [];

  graphic.push({
    type: "text",
    left: 12,
    top: 10,
    style: {
      text: "\u2190  Back to Overview",
      fill: "rgba(255,255,255,0.5)",
      fontSize: 12,
      fontFamily: "'DM Sans', sans-serif",
      fontWeight: 600,
    },
    cursor: "pointer" as any,
    onclick: onBack,
    z: 100,
  });

  graphic.push({
    type: "group",
    left: 12,
    top: 38,
    clipPath: { type: "circle", shape: { cx: 22, cy: 22, r: 22 } },
    children: [
      {
        type: "image",
        style: { image: deployer.avatar_url || PUMP_AVATAR_FALLBACK, width: 44, height: 44 },
      },
    ],
    z: 100,
  });

  const pumpProfileUrl = `https://pump.fun/profile/${deployer.creator}`;

  graphic.push({
    type: "text",
    left: 64,
    top: 40,
    style: {
      text: deployer.creator_display_name,
      fill: "#fff",
      fontSize: 18,
      fontWeight: 700,
      fontFamily: "'DM Sans', sans-serif",
    },
    cursor: "pointer" as any,
    onclick: () => window.open(pumpProfileUrl, "_blank"),
    z: 100,
  });

  graphic.push({
    type: "text",
    left: 64,
    top: 62,
    style: {
      text: deployer.creator,
      fill: "rgba(255,255,255,0.35)",
      fontSize: 10,
      fontFamily: "'JetBrains Mono', monospace",
    },
    cursor: "pointer" as any,
    onclick: () => window.open(pumpProfileUrl, "_blank"),
    z: 100,
  });

  if (deployer.bio) {
    graphic.push({
      type: "text",
      left: 64,
      top: 78,
      style: {
        text: deployer.bio.length > 80 ? deployer.bio.slice(0, 80) + "…" : deployer.bio,
        fill: "rgba(255,255,255,0.3)",
        fontSize: 10,
        fontFamily: "'DM Sans', sans-serif",
      },
      z: 100,
    });
  }

  const socialsTop = deployer.bio ? 98 : 92;
  socials.forEach((s, i) => {
    graphic.push({
      type: "text",
      left: 12 + i * 100,
      top: socialsTop,
      style: {
        text: s.label,
        fill: "rgba(255,255,255,0.45)",
        fontSize: 11,
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: 600,
      },
      cursor: "pointer" as any,
      onclick: () => window.open(s.url, "_blank"),
      z: 100,
    });
  });

  const metricsTop = socialsTop + 26;
  const cardsPerRow = 5;
  const cardW = 92;
  const cardH = 46;
  const cardGap = 8;
  metrics.forEach((m, i) => {
    const col = i % cardsPerRow;
    const row = Math.floor(i / cardsPerRow);
    const xOffset = 12 + col * (cardW + cardGap);
    const yOffset = metricsTop + row * (cardH + 8);
    graphic.push({
      type: "group",
      left: xOffset,
      top: yOffset,
      children: [
        {
          type: "rect",
          shape: { width: cardW, height: cardH, r: 8 },
          style: { fill: "rgba(255,255,255,0.03)", stroke: "rgba(255,255,255,0.06)", lineWidth: 1 },
        },
        {
          type: "text",
          left: 10,
          top: 6,
          style: { text: m.label, fill: "rgba(255,255,255,0.4)", fontSize: 9, fontFamily: "'DM Sans', sans-serif", fontWeight: 700 },
        },
        {
          type: "text",
          left: 10,
          top: 22,
          style: { text: m.value, fill: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" },
        },
      ],
      z: 100,
    });
  });

  // --- Latest Token Panel (right half of header area) ---
  // Uses ~48% of the canvas width, positioned above the bar chart (within the 240px top zone).
  // Left column: token identity + stats.  Right column: sparkline chart.
  const allTokensSorted = [...deployer.top_tokens].sort(
    (a, b) => (b.created_timestamp || 0) - (a.created_timestamp || 0)
  );
  const latest = allTokensSorted[0] as CreatorAggregateToken | undefined;

  const PANEL_RIGHT = 16;
  const PANEL_TOP = 10;
  const PANEL_H = 220;

  if (latest) {
    const latestAth = latest.ath_market_cap || latest.usd_market_cap || 0;
    const latestMcap = latest.usd_market_cap || 0;
    const athRatio = latestAth > 0 ? latestMcap / latestAth : 0;
    const healthColor = athRatio > 0.5 ? "#22c55e" : athRatio > 0.2 ? "#eab308" : "#ef4444";
    const bondedSymbol = latest.complete ? "✓ Bonded" : "✗ Not Bonded";
    const bondedBadgeColor = latest.complete ? "#22c55e" : "rgba(255,255,255,0.3)";
    const tokenImgUrl = latest.image_uri || PUMP_AVATAR_FALLBACK;

    const statRows: { label: string; value: string; color?: string }[] = [
      { label: "Deployed", value: formatDate(latest.created_timestamp) },
      { label: "Time Ago", value: formatRelativeTime(latest.created_timestamp) },
      { label: "ATH Market Cap", value: `$${fmtCompact(latestAth)}` },
      { label: "Current Mcap", value: `$${fmtCompact(latestMcap)}`, color: healthColor },
      { label: "Last Traded", value: formatRelativeTime(latest.last_trade_timestamp) },
    ];

    const linkItems: { label: string; url: string }[] = [];
    if (latest.mint) linkItems.push({ label: "pump.fun", url: `https://pump.fun/coin/${latest.mint}` });
    if (latest.twitter) linkItems.push({ label: "X / Twitter", url: latest.twitter.startsWith("http") ? latest.twitter : `https://x.com/${latest.twitter}` });

    const panelChildren: any[] = [];

    panelChildren.push({
      type: "text", left: 12, top: 10,
      style: { text: "LATEST TOKEN", fill: "rgba(255,255,255,0.35)", fontSize: 9, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", letterSpacing: 1.2 },
    });

    panelChildren.push({
      type: "group", left: 12, top: 28,
      clipPath: { type: "circle", shape: { cx: 16, cy: 16, r: 16 } },
      children: [{ type: "image", style: { image: tokenImgUrl, width: 32, height: 32 } }],
    });

    panelChildren.push({
      type: "text", left: 52, top: 28,
      style: { text: latest.name || "Unknown", fill: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "'DM Sans', sans-serif" },
      cursor: latest.mint ? ("pointer" as any) : undefined,
      onclick: latest.mint ? () => window.open(`https://pump.fun/coin/${latest.mint}`, "_blank") : undefined,
    });

    panelChildren.push({
      type: "text", left: 52, top: 46,
      style: { text: `$${latest.symbol || "UNK"}`, fill: "rgba(255,255,255,0.4)", fontSize: 11, fontFamily: "'DM Sans', sans-serif" },
    });

    panelChildren.push({
      type: "text", left: 160, top: 32,
      style: { text: bondedSymbol, fill: bondedBadgeColor, fontSize: 10, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" },
    });

    statRows.forEach((row, i) => {
      const y = 68 + i * 18;
      panelChildren.push({
        type: "text", left: 12, top: y,
        style: { text: row.label, fill: "rgba(255,255,255,0.35)", fontSize: 10, fontFamily: "'DM Sans', sans-serif" },
      });
      panelChildren.push({
        type: "text", left: 120, top: y,
        style: { text: row.value, fill: row.color || "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" },
      });
    });

    if (latest.description) {
      panelChildren.push({
        type: "text", left: 12, top: 162,
        style: { text: latest.description.length > 70 ? latest.description.slice(0, 70) + "…" : latest.description, fill: "rgba(255,255,255,0.25)", fontSize: 9, fontFamily: "'DM Sans', sans-serif" },
      });
    }

    linkItems.forEach((lk, i) => {
      panelChildren.push({
        type: "text", left: 12 + i * 90, top: 180,
        style: { text: lk.label, fill: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" },
        cursor: "pointer" as any,
        onclick: () => window.open(lk.url, "_blank"),
      });
    });

    panelChildren.push({
      type: "text", left: 320, top: 10,
      style: { text: "24H VOLUME", fill: "rgba(255,255,255,0.25)", fontSize: 8, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", letterSpacing: 0.8 },
    });

    // Panel background
    graphic.push({
      type: "rect",
      left: "52%",
      right: PANEL_RIGHT,
      top: PANEL_TOP,
      shape: { height: PANEL_H, r: 12 },
      style: { fill: "rgba(255,255,255,0.02)", stroke: "rgba(255,255,255,0.06)", lineWidth: 1 },
      z: 99,
    });

    // Panel content group — offset 1% right of the panel edge for padding
    graphic.push({
      type: "group",
      left: "53%",
      top: PANEL_TOP + 4,
      children: panelChildren,
      z: 100,
    });
  }

  // Volume ramp for latest token (same 4 bands as treemap sparklines): [6h→24h, 1h→6h, 5m→1h, 5m]
  const latestMint = latest?.mint;
  const act = latestMint && marketActivityMap ? marketActivityMap[latestMint] : undefined;
  const volumeProfile = act
    ? [
        Math.max(0, act.volume24h - act.volume6h),
        Math.max(0, act.volume6h - act.volume1h),
        Math.max(0, act.volume1h - act.volume5m),
        act.volume5m,
      ]
    : [0, 0, 0, 0];
  const volumeLabels = ["6h→24h", "1h→6h", "5m→1h", "5m"];
  const hasVolume = volumeProfile.some((v) => v > 0);
  const latestAthVal = latest ? (latest.ath_market_cap || latest.usd_market_cap || 0) : 0;
  const latestMcapVal = latest ? (latest.usd_market_cap || 0) : 0;
  const sparkHealthRatio = latestAthVal > 0 ? latestMcapVal / latestAthVal : 0;
  const sparkColor = sparkHealthRatio > 0.5 ? "#22c55e" : sparkHealthRatio > 0.2 ? "#eab308" : "#ef4444";

  return {
    animation: true,
    animationDurationUpdate: 700,
    animationEasingUpdate: "cubicOut",
    backgroundColor: "#060608",
    graphic,
    tooltip: [
      {
        ...TOOLTIP_BASE,
        formatter: (params: any) => {
          const t = params.data?.token;
          if (!t) return params.name || "";
          const ath = t.ath_market_cap || t.usd_market_cap || 0;
          return `<div style="font-family:'DM Sans',sans-serif;font-size:12px;line-height:1.6">
            <strong style="font-size:14px">${t.name}</strong> <span style="color:#a1a1aa">${t.symbol}</span><br/>
            <span style="color:#a1a1aa">ATH Market Cap:</span> $${fmtCompact(ath)}<br/>
            <span style="color:#a1a1aa">Current Market Cap:</span> $${fmtCompact(t.usd_market_cap)}<br/>
            <span style="color:#a1a1aa">Bonded:</span> ${t.complete ? "Yes" : "No"}
          </div>`;
        },
      },
      {
        ...TOOLTIP_BASE,
        formatter: (params: any) => {
          if (params.seriesIndex === 1) {
            const band = volumeLabels[params.dataIndex];
            return `<span style="font-family:'DM Sans',sans-serif;font-size:11px">${band}</span><br/><span style="font-family:'JetBrains Mono',monospace;font-size:11px">$${fmtCompact(params.value)}</span>`;
          }
          return "";
        },
      },
    ] as any,
    grid: [
      { left: 80, right: 20, top: 240, bottom: 40 },
      { left: "77%", right: PANEL_RIGHT + 16, top: PANEL_TOP + 32, height: PANEL_H - 52 },
    ],
    xAxis: [
      {
        type: "category" as const,
        gridIndex: 0,
        data: tokens.map((t) => t.symbol),
        axisLabel: { color: "#71717a", fontFamily: "'DM Sans', sans-serif", fontSize: 11, rotate: tokens.length > 6 ? 25 : 0 },
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
      },
      {
        type: "category" as const,
        gridIndex: 1,
        data: volumeLabels,
        show: false,
      },
    ],
    yAxis: [
      {
        type: "value" as const,
        gridIndex: 0,
        name: "ATH Market Cap (USD)",
        nameTextStyle: { color: "#71717a", fontSize: 10 },
        axisLabel: {
          color: "#71717a",
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 11,
          formatter: (v: number) => `$${fmtCompact(v)}`,
        },
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.04)" } },
      },
      {
        type: "value" as const,
        gridIndex: 1,
        show: false,
      },
    ],
    series: [
      {
        type: "bar",
        id: "tokens",
        xAxisIndex: 0,
        yAxisIndex: 0,
        universalTransition: { enabled: true, divideShape: "clone" },
        animationDurationUpdate: 400,
        animationDelayUpdate: 150,
        barMaxWidth: 50,
        data: tokens.map((t) => {
          const ath = tokenAth(t);
          return {
            name: t.symbol,
            value: ath,
            token: t,
            id: `${deployer.creator}-${t.symbol}`,
            groupId: deployer.creator,
            itemStyle: {
              color,
              borderRadius: [4, 4, 0, 0],
              opacity: 0.6 + 0.4 * (ath / maxVal),
            },
          };
        }),
        label: {
          show: true,
          position: "top" as const,
          formatter: (p: any) => `$${fmtCompact(p.value)}`,
          color: "rgba(255,255,255,0.5)",
          fontSize: 10,
          fontFamily: "'JetBrains Mono', monospace",
        },
      },
      ...(latest ? [{
        type: "line" as const,
        id: "sparkline",
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: volumeProfile,
        smooth: true,
        showSymbol: hasVolume,
        symbolSize: 6,
        lineStyle: { color: sparkColor, width: 1.5 },
        areaStyle: hasVolume ? {
          color: {
            type: "linear" as const,
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: sparkColor.replace(")", ",0.3)").replace("rgb", "rgba") },
              { offset: 1, color: sparkColor.replace(")", ",0.02)").replace("rgb", "rgba") },
            ],
          },
        } : undefined,
        animationDuration: 1000,
        animationDelay: 600,
        z: 90,
      }] : []),
    ],
  };
}

/** Resolve which token list to display in drilldown: bonded tokens if any, otherwise top tokens. */
function drilldownTokens(deployer: CreatorAggregate): CreatorAggregateToken[] {
  return deployer.bonded_tokens.length > 0 ? deployer.bonded_tokens : deployer.top_tokens;
}

/** Shared children data for Phase 1 and Phase 2 — same ids so ECharts animates between them seamlessly. */
function expandChildren(deployer: CreatorAggregate, color: string) {
  return drilldownTokens(deployer).map((t) => ({
    id: `${deployer.creator}-${t.symbol}`,
    groupId: deployer.creator,
    name: t.symbol,
    value: t.ath_market_cap || t.usd_market_cap,
    itemStyle: { color, borderRadius: 0 },
  }));
}

/** Phase 1: clicked deployer rectangle expands to fill the entire canvas (1:1 morph).
 *  Uses deployer color as backgroundColor (same as Phase 2) to prevent blink.
 *  A dark graphic rect behind the treemap simulates the dark background during expansion. */
function buildExpandOption(deployer: CreatorAggregate, mindshareMax: number): EChartsOption {
  const color = deployerColor(deployer, mindshareMax);
  return {
    animation: true,
    animationDurationUpdate: 700,
    animationEasingUpdate: "cubicOut",
    backgroundColor: color,
    tooltip: { show: false },
    graphic: [{
      type: "rect",
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      shape: { r: 0 },
      style: { fill: "#060608" },
      silent: true,
      z: 0,
    }],
    series: [{
      type: "treemap",
      id: "tokens",
      universalTransition: { enabled: true },
      roam: false,
      nodeClick: false as any,
      breadcrumb: { show: false },
      animationDurationUpdate: 700,
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      itemStyle: { borderColor: "#060608", borderWidth: 4, gapWidth: 4 },
      label: { show: false },
      data: [{
        id: deployer.creator,
        name: deployer.creator_display_name,
        value: 1,
        itemStyle: { color, borderRadius: 0 },
      }] as any,
    }],
  };
}

/** Phase 2: same children, now with gaps and borders — they visually split apart from the solid block. */
function buildSplitOption(deployer: CreatorAggregate, mindshareMax: number): EChartsOption {
  const color = deployerColor(deployer, mindshareMax);
  return {
    animation: true,
    animationDurationUpdate: 700,
    animationEasingUpdate: "cubicOut",
    backgroundColor: color,
    tooltip: { show: false },
    graphic: [{
      type: "rect",
      left: 4,
      top: 4,
      right: 4,
      bottom: 4,
      shape: { r: 0 },
      style: { fill: color },
      silent: true,
      z: 0,
    }],
    series: [{
      type: "treemap",
      id: "tokens",
      universalTransition: { enabled: true, divideShape: "clone" },
      roam: false,
      nodeClick: false as any,
      breadcrumb: { show: false },
      animationDurationUpdate: 700,
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      itemStyle: { borderColor: "#060608", borderWidth: 4, gapWidth: 4 },
      label: { show: false },
      data: expandChildren(deployer, color).map((c) => ({
        ...c,
        itemStyle: { ...c.itemStyle, borderRadius: 6 },
      })) as any,
    }],
  };
}

function buildParticleOption(mindshareMax: number, deployers: CreatorAggregate[]): EChartsOption {
  const centerX = 500;
  const centerY = 500;
  const data: { value: [number, number]; groupId: string; itemStyle: { color: string } }[] = [];
  const particlesPerDeployer = Math.max(6, Math.min(10, Math.floor(200 / Math.max(1, deployers.length))));
  deployers.forEach((d) => {
    const color = deployerColor(d, mindshareMax);
    for (let i = 0; i < particlesPerDeployer; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 80 + Math.random() * 320;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      data.push({
        value: [x, y],
        groupId: d.creator,
        itemStyle: { color },
      });
    }
  });
  return {
    animation: true,
    animationDuration: 800,
    animationEasing: "cubicOut",
    animationDelay: (idx: number) => idx * 2,
    backgroundColor: "#060608",
    tooltip: { show: false },
    xAxis: { type: "value", min: 0, max: 1000, show: false },
    yAxis: { type: "value", min: 0, max: 1000, show: false },
    grid: { left: 0, right: 0, top: 0, bottom: 0 },
    series: [{
      type: "scatter",
      id: "tokens",
      universalTransition: { enabled: true },
      coordinateSystem: "cartesian2d",
      data,
      symbolSize: 5,
    }],
  };
}

function buildOption(chartType: ChartType, metric: MetricKey, mindshareMax: number, deployers: CreatorAggregate[], circleAvatars?: Record<string, string>, sparklineDataUrls?: Record<string, Record<SparklineTier, string>>): EChartsOption {
  const unit = METRIC_UNITS[metric];
  
  // Map MetricKey properly since properties were renamed
  const getMetricValue = (d: CreatorAggregate) => {
    switch (metric) {
      case "totalVolume": return d.volume;
      case "totalMarketCap": return d.usd_market_cap;
      case "totalAthMarketCap": return d.total_ath_market_cap;
      case "bonded": return d.bonded;
      case "bondRate": return d.token_count > 0 ? Math.round((d.bonded / d.token_count) * 100) : 0;
      case "athEfficiency": return d.token_count > 0 ? Math.round(d.total_ath_market_cap / d.token_count) : 0;
      case "followers": return d.followers_count ?? 0;
      case "engagement": return Math.round((d.engagement ?? 0) * 100);
      case "totalCreatorFees": return d.creator_fees;
      case "mindshare": return d.mindshare;
      default: return 0;
    }
  };

  const sorted = [...deployers].sort((a, b) => getMetricValue(b) - getMetricValue(a));
  const top15 = sorted.slice(0, 15);
  const colors = sorted.map((d) => deployerColor(d, mindshareMax));
  const top15Colors = top15.map((d) => deployerColor(d, mindshareMax));

  const commonTooltip = {
    ...TOOLTIP_BASE,
    formatter: (params: any) => {
      const d = (params.data?.deployer ?? params.data?.source) as CreatorAggregate | undefined;
      if (d) return richTooltip(d);
      if (params.name) {
        const found = deployers.find((dd) => dd.creator_display_name === params.name);
        if (found) return richTooltip(found);
      }
      return "";
    },
  };

  const axisStyle = {
    axisLabel: { color: "#71717a", fontFamily: "'DM Sans', sans-serif", fontSize: 11 },
    axisLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
    splitLine: { lineStyle: { color: "rgba(255,255,255,0.04)" } },
  };

  switch (chartType) {
    case "treemap":
      return {
        animation: true,
        animationDurationUpdate: 700,
        animationEasingUpdate: "cubicOut",
        backgroundColor: "#060608",
        tooltip: {
          ...TOOLTIP_BASE,
          formatter: (params: any) => {
            const d = params.data?.deployer as CreatorAggregate | undefined;
            if (d) return richTooltip(d);
            const t = params.data?.token;
            if (t) {
              return `<div style="font-family:'DM Sans',sans-serif;font-size:12px;line-height:1.6">
                <strong style="font-size:14px">${t.name}</strong> <span style="color:#a1a1aa">${t.symbol}</span><br/>
                <span style="color:#a1a1aa">Market Cap:</span> ${fmtCompact(t.usd_market_cap)} SOL<br/>
                <span style="color:#a1a1aa">24h Vol:</span> $${fmtCompact(t.volume)} USD
              </div>`;
            }
            return "";
          },
        },
        series: [{
          type: "treemap",
          id: "tokens",
          universalTransition: { enabled: true },
          roam: false,
          nodeClick: false as any,
          breadcrumb: { show: false },
          animationDurationUpdate: 700,
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          itemStyle: { borderColor: "#060608", borderWidth: 2, gapWidth: 2 },
          label: (() => {
            const rich: Record<string, object> = {
              name: { fontSize: 12, fontWeight: 700, color: "#fff", lineHeight: 22, fontFamily: "'DM Sans', sans-serif" },
              val: { fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 16, fontFamily: "'JetBrains Mono', monospace" },
              tokens: { fontSize: 10, color: "rgba(255,255,255,0.35)", lineHeight: 16, fontFamily: "'DM Sans', sans-serif" },
              sym: { fontSize: 13, fontWeight: 700, color: "#fff", lineHeight: 20, fontFamily: "'DM Sans', sans-serif" },
              mcap: { fontSize: 11, color: "rgba(255,255,255,0.6)", lineHeight: 16, fontFamily: "'JetBrains Mono', monospace" },
              vol: { fontSize: 10, color: "rgba(255,255,255,0.35)", lineHeight: 14, fontFamily: "'JetBrains Mono', monospace" },
            };
            deployers.forEach((d, i) => {
              const circleUri = circleAvatars?.[d.creator];
              if (circleUri) {
                rich[`av${i}`] = { width: 22, height: 22, backgroundColor: { image: circleUri } as any };
              } else {
                const url = d.avatar_url || PUMP_AVATAR_FALLBACK;
                rich[`av${i}`] = { width: 22, height: 22, borderRadius: 11, backgroundColor: { image: url } as any };
              }
            });
            const top20ByValue = [...deployers]
              .map((d, i) => ({ d, i }))
              .sort((a, b) => getMetricValue(b.d) - getMetricValue(a.d))
              .slice(0, 20);
            const top20Indices = new Set(top20ByValue.map((x) => x.i));
            top20ByValue.forEach(({ d, i }, rank) => {
              const urls = sparklineDataUrls?.[d.creator];
              if (!urls) return;
              const tier: SparklineTier = rank < 7 ? "large" : rank < 14 ? "medium" : "small";
              const size = SPARKLINE_SIZES[tier];
              rich[`spark${i}`] = { width: size.width, height: size.height, backgroundColor: { image: urls[tier] } as any };
            });
            return {
              show: true,
              position: "insideTopLeft" as any,
              formatter: (p: any) => {
                const d = p.data?.deployer as CreatorAggregate | undefined;
                const idx = p.data?.deployerIndex as number | undefined;
                if (d != null && typeof idx === "number") {
                  const val = p.value ?? getMetricValue(d);
                  const line1 = `{av${idx}| }  {name|${d.creator_display_name}}\n{val|${fmtCompact(val)}${unit ? " " + unit : ""}}  ·  {tokens|${d.token_count} tokens}`;
                  const showSpark = top20Indices.has(idx) && sparklineDataUrls?.[d.creator] != null;
                  return showSpark ? `${line1}\n{spark${idx}| }` : line1;
                }
                const t = p.data?.token;
                if (t) return `{sym|${t.symbol}}\n{mcap|${fmtCompact(t.usd_market_cap)} SOL}\n{vol|24h Vol: $${fmtCompact(t.volume)} USD}`;
                return p.name || "";
              },
              rich,
              padding: [6, 8],
            };
          })(),
          data: deployers.map((d, deployerIndex) => {
            const baseColor = deployerColor(d, mindshareMax);
            return {
              id: d.creator,
              name: d.creator_display_name,
              value: getMetricValue(d),
              deployer: d,
              deployerIndex,
              itemStyle: { color: baseColor, borderRadius: 6 },
            };
          }),
        }],
      };

    case "bar":
      return {
        tooltip: commonTooltip,
        grid: { left: 60, right: 20, top: 20, bottom: 60 },
        xAxis: { type: "category" as const, data: top15.map((d) => d.creator_display_name), axisLabel: { ...axisStyle.axisLabel, rotate: 35 }, axisLine: axisStyle.axisLine },
        yAxis: { type: "value" as const, ...axisStyle },
        series: [{
          type: "bar",
          data: top15.map((d, i) => ({ value: getMetricValue(d), deployer: d, itemStyle: { color: top15Colors[i], borderRadius: [4, 4, 0, 0] } })),
          barMaxWidth: 40,
        }],
      };

    case "barH":
      return {
        tooltip: commonTooltip,
        grid: { left: 120, right: 30, top: 10, bottom: 20 },
        yAxis: { type: "category" as const, data: top15.map((d) => d.creator_display_name).reverse(), axisLabel: axisStyle.axisLabel, axisLine: axisStyle.axisLine },
        xAxis: { type: "value" as const, ...axisStyle },
        series: [{
          type: "bar",
          data: [...top15].reverse().map((d, i) => ({ value: getMetricValue(d), deployer: d, itemStyle: { color: top15Colors[top15.length - 1 - i], borderRadius: [0, 4, 4, 0] } })),
          barMaxWidth: 28,
        }],
      };

    case "pie":
      return {
        tooltip: commonTooltip,
        series: [{
          type: "pie",
          radius: ["35%", "70%"],
          center: ["50%", "50%"],
          label: { color: "#d4d4d8", fontSize: 11, fontFamily: "'DM Sans', sans-serif" },
          itemStyle: { borderColor: "#060608", borderWidth: 2 },
          data: top15.map((d, i) => ({
            name: d.creator_display_name,
            value: getMetricValue(d),
            deployer: d,
            itemStyle: { color: top15Colors[i] },
          })),
        }],
      };

    case "scatter":
      return {
        tooltip: {
          ...TOOLTIP_BASE,
          formatter: (params: any) => {
            const d = params.data?.[3] as CreatorAggregate | undefined;
            return d ? richTooltip(d) : "";
          },
        },
        grid: { left: 60, right: 30, top: 30, bottom: 50 },
        xAxis: { type: "value" as const, name: "24h Volume (USD)", nameTextStyle: { color: "#71717a", fontSize: 10 }, ...axisStyle },
        yAxis: { type: "value" as const, name: "Market Cap (SOL)", nameTextStyle: { color: "#71717a", fontSize: 10 }, ...axisStyle },
        series: [{
          type: "scatter",
          symbolSize: (data: any) => Math.max(8, Math.sqrt(data[2]) * 1.5),
          data: deployers.map((d) => [d.volume, d.usd_market_cap, d.creator_fees, d]) as any,
          itemStyle: { color: (params: any) => { const dd = params.data?.[3] as CreatorAggregate; return dd ? deployerColor(dd, mindshareMax) : "#ef4444"; } },
        }],
      };

    case "radar": {
      const radarTop = top15.slice(0, 8);
      const maxVol = Math.max(...radarTop.map((d) => d.volume));
      const maxMcap = Math.max(...radarTop.map((d) => d.usd_market_cap));
      const maxFees = Math.max(...radarTop.map((d) => d.creator_fees));
      const maxTokens = Math.max(...radarTop.map((d) => d.token_count));
      const maxMs = Math.max(...radarTop.map((d) => d.mindshare));
      return {
        tooltip: commonTooltip,
        legend: { data: radarTop.map((d) => d.creator_display_name), bottom: 0, textStyle: { color: "#71717a", fontSize: 10 } },
        radar: {
          indicator: [
            { name: "24h Vol", max: maxVol },
            { name: "Mkt Cap", max: maxMcap },
            { name: "Fees", max: maxFees },
            { name: "Tokens", max: maxTokens },
            { name: "Mindshare", max: maxMs },
          ],
          axisName: { color: "#a1a1aa", fontSize: 11 },
          splitArea: { areaStyle: { color: ["rgba(255,255,255,0.01)", "rgba(255,255,255,0.02)"] } },
          splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
          axisLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
        },
        series: [{
          type: "radar",
          data: radarTop.map((d, i) => ({
            name: d.creator_display_name,
            value: [d.volume, d.usd_market_cap, d.creator_fees, d.token_count, d.mindshare],
            deployer: d,
            lineStyle: { color: deployerColor(d, mindshareMax) },
            itemStyle: { color: deployerColor(d, mindshareMax) },
            areaStyle: { color: deployerColor(d, mindshareMax), opacity: 0.1 },
          })),
        }],
      };
    }

    case "sunburst":
      return {
        tooltip: commonTooltip,
        series: [{
          type: "sunburst",
          radius: ["15%", "90%"],
          label: { color: "#fff", fontSize: 10, fontFamily: "'DM Sans', sans-serif", rotate: 0 },
          itemStyle: { borderColor: "#060608", borderWidth: 2 },
          data: top15.map((d, i) => ({
            name: d.creator_display_name,
            value: getMetricValue(d),
            deployer: d,
            itemStyle: { color: top15Colors[i] },
            children: d.top_tokens.map((t) => ({
              name: t.symbol,
              value: t.usd_market_cap,
              itemStyle: { color: top15Colors[i], opacity: 0.7 },
            })),
          })),
        }],
      };

    case "funnel":
      return {
        tooltip: commonTooltip,
        series: [{
          type: "funnel",
          left: "10%",
          width: "80%",
          top: 20,
          bottom: 20,
          sort: "descending" as const,
          label: { show: true, position: "inside" as const, color: "#fff", fontSize: 12, fontFamily: "'DM Sans', sans-serif" },
          itemStyle: { borderColor: "#060608", borderWidth: 1 },
          data: top15.slice(0, 10).map((d, i) => ({
            name: d.creator_display_name,
            value: getMetricValue(d),
            deployer: d,
            itemStyle: { color: top15Colors[i] },
          })),
        }],
      };

    case "line":
      return {
        tooltip: commonTooltip,
        grid: { left: 60, right: 20, top: 20, bottom: 40 },
        xAxis: { type: "category" as const, data: top15.map((_, i) => `#${i + 1}`), axisLabel: axisStyle.axisLabel, axisLine: axisStyle.axisLine },
        yAxis: { type: "value" as const, ...axisStyle },
        series: [{
          type: "line",
          smooth: true,
          symbol: "circle",
          symbolSize: 10,
          lineStyle: { color: "#ef4444", width: 2 },
          areaStyle: { color: { type: "linear" as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(239,68,68,0.25)" }, { offset: 1, color: "rgba(239,68,68,0)" }] } },
          data: top15.map((d, i) => ({ value: getMetricValue(d), deployer: d, itemStyle: { color: top15Colors[i] } })),
        }],
      };

    default:
      return {};
  }
}

const ECHARTS_MODULES: Record<ChartType, () => Promise<any[]>> = {
  treemap: async () => {
    const { TreemapChart } = await import("echarts/charts");
    return [TreemapChart];
  },
  bar: async () => {
    const { BarChart } = await import("echarts/charts");
    const { GridComponent } = await import("echarts/components");
    return [BarChart, GridComponent];
  },
  barH: async () => {
    const { BarChart } = await import("echarts/charts");
    const { GridComponent } = await import("echarts/components");
    return [BarChart, GridComponent];
  },
  pie: async () => {
    const { PieChart: PChart } = await import("echarts/charts");
    return [PChart];
  },
  scatter: async () => {
    const { ScatterChart: SChart } = await import("echarts/charts");
    const { GridComponent } = await import("echarts/components");
    return [SChart, GridComponent];
  },
  radar: async () => {
    const { RadarChart } = await import("echarts/charts");
    const { RadarComponent, LegendComponent } = await import("echarts/components");
    return [RadarChart, RadarComponent, LegendComponent];
  },
  sunburst: async () => {
    const { SunburstChart } = await import("echarts/charts");
    return [SunburstChart];
  },
  funnel: async () => {
    const { FunnelChart } = await import("echarts/charts");
    return [FunnelChart];
  },
  packed: async () => {
    const { TreemapChart } = await import("echarts/charts");
    return [TreemapChart];
  },
  line: async () => {
    const { LineChart } = await import("echarts/charts");
    const { GridComponent } = await import("echarts/components");
    return [LineChart, GridComponent];
  },
  heatmap: async () => {
    const { BarChart } = await import("echarts/charts");
    const { GridComponent } = await import("echarts/components");
    return [BarChart, GridComponent];
  },
};

function EChartsWrapper({ option, chartType, onChartClick, onTokenClick, onChartReady }: { option: EChartsOption; chartType: ChartType; onChartClick?: (d: CreatorAggregate) => void; onTokenClick?: (t: CreatorAggregateToken) => void; onChartReady?: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const echartsRef = useRef<any>(null);
  const onChartClickRef = useRef(onChartClick);
  onChartClickRef.current = onChartClick;
  const onTokenClickRef = useRef(onTokenClick);
  onTokenClickRef.current = onTokenClick;
  const onChartReadyRef = useRef(onChartReady);
  onChartReadyRef.current = onChartReady;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [echartsCore, componentsModule, { CanvasRenderer }] = await Promise.all([
        import("echarts/core"),
        import("echarts/components"),
        import("echarts/renderers"),
      ]);
      const { UniversalTransition } = await import("echarts/features");

      echartsCore.use([componentsModule.TooltipComponent, componentsModule.GraphicComponent, componentsModule.GridComponent, CanvasRenderer, UniversalTransition]);

      const allMods = await Promise.all(Object.values(ECHARTS_MODULES).map((fn) => fn()));
      for (const mods of allMods) echartsCore.use(mods);

      if (cancelled) return;
      echartsRef.current = echartsCore;
      setReady(true);
      onChartReadyRef.current?.();
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready || !containerRef.current || !echartsRef.current) return;

    if (!instanceRef.current) {
      instanceRef.current = echartsRef.current.init(containerRef.current, undefined, { renderer: "canvas" });
      instanceRef.current.on("click", (params: any) => {
        const t = params.data?.token as CreatorAggregateToken | undefined;
        if (t && typeof t === "object" && "symbol" in t) {
          onTokenClickRef.current?.(t);
          return;
        }
        const d = (params.data?.deployer ?? params.data?.source ?? params.data?.[3]) as CreatorAggregate | undefined;
        if (d && typeof d === "object" && "creator" in d) onChartClickRef.current?.(d);
      });
    }

    instanceRef.current.setOption(option, {
      notMerge: false,
      replaceMerge: ["series", "grid", "xAxis", "yAxis", "graphic"],
      lazyUpdate: false,
    });
  }, [ready, option]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance) return;
    const ro = new ResizeObserver(() => instance.resize());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [ready]);

  useEffect(() => {
    return () => { instanceRef.current?.dispose(); };
  }, []);

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
        Loading chart…
      </div>
    );
  }

  return <div ref={containerRef} style={{ height: "100%", width: "100%" }} />;
}

function fmtDate(ts?: number): string {
  if (!ts) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(ts));
}

function TokenDetailPanel({ token, onClose }: { token: CreatorAggregateToken | null; onClose: () => void }) {
  if (!token) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-md mx-4 rounded-2xl border border-white/10 bg-[#111113] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with image */}
        <div className="flex items-start gap-4 p-5 pb-3">
          {token.image_uri ? (
            <img
              src={token.image_uri}
              alt={token.name}
              className="w-16 h-16 rounded-xl object-cover border border-white/10 shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-600 text-xs shrink-0">
              No img
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-white truncate">{token.name}</h3>
            <p className="text-sm text-zinc-400 font-mono">{token.symbol}</p>
            {token.mint && (
              <a
                href={`https://pump.fun/coin/${token.mint}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-mono text-zinc-500 hover:text-blue-400 transition-colors"
              >
                {token.mint.slice(0, 8)}...{token.mint.slice(-6)}
              </a>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors text-lg leading-none p-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Description */}
        {token.description && (
          <p className="px-5 pb-3 text-xs text-zinc-400 leading-relaxed line-clamp-3">{token.description}</p>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-px bg-white/5 mx-5 mb-4 rounded-xl overflow-hidden">
          <div className="bg-[#111113] p-3">
            <p className="text-[9px] uppercase tracking-widest text-zinc-500 mb-0.5">Market Cap</p>
            <p className="text-sm font-bold text-white font-mono">${fmtCompact(token.usd_market_cap)}</p>
          </div>
          <div className="bg-[#111113] p-3">
            <p className="text-[9px] uppercase tracking-widest text-zinc-500 mb-0.5">ATH Market Cap</p>
            <p className="text-sm font-bold text-white font-mono">${fmtCompact(token.ath_market_cap)}</p>
          </div>
          <div className="bg-[#111113] p-3">
            <p className="text-[9px] uppercase tracking-widest text-zinc-500 mb-0.5">Created</p>
            <p className="text-xs font-medium text-white">{fmtDate(token.created_timestamp)}</p>
          </div>
          <div className="bg-[#111113] p-3">
            <p className="text-[9px] uppercase tracking-widest text-zinc-500 mb-0.5">Last Traded</p>
            <p className="text-xs font-medium text-white">{fmtDate(token.last_trade_timestamp)}</p>
          </div>
          <div className="bg-[#111113] p-3">
            <p className="text-[9px] uppercase tracking-widest text-zinc-500 mb-0.5">Bonded</p>
            <p className="text-sm font-bold text-white flex items-center gap-1.5">
              {token.complete ? (
                <><span className="inline-block w-3 h-3 rounded-full bg-emerald-500 border-2 border-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.5)]" /> Yes</>
              ) : (
                <><span className="inline-block w-3 h-3 rounded-full bg-zinc-600 border-2 border-zinc-500" /> No</>
              )}
            </p>
          </div>
          <div className="bg-[#111113] p-3">
            <p className="text-[9px] uppercase tracking-widest text-zinc-500 mb-0.5">24h Volume</p>
            <p className="text-sm font-bold text-white font-mono">${fmtCompact(token.volume)} USD</p>
          </div>
        </div>

        {/* Links */}
        <div className="flex items-center gap-2 px-5 pb-5 flex-wrap">
          {token.mint && (
            <a
              href={`https://pump.fun/coin/${token.mint}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-semibold text-zinc-400 hover:text-white transition-colors bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 hover:border-white/10"
            >
              pump.fun
            </a>
          )}
          {token.twitter && (
            <a
              href={token.twitter}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-semibold text-zinc-400 hover:text-white transition-colors bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 hover:border-white/10"
            >
              X / Twitter
            </a>
          )}
          {token.mint && (
            <a
              href={`https://solscan.io/token/${token.mint}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-semibold text-zinc-400 hover:text-white transition-colors bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 hover:border-white/10"
            >
              Solscan
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsDashboard() {
  const [allCoins, setAllCoins] = useState<any[]>([]);
  const [bondedData, setBondedData] = useState<any[]>([]);
  const [totalBondedCreators, setTotalBondedCreators] = useState(0);
  const [totalMarketCapData, setTotalMarketCapData] = useState<any[]>([]);
  const [totalTotalMarketCapCreators, setTotalTotalMarketCapCreators] = useState(0);
  const [totalAthMarketCapData, setTotalAthMarketCapData] = useState<any[]>([]);
  const [totalTotalAthMarketCapCreators, setTotalTotalAthMarketCapCreators] = useState(0);
  const [bondRateData, setBondRateData] = useState<any[]>([]);
  const [totalBondRateCreators, setTotalBondRateCreators] = useState(0);
  const [athEfficiencyData, setAthEfficiencyData] = useState<any[]>([]);
  const [totalAthEfficiencyCreators, setTotalAthEfficiencyCreators] = useState(0);
  const [followersData, setFollowersData] = useState<any[]>([]);
  const [totalFollowersCreators, setTotalFollowersCreators] = useState(0);
  const [profileMap, setProfileMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<CoinFilters>({ ...DEFAULT_FILTERS });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [metric, setMetric] = useState<MetricKey>("bonded");
  const [chartType, setChartType] = useState<ChartType>("treemap");
  const [selected, setSelected] = useState<CreatorAggregate | null>(null);
  const [viewType, setViewType] = useState<"historical" | "live">("historical");
  const [liveCoins, setLiveCoins] = useState<PumpFunCoin[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveVelocity, setLiveVelocity] = useState(0);
  const [liveSuccessRate, setLiveSuccessRate] = useState(0);
  const [expandingDeployer, setExpandingDeployer] = useState<CreatorAggregate | null>(null);
  const [splittingDeployer, setSplittingDeployer] = useState<CreatorAggregate | null>(null);
  const [expandedDeployer, setExpandedDeployer] = useState<CreatorAggregate | null>(null);
  const [introPlaying, setIntroPlaying] = useState(true);
  const [chartReady, setChartReady] = useState(false);
  const [selectedToken, setSelectedToken] = useState<CreatorAggregateToken | null>(null);
  const phaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [circleAvatars, setCircleAvatars] = useState<Record<string, string>>({});
  const [sparklineDataUrls, setSparklineDataUrls] = useState<Record<string, Record<SparklineTier, string>>>({});
  const [pulseMarketActivityMap, setPulseMarketActivityMap] = useState<Record<string, VolumeByWindow>>({});
  const [marketActivityMap, setMarketActivityMap] = useState<Record<string, VolumeByWindow>>({});
  const [marketActivityFetchedAt, setMarketActivityFetchedAt] = useState<number | null>(null);
  const [creatorFeesMap, setCreatorFeesMap] = useState<Record<string, { totalFeesSOL: number }>>({});
  const [creatorFeesFetchedAt, setCreatorFeesFetchedAt] = useState<number | null>(null);
  const [enrichedCreators, setEnrichedCreators] = useState<Record<string, CreatorAggregate>>({});

  const updateFilter = useCallback(<K extends keyof CoinFilters>(key: K, val: CoinFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: val }));
  }, []);

  // Fetch bonded creators (new high-performance endpoint)
  useEffect(() => {
    let cancelled = false;
    async function fetchBonded() {
      try {
        const res = await fetch("/api/pumpfun/bonded");
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const json = await res.json();
        if (!cancelled && json.success) {
          // Use total count from server, and data is already sliced to 50
          setTotalBondedCreators(json.total);
          
          // Map data to ensure mindshare and profiles are present for coloring/sparklines
          const processedData = json.data.map((d: any) => ({
            ...d,
            mindshare: d.mindshare ?? (d.usd_market_cap ?? 0) / 1000,
            volume: d.volume ?? 0,
            volumeProfile: d.volumeProfile ?? [0, 0, 0, 0],
            top_tokens: d.top_tokens || [],
            bonded_tokens: d.bonded_tokens || [],
          }));
          
          setBondedData(processedData);
        }
      } catch (err) {
        console.error("Failed to fetch bonded creators:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchBonded();
    return () => { cancelled = true; };
  }, []);

  // Fetch total market cap creators (new high-performance endpoint)
  useEffect(() => {
    let cancelled = false;
    async function fetchTotalMarketCap() {
      try {
        const res = await fetch("/api/pumpfun/total-market-cap");
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const json = await res.json();
        if (!cancelled && json.success) {
          setTotalTotalMarketCapCreators(json.total);
          
          const processedData = json.data.map((d: any) => ({
            ...d,
            mindshare: d.mindshare ?? (d.usd_market_cap ?? 0) / 1000,
            volume: d.volume ?? 0,
            volumeProfile: d.volumeProfile ?? [0, 0, 0, 0],
            top_tokens: d.top_tokens || [],
            bonded_tokens: d.bonded_tokens || [],
          }));
          
          setTotalMarketCapData(processedData);
        }
      } catch (err) {
        console.error("Failed to fetch total market cap creators:", err);
      }
    }
    fetchTotalMarketCap();
    return () => { cancelled = true; };
  }, []);

  // Fetch total ATH market cap creators (new high-performance endpoint)
  useEffect(() => {
    let cancelled = false;
    async function fetchTotalAthMarketCap() {
      try {
        const res = await fetch("/api/pumpfun/total-ath-market-cap");
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const json = await res.json();
        if (!cancelled && json.success) {
          setTotalTotalAthMarketCapCreators(json.total);
          
          const processedData = json.data.map((d: any) => ({
            ...d,
            mindshare: d.mindshare ?? (d.usd_market_cap ?? 0) / 1000,
            volume: d.volume ?? 0,
            volumeProfile: d.volumeProfile ?? [0, 0, 0, 0],
            top_tokens: d.top_tokens || [],
            bonded_tokens: d.bonded_tokens || [],
          }));
          
          setTotalAthMarketCapData(processedData);
        }
      } catch (err) {
        console.error("Failed to fetch total ATH market cap creators:", err);
      }
    }
    fetchTotalAthMarketCap();
    return () => { cancelled = true; };
  }, []);

  // Fetch bond rate creators (new high-performance endpoint)
  useEffect(() => {
    let cancelled = false;
    async function fetchBondRate() {
      try {
        const res = await fetch("/api/pumpfun/bond-rate");
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const json = await res.json();
        if (!cancelled && json.success) {
          setTotalBondRateCreators(json.total);
          
          const processedData = json.data.map((d: any) => ({
            ...d,
            mindshare: d.mindshare ?? (d.usd_market_cap ?? 0) / 1000,
            volume: d.volume ?? 0,
            volumeProfile: d.volumeProfile ?? [0, 0, 0, 0],
            top_tokens: d.top_tokens || [],
            bonded_tokens: d.bonded_tokens || [],
          }));
          
          setBondRateData(processedData);
        }
      } catch (err) {
        console.error("Failed to fetch bond rate creators:", err);
      }
    }
    fetchBondRate();
    return () => { cancelled = true; };
  }, []);

  // Fetch ATH Efficiency creators (new high-performance endpoint)
  useEffect(() => {
    let cancelled = false;
    async function fetchAthEfficiency() {
      try {
        const res = await fetch("/api/pumpfun/ath-efficiency");
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const json = await res.json();
        if (!cancelled && json.success) {
          setTotalAthEfficiencyCreators(json.total);
          
          const processedData = json.data.map((d: any) => ({
            ...d,
            mindshare: d.mindshare ?? (d.usd_market_cap ?? 0) / 1000,
            volume: d.volume ?? 0,
            volumeProfile: d.volumeProfile ?? [0, 0, 0, 0],
            top_tokens: d.top_tokens || [],
            bonded_tokens: d.bonded_tokens || [],
          }));
          
          setAthEfficiencyData(processedData);
        }
      } catch (err) {
        console.error("Failed to fetch ATH efficiency creators:", err);
      }
    }
    fetchAthEfficiency();
    return () => { cancelled = true; };
  }, []);

  // Fetch followers creators (new high-performance endpoint)
  useEffect(() => {
    let cancelled = false;
    async function fetchFollowers() {
      try {
        const res = await fetch("/api/pumpfun/followers");
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const json = await res.json();
        if (!cancelled && json.success) {
          setTotalFollowersCreators(json.total);
          
          const processedData = json.data.map((d: any) => ({
            ...d,
            mindshare: d.mindshare ?? (d.usd_market_cap ?? 0) / 1000,
            volume: d.volume ?? 0,
            volumeProfile: d.volumeProfile ?? [0, 0, 0, 0],
            top_tokens: d.top_tokens || [],
            bonded_tokens: d.bonded_tokens || [],
          }));
          
          setFollowersData(processedData);
        }
      } catch (err) {
        console.error("Failed to fetch followers creators:", err);
      }
    }
    fetchFollowers();
    return () => { cancelled = true; };
  }, []);

  // Fetch raw coins once (fallback/legacy for other metrics)
  useEffect(() => {
    if (metric === "bonded" || metric === "totalMarketCap" || metric === "totalAthMarketCap" || metric === "bondRate" || metric === "athEfficiency" || metric === "followers") return;
    let cancelled = false;
    async function fetchCoins() {
      try {
        const res = await fetch("/api/pumpfun/coins");
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const json = await res.json();
        const coins = json?.data ?? json;
        if (!cancelled && Array.isArray(coins)) setAllCoins(coins);
      } catch (err) {
        console.error("Failed to fetch coins:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchCoins();
    return () => { cancelled = true; };
  }, [metric]);

  // Enrich with profiles (non-blocking, runs once after coins arrive)
  useEffect(() => {
    if (allCoins.length === 0) return;
    let cancelled = false;
    (async () => {
      const creators = new Set<string>();
      allCoins.forEach((c: any) => { if (c.creator && c.creator !== "11111111111111111111111111111111") creators.add(c.creator); });
      const addresses = Array.from(creators);
      const BATCH = 50;
      const all: Record<string, any> = {};
      for (let i = 0; i < addresses.length; i += BATCH) {
        const batch = addresses.slice(i, i + BATCH);
        try {
          const r = await fetch("/api/pumpfun/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ addresses: batch }),
          });
          if (r.ok) {
            const { profiles } = await r.json();
            if (profiles) Object.assign(all, profiles);
          }
        } catch { /* non-critical */ }
      }
      if (!cancelled && Object.keys(all).length > 0) setProfileMap(all);
    })();
    return () => { cancelled = true; };
  }, [allCoins]);

  // Combined creator map for live reputation matching - includes enriched real-time profiles
  const knownCreatorsMap = useMemo(() => {
    const map: Record<string, CreatorAggregate> = { ...enrichedCreators };
    [...bondedData, ...totalMarketCapData, ...totalAthMarketCapData, ...bondRateData, ...athEfficiencyData, ...followersData].forEach(d => {
      map[d.creator] = d;
    });
    return map;
  }, [bondedData, totalMarketCapData, totalAthMarketCapData, bondRateData, athEfficiencyData, followersData, enrichedCreators]);

  // Enrich creator profiles for live feed
  useEffect(() => {
    if (viewType !== "live" || liveCoins.length === 0) return;

    const creatorsToFetch = [...new Set(liveCoins.map(c => c.creator))].filter(
      addr => !knownCreatorsMap[addr] && !enrichedCreators[addr]
    );

    if (creatorsToFetch.length === 0) return;

    // Fetch up to 5 at a time to avoid spamming
    const batch = creatorsToFetch.slice(0, 5);
    batch.forEach(async (addr) => {
      try {
        // Fetch profile and tokens in parallel
        const [profileRes, tokensRes] = await Promise.all([
          fetch(`/api/pumpfun/users/${addr}`),
          fetch(`/api/pumpfun/creator-tokens/${addr}`)
        ]);

        let profileData = null;
        let tokenStats = { total: 0, bonded: 0 };

        if (profileRes.ok) {
          const json = await profileRes.json();
          if (json.success) profileData = json.data;
        }

        if (tokensRes.ok) {
          const json = await tokensRes.json();
          if (json.success) {
            tokenStats = { total: json.total, bonded: json.bonded };
          }
        }

        if (profileData || tokenStats.total > 0) {
          setEnrichedCreators(prev => ({
            ...prev,
            [addr]: {
              creator: addr,
              creator_display_name: profileData?.username || addr.slice(0, 6),
              username: profileData?.username,
              followers_count: profileData?.followers_count,
              following_count: profileData?.following_count,
              profile_image: profileData?.profile_image,
              avatar_url: profileData?.profile_image,
              token_count: tokenStats.total,
              bonded: tokenStats.bonded,
              volume: 0,
              usd_market_cap: 0,
              total_ath_market_cap: 0,
              creator_fees: 0,
              mindshare: 0,
              top_tokens: [],
              bonded_tokens: []
            }
          }));
        }
      } catch (err) {
        console.error(`Failed to enrich creator ${addr}:`, err);
      }
    });
  }, [viewType, liveCoins, knownCreatorsMap, enrichedCreators]);

  // Fetch live coins polling
  useEffect(() => {
    if (viewType !== "live") return;
    
    let cancelled = false;
    let timer: any;

    async function fetchLive() {
      if (cancelled) return;
      setLiveLoading(liveCoins.length === 0);
      try {
        const res = await fetch("/api/pumpfun/live?limit=50");
        if (!res.ok) throw new Error("API fail");
        const json = await res.json();
        if (!cancelled && json.success) {
          const freshCoins: PumpFunCoin[] = json.data || [];
          
          setLiveCoins(prev => {
            const coinMap = new Map<string, PumpFunCoin>();
            // Add existing coins
            prev.forEach(c => coinMap.set(c.mint, c));
            // Add/Update with fresh coins
            freshCoins.forEach(c => coinMap.set(c.mint, c));
            
            // Convert to array and sort by newest first
            const allCoins = Array.from(coinMap.values()).sort((a, b) => {
              const tsA = a.created_timestamp > 1e12 ? a.created_timestamp : a.created_timestamp * 1000;
              const tsB = b.created_timestamp > 1e12 ? b.created_timestamp : b.created_timestamp * 1000;
              return tsB - tsA;
            });

            // Limit to 250 most recent
            return allCoins.slice(0, 250);
          });
          
          // Fetch market activity for the newly arrived batch
          const mints = freshCoins.map((c: any) => c.mint);
          if (mints.length > 0) {
            fetch("/api/pumpfun/market-activity", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ mints })
            })
            .then(res => res.json())
            .then(volData => {
              if (!cancelled && volData.marketActivity) {
                setPulseMarketActivityMap(prevMap => {
                  const newMap = { ...prevMap, ...volData.marketActivity };
                  
                  // Re-calculate Momentum Heat based on THE ENTIRE aggregated feed
                  // (Using functional update to get latest coins if needed, but here we use marketActivity data)
                  // Let's actually calculate this outside or use the fresh batch for 'Heat'
                  // The user said "Launch intensity vs average", so freshCoins is better for heat
                  let total5m = 0;
                  let total1h = 0;
                  mints.forEach((m: string) => {
                    const v = newMap[m];
                    if (v) {
                      total5m += v.volume5m;
                      total1h += v.volume1h;
                    }
                  });
                  
                  const ratio = total1h > 0 ? (total5m / (total1h / 12)) * 100 : 0;
                  setLiveVelocity(Math.min(200, Math.round(ratio)));

                  return newMap;
                });

                // Calculate Bonding Pipeline (avg progress) for the ENTIRE accumulated feed
                setLiveCoins(currentCoins => {
                  const totalProgress = currentCoins.reduce((acc: number, c: any) => {
                    const prog = Math.min(100, (c.usd_market_cap / 60000) * 100);
                    return acc + (c.complete ? 100 : prog);
                  }, 0);
                  setLiveSuccessRate(Math.round(totalProgress / Math.max(1, currentCoins.length)));
                  return currentCoins;
                });
              }
            })
            .catch(err => console.error("Live market activity fetch error:", err));
          }
          
          // Momentum Heat: Ratio of 5m vol to 1/12th of 1h vol (intensity)
          // Since we fetch market activity separately, we'll calculate this in another useEffect or update it when volData arrives
        }
      } catch (err) {
        console.error("Live fetch error:", err);
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    }

    fetchLive();
    timer = setInterval(fetchLive, 30000); // Poll every 30s

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [viewType]);

  // Fetch 24h volume (market-activity) for all coins OR bonded tokens after they load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const seen = new Set<string>();
      const mints: string[] = [];

      // Collect mints from allCoins (legacy/other metrics)
      if (allCoins.length > 0) {
        const sorted = [...allCoins].sort(
          (a: any, b: any) => (b.last_trade_timestamp ?? 0) - (a.last_trade_timestamp ?? 0)
        );
        for (const c of sorted) {
          if (c.mint && !seen.has(c.mint)) {
            seen.add(c.mint);
            mints.push(c.mint);
          }
        }
      }

      // Collect mints from bondedData (new high-performance endpoint)
      if (bondedData.length > 0) {
        // Collect mints from top_tokens of bonded creators
        for (const d of bondedData) {
          const tokens = d.top_tokens || [];
          for (const t of tokens) {
            if (t.mint && !seen.has(t.mint)) {
              seen.add(t.mint);
              mints.push(t.mint);
            }
          }
        }
      }

      // Collect mints from totalMarketCapData (new high-performance endpoint)
      if (totalMarketCapData.length > 0) {
        for (const d of totalMarketCapData) {
          const tokens = d.top_tokens || [];
          for (const t of tokens) {
            if (t.mint && !seen.has(t.mint)) {
              seen.add(t.mint);
              mints.push(t.mint);
            }
          }
        }
      }

      // Collect mints from totalAthMarketCapData (new high-performance endpoint)
      if (totalAthMarketCapData.length > 0) {
        for (const d of totalAthMarketCapData) {
          const tokens = d.top_tokens || [];
          for (const t of tokens) {
            if (t.mint && !seen.has(t.mint)) {
              seen.add(t.mint);
              mints.push(t.mint);
            }
          }
        }
      }

      // Collect mints from bondRateData (new high-performance endpoint)
      if (bondRateData.length > 0) {
        for (const d of bondRateData) {
          const tokens = d.top_tokens || [];
          for (const t of tokens) {
            if (t.mint && !seen.has(t.mint)) {
              seen.add(t.mint);
              mints.push(t.mint);
            }
          }
        }
      }

      // Collect mints from athEfficiencyData (new high-performance endpoint)
      if (athEfficiencyData.length > 0) {
        for (const d of athEfficiencyData) {
          const tokens = d.top_tokens || [];
          for (const t of tokens) {
            if (t.mint && !seen.has(t.mint)) {
              seen.add(t.mint);
              mints.push(t.mint);
            }
          }
        }
      }

      // Collect mints from followersData (new high-performance endpoint)
      if (followersData.length > 0) {
        for (const d of followersData) {
          const tokens = d.top_tokens || [];
          for (const t of tokens) {
            if (t.mint && !seen.has(t.mint)) {
              seen.add(t.mint);
              mints.push(t.mint);
            }
          }
        }
      }

      if (mints.length === 0) return;

      const capped = mints.slice(0, MARKET_ACTIVITY_MINTS_CAP);
      try {
        const res = await fetch("/api/pumpfun/market-activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mints: capped }),
        });
        if (!res.ok || cancelled) return;
        const { marketActivity, fetchedAt } = await res.json();
        if (cancelled) return;
        if (marketActivity && typeof fetchedAt === "number") {
          setMarketActivityMap((prev) => ({ ...prev, ...marketActivity }));
          setMarketActivityFetchedAt(fetchedAt);
        }
      } catch (err) {
        console.error("Failed to fetch market activity:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [allCoins, bondedData]);

  // Fetch creator fees for all creators (legacy OR bonded) after data loads
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const creators = new Set<string>();
      
      // Collect creators from allCoins
      if (allCoins.length > 0) {
        allCoins.forEach((c: any) => { 
          if (c.creator && c.creator !== "11111111111111111111111111111111") creators.add(c.creator); 
        });
      }

      // Collect creators from bondedData
      if (bondedData.length > 0) {
        bondedData.forEach((d: any) => {
          if (d.creator && d.creator !== "11111111111111111111111111111111") creators.add(d.creator);
        });
      }

      // Collect creators from totalMarketCapData
      if (totalMarketCapData.length > 0) {
        totalMarketCapData.forEach((d: any) => {
          if (d.creator && d.creator !== "11111111111111111111111111111111") creators.add(d.creator);
        });
      }

      // Collect creators from totalAthMarketCapData
      if (totalAthMarketCapData.length > 0) {
        totalAthMarketCapData.forEach((d: any) => {
          if (d.creator && d.creator !== "11111111111111111111111111111111") creators.add(d.creator);
        });
      }

      // Collect creators from bondRateData
      if (bondRateData.length > 0) {
        bondRateData.forEach((d: any) => {
          if (d.creator && d.creator !== "11111111111111111111111111111111") creators.add(d.creator);
        });
      }

      // Collect creators from athEfficiencyData
      if (athEfficiencyData.length > 0) {
        athEfficiencyData.forEach((d: any) => {
          if (d.creator && d.creator !== "11111111111111111111111111111111") creators.add(d.creator);
        });
      }

      // Collect creators from followersData
      if (followersData.length > 0) {
        followersData.forEach((d: any) => {
          if (d.creator && d.creator !== "11111111111111111111111111111111") creators.add(d.creator);
        });
      }

      const addresses = Array.from(creators);
      if (addresses.length === 0) return;
      
      try {
        const res = await fetch("/api/pumpfun/creator-fees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ addresses }),
        });
        if (!res.ok || cancelled) return;
        const { fees, fetchedAt } = await res.json();
        if (cancelled) return;
        if (fees && typeof fetchedAt === "number") {
          setCreatorFeesMap((prev) => ({ ...prev, ...fees }));
          setCreatorFeesFetchedAt(fetchedAt);
        }
      } catch (err) {
        console.error("Failed to fetch creator fees:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [allCoins, bondedData]);

  // Reactive aggregation: filter coins -> aggregate -> filter creators
  const deployers = useMemo(() => {
    if (metric === "bonded") {
      // Enrich bondedData with volume and volumeProfile from marketActivityMap
      return bondedData.map((d: any) => {
        const tokens = d.top_tokens || [];
        let v5m = 0, v1h = 0, v6h = 0, v24h = 0;
        let hasActivity = false;
        
        tokens.forEach((t: any) => {
          const act = marketActivityMap[t.mint];
          if (act) {
            v5m += act.volume5m || 0;
            v1h += act.volume1h || 0;
            v6h += act.volume6h || 0;
            v24h += act.volume24h || 0;
            hasActivity = true;
          }
        });

        const profile = hasActivity ? [
          Math.max(0, v24h - v6h),
          Math.max(0, v6h - v1h),
          Math.max(0, v1h - v5m),
          v5m
        ] : (d.volumeProfile || [0, 0, 0, 0]);

        return {
          ...d,
          volume: hasActivity ? v24h : (d.volume || 0),
          volumeProfile: profile,
          creator_fees: creatorFeesMap[d.creator]?.totalFeesSOL ?? d.creator_fees ?? 0
        };
      })
      .filter((d) => passesCreatorFilter(d, filters))
      .sort((a, b) => b.usd_market_cap - a.usd_market_cap);
    }

    if (metric === "followers") {
      // Enrich followersData with volume and volumeProfile from marketActivityMap
      return followersData.map((d: any) => {
        const tokens = d.top_tokens || [];
        let v5m = 0, v1h = 0, v6h = 0, v24h = 0;
        let hasActivity = false;
        
        tokens.forEach((t: any) => {
          const act = marketActivityMap[t.mint];
          if (act) {
            v5m += act.volume5m || 0;
            v1h += act.volume1h || 0;
            v6h += act.volume6h || 0;
            v24h += act.volume24h || 0;
            hasActivity = true;
          }
        });

        const profile = hasActivity ? [
          Math.max(0, v24h - v6h),
          Math.max(0, v6h - v1h),
          Math.max(0, v1h - v5m),
          v5m
        ] : (d.volumeProfile || [0, 0, 0, 0]);

        return {
          ...d,
          volume: hasActivity ? v24h : (d.volume || 0),
          volumeProfile: profile,
          creator_fees: creatorFeesMap[d.creator]?.totalFeesSOL ?? d.creator_fees ?? 0
        };
      })
      .filter((d) => passesCreatorFilter(d, filters))
      .sort((a, b) => b.usd_market_cap - a.usd_market_cap);
    }

    if (metric === "totalMarketCap") {
      // Enrich totalMarketCapData with volume and volumeProfile from marketActivityMap
      return totalMarketCapData.map((d: any) => {
        const tokens = d.top_tokens || [];
        let v5m = 0, v1h = 0, v6h = 0, v24h = 0;
        let hasActivity = false;
        
        tokens.forEach((t: any) => {
          const act = marketActivityMap[t.mint];
          if (act) {
            v5m += act.volume5m || 0;
            v1h += act.volume1h || 0;
            v6h += act.volume6h || 0;
            v24h += act.volume24h || 0;
            hasActivity = true;
          }
        });

        const profile = hasActivity ? [
          Math.max(0, v24h - v6h),
          Math.max(0, v6h - v1h),
          Math.max(0, v1h - v5m),
          v5m
        ] : (d.volumeProfile || [0, 0, 0, 0]);

        return {
          ...d,
          volume: hasActivity ? v24h : (d.volume || 0),
          volumeProfile: profile,
          creator_fees: creatorFeesMap[d.creator]?.totalFeesSOL ?? d.creator_fees ?? 0
        };
      })
      .filter((d) => passesCreatorFilter(d, filters))
      .sort((a, b) => b.usd_market_cap - a.usd_market_cap);
    }

    if (metric === "totalAthMarketCap") {
      // Enrich totalAthMarketCapData with volume and volumeProfile from marketActivityMap
      return totalAthMarketCapData.map((d: any) => {
        const tokens = d.top_tokens || [];
        let v5m = 0, v1h = 0, v6h = 0, v24h = 0;
        let hasActivity = false;
        
        tokens.forEach((t: any) => {
          const act = marketActivityMap[t.mint];
          if (act) {
            v5m += act.volume5m || 0;
            v1h += act.volume1h || 0;
            v6h += act.volume6h || 0;
            v24h += act.volume24h || 0;
            hasActivity = true;
          }
        });

        const profile = hasActivity ? [
          Math.max(0, v24h - v6h),
          Math.max(0, v6h - v1h),
          Math.max(0, v1h - v5m),
          v5m
        ] : (d.volumeProfile || [0, 0, 0, 0]);

        return {
          ...d,
          volume: hasActivity ? v24h : (d.volume || 0),
          volumeProfile: profile,
          creator_fees: creatorFeesMap[d.creator]?.totalFeesSOL ?? d.creator_fees ?? 0
        };
      })
      .filter((d) => passesCreatorFilter(d, filters))
      .sort((a, b) => b.usd_market_cap - a.usd_market_cap);
    }

    if (metric === "athEfficiency") {
      // Enrich athEfficiencyData with volume and volumeProfile from marketActivityMap
      return athEfficiencyData.map((d: any) => {
        const tokens = d.top_tokens || [];
        let v5m = 0, v1h = 0, v6h = 0, v24h = 0;
        let hasActivity = false;
        
        tokens.forEach((t: any) => {
          const act = marketActivityMap[t.mint];
          if (act) {
            v5m += act.volume5m || 0;
            v1h += act.volume1h || 0;
            v6h += act.volume6h || 0;
            v24h += act.volume24h || 0;
            hasActivity = true;
          }
        });

        const profile = hasActivity ? [
          Math.max(0, v24h - v6h),
          Math.max(0, v6h - v1h),
          Math.max(0, v1h - v5m),
          v5m
        ] : (d.volumeProfile || [0, 0, 0, 0]);

        return {
          ...d,
          volume: hasActivity ? v24h : (d.volume || 0),
          volumeProfile: profile,
          creator_fees: creatorFeesMap[d.creator]?.totalFeesSOL ?? d.creator_fees ?? 0
        };
      })
      .filter((d) => passesCreatorFilter(d, filters))
      .sort((a, b) => b.usd_market_cap - a.usd_market_cap);
    }

    if (metric === "bondRate") {
      // Enrich bondRateData with volume and volumeProfile from marketActivityMap
      return bondRateData.map((d: any) => {
        const tokens = d.top_tokens || [];
        let v5m = 0, v1h = 0, v6h = 0, v24h = 0;
        let hasActivity = false;
        
        tokens.forEach((t: any) => {
          const act = marketActivityMap[t.mint];
          if (act) {
            v5m += act.volume5m || 0;
            v1h += act.volume1h || 0;
            v6h += act.volume6h || 0;
            v24h += act.volume24h || 0;
            hasActivity = true;
          }
        });

        const profile = hasActivity ? [
          Math.max(0, v24h - v6h),
          Math.max(0, v6h - v1h),
          Math.max(0, v1h - v5m),
          v5m
        ] : (d.volumeProfile || [0, 0, 0, 0]);

        return {
          ...d,
          volume: hasActivity ? v24h : (d.volume || 0),
          volumeProfile: profile,
          creator_fees: creatorFeesMap[d.creator]?.totalFeesSOL ?? d.creator_fees ?? 0
        };
      })
      .filter((d) => passesCreatorFilter(d, filters))
      .sort((a, b) => b.usd_market_cap - a.usd_market_cap);
    }
    if (allCoins.length === 0) return [];
    const filtered = allCoins.filter((coin) => {
      const c = coin.creator;
      if (!c || c === "11111111111111111111111111111111") return false;
      return passesCoinFilter(coin, filters);
    });

    const creatorMap = new Map<string, CreatorAggregate>();
    const volumeSums = new Map<string, { v5m: number; v1h: number; v6h: number; v24h: number }>();
    filtered.forEach((coin: any) => {
      const c = coin.creator;
      if (!creatorMap.has(c)) {
        const p = profileMap[c];
        creatorMap.set(c, {
          creator: c,
          creator_display_name: p?.username || `${c.slice(0, 4)}...${c.slice(-4)}`,
          avatar_url: p?.profile_image || pumpAvatarUrl(c),
          profile_image: p?.profile_image || undefined,
          username: p?.username || undefined,
          followers_count: p?.followers ?? undefined,
          following_count: p?.following ?? undefined,
          likes_received: p?.likes_received ?? undefined,
          mentions_received: p?.mentions_received ?? undefined,
          bio: p?.bio || undefined,
          x_username: p?.x_username || undefined,
          twitter_url: p?.x_username ? `https://x.com/${p.x_username}` : undefined,
          token_count: 0,
          bonded: 0,
          volume: 0,
          usd_market_cap: 0,
          total_ath_market_cap: 0,
          creator_fees: 0,
          mindshare: 0,
          total_replies: 0,
          recent_trade_count: 0,
          top_tokens: [],
          bonded_tokens: [],
        });
        volumeSums.set(c, { v5m: 0, v1h: 0, v6h: 0, v24h: 0 });
      }
      const deployer = creatorMap.get(c)!;
      deployer.token_count += 1;
      if (coin.complete === true) deployer.bonded += 1;
      deployer.usd_market_cap += coin.usd_market_cap || 0;
      deployer.total_ath_market_cap += coin.ath_market_cap || 0;
      deployer.total_replies! += coin.reply_count || 0;
      const act = marketActivityMap[coin.mint];
      const v5m = act?.volume5m ?? 0;
      const v1h = act?.volume1h ?? 0;
      const v6h = act?.volume6h ?? 0;
      const v24h = act?.volume24h ?? 0;
      deployer.volume += v24h;
      const sums = volumeSums.get(c)!;
      sums.v5m += v5m;
      sums.v1h += v1h;
      sums.v6h += v6h;
      sums.v24h += v24h;
      const lastTrade = coin.last_trade_timestamp;
      if (lastTrade != null) {
        const ms = lastTrade > 1e12 ? lastTrade : lastTrade * 1000;
        if (Date.now() - ms <= 7 * 24 * 60 * 60 * 1000) deployer.recent_trade_count! += 1;
      }
      const tokenEntry: CreatorAggregateToken = {
        name: coin.name || "Unknown",
        symbol: coin.symbol || "UNK",
        usd_market_cap: coin.usd_market_cap || 0,
        volume: v24h,
        mint: coin.mint,
        description: coin.description,
        image_uri: coin.image_uri,
        twitter: coin.twitter,
        created_timestamp: coin.created_timestamp,
        last_trade_timestamp: coin.last_trade_timestamp,
        complete: coin.complete,
        ath_market_cap: coin.ath_market_cap,
      };
      deployer.top_tokens.push(tokenEntry);
      if (coin.complete === true) deployer.bonded_tokens.push(tokenEntry);
    });

    const aggregated = Array.from(creatorMap.values()).map((d) => {
      d.mindshare = d.usd_market_cap / 1000;
      d.creator_fees = creatorFeesMap[d.creator]?.totalFeesSOL ?? 0;
      const vs = volumeSums.get(d.creator);
      if (vs) {
        const vol_6h_24h = Math.max(0, vs.v24h - vs.v6h);
        const vol_1h_6h = Math.max(0, vs.v6h - vs.v1h);
        const vol_5m_1h = Math.max(0, vs.v1h - vs.v5m);
        const vol_5m = vs.v5m;
        d.volumeProfile = [vol_6h_24h, vol_1h_6h, vol_5m_1h, vol_5m];
      }
      d.top_tokens = d.top_tokens.sort((a, b) => b.usd_market_cap - a.usd_market_cap).slice(0, 5);
      d.bonded_tokens = d.bonded_tokens.sort((a, b) => (b.ath_market_cap || 0) - (a.ath_market_cap || 0));
      return d;
    });

    const R_max = Math.max(1, ...aggregated.map((d) => d.total_replies ?? 0));
    const T_max = Math.max(1, ...aggregated.map((d) => d.recent_trade_count ?? 0));
    const P_max = Math.max(1, ...aggregated.map((d) => (d.likes_received ?? 0) + (d.mentions_received ?? 0)));
    aggregated.forEach((d) => {
      const r = (d.total_replies ?? 0) / R_max;
      const t = (d.recent_trade_count ?? 0) / T_max;
      const p = ((d.likes_received ?? 0) + (d.mentions_received ?? 0)) / P_max;
      d.engagement = 0.4 * r + 0.4 * t + 0.2 * p;
    });

    return aggregated
      .filter((d) => passesCreatorFilter(d, filters))
      .sort((a, b) => b.usd_market_cap - a.usd_market_cap);
  }, [allCoins, bondedData, filters, metric, profileMap, marketActivityMap, creatorFeesMap]);

  // Pre-load circular avatar data URIs
  useEffect(() => {
    if (deployers.length === 0) return;
    let cancelled = false;
    (async () => {
      const entries: [string, string][] = [];
      await Promise.all(
        deployers.map(async (d) => {
          const url = d.avatar_url || PUMP_AVATAR_FALLBACK;
          const dataUri = await circleAvatarDataUri(url, 44);
          if (dataUri) entries.push([d.creator, dataUri]);
        })
      );
      if (!cancelled) setCircleAvatars(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
  }, [deployers]);

  // Pre-compute volume ramp sparkline images per deployer at 3 sizes (scales with rectangle)
  useEffect(() => {
    if (deployers.length === 0) return;
    const next: Record<string, Record<SparklineTier, string>> = {};
    const lineColor = "rgba(255,255,255,0.7)";
    deployers.forEach((d) => {
      const profile = d.volumeProfile ?? [0, 0, 0, 0];
      next[d.creator] = {
        small: drawVolumeRampSparkline(profile, SPARKLINE_SIZES.small.width, SPARKLINE_SIZES.small.height, lineColor),
        medium: drawVolumeRampSparkline(profile, SPARKLINE_SIZES.medium.width, SPARKLINE_SIZES.medium.height, lineColor),
        large: drawVolumeRampSparkline(profile, SPARKLINE_SIZES.large.width, SPARKLINE_SIZES.large.height, lineColor),
      };
    });
    setSparklineDataUrls(next);
  }, [deployers]);

  const totals = useMemo(() => {
    let deployersCount = deployers.length;
    if (metric === "bonded") deployersCount = totalBondedCreators;
    else if (metric === "totalMarketCap") deployersCount = totalTotalMarketCapCreators;
    else if (metric === "totalAthMarketCap") deployersCount = totalTotalAthMarketCapCreators;
    else if (metric === "bondRate") deployersCount = totalBondRateCreators;
    else if (metric === "athEfficiency") deployersCount = totalAthEfficiencyCreators;
    else if (metric === "followers") deployersCount = totalFollowersCreators;

    return {
      deployers: deployersCount,
      volume: deployers.reduce((s, d) => s + (d.volume ?? 0), 0),
      marketCap: deployers.reduce((s, d) => s + (d.usd_market_cap ?? 0), 0),
      fees: deployers.reduce((s, d) => s + (d.creator_fees ?? 0), 0),
    };
  }, [deployers, metric, totalBondedCreators, totalTotalMarketCapCreators]);

  const mindshareMax = useMemo(() => Math.max(1, ...deployers.map((d) => d.mindshare)), [deployers]);

  const clearPhaseTimeout = useCallback(() => {
    if (phaseTimeoutRef.current) {
      clearTimeout(phaseTimeoutRef.current);
      phaseTimeoutRef.current = null;
    }
  }, []);

  const handleBack = useCallback(() => {
    clearPhaseTimeout();
    setExpandingDeployer(null);
    setSplittingDeployer(null);
    setExpandedDeployer(null);
  }, [clearPhaseTimeout]);

  const option = useMemo(() => {
    if (deployers.length === 0) return {};
    if (introPlaying && chartType === "treemap") {
      return buildParticleOption(mindshareMax, deployers);
    }
    if (chartType === "treemap" && expandingDeployer) {
      return buildExpandOption(expandingDeployer, mindshareMax);
    }
    if (chartType === "treemap" && splittingDeployer) {
      return buildSplitOption(splittingDeployer, mindshareMax);
    }
    if (chartType === "treemap" && expandedDeployer) {
      return buildDrilldownOption(expandedDeployer, mindshareMax, handleBack, marketActivityMap);
    }
    return buildOption(chartType, metric, mindshareMax, deployers, circleAvatars, sparklineDataUrls);
  }, [introPlaying, chartType, metric, mindshareMax, expandingDeployer, splittingDeployer, expandedDeployer, handleBack, deployers, circleAvatars, sparklineDataUrls, marketActivityMap]);

  // Start intro-end timeout only once chart is ready so the particle option is actually painted before we switch to treemap
  useEffect(() => {
    if (!chartReady || !introPlaying || deployers.length === 0 || chartType !== "treemap") return;
    const t = setTimeout(() => setIntroPlaying(false), 1200);
    return () => clearTimeout(t);
  }, [chartReady, introPlaying, deployers.length, chartType]);

  useEffect(() => {
    if (!expandingDeployer) return;
    phaseTimeoutRef.current = setTimeout(() => {
      setSplittingDeployer(expandingDeployer);
      setExpandingDeployer(null);
      phaseTimeoutRef.current = null;
    }, 700);
    return () => clearPhaseTimeout();
  }, [expandingDeployer, clearPhaseTimeout]);

  useEffect(() => {
    if (!splittingDeployer) return;
    phaseTimeoutRef.current = setTimeout(() => {
      setExpandedDeployer(splittingDeployer);
      setSplittingDeployer(null);
      phaseTimeoutRef.current = null;
    }, 700);
    return () => clearPhaseTimeout();
  }, [splittingDeployer, clearPhaseTimeout]);

  const handleChartClick = useCallback((d: CreatorAggregate) => {
    if (chartType === "treemap") {
      clearPhaseTimeout();
      setExpandedDeployer(null);
      setSplittingDeployer(null);
      setExpandingDeployer(d);
    } else {
      setSelected(d);
    }
  }, [chartType, clearPhaseTimeout]);

  const handleTokenClick = useCallback((t: CreatorAggregateToken) => {
    setSelectedToken(t);
  }, []);

  const volume24hAsOf = marketActivityFetchedAt
    ? new Date(marketActivityFetchedAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
    : null;
  const feesAsOf = creatorFeesFetchedAt
    ? new Date(creatorFeesFetchedAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
    : null;

  const STAT_CARDS = [
    { label: "Deployers", value: totals.deployers.toString(), unit: "" },
    { label: "24h Volume", value: fmtCompact(totals.volume), unit: "USD", subtitle: volume24hAsOf ? `As of ${volume24hAsOf}` : undefined },
    { label: "Total Market Cap", value: fmtCompact(totals.marketCap), unit: "SOL" },
    { label: "Creator Fees", value: fmtCompact(totals.fees), unit: "SOL", subtitle: feesAsOf ? `As of ${feesAsOf}` : undefined },
  ];

  if (loading) {
    return <div className="flex items-center justify-center h-full text-zinc-600 bg-[#060608]">Loading deployers...</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-[#060608] text-white overflow-y-auto overflow-x-hidden">
      {/* View Toggles - Main Navigation */}
      <div className="shrink-0 px-4 pt-4 flex justify-center">
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 w-full max-w-md">
          <button
            onClick={() => setViewType("historical")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-bold transition-all ${
              viewType === "historical" 
              ? "bg-white/10 text-white shadow-lg" 
              : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Trophy className="w-4 h-4" /> Historical
          </button>
          <button
            onClick={() => setViewType("live")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-bold transition-all ${
              viewType === "live" 
              ? "bg-red-500/20 text-red-500 shadow-lg" 
              : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Radio className="w-4 h-4" /> Live Coins
          </button>
        </div>
      </div>

      {viewType === "historical" ? (
        <>
          {/* Controls bar */}
          <div className="shrink-0 px-4 pt-4 pb-2">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-3">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h1
              className="text-2xl sm:text-3xl font-black tracking-tight"
              style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
            >
              Top Pump.fun{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(135deg, #ef4444 0%, #c026d3 50%, #6366f1 100%)" }}
              >
                Active Deployers
              </span>
            </h1>
          </motion.div>

          {/* Summary stats inline */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="flex gap-2 flex-wrap"
          >
            {STAT_CARDS.map((s) => (
              <div key={s.label} className="rounded-xl bg-white/[0.03] border border-white/5 px-3 py-1.5 text-center">
                <p className="text-[9px] uppercase tracking-widest text-zinc-500">{s.label}</p>
                <p className="text-sm font-bold text-white">
                  {s.value}
                  {s.unit && <span className="text-[10px] text-zinc-500 ml-0.5 font-normal">{s.unit}</span>}
                </p>
                {"subtitle" in s && s.subtitle && (
                  <p className="text-[9px] text-zinc-500 mt-0.5">{s.subtitle}</p>
                )}
              </div>
            ))}
          </motion.div>
        </div>

        {/* Chart type + metric toggles */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="flex flex-wrap gap-1.5">
            <span className="flex items-center text-[10px] text-zinc-600 mr-1 uppercase tracking-widest font-bold">Chart</span>
            {CHART_TYPES.map((c) => {
              const active = chartType === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => { setChartType(c.key); clearPhaseTimeout(); setExpandingDeployer(null); setSplittingDeployer(null); setExpandedDeployer(null); }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border ${
                    active
                      ? "text-white border-red-500/40 bg-red-500/15"
                      : "text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-white/[0.03]"
                  }`}
                >
                  {c.icon}
                  <span className="hidden sm:inline">{c.label}</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="flex items-center text-[10px] text-zinc-600 mr-1 uppercase tracking-widest font-bold">Metric</span>
            {METRICS.map((m) => {
              const active = metric === m.key;
              const disabled = DISABLED_METRICS.has(m.key);
              return (
                <button
                  key={m.key}
                  type="button"
                  disabled={disabled}
                  title={disabled ? "Coming soon" : undefined}
                  onClick={() => {
                    if (disabled) return;
                    setMetric(m.key);
                    clearPhaseTimeout();
                    setExpandingDeployer(null);
                    setSplittingDeployer(null);
                    setExpandedDeployer(null);
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border ${
                    disabled
                      ? "text-zinc-600 border-transparent bg-white/[0.02] cursor-not-allowed opacity-60"
                      : active
                        ? "text-white border-purple-500/40 bg-purple-500/15"
                        : "text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-white/[0.03]"
                  }`}
                >
                  {m.icon}
                  <span className="hidden sm:inline">{METRIC_LABELS[m.key]}</span>
                </button>
              );
            })}
          </div>

          {/* Filter toggle */}
          <div className="relative ml-auto">
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border ${
                filtersOpen || countActiveFilters(filters) > 0
                  ? "text-white border-amber-500/40 bg-amber-500/15"
                  : "text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-white/[0.03]"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
              {countActiveFilters(filters) > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-amber-500 text-black text-[9px] font-bold leading-none">
                  {countActiveFilters(filters)}
                </span>
              )}
            </button>

            {filtersOpen && (
              <div className="absolute right-0 top-full mt-2 z-50 w-[420px] max-h-[70vh] overflow-y-auto rounded-xl bg-[#111113] border border-white/10 shadow-2xl p-4 text-[11px]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Filters</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFilters({ ...DEFAULT_FILTERS })}
                      className="text-[10px] text-zinc-500 hover:text-white transition-colors"
                    >
                      Reset All
                    </button>
                    <button type="button" onClick={() => setFiltersOpen(false)} className="text-zinc-500 hover:text-white">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* --- Market Cap --- */}
                <style dangerouslySetInnerHTML={{ __html: DUAL_RANGE_CSS }} />
                <div className="mb-4">
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-2">Market Cap</p>
                  <div className="space-y-4">
                    <DualRangeSlider
                      label="ATH Market Cap ($)"
                      min={0}
                      max={ATH_MARKET_CAP_SLIDER_MAX}
                      step={ATH_MARKET_CAP_SLIDER_STEP}
                      valueMin={filters.athMarketCapMin}
                      valueMax={filters.athMarketCapMax}
                      defaultMin={0}
                      defaultMax={ATH_MARKET_CAP_SLIDER_MAX}
                      formatValue={(v, isMax) => v == null ? (isMax ? "No limit" : "Any") : `$${fmtCompact(v)}`}
                      onChange={(lo, hi) => { updateFilter("athMarketCapMin", lo); updateFilter("athMarketCapMax", hi); }}
                    />
                    <DualRangeSlider
                      label="Current Market Cap ($)"
                      min={0}
                      max={MARKET_CAP_SLIDER_MAX}
                      step={MARKET_CAP_SLIDER_STEP}
                      valueMin={filters.marketCapMin}
                      valueMax={filters.marketCapMax}
                      defaultMin={0}
                      defaultMax={MARKET_CAP_SLIDER_MAX}
                      formatValue={(v, isMax) => v == null ? (isMax ? "No limit" : "Any") : `$${fmtCompact(v)}`}
                      onChange={(lo, hi) => { updateFilter("marketCapMin", lo); updateFilter("marketCapMax", hi); }}
                    />
                  </div>
                </div>

                {/* --- Token Status --- */}
                <div className="mb-4">
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-2">Token Status</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-2">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input type="checkbox" checked={filters.bondedOnly} onChange={(e) => { updateFilter("bondedOnly", e.target.checked); if (e.target.checked) updateFilter("notBondedOnly", false); }} className="accent-amber-500 w-3 h-3 rounded" />
                      <span className="text-zinc-400">Bonded Only</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input type="checkbox" checked={filters.notBondedOnly} onChange={(e) => { updateFilter("notBondedOnly", e.target.checked); if (e.target.checked) updateFilter("bondedOnly", false); }} className="accent-amber-500 w-3 h-3 rounded" />
                      <span className="text-zinc-400">Not Bonded Only</span>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-zinc-500">Created After</span>
                      <input
                        type="date"
                        value={filters.createdAfter}
                        onChange={(e) => updateFilter("createdAfter", e.target.value)}
                        className="mt-0.5 w-full bg-white/5 border border-white/10 rounded-md px-2 py-1 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/40 [color-scheme:dark]"
                      />
                    </label>
                    <label className="block">
                      <span className="text-zinc-500">Last Traded After</span>
                      <input
                        type="date"
                        value={filters.lastTradedAfter}
                        onChange={(e) => updateFilter("lastTradedAfter", e.target.value)}
                        className="mt-0.5 w-full bg-white/5 border border-white/10 rounded-md px-2 py-1 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/40 [color-scheme:dark]"
                      />
                    </label>
                  </div>
                </div>

                {/* --- Token Quality (only applies when metric uses coin-level data; disabled for Bonded, Total Market Cap, etc.) --- */}
                {(() => {
                  const tokenQualityDisabled = METRICS_TOKEN_QUALITY_DISABLED.has(metric);
                  const tokenQualityTooltip = "Token Quality filters only apply to Total Volume, Followers, Engagement, and Total Creator Fees";
                  return (
                    <div className={`mb-4 relative ${tokenQualityDisabled ? "opacity-50" : ""}`}>
                      {tokenQualityDisabled && (
                        <div
                          className="absolute inset-0 z-10 cursor-not-allowed"
                          title={tokenQualityTooltip}
                          aria-label={tokenQualityTooltip}
                        />
                      )}
                      <div className={tokenQualityDisabled ? "pointer-events-none" : ""}>
                      <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-2">
                        Token Quality
                        {tokenQualityDisabled && <span className="normal-case font-normal text-zinc-600 ml-1">(not available for this metric)</span>}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-2">
                        <label className="flex items-center gap-1.5 cursor-pointer select-none">
                          <input type="checkbox" checked={filters.excludeNsfw} onChange={(e) => updateFilter("excludeNsfw", e.target.checked)} className="accent-amber-500 w-3 h-3 rounded" disabled={tokenQualityDisabled} />
                          <span className="text-zinc-400">Exclude NSFW</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer select-none">
                          <input type="checkbox" checked={filters.excludeBanned} onChange={(e) => updateFilter("excludeBanned", e.target.checked)} className="accent-amber-500 w-3 h-3 rounded" disabled={tokenQualityDisabled} />
                          <span className="text-zinc-400">Exclude Banned</span>
                        </label>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <label className="block">
                          <span className="text-zinc-500">Min Replies</span>
                          <input
                            type="number"
                            placeholder="0"
                            value={filters.minReplyCount ?? ""}
                            onChange={(e) => updateFilter("minReplyCount", e.target.value ? Number(e.target.value) : null)}
                            className="mt-0.5 w-full bg-white/5 border border-white/10 rounded-md px-2 py-1 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/40"
                            disabled={tokenQualityDisabled}
                          />
                        </label>
                        <label className="block">
                          <span className="text-zinc-500">Min SOL Reserves</span>
                          <input
                            type="number"
                            step="0.1"
                            placeholder="0"
                            value={filters.minRealSolReserves ?? ""}
                            onChange={(e) => updateFilter("minRealSolReserves", e.target.value ? Number(e.target.value) : null)}
                            className="mt-0.5 w-full bg-white/5 border border-white/10 rounded-md px-2 py-1 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/40"
                            disabled={tokenQualityDisabled}
                          />
                        </label>
                        <label className="block">
                          <span className="text-zinc-500">Min Liq. Ratio</span>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0"
                            value={filters.minLiquidityRatio ?? ""}
                            onChange={(e) => updateFilter("minLiquidityRatio", e.target.value ? Number(e.target.value) : null)}
                            className="mt-0.5 w-full bg-white/5 border border-white/10 rounded-md px-2 py-1 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/40"
                            disabled={tokenQualityDisabled}
                          />
                        </label>
                      </div>
                      </div>
                    </div>
                  );
                })()}

                {/* --- Creator --- */}
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-2">Creator</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-2">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input type="checkbox" checked={filters.hasPfpOnly} onChange={(e) => updateFilter("hasPfpOnly", e.target.checked)} className="accent-amber-500 w-3 h-3 rounded" />
                      <span className="text-zinc-400">Has PFP</span>
                    </label>
                  </div>
                  <div className="space-y-4">
                    <DualRangeSlider
                      label="Token Count"
                      min={0}
                      max={TOKEN_COUNT_SLIDER_MAX}
                      step={1}
                      valueMin={filters.minTokenCount}
                      valueMax={filters.maxTokenCount}
                      defaultMin={0}
                      defaultMax={TOKEN_COUNT_SLIDER_MAX}
                      formatValue={(v, isMax) => v == null ? (isMax ? "No limit" : "Any") : `${v}`}
                      onChange={(lo, hi) => { updateFilter("minTokenCount", lo); updateFilter("maxTokenCount", hi); }}
                    />
                    <div>
                      <div className="flex justify-between text-zinc-500 mb-1.5">
                        <span>Min Bond Rate (%)</span>
                        <span className="font-mono text-white text-[10px]">{filters.minBondRate == null ? "Any" : `${filters.minBondRate}%`}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={BOND_RATE_SLIDER_MAX}
                        step={1}
                        value={filters.minBondRate ?? 0}
                        onChange={(e) => updateFilter("minBondRate", e.target.valueAsNumber === 0 ? null : e.target.valueAsNumber)}
                        className="w-full h-2 rounded-full appearance-none bg-white/10 accent-amber-500"
                      />
                    </div>
                    {(() => {
                      const followersDisabled = METRICS_FOLLOWERS_DISABLED.has(metric);
                      const followersTooltip = "Follower count is only available for Total Volume, Followers, Engagement, and Total Creator Fees. Not yet available for this metric.";
                      return (
                        <div className={`relative ${followersDisabled ? "opacity-50" : ""}`}>
                          {followersDisabled && (
                            <div
                              className="absolute inset-0 z-10 cursor-not-allowed"
                              title={followersTooltip}
                              aria-label={followersTooltip}
                            />
                          )}
                          <div className={followersDisabled ? "pointer-events-none" : ""}>
                            <div className="flex justify-between text-zinc-500 mb-1.5">
                              <span>Min Followers{followersDisabled && <span className="normal-case font-normal text-zinc-600 ml-1">(not available for this metric)</span>}</span>
                              <span className="font-mono text-white text-[10px]">{filters.minFollowers == null ? "Any" : fmtCompact(filters.minFollowers)}</span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={FOLLOWERS_SLIDER_MAX}
                              step={FOLLOWERS_SLIDER_STEP}
                              value={filters.minFollowers ?? 0}
                              onChange={(e) => updateFilter("minFollowers", e.target.valueAsNumber === 0 ? null : e.target.valueAsNumber)}
                              className="w-full h-2 rounded-full appearance-none bg-white/10 accent-amber-500"
                              disabled={followersDisabled}
                            />
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Active count */}
                {countActiveFilters(filters) > 0 && (
                  <p className="mt-3 pt-3 border-t border-white/5 text-zinc-500 text-center">
                    Showing {deployers.length} deployers with {countActiveFilters(filters)} active filter{countActiveFilters(filters) !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="flex-1 min-h-[200px] mx-2 mb-2 rounded-2xl border border-white/5 bg-white/[0.01] overflow-hidden"
            >
              <EChartsWrapper
                option={option}
                chartType={chartType}
                onChartReady={() => setChartReady(true)}
                onChartClick={expandingDeployer || splittingDeployer || expandedDeployer ? undefined : handleChartClick}
                onTokenClick={expandedDeployer ? handleTokenClick : undefined}
              />
            </motion.div>
          </>
  ) : (
    <div className="flex-1 px-4 py-4 min-h-[600px]">
      <LivePulse 
        coins={liveCoins} 
        velocity={liveVelocity} 
        successRate={liveSuccessRate}
        knownCreators={knownCreatorsMap}
        marketActivity={pulseMarketActivityMap}
        onCoinClick={(coin) => {
          const token: CreatorAggregateToken = {
            name: coin.name,
            symbol: coin.symbol,
            usd_market_cap: coin.usd_market_cap,
            volume: 0, 
            mint: coin.mint,
            description: coin.description,
            image_uri: coin.image_uri,
            created_timestamp: coin.created_timestamp,
            last_trade_timestamp: coin.last_trade_timestamp,
            complete: coin.complete,
            ath_market_cap: coin.ath_market_cap
          };
          setSelectedToken(token);
        }}
      />
    </div>
  )}

      {/* Footer */}
      <footer className="shrink-0 py-3 border-t border-white/5">
        <div className="flex items-center justify-center gap-3 text-[10px] text-zinc-700">
          <span>© {new Date().getFullYear()} Eve · 4mVbX7EZonRcEfiyFbbw2ByrYc7xAkUMp3NKWhDwpump</span>
          <a
            href="https://discord.com/invite/n7vBHFf5VF"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-zinc-600 hover:text-zinc-400 transition-colors"
            aria-label="Join Eve Army on Discord"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
            Discord
          </a>
        </div>
      </footer>

      <DeployerDetail deployer={selected} metricLabels={METRIC_LABELS} onClose={() => setSelected(null)} />
      <TokenDetailPanel token={selectedToken} onClose={() => setSelectedToken(null)} />
    </div>
  );
}
