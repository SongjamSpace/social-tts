import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/services/firebase-admin.service";
import { getAppDeploymentStatus, getDropletStatus } from "@/lib/digitalocean";

const OPENCLAW_LAUNCHES = "openclaw_launches";
const HATCH_DEPLOYMENTS = "hatch_deployments";

/**
 * GET /api/openclaw/hatch-status?mint=...
 * Returns deployment status for a hatch in progress. When status is "deploying", frontend should poll until status is "live" or "error".
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

    const deployDropletId = launch.deployDropletId;
    const deployAppId = launch.deployAppId;
    const agentUrl = launch.agentUrl;
    const gatewayToken = launch.gatewayToken;

    if (agentUrl && typeof agentUrl === "string") {
      return NextResponse.json({
        status: "live",
        agentUrl: agentUrl.trim(),
        gatewayToken: gatewayToken ?? null,
      });
    }

    // Droplet path: poll droplet until active and we have agentUrl
    if (deployDropletId && typeof deployDropletId === "string") {
      const dropletStatus = await getDropletStatus(deployDropletId);
      if (dropletStatus.dropletNotFound) {
        await launchRef.update({
          deployDropletId: null,
          hatchStatus: null,
        });
        return NextResponse.json({
          status: "deleted",
          message: "The deployment was removed. You can hatch again to create a new agent.",
        });
      }
      if (dropletStatus.agentUrl) {
        const url = dropletStatus.agentUrl.trim();
        await launchRef.update({
          agentUrl: url,
          deployDropletId: null,
          hatchStatus: "hatched",
        });
        await db.collection(HATCH_DEPLOYMENTS).add({
          mint,
          doId: deployDropletId,
          agentUrl: url,
          status: "deployed",
          createdAt: new Date(),
        });
        return NextResponse.json({
          status: "live",
          agentUrl: url,
          gatewayToken: gatewayToken ?? null,
        });
      }
      const dropletMessage =
        dropletStatus.status === "active"
          ? "Waiting for gateway…"
          : dropletStatus.status
            ? `Droplet ${dropletStatus.status}…`
            : "Starting droplet…";
      return NextResponse.json({
        status: "deploying",
        phase: dropletStatus.status ?? null,
        progress: null,
        message: dropletMessage,
      });
    }

    // App Platform path
    if (!deployAppId || typeof deployAppId !== "string") {
      return NextResponse.json({
        status: "unknown",
        message: "No deployment in progress for this launch.",
      });
    }

    const { defaultIngress, phase, progress, appNotFound } =
      await getAppDeploymentStatus(deployAppId);

    if (appNotFound) {
      await launchRef.update({
        deployAppId: null,
        hatchStatus: null,
      });
      return NextResponse.json({
        status: "deleted",
        message: "The deployment was removed. You can hatch again to create a new agent.",
      });
    }

    if (defaultIngress && typeof defaultIngress === "string") {
      const url = defaultIngress.trim();
      await launchRef.update({
        agentUrl: url,
        deployAppId: null,
        hatchStatus: "hatched",
      });
      await db.collection(HATCH_DEPLOYMENTS).add({
        mint,
        doId: deployAppId,
        agentUrl: url,
        status: "deployed",
        createdAt: new Date(),
      });
      return NextResponse.json({
        status: "live",
        agentUrl: url,
        gatewayToken: gatewayToken ?? null,
      });
    }

    const phaseLabel = formatPhase(phase);
    const message = progress
      ? `${phaseLabel} (${progress})`
      : phaseLabel;
    return NextResponse.json({
      status: "deploying",
      phase: phase ?? null,
      progress: progress ?? null,
      message,
    });
  } catch (e) {
    console.error("[openclaw/hatch-status]", e);
    return NextResponse.json(
      { error: "Failed to get deployment status" },
      { status: 500 }
    );
  }
}

function formatPhase(phase: string | null): string {
  if (!phase) return "Starting deployment…";
  const lower = phase.toLowerCase();
  if (lower.includes("pending") || lower === "pending_build") return "Queued…";
  if (lower.includes("build")) return "Building container…";
  if (lower.includes("deploy")) return "Deploying…";
  if (lower.includes("active") || lower.includes("running")) return "Running health checks…";
  if (lower.includes("error") || lower.includes("fail")) return "Deployment issue—check DigitalOcean dashboard.";
  return phase.replace(/_/g, " ");
}
