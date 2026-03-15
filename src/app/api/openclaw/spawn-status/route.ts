import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/services/firebase-admin.service";
import { getDropletStatus } from "@/lib/digitalocean";

const OPENCLAW_LAUNCHES = "openclaw_launches";

const SPAWN_READY_DELAY_MS = 90_000; // 90s after droplet active so cloud-init can write authorized_keys

/**
 * GET /api/openclaw/spawn-status?mint=...
 * Returns spawn status for the launch. When deployDropletId is set, polls droplet until active.
 * Waits SPAWN_READY_DELAY_MS after first "active" before returning ready so SSH key is in authorized_keys.
 * Returns status: "spawning" | "ready" | "deleted", and dropletIp when ready.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mint = searchParams.get("mint")?.trim();
    if (!mint) {
      return NextResponse.json({ error: "mint query is required" }, { status: 400 });
    }

    const db = getAdminFirestore();
    const launchRef = db.collection(OPENCLAW_LAUNCHES).doc(mint);
    const launchSnap = await launchRef.get();
    if (!launchSnap.exists) {
      return NextResponse.json({ error: "Launch not found" }, { status: 404 });
    }

    const launch = launchSnap.data()!;
    const deployDropletId = launch.deployDropletId as string | undefined;
    const dropletIp = launch.dropletIp as string | undefined;

    // If we have a completed spawn (dropletIp) and still have the droplet ID, verify droplet still exists (autodetect destroy)
    if (dropletIp && typeof dropletIp === "string" && deployDropletId && typeof deployDropletId === "string") {
      const existingStatus = await getDropletStatus(deployDropletId);
      if (existingStatus.dropletNotFound) {
        await launchRef.update({
          dropletIp: null,
          deployDropletId: null,
          hatchStatus: null,
          spawnFirstActiveAt: FieldValue.delete(),
        });
        return NextResponse.json({
          status: "idle",
          message: "No droplet in progress for this launch.",
        });
      }
      return NextResponse.json({
        status: "ready",
        dropletIp: dropletIp.trim(),
      });
    }

    // Have dropletIp but no deployDropletId (legacy record) — still show ready
    if (dropletIp && typeof dropletIp === "string") {
      return NextResponse.json({
        status: "ready",
        dropletIp: dropletIp.trim(),
      });
    }

    // No droplet created yet (user must choose size and pay first)
    if (!deployDropletId || typeof deployDropletId !== "string") {
      return NextResponse.json({
        status: "idle",
        message: "No droplet in progress for this launch.",
      });
    }

    const dropletStatus = await getDropletStatus(deployDropletId);
    if (dropletStatus.dropletNotFound) {
      await launchRef.update({
        deployDropletId: null,
        hatchStatus: null,
        spawnFirstActiveAt: FieldValue.delete(),
      });
      return NextResponse.json({
        status: "deleted",
        message: "The droplet was removed. You can spawn again to create a new droplet.",
      });
    }

    if (dropletStatus.publicIp && dropletStatus.status === "active") {
      const ip = dropletStatus.publicIp.trim();
      const spawnFirstActiveAt = launch.spawnFirstActiveAt as { toMillis?: () => number } | undefined;
      const now = Date.now();
      const firstActiveAtMs = spawnFirstActiveAt?.toMillis?.() ?? null;

      if (firstActiveAtMs == null) {
        await launchRef.update({
          spawnFirstActiveAt: new Date(now),
        });
        return NextResponse.json({
          status: "spawning",
          message: "Droplet is up, finishing setup (about 1–2 min)…",
        });
      }

      if (now - firstActiveAtMs >= SPAWN_READY_DELAY_MS) {
        await launchRef.update({
          dropletIp: ip,
          hatchStatus: "spawned",
          spawnFirstActiveAt: FieldValue.delete(),
        });
        return NextResponse.json({
          status: "ready",
          dropletIp: ip,
        });
      }

      const remainingSec = Math.ceil((SPAWN_READY_DELAY_MS - (now - firstActiveAtMs)) / 1000);
      return NextResponse.json({
        status: "spawning",
        message: `Finishing setup (${remainingSec}s)…`,
      });
    }

    const message =
      dropletStatus.status === "active"
        ? "Waiting for IP…"
        : dropletStatus.status
          ? `Droplet ${dropletStatus.status}…`
          : "Starting droplet…";
    return NextResponse.json({
      status: "spawning",
      message,
    });
  } catch (e) {
    console.error("[openclaw/spawn-status]", e);
    return NextResponse.json(
      { error: "Failed to get spawn status" },
      { status: 500 }
    );
  }
}
