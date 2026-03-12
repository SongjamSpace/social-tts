import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/services/firebase-admin.service";

const OPENCLAW_LAUNCHES = "openclaw_launches";

/**
 * GET /api/openclaw/launches?creator=WALLET
 * Returns OpenClaw launch records for the given creator wallet (for profile "my agents").
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const creator = searchParams.get("creator")?.trim();
    if (!creator) {
      return NextResponse.json(
        { error: "creator query is required" },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const snapshot = await db
      .collection(OPENCLAW_LAUNCHES)
      .where("creator", "==", creator)
      .get();

    const launches = snapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        mint: d.mint,
        creator: d.creator,
        seedPayload: d.seedPayload ?? {},
        createdAt: d.createdAt?.toMillis?.() ?? null,
        agentUrl: d.agentUrl ?? null,
        hatchStatus: d.hatchStatus ?? null,
      };
    });

    return NextResponse.json({ success: true, launches });
  } catch (e) {
    console.error("[openclaw/launches]", e);
    return NextResponse.json(
      { error: "Failed to fetch launches" },
      { status: 500 }
    );
  }
}
