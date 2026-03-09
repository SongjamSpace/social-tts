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

    const url = `https://frontend-api-v3.pump.fun/users/${address}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });

    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json({ success: true, data: null });
      }
      return NextResponse.json({ success: false, error: `API ${res.status}` }, { status: res.status });
    }

    const text = await res.text();
    if (!text) {
      return NextResponse.json({ success: true, data: null });
    }
    
    try {
      const data = JSON.parse(text);
      return NextResponse.json({ success: true, data });
    } catch {
      return NextResponse.json({ success: true, data: null });
    }
  } catch (error) {
    console.error("User profile fetch error:", error);
    return NextResponse.json({ success: true, data: null });
  }
}
