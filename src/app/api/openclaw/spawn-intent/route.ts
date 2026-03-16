import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/services/firebase-admin.service";
import { Connection, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

const OPENCLAW_LAUNCHES = "openclaw_launches";
const SPAWN_INTENTS = "spawn_intents";
const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
const LAMPORTS_PER_SOL = 1e9;

/** Spawn price in SOL by size (from OPENCLAW_SPAWN_PRICE_2GB_SOL / OPENCLAW_SPAWN_PRICE_4GB_SOL; defaults 0.5, 1). */
function getAmountSolBySize(size: "2gb" | "4gb"): number {
  const v2 = process.env.OPENCLAW_SPAWN_PRICE_2GB_SOL;
  const v4 = process.env.OPENCLAW_SPAWN_PRICE_4GB_SOL;
  const n2 = v2 != null && v2 !== "" ? parseFloat(v2) : NaN;
  const n4 = v4 != null && v4 !== "" ? parseFloat(v4) : NaN;
  const sol2 = Number.isFinite(n2) && n2 >= 0 ? n2 : 0.5;
  const sol4 = Number.isFinite(n4) && n4 >= 0 ? n4 : 1;
  return size === "4gb" ? sol4 : sol2;
}

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
  return process.env.OPENCLAW_SPAWN_TREASURY_WALLET?.trim() || null;
}

/**
 * POST /api/openclaw/spawn-intent
 * Body: { mint: string, wallet: string, size: "2gb" | "4gb" }
 * Creates a spawn intent (pending). Returns treasury address, amount (by size), memo for the user to pay.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mint = typeof body?.mint === "string" ? body.mint.trim() : "";
    const wallet = typeof body?.wallet === "string" ? body.wallet.trim() : "";
    const size = body?.size === "4gb" ? "4gb" : "2gb";

    if (!mint || !wallet) {
      return NextResponse.json(
        { error: "mint and wallet are required" },
        { status: 400 }
      );
    }

    const treasury = getTreasury();
    if (!treasury) {
      return NextResponse.json(
        { error: "Spawn treasury not configured" },
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

    const amountSol = getAmountSolBySize(size);
    const skipPayment = process.env.OPENCLAW_SKIP_SPAWN_PAYMENT === "true" || process.env.OPENCLAW_SKIP_SPAWN_PAYMENT === "1";
    await db.collection(SPAWN_INTENTS).doc(mint).set({
      mint,
      wallet,
      size,
      treasury,
      amountSol,
      memo: mint,
      status: skipPayment ? "paid" : "pending",
      ...(skipPayment ? { paidAt: new Date() } : {}),
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      treasuryAddress: treasury,
      amountSol,
      memo: mint,
      size,
    });
  } catch (e) {
    console.error("[openclaw/spawn-intent POST]", e);
    return NextResponse.json(
      { error: "Failed to create spawn intent" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/openclaw/spawn-intent?mint=...&check=1
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
    const intentSnap = await db.collection(SPAWN_INTENTS).doc(mint).get();
    if (!intentSnap.exists) {
      return NextResponse.json({
        success: true,
        status: "pending",
        intentNotFound: true,
        treasuryAddress: null,
        amountSol: null,
        memo: null,
        size: null,
      });
    }

    const intent = intentSnap.data()!;
    let status = intent.status ?? "pending";
    const size = intent.size === "4gb" ? "4gb" : "2gb";

    if (check && status === "pending") {
      const treasury = intent.treasury as string;
      const amountSol = Number(intent.amountSol) ?? getAmountSolBySize(size);
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
            await db.collection(SPAWN_INTENTS).doc(mint).update({ status: "paid", paidAt: new Date() });
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
      size,
    });
  } catch (e) {
    console.error("[openclaw/spawn-intent GET]", e);
    return NextResponse.json(
      { error: "Failed to fetch spawn intent" },
      { status: 500 }
    );
  }
}
