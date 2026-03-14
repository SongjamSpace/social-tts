import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/services/firebase-admin.service";

const OPENCLAW_LAUNCHES = "openclaw_launches";

/**
 * POST /api/openclaw/spawn-reset
 * Body: { mint: string, wallet?: string }
 * Clears droplet state for the launch (dropletIp, deployDropletId, hatchStatus) so the user can spawn again.
 * Optionally validate wallet is the creator.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const mint = typeof body?.mint === "string" ? body.mint.trim() : "";
    const wallet = typeof body?.wallet === "string" ? body.wallet.trim() : undefined;

    if (!mint) {
      return NextResponse.json({ error: "mint is required" }, { status: 400 });
    }

    const db = getAdminFirestore();
    const launchRef = db.collection(OPENCLAW_LAUNCHES).doc(mint);
    const launchSnap = await launchRef.get();
    if (!launchSnap.exists) {
      return NextResponse.json({ error: "Launch not found" }, { status: 404 });
    }

    const launch = launchSnap.data()!;
    if (wallet && launch.creator !== wallet) {
      return NextResponse.json({ error: "Wallet does not own this launch" }, { status: 403 });
    }

    await launchRef.update({
      dropletIp: null,
      deployDropletId: null,
      hatchStatus: null,
      spawnFirstActiveAt: FieldValue.delete(),
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[openclaw/spawn-reset]", e);
    return NextResponse.json(
      { error: "Failed to reset spawn state" },
      { status: 500 }
    );
  }
}
