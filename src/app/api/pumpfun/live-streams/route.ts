import { NextResponse } from "next/server";
import { type PumpFunCoin } from "@/types/pumpfun";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const offset = searchParams.get("offset") || "0";
    const limit = searchParams.get("limit") || "50";
    const fetchAll = searchParams.get("fetchAll") === "true";

    const fetchPage = async (off: string | number, lim: string | number) => {
      const res = await fetch(
        // `https://frontend-api-v3.pump.fun/coins/search-unrestricted?currentlyLive=true&sort=last_trade_timestamp&limit=${lim}&offset=${off}&includeNsfw=false`,
        `https://frontend-api-v3.pump.fun/coins?offset=${off}&limit=${lim}&sort=created_timestamp&includeNsfw=false&order=DESC`,
        // {
        //   next: { revalidate: 30 }, // Cache for 30 seconds
        // }
      );

      if (!res.ok) {
        throw new Error(`Failed to fetch offset ${off}`);
      }

      const data = await res.json();
      return data.coins || data || [];
    };

    let allCoins: PumpFunCoin[] = [];

    if (fetchAll) {
      // Fetch initial page (offset 0)
      const initialCoins = await fetchPage(0, 50);
      allCoins = [...initialCoins];

      // Loop from offset 50 to 950
      for (let currentOffset = 50; currentOffset <= 950; currentOffset += 50) {
        try {
          const coins = await fetchPage(currentOffset, 50);
          allCoins = [...allCoins, ...coins];
          
          // Small delay to be polite to the API, though not strictly required by user
          // await new Promise(resolve => setTimeout(resolve, 50));
        } catch (err) {
          console.error(`Error fetching offset ${currentOffset}:`, err);
          // Continue to next offset if one fails
        }
      }
    } else {
      allCoins = await fetchPage(offset, limit);
    }

    // Filter by market cap < 30_000
    const filtered = allCoins.filter((c: PumpFunCoin) => c.is_currently_live === true);
    
    return NextResponse.json(filtered);
  } catch (error) {
    console.error("Error in live-streams API:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
