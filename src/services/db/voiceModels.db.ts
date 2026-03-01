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
  updateDoc,
  limit,
} from "firebase/firestore";
import { db } from "@/services/firebase.service";

export interface TtsVoiceModel {
  id: string;
  model_url: string;
  model_name: string;
  token_name: string;
  symbol: string;
  creator_split: number;
  split: number;
  creator_wallet?: string;
  split_wallet?: string;
  image_url?: string;
  deployed?: boolean;
  token_address?: string;
  voice_owner_wallet?: string;
  website_url?: string;
  twitter_url?: string;
  created_at: Timestamp;
}

export async function addTtsVoiceModel(id: string, data: Omit<TtsVoiceModel, "created_at">) {
  const docRef = doc(db, "tts_voice_models", id);
  await setDoc(docRef, {
    ...data,
    created_at: Timestamp.now(),
  });
  return id;
}

export async function checkTtsVoiceModelExists(id: string): Promise<boolean> {
  const docRef = doc(db, "tts_voice_models", id);
  const snap = await getDoc(docRef);
  return snap.exists();
}

export async function updateTtsVoiceModel(id: string, data: Partial<Omit<TtsVoiceModel, "id" | "created_at">>) {
  const docRef = doc(db, "tts_voice_models", id);
  await updateDoc(docRef, data);
}

export function subscribeToTtsVoiceModels(callback: (models: TtsVoiceModel[]) => void) {
  const ref = collection(db, "tts_voice_models");
  const q = query(ref, orderBy("created_at", "desc"));
  return onSnapshot(q, (snap) => {
    const models: TtsVoiceModel[] = [];
    snap.forEach((d) => models.push({ ...d.data() } as TtsVoiceModel));
    callback(models);
  });
}

export interface VoiceModel {
  id: string;
  name: string;
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

export async function getVoiceModelById(
  id: string
): Promise<VoiceModel | null> {
  try {
    const docRef = doc(db, VOICE_MODELS_COLLECTION, id);
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
 * Seed default voice models in the voice_models collection if they don't exist.
 * Currently no defaults; extend the array to seed curated models.
 */
export async function seedDefaultVoiceModels(): Promise<void> {
  const defaults: VoiceModel[] = [];

  for (const model of defaults) {
    const docRef = doc(db, VOICE_MODELS_COLLECTION, model.id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      await setDoc(docRef, model);
    }
  }
}
