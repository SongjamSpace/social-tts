import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/services/firebase-admin.service";

const OPENCLAW_LAUNCHES = "openclaw_launches";
const HATCH_INTENTS = "hatch_intents";

/**
 * POST /api/openclaw/hatch-reset
 * Body: { mint: string, secret?: string }
 * Resets hatch state for the given mint so you can go through the flow again:
 * - Deletes the hatch intent (payment will be required again)
 * - Clears agentUrl, hatchStatus, hatchedAt on the launch record
 * Requires BACKFILL_SECRET or HATCH_RESET_SECRET in body when set in env.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mint = typeof body?.mint === "string" ? body.mint.trim() : "";
    const secret = typeof body?.secret === "string" ? body.secret.trim() : "";

    if (!mint) {
      return NextResponse.json({ error: "mint is required" }, { status: 400 });
    }

    const expectedSecret =
      process.env.HATCH_RESET_SECRET?.trim() || process.env.BACKFILL_SECRET?.trim();
    if (expectedSecret && expectedSecret !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getAdminFirestore();

    const intentRef = db.collection(HATCH_INTENTS).doc(mint);
    await intentRef.delete();

    const launchRef = db.collection(OPENCLAW_LAUNCHES).doc(mint);
    const launchSnap = await launchRef.get();
    if (launchSnap.exists) {
      await launchRef.update({
        agentUrl: null,
        hatchStatus: null,
        hatchedAt: null,
      });
    }

    return NextResponse.json({ success: true, mint });
  } catch (e) {
    console.error("[openclaw/hatch-reset]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Reset failed" },
      { status: 500 }
    );
  }
}
