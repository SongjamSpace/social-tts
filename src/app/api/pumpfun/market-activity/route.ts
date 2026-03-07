import { NextResponse } from "next/server";

const MARKET_ACTIVITY_URL = "https://swap-api.pump.fun/v1/coins";
const CONCURRENCY = 40;
const MAX_MINTS = 2000;

export type VolumeByWindow = {
  volume5m: number;
  volume1h: number;
  volume6h: number;
  volume24h: number;
};

function parseVol(v: unknown): number {
  const n = typeof v === "number" && !Number.isNaN(v) ? v : 0;
  return n >= 0 ? n : 0;
}

async function fetchMarketActivity(mint: string): Promise<VolumeByWindow> {
  const res = await fetch(
    `${MARKET_ACTIVITY_URL}/${mint}/market-activity?program=pump`,
    { next: { revalidate: 300 } }
  );
  if (!res.ok) return { volume5m: 0, volume1h: 0, volume6h: 0, volume24h: 0 };
  const data = await res.json();
  const v5m = data?.["5m"]?.volumeUSD ?? data?.["5min"]?.volumeUSD;
  const v1h = data?.["1h"]?.volumeUSD;
  const v6h = data?.["6h"]?.volumeUSD;
  const v24h = data?.["24h"]?.volumeUSD;
  return {
    volume5m: parseVol(v5m),
    volume1h: parseVol(v1h),
    volume6h: parseVol(v6h),
    volume24h: parseVol(v24h),
  };
}

async function runBatched(mints: string[], concurrency: number): Promise<Record<string, VolumeByWindow>> {
  const out: Record<string, VolumeByWindow> = {};
  let index = 0;
  async function worker(): Promise<void> {
    while (index < mints.length) {
      const i = index++;
      const mint = mints[i];
      try {
        out[mint] = await fetchMarketActivity(mint);
      } catch {
        out[mint] = { volume5m: 0, volume1h: 0, volume6h: 0, volume24h: 0 };
      }
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, mints.length) }, () => worker());
  await Promise.all(workers);
  return out;
}

// Expects mints in priority order (e.g. most active / recently traded first). They are processed in that order.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mints = Array.isArray(body?.mints) ? body.mints : [];
    if (mints.length === 0) {
      return NextResponse.json({ marketActivity: {}, fetchedAt: Date.now() });
    }
    const unique = [...new Set(mints)].slice(0, MAX_MINTS) as string[];
    const fetchedAt = Date.now();
    const marketActivity = await runBatched(unique, CONCURRENCY);

    return NextResponse.json({ marketActivity, fetchedAt });
  } catch (error) {
    console.error("market-activity batch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch market activity", marketActivity: {}, fetchedAt: Date.now() },
      { status: 500 }
    );
  }
}
