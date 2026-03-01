import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useWallets, useSignAndSendTransaction } from "@privy-io/react-auth/solana";
import { Connection, Keypair, Transaction, TransactionInstruction, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import { PumpSdk, bondingCurvePda, creatorVaultPda, userVolumeAccumulatorPda, GLOBAL_PDA, PUMP_FEE_CONFIG_PDA, PUMP_PROGRAM_ID, PUMP_FEE_PROGRAM_ID, PUMP_EVENT_AUTHORITY_PDA, GLOBAL_VOLUME_ACCUMULATOR_PDA } from "@pump-fun/pump-sdk";
import bs58 from "bs58";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/services/firebase.service";
import { addTtsVoiceModel, updateTtsVoiceModel, checkTtsVoiceModelExists } from "@/services/db/voiceModels.db";
import { downloadAndProcessVoiceModel } from "@/lib/rvcHf";

const EVE_MINT = new PublicKey(process.env.NEXT_PUBLIC_EVE_MINT || "4mVbX7EZonRcEfiyFbbw2ByrYc7xAkUMp3NKWhDwpump");
const PLATFORM_WALLET = new PublicKey(process.env.NEXT_PUBLIC_PLATFORM_WALLET || "6DqLQfhiDNsLWtSs3iFbXUXQ8eDshVcmXjRBUC5XsS92");
const SOL_FEE_EQUIVALENT = 0.01;

function toBase58Sig(raw: any): string {
  if (typeof raw === "string") return raw;
  if (raw instanceof Uint8Array) return bs58.encode(raw);
  if (raw?.data) return bs58.encode(new Uint8Array(raw.data));
  return String(raw);
}

export default function AddVoiceModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { wallets } = useWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const [modelUrl, setModelUrl] = useState("");
  const [modelName, setModelName] = useState("");
  const [tokenName, setTokenName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [creatorSplit, setCreatorSplit] = useState<number>(50);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const [evePrice, setEvePrice] = useState<number | null>(null);
  const [eveFeeAmount, setEveFeeAmount] = useState<number | null>(null);
  const [evePriceLoading, setEvePriceLoading] = useState(false);

  const [creatorBuySol, setCreatorBuySol] = useState<string>("");

  useEffect(() => {
    if (!isOpen) return;
    fetchEvePrice();
  }, [isOpen]);

  async function fetchEvePrice() {
    setEvePriceLoading(true);
    try {
      const res = await fetch("/api/eve-price");
      if (!res.ok) throw new Error("Failed to fetch EVE price");
      const { pricePerSol } = await res.json();
      setEvePrice(pricePerSol);
      setEveFeeAmount(SOL_FEE_EQUIVALENT / pricePerSol);
    } catch (err) {
      console.error("EVE price fetch error:", err);
      setEvePrice(null);
      setEveFeeAmount(null);
    } finally {
      setEvePriceLoading(false);
    }
  }

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatorSplit < 0 || creatorSplit > 90) return;

    const solanaWallet = wallets[0];
    if (!solanaWallet) {
      alert("Please connect a valid Solana wallet first!");
      return;
    }
    if (!imageFile) {
      alert("Please upload a token image!");
      return;
    }
    if (!eveFeeAmount || !evePrice) {
      alert("EVE price not loaded yet. Please wait and try again.");
      return;
    }

    setLoading(true);
    try {
      const modelId = modelName.toLowerCase().replace(/\s+/g, "");
      const exists = await checkTtsVoiceModelExists(modelId);
      if (exists) {
        alert("A voice model with this name already exists. Please choose a different name.");
        setLoading(false);
        return;
      }

      const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com", "confirmed");
      const publicKey = new PublicKey(solanaWallet.address);

      // --- Pre-flight: check user has enough EVE tokens ---
      setStatusMsg("Checking EVE balance...");
      const eveDecimals = 6;
      const eveAmountRaw = Math.ceil(eveFeeAmount * 10 ** eveDecimals);
      const userEveAta = getAssociatedTokenAddressSync(EVE_MINT, publicKey, true, TOKEN_2022_PROGRAM_ID);

      let userEveBalance: bigint;
      try {
        const acct = await getAccount(connection, userEveAta, "confirmed", TOKEN_2022_PROGRAM_ID);
        userEveBalance = acct.amount;
      } catch {
        throw new Error(
          `You don't have any EVE tokens. You need ~${eveFeeAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} EVE (≈ ${SOL_FEE_EQUIVALENT} SOL) to create a voice. Buy EVE at https://pump.fun/coin/${EVE_MINT.toBase58()}`
        );
      }

      if (userEveBalance < BigInt(eveAmountRaw)) {
        const humanBalance = Number(userEveBalance) / 10 ** eveDecimals;
        throw new Error(
          `Insufficient EVE balance. You have ${humanBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })} EVE but need ~${eveFeeAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} EVE (≈ ${SOL_FEE_EQUIVALENT} SOL). Buy more at https://pump.fun/coin/${EVE_MINT.toBase58()}`
        );
      }

      // --- Transaction 1: EVE fee payment ---
      setStatusMsg("Building EVE fee transaction...");
      const platformEveAta = getAssociatedTokenAddressSync(EVE_MINT, PLATFORM_WALLET, true, TOKEN_2022_PROGRAM_ID);

      const eveTx = new Transaction();

      let platformAtaExists = false;
      try {
        await getAccount(connection, platformEveAta, "confirmed", TOKEN_2022_PROGRAM_ID);
        platformAtaExists = true;
      } catch {
        platformAtaExists = false;
      }
      if (!platformAtaExists) {
        eveTx.add(
          createAssociatedTokenAccountInstruction(
            publicKey, platformEveAta, PLATFORM_WALLET, EVE_MINT,
            TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
      }

      eveTx.add(
        createTransferInstruction(userEveAta, platformEveAta, publicKey, BigInt(eveAmountRaw), [], TOKEN_2022_PROGRAM_ID)
      );

      let eveBh = await connection.getLatestBlockhash("confirmed");
      eveTx.recentBlockhash = eveBh.blockhash;
      eveTx.feePayer = publicKey;

      setStatusMsg("Approve EVE fee payment in your wallet...");
      const serializedEveTx = eveTx.serialize({ requireAllSignatures: false });
      const { signature: eveRawSig } = await signAndSendTransaction({
        transaction: serializedEveTx,
        wallet: solanaWallet as any,
      });

      const eveSig = toBase58Sig(eveRawSig);
      console.log("EVE fee sent, confirming...", eveSig);
      setStatusMsg("Confirming EVE fee payment...");

      const eveConfirm = await connection.confirmTransaction(
        { signature: eveSig, blockhash: eveBh.blockhash, lastValidBlockHeight: eveBh.lastValidBlockHeight },
        "confirmed"
      );
      if (eveConfirm.value.err) {
        throw new Error(`EVE fee transaction failed on-chain. Check: https://solscan.io/tx/${eveSig}`);
      }
      console.log("EVE fee confirmed:", eveSig);

      // --- Upload metadata ---
      setStatusMsg("Uploading metadata...");
      const sdk = new PumpSdk();
      const mint = Keypair.generate();
      const shortMint = mint.publicKey.toBase58().slice(0, 8);

      const imageStorageRef = ref(storage, `vm/${shortMint}-i`);
      await uploadBytes(imageStorageRef, imageFile, { contentType: imageFile.type });
      const finalImageUrl = await getDownloadURL(imageStorageRef);

      const metadata = {
        name: tokenName,
        symbol: symbol,
        description: `Voice model for ${modelName}`,
        image: finalImageUrl,
        showName: true,
        createdOn: "https://pump.fun",
        twitter: "",
        telegram: "",
        website: "",
      };

      const metadataBlob = new Blob([JSON.stringify(metadata)], { type: "application/json" });
      const metadataStorageRef = ref(storage, `vm/${shortMint}-m`);
      await uploadBytes(metadataStorageRef, metadataBlob, { contentType: "application/json" });
      const metadataUrl = await getDownloadURL(metadataStorageRef);

      // --- Transaction 2: Token creation (+ optional creator buy) ---
      const creatorBuySolNum = parseFloat(creatorBuySol) || 0;
      const useCreatorBuy = creatorBuySolNum > 0;

      let tokenInstructions: any[];

      if (useCreatorBuy) {
        setStatusMsg("Preparing creator buy prerequisites...");

        const globalAcct = await connection.getAccountInfo(GLOBAL_PDA);
        if (!globalAcct) throw new Error("Failed to fetch pump.fun global account");
        const global = sdk.decodeGlobal(globalAcct);

        const feeRecipients = [global.feeRecipient, ...global.feeRecipients];
        const feeRecipient = feeRecipients[Math.floor(Math.random() * feeRecipients.length)];

        const bc = bondingCurvePda(mint.publicKey);
        const associatedUser = getAssociatedTokenAddressSync(mint.publicKey, publicKey, true, TOKEN_2022_PROGRAM_ID);

        const volumePda = userVolumeAccumulatorPda(publicKey);
        const volumeAcct = await connection.getAccountInfo(volumePda);
        if (!volumeAcct) {
          setStatusMsg("Initializing volume accumulator (one-time setup)...");
          const initIx = await sdk.initUserVolumeAccumulator({ payer: publicKey, user: publicKey });
          const initTx = new Transaction().add(initIx);
          const initBh = await connection.getLatestBlockhash("confirmed");
          initTx.recentBlockhash = initBh.blockhash;
          initTx.feePayer = publicKey;

          const serializedInitTx = initTx.serialize({ requireAllSignatures: false });
          const { signature: initRawSig } = await signAndSendTransaction({
            transaction: serializedInitTx,
            wallet: solanaWallet as any,
          });
          const initSig = toBase58Sig(initRawSig);
          console.log("Volume accumulator init sent:", initSig);

          const initConfirm = await connection.confirmTransaction(
            { signature: initSig, blockhash: initBh.blockhash, lastValidBlockHeight: initBh.lastValidBlockHeight },
            "confirmed"
          );
          if (initConfirm.value.err) {
            throw new Error(`Volume accumulator init failed. Check: https://solscan.io/tx/${initSig}`);
          }
          console.log("Volume accumulator initialized:", initSig);
        }

        // TX1: Create token + extend account (no buy — separate due to u64 overflow in same-tx buy)
        setStatusMsg("Building token creation transaction...");
        const createIx = await sdk.createV2Instruction({
          mint: mint.publicKey, name: tokenName, symbol, uri: metadataUrl,
          creator: publicKey, user: publicKey, mayhemMode: false,
        });
        const extendIx = await sdk.extendAccountInstruction({
          account: bc, user: publicKey,
        });

        const createTx1 = new Transaction().add(createIx, extendIx);
        const createBh1 = await connection.getLatestBlockhash("confirmed");
        createTx1.recentBlockhash = createBh1.blockhash;
        createTx1.feePayer = publicKey;
        createTx1.partialSign(mint);

        setStatusMsg("Approve token creation in your wallet...");
        const serializedCreate1 = createTx1.serialize({ requireAllSignatures: false });
        const { signature: createRawSig1 } = await signAndSendTransaction({
          transaction: serializedCreate1,
          wallet: solanaWallet as any,
        });

        const createSig1 = toBase58Sig(createRawSig1);
        console.log("Token creation sent, confirming...", createSig1);
        setStatusMsg("Confirming token creation on-chain...");

        const createConfirm1 = await connection.confirmTransaction(
          { signature: createSig1, blockhash: createBh1.blockhash, lastValidBlockHeight: createBh1.lastValidBlockHeight },
          "confirmed"
        );
        if (createConfirm1.value.err) {
          throw new Error(`Token creation failed on-chain — no token was created. Check: https://solscan.io/tx/${createSig1}`);
        }
        console.log("Token created:", createSig1);

        // TX2: Creator buy (separate transaction — bonding curve is now confirmed on-chain)
        setStatusMsg("Building creator buy transaction...");

        const ataIx = createAssociatedTokenAccountIdempotentInstruction(
          publicKey, associatedUser, publicKey, mint.publicKey, TOKEN_2022_PROGRAM_ID
        );

        // Calculate token amount client-side using BigInt (no u64 overflow)
        const solLamports = BigInt(Math.floor(creatorBuySolNum * LAMPORTS_PER_SOL));
        const totalFeeBps = 125n; // 95 protocol + 30 creator
        const netSol = (solLamports * 10000n) / (10000n + totalFeeBps);
        const vtr = 1073000000000000n;
        const vsr = 30000000000n;
        const tokenAmount = ((netSol - 1n) * vtr) / (vsr + netSol - 1n);
        const maxSolCost = solLamports + (solLamports * 50n / 1000n); // 5% slippage

        // Build `buy` instruction manually (25 bytes: disc + amount + maxSolCost + trackVolume)
        const BUY_DISC = Buffer.from([102, 6, 61, 18, 1, 218, 235, 234]);
        const buyData = Buffer.alloc(25);
        BUY_DISC.copy(buyData, 0);
        buyData.writeBigUInt64LE(tokenAmount, 8);
        buyData.writeBigUInt64LE(maxSolCost, 16);
        buyData[24] = 0x01; // trackVolume = true (1 byte)

        const associatedBondingCurve = getAssociatedTokenAddressSync(mint.publicKey, bc, true, TOKEN_2022_PROGRAM_ID);
        const [bondingCurveV2] = PublicKey.findProgramAddressSync(
          [Buffer.from("bonding-curve-v2"), mint.publicKey.toBuffer()],
          PUMP_PROGRAM_ID
        );

        const buyIx = new TransactionInstruction({
          programId: PUMP_PROGRAM_ID,
          keys: [
            { pubkey: GLOBAL_PDA, isSigner: false, isWritable: false },
            { pubkey: feeRecipient, isSigner: false, isWritable: true },
            { pubkey: mint.publicKey, isSigner: false, isWritable: false },
            { pubkey: bc, isSigner: false, isWritable: true },
            { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
            { pubkey: associatedUser, isSigner: false, isWritable: true },
            { pubkey: publicKey, isSigner: true, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: creatorVaultPda(publicKey), isSigner: false, isWritable: true },
            { pubkey: PUMP_EVENT_AUTHORITY_PDA, isSigner: false, isWritable: false },
            { pubkey: PUMP_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: GLOBAL_VOLUME_ACCUMULATOR_PDA, isSigner: false, isWritable: false },
            { pubkey: volumePda, isSigner: false, isWritable: true },
            { pubkey: PUMP_FEE_CONFIG_PDA, isSigner: false, isWritable: false },
            { pubkey: PUMP_FEE_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: bondingCurveV2, isSigner: false, isWritable: false },
          ],
          data: buyData,
        });

        const buyTx = new Transaction().add(ataIx, buyIx);
        const buyBh = await connection.getLatestBlockhash("confirmed");
        buyTx.recentBlockhash = buyBh.blockhash;
        buyTx.feePayer = publicKey;

        setStatusMsg("Approve creator buy in your wallet...");
        const serializedBuyTx = buyTx.serialize({ requireAllSignatures: false });
        const { signature: buyRawSig } = await signAndSendTransaction({
          transaction: serializedBuyTx,
          wallet: solanaWallet as any,
        });

        const buySig = toBase58Sig(buyRawSig);
        console.log("Creator buy sent, confirming...", buySig);
        setStatusMsg("Confirming creator buy on-chain...");

        const buyConfirm = await connection.confirmTransaction(
          { signature: buySig, blockhash: buyBh.blockhash, lastValidBlockHeight: buyBh.lastValidBlockHeight },
          "confirmed"
        );

        if (buyConfirm.value.err) {
          console.error("Creator buy failed on-chain:", buySig);
          alert(`Token was created but the initial buy failed. You can buy manually on pump.fun. Check: https://solscan.io/tx/${buySig}`);
        } else {
          console.log("Creator buy confirmed:", buySig);
        }

        // Skip the standard token creation flow below — we handled it above
        tokenInstructions = [];
      } else {
        setStatusMsg("Building token creation transaction...");
        const createIx = await sdk.createV2Instruction({
          mint: mint.publicKey,
          name: tokenName,
          symbol: symbol,
          uri: metadataUrl,
          creator: publicKey,
          user: publicKey,
          mayhemMode: false,
        });
        tokenInstructions = [createIx];
      }

      if (tokenInstructions.length > 0) {
        const createTx = new Transaction();
        tokenInstructions.forEach((ix) => createTx.add(ix));

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
        console.log("Token creation sent, confirming...", createSig);
        setStatusMsg("Confirming token creation on-chain...");

        const createConfirm = await connection.confirmTransaction(
          { signature: createSig, blockhash: createBh.blockhash, lastValidBlockHeight: createBh.lastValidBlockHeight },
          "confirmed"
        );
        if (createConfirm.value.err) {
          throw new Error(`Transaction failed on-chain — no token was created. Check: https://solscan.io/tx/${createSig}`);
        }
        console.log("Token created and confirmed:", createSig);
      }

      // Generate a claimable wallet for the voice owner (needed for fee sharing split)
      setStatusMsg("Generating voice owner wallet...");
      let ownerWalletPubkey: string | null = null;
      try {
        const walletRes = await fetch("/api/wallets/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ voiceModelId: modelId }),
        });
        const walletOk = walletRes.ok;
        const walletStatus = walletRes.status;
        let walletErrorBody = "";
        if (walletOk) {
          const data = await walletRes.json();
          ownerWalletPubkey = data.publicKey ?? null;
          console.log("Voice owner wallet generated:", ownerWalletPubkey);
        } else {
          walletErrorBody = await walletRes.text();
        }
        // #region agent log
        const walletPayload: Record<string, unknown> = { ok: walletOk, status: walletStatus, publicKey: ownerWalletPubkey };
        if (!walletOk) walletPayload.body = walletErrorBody;
        const h1Payload = { location: "AddVoiceModal.tsx:wallet-generate", message: "Wallet generation API result", data: walletPayload, timestamp: Date.now(), hypothesisId: "H1" };
        console.log("[fee-share-debug]", JSON.stringify(h1Payload));
        fetch("http://127.0.0.1:7242/ingest/be185e9e-d26d-4cab-80be-f1fc706cc215", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(h1Payload) }).catch(() => {});
        // #endregion
        if (!walletOk && walletErrorBody.includes("WALLET_ENCRYPTION_KEY") && creatorSplit < 100) {
          alert("Creator reward split is disabled: the server is missing WALLET_ENCRYPTION_KEY. Add a 64-character hex value to your production environment variables (e.g. in Vercel) to enable voice owner wallets and reward splits.");
        }
      } catch (walletErr) {
        // #region agent log
        const h1CatchPayload = { location: "AddVoiceModal.tsx:wallet-generate-catch", message: "Wallet generation threw", data: { err: String(walletErr) }, timestamp: Date.now(), hypothesisId: "H1" };
        console.log("[fee-share-debug]", JSON.stringify(h1CatchPayload));
        fetch("http://127.0.0.1:7242/ingest/be185e9e-d26d-4cab-80be-f1fc706cc215", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(h1CatchPayload) }).catch(() => {});
        // #endregion
        console.error("Failed to generate voice owner wallet:", walletErr);
      }

      // #region agent log
      const willEnterFeeSharing = !!(ownerWalletPubkey && creatorSplit < 100);
      const h2Payload = { location: "AddVoiceModal.tsx:fee-sharing-branch", message: "Fee sharing branch", data: { ownerWalletPubkey, creatorSplit, willEnterFeeSharing }, timestamp: Date.now(), hypothesisId: "H2" };
      console.log("[fee-share-debug]", JSON.stringify(h2Payload));
      fetch("http://127.0.0.1:7242/ingest/be185e9e-d26d-4cab-80be-f1fc706cc215", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(h2Payload) }).catch(() => {});
      // #endregion

      // Fee sharing — split creator rewards between deployer and voice owner wallet
      if (ownerWalletPubkey && creatorSplit < 100) {
        try {
          const splitWallet = new PublicKey(ownerWalletPubkey);
          const creatorBps = Math.floor(creatorSplit * 100);
          const splitBps = 10000 - creatorBps;

          if (splitBps > 0) {
            setStatusMsg("Setting up fee sharing...");
            const feeSharingTx = new Transaction();
            const createFeeSharingIx = await sdk.createFeeSharingConfig({
              creator: publicKey,
              mint: mint.publicKey,
              pool: null,
            });
            const updateFeeSharesIx = await sdk.updateFeeShares({
              authority: publicKey,
              mint: mint.publicKey,
              currentShareholders: [publicKey],
              newShareholders: [
                { address: publicKey, shareBps: creatorBps },
                { address: splitWallet, shareBps: splitBps },
              ],
            });
            feeSharingTx.add(createFeeSharingIx, updateFeeSharesIx);

            const feeBh = await connection.getLatestBlockhash("confirmed");
            feeSharingTx.recentBlockhash = feeBh.blockhash;
            feeSharingTx.feePayer = publicKey;

            setStatusMsg("Approve fee sharing setup in your wallet...");
            const serializedFeeTx = feeSharingTx.serialize({ requireAllSignatures: false });
            let feeSig: string | null = null;
            try {
              const { signature: feeRawSig } = await signAndSendTransaction({
                transaction: serializedFeeTx,
                wallet: solanaWallet as any,
              });
              feeSig = toBase58Sig(feeRawSig);
              // #region agent log
              const h3Payload = { location: "AddVoiceModal.tsx:fee-sharing-sent", message: "Fee sharing tx sent", data: { feeSig }, timestamp: Date.now(), hypothesisId: "H3" };
              console.log("[fee-share-debug]", JSON.stringify(h3Payload));
              fetch("http://127.0.0.1:7242/ingest/be185e9e-d26d-4cab-80be-f1fc706cc215", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(h3Payload) }).catch(() => {});
              // #endregion
              console.log("Fee sharing sent, confirming...", feeSig);

              setStatusMsg("Confirming fee sharing on-chain...");
              const feeConfirm = await connection.confirmTransaction(
                { signature: feeSig, blockhash: feeBh.blockhash, lastValidBlockHeight: feeBh.lastValidBlockHeight },
                "confirmed"
              );
              // #region agent log
              const h4Payload = { location: "AddVoiceModal.tsx:fee-sharing-confirm", message: "Fee sharing confirm result", data: { err: feeConfirm.value.err }, timestamp: Date.now(), hypothesisId: "H4" };
              console.log("[fee-share-debug]", JSON.stringify(h4Payload));
              fetch("http://127.0.0.1:7242/ingest/be185e9e-d26d-4cab-80be-f1fc706cc215", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(h4Payload) }).catch(() => {});
              // #endregion
              if (feeConfirm.value.err) {
                console.error("Fee sharing tx failed on-chain:", feeSig);
                alert("Token created but fee sharing setup failed on-chain. You can configure it later.");
              } else {
                console.log("Fee sharing confirmed:", feeSig);
              }
            } catch (sendErr) {
              // #region agent log
              const h3CatchPayload = { location: "AddVoiceModal.tsx:fee-sharing-send-catch", message: "Fee sharing signAndSend threw", data: { err: String(sendErr) }, timestamp: Date.now(), hypothesisId: "H3" };
              console.log("[fee-share-debug]", JSON.stringify(h3CatchPayload));
              fetch("http://127.0.0.1:7242/ingest/be185e9e-d26d-4cab-80be-f1fc706cc215", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(h3CatchPayload) }).catch(() => {});
              // #endregion
              throw sendErr;
            }
          }
        } catch (e) {
          // #region agent log
          const h5Payload = { location: "AddVoiceModal.tsx:fee-sharing-catch", message: "Fee sharing catch", data: { err: String(e) }, timestamp: Date.now(), hypothesisId: "H5" };
          console.log("[fee-share-debug]", JSON.stringify(h5Payload));
          fetch("http://127.0.0.1:7242/ingest/be185e9e-d26d-4cab-80be-f1fc706cc215", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(h5Payload) }).catch(() => {});
          // #endregion
          console.error("Error setting up fee sharing", e);
          alert("Token created but fee sharing setup failed. You can configure it later.");
        }
      }

      // Process voice model via Gradio
      setStatusMsg("Processing voice model...");
      const result = await downloadAndProcessVoiceModel(modelUrl, modelId);
      console.log("Gradio API result:", (result as any).data);

      // Save to Firestore
      setStatusMsg("Saving voice model...");
      await addTtsVoiceModel(modelId, {
        id: modelId,
        model_url: modelUrl,
        model_name: modelName,
        token_name: tokenName,
        symbol,
        creator_split: Number(creatorSplit),
        split: 100 - Number(creatorSplit),
        creator_wallet: solanaWallet.address,
        split_wallet: ownerWalletPubkey || "",
        deployed: true,
        token_address: mint.publicKey.toBase58(),
        image_url: finalImageUrl || undefined,
        ...(ownerWalletPubkey ? { voice_owner_wallet: ownerWalletPubkey } : {}),
      });

      window.open(`https://pump.fun/coin/${mint.publicKey.toBase58()}`, "_blank");

      onClose();
      setModelUrl("");
      setModelName("");
      setTokenName("");
      setSymbol("");
      setImageFile(null);
      setCreatorSplit(50);
      setCreatorBuySol("");
      setStatusMsg("");
    } catch (err: any) {
      console.error(err);
      const msg = err instanceof Error ? err.message : (err?.message || String(err));
      alert(msg);
      setStatusMsg("");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-zinc-900 border border-white/10 p-6 rounded-3xl w-full max-w-md shadow-2xl relative max-h-[90vh] overflow-y-auto"
      >
        <button onClick={onClose} className="absolute top-5 right-5 text-zinc-500 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-xl text-white font-bold mb-6">Add new voice</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Downloadable Model URL</label>
            <input required type="url" value={modelUrl} onChange={(e) => setModelUrl(e.target.value)} className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/50" placeholder="https://..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Model Name</label>
            <input required type="text" value={modelName} onChange={(e) => setModelName(e.target.value)} className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/50" placeholder="e.g. My Custom Voice" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Token Name</label>
              <input required type="text" value={tokenName} onChange={(e) => setTokenName(e.target.value)} className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/50" placeholder="e.g. My Voice Coin" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Symbol</label>
              <input required type="text" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/50" placeholder="e.g. VOICE" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Token Image</label>
            <input required type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20 focus:outline-none focus:border-red-500/50" />
          </div>

          {/* EVE Fee Display */}
          <div className="bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-zinc-400">Creation Fee</span>
              {evePriceLoading ? (
                <span className="text-xs text-zinc-500">Loading price...</span>
              ) : eveFeeAmount ? (
                <span className="text-xs text-white font-semibold">
                  ~{eveFeeAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} EVE
                  <span className="text-zinc-500 ml-1">(≈ {SOL_FEE_EQUIVALENT} SOL)</span>
                </span>
              ) : (
                <button type="button" onClick={fetchEvePrice} className="text-xs text-red-400 hover:text-red-300">
                  Retry
                </button>
              )}
            </div>
          </div>

          {/* Creator Buy */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Initial Buy (optional)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                value={creatorBuySol}
                onChange={(e) => setCreatorBuySol(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/50 pr-14"
                placeholder="0.00"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-medium">SOL</span>
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">
              Seed your token with an initial buy to provide liquidity. Leave empty or 0 to skip.
            </p>
          </div>

          <div>
            <div className="flex justify-between items-end mb-2">
              <label className="block text-xs font-medium text-zinc-400">Deployer Split Share</label>
              <span className="text-xs font-bold text-white bg-white/10 px-2 py-0.5 rounded">{creatorSplit}%</span>
            </div>
            <input
              required
              type="range"
              min="0"
              max="90"
              value={creatorSplit}
              onChange={(e) => setCreatorSplit(Number(e.target.value))}
              className="w-full accent-red-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between mt-2">
              <p className="text-[10px] text-zinc-500">Max: 90%</p>
              <p className="text-[10px] text-zinc-500">Voice Owner Share: <span className="text-zinc-300 font-semibold">{100 - creatorSplit}%</span></p>
            </div>
          </div>

          {statusMsg && (
            <p className="text-xs text-zinc-400 text-center animate-pulse">{statusMsg}</p>
          )}

          <button disabled={loading || evePriceLoading} type="submit" className="w-full mt-2 py-3 bg-red-500/80 hover:bg-red-500 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50">
            {loading ? "Processing..." : "Add Voice"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
