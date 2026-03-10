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

export interface OpenClawLaunchProps {
  apiKey: string;
  tokenName: string;
  symbol: string;
  imageFile: File | null;
  websiteUrl: string;
  twitterUrl: string;
  telegramUrl: string;
  onSuccess: (mint: string, agentUrl?: string) => void;
}

export default function OpenClawLaunch({
  apiKey,
  tokenName,
  symbol,
  imageFile,
  websiteUrl,
  twitterUrl,
  telegramUrl,
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
    if (!imageFile) {
      alert("Please upload a token image.");
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
      const mint = Keypair.generate();
      const shortMint = mint.publicKey.toBase58().slice(0, 8);

      setStatusMsg("Uploading image and metadata...");
      const imageStorageRef = ref(storage, `openclaw/${shortMint}-i`);
      await uploadBytes(imageStorageRef, imageFile, { contentType: imageFile.type });
      const finalImageUrl = await getDownloadURL(imageStorageRef);

      const metadata = {
        name: trimmedName,
        symbol: trimmedSymbol,
        description: "OpenClaw agent token",
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
        {loading ? statusMsg || "Launching..." : "Launch token & agent"}
      </button>
    </div>
  );
}
