import { NextResponse } from "next/server";
import { PumpChatClient } from "pump-chat-client";
import type {
  CoinTrade,
  CoinClip,
  ChatMessage,
  ParticipantInsight,
  CreatorInsightCoin,
  CreatorInsightResponse,
} from "@/types/pumpfun";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // allow longer serverless timeout

/* ── helpers ────────────────────────────────────────────────── */

async function fetchCreatedCoins(creator: string) {
  const url = `https://frontend-api-v3.pump.fun/coins-v2/user-created-coins/${creator}?limit=1&offset=0`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`coins API ${res.status}`);
  const json = await res.json();
  return json.coins as any[];
}

async function fetchTrades(mint: string): Promise<CoinTrade[]> {
  const all: CoinTrade[] = [];
  let cursor = 0;
  // paginate up to 500 trades max
  for (let i = 0; i < 5; i++) {
    const url = `https://swap-api.pump.fun/v2/coins/${mint}/trades?limit=100&cursor=${cursor}&minSolAmount=0.05&program=pump`;
    const res = await fetch(url);
    if (!res.ok) break;
    const json = await res.json();
    const trades: CoinTrade[] = json.trades ?? json ?? [];
    if (!trades.length) break;
    all.push(...trades);
    cursor += 100;
    if (trades.length < 100) break;
  }
  return all;
}

async function fetchClips(mint: string): Promise<CoinClip[]> {
  const url = `https://livestream-api.pump.fun/clips/${mint}?limit=20&clipType=COMPLETE`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.clips ?? []) as CoinClip[];
}

/** Force-kill a PumpChatClient so its auto-reconnect never fires. */
function destroyClient(client: any) {
  try {
    // Remove all listeners first to prevent reconnect callbacks
    client.removeAllListeners?.();
    // Access the underlying socket and kill it
    const sock = client.socket ?? client.ws ?? client._socket ?? client._ws;
    if (sock) {
      sock.onclose = null;
      sock.onerror = null;
      sock.onmessage = null;
      sock.onopen = null;
      if (typeof sock.close === "function") sock.close();
      if (typeof sock.terminate === "function") sock.terminate();
    }
    // Call disconnect as a last resort
    client.disconnect?.();
  } catch {
    // swallow — we just want it dead
  }
}

function fetchChatHistory(roomId: string): Promise<ChatMessage[]> {
  return new Promise<ChatMessage[]>((resolve) => {
    let resolved = false;
    const done = (result: ChatMessage[]) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      destroyClient(client);
      resolve(result);
    };

    const client = new PumpChatClient({
      roomId,
      username: "history-fetcher",
      messageHistoryLimit: 100,
    });

    const timeout = setTimeout(() => done([]), 10_000);

    client.on("messageHistory", (history: any[]) => {
      done(
        history.map((m: any) => ({
          username: m.username ?? m.user ?? "",
          text: m.text ?? m.message ?? "",
          timestamp: m.timestamp ?? 0,
          profileImage: m.profileImage ?? m.profile_image ?? undefined,
          userId: m.userId ?? m.user_id ?? undefined,
        }))
      );
    });

    client.on("error", () => done([]));

    try {
      client.connect();
    } catch {
      done([]);
    }
  });
}

/* ── aggregation ───────────────────────────────────────────── */

