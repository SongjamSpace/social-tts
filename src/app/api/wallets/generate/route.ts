import { NextRequest, NextResponse } from "next/server";
import { Keypair } from "@solana/web3.js";
import { encryptSecretKey } from "@/lib/wallet-crypto";
import { db } from "@/services/firebase.service";
import { collection, query, where, getDocs, addDoc, limit, Timestamp } from "firebase/firestore";

export async function POST(req: NextRequest) {
  try {
    const { voiceModelId } = await req.json();

    if (!voiceModelId || typeof voiceModelId !== "string") {
      return NextResponse.json(
        { error: "voiceModelId is required" },
        { status: 400 }
      );
    }

    const walletsRef = collection(db, "voice_owner_wallets");
    const existingQuery = query(
      walletsRef,
      where("voiceModelId", "==", voiceModelId),
      limit(1)
    );
    const existingSnap = await getDocs(existingQuery);

    if (!existingSnap.empty) {
      const doc = existingSnap.docs[0];
      return NextResponse.json({ publicKey: doc.data().publicKey });
    }

    const keypair = Keypair.generate();
    const { ciphertext, iv, authTag } = encryptSecretKey(keypair.secretKey);

    await addDoc(walletsRef, {
      voiceModelId,
      publicKey: keypair.publicKey.toBase58(),
      encryptedSecretKey: ciphertext,
      iv,
      authTag,
      claimed: false,
      createdAt: Timestamp.now(),
    });

    return NextResponse.json({ publicKey: keypair.publicKey.toBase58() });
  } catch (err: any) {
    console.error("Wallet generation error:", err);
    return NextResponse.json(
      { error: err.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}
