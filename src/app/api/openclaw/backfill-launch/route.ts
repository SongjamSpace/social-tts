import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/services/firebase-admin.service";
import { FieldValue } from "firebase-admin/firestore";

const OPENCLAW_LAUNCHES = "openclaw_launches";
const PUMP_CREATOR_COINS_URL = "https://frontend-api-v3.pump.fun/coins-v2/user-created-coins";

interface PumpCoin {
  mint?: string;
  name?: string;
  symbol?: string;
  image_uri?: string;
  description?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
}

/**
 * POST /api/openclaw/backfill-launch
 * Body: { creator: string, mints?: string[], secret?: string }
 * Adds/updates launch records with full seedPayload (name, ticker, description, website, X, telegram, image, personality).
 * If mints provided, fetches creator's coins from Pump to fill image and metadata; uses merge so existing docs are updated.
 * Optional: set env BACKFILL_SECRET and pass secret in body to authorize the request.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const creator = typeof body?.creator === "string" ? body.creator.trim() : "";
    const mintsFromBody = Array.isArray(body?.mints)
      ? (body.mints as string[]).map((m) => (typeof m === "string" ? m.trim() : "")).filter(Boolean)
      : null;
    const secret = typeof body?.secret === "string" ? body.secret.trim() : "";

    if (!creator) {
      return NextResponse.json(
        { error: "creator is required" },
        { status: 400 }
      );
    }

    const expectedSecret = process.env.BACKFILL_SECRET?.trim();
    if (expectedSecret && expectedSecret !== secret) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    let mints: string[];
    let coinByMint: Record<string, PumpCoin> = {};

    const res = await fetch(
      `${PUMP_CREATOR_COINS_URL}/${encodeURIComponent(creator)}?limit=50&offset=0`
    );
    if (res.ok) {
      const text = await res.text();
      if (text) {
        try {
          const raw = JSON.parse(text) as unknown;
          const coins: PumpCoin[] = Array.isArray(raw)
            ? raw
            : Array.isArray((raw as { coins?: PumpCoin[] })?.coins)
              ? (raw as { coins: PumpCoin[] }).coins
              : [];
          coins.forEach((c) => {
            if (c.mint) coinByMint[c.mint] = c;
          });
        } catch {
          /* ignore */
        }
      }
    }

    if (mintsFromBody && mintsFromBody.length > 0) {
      mints = mintsFromBody;
    } else {
      mints = Object.keys(coinByMint);
      if (mints.length === 0) {
        return NextResponse.json({ success: true, backfilled: 0, mints: [] });
      }
    }

    const db = getAdminFirestore();
    const backfilled: string[] = [];

    for (const mint of mints) {
      const ref = db.collection(OPENCLAW_LAUNCHES).doc(mint);
      const existing = await ref.get();
      const coin = coinByMint[mint];
      const seedPayload = {
        name: coin?.name ?? "",
        ticker: coin?.symbol ?? "",
        description: coin?.description ?? "",
        website: coin?.website ?? "",
        twitter: coin?.twitter ?? "",
        telegram: coin?.telegram ?? "",
        imageUrl: coin?.image_uri ?? "",
        tone: "",
      };

      const data: Record<string, unknown> = {
        mint,
        creator,
        seedPayload,
      };
      if (!existing.exists) {
        data.createdAt = FieldValue.serverTimestamp();
        data.agentUrl = null;
        data.hatchStatus = null;
      }

      await ref.set(data, { merge: true });
      backfilled.push(mint);
    }

    return NextResponse.json({
      success: true,
      backfilled: backfilled.length,
      mints: backfilled,
    });
  } catch (e) {
    console.error("[openclaw/backfill-launch]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Backfill failed" },
      { status: 500 }
    );
  }
}
