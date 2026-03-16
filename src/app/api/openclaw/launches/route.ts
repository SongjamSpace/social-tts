import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/services/firebase-admin.service";

const OPENCLAW_LAUNCHES = "openclaw_launches";

/** When set (e.g. in prod), only this mint is returned from the launches API. Unset to show all. */
const PROD_SINGLE_MINT = process.env.NEXT_PUBLIC_OPENCLAW_PROD_SINGLE_MINT?.trim() || null;

/**
 * GET /api/openclaw/launches?creator=WALLET
 * Returns OpenClaw launch records for the given creator wallet (for profile "my agents").
 * When NEXT_PUBLIC_OPENCLAW_PROD_SINGLE_MINT is set, only that mint is returned (temporary prod filter).
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

    let launches = snapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        mint: d.mint,
        creator: d.creator,
        seedPayload: d.seedPayload ?? {},
        createdAt: d.createdAt?.toMillis?.() ?? null,
        agentUrl: d.agentUrl ?? null,
        hatchStatus: d.hatchStatus ?? null,
        dropletIp: d.dropletIp ?? null,
      };
    });

    if (PROD_SINGLE_MINT) {
      launches = launches.filter((l) => l.mint === PROD_SINGLE_MINT);
    }

    return NextResponse.json({ success: true, launches });
  } catch (e) {
    console.error("[openclaw/launches]", e);
    return NextResponse.json(
      { error: "Failed to fetch launches" },
      { status: 500 }
    );
  }
}
