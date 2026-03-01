import {
  collection,
  query,
  onSnapshot,
  orderBy,
  Timestamp,
  addDoc,
  where,
  limit,
  updateDoc,
  doc,
  increment,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/services/firebase.service";

export interface TtsResultCreatedBy {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  username?: string | null;
}

export interface TtsResult {
  id: string;
  // Voice / generation params
  voice_model: string;   // e.g. voice model id
  voice_model_name: string; // e.g. "My Voice"
  tts_voice: string;        // e.g. "en-US-ChristopherNeural"
  text: string;
  audio_url?: string;       // Firebase Storage URL once generated
  status: "pending" | "processing" | "done" | "error";
  // Counters
  play_count: number;
  like_count: number;
  share_count: number;
  // Metadata
  created_at: Timestamp;
  created_by: TtsResultCreatedBy;
  // size hint for masonry layout
  card_size: "sm" | "md" | "lg";
}

const TTS_RESULTS_COLLECTION = "tts_results";

/**
 * Subscribe to TTS results for a specific voice model
 */
export function subscribeToTtsResults(
  voiceModelId: string,
  callback: (results: TtsResult[]) => void
): () => void {
  const colRef = collection(db, TTS_RESULTS_COLLECTION);
  const q = query(
    colRef,
    where("voice_model", "==", voiceModelId),
    orderBy("created_at", "desc"),
    limit(40)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const results: TtsResult[] = [];
      snapshot.forEach((d) => {
        results.push({ id: d.id, ...d.data() } as TtsResult);
      });
      callback(results);
    },
    (error) => {
      console.error("Error fetching TTS results:", error);
      callback([]);
    }
  );
}

/**
 * Create a new TTS request
 * @deprecated Use createTtsResultDoc instead
 */
export async function createTtsRequest(
  voiceModelId: string,
  voiceModelName: string,
  text: string
): Promise<string> {
  let cardSize: TtsResult["card_size"] = "sm";
  if (text.length > 80) cardSize = "lg";
  else if (text.length > 30) cardSize = "md";

  const docRef = await addDoc(collection(db, TTS_RESULTS_COLLECTION), {
    voice_model: voiceModelId,
    voice_model_name: voiceModelName,
    tts_voice: "",
    text,
    status: "pending",
    play_count: 0,
    like_count: 0,
    share_count: 0,
    card_size: cardSize,
    created_at: Timestamp.now(),
    created_by: { uid: "anon", displayName: null, photoURL: null },
  });

  return docRef.id;
}

/**
 * Create a TTS result Firestore document immediately when generation starts.
 * Returns the new document ID so it can be updated later with the audio URL.
 */
export async function createTtsResultDoc(params: {
  text: string;
  voiceModelId: string;
  voiceModelName: string;
  ttsVoice: string;
  createdBy: TtsResultCreatedBy;
}): Promise<string> {
  const { text, voiceModelId, voiceModelName, ttsVoice, createdBy } = params;

  let cardSize: TtsResult["card_size"] = "sm";
  if (text.length > 80) cardSize = "lg";
  else if (text.length > 30) cardSize = "md";

  const docRef = await addDoc(collection(db, TTS_RESULTS_COLLECTION), {
    voice_model: voiceModelId,
    voice_model_name: voiceModelName,
    tts_voice: ttsVoice,
    text,
    audio_url: null,
    status: "processing",
    play_count: 0,
    like_count: 0,
    share_count: 0,
    card_size: cardSize,
    created_at: Timestamp.now(),
    created_by: createdBy,
  });

  return docRef.id;
}

/**
 * Download audio from a remote URL (e.g. HuggingFace), upload it to
 * Firebase Storage, and return the permanent download URL.
 */
export async function uploadTtsAudio(
  remoteUrl: string,
  docId: string
): Promise<string> {
  const response = await fetch(remoteUrl);
  const blob = await response.blob();
  const storageRef = ref(storage, `tts-results/${docId}.mp3`);
  await uploadBytes(storageRef, blob, { contentType: "audio/mpeg" });
  return getDownloadURL(storageRef);
}

/**
 * Update a TTS result document with the final Firebase Storage audio URL
 * and mark it as done.
 */
export async function updateTtsResultAudioUrl(
  docId: string,
  audioUrl: string
): Promise<void> {
  const docRef = doc(db, TTS_RESULTS_COLLECTION, docId);
  await updateDoc(docRef, {
    audio_url: audioUrl,
    status: "done",
  });
}

/**
 * Increment play count for a TTS result
 */
export async function incrementPlayCount(resultId: string): Promise<void> {
  const docRef = doc(db, TTS_RESULTS_COLLECTION, resultId);
  await updateDoc(docRef, { play_count: increment(1) });
}

/**
 * Increment like count for a TTS result
 */
export async function incrementLikeCount(resultId: string): Promise<void> {
  const docRef = doc(db, TTS_RESULTS_COLLECTION, resultId);
  await updateDoc(docRef, { like_count: increment(1) });
}