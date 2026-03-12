import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/services/firebase-admin.service";
import { Connection, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

const OPENCLAW_LAUNCHES = "openclaw_launches";
const HATCH_INTENTS = "hatch_intents";
const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
const LAMPORTS_PER_SOL = 1e9;

/** Decode instruction data to UTF-8 memo text (handles base58 string or Uint8Array from RPC). */
function decodeMemoData(data: unknown): string | null {
  if (!data) return null;
  try {
    if (typeof data === "string") {
      const bytes = bs58.decode(data);
      return new TextDecoder().decode(bytes);
    }
    if (data instanceof Uint8Array || Buffer.isBuffer(data)) {
      return new TextDecoder().decode(data);
    }
    if (Array.isArray(data)) {
      return new TextDecoder().decode(new Uint8Array(data));
    }
  } catch {
    /* ignore */
  }
  return null;
}

function getTreasury(): string | null {
  return process.env.OPENCLAW_HATCH_TREASURY_WALLET?.trim() || null;
}

function getPriceSol(): number {
  const v = process.env.OPENCLAW_HATCH_PRICE_SOL;
  if (v == null || v === "") return 0.5;
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : 0.5;
}

/**
 * POST /api/openclaw/hatch-intent
 * Body: { mint: string, wallet: string }
 * Creates a hatch intent (pending). Returns treasury address, amount, memo for the user to pay.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mint = typeof body?.mint === "string" ? body.mint.trim() : "";
    const wallet = typeof body?.wallet === "string" ? body.wallet.trim() : "";

    if (!mint || !wallet) {
      return NextResponse.json(
        { error: "mint and wallet are required" },
        { status: 400 }
      );
    }

    const treasury = getTreasury();
    if (!treasury) {
      return NextResponse.json(
        { error: "Hatch treasury not configured" },
        { status: 503 }
      );
    }

    const db = getAdminFirestore();
    const launchRef = db.collection(OPENCLAW_LAUNCHES).doc(mint);
    const launchSnap = await launchRef.get();
    if (!launchSnap.exists) {
      return NextResponse.json(
        { error: "Mint not found in OpenClaw launches" },
        { status: 404 }
      );
    }
    const launch = launchSnap.data();
    if (launch?.creator !== wallet) {
      return NextResponse.json(
        { error: "Wallet does not own this launch" },
        { status: 403 }
      );
    }
    if (launch?.agentUrl) {
      return NextResponse.json(
        { error: "Agent already hatched" },
        { status: 400 }
      );
    }

    const existing = await db.collection(HATCH_INTENTS).doc(mint).get();
    if (existing.exists && existing.data()?.status === "paid") {
      return NextResponse.json(
        { error: "Intent already paid" },
        { status: 400 }
      );
    }

    const amountSol = getPriceSol();
    await db.collection(HATCH_INTENTS).doc(mint).set({
      mint,
      wallet,
      treasury,
      amountSol,
      memo: mint,
      status: "pending",
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      treasuryAddress: treasury,
      amountSol,
      memo: mint,
    });
  } catch (e) {
    console.error("[openclaw/hatch-intent POST]", e);
    return NextResponse.json(
      { error: "Failed to create hatch intent" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/openclaw/hatch-intent?mint=...&check=1
 * Returns intent status. If check=1 and status is pending, verifies payment on-chain and may update to paid.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mint = searchParams.get("mint")?.trim();
    const check = searchParams.get("check") === "1";

    if (!mint) {
      return NextResponse.json(
        { error: "mint query is required" },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const intentSnap = await db.collection(HATCH_INTENTS).doc(mint).get();
    if (!intentSnap.exists) {
      return NextResponse.json({
        success: true,
        status: "pending",
        intentNotFound: true,
        treasuryAddress: null,
        amountSol: null,
        memo: null,
      });
    }

    const intent = intentSnap.data()!;
    let status = intent.status ?? "pending";

    if (check && status === "pending") {
      const treasury = intent.treasury as string;
      const amountSol = Number(intent.amountSol) || 0.5;
      const memo = (intent.memo as string) || mint;
      const rpc = process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com";
      const connection = new Connection(rpc, "confirmed");
      const treasuryPubkey = new PublicKey(treasury);
      const sigs = await connection.getSignaturesForAddress(treasuryPubkey, { limit: 20 });
      const requiredLamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

      for (const s of sigs) {
        if (s.err) continue;
        try {
          const tx = await connection.getTransaction(s.signature, {
            maxSupportedTransactionVersion: 1,
            commitment: "confirmed",
          });
          if (!tx?.meta || !tx.transaction) continue;
          const message = tx.transaction.message;
          const accountKeys = "accountKeys" in message
            ? message.accountKeys.map((k: { toBase58?: () => string }) => (k as PublicKey).toBase58?.() ?? String(k))
            : (message as { staticAccountKeys?: { toBase58?: () => string }[] }).staticAccountKeys?.map((k) => k.toBase58?.() ?? "") ?? [];
          const treasuryIndex = accountKeys.indexOf(treasury);
          if (treasuryIndex < 0) continue;
          const pre = tx.meta.preBalances[treasuryIndex];
          const post = tx.meta.postBalances[treasuryIndex];
          const received = post - pre;
          if (received < requiredLamports) continue;
          const instructions = "instructions" in message ? message.instructions : [];
          let memoText: string | null = null;
          for (const ix of instructions) {
            const programIdIndex = "programIdIndex" in ix ? ix.programIdIndex : (ix as { programIdIndex: number }).programIdIndex;
            const programId = accountKeys[programIdIndex];
            if (programId !== MEMO_PROGRAM_ID) continue;
            const data = "data" in ix ? (ix as { data: unknown }).data : undefined;
            memoText = decodeMemoData(data);
            if (memoText) break;
          }
          if (!memoText && tx.meta?.innerInstructions) {
            for (const inner of tx.meta.innerInstructions) {
            const innerIxs = "instructions" in inner ? inner.instructions : [];
            for (const ix of innerIxs) {
              const programIdIndex = "programIdIndex" in ix ? ix.programIdIndex : (ix as { programIdIndex: number }).programIdIndex;
              const programId = accountKeys[programIdIndex];
              if (programId !== MEMO_PROGRAM_ID) continue;
              const data = "data" in ix ? (ix as { data: unknown }).data : undefined;
              memoText = decodeMemoData(data);
              if (memoText) break;
            }
            if (memoText) break;
            }
          }
          if (memoText && memoText.trim() === memo) {
            await db.collection(HATCH_INTENTS).doc(mint).update({ status: "paid", paidAt: new Date() });
            status = "paid";
            break;
          }
        } catch {
          continue;
        }
      }
    }

    return NextResponse.json({
      success: true,
      status,
      treasuryAddress: intent.treasury ?? null,
      amountSol: intent.amountSol ?? null,
      memo: intent.memo ?? null,
    });
  } catch (e) {
    console.error("[openclaw/hatch-intent GET]", e);
    return NextResponse.json(
      { error: "Failed to fetch intent" },
      { status: 500 }
    );
  }
}
