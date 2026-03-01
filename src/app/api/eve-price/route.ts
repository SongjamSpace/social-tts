import { NextResponse } from "next/server";

const EVE_MINT = process.env.NEXT_PUBLIC_EVE_MINT || "4mVbX7EZonRcEfiyFbbw2ByrYc7xAkUMp3NKWhDwpump";
const CACHE_TTL_MS = 30_000;

let cached: { pricePerSol: number; timestamp: number } | null = null;

export async function GET() {
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ pricePerSol: cached.pricePerSol });
  }

  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${EVE_MINT}`,
      { next: { revalidate: 30 } }
    );

    if (!res.ok) {
      throw new Error(`DexScreener API returned ${res.status}`);
    }

    const json = await res.json();
    const solPair = json.pairs?.find(
      (p: any) => p.quoteToken?.symbol === "SOL"
    );

    if (!solPair?.priceNative) {
      throw new Error("No SOL price data for EVE token");
    }

    // priceNative = price of 1 EVE in SOL
    const pricePerSol = Number(solPair.priceNative);
    cached = { pricePerSol, timestamp: Date.now() };

    return NextResponse.json({ pricePerSol });
  } catch (err: any) {
    console.error("EVE price fetch error:", err);
    return NextResponse.json(
      { error: err.message ?? "Failed to fetch EVE price" },
      { status: 502 }
    );
  }
}
