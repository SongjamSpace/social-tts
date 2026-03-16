"use client";

import React, { useState } from "react";
import { useWallets, useSignAndSendTransaction } from "@privy-io/react-auth/solana";
import { Connection, Keypair, Transaction, PublicKey } from "@solana/web3.js";
import { PumpSdk } from "@pump-fun/pump-sdk";
import bs58 from "bs58";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/services/firebase.service";

function toBase58Sig(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw instanceof Uint8Array) return bs58.encode(raw);
  if (raw && typeof raw === "object" && "data" in raw) return bs58.encode(new Uint8Array((raw as { data: number[] }).data));
  return String(raw);
}

const VANITY_SUFFIX = "eve";
/** Expected attempts for 3-char base58 suffix (1/58^3). Used for progress %. */
const EXPECTED_ATTEMPTS_EVE = 58 * 58 * 58;

/** Grind until mint address (base58) ends with the given suffix. Yields periodically so UI can update. */
async function grindVanityKeypair(
  suffix: string,
  onProgress: (attempts: number) => void
): Promise<Keypair> {
  const yieldEvery = 5000;
  let attempts = 0;
  for (;;) {
    for (let i = 0; i < yieldEvery; i++) {
      const kp = Keypair.generate();
      if (kp.publicKey.toBase58().endsWith(suffix)) return kp;
      attempts++;
    }
    onProgress(attempts);
    await new Promise((r) => setTimeout(r, 0));
  }
}

/** Fetch image via our proxy to avoid CORS (e.g. DALL-E Azure URLs). */
async function imageUrlToFile(url: string, filename = "image.png"): Promise<File> {
  const res = await fetch("/api/openclaw/image-proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error ?? "Failed to fetch image");
  }
  const blob = await res.blob();
  const type = blob.type || "image/png";
  return new File([blob], filename, { type });
}

export interface OpenClawLaunchProps {
  apiKey: string;
  tokenName: string;
  symbol: string;
  imageFile?: File | null;
  imageUrl?: string;
  websiteUrl: string;
  twitterUrl: string;
  telegramUrl: string;
  description?: string;
  /** Full seed payload for launch record (enables profile + hatch memories). */
  seedPayload?: {
    name?: string;
    ticker?: string;
    description?: string;
    twitter?: string;
    website?: string;
    telegram?: string;
    tone?: string;
    extra?: Record<string, unknown>;
    imageUrl?: string;
    imagePrompt?: string;
  } | null;
  onSuccess: (mint: string, agentUrl?: string) => void;
}

