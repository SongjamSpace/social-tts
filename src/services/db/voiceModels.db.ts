import {
  collection,
  query,
  onSnapshot,
  orderBy,
  Timestamp,
  doc,
  getDoc,
  getDocs,
  setDoc,
  limit,
} from "firebase/firestore";
import { db } from "@/services/firebase.service";

export interface VoiceModel {
  id: string;
  name: string;
  slug: string; // e.g. "mr-krabs"
  description: string;
  avatar_url: string;
  category: "character" | "celebrity" | "original" | "uncensored";
  tags: string[];
  hf_model_id: string; // HuggingFace model ID
  sample_rate?: number;
  is_active: boolean;
  play_count: number;
  created_at: Timestamp;
}

const VOICE_MODELS_COLLECTION = "voice_models";

/**
 * Subscribe to all active voice models
 */
export function subscribeToVoiceModels(
  callback: (models: VoiceModel[]) => void
): () => void {
  const ref = collection(db, VOICE_MODELS_COLLECTION);
  const q = query(ref, orderBy("play_count", "desc"), limit(50));

  return onSnapshot(
    q,
    (snapshot) => {
      const models: VoiceModel[] = [];
      snapshot.forEach((d) => {
        models.push({ id: d.id, ...d.data() } as VoiceModel);
      });
      callback(models);
    },
    (error) => {
      console.error("Error fetching voice models:", error);
      callback([]);
    }
  );
}

/**
 * Get a single voice model by slug
 */
export async function getVoiceModelBySlug(
  slug: string
): Promise<VoiceModel | null> {
  try {
    const docRef = doc(db, VOICE_MODELS_COLLECTION, slug);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as VoiceModel;
    }
    return null;
  } catch (err) {
    console.error("Error getting voice model:", err);
    return null;
  }
}

/**
 * Seed the MrKrabs default voice model if it doesn't exist
 */
export async function seedDefaultVoiceModels(): Promise<void> {
  const defaults: Omit<VoiceModel, "id">[] = [
    {
      name: "Mr. Krabs",
      slug: "mr-krabs",
      description:
        "The money-loving crustacean from Bikini Bottom. Iconic, greedy, unforgettable. Uncensored.",
      avatar_url:
        "https://firebasestorage.googleapis.com/v0/b/lustrous-stack-453106-f6.firebasestorage.app/o/agents%2Fkrabs.png?alt=media",
      category: "character",
      tags: ["spongebob", "character", "funny", "uncensored"],
      hf_model_id: "facebook/mms-tts-eng",
      sample_rate: 16000,
      is_active: true,
      play_count: 420,
      created_at: Timestamp.now(),
    },
    {
      name: "Darth Vader",
      slug: "darth-vader",
      description: "The Dark Lord of the Sith. Heavy breathing included.",
      avatar_url: "",
      category: "character",
      tags: ["star-wars", "villain", "deep", "iconic"],
      hf_model_id: "facebook/mms-tts-eng",
      sample_rate: 16000,
      is_active: true,
      play_count: 280,
      created_at: Timestamp.now(),
    },
    {
      name: "GLaDOS",
      slug: "glados",
      description:
        "The passive-aggressive AI from Aperture Science. Science will be done.",
      avatar_url: "",
      category: "character",
      tags: ["portal", "ai", "sarcastic", "robot"],
      hf_model_id: "facebook/mms-tts-eng",
      sample_rate: 16000,
      is_active: true,
      play_count: 195,
      created_at: Timestamp.now(),
    },
    {
      name: "Uncensored Bot",
      slug: "uncensored-bot",
      description: "Raw. Unfiltered. Says what others won't.",
      avatar_url: "",
      category: "uncensored",
      tags: ["raw", "unfiltered", "adult"],
      hf_model_id: "facebook/mms-tts-eng",
      sample_rate: 16000,
      is_active: true,
      play_count: 150,
      created_at: Timestamp.now(),
    },
  ];

  for (const model of defaults) {
    const docRef = doc(db, VOICE_MODELS_COLLECTION, model.slug);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      await setDoc(docRef, model);
    }
  }
}
