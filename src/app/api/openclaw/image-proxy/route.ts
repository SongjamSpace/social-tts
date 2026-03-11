import { NextResponse } from "next/server";

/**
 * POST /api/openclaw/image-proxy
 * Body: { url: string }
 * Fetches an image from the given URL server-side (avoids CORS when the URL
 * is cross-origin, e.g. DALL-E Azure Blob Storage). Returns the image bytes.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const url = typeof (body as { url?: unknown })?.url === "string"
    ? (body as { url: string }).url.trim()
    : "";
  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }
  if (!url.startsWith("https://")) {
    return NextResponse.json({ error: "Only https URLs are allowed" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; EveOpenClaw/1.0)",
        "Accept": "image/*",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[openclaw/image-proxy] upstream", res.status, url.slice(0, 80), text.slice(0, 200));
      return NextResponse.json(
        { error: `Upstream returned ${res.status}: ${text.slice(0, 100) || res.statusText}` },
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
    const message = e instanceof Error ? e.message : String(e);
    console.error("[openclaw/image-proxy]", message, e);
    return NextResponse.json(
      { error: `Proxy fetch failed: ${message}` },
      { status: 502 }
    );
  }
}
