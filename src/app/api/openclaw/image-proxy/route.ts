import { NextResponse } from "next/server";

/**
 * POST /api/openclaw/image-proxy
 * Body: { url: string }
 * Fetches an image from the given URL server-side (avoids CORS when the URL
 * is cross-origin, e.g. DALL-E Azure Blob Storage). Returns the image bytes.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }
    // Only allow HTTPS
    if (!url.startsWith("https://")) {
      return NextResponse.json({ error: "Only https URLs are allowed" }, { status: 400 });
    }
    const res = await fetch(url, { headers: { "User-Agent": "EveOpenClaw/1.0" } });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image: ${res.status}` },
        { status: 502 }
      );
    }
    const contentType = res.headers.get("content-type") || "image/png";
    const blob = await res.arrayBuffer();
    return new NextResponse(blob, {
      status: 200,
      headers: { "Content-Type": contentType },
    });
  } catch (e) {
    console.error("[openclaw/image-proxy]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to proxy image" },
      { status: 500 }
    );
  }
}
