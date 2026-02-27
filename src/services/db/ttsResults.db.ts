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
  voice_model: string;      // e.g. "mrkrabs"
  voice_model_slug: string; // e.g. "mr-krabs" (display slug)
  voice_model_name: string; // e.g. "Mr. Krabs"
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
  voiceModelSlug: string,
  callback: (results: TtsResult[]) => void
): () => void {
  const colRef = collection(db, TTS_RESULTS_COLLECTION);
  const q = query(
    colRef,
    where("voice_model_slug", "==", voiceModelSlug),
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
  voiceModelSlug: string,
  voiceModelName: string,
  text: string
): Promise<string> {
  let cardSize: TtsResult["card_size"] = "sm";
  if (text.length > 80) cardSize = "lg";
  else if (text.length > 30) cardSize = "md";

  const docRef = await addDoc(collection(db, TTS_RESULTS_COLLECTION), {
    voice_model_slug: voiceModelSlug,
    voice_model_name: voiceModelName,
    voice_model: voiceModelSlug,
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
  voiceModel: string;
  voiceModelSlug: string;
  voiceModelName: string;
  ttsVoice: string;
  createdBy: TtsResultCreatedBy;
}): Promise<string> {
  const { text, voiceModel, voiceModelSlug, voiceModelName, ttsVoice, createdBy } = params;

  let cardSize: TtsResult["card_size"] = "sm";
  if (text.length > 80) cardSize = "lg";
  else if (text.length > 30) cardSize = "md";

  const docRef = await addDoc(collection(db, TTS_RESULTS_COLLECTION), {
    voice_model: voiceModel,
    voice_model_slug: voiceModelSlug,
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

/**
 * Seed demo TTS results for MrKrabs
 */
export async function seedDemoTtsResults(): Promise<void> {
  const demoTexts = [
    { text: "Money, money, money!", size: "sm" as const },
    {
      text: "I like money. Do you like money? I sure do love me some money.",
      size: "lg" as const,
    },
    { text: "SpongeBob! Get back to work!", size: "md" as const },
    { text: "Argh.", size: "sm" as const },
    {
      text: "The Krabby Patty formula is the most sacred and guarded secret in all the seven seas!",
      size: "lg" as const,
    },
    {
      text: "I went to college, ya know. ...For one night.",
      size: "md" as const,
    },
    { text: "No. This is Patrick.", size: "sm" as const },
    { text: "Well, good morning, SpongeBob!", size: "sm" as const },
    {
      text: "You could sell a krabby patty to a vegetarian, boy.",
      size: "md" as const,
    },
    {
      text: "AAAARRRGGH! Me money! Where is it? WHERE IS IT?!",
      size: "md" as const,
    },
    {
      text: "I've worked me way up from nothin'. And you will respect that.",
      size: "lg" as const,
    },
    { text: "Did someone say... free?", size: "sm" as const },
  ];

  const colRef = collection(db, TTS_RESULTS_COLLECTION);
  const existing = query(colRef, where("voice_model_slug", "==", "mr-krabs"), limit(1));
  // Only seed if empty
  const { getDocs } = await import("firebase/firestore");
  const snap = await getDocs(existing);
  if (!snap.empty) return;

  for (const item of demoTexts) {
    await addDoc(colRef, {
      voice_model: "mrkrabs",
      voice_model_slug: "mr-krabs",
      voice_model_name: "Mr. Krabs",
      tts_voice: "en-US-ChristopherNeural",
      text: item.text,
      audio_url: null,
      status: "done",
      play_count: Math.floor(Math.random() * 200) + 10,
      like_count: Math.floor(Math.random() * 80) + 1,
      share_count: 0,
      card_size: item.size,
      created_at: Timestamp.fromDate(
        new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
      ),
      created_by: { uid: "seed", displayName: "Seed Data", photoURL: null },
    });
  }
}
