import React, { useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useWallets } from "@privy-io/react-auth";
import { useSignAndSendTransaction } from "@privy-io/react-auth/solana";
import { Connection, Keypair, Transaction, PublicKey } from "@solana/web3.js";
import { PumpSdk } from "@pump-fun/pump-sdk";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/services/firebase.service";
import { addTtsVoiceModel, updateTtsVoiceModel } from "@/services/db/voiceModels.db";
import { downloadAndProcessVoiceModel } from "@/lib/rvcHf";

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

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatorSplit < 0 || creatorSplit > 90) return;
    
    const solanaWallet = wallets[0];
    if (!solanaWallet) {
      alert("Please connect a wallet first!");
      return;
    }

    if (!imageFile) {
      alert("Please upload a token image!");
      return;
    }

    setLoading(true);
    try {
      // 1. Call Gradio API First
      console.log("Calling Gradio API...");
      const result = await downloadAndProcessVoiceModel(modelUrl, modelName);
      console.log("Gradio API result:", (result as any).data);

      // 2. Store doc with deployed: false
      const docId = await addTtsVoiceModel({
        model_url: modelUrl,
        model_name: modelName,
        token_name: tokenName,
        symbol,
        creator_split: Number(creatorSplit),
        split: 100 - Number(creatorSplit),
        creator_wallet: solanaWallet.address,
        split_wallet: process.env.NEXT_PUBLIC_SPLIT_WALLET || "",
        deployed: false,
      });

      // 3. Setup Solana Provider & PumpSdk
      const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
      const publicKey = new PublicKey(solanaWallet.address);
      const sdk = new PumpSdk();
      const mint = Keypair.generate();

      // 4. Create Token Metadata via Firebase
      console.log("Uploading image to Firebase Storage for metadata...");
      const imageStorageRef = ref(storage, `voice-models/${mint.publicKey.toBase58()}-${imageFile.name}`);
      await uploadBytes(imageStorageRef, imageFile, { contentType: imageFile.type });
      const finalImageUrl = await getDownloadURL(imageStorageRef);

      console.log("Uploading metadata to Firebase Storage...");
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
      const metadataStorageRef = ref(storage, `voice-models/${mint.publicKey.toBase58()}-metadata.json`);
      await uploadBytes(metadataStorageRef, metadataBlob, { contentType: "application/json" });
      const metadataUrl = await getDownloadURL(metadataStorageRef);

      // 5. Build & Send Create Transaction
      console.log("Deploying token...", mint.publicKey.toBase58());
      
      const createIx = await sdk.createInstruction({
        mint: mint.publicKey,
        name: tokenName,
        symbol: symbol,
        uri: metadataUrl,
        creator: publicKey,
        user: publicKey,
      });
      
      const createTx = new Transaction().add(createIx);

      const splitWalletAddress = process.env.NEXT_PUBLIC_SPLIT_WALLET;
      if (splitWalletAddress && creatorSplit < 100) {
        try {
          const splitWallet = new PublicKey(splitWalletAddress);
          const creatorBps = Math.floor(creatorSplit * 100);
          const splitBps = 10000 - creatorBps;
          
          if (splitBps > 0) {
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
                { address: splitWallet, shareBps: splitBps }
              ],
            });
            createTx.add(createFeeSharingIx, updateFeeSharesIx);
          }
        } catch (e) {
          console.error("Error adding split instructions", e);
          return alert("Failied to deploy token, try again later")
        }
      }
      
      const latestBlockhash = await connection.getLatestBlockhash("confirmed");
      createTx.recentBlockhash = latestBlockhash.blockhash;
      createTx.feePayer = publicKey;
      createTx.partialSign(mint);

      console.log("Requesting signature...");
      const { signature } = await signAndSendTransaction({
        transaction: createTx as any,
        wallet: solanaWallet as any,
      });
      console.log("Deployed! Signature:", signature);

      // 6. Update DB to deployed: true and save image url
      await updateTtsVoiceModel(docId, {
        deployed: true,
        image_url: finalImageUrl || undefined,
      });

      onClose();
      setModelUrl("");
      setModelName("");
      setTokenName("");
      setSymbol("");
      setImageFile(null);
      setCreatorSplit(50);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : String(err));
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-zinc-900 border border-white/10 p-6 rounded-3xl w-full max-w-md shadow-2xl relative">
        <button onClick={onClose} className="absolute top-5 right-5 text-zinc-500 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-xl text-white font-bold mb-6">Add new voice</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Downloadable Model URL</label>
            <input required type="url" value={modelUrl} onChange={e=>setModelUrl(e.target.value)} className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/50" placeholder="https://..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Model Name</label>
            <input required type="text" value={modelName} onChange={e=>setModelName(e.target.value)} className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/50" placeholder="e.g. My Custom Voice" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Token Name</label>
              <input required type="text" value={tokenName} onChange={e=>setTokenName(e.target.value)} className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/50" placeholder="e.g. Krabs Coin" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Symbol</label>
              <input required type="text" value={symbol} onChange={e=>setSymbol(e.target.value.toUpperCase())} className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/50" placeholder="e.g. KRABS" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Token Image</label>
            <input required type="file" accept="image/*" onChange={e=>setImageFile(e.target.files?.[0] || null)} className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20 focus:outline-none focus:border-red-500/50" />
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
              onChange={e=>setCreatorSplit(Number(e.target.value))} 
              className="w-full accent-red-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer" 
            />
            <div className="flex justify-between mt-2">
              <p className="text-[10px] text-zinc-500">Max: 90%</p>
              <p className="text-[10px] text-zinc-500">Voice Owner Share: <span className="text-zinc-300 font-semibold">{100 - creatorSplit}%</span></p>
            </div>
          </div>
          <button disabled={loading} type="submit" className="w-full mt-2 py-3 bg-red-500/80 hover:bg-red-500 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50">
            {loading ? "Processing..." : "Add Voice"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
