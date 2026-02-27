import { NextRequest, NextResponse } from "next/server";
import { Client } from "@gradio/client";

export const dynamic = "force-dynamic";

const HF_BASE = "https://logeshmoltspaces-ultimate-rvc.hf.space";
const FN_INDEX = 51; // /partial_34 – TTS pipeline

/**
 * Fire-and-forget queue job using raw SSE polling.
 * Returns the audio URL from the first "process_completed" event.
 */
async function runGradioJob(
  sessionHash: string,
  fnIndex: number,
  data: unknown[]
): Promise<string | null> {
  // 1 – Join the queue
  const joinRes = await fetch(`${HF_BASE}/gradio_api/queue/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data,
      event_data: null,
      fn_index: fnIndex,
      session_hash: sessionHash,
      trigger_id: 381,
    }),
  });

  if (!joinRes.ok) {
    throw new Error(`queue/join failed ${joinRes.status}: ${await joinRes.text()}`);
  }

  // 2 – Stream the SSE response until "process_completed"
  const streamRes = await fetch(
    `${HF_BASE}/gradio_api/queue/data?session_hash=${sessionHash}`,
    { headers: { Accept: "text/event-stream" } }
  );

  if (!streamRes.ok || !streamRes.body) {
    throw new Error(`queue/data failed: ${streamRes.status}`);
  }

  const reader = streamRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      let msg: any;
      try { msg = JSON.parse(line.slice(5).trim()); } catch { continue; }

      if (msg.msg === "process_completed") {
        if (msg.success === false) {
          throw new Error(msg.output?.error ?? "Gradio processing failed");
        }
        const output = msg.output?.data?.[0];
        let url: string | null =
          typeof output === "string" ? output : (output?.url ?? null);
        if (url && url.startsWith("/")) url = `${HF_BASE}${url}`;
        return url;
      }

      if (msg.msg === "queue_full") {
        throw new Error("Gradio queue is full – try again in a moment");
      }
    }
  }

  return null;
}

/**
 * POST /api/tts
 * Body: { text: string, voiceModel?: string, ttsVoice?: string }
 * Returns: { status, audio_url }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      text,
      voiceModel = "mrkrabs",
      ttsVoice = "en-US-ChristopherNeural",
    } = body as { text: string; voiceModel?: string; ttsVoice?: string };

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { status: "error", message: "text is required" },
        { status: 400 }
      );
    }

    const sessionHash = Math.random().toString(36).slice(2, 13);

    // ── Step 1: Wake the Space via @gradio/client (fn /partial_7)
    // This populates the server-side rvc_model dropdown so fn_index 51
    // can validate the model name. The client connects fresh and calls the
    // no-arg /partial_7 endpoint which returns the current model lists.
    try {
      const client = await Client.connect("logeshmoltspaces/ultimate-rvc");
      await client.predict("/partial_7", []);
    } catch {
      // Non-fatal — proceed; the Space may already be warm
    }

    // ── Step 2: Run the actual TTS + RVC pipeline (fn_index 51 = /partial_34)
    const audioUrl = await runGradioJob(sessionHash, FN_INDEX, [
      text,         // 0  tts_text
      voiceModel,   // 1  rvc_model slug
      ttsVoice,     // 2  edge-tts voice
      0,            // 3  pitch
      0,            // 4  filter_radius
      0,            // 5  rms_mix_rate
      0,            // 6  protect
      0,            // 7  hop_length
      "rmvpe",      // 8  f0_method
      0.3,          // 9  crepe_hop_length
      1,            // 10 f0_autotune
      0.33,         // 11 f0_autotune_strength
      false,        // 12 f0_vad
      false,        // 13 split_audio
      1,            // 14 batch_size
      false,        // 15 clean_audio
      155,          // 16 clean_strength
      true,         // 17 export_format
      0.7,          // 18 rms_mix_rate (secondary)
      "contentvec", // 19 embedder_model
      null,         // 20 embedder_model_custom
      0,            // 21 sid
      0,            // 22 batch_threshold
      44100,        // 23 sample_rate
      "mp3",        // 24 output_format
      "",           // 25 extra
    ]);

    return NextResponse.json({
      status: "done",
      audio_url: audioUrl,
      voice_model: voiceModel,
      tts_voice: ttsVoice,
    });
  } catch (error: any) {
    console.error("TTS route error:", error);
    return NextResponse.json(
      { status: "error", message: error.message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}
