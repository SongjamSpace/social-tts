"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { flushSync } from "react-dom";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
import {
  subscribeToTtsVoiceModels,
  addTtsVoiceModel,
  TtsVoiceModel,
} from "@/services/db/voiceModels.db";
import {
  subscribeToTtsResults,
  incrementPlayCount,
  incrementLikeCount,
  TtsResult,
  createTtsResultDoc,
  uploadTtsAudio,
  updateTtsResultAudioUrl,
} from "@/services/db/ttsResults.db";
import { Mic, Play, Heart, Headphones, Zap, Send, X } from "lucide-react";
import { generateTts, TtsStatus } from "@/lib/rvcHf";
import { auth } from "@/services/firebase.service";
import { TwitterAuthProvider, signInWithPopup } from "firebase/auth";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { PumpSdk } from "@pump-fun/pump-sdk";
import { Connection, Keypair, Transaction, PublicKey } from "@solana/web3.js";

// ─── Card type derived from Firestore ─────────────────────────────────────────
type CardSize = "xs" | "sm" | "md" | "lg" | "xl";

interface LiveCard {
  id: string;        // Firestore doc ID
  text: string;
  size: CardSize;
  plays: number;
  likes: number;
  accent: "red" | "purple" | "cyan" | "amber" | "pink";
  audio_url?: string | null;
  status: TtsResult["status"];
  username?: string | null;
}

// ─── Deterministic accent from doc ID ─────────────────────────────────────────
const ACCENTS: LiveCard["accent"][] = ["red", "purple", "cyan", "amber", "pink"];
function accentForId(id: string): LiveCard["accent"] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}

// ─── TtsResult → LiveCard adapter ─────────────────────────────────────────────
function toCard(r: TtsResult): LiveCard {
  const len = r.text.length;
  const size: CardSize =
    len < 20  ? "xs" :
    len < 50  ? "sm" :
    len < 100 ? "md" :
    len < 180 ? "lg" : "xl";
  return {
    id: r.id,
    text: r.text,
    size,
    plays: r.play_count,
    likes: r.like_count,
    accent: accentForId(r.id),
    audio_url: r.audio_url ?? null,
    status: r.status,
    username: r.created_by?.username ?? null,
  };
}

// ─── Map card size to Tailwind height + font classes ──────────────────────────
const SIZE_CONFIG: Record<CardSize, { h: string; font: string; radius: string }> = {
  xs: { h: "h-24",  font: "text-sm",   radius: "rounded-xl"  },
  sm: { h: "h-32",  font: "text-sm",   radius: "rounded-2xl" },
  md: { h: "h-44",  font: "text-base", radius: "rounded-2xl" },
  lg: { h: "h-56",  font: "text-lg",   radius: "rounded-3xl" },
  xl: { h: "h-72",  font: "text-xl",   radius: "rounded-3xl" },
};

const ACCENT_CONFIG: Record<LiveCard["accent"], { border: string; bg: string; text: string; glow: string; pill: string }> = {
  red:    { border: "border-red-500/20",    bg: "from-red-500/5 via-transparent to-transparent",     text: "text-red-400",    glow: "shadow-red-500/10",    pill: "bg-red-500/10 text-red-400 border-red-500/20"    },
  purple: { border: "border-purple-500/20", bg: "from-purple-500/5 via-transparent to-transparent",  text: "text-purple-400", glow: "shadow-purple-500/10", pill: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  cyan:   { border: "border-cyan-500/20",   bg: "from-cyan-500/5 via-transparent to-transparent",    text: "text-cyan-400",   glow: "shadow-cyan-500/10",   pill: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"   },
  amber:  { border: "border-amber-500/20",  bg: "from-amber-500/5 via-transparent to-transparent",   text: "text-amber-400",  glow: "shadow-amber-500/10",  pill: "bg-amber-500/10 text-amber-400 border-amber-500/20"  },
  pink:   { border: "border-pink-500/20",   bg: "from-pink-500/5 via-transparent to-transparent",    text: "text-pink-400",   glow: "shadow-pink-500/10",   pill: "bg-pink-500/10 text-pink-400 border-pink-500/20"   },
};

// ─── Floating orb cursor follower ─────────────────────────────────────────────
function CursorOrb() {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 55, damping: 20 });
  const sy = useSpring(y, { stiffness: 55, damping: 20 });
  useEffect(() => {
    const move = (e: MouseEvent) => { x.set(e.clientX - 150); y.set(e.clientY - 150); };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, [x, y]);
  return (
    <motion.div
      className="pointer-events-none fixed z-0 w-72 h-72 rounded-full"
      style={{ x: sx, y: sy, background: "radial-gradient(circle, rgba(239,68,68,0.5) 0%, rgba(168,85,247,0.3) 50%, transparent 70%)", filter: "blur(50px)", opacity: 0.07 }}
    />
  );
}

// ─── Scanline grid ─────────────────────────────────────────────────────────────
function GridBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: "linear-gradient(rgba(239,68,68,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(239,68,68,0.8) 1px, transparent 1px)", backgroundSize: "56px 56px" }} />
      <motion.div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/40 to-transparent" animate={{ y: ["-10vh", "110vh"] }} transition={{ duration: 9, repeat: Infinity, ease: "linear" }} />
      <motion.div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-400/25 to-transparent" animate={{ y: ["-10vh", "110vh"] }} transition={{ duration: 14, repeat: Infinity, ease: "linear", delay: 4 }} />
      <motion.div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/15 to-transparent" animate={{ y: ["-10vh", "110vh"] }} transition={{ duration: 11, repeat: Infinity, ease: "linear", delay: 7 }} />
    </div>
  );
}

