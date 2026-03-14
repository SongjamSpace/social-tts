import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/services/firebase-admin.service";
import { createSpawnDroplet } from "@/lib/digitalocean";

const OPENCLAW_LAUNCHES = "openclaw_launches";
const SPAWN_INTENTS = "spawn_intents";

/**
 * POST /api/openclaw/spawn
 * Body: { mint: string, wallet: string, size: "2gb" | "4gb" }
 * Verifies spawn intent is paid, creates minimal droplet with chosen size, stores deployDropletId on launch.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mint = typeof body?.mint === "string" ? body.mint.trim() : "";
    const wallet = typeof body?.wallet === "string" ? body.wallet.trim() : "";
    const size = body?.size === "4gb" ? "4gb" : "2gb";
    const sshPublicKey = typeof body?.sshPublicKey === "string" ? body.sshPublicKey.trim() : undefined;

    if (!mint || !wallet) {
      return NextResponse.json(
        { error: "mint and wallet are required" },
        { status: 400 }
      );
    }
    if (!sshPublicKey || sshPublicKey.length < 50) {
      return NextResponse.json(
        { error: "SSH public key is required for spawn. Refresh the page and try again." },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();

    const intentSnap = await db.collection(SPAWN_INTENTS).doc(mint).get();
    if (!intentSnap.exists) {
      return NextResponse.json(
        { error: "Spawn intent not found" },
        { status: 404 }
      );
    }
    const intent = intentSnap.data()!;
    const skipPayment = process.env.OPENCLAW_SKIP_SPAWN_PAYMENT === "true" || process.env.OPENCLAW_SKIP_SPAWN_PAYMENT === "1";
    if (!skipPayment && intent.status !== "paid") {
      return NextResponse.json(
        { error: "Payment not confirmed. Complete payment first." },
        { status: 400 }
      );
    }
    if (intent.wallet !== wallet) {
      return NextResponse.json(
        { error: "Wallet does not match spawn intent" },
        { status: 403 }
      );
    }
    if ((intent.size === "4gb" ? "4gb" : "2gb") !== size) {
      return NextResponse.json(
        { error: "Size does not match paid intent" },
        { status: 400 }
      );
    }

    const launchRef = db.collection(OPENCLAW_LAUNCHES).doc(mint);
    const launchSnap = await launchRef.get();
    if (!launchSnap.exists) {
      return NextResponse.json(
        { error: "Launch record not found" },
        { status: 404 }
      );
    }

    const doToken = process.env.DIGITALOCEAN_TOKEN?.trim();
    if (!doToken) {
      return NextResponse.json(
        { error: "VPS not configured. Set DIGITALOCEAN_TOKEN in the server environment." },
        { status: 503 }
      );
    }

    const result = await createSpawnDroplet({ mint, size, sshPublicKey });
    await launchRef.update({
      deployDropletId: result.dropletId,
      hatchStatus: "spawning",
      hatchedAt: new Date(),
    });

    return NextResponse.json({
      status: "spawning",
      dropletId: result.dropletId,
      message: "Droplet created. This page will update once the droplet is ready.",
    });
  } catch (e) {
    console.error("[openclaw/spawn]", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: `Spawn failed: ${message}` },
      { status: 503 }
    );
  }
}
