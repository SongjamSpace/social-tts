import { NextResponse } from "next/server";

/**
 * POST /api/openclaw/deploy
 * Body: { apiKey: string, mint: string }
 * Creates (or schedules) an OpenClaw agent deployment on Railway with the user's API key and token mint.
 * MVP: Returns a stub agent URL when Railway is not configured; do not log or store apiKey.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
    const mint = typeof body?.mint === "string" ? body.mint.trim() : "";

    if (!apiKey || !mint) {
      return NextResponse.json(
        { success: false, error: "apiKey and mint are required" },
        { status: 400 }
      );
    }

    const token = process.env.RAILWAY_TOKEN ?? process.env.RAILWAY_API_KEY;
    const projectId = process.env.RAILWAY_PROJECT_ID;

    if (token && projectId) {
      // TODO: Call Railway GraphQL API to create a new service from the OpenClaw agent image,
      // set env vars (LLM_API_KEY=apiKey, TOKEN_MINT=mint), and return the service public URL.
      // See https://docs.railway.com/reference/public-api and "Manage Services" / "Manage Variables".
      // For now we still return a stub so the UI flow works.
    }

    // Stub: return a placeholder agent URL for MVP when agent image / Railway project not yet wired.
    const stubUrl = process.env.NEXT_PUBLIC_OPENCLAW_AGENT_STUB_URL || null;
    return NextResponse.json({
      success: true,
      agentUrl: stubUrl ?? null,
    });
  } catch (e) {
    console.error("[openclaw/deploy]", e);
    return NextResponse.json(
      { success: false, error: "Deploy failed" },
      { status: 500 }
    );
  }
}