function aggregate(
  trades: CoinTrade[],
  allMessages: ChatMessage[]
): ParticipantInsight[] {
  const map = new Map<
    string,
    {
      buyCount: number;
      sellCount: number;
      buyVolSol: number;
      sellVolSol: number;
      buyVolUsd: number;
      sellVolUsd: number;
      msgCount: number;
      firstSeen: string;
      username?: string;
      profileImage?: string;
    }
  >();

  const getOrInit = (key: string) => {
    if (!map.has(key)) {
      map.set(key, {
        buyCount: 0,
        sellCount: 0,
        buyVolSol: 0,
        sellVolSol: 0,
        buyVolUsd: 0,
        sellVolUsd: 0,
        msgCount: 0,
        firstSeen: new Date().toISOString(),
      });
    }
    return map.get(key)!;
  };

  // trades
  for (const t of trades) {
    const p = getOrInit(t.userAddress);
    const sol = parseFloat(t.amountSol) || 0;
    const usd = parseFloat(t.amountUsd) || 0;
    if (t.type === "buy") {
      p.buyCount++;
      p.buyVolSol += sol;
      p.buyVolUsd += usd;
    } else {
      p.sellCount++;
      p.sellVolSol += sol;
      p.sellVolUsd += usd;
    }
    if (t.timestamp < p.firstSeen) p.firstSeen = t.timestamp;
  }

  // messages
  for (const m of allMessages) {
    // messages only have username, not wallet; we still track them
    const key = m.userId || m.username || "unknown";
    const p = getOrInit(key);
    p.msgCount++;
    if (m.username) p.username = m.username;
    if (m.profileImage) p.profileImage = m.profileImage;
    const ts = m.timestamp
      ? new Date(m.timestamp).toISOString()
      : new Date().toISOString();
    if (ts < p.firstSeen) p.firstSeen = ts;
  }

  // build array + contribution score
  const participants: ParticipantInsight[] = [];
  for (const [address, d] of map) {
    const totalVolSol = d.buyVolSol + d.sellVolSol;
    // 70% volume weight, 30% message weight (normalised later)
    const rawScore = totalVolSol * 0.7 + d.msgCount * 0.3;
    participants.push({
      address,
      username: d.username,
      profileImage: d.profileImage,
      buyCount: d.buyCount,
      sellCount: d.sellCount,
      buyVolumeSol: +d.buyVolSol.toFixed(4),
      sellVolumeSol: +d.sellVolSol.toFixed(4),
      buyVolumeUsd: +d.buyVolUsd.toFixed(2),
      sellVolumeUsd: +d.sellVolUsd.toFixed(2),
      netVolumeSol: +(d.buyVolSol - d.sellVolSol).toFixed(4),
      messageCount: d.msgCount,
      firstSeen: d.firstSeen,
      contributionScore: +rawScore.toFixed(4),
    });
  }

  // normalise contribution score to 0-100
  const maxScore = Math.max(...participants.map((p) => p.contributionScore), 1);
  for (const p of participants) {
    p.contributionScore = +((p.contributionScore / maxScore) * 100).toFixed(2);
  }

  // sort descending by contribution
  participants.sort((a, b) => b.contributionScore - a.contributionScore);
  return participants;
}

/* ── GET handler ───────────────────────────────────────────── */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");
    if (!address) {
      return NextResponse.json(
        { error: "address query param is required" },
        { status: 400 }
      );
    }

    // 1. fetch latest coin
    const coins = await fetchCreatedCoins(address);
    if (!coins.length) {
      return NextResponse.json(
        { error: "No coins found for this creator" },
        { status: 404 }
      );
    }
    const raw = coins[0];
    const coin: CreatorInsightCoin = {
      mint: raw.mint,
      name: raw.name,
      symbol: raw.symbol,
      image_uri: raw.image_uri,
      usd_market_cap: raw.usd_market_cap,
      ath_market_cap: raw.ath_market_cap,
      created_timestamp: raw.created_timestamp,
      complete: raw.complete,
      reply_count: raw.reply_count,
      creator: raw.creator,
    };

    // 2. fetch trades + clips in parallel
    const [trades, clips] = await Promise.all([
      fetchTrades(coin.mint),
      fetchClips(coin.mint),
    ]);

    // 3. fetch chat history for each clip (parallel, max 10 concurrent)
    const allMessages: ChatMessage[] = [];
    const roomNames = [...new Set(clips.map((c) => c.roomName))];
    const BATCH = 10;
    for (let i = 0; i < roomNames.length; i += BATCH) {
      const batch = roomNames.slice(i, i + BATCH);
      const results = await Promise.all(batch.map(fetchChatHistory));
      for (const msgs of results) allMessages.push(...msgs);
    }

    // 4. aggregate
    const participants = aggregate(trades, allMessages);

    const response: CreatorInsightResponse = {
      coin,
      totalParticipants: participants.length,
      totalBuyVolumeSol: +participants
        .reduce((s, p) => s + p.buyVolumeSol, 0)
        .toFixed(4),
      totalSellVolumeSol: +participants
        .reduce((s, p) => s + p.sellVolumeSol, 0)
        .toFixed(4),
      totalMessages: allMessages.length,
      totalClips: clips.length,
      participants,
    };

    return NextResponse.json({ success: true, data: response });
  } catch (error: any) {
    console.error("Creator insight error:", error);
    return NextResponse.json(
      { success: false, error: error.message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}
