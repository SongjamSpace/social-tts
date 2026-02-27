/**
 * rvcHf.ts – Client-side helper to call the Ultimate RVC HuggingFace Gradio Space.
 *
 * Wake call:  client.predict("/partial_70") – populates server-side voice model list
 * TTS call:   client.submit(51, [...])      – streams queue/status events + audio result
 */

import { Client } from "@gradio/client";

const HF_BASE = "https://logeshmoltspaces-ultimate-rvc.hf.space";
const HF_SPACE = "LogeshMoltspaces/ultimate-rvc";

export interface TtsStatus {
  stage: "queued" | "processing" | "done" | "error";
  message: string;
  queuePosition?: number;
  eta?: number;      // seconds
  audioUrl?: string; // present when stage === "done"
}

export interface TtsOptions {
  text: string;
  voiceModel?: string;        // default "mrkrabs"
  ttsVoice?: string;          // default "en-US-ChristopherNeural"
  onStatus: (status: TtsStatus) => void;
}



/**
 * Generate TTS audio directly from the browser.
 * All progress and the final audio URL are delivered via `onStatus`.
 *
 * @example
 * generateTts({
 *   text: "Hello!",
 *   onStatus: (s) => { if (s.stage === "done" && s.audioUrl) new Audio(s.audioUrl).play(); },
 * });
 */
export async function generateTts(options: TtsOptions): Promise<void> {
  const {
    text,
    voiceModel = "mrkrabs",
    ttsVoice = "en-US-ChristopherNeural",
    onStatus,
  } = options;

  const client = await Client.connect(HF_SPACE);

  // Fire-and-forget wake call — populates the server-side rvc_model list
  const loadVoiceModelsResponse = await client.predict("/_init_dropdowns", {});
  console.log("loadVoiceModelsResponse: ", loadVoiceModelsResponse);

  onStatus({ stage: "queued", message: "Queued…" });

  // Submit TTS + RVC job and stream status events
  const job = client.submit(51, [
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
  ] as Parameters<typeof client.predict>[1],
  undefined, // event_data
  undefined, // trigger_id
  true,      // all_events — receive status events too
  );

  let audioUrl: string | null = null;
  const eventLogs: unknown[] = [];

  for await (const event of job) {
    eventLogs.push(event);
    if (event.type === "status") {
      const { stage, position, eta, original_msg } = event as any;

      // "process_starts" fires when the job leaves the queue and begins executing —
      // the stage is still "pending" at that point so we check original_msg explicitly.
      const isProcessing =
        stage === "generating" || original_msg === "process_starts";

      if (isProcessing) {
        const etaStr = eta != null ? ` · ~${Math.ceil(eta)}s` : "";
        onStatus({ stage: "processing", message: `Generating audio${etaStr}…`, eta });
      } else if (stage === "pending") {
        // position can be 0 (front of queue), so check for null/undefined explicitly
        const posStr =
          position != null ? `Position ${position} in queue` : "Queued";
        const etaStr = eta != null ? ` · ~${Math.ceil(eta)}s` : "";
        onStatus({ stage: "queued", message: `${posStr}${etaStr}`, queuePosition: position, eta });
      }
    } else if (event.type === "data") {
      // data[0] is the final RVC-converted audio; it arrives as an object { url, path, … }
      const output = (event as any).data?.[0] as unknown;
      audioUrl =
        typeof output === "string"
          ? output
          : (output as any)?.url ?? null;
      if (audioUrl?.startsWith("/")) audioUrl = `${HF_BASE}${audioUrl}`;

      // Notify immediately with the audio URL so the UI can start playing
      onStatus({ stage: "done", message: "Done!", audioUrl: audioUrl ?? undefined });
    }
  }

  console.log("=== ALL JOB EVENTS (copy-paste below) ===\n" + JSON.stringify(eventLogs, null, 2));
}
