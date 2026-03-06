import { NextResponse } from "next/server";

const FEES_URL = "https://swap-api.pump.fun/v1/creators";
const CONCURRENCY = 20;
const MAX_ADDRESSES = 500;

async function fetchFees(address: string): Promise<{ totalFeesSOL: number }> {
  const res = await fetch(
    `${FEES_URL}/${address}/fees/total`,
    { next: { revalidate: 300 } }
  );
  if (!res.ok) return { totalFeesSOL: 0 };
  const data = await res.json();
  const v = parseFloat(data?.totalFeesSOL);
  return { totalFeesSOL: Number.isFinite(v) ? v : 0 };
}

async function runBatched(addresses: string[], concurrency: number): Promise<Record<string, { totalFeesSOL: number }>> {
  const out: Record<string, { totalFeesSOL: number }> = {};
  let index = 0;
  async function worker(): Promise<void> {
    while (index < addresses.length) {
      const i = index++;
      const addr = addresses[i];
      try {
        out[addr] = await fetchFees(addr);
      } catch {
        out[addr] = { totalFeesSOL: 0 };
      }
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, addresses.length) }, () => worker());
  await Promise.all(workers);
  return out;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const addresses = Array.isArray(body?.addresses) ? body.addresses : [];
    if (addresses.length === 0) {
      return NextResponse.json({ fees: {}, fetchedAt: Date.now() });
    }
    const unique = [...new Set(addresses)].slice(0, MAX_ADDRESSES) as string[];
    const fetchedAt = Date.now();
    const fees = await runBatched(unique, CONCURRENCY);

    return NextResponse.json({ fees, fetchedAt });
  } catch (error) {
    console.error("creator-fees batch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch creator fees", fees: {}, fetchedAt: Date.now() },
      { status: 500 }
    );
  }
}
