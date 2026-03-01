import { NextRequest, NextResponse } from "next/server";
import bs58 from "bs58";
import { decryptSecretKey } from "@/lib/wallet-crypto";
import { db } from "@/services/firebase.service";
import { collection, query, where, getDocs, limit, doc, getDoc, updateDoc, Timestamp } from "firebase/firestore";

export async function POST(req: NextRequest) {
  try {
    const { voiceModelId, creatorWallet } = await req.json();

    if (!voiceModelId || typeof voiceModelId !== "string") {
      return NextResponse.json(
        { error: "voiceModelId is required" },
        { status: 400 }
      );
    }

    if (!creatorWallet || typeof creatorWallet !== "string") {
      return NextResponse.json(
        { error: "creatorWallet is required for authentication" },
        { status: 400 }
      );
    }

    const voiceDocRef = doc(db, "tts_voice_models", voiceModelId);
    const voiceDoc = await getDoc(voiceDocRef);

    if (!voiceDoc.exists()) {
      return NextResponse.json(
        { error: "Voice model not found" },
        { status: 404 }
      );
    }

    const voiceData = voiceDoc.data();
    if (voiceData?.creator_wallet !== creatorWallet) {
      return NextResponse.json(
        { error: "Unauthorized: you are not the creator of this voice model" },
        { status: 403 }
      );
    }

    const walletsRef = collection(db, "voice_owner_wallets");
    const walletQuery = query(
      walletsRef,
      where("voiceModelId", "==", voiceModelId),
      limit(1)
    );
    const walletSnap = await getDocs(walletQuery);

    if (walletSnap.empty) {
      return NextResponse.json(
        { error: "No wallet found for this voice model" },
        { status: 404 }
      );
    }

    const walletDoc = walletSnap.docs[0];
    const walletData = walletDoc.data();

    if (walletData.claimed) {
      return NextResponse.json(
        { error: "This wallet has already been claimed" },
        { status: 409 }
      );
    }

    const secretKeyBytes = decryptSecretKey(
      walletData.encryptedSecretKey,
      walletData.iv,
      walletData.authTag
    );

    await updateDoc(walletDoc.ref, { claimed: true, claimedAt: Timestamp.now() });

    return NextResponse.json({
      publicKey: walletData.publicKey,
      secretKey: bs58.encode(secretKeyBytes),
    });
  } catch (err: any) {
    console.error("Wallet claim error:", err);
    return NextResponse.json(
      { error: err.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}
