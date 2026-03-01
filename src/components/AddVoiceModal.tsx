import React, { useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useWallets, useSignAndSendTransaction } from "@privy-io/react-auth/solana";
import { Connection, Keypair, Transaction, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";
import { PumpSdk } from "@pump-fun/pump-sdk";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/services/firebase.service";
import { addTtsVoiceModel, updateTtsVoiceModel, checkTtsVoiceModelExists } from "@/services/db/voiceModels.db";
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
    
    // Wallet should already be connected before modal opens (handled by AgentsSocialPage)
    const solanaWallet = wallets[0];

    // #region agent log — H3: wallet state
    fetch('http://127.0.0.1:7242/ingest/be185e9e-d26d-4cab-80be-f1fc706cc215',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AddVoiceModal.tsx:handleSubmit:entry',message:'Wallet state at submit',data:{walletCount:wallets.length,wallet0Address:solanaWallet?.address,wallet0Type:(solanaWallet as any)?.walletClientType,wallet0ChainType:(solanaWallet as any)?.chainType,allWallets:wallets.map((w:any)=>({addr:w.address,type:w.walletClientType,chain:w.chainType}))},timestamp:Date.now(),hypothesisId:'H3',runId:'run1'})}).catch(()=>{});
    // #endregion
    
    if (!solanaWallet) {
      alert("Please connect a valid Solana wallet first!");
      return;
    }

    if (!imageFile) {
      alert("Please upload a token image!");
      return;
    }

    setLoading(true);
    try {
      const modelId = modelName.toLowerCase().replace(/\s+/g, ""); // Remove spaces
      const exists = await checkTtsVoiceModelExists(modelId);
      if (exists) {
        alert("A voice model with this name already exists. Please choose a different name.");
        setLoading(false);
        return;
      }

      // 1. Setup Solana Provider & PumpSdk
      const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com", "confirmed");
      const publicKey = new PublicKey(solanaWallet.address);
      const sdk = new PumpSdk();
      const mint = Keypair.generate();

      const MIN_SOL_REQUIRED = 0.022;
      const balance = await connection.getBalance(publicKey);
      // #region agent log — balance check
      fetch('http://127.0.0.1:7242/ingest/be185e9e-d26d-4cab-80be-f1fc706cc215',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AddVoiceModal.tsx:balanceCheck',message:'Wallet balance',data:{balanceLamports:balance,balanceSol:balance/LAMPORTS_PER_SOL,minRequired:MIN_SOL_REQUIRED},timestamp:Date.now(),hypothesisId:'balance',runId:'post-fix'})}).catch(()=>{});
      // #endregion
      if (balance < MIN_SOL_REQUIRED * LAMPORTS_PER_SOL) {
        throw new Error(
          `Insufficient SOL balance. You have ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL but need at least ~${MIN_SOL_REQUIRED} SOL to create a token on pump.fun. Please fund your wallet and try again.`
        );
      }

      // 4. Create Token Metadata via Firebase (short paths to keep URL < 200 chars)
      const shortMint = mint.publicKey.toBase58().slice(0, 8);
      console.log("Uploading image to Firebase Storage for metadata...");
      const imageStorageRef = ref(storage, `vm/${shortMint}-i`);
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
      const metadataStorageRef = ref(storage, `vm/${shortMint}-m`);
      await uploadBytes(metadataStorageRef, metadataBlob, { contentType: "application/json" });
      const metadataUrl = await getDownloadURL(metadataStorageRef);
      console.log("Metadata URL length:", metadataUrl.length, metadataUrl);

      // #region agent log — H1: metadata URI length
      fetch('http://127.0.0.1:7242/ingest/be185e9e-d26d-4cab-80be-f1fc706cc215',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AddVoiceModal.tsx:metadataUrl',message:'Metadata URL details',data:{metadataUrlLength:metadataUrl.length,imageUrlLength:finalImageUrl.length,metadataUrl:metadataUrl.slice(0,100)+'...',imageUrl:finalImageUrl.slice(0,100)+'...'},timestamp:Date.now(),hypothesisId:'H1',runId:'run1'})}).catch(()=>{});
      // #endregion

      // 5. Build & Send Create Transaction (using V2 instruction)
      console.log("Deploying token...", mint.publicKey.toBase58());
      
      // #region agent log — H2: PumpSdk state
      fetch('http://127.0.0.1:7242/ingest/be185e9e-d26d-4cab-80be-f1fc706cc215',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AddVoiceModal.tsx:preSdkCall',message:'PumpSdk and instruction params',data:{sdkType:typeof sdk,sdkKeys:Object.keys(sdk),mintPubkey:mint.publicKey.toBase58(),creatorPubkey:publicKey.toBase58(),tokenName,symbol,uriLength:metadataUrl.length},timestamp:Date.now(),hypothesisId:'H2',runId:'run1'})}).catch(()=>{});
      // #endregion

      const createIx = await sdk.createV2Instruction({
        mint: mint.publicKey,
        name: tokenName,
        symbol: symbol,
        uri: metadataUrl,
        creator: publicKey,
        user: publicKey,
        mayhemMode: false,
      });

      // #region agent log — H4/H5: instruction details
      fetch('http://127.0.0.1:7242/ingest/be185e9e-d26d-4cab-80be-f1fc706cc215',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AddVoiceModal.tsx:postCreateIx',message:'CreateV2 instruction details',data:{programId:createIx.programId?.toBase58(),numKeys:createIx.keys?.length,signers:createIx.keys?.filter((k:any)=>k.isSigner).map((k:any)=>({pubkey:k.pubkey.toBase58(),isWritable:k.isWritable})),dataLength:createIx.data?.length},timestamp:Date.now(),hypothesisId:'H4_H5',runId:'run1'})}).catch(()=>{});
      // #endregion
      
      const createTx = new Transaction().add(createIx);

      // Sign and send the create transaction first
      let latestBlockhash = await connection.getLatestBlockhash("confirmed");
      createTx.recentBlockhash = latestBlockhash.blockhash;
      createTx.feePayer = publicKey;
      createTx.partialSign(mint);

      const serializedCreateTx = createTx.serialize({ requireAllSignatures: false });

      // #region agent log — transaction before signing
      fetch('http://127.0.0.1:7242/ingest/be185e9e-d26d-4cab-80be-f1fc706cc215',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AddVoiceModal.tsx:preSend',message:'Transaction before signAndSend',data:{serializedLength:serializedCreateTx.length,feePayer:createTx.feePayer?.toBase58(),recentBlockhash:createTx.recentBlockhash?.slice(0,16)+'...'},timestamp:Date.now(),hypothesisId:'tx',runId:'post-fix'})}).catch(()=>{});
      // #endregion

      const { signature: rawSignature } = await signAndSendTransaction({
        transaction: serializedCreateTx,
        wallet: solanaWallet as any,
      });

      const txSignature = typeof rawSignature === 'string'
        ? rawSignature
        : bs58.encode(rawSignature instanceof Uint8Array ? rawSignature : Buffer.from((rawSignature as any).data || rawSignature));

      // #region agent log — post send
      fetch('http://127.0.0.1:7242/ingest/be185e9e-d26d-4cab-80be-f1fc706cc215',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AddVoiceModal.tsx:postSend',message:'signAndSendTransaction returned',data:{txSignature,rawType:typeof rawSignature,isBuffer:Buffer.isBuffer(rawSignature)},timestamp:Date.now(),hypothesisId:'tx',runId:'post-fix'})}).catch(()=>{});
      // #endregion

      console.log("Transaction sent, confirming...", txSignature);

      const confirmation = await connection.confirmTransaction(
        { signature: txSignature, blockhash: latestBlockhash.blockhash, lastValidBlockHeight: latestBlockhash.lastValidBlockHeight },
        "confirmed"
      );

      if (confirmation.value.err) {
        // #region agent log — confirmation failed
        fetch('http://127.0.0.1:7242/ingest/be185e9e-d26d-4cab-80be-f1fc706cc215',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AddVoiceModal.tsx:confirmFail',message:'Transaction failed on-chain',data:{err:JSON.stringify(confirmation.value.err),txSignature},timestamp:Date.now(),hypothesisId:'tx',runId:'post-fix'})}).catch(()=>{});
        // #endregion
        throw new Error(
          `Token creation transaction failed on-chain. Check the transaction on Solscan: https://solscan.io/tx/${txSignature}`
        );
      }

      console.log("Token created! Signature:", txSignature);

      // Now handle fee sharing in a separate transaction
      const splitWalletAddress = process.env.NEXT_PUBLIC_SPLIT_WALLET;
      if (splitWalletAddress && creatorSplit < 100) {
        try {
          const splitWallet = new PublicKey(splitWalletAddress);
          const creatorBps = Math.floor(creatorSplit * 100);
          const splitBps = 10000 - creatorBps;
          
          if (splitBps > 0) {
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
                { address: splitWallet, shareBps: splitBps }
              ],
            });
            feeSharingTx.add(createFeeSharingIx, updateFeeSharesIx);

            latestBlockhash = await connection.getLatestBlockhash("confirmed");
            feeSharingTx.recentBlockhash = latestBlockhash.blockhash;
            feeSharingTx.feePayer = publicKey;

            console.log("Requesting signature for fee sharing setup...");
            const serializedFeeTx = feeSharingTx.serialize({ requireAllSignatures: false });
            const { signature: feeSignature } = await signAndSendTransaction({
              transaction: serializedFeeTx,
              wallet: solanaWallet as any,
            });
            console.log("Fee sharing configured! Signature:", feeSignature);
          }
        } catch (e) {
          console.error("Error setting up fee sharing", e);
          // Token is already created, so just warn — don't block
          alert("Token created but fee sharing setup failed. You can configure it later.");
        }
      }


      // 2. Call Gradio API First
      console.log("Calling Gradio API...");
      const result = await downloadAndProcessVoiceModel(modelUrl, modelId);
      console.log("Gradio API result:", (result as any).data);

      const docId = await addTtsVoiceModel(modelId, {
        id: modelId,
        model_url: modelUrl,
        model_name: modelName,
        token_name: tokenName,
        symbol,
        creator_split: Number(creatorSplit),
        split: 100 - Number(creatorSplit),
        creator_wallet: solanaWallet.address,
        split_wallet: process.env.NEXT_PUBLIC_SPLIT_WALLET || "",
        deployed: true,
        token_address: mint.publicKey.toBase58(),
        image_url: finalImageUrl || undefined,
      });

      // Open the pump.fun token page in a new tab
      window.open(`https://pump.fun/coin/${mint.publicKey.toBase58()}`, "_blank");

      onClose();
      setModelUrl("");
      setModelName("");
      setTokenName("");
      setSymbol("");
      setImageFile(null);
      setCreatorSplit(50);
    } catch (err) {
      // #region agent log — error catch
      fetch('http://127.0.0.1:7242/ingest/be185e9e-d26d-4cab-80be-f1fc706cc215',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AddVoiceModal.tsx:catch',message:'Error caught in handleSubmit',data:{isError:err instanceof Error,name:(err as any)?.name,message:(err as any)?.message?.slice(0,500),code:(err as any)?.code,type:typeof err,stringified:String(err).slice(0,500),stack:(err as any)?.stack?.slice(0,300)},timestamp:Date.now(),hypothesisId:'all',runId:'run1'})}).catch(()=>{});
      // #endregion
      console.error(err);
      const errMsg = err instanceof Error
        ? err.message
        : (typeof err === 'object' && err !== null && 'message' in err)
          ? (err as any).message
          : String(err);
      alert(errMsg);
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
