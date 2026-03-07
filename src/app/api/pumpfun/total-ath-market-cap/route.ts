import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const apiUrl = `https://songjamspace-leaderboard.logesh-063.workers.dev/pumpfun_total_ath_market_cap`;

    const res = await fetch(apiUrl, {
      next: { revalidate: 3600 } // Cache for 1 hour
    });

    if (!res.ok) {
      throw new Error(`Total ATH Market Cap API responded with status: ${res.status}`);
    }

    const json = await res.json();
    const allData = json.data || [];
    const total = allData.length;
    
    // Slice from index 1 to skip the system Solana address, then take top 50
    const slicedData = allData.slice(1, 51).map((creator: any) => ({
      ...creator,
      top_tokens: (creator.top_tokens || []).slice(0, 50),
      bonded_tokens: (creator.bonded_tokens || []).slice(0, 20),
    }));

    return NextResponse.json({ 
      success: true, 
      total, 
      data: slicedData 
    });
  } catch (error: any) {
    console.error("Error fetching total ATH market cap creators:", error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