export default function OpenClawLaunch({
  apiKey,
  tokenName,
  symbol,
  imageFile = null,
  imageUrl,
  websiteUrl,
  twitterUrl,
  telegramUrl,
  description = "OpenClaw agent token",
  seedPayload = null,
  onSuccess,
}: OpenClawLaunchProps) {
  const { wallets } = useWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const handleLaunch = async () => {
    const trimmedName = tokenName.trim();
    const trimmedSymbol = symbol.trim().toUpperCase();
    if (!trimmedName || !trimmedSymbol) {
      alert("Please enter token name and ticker.");
      return;
    }
    if (!imageFile && !imageUrl) {
      alert("Please upload a token image or provide an image URL.");
      return;
    }
    if (!apiKey.trim()) {
      alert("Please enter your LLM API key.");
      return;
    }

    const solanaWallet = wallets?.[0];
    if (!solanaWallet) {
      alert("Please connect your Solana wallet first.");
      return;
    }

    setLoading(true);
    setStatusMsg("");

    try {
      const connection = new Connection(
        process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com",
        "confirmed"
      );
      const publicKey = new PublicKey(solanaWallet.address);
      const sdk = new PumpSdk();

      setStatusMsg("Grinding Contract Address");
      const mint = await grindVanityKeypair(VANITY_SUFFIX, (attempts) => {
        const pct = Math.min(100, Math.round((attempts / EXPECTED_ATTEMPTS_EVE) * 100));
        setStatusMsg(`Grinding Contract Address (${pct}%)`);
      });
      const shortMint = mint.publicKey.toBase58().slice(0, 8);

      setStatusMsg("Uploading image and metadata...");
      let fileToUpload: File = imageFile!;
      if (!fileToUpload && imageUrl) {
        fileToUpload = await imageUrlToFile(imageUrl, `${trimmedSymbol}.png`);
      }
      const imageStorageRef = ref(storage, `openclaw/${shortMint}-i`);
      await uploadBytes(imageStorageRef, fileToUpload, { contentType: fileToUpload.type });
      const finalImageUrl = await getDownloadURL(imageStorageRef);

      const metadata = {
        name: trimmedName,
        symbol: trimmedSymbol,
        description: (description || "OpenClaw agent token").trim(),
        image: finalImageUrl,
        showName: true,
        createdOn: "https://pump.fun",
        twitter: twitterUrl.trim() || "",
        telegram: telegramUrl.trim() || "",
        website: websiteUrl.trim() || "",
      };

      const metadataBlob = new Blob([JSON.stringify(metadata)], { type: "application/json" });
      const metadataStorageRef = ref(storage, `openclaw/${shortMint}-m`);
      await uploadBytes(metadataStorageRef, metadataBlob, { contentType: "application/json" });
      const metadataUrl = await getDownloadURL(metadataStorageRef);

      setStatusMsg("Building token creation transaction...");
      const createIx = await sdk.createV2Instruction({
        mint: mint.publicKey,
        name: trimmedName,
        symbol: trimmedSymbol,
        uri: metadataUrl,
        creator: publicKey,
        user: publicKey,
        mayhemMode: false,
      });

      const createTx = new Transaction().add(createIx);
      const createBh = await connection.getLatestBlockhash("confirmed");
      createTx.recentBlockhash = createBh.blockhash;
      createTx.feePayer = publicKey;
      createTx.partialSign(mint);

      setStatusMsg("Approve token creation in your wallet...");
      const serializedCreateTx = createTx.serialize({ requireAllSignatures: false });
      const { signature: createRawSig } = await signAndSendTransaction({
        transaction: serializedCreateTx,
        wallet: solanaWallet as any,
      });

      const createSig = toBase58Sig(createRawSig);
      setStatusMsg("Confirming on-chain...");

      const createConfirm = await connection.confirmTransaction(
        {
          signature: createSig,
          blockhash: createBh.blockhash,
          lastValidBlockHeight: createBh.lastValidBlockHeight,
        },
        "confirmed"
      );

      if (createConfirm.value.err) {
        throw new Error(`Token creation failed. Check: https://solscan.io/tx/${createSig}`);
      }

      const mintB58 = mint.publicKey.toBase58();
      const creatorAddress = solanaWallet.address;

      const launchPayload = {
        mint: mintB58,
        creator: creatorAddress,
        seedPayload: seedPayload ?? {
          name: trimmedName,
          ticker: trimmedSymbol,
          description: description?.trim() ?? "",
          twitter: twitterUrl.trim() || undefined,
          website: websiteUrl.trim() || undefined,
          telegram: telegramUrl.trim() || undefined,
          imageUrl: imageUrl ?? undefined,
        },
      };
      const maxLaunchRecordRetries = 3;
      for (let attempt = 1; attempt <= maxLaunchRecordRetries; attempt++) {
        try {
          const res = await fetch("/api/openclaw/launch-record", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(launchPayload),
          });
          if (res.ok) break;
          if (attempt < maxLaunchRecordRetries) await new Promise((r) => setTimeout(r, 1000 * attempt));
          else console.warn("Launch record failed after retries (token is live):", await res.text());
        } catch (e) {
          if (attempt < maxLaunchRecordRetries) await new Promise((r) => setTimeout(r, 1000 * attempt));
          else console.warn("Launch record error (token is live):", e);
        }
      }

      setStatusMsg("Deploying agent...");
      let agentUrl: string | undefined;
      try {
        const deployRes = await fetch("/api/openclaw/deploy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: apiKey.trim(), mint: mintB58 }),
        });
        const deployJson = await deployRes.json();
        if (deployJson.agentUrl) agentUrl = deployJson.agentUrl;
      } catch (e) {
        console.warn("Deploy API error (token is live):", e);
      }

      onSuccess(mintB58, agentUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatusMsg("");
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-2">
      <button
        type="button"
        onClick={handleLaunch}
        disabled={loading}
        className="w-full rounded-xl bg-red-500 hover:bg-red-600 disabled:bg-red-500/50 text-white font-bold py-3 px-4 text-sm transition-colors"
      >
        {loading ? statusMsg || "Deploying..." : "Deploy token (gas only)"}
      </button>
    </div>
  );
}
