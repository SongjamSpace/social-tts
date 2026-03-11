import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mint: string }> }
) {
  const { mint } = await params;

  if (!mint) {
    return NextResponse.json({ error: "Mint address is required" }, { status: 400 });
  }

  try {
    const res = await fetch(`https://livechat.pump.fun/viewers/${mint}/count`, {
      next: { revalidate: 30 }, // Cache for 30 seconds
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
    console.error(`Error in viewers API for ${mint}:`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
