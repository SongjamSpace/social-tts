import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '300';
    const includeNsfw = searchParams.get('includeNsfw') || 'false';
    const userId = searchParams.get('userId') || 'BSBcd7BnKgDiKkraALKPA6Q4wmoqCvweGSaTZocB2G2X';
    
    // Construct the external API URL with query params
    const apiUrl = `https://frontend-api-v3.pump.fun/coins/recommended?limit=${limit}&includeNsfw=${includeNsfw}&userId=${userId}`;

    const res = await fetch(apiUrl, {
      next: { revalidate: 60 } // Cache the response for 60 seconds
    });

    if (!res.ok) {
      throw new Error(`PumpFun API responded with status: ${res.status}`);
    }

    const data = await res.json();

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Error fetching recommended coins from PumpFun API:", error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
