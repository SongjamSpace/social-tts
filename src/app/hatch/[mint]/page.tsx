"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useWallets, useSignAndSendTransaction } from "@privy-io/react-auth/solana";
import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram } from "@solana/web3.js";

const LAMPORTS_PER_SOL = 1e9;
const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export default function HatchPaymentPage({
  params,
}: {
  params: Promise<{ mint: string }>;
}) {
  const router = useRouter();
  const { wallets } = useWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const [mint, setMint] = useState<string | null>(null);
  const [intent, setIntent] = useState<{
    status: string;
    treasuryAddress: string | null;
    amountSol: number | null;
    memo: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const wallet = wallets?.[0];
  const walletAddress = wallet?.address;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { mint: m } = await params;
      setMint(decodeURIComponent(m));
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);

  useEffect(() => {
    if (!mint) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/openclaw/hatch-intent?mint=${encodeURIComponent(mint)}`
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setIntent(null);
          setLoading(false);
          return;
        }
        if (data.status === "paid") {
          router.replace(`/hatch/${encodeURIComponent(mint)}/onboarding`);
          return;
        }
        if (data.intentNotFound || data.treasuryAddress == null) {
          setIntent(null);
          setLoading(false);
          return;
        }
        setIntent({
          status: data.status ?? "pending",
          treasuryAddress: data.treasuryAddress ?? null,
          amountSol: data.amountSol ?? null,
          memo: data.memo ?? null,
        });
      } catch (e) {
        if (!cancelled) setIntent(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mint, router]);

  const createIntent = async () => {
    if (!mint || !walletAddress) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/openclaw/hatch-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mint, wallet: walletAddress }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Failed to create intent");
        return;
      }
      setIntent({
        status: "pending",
        treasuryAddress: data.treasuryAddress,
        amountSol: data.amountSol,
        memo: data.memo,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create intent");
    } finally {
      setCreating(false);
    }
  };

  const sendPayment = async () => {
    if (!mint || !walletAddress) {
      setError("Wallet not connected.");
      return;
    }
    if (!intent?.treasuryAddress || intent.amountSol == null) {
      setError("Payment details missing. Click “Prepare payment” first.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const connection = new Connection(
        process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com",
        "confirmed"
      );
      const lamports = Math.floor(intent.amountSol * LAMPORTS_PER_SOL);
      const tx = new Transaction();
      tx.add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(walletAddress!),
          toPubkey: new PublicKey(intent.treasuryAddress),
          lamports,
        }),
        new TransactionInstruction({
          keys: [],
          programId: MEMO_PROGRAM_ID,
          data: Buffer.from(mint, "utf8"),
        })
      );
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.feePayer = new PublicKey(walletAddress!);
      const serialized = tx.serialize({ requireAllSignatures: false });
      await signAndSendTransaction({
        transaction: serialized,
        wallet: wallet as any,
      });
      setPolling(true);
      const maxAttempts = 30;
      let stoppedEarly = false;
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const checkRes = await fetch(
          `/api/openclaw/hatch-intent?mint=${encodeURIComponent(mint)}&check=1`
        );
        const checkData = await checkRes.json();
        if (checkData.intentNotFound) {
          setError("Session expired. Please go back and click “Prepare payment” again.");
          stoppedEarly = true;
          break;
        }
        if (checkData.status === "paid") {
          router.replace(`/hatch/${encodeURIComponent(mint)}/onboarding`);
          return;
        }
      }
      if (!stoppedEarly) setError("Payment not detected yet. Check your wallet and try refreshing.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setSending(false);
      setPolling(false);
    }
  };

  if (loading || !mint) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center bg-[#060608] text-white px-4">
        <p className="text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (!walletAddress) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center bg-[#060608] text-white px-4">
        <p className="text-zinc-400 text-sm mb-4">Connect your wallet to hatch this agent.</p>
        <Link
          href="/profile"
          className="rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold py-2.5 px-4 text-sm"
        >
          Back to profile
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#060608] text-white px-4 py-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-xl font-bold text-white mb-2">Hatch your agent</h1>
        <p className="text-zinc-500 text-sm mb-6">
          Pay SOL to hatch this OpenClaw agent on a hosted VPS. After payment you’ll confirm memories and deploy.
        </p>
        {error && (
          <p className="text-red-400 text-sm mb-4">{error}</p>
        )}
        {!intent ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
            <p className="text-zinc-400 text-sm">
              Create a hatch intent to get the payment address and amount.
            </p>
            <button
              type="button"
              onClick={createIntent}
              disabled={creating}
              className="w-full rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold py-3 px-4 text-sm"
            >
              {creating ? "Creating…" : "Prepare payment"}
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
            <p className="text-zinc-400 text-sm">
              Send <strong className="text-white">{intent.amountSol} SOL</strong> to the treasury with the mint as memo.
            </p>
            {intent.treasuryAddress && (
              <p className="text-[10px] font-mono text-zinc-500 break-all">
                Treasury: {intent.treasuryAddress}
              </p>
            )}
            <p className="text-[10px] text-zinc-500">
              Memo (include in transaction): <span className="font-mono text-zinc-400">{intent.memo ?? mint}</span>
            </p>
            <button
              type="button"
              onClick={sendPayment}
              disabled={sending || polling}
              className="w-full rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold py-3 px-4 text-sm"
            >
              {polling ? "Confirming payment…" : sending ? "Sending…" : "Send SOL and hatch"}
            </button>
            <p className="text-[10px] text-zinc-500">
              This will send {intent.amountSol} SOL with a memo. After you approve, we’ll detect the payment and take you to onboarding.
            </p>
          </div>
        )}
        <Link
          href="/profile"
          className="mt-6 inline-block text-zinc-500 hover:text-zinc-400 text-sm"
        >
          Back to profile
        </Link>
      </div>
    </div>
  );
}
