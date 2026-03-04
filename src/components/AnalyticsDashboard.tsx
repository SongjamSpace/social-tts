"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, DollarSign, Brain, Grid3X3, PieChart, ScatterChart, Activity, Target, Layers, Rows3, Circle } from "lucide-react";
import type { EChartsOption } from "echarts";
import {
  DEPLOYERS,
  METRIC_LABELS,
  METRIC_UNITS,
  type MetricKey,
  type Deployer,
} from "@/lib/dummyData";
import DeployerDetail from "./DeployerDetail";

type ChartType = "treemap" | "bar" | "barH" | "pie" | "scatter" | "radar" | "sunburst" | "funnel" | "packed" | "line" | "heatmap";

const CHART_TYPES: { key: ChartType; label: string; icon: React.ReactNode }[] = [
  { key: "treemap", label: "Treemap", icon: <Grid3X3 className="w-3.5 h-3.5" /> },
  { key: "bar", label: "Bar", icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { key: "barH", label: "Horizontal Bar", icon: <Rows3 className="w-3.5 h-3.5" /> },
  { key: "pie", label: "Pie / Donut", icon: <PieChart className="w-3.5 h-3.5" /> },
  { key: "scatter", label: "Scatter", icon: <ScatterChart className="w-3.5 h-3.5" /> },
  { key: "radar", label: "Radar", icon: <Target className="w-3.5 h-3.5" /> },
  { key: "sunburst", label: "Sunburst", icon: <Circle className="w-3.5 h-3.5" /> },
  { key: "funnel", label: "Funnel", icon: <Layers className="w-3.5 h-3.5" /> },
  { key: "line", label: "Ranking Line", icon: <Activity className="w-3.5 h-3.5" /> },
];

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

function deployerColor(d: Deployer, maxMs: number): string {
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

function richTooltip(d: Deployer): string {
  const avatar = d.avatarUrl
    ? `<img src="${d.avatarUrl}" alt="" style="width:40px;height:40px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:10px" />`
    : "";
  return `<div style="font-family:'DM Sans',sans-serif;font-size:12px;line-height:1.6">
    <div style="margin-bottom:8px">${avatar}<strong style="font-size:14px;vertical-align:middle">${d.displayName}</strong></div>
    <span style="color:#a1a1aa">Volume:</span> ${fmtCompact(d.totalVolume)} SOL<br/>
    <span style="color:#a1a1aa">Market Cap:</span> ${fmtCompact(d.totalMarketCap)} SOL<br/>
    <span style="color:#a1a1aa">Creator Fees:</span> ${fmtCompact(d.totalCreatorFees)} SOL<br/>
    <span style="color:#a1a1aa">Mindshare:</span> ${d.mindshare}<br/>
    <span style="color:#a1a1aa">Tokens:</span> ${d.tokenCount}
  </div>`;
}

/** Intro animation: particles burst from center, colored by deployer, with groupId for universalTransition merge into treemap. */
function buildParticleOption(mindshareMax: number): EChartsOption {
  const cx = 500;
  const cy = 500;
  const particles: { value: number[]; groupId: string; itemStyle: { color: string; opacity: number } }[] = [];

  const seededRandom = (seed: number) => {
    let s = seed;
    return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };
  };

  DEPLOYERS.forEach((d, di) => {
    const color = deployerColor(d, mindshareMax);
    const count = 6 + Math.min(Math.round(d.mindshare / 10), 6);
    const rng = seededRandom(di * 7919 + 31);

    for (let j = 0; j < count; j++) {
      const angle = rng() * Math.PI * 2;
      const dist = 200 + rng() * 300;
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;
      particles.push({
        value: [x, y],
        groupId: d.address,
        itemStyle: { color, opacity: 0.5 + rng() * 0.5 },
      });
    }
  });

  return {
    backgroundColor: "#060608",
    tooltip: { show: false },
    grid: { left: 0, right: 0, top: 0, bottom: 0 },
    xAxis: { type: "value" as const, min: 0, max: 1000, show: false },
    yAxis: { type: "value" as const, min: 0, max: 1000, show: false },
    series: [{
      type: "scatter",
      id: "tokens",
      universalTransition: { enabled: true },
      symbolSize: (data: any) => 3 + Math.random() * 4,
      data: particles,
      animationDuration: 800,
      animationEasing: "cubicOut",
      animationDelay: (idx: number) => idx * 4,
    }],
  } as any;
}

function buildDrilldownOption(deployer: Deployer, mindshareMax: number, onBack: () => void): EChartsOption {
  const color = deployerColor(deployer, mindshareMax);
  const tokens = deployer.topTokens;
  const maxMcap = Math.max(...tokens.map((t) => t.marketCap), 1);

  const socials: { label: string; url: string }[] = [];
  socials.push({ label: "pump.fun", url: `https://pump.fun/profile/${deployer.address}` });
  socials.push({ label: "Solscan", url: `https://solscan.io/account/${deployer.address}` });
  if (deployer.twitterUrl) socials.push({ label: "X / Twitter", url: deployer.twitterUrl });
  if (deployer.telegramUrl) socials.push({ label: "Telegram", url: deployer.telegramUrl });
  if (deployer.websiteUrl) socials.push({ label: "Website", url: deployer.websiteUrl });

  const truncAddr = `${deployer.address.slice(0, 6)}...${deployer.address.slice(-4)}`;

  const metrics: { label: string; value: string }[] = [
    { label: "Volume", value: `${fmtCompact(deployer.totalVolume)} SOL` },
    { label: "Market Cap", value: `${fmtCompact(deployer.totalMarketCap)} SOL` },
    { label: "Creator Fees", value: `${fmtCompact(deployer.totalCreatorFees)} SOL` },
    { label: "Mindshare", value: deployer.mindshare.toFixed(1) },
    { label: "Tokens", value: deployer.tokenCount.toString() },
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

  if (deployer.avatarUrl) {
    graphic.push({
      type: "image",
      left: 12,
      top: 38,
      style: { image: deployer.avatarUrl, width: 44, height: 44 },
      z: 100,
    });
  }

  graphic.push({
    type: "text",
    left: deployer.avatarUrl ? 64 : 12,
    top: 40,
    style: {
      text: deployer.displayName,
      fill: "#fff",
      fontSize: 18,
      fontWeight: 700,
      fontFamily: "'DM Sans', sans-serif",
    },
    z: 100,
  });

  graphic.push({
    type: "text",
    left: deployer.avatarUrl ? 64 : 12,
    top: 62,
    style: {
      text: truncAddr,
      fill: "rgba(255,255,255,0.35)",
      fontSize: 11,
      fontFamily: "'JetBrains Mono', monospace",
    },
    z: 100,
  });

  socials.forEach((s, i) => {
    graphic.push({
      type: "text",
      left: 12 + i * 100,
      top: 92,
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

  metrics.forEach((m, i) => {
    const xOffset = 12 + i * 130;
    graphic.push({
      type: "group",
      left: xOffset,
      top: 118,
      children: [
        {
          type: "rect",
          shape: { width: 120, height: 46, r: 8 },
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

  return {
    animation: true,
    animationDurationUpdate: 700,
    animationEasingUpdate: "cubicOut",
    backgroundColor: "#060608",
    graphic,
    tooltip: {
      ...TOOLTIP_BASE,
      formatter: (params: any) => {
        const t = params.data?.token;
        if (!t) return params.name || "";
        return `<div style="font-family:'DM Sans',sans-serif;font-size:12px;line-height:1.6">
          <strong style="font-size:14px">${t.name}</strong> <span style="color:#a1a1aa">${t.symbol}</span><br/>
          <span style="color:#a1a1aa">Market Cap:</span> ${fmtCompact(t.marketCap)} SOL<br/>
          <span style="color:#a1a1aa">Volume:</span> ${fmtCompact(t.volume)} SOL
        </div>`;
      },
    },
    grid: { left: 60, right: 20, top: 180, bottom: 40 },
    xAxis: {
      type: "category" as const,
      data: tokens.map((t) => t.symbol),
      axisLabel: { color: "#71717a", fontFamily: "'DM Sans', sans-serif", fontSize: 11, rotate: tokens.length > 6 ? 25 : 0 },
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
    },
    yAxis: {
      type: "value" as const,
      name: "Market Cap (SOL)",
      nameTextStyle: { color: "#71717a", fontSize: 10 },
      axisLabel: { color: "#71717a", fontFamily: "'DM Sans', sans-serif", fontSize: 11 },
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.04)" } },
    },
    series: [{
      type: "bar",
      id: "tokens",
      universalTransition: { enabled: true, divideShape: "clone" },
      animationDurationUpdate: 400,
      animationDelayUpdate: 150,
      barMaxWidth: 50,
      data: tokens.map((t) => ({
        name: t.symbol,
        value: t.marketCap,
        token: t,
        id: `${deployer.address}-${t.symbol}`,
        groupId: deployer.address,
        itemStyle: {
          color,
          borderRadius: [4, 4, 0, 0],
          opacity: 0.6 + 0.4 * (t.marketCap / maxMcap),
        },
      })),
      label: {
        show: true,
        position: "top" as const,
        formatter: (p: any) => fmtCompact(p.value),
        color: "rgba(255,255,255,0.5)",
        fontSize: 10,
        fontFamily: "'JetBrains Mono', monospace",
      },
    }],
  };
}

/** Shared children data for Phase 1 and Phase 2 — same ids so ECharts animates between them seamlessly. */
function expandChildren(deployer: Deployer, color: string) {
  return deployer.topTokens.map((t) => ({
    id: `${deployer.address}-${t.symbol}`,
    groupId: deployer.address,
    name: t.symbol,
    value: t.marketCap,
    itemStyle: { color, borderRadius: 0 },
  }));
}

/** Phase 1: clicked deployer rectangle expands to fill the entire canvas (1:1 morph).
 *  Uses deployer color as backgroundColor (same as Phase 2) to prevent blink.
 *  A dark graphic rect behind the treemap simulates the dark background during expansion. */
function buildExpandOption(deployer: Deployer, mindshareMax: number): EChartsOption {
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
      animationDurationUpdate: 700,
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      itemStyle: { borderColor: "#060608", borderWidth: 4, gapWidth: 4 },
      label: { show: false },
      data: [{
        id: deployer.address,
        name: deployer.displayName,
        value: 1,
        itemStyle: { color, borderRadius: 0 },
      }] as any,
    }],
  };
}

/** Phase 2: same children, now with gaps and borders — they visually split apart from the solid block. */
function buildSplitOption(deployer: Deployer, mindshareMax: number): EChartsOption {
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

function buildOption(chartType: ChartType, metric: MetricKey, mindshareMax: number): EChartsOption {
  const unit = METRIC_UNITS[metric];
  const sorted = [...DEPLOYERS].sort((a, b) => b[metric] - a[metric]);
  const top15 = sorted.slice(0, 15);
  const colors = sorted.map((d) => deployerColor(d, mindshareMax));
  const top15Colors = top15.map((d) => deployerColor(d, mindshareMax));

  const commonTooltip = {
    ...TOOLTIP_BASE,
    formatter: (params: any) => {
      const d = (params.data?.deployer ?? params.data?.source) as Deployer | undefined;
      if (d) return richTooltip(d);
      if (params.name) {
        const found = DEPLOYERS.find((dd) => dd.displayName === params.name);
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
            const d = params.data?.deployer as Deployer | undefined;
            if (d) return richTooltip(d);
            const t = params.data?.token;
            if (t) {
              return `<div style="font-family:'DM Sans',sans-serif;font-size:12px;line-height:1.6">
                <strong style="font-size:14px">${t.name}</strong> <span style="color:#a1a1aa">${t.symbol}</span><br/>
                <span style="color:#a1a1aa">Market Cap:</span> ${fmtCompact(t.marketCap)} SOL<br/>
                <span style="color:#a1a1aa">Volume:</span> ${fmtCompact(t.volume)} SOL
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
            DEPLOYERS.forEach((d, i) => {
              const url = d.avatarUrl || "";
              rich[`av${i}`] = url
                ? { width: 22, height: 22, borderRadius: 11, backgroundColor: { image: url } as any }
                : { width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.2)" };
            });
            return {
              show: true,
              position: "insideTopLeft" as any,
              formatter: (p: any) => {
                const d = p.data?.deployer as Deployer | undefined;
                const idx = p.data?.deployerIndex as number | undefined;
                if (d != null && typeof idx === "number") {
                  return `{av${idx}| }  {name|${d.displayName}}\n{val|${fmtCompact(d[metric])}${unit ? " " + unit : ""}}  ·  {tokens|${d.tokenCount} tokens}`;
                }
                const t = p.data?.token;
                if (t) return `{sym|${t.symbol}}\n{mcap|${fmtCompact(t.marketCap)} SOL}\n{vol|Vol: ${fmtCompact(t.volume)} SOL}`;
                return p.name || "";
              },
              rich,
              padding: [6, 8],
            };
          })(),
          data: DEPLOYERS.map((d, deployerIndex) => {
            const baseColor = deployerColor(d, mindshareMax);
            return {
              id: d.address,
              name: d.displayName,
              value: d[metric],
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
        xAxis: { type: "category" as const, data: top15.map((d) => d.displayName), axisLabel: { ...axisStyle.axisLabel, rotate: 35 }, axisLine: axisStyle.axisLine },
        yAxis: { type: "value" as const, ...axisStyle },
        series: [{
          type: "bar",
          data: top15.map((d, i) => ({ value: d[metric], deployer: d, itemStyle: { color: top15Colors[i], borderRadius: [4, 4, 0, 0] } })),
          barMaxWidth: 40,
        }],
      };

    case "barH":
      return {
        tooltip: commonTooltip,
        grid: { left: 120, right: 30, top: 10, bottom: 20 },
        yAxis: { type: "category" as const, data: top15.map((d) => d.displayName).reverse(), axisLabel: axisStyle.axisLabel, axisLine: axisStyle.axisLine },
        xAxis: { type: "value" as const, ...axisStyle },
        series: [{
          type: "bar",
          data: [...top15].reverse().map((d, i) => ({ value: d[metric], deployer: d, itemStyle: { color: top15Colors[top15.length - 1 - i], borderRadius: [0, 4, 4, 0] } })),
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
            name: d.displayName,
            value: d[metric],
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
            const d = params.data?.[3] as Deployer | undefined;
            return d ? richTooltip(d) : "";
          },
        },
        grid: { left: 60, right: 30, top: 30, bottom: 50 },
        xAxis: { type: "value" as const, name: "Volume (SOL)", nameTextStyle: { color: "#71717a", fontSize: 10 }, ...axisStyle },
        yAxis: { type: "value" as const, name: "Market Cap (SOL)", nameTextStyle: { color: "#71717a", fontSize: 10 }, ...axisStyle },
        series: [{
          type: "scatter",
          symbolSize: (data: any) => Math.max(8, Math.sqrt(data[2]) * 1.5),
          data: DEPLOYERS.map((d) => [d.totalVolume, d.totalMarketCap, d.totalCreatorFees, d]),
          itemStyle: { color: (params: any) => { const dd = params.data?.[3] as Deployer; return dd ? deployerColor(dd, mindshareMax) : "#ef4444"; } },
        }],
      };

    case "radar": {
      const radarTop = top15.slice(0, 8);
      const maxVol = Math.max(...radarTop.map((d) => d.totalVolume));
      const maxMcap = Math.max(...radarTop.map((d) => d.totalMarketCap));
      const maxFees = Math.max(...radarTop.map((d) => d.totalCreatorFees));
      const maxTokens = Math.max(...radarTop.map((d) => d.tokenCount));
      const maxMs = Math.max(...radarTop.map((d) => d.mindshare));
      return {
        tooltip: commonTooltip,
        legend: { data: radarTop.map((d) => d.displayName), bottom: 0, textStyle: { color: "#71717a", fontSize: 10 } },
        radar: {
          indicator: [
            { name: "Volume", max: maxVol },
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
            name: d.displayName,
            value: [d.totalVolume, d.totalMarketCap, d.totalCreatorFees, d.tokenCount, d.mindshare],
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
            name: d.displayName,
            value: d[metric],
            deployer: d,
            itemStyle: { color: top15Colors[i] },
            children: d.topTokens.map((t) => ({
              name: t.symbol,
              value: t.marketCap,
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
            name: d.displayName,
            value: d[metric],
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
          data: top15.map((d, i) => ({ value: d[metric], deployer: d, itemStyle: { color: top15Colors[i] } })),
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

function EChartsWrapper({ option, chartType, onChartClick }: { option: EChartsOption; chartType: ChartType; onChartClick?: (d: Deployer) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const echartsRef = useRef<any>(null);
  const onChartClickRef = useRef(onChartClick);
  onChartClickRef.current = onChartClick;

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
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready || !containerRef.current || !echartsRef.current) return;

    if (!instanceRef.current) {
      instanceRef.current = echartsRef.current.init(containerRef.current, undefined, { renderer: "canvas" });
      instanceRef.current.on("click", (params: any) => {
        const d = (params.data?.deployer ?? params.data?.source ?? params.data?.[3]) as Deployer | undefined;
        if (d && typeof d === "object" && "address" in d) onChartClickRef.current?.(d);
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

export default function AnalyticsDashboard() {
  const [metric, setMetric] = useState<MetricKey>("mindshare");
  const [chartType, setChartType] = useState<ChartType>("treemap");
  const [selected, setSelected] = useState<Deployer | null>(null);
  const [introPlaying, setIntroPlaying] = useState(true);
  const [expandingDeployer, setExpandingDeployer] = useState<Deployer | null>(null);
  const [splittingDeployer, setSplittingDeployer] = useState<Deployer | null>(null);
  const [expandedDeployer, setExpandedDeployer] = useState<Deployer | null>(null);
  const phaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totals = useMemo(() => ({
    deployers: DEPLOYERS.length,
    volume: DEPLOYERS.reduce((s, d) => s + d.totalVolume, 0),
    marketCap: DEPLOYERS.reduce((s, d) => s + d.totalMarketCap, 0),
    fees: DEPLOYERS.reduce((s, d) => s + d.totalCreatorFees, 0),
  }), []);

  const mindshareMax = useMemo(() => Math.max(...DEPLOYERS.map((d) => d.mindshare), 1), []);

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
    if (introPlaying && chartType === "treemap") {
      return buildParticleOption(mindshareMax);
    }
    if (chartType === "treemap" && expandingDeployer) {
      return buildExpandOption(expandingDeployer, mindshareMax);
    }
    if (chartType === "treemap" && splittingDeployer) {
      return buildSplitOption(splittingDeployer, mindshareMax);
    }
    if (chartType === "treemap" && expandedDeployer) {
      return buildDrilldownOption(expandedDeployer, mindshareMax, handleBack);
    }
    return buildOption(chartType, metric, mindshareMax);
  }, [chartType, metric, mindshareMax, introPlaying, expandingDeployer, splittingDeployer, expandedDeployer, handleBack]);

  useEffect(() => {
    if (!introPlaying) return;
    const t = setTimeout(() => setIntroPlaying(false), 1200);
    return () => clearTimeout(t);
  }, [introPlaying]);

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

  const handleChartClick = useCallback((d: Deployer) => {
    if (chartType === "treemap") {
      clearPhaseTimeout();
      setExpandedDeployer(null);
      setSplittingDeployer(null);
      setExpandingDeployer(d);
    } else {
      setSelected(d);
    }
  }, [chartType, clearPhaseTimeout]);

  const STAT_CARDS = [
    { label: "Deployers", value: totals.deployers.toString(), unit: "" },
    { label: "Total Volume", value: fmtCompact(totals.volume), unit: "SOL" },
    { label: "Total Market Cap", value: fmtCompact(totals.marketCap), unit: "SOL" },
    { label: "Creator Fees", value: fmtCompact(totals.fees), unit: "SOL" },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-[#060608] text-white overflow-y-auto overflow-x-hidden">
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
                Deployers
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
              return (
                <button
                  key={m.key}
                  onClick={() => { setMetric(m.key); clearPhaseTimeout(); setExpandingDeployer(null); setSplittingDeployer(null); setExpandedDeployer(null); }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border ${
                    active
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
        </motion.div>
      </div>

      {/* Chart — fills remaining viewport */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="flex-1 min-h-[200px] mx-2 mb-2 rounded-2xl border border-white/5 bg-white/[0.01] overflow-hidden"
      >
        <EChartsWrapper option={option} chartType={chartType} onChartClick={expandingDeployer || splittingDeployer || expandedDeployer ? undefined : handleChartClick} />
      </motion.div>

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
    </div>
  );
}
