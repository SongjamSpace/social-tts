import { NextResponse } from "next/server";
import OpenAI from "openai";

/** Infer provider from API key format. Only OpenAI supports image gen in this MVP. */
function inferProvider(apiKey: string): "openai" | "anthropic" {
  if (apiKey.startsWith("sk-ant-")) return "anthropic";
  return "openai";
}

/**
 * POST /api/openclaw/image
 * Body: { apiKey: string, prompt: string }
 * Generates an image using the user's OpenAI key (DALL-E 2). Returns { url }.
 * For non-OpenAI keys returns 400 with a clear message.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";

    if (!apiKey) {
      return NextResponse.json({ error: "apiKey is required" }, { status: 400 });
    }
    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const provider = inferProvider(apiKey);

    if (provider !== "openai") {
      return NextResponse.json(
        { error: "Image generation is only supported with an OpenAI API key. Use an OpenAI key to generate a logo, or upload an image instead." },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey });
    const response = await openai.images.generate({
      model: "dall-e-2",
      prompt,
      n: 1,
      size: "512x512",
      response_format: "url",
    });

    const url = response.data?.[0]?.url;
    if (!url) {
      return NextResponse.json(
        { error: "No image URL in response" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
