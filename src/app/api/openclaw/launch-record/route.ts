import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/services/firebase-admin.service";
import { FieldValue } from "firebase-admin/firestore";

/** Shape of seed payload we store: Name, Ticker, Description, Website, X (twitter), Telegram, Image (imageUrl), Personality (tone). */
interface SeedPayload {
  name?: string;
  ticker?: string;
  description?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  imageUrl?: string;
  tone?: string;
  extra?: Record<string, unknown>;
  imagePrompt?: string;
}

const OPENCLAW_LAUNCHES = "openclaw_launches";

/**
 * POST /api/openclaw/launch-record
 * Body: { mint: string, creator: string, seedPayload: SeedPayload }
 * Writes a launch record to Firestore for later profile/hatch use.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mint = typeof body?.mint === "string" ? body.mint.trim() : "";
    const creator = typeof body?.creator === "string" ? body.creator.trim() : "";
    const seedPayload = body?.seedPayload as SeedPayload | undefined;

    if (!mint || !creator) {
      return NextResponse.json(
        { error: "mint and creator are required" },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const docRef = db.collection(OPENCLAW_LAUNCHES).doc(mint);
    await docRef.set({
      mint,
      creator,
      seedPayload: seedPayload ?? {},
      createdAt: FieldValue.serverTimestamp(),
      agentUrl: null,
      hatchStatus: null,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[openclaw/launch-record]", e);
    return NextResponse.json(
      { error: "Failed to record launch" },
      { status: 500 }
    );
  }
}
