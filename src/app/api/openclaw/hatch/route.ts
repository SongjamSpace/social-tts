import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/services/firebase-admin.service";
import {
  createOpenClawApp,
  createOpenClawDroplet,
  useDropletDeploy,
} from "@/lib/digitalocean";

const OPENCLAW_LAUNCHES = "openclaw_launches";
const HATCH_INTENTS = "hatch_intents";
const HATCH_DEPLOYMENTS = "hatch_deployments";

/**
 * POST /api/openclaw/hatch
 * Body: { mint: string, wallet: string, apiKey?: string, seedPayload: SeedPayload }
 * Verifies payment (intent paid), provisions VPS (DigitalOcean), updates launch and returns agentUrl.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mint = typeof body?.mint === "string" ? body.mint.trim() : "";
    const wallet = typeof body?.wallet === "string" ? body.wallet.trim() : "";
    const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : undefined;
    const seedPayload = (body?.seedPayload ?? {}) as Record<string, unknown>;

    if (!mint || !wallet) {
      return NextResponse.json(
        { error: "mint and wallet are required" },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();

    const intentSnap = await db.collection(HATCH_INTENTS).doc(mint).get();
    if (!intentSnap.exists) {
      return NextResponse.json(
        { error: "Hatch intent not found" },
        { status: 404 }
      );
    }
    const intent = intentSnap.data()!;
    if (intent.status !== "paid") {
      return NextResponse.json(
        { error: "Payment not confirmed. Complete payment first." },
        { status: 400 }
      );
    }
    if (intent.wallet !== wallet) {
      return NextResponse.json(
        { error: "Wallet does not match hatch intent" },
        { status: 403 }
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
    const launch = launchSnap.data()!;
    // Always create a new app and poll for URL; never return a stored agentUrl so we avoid
    // sending users to a URL that doesn't resolve (e.g. from an old constructed fallback).
    if (launch.agentUrl) {
      await launchRef.update({ agentUrl: null, hatchStatus: null, hatchedAt: null });
    }

    const doToken = process.env.DIGITALOCEAN_TOKEN?.trim();
    const agentImage = process.env.OPENCLAW_AGENT_IMAGE?.trim();
    if (!doToken || !agentImage) {
      return NextResponse.json(
        { error: "VPS not configured. Set DIGITALOCEAN_TOKEN and OPENCLAW_AGENT_IMAGE in the server environment." },
        { status: 503 }
      );
    }

    const gatewayToken = randomBytes(32).toString("hex");
    const useDroplet = useDropletDeploy();
    let agentUrl: string | null = null;
    let doId: string | null = null;
    let deployDropletId: string | null = null;
    let deployAppId: string | null = null;

    try {
      if (useDroplet) {
        const result = await createOpenClawDroplet({
          mint,
          apiKey: apiKey || undefined,
          seedMemoriesJson: JSON.stringify(seedPayload),
          gatewayToken,
        });
        doId = result.dropletId;
        deployDropletId = result.dropletId;
        agentUrl =
          result.agentUrl && typeof result.agentUrl === "string"
            ? result.agentUrl.trim()
            : null;
      } else {
        const result = await createOpenClawApp({
          mint,
          apiKey: apiKey || undefined,
          seedMemoriesJson: JSON.stringify(seedPayload),
          gatewayToken,
        });
        doId = result.appId;
        deployAppId = result.appId;
        agentUrl =
          result.defaultIngress && typeof result.defaultIngress === "string"
            ? result.defaultIngress.trim()
            : null;
      }
    } catch (e) {
      console.error("[openclaw/hatch] DigitalOcean create failed:", e);
      const message = e instanceof Error ? e.message : "Unknown error";
      return NextResponse.json(
        { error: `Deployment failed: ${message}` },
        { status: 503 }
      );
    }

    if (!agentUrl) {
      const updatePayload: Record<string, unknown> = {
        gatewayToken,
        hatchStatus: "deploying",
        hatchedAt: new Date(),
      };
      if (useDroplet && deployDropletId) {
        updatePayload.deployDropletId = deployDropletId;
        updatePayload.deployAppId = null;
      } else {
        updatePayload.deployAppId = doId;
        updatePayload.deployDropletId = null;
      }
      await launchRef.update(updatePayload);
      return NextResponse.json({
        status: "deploying",
        appId: doId,
        gatewayToken,
        message: useDroplet
          ? "Droplet created. Deployment in progress—this page will update once the gateway is ready."
          : "App created. Deployment in progress—this page will update as DigitalOcean builds and deploys your agent.",
      });
    }

    await launchRef.update({
      agentUrl,
      gatewayToken,
      hatchStatus: "hatched",
      hatchedAt: new Date(),
      deployAppId: null,
      deployDropletId: null,
    });

    await db.collection(HATCH_DEPLOYMENTS).add({
      mint,
      wallet,
      doId,
      agentUrl,
      status: "deployed",
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      agentUrl,
      gatewayToken,
    });
  } catch (e) {
    console.error("[openclaw/hatch]", e);
    return NextResponse.json(
      { error: "Hatch failed" },
      { status: 500 }
    );
  }
}
