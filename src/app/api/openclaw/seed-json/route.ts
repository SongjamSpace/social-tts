import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/services/firebase-admin.service";

const OPENCLAW_LAUNCHES = "openclaw_launches";

/**
 * GET /api/openclaw/seed-json?mint=...
 * Returns the seedPayload for the given mint as compact JSON (one line).
 * Use with: SEED_MEMORIES_JSON=$(curl -s 'http://localhost:3000/api/openclaw/seed-json?mint=...') node server.js
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mint = searchParams.get("mint")?.trim();
    if (!mint) {
      return NextResponse.json({ error: "mint query required" }, { status: 400 });
    }

    const db = getAdminFirestore();
    const doc = await db.collection(OPENCLAW_LAUNCHES).doc(mint).get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Launch not found" }, { status: 404 });
    }
    const d = doc.data()!;
    const seedPayload = d.seedPayload ?? {};

    const body = JSON.stringify(seedPayload);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  } catch (e) {
    console.error("[openclaw/seed-json GET]", e);
    return NextResponse.json(
      { error: "Failed to fetch seed payload" },
      { status: 500 }
    );
  }
}
