import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/services/firebase-admin.service";

const OPENCLAW_LAUNCHES = "openclaw_launches";
const OPENCLAW_DROPLET_TOKENS = "openclaw_droplet_tokens";

interface OpenClawConnectionBundle {
  version: 1;
  host: string;
  port: number;
  user: string;
  privateKeyPem: string;
  mint?: string;
  label?: string;
}

/**
 * POST /api/openclaw/droplet-token
 * Body: { mint: string, wallet: string, dropletBundle: OpenClawConnectionBundle }
 * Verifies launch.creator === wallet, stores bundle by one-time token, returns { token }.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const mint = typeof body?.mint === "string" ? body.mint.trim() : "";
    const wallet = typeof body?.wallet === "string" ? body.wallet.trim() : "";
    const dropletBundle = body?.dropletBundle as OpenClawConnectionBundle | undefined;

    if (!mint || !wallet) {
      return NextResponse.json(
        { error: "mint and wallet are required" },
        { status: 400 }
      );
    }

    if (
      !dropletBundle ||
      dropletBundle.version !== 1 ||
      typeof dropletBundle.host !== "string" ||
      typeof dropletBundle.privateKeyPem !== "string"
    ) {
      return NextResponse.json(
        { error: "Valid dropletBundle is required" },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const launchRef = db.collection(OPENCLAW_LAUNCHES).doc(mint);
    const launchSnap = await launchRef.get();
    if (!launchSnap.exists) {
      return NextResponse.json({ error: "Launch not found" }, { status: 404 });
    }

    const launch = launchSnap.data()!;
    if (launch.creator !== wallet) {
      return NextResponse.json(
        { error: "Wallet does not own this launch" },
        { status: 403 }
      );
    }

    const token = randomBytes(32).toString("hex");
    const bundleJson = JSON.stringify(dropletBundle);

    await db.collection(OPENCLAW_DROPLET_TOKENS).doc(token).set({
      bundle: bundleJson,
      mint,
      createdAt: Timestamp.now(),
    });

    return NextResponse.json({ token });
  } catch (e) {
    console.error("[openclaw/droplet-token]", e);
    return NextResponse.json(
      { error: "Failed to create droplet token" },
      { status: 500 }
    );
  }
}
