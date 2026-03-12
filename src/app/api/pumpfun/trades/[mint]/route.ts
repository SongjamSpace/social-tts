import { NextRequest, NextResponse } from "next/server";
import { type CoinTrade } from "@/types/pumpfun";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mint: string }> }
) {
  const { mint } = await params;
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit") || "50";

  if (!mint) {
    return NextResponse.json({ error: "Mint address is required" }, { status: 400 });
  }

  try {
    const res = await fetch(`https://swap-api.pump.fun/v2/coins/${mint}/trades?limit=${limit}`, {
      next: { revalidate: 15 }, // Cache for 15 seconds
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch from Pump.fun" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error(`Error in trades API for ${mint}:`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
