import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/services/firebase-admin.service";

const OPENCLAW_LAUNCHES = "openclaw_launches";

/**
 * GET /api/openclaw/launch/[mint]
 * Returns a single launch record by mint (for hatch onboarding to load seed payload).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ mint: string }> }
) {
  try {
    const { mint } = await params;
    const decoded = decodeURIComponent(mint);
    if (!decoded) {
      return NextResponse.json({ error: "mint required" }, { status: 400 });
    }

    const db = getAdminFirestore();
    const doc = await db.collection(OPENCLAW_LAUNCHES).doc(decoded).get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Launch not found" }, { status: 404 });
    }
    const d = doc.data()!;
    const createdAt = d.createdAt;
    return NextResponse.json({
      success: true,
      launch: {
        mint: d.mint,
        creator: d.creator,
        seedPayload: d.seedPayload ?? {},
        createdAt: createdAt?.toMillis?.() ?? null,
        agentUrl: d.agentUrl ?? null,
        hatchStatus: d.hatchStatus ?? null,
        gatewayToken: d.gatewayToken ?? null,
        dropletIp: d.dropletIp ?? null,
      },
    });
  } catch (e) {
    console.error("[openclaw/launch GET]", e);
    return NextResponse.json(
      { error: "Failed to fetch launch" },
      { status: 500 }
    );
  }
}
