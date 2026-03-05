import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { creator: string } }
) {
  try {
    const creator = params.creator;
    if (!creator) {
      return NextResponse.json(
        { success: false, error: 'Creator address is required' },
        { status: 400 }
      );
    }

    const [followersRes, followingRes, summaryRes, balancesRes, createdCoinsRes] = await Promise.all([
      fetch(`https://frontend-api-v3.pump.fun/following/followers/${creator}`),
      fetch(`https://frontend-api-v3.pump.fun/following/${creator}`),
      fetch(`https://profile-api.pump.fun/balance/summary/${creator}`),
      fetch(`https://profile-api.pump.fun/balance/tokens/${creator}?page=1&size=10`),
      fetch(`https://frontend-api-v3.pump.fun/coins-v2/user-created-coins/${creator}?limit=10&offset=0`),
    ]);

    const [followers, following, summaryData, balancesData, createdCoins] = await Promise.all([
      followersRes.ok ? followersRes.json() : [],
      followingRes.ok ? followingRes.json() : [],
      summaryRes.ok ? summaryRes.json() : { success: false, data: null },
      balancesRes.ok ? balancesRes.json() : { success: false, data: { tokens: [] } },
      createdCoinsRes.ok ? createdCoinsRes.json() : [],
    ]);

    return NextResponse.json({
      success: true,
      data: {
        followers,
        following,
        balanceSummary: summaryData.data || null,
        balances: balancesData.data ? balancesData.data.tokens : [],
        createdCoins,
      },
    });
  } catch (error: any) {
    console.error("Error fetching deployer analytics:", error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
