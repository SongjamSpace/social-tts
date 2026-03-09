import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    if (!address) {
      return NextResponse.json({ error: "Address is required" }, { status: 400 });
    }

    // Fetch up to 20 recent coins from this creator to assess performance
    const url = `https://frontend-api-v3.pump.fun/coins-v2/user-created-coins/${address}?limit=20&offset=0`;
    const res = await fetch(url, { next: { revalidate: 3600 } });

    if (!res.ok) {
        if (res.status === 404) {
            return NextResponse.json({ success: true, total: 0, bonded: 0, coins: [] });
        }
      return NextResponse.json({ success: false, error: `API ${res.status}` }, { status: res.status });
    }

    const text = await res.text();
    if (!text) {
        return NextResponse.json({ success: true, total: 0, bonded: 0, coins: [] });
    }

    try {
        const coins = JSON.parse(text);
        if (!Array.isArray(coins)) {
            return NextResponse.json({ success: true, total: 0, bonded: 0, coins: [] });
        }

        const total = coins.length;
        const bonded = coins.filter((c: any) => c.complete === true).length;
        const successRate = total > 0 ? Math.round((bonded / total) * 100) : 0;

        return NextResponse.json({ 
            success: true, 
            total, 
            bonded, 
            successRate,
            coins: coins.map(c => ({
                mint: c.mint,
                symbol: c.symbol,
                name: c.name,
                image_uri: c.image_uri,
                complete: c.complete,
                usd_market_cap: c.usd_market_cap
            }))
        });
    } catch {
        return NextResponse.json({ success: true, total: 0, bonded: 0, coins: [] });
    }
  } catch (error) {
    console.error("Creator tokens fetch error:", error);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
