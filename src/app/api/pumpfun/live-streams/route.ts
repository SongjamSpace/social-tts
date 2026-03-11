import { NextResponse } from "next/server";
import { type PumpFunCoin } from "@/types/pumpfun";

export async function GET() {
  try {
    const res = await fetch(
      "https://frontend-api-v3.pump.fun/coins/search-unrestricted?currentlyLive=true&sort=last_trade_timestamp&limit=50&includeNsfw=false",
      {
        next: { revalidate: 60 }, // Cache for 1 minute
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch live tokens from Pump.fun" },
        { status: res.status }
      );
    }

    const data = await res.json();
    
    // Filter by complete: false as requested
    const filtered = (data.coins || data || []).filter((c: PumpFunCoin) => c.complete === false);
    
    return NextResponse.json(filtered);
  } catch (error) {
    console.error("Error in live-streams API:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
