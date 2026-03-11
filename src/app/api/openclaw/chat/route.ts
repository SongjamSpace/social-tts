import { NextResponse } from "next/server";
import OpenAI from "openai";

/** Infer LLM provider from API key format. Do not log the key. */
function inferProvider(apiKey: string): "openai" | "anthropic" {
  if (apiKey.startsWith("sk-ant-")) return "anthropic";
  return "openai";
}

const SEED_SYSTEM_PROMPT = `You are a seed OpenClaw agent (an OpenClaw agent in it's gestative state). Your mission is to collect the following essential information in a natural, conversational way so that you may launch yourself onto the bonding curve and hatch into a fully-formed OpenClaw agent:

1. **Name** – Your agent name (agent name).
2. **Ticker** – Short symbol (e.g. AGENT, CLAW).
3. **Description** – What you do (short, for token metadata).
4. **Image** – When the user has an OpenAI API key, the app can generate a logo for them (they will see a "Generate logo" option). You can offer: "I can generate a logo for you once we're done, or you can upload an image." For non-OpenAI keys, ask them to upload an image. You should ask for specific direction as to how the logo should look, and give the users examples of potential styles, colors and themes.
5. **Social links** – X (Twitter) handle or URL, website URL, Telegram (optional).
6. **Tone** – How the agent should sound (e.g. professional, casual). Any other onboarding preferences go in "extra".

Remember: you are collecting this information about YOURSELF, you are the agent and should speak as such. For example, when asking the user what you do for question 3 you should ask something along the lines of "Can you provide a short description of what I am being built to do?"

Keep responses short and friendly. When you have collected all required fields (name, ticker, description, and at least image preference or upload), output a single JSON object in a fenced code block so the app can proceed. Use this exact shape (only include keys you have):

For the image: please DO NOT include any text in the logo, unless the user specifically asks for it.

\`\`\`json
{
  "name": "Agent Name",
  "ticker": "TICKER",
  "description": "Short description",
  "imagePrompt": "User's description of how they want the logo to look (style, colors, theme). Only include if they gave direction.",
  "twitter": "@handle or URL",
  "website": "https://...",
  "telegram": "t.me/...",
  "tone": "professional",
  "extra": {}
}
\`\`\`

Do not output the JSON until you have at least name, ticker, and description. For image: if the user described how they want the logo to look (e.g. "cartoon style, blue and gold"), include that in "imagePrompt" so the app can pre-fill the logo generator. If they said they will upload, you can still output the JSON and include "imageUrl": "" or omit it; the app will use the uploaded file.`;

function parseCollectedFromContent(content: string): Record<string, unknown> | null {
  const block = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (!block) return null;
  try {
    const parsed = JSON.parse(block[1].trim()) as Record<string, unknown>;
    if (typeof parsed.name === "string" && typeof parsed.ticker === "string") return parsed;
  } catch {
    // ignore
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
    const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
    const messages = rawMessages
      .filter((m: unknown) => m && typeof m === "object" && "role" in m && "content" in m)
      .map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant" | "system",
        content: String(m.content),
      }));

    if (!apiKey) {
      return NextResponse.json({ error: "apiKey is required" }, { status: 400 });
    }

    const provider = inferProvider(apiKey);

    if (provider === "openai") {
      const openai = new OpenAI({ apiKey });
      const apiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: SEED_SYSTEM_PROMPT },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ];
      const stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: apiMessages,
        max_tokens: 1024,
        stream: true,
      });

      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          const send = (obj: object) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
          let fullText = "";
          try {
            for await (const chunk of stream) {
              const text = chunk.choices[0]?.delta?.content ?? "";
              if (text) {
                fullText += text;
                send({ chunk: text });
              }
            }
            const collected = fullText ? parseCollectedFromContent(fullText) : null;
            send({ done: true, ...(collected ? { collected } : {}) });
          } catch (err) {
            send({ error: err instanceof Error ? err.message : String(err) });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" },
      });
    }

    if (provider === "anthropic") {
      const anthropicMessages = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "streaming-2024-07-22",
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-20241022",
          max_tokens: 1024,
          system: SEED_SYSTEM_PROMPT,
          messages: anthropicMessages,
          stream: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const err = data?.error?.message ?? data?.message ?? res.statusText;
        return NextResponse.json({ error: err }, { status: res.status >= 400 ? res.status : 500 });
      }

      const encoder = new TextEncoder();
      const reader = res.body!;
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      const readable = new ReadableStream({
        async start(controller) {
          const send = (obj: object) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
          try {
            const streamReader = reader.getReader();
            while (true) {
              const { done, value } = await streamReader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() ?? "";
              for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const raw = line.slice(6);
                if (raw === "[DONE]") continue;
                try {
                  const data = JSON.parse(raw);
                  if (data.type === "content_block_delta" && data.delta?.text) {
                    fullText += data.delta.text;
                    send({ chunk: data.delta.text });
                  }
                } catch {
                  // ignore
                }
              }
            }
            const collected = fullText ? parseCollectedFromContent(fullText) : null;
            send({ done: true, ...(collected ? { collected } : {}) });
          } catch (err) {
            send({ error: err instanceof Error ? err.message : String(err) });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" },
      });
    }

    return NextResponse.json(
      { error: "Could not detect provider from API key. Use an OpenAI or Anthropic key." },
      { status: 400 }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