// ─── Voice model sidebar card ──────────────────────────────────────────────────
export interface AppModel {
  slug: string;
  name: string;
  avatar?: string | null;
  tag?: string;
  plays?: number;
}

const STATIC_MODELS: AppModel[] = [
  { slug: "mr-krabs", name: "Mr. Krabs", avatar: "https://firebasestorage.googleapis.com/v0/b/lustrous-stack-453106-f6.firebasestorage.app/o/agents%2Fkrabs.png?alt=media", tag: "spongebob • character", plays: 42000 },
];

function ModelSidebarCard({ model, isSelected, onClick }: { model: AppModel; isSelected: boolean; onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02, x: 2 }}
      whileTap={{ scale: 0.97 }}
      className={`relative w-full text-left rounded-2xl p-3 transition-all border group ${isSelected ? "border-red-500/40 bg-red-500/8" : "border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]"}`}
    >
      {isSelected && <motion.div className="absolute inset-0 rounded-2xl" style={{ background: "radial-gradient(ellipse at 30% 50%, rgba(239,68,68,0.06), transparent 70%)" }} animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 3, repeat: Infinity }} />}
      <div className="relative flex items-center gap-3">
        <div className="relative shrink-0">
          <div className={`w-11 h-11 rounded-full overflow-hidden border-2 ${isSelected ? "border-red-500/50" : "border-white/10"}`}>
            {model.avatar ? (
              <img src={model.avatar} alt={model.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
                <Mic className={`w-4 h-4 ${isSelected ? "text-red-400" : "text-zinc-600"}`} />
              </div>
            )}
          </div>
          {isSelected && <motion.div className="absolute -inset-1.5 rounded-full border border-red-500/30" animate={{ opacity: [0.3, 0.8, 0.3] }} transition={{ duration: 2, repeat: Infinity }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-white truncate">{model.name}</p>
            {model.tag === "18+" && <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20 font-bold shrink-0">18+</span>}
          </div>
          <p className="text-[11px] text-zinc-600 mt-0.5">{model.tag}</p>
        </div>
        {isSelected && (
          <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
          </motion.div>
        )}
      </div>
    </motion.button>
  );
}

function AddVoiceModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { wallets } = useWallets();
  const [modelUrl, setModelUrl] = useState("");
  const [modelName, setModelName] = useState("");
  const [tokenName, setTokenName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [creatorSplit, setCreatorSplit] = useState<number>(50);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatorSplit < 0 || creatorSplit > 90) return;
    
    const solanaWallet = wallets.find((w: any) => w.chainType === "solana" || w.walletClientType === "privy") as any;
    if (!solanaWallet) {
      alert("Please connect a Solana wallet first!");
      return;
    }

    setLoading(true);
    try {
      // 1. Setup Solana Provider & PumpSdk
      const provider = await solanaWallet.getSolanaProvider();
      const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
      const publicKey = new PublicKey(solanaWallet.address);
      const sdk = new PumpSdk();

      // 2. Create Token Metadata (needs a dummy image for now)
      const emptyPng = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 10, 73, 68, 65, 84, 120, 156, 99, 96, 0, 0, 0, 2, 0, 1, 226, 38, 5, 155, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
      const imageBlob = new Blob([emptyPng], { type: "image/png" });
      
      console.log("Creating token metadata...");
      const formData = new FormData();
      formData.append("file", imageBlob, 'image.png');
      formData.append("name", tokenName);
      formData.append("symbol", symbol);
      formData.append("description", `Voice model for ${modelName}`);
      formData.append("showName", "true");

      const request = await fetch("https://pump.fun/api/ipfs", {
        method: "POST",
        body: formData,
      });
      const metadataResult = await request.json();

      // 3. Build & Send Create Transaction
      const mint = Keypair.generate();
      console.log("Deploying token...", mint.publicKey.toBase58());
      
      const createIx = await sdk.createInstruction({
        mint: mint.publicKey,
        name: tokenName,
        symbol: symbol,
        uri: metadataResult.metadataUri || metadataResult.uri || "",
        creator: publicKey,
        user: publicKey,
      });
      
      const createTx = new Transaction().add(createIx);
      
      const latestBlockhash = await connection.getLatestBlockhash("confirmed");
      createTx.recentBlockhash = latestBlockhash.blockhash;
      createTx.feePayer = publicKey;
      createTx.partialSign(mint);

      console.log("Requesting signature...");
      const signature = await provider.sendTransaction(createTx, connection);
      console.log("Deployed! Signature:", signature);

      // 4. Save to DB
      await addTtsVoiceModel({
        model_url: modelUrl,
        model_name: modelName,
        token_name: tokenName,
        symbol,
        creator_split: Number(creatorSplit),
        eve_split: 100 - Number(creatorSplit),
        creator_wallet: solanaWallet.address,
        eve_wallet: "EVE_SHARE_WALLET_ADDRESS_PLACEHOLDER", // To be replaced
      });
      onClose();
      setModelUrl("");
      setModelName("");
      setTokenName("");
      setSymbol("");
      setCreatorSplit(50);
    } catch (err) {
      console.error(err);
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
            <div className="flex justify-between items-end mb-2">
              <label className="block text-xs font-medium text-zinc-400">Creator Split Share</label>
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
              <p className="text-[10px] text-zinc-500">EVE Share: <span className="text-zinc-300 font-semibold">{100 - creatorSplit}%</span></p>
            </div>
          </div>
          <button disabled={loading} type="submit" className="w-full mt-2 py-3 bg-red-500/80 hover:bg-red-500 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50">
            {loading ? "Uploading..." : "Add Voice"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Playing waveform bars ─────────────────────────────────────────────────────
function WaveBars({ color = "bg-red-400" }: { color?: string }) {
  return (
    <div className="flex items-end gap-0.5 h-4">
      {[0.3, 0.7, 0.5, 1, 0.6, 0.9, 0.4].map((h, i) => (
        <motion.div
          key={i}
          className={`w-0.5 rounded-full ${color}`}
          animate={{ scaleY: [h, 1, h * 0.4, 0.9, h] }}
          transition={{ duration: 0.6 + i * 0.05, repeat: Infinity, ease: "easeInOut" }}
          style={{ height: "100%", transformOrigin: "bottom" }}
        />
      ))}
    </div>
  );
}

// ─── The star of the show: a single TTS card ──────────────────────────────────
function TtsCard({
  card,
  delay,
  isPlaying,
  onPlay,
  onLike,
}: {
  card: LiveCard;
  delay: number;
  isPlaying: boolean;
  onPlay: (id: string) => void;
  onLike: (id: string) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Play / pause the audio whenever the playing state changes
  useEffect(() => {
    if (!card.audio_url) return;
    if (isPlaying) {
      if (!audioRef.current) {
        audioRef.current = new Audio(card.audio_url);
        audioRef.current.onended = () => onPlay(card.id); // auto-toggle off
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } else {
      audioRef.current?.pause();
    }
  }, [isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  // If audio_url changes (e.g., updated from HF URL to Storage URL), reset ref
  useEffect(() => {
    audioRef.current = null;
  }, [card.audio_url]);

  const [liked, setLiked] = useState(false);
  const [localLikes, setLocalLikes] = useState(card.likes);
  const [localPlays, setLocalPlays] = useState(card.plays);
  const sz = SIZE_CONFIG[card.size];
  const ac = ACCENT_CONFIG[card.accent];

  // Keep local counts in sync with Firestore updates
  useEffect(() => { setLocalPlays(card.plays); }, [card.plays]);
  useEffect(() => { setLocalLikes(card.likes); }, [card.likes]);

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!liked) {
      setLiked(true);
      setLocalLikes((v) => v + 1);
      onLike(card.id);
    }
  };

  const isPending = card.status === "processing" || card.status === "pending";

  return (
    <motion.div
      initial={{ opacity: 0, y: 28, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.88, y: -10 }}
      transition={{ duration: 0.4, delay, type: "spring", stiffness: 280, damping: 22 }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      onClick={() => { if (!isPending && card.audio_url) onPlay(card.id); }}
      className={`
        relative cursor-pointer group overflow-hidden
        ${sz.h} ${sz.radius}
        border bg-white/[0.025]
        ${isPlaying ? `border-${card.accent}-500/60 shadow-lg ${ac.glow}` : `${ac.border} hover:border-white/10`}
        transition-all duration-300
      `}
    >
      {/* Ambient gradient overlay */}
      <div className={`absolute inset-0 bg-gradient-to-br ${ac.bg} opacity-60 group-hover:opacity-100 transition-opacity duration-500`} />

      {/* Processing shimmer */}
      {isPending && (
        <motion.div
          className="absolute inset-0"
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent)" }}
          animate={{ x: ["-100%", "100%"] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        />
      )}

      {/* Playing shimmer */}
      {isPlaying && (
        <motion.div
          className="absolute inset-0"
          style={{ background: `radial-gradient(ellipse at 20% 50%, ${card.accent === "red" ? "rgba(239,68,68,0.08)" : card.accent === "purple" ? "rgba(168,85,247,0.08)" : "rgba(6,182,212,0.08)"}, transparent 70%)` }}
          animate={{ opacity: [0.3, 0.9, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}

      {/* Bottom progress bar when playing */}
      {isPlaying && (
        <motion.div
          className={`absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-${card.accent}-400 to-transparent`}
          animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}

      <div className="relative h-full flex flex-col justify-between p-4">
        {/* Quote mark */}
        <div className="flex gap-2 items-start">
          <span className={`text-2xl leading-none font-serif ${ac.text} opacity-40 shrink-0 select-none`}>"</span>
          <p className={`${sz.font} text-white/85 leading-snug font-medium line-clamp-4`}
            style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}>
            {card.text}
          </p>
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-3">
            {/* Play */}
            <motion.button
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.85 }}
              onClick={(e) => { e.stopPropagation(); if (!isPending && card.audio_url) onPlay(card.id); }}
              className={`flex items-center gap-1.5 text-[11px] font-semibold transition-colors ${isPlaying ? ac.text : "text-zinc-600 group-hover:text-zinc-300"}`}
            >
              {isPlaying ? <WaveBars color={`bg-${card.accent}-400`} /> : <Play className="w-3 h-3" fill="currentColor" />}
              <span className="tabular-nums">{localPlays.toLocaleString()}</span>
            </motion.button>

            {/* Like */}
            <motion.button
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.85 }}
              onClick={handleLike}
              className={`flex items-center gap-1.5 text-[11px] font-semibold transition-colors ${liked ? "text-pink-400" : "text-zinc-600 group-hover:text-zinc-300"}`}
            >
              <motion.div animate={liked ? { scale: [1, 1.5, 1] } : {}} transition={{ duration: 0.3 }}>
                <Heart className="w-3 h-3" fill={liked ? "currentColor" : "none"} />
              </motion.div>
              <span className="tabular-nums">{localLikes}</span>
            </motion.button>
          </div>

          {/* Creator avatar */}
          {card.username &&
            <a
              href={`https://x.com/${card.username}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="hidden sm:block shrink-0"
            >
              <img
                src={`https://unavatar.io/twitter/${card.username}`}
                alt={card.username}
                className="w-5 h-5 rounded-full border border-white/10 object-cover opacity-70 hover:opacity-100 transition-opacity"
              />
            </a>
          }
        </div>
      </div>
    </motion.div>
  );
}

// ─── TTS Generate input ────────────────────────────────────────────────────────
function GenerateInput({ slug }: { slug: string }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<TtsStatus | null>(null);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setStatus(null);

    const capturedText = text.trim();
    setText(""); // Clear input immediately after capture
    const voiceModel = "mrkrabs";
    const ttsVoice = "en-US-ChristopherNeural";

    // Ensure the user is signed in with Twitter before generating
    let fbUser = auth.currentUser;
    if (!fbUser) {
      try {
        const result = await signInWithPopup(auth, new TwitterAuthProvider());
        fbUser = result.user;
      } catch (authErr: any) {
        // User cancelled the popup or auth failed
        setLoading(false);
        if (authErr?.code !== "auth/popup-closed-by-user") {
          setStatus({ stage: "error", message: "Sign-in failed. Please try again." });
          setTimeout(() => setStatus(null), 3000);
        }
        return;
      }
    }

    // Build the created_by payload from the signed-in user
    const createdBy = {
      uid: fbUser.uid,
      displayName: fbUser.displayName,
      photoURL: fbUser.photoURL,
      username: (fbUser as any)?.reloadUserInfo?.screenName ?? null,
    };

    try {
      await generateTts({
        text: capturedText,
        voiceModel,
        ttsVoice,
        onStatus: (s) => {
          console.log("TTS status:", s);
          flushSync(() => setStatus(s));

          if (s.stage === "done" && s.audioUrl) {
            setLoading(false);
            // In the background: create doc, upload audio to Firebase Storage, update the doc
            (async () => {
              try {
                const docId = await createTtsResultDoc({
                  text: capturedText,
                  voiceModel,
                  voiceModelSlug: "mr-krabs",
                  voiceModelName: "Mr. Krabs",
                  ttsVoice,
                  createdBy,
                });
                const permanentUrl = await uploadTtsAudio(s.audioUrl!, docId);
                await updateTtsResultAudioUrl(docId, permanentUrl);
                console.log("TTS audio uploaded to Storage:", permanentUrl);
              } catch (bgErr) {
                console.error("Background text/audio upload failed:", bgErr);
              }
            })();
          }
        },
      });
    } catch (err) {
      setLoading(false);
      console.error("TTS error:", err);
      setStatus({ stage: "error", message: "Something went wrong. Try again." });
      setTimeout(() => setStatus(null), 3000);
    }
  };

  return (
    <form onSubmit={handle}>
      <div className={`relative rounded-2xl border transition-all ${text ? "border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.08)]" : "border-white/8"} bg-white/[0.025]`}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 180))}
          placeholder="Say something as this voice…"
          rows={3}
          className="w-full bg-transparent px-4 pt-4 pb-12 text-sm text-white placeholder-zinc-600 resize-none outline-none"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handle(e as any); }}
        />
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          <span className="text-[10px] text-zinc-700">{text.length}/180</span>
          <motion.button
            type="submit"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            disabled={!text.trim() || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-red-500/80 hover:bg-red-500 disabled:bg-white/5 disabled:text-zinc-600 text-white transition-all"
          >
            {loading ? (
              <motion.div className="w-3 h-3 border border-white/30 border-t-white rounded-full" animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }} />
            ) : <Send className="w-3 h-3" />}
            Generate
          </motion.button>
        </div>
      </div>
      <p className="text-[10px] text-zinc-700 mt-1 ml-1">⌘↵ to generate</p>

      {/* Live status line */}
      <AnimatePresence>
        {status && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="mt-2 flex items-center gap-2"
          >
            {status.stage !== "done" && status.stage !== "error" && (
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            )}
            {status.stage === "done" && <span className="text-[10px]">✓</span>}
            {status.stage === "error" && <span className="text-[10px]">✗</span>}
            <span className={`text-[10px] ${
              status.stage === "error" ? "text-red-400" :
              status.stage === "done"  ? "text-green-400" :
              "text-zinc-500"
            }`}>
              {status.message}
              {status.queuePosition != null && status.stage === "queued" && (
                <span className="text-zinc-600"> · pos {status.queuePosition}</span>
              )}
              {status.eta != null && status.stage !== "done" && (
                <span className="text-zinc-600"> · ~{Math.ceil(status.eta)}s</span>
              )}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function AgentsSocialPage() {
  const [activeSlug, setActiveSlug] = useState("mr-krabs");
  const [cards, setCards] = useState<LiveCard[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const seededRef = useRef(false);

  const [ttsVoiceModels, setTtsVoiceModels] = useState<TtsVoiceModel[]>([]);
  const [isAddVoiceModalOpen, setIsAddVoiceModalOpen] = useState(false);
  const { authenticated, login } = usePrivy();

  // Track previous doc IDs that were already "done" for auto-play
  const prevDoneIdsRef = useRef<Set<string>>(new Set());
  // Whether this is the very first snapshot (skip auto-play on initial load)
  const isFirstSnapshotRef = useRef(true);

  // Subscribe to live Firestore tts_results for the active voice model
  useEffect(() => {
    setPlayingId(null);
    setCards([]);
    prevDoneIdsRef.current = new Set();
    isFirstSnapshotRef.current = true;

    const unsub = subscribeToTtsResults(activeSlug, (results) => {
      const newCards = results.map(toCard);

      if (!isFirstSnapshotRef.current) {
        // Find cards that just arrived OR newly transitioned to "done"
        const newlyDone = newCards.filter(
          (c) => !prevDoneIdsRef.current.has(c.id) && c.audio_url && c.status === "done"
        );
        if (newlyDone.length > 0) {
          // Auto-play the most-recently finished card
          const newest = newlyDone[0];
          setPlayingId(newest.id);
        }
      }

      // Track all docs currently done
      newCards.forEach(c => {
        if (c.status === "done") {
          prevDoneIdsRef.current.add(c.id);
        }
      });
      
      isFirstSnapshotRef.current = false;
      setCards(newCards);
    });

    return unsub;
  }, [activeSlug]);

  const handlePlay = useCallback((id: string) => {
    setPlayingId((prev) => {
      const isStarting = prev !== id;
      if (isStarting) {
        // Increment play count when starting playback (fire-and-forget)
        incrementPlayCount(id).catch((err) =>
          console.warn("Could not increment play count:", err)
        );
      }
      return isStarting ? id : null; // toggle off if same card
    });
  }, []);

  const handleLike = useCallback((id: string) => {
    incrementLikeCount(id).catch((err) =>
      console.warn("Could not increment like count:", err)
    );
  }, []);

  // Masonry: 3 columns
  const col0 = cards.filter((_, i) => i % 3 === 0);
  const col1 = cards.filter((_, i) => i % 3 === 1);
  const col2 = cards.filter((_, i) => i % 3 === 2);

  // Subscribe to live Firestore tts_voice_models
  useEffect(() => {
    return subscribeToTtsVoiceModels((models) => {
      setTtsVoiceModels(models);
    });
  }, []);

  const allModels: AppModel[] = [
    ...STATIC_MODELS,
    ...ttsVoiceModels.map((m) => ({
      slug: m.id!,
      name: m.model_name,
      avatar: null,
      tag: `$${m.symbol} • ${m.creator_split}% crt`,
      plays: 0,
    })),
  ];

  const activeModel = allModels.find((m) => m.slug === activeSlug) || allModels[0];

  return (
    <div className="relative min-h-screen bg-[#060608] text-white overflow-x-hidden">
      <GridBackground />
      <CursorOrb />
      <AddVoiceModal isOpen={isAddVoiceModalOpen} onClose={() => setIsAddVoiceModalOpen(false)} />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* ── Hero ──────────────────────────────────────────────────────────────── */}
        <div className="relative border-b border-white/5 overflow-hidden">
          {/* Blobs */}
          <div className="absolute -top-20 left-1/3 w-[500px] h-[500px] bg-red-500/8 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute -top-10 right-1/4 w-[400px] h-[400px] bg-purple-600/8 rounded-full blur-[90px] pointer-events-none" />

          <div className="max-w-6xl mx-auto px-4 py-10 sm:py-14 relative text-center">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
              {/* Live badge */}
              <motion.div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-widest mb-5"
                initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }}
              >
                <motion.span className="w-1.5 h-1.5 rounded-full bg-red-400" animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.4, repeat: Infinity }} />
                TTS Social
              </motion.div>

              <h1 className="text-5xl sm:text-7xl font-black tracking-tight mb-4 leading-none" style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}>
                <span className="text-white">Voice</span>{" "}
                <span className="relative inline-block">
                  <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(135deg, #ef4444 0%, #c026d3 40%, #6366f1 80%, #ef4444 100%)", backgroundSize: "200%", animation: "gradient-x 4s ease infinite" }}>
                    Unleashed
                  </span>
                </span>
              </h1>

              <p className="text-zinc-500 text-sm sm:text-base max-w-md mx-auto leading-relaxed">
                Social media for TTS &amp; uncensored voice models.{" "}
                <span className="text-zinc-400">Discover, play, and generate</span> voices that say the unsayable.
              </p>
            </motion.div>
          </div>
        </div>

        {/* ── Main ─────────────────────────────────────────────────────────────── */}
        <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
          <div className="flex gap-6 items-start">

            {/* ── Sidebar ──────────────────────────────────────────────────── */}
            <motion.aside
              initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}
              className="w-60 shrink-0 sticky top-24 space-y-6"
            >
              {/* Voice models */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Mic className="w-3.5 h-3.5 text-red-400" />
                  <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Voice Models</h2>
                </div>
                <div className="space-y-2">
                  {allModels.map((m, i) => (
                    <motion.div key={m.slug} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.07 }}>
                      <ModelSidebarCard model={m} isSelected={activeSlug === m.slug} onClick={() => setActiveSlug(m.slug)} />
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Add new voice */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
                  <motion.button
                    onClick={authenticated ? () => setIsAddVoiceModalOpen(true) : login}
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.97 }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-dashed border-white/10 text-xs font-semibold text-zinc-500 hover:text-zinc-300 hover:border-white/20 hover:bg-white/[0.03] transition-all"
                  >
                    <span className="text-base leading-none">+</span>
                    Create Voice Token
                  </motion.button>
              </motion.div>

              {/* Generate */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Generate</h2>
                  </div>
                </div>
                <GenerateInput slug={activeSlug} />
              </motion.div>
            </motion.aside>

            {/* ── Card Grid ────────────────────────────────────────────────── */}
            <div className="flex-1 min-w-0">
              {/* Header */}
              <motion.div
                key={activeSlug}
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className="mb-5 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  {activeModel.avatar ? (
                    <div className="w-9 h-9 rounded-full overflow-hidden border border-red-500/30 shrink-0">
                      <img src={activeModel.avatar} alt={activeModel.name} className="w-full h-full object-cover" />
                    </div>
                  ) : null}
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Headphones className="w-5 h-5 text-red-400" />
                      {activeModel.name}
                      <span className="text-zinc-600 font-normal text-sm">says…</span>
                    </h2>
                    <p className="text-[11px] text-zinc-600">{cards.length} clips</p>
                  </div>
                </div>

                <AnimatePresence>
                  {playingId && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20"
                    >
                      <WaveBars color="bg-red-400" />
                      <span className="text-xs text-red-400 font-bold">Playing</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Empty state */}
              {cards.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-24 text-center"
                >
                  <motion.div
                    className="w-16 h-16 rounded-full border border-white/5 bg-white/[0.02] flex items-center justify-center mb-4"
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Mic className="w-6 h-6 text-zinc-700" />
                  </motion.div>
                  <p className="text-zinc-600 text-sm">No clips yet. Generate the first one!</p>
                </motion.div>
              )}

              {/* 3-col masonry */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSlug}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-start"
                >
                  {[col0, col1, col2].map((col, ci) => (
                    <div key={ci} className="flex flex-col gap-3">
                      {col.map((card, ri) => (
                        <TtsCard
                          key={card.id}
                          card={card}
                          delay={ri * 0.06 + ci * 0.02}
                          isPlaying={playingId === card.id}
                          onPlay={handlePlay}
                          onLike={handleLike}
                        />
                      ))}
                    </div>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </main>

        <footer className="mt-auto py-6 border-t border-white/5">
          <div className="max-w-6xl mx-auto px-4 text-center text-xs text-zinc-800">
            © {new Date().getFullYear()} Moltspaces · TTS Social — voices that say the unsayable
          </div>
        </footer>
      </div>
    </div>
  );
}
