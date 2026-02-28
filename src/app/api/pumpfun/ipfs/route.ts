import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    
    const response = await fetch("https://pump.fun/api/ipfs", {
      method: "POST",
      body: formData,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Pump.fun API error:", response.status, errorText);
      return NextResponse.json({ error: "Failed to upload to Pump.fun IPFS" }, { status: response.status });
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in /api/pumpfun/ipfs:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
