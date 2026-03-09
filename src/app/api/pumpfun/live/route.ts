import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const offset = searchParams.get('offset') || '0';
    const limit = searchParams.get('limit') || '48';
    
    // Pump.fun frontend API for latest coins
    const apiUrl = `https://frontend-api-v3.pump.fun/coins?offset=${offset}&limit=${limit}&sort=created_timestamp&includeNsfw=false&order=DESC`;

    const res = await fetch(apiUrl, {
      next: { revalidate: 30 } // Cache for 30 seconds
    });

    if (!res.ok) {
      throw new Error(`PumpFun API responded with status: ${res.status}`);
    }

    const data = await res.json();

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Error fetching live coins from PumpFun API:", error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
