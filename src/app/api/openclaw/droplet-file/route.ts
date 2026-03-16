import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/services/firebase-admin.service";

const OPENCLAW_DROPLET_TOKENS = "openclaw_droplet_tokens";

/**
 * GET /api/openclaw/droplet-file?t=TOKEN
 * Returns the .droplet file as attachment and deletes the token (one-time use).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("t")?.trim();

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    const db = getAdminFirestore();
    const docRef = db.collection(OPENCLAW_DROPLET_TOKENS).doc(token);
    const snap = await docRef.get();

    if (!snap.exists) {
      return NextResponse.json(
        { error: "Link expired or already used" },
        { status: 404 }
      );
    }

    const data = snap.data()!;
    const bundle = data.bundle as string;
    const mint = (data.mint as string) ?? "";

    await docRef.delete();

    const filename = `openclaw-${mint ? mint.slice(0, 8) : "droplet"}.droplet`;
    const byteLength = Buffer.byteLength(bundle, "utf8");

    return new NextResponse(bundle, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[openclaw/droplet-file]", e);
    return NextResponse.json(
      { error: "Failed to fetch droplet file" },
      { status: 500 }
    );
  }
}
