import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const apiUrl = `https://songjamspace-leaderboard.logesh-063.workers.dev/pumpfun_bond_rate`;

    const res = await fetch(apiUrl, {
      next: { revalidate: 3600 } // Cache for 1 hour
    });

    if (!res.ok) {
      throw new Error(`Bond Rate API responded with status: ${res.status}`);
    }

    const json = await res.json();
    const allData = json.data || [];
    const total = allData.length;
    
    // Slice to top 50 creators and slice their top_tokens to 50 as well
    const slicedData = allData.slice(0, 50).map((creator: any) => ({
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
    console.error("Error fetching bond rate creators:", error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
