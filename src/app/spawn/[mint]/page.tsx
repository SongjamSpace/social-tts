"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useWallets, useSignAndSendTransaction } from "@privy-io/react-auth/solana";
import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram } from "@solana/web3.js";

const LAMPORTS_PER_SOL = 1e9;
const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

/** SOL amount by size (plan: 2gb → 0.005, 4gb → 0.01). */
const AMOUNT_BY_SIZE = { "2gb": 0.005, "4gb": 0.01 } as const;

/** Agent Connect connection bundle (client-side only; contains private key – treat as secret). */
export interface OpenClawConnectionBundle {
  version: 1;
  host: string;
  port: number;
  user: string;
  privateKeyPem: string;
  mint?: string;
  label?: string;
}

/** URL to download Agent Connect desktop app (Mac .dmg). Update when app is hosted. */
const AGENT_CONNECT_DOWNLOAD_URL = "/agent-connect/releases/latest";

interface SeedPayload {
  name?: string;
  ticker?: string;
  description?: string;
  tone?: string;
}

function buildSoulMarkdown(seed: SeedPayload): string {
  const name = (seed.name ?? "Agent").trim().slice(0, 120);
  const theme = [seed.tone, seed.description].filter(Boolean).join(" ").trim().slice(0, 300) || "helpful assistant";
  const desc = (seed.description ?? "").trim().slice(0, 2000);
  const lines = ["# Agent identity", `- **Name:** ${name}`, `- **Tone / personality:** ${theme}`];
  if (desc) lines.push(`- **Purpose:** ${desc}`);
  return lines.join("\n");
}

/** Encode Uint8Array to base64 (browser-safe). */
function uint8ToBase64(u8: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i]);
  return btoa(binary);
}

/** Extract 32-byte Ed25519 seed from PKCS#8 (OCTET STRING ends with 04 20 + 32 bytes). */
function ed25519SeedFromPkcs8(pkcs8: Uint8Array): Uint8Array {
  if (pkcs8.length < 32) throw new Error("PKCS#8 too short");
  return pkcs8.slice(-32);
}

/**
 * Build OpenSSH private key blob (openssh-key-v1, unencrypted) for Ed25519.
 * Format: AUTH_MAGIC, cipher "none", kdf "none", kdfoptions "", nkeys 1,
 * public key section, encrypted section (checkint x2, "ssh-ed25519", pub 32, secret 64, comment "", padding to 8).
 */
function buildOpenSSHPrivateKeyBlob(rawPub: Uint8Array, privateSeed: Uint8Array): Uint8Array {
  const magic = new TextEncoder().encode("openssh-key-v1\0");
  const keyType = new TextEncoder().encode("ssh-ed25519");
  const writeU32 = (dv: DataView, o: number, v: number) => dv.setUint32(o, v, false);
  const writeString = (buf: Uint8Array, offset: number, s: Uint8Array) => {
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    writeU32(dv, offset, s.length);
    buf.set(s, offset + 4);
    return offset + 4 + s.length;
  };

  // Public key section: string "ssh-ed25519" + string (uint32 32 + 32 bytes)
  const pubSectionSize = 4 + keyType.length + 4 + 32;
  const pubSection = new Uint8Array(pubSectionSize);
  let o = 0;
  const dvPub = new DataView(pubSection.buffer);
  writeU32(dvPub, 0, keyType.length);
  pubSection.set(keyType, 4);
  o = 4 + keyType.length;
  writeU32(dvPub, o, 32);
  pubSection.set(rawPub, o + 4);
  o += 4 + 32;

  // Encrypted section: checkint x2, string "ssh-ed25519", string pub32, string secret64, string comment, padding
  const checkint = (Math.random() * 0xffffffff) >>> 0;
  const secret64 = new Uint8Array(64);
  secret64.set(privateSeed, 0);
  secret64.set(rawPub, 32);
  const encPart1 = 4 + 4 + 4 + keyType.length + 4 + 32 + 4 + 64; // checkint*2 + keytype + pub + secret
  const comment = new Uint8Array(0);
  const encPart2 = 4 + comment.length; // comment string
  let encSize = encPart1 + encPart2;
  const blockSize = 8;
  const padLen = (blockSize - (encSize % blockSize)) % blockSize;
  if (padLen) encSize += padLen;
  const encSection = new Uint8Array(encSize);
  const dvEnc = new DataView(encSection.buffer);
  let e = 0;
  writeU32(dvEnc, e, checkint);
  e += 4;
  writeU32(dvEnc, e, checkint);
  e += 4;
  e = writeString(encSection, e, keyType);
  writeU32(dvEnc, e, 32);
  encSection.set(rawPub, e + 4);
  e += 4 + 32;
  writeU32(dvEnc, e, 64);
  encSection.set(secret64, e + 4);
  e += 4 + 64;
  writeU32(dvEnc, e, 0);
  e += 4;
  for (let i = 1; i <= padLen; i++) encSection[e + i - 1] = i & 0xff;

  // Assemble: magic + string "none" + string "none" + string "" + uint32 1 + string pubSection + string encSection
  const none = new TextEncoder().encode("none");
  const empty = new Uint8Array(0);
  const total =
    magic.length +
    4 + none.length +
    4 + none.length +
    4 + empty.length +
    4 +
    4 + pubSectionSize +
    4 + encSection.length;
  const out = new Uint8Array(total);
  const dvOut = new DataView(out.buffer);
  let off = 0;
  out.set(magic, off);
  off += magic.length;
  off = writeString(out, off, none);
  off = writeString(out, off, none);
  off = writeString(out, off, empty);
  writeU32(dvOut, off, 1);
  off += 4;
  writeU32(dvOut, off, pubSectionSize);
  out.set(pubSection, off + 4);
  off += 4 + pubSectionSize;
  writeU32(dvOut, off, encSection.length);
  out.set(encSection, off + 4);
  return out;
}

/** Generate Ed25519 SSH key pair in browser; return OpenSSH public key and OPENSSH PRIVATE KEY PEM (so ssh -i /dev/stdin accepts it). */
async function generateSshKeyPair(): Promise<{ publicKeyOpenSSH: string; privateKeyPem: string }> {
  const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const rawPub = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  if (rawPub.length !== 32) throw new Error("Unexpected Ed25519 public key length");
  const typeName = new TextEncoder().encode("ssh-ed25519");
  const buf = new Uint8Array(4 + typeName.length + 4 + rawPub.length);
  new DataView(buf.buffer).setUint32(0, typeName.length, false);
  buf.set(typeName, 4);
  new DataView(buf.buffer).setUint32(4 + typeName.length, rawPub.length, false);
  buf.set(rawPub, 4 + typeName.length + 4);
  const publicKeyOpenSSH = `ssh-ed25519 ${uint8ToBase64(buf)}`;

  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  const privateSeed = ed25519SeedFromPkcs8(pkcs8);
  const blob = buildOpenSSHPrivateKeyBlob(rawPub, privateSeed);
  const b64 = uint8ToBase64(blob);
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += 70) lines.push(b64.slice(i, i + 70));
  const privateKeyPem = `-----BEGIN OPENSSH PRIVATE KEY-----\n${lines.join("\n")}\n-----END OPENSSH PRIVATE KEY-----`;
  return { publicKeyOpenSSH, privateKeyPem };
}

export default function SpawnPage({
  params,
}: {
  params: Promise<{ mint: string }>;
}) {
  const { wallets } = useWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const [mint, setMint] = useState<string | null>(null);
  const [launch, setLaunch] = useState<{ creator: string; seedPayload: SeedPayload; dropletIp?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Flow: choose size → payment → spawning → success
  const [selectedSize, setSelectedSize] = useState<"2gb" | "4gb" | null>(null);
  const [intent, setIntent] = useState<{
    treasuryAddress: string | null;
    amountSol: number;
    memo: string | null;
    size: "2gb" | "4gb";
  } | null>(null);
  const [creatingIntent, setCreatingIntent] = useState(false);
  const [sending, setSending] = useState(false);
  const [pollingPayment, setPollingPayment] = useState(false);
  const [spawning, setSpawning] = useState(false);
  const [spawnMessage, setSpawnMessage] = useState("");
  const [dropletIp, setDropletIp] = useState<string | null>(null);
  const [sshPublicKey, setSshPublicKey] = useState<string | null>(null);
  const [privateKeyPem, setPrivateKeyPem] = useState<string | null>(null);
  const [snippetCopied, setSnippetCopied] = useState(false);

  const wallet = wallets?.[0];
  const walletAddress = wallet?.address;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { mint: m } = await params;
      setMint(m ? decodeURIComponent(m) : null);
    })();
    return () => { cancelled = true; };
  }, [params]);

  useEffect(() => {
    if (!mint) return;
    let cancelled = false;
    (async () => {
      try {
        const [launchRes, statusRes] = await Promise.all([
          fetch(`/api/openclaw/launch/${encodeURIComponent(mint)}`),
          fetch(`/api/openclaw/spawn-status?mint=${encodeURIComponent(mint)}`),
        ]);
        if (cancelled) return;
        if (launchRes.ok) {
          const j = await launchRes.json();
          const l = j.launch ?? {};
          setLaunch({
            creator: l.creator ?? "",
            seedPayload: l.seedPayload ?? {},
            dropletIp: l.dropletIp ?? null,
          });
          if (l.dropletIp) setDropletIp(l.dropletIp);
        }
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData.status === "ready" && statusData.dropletIp) {
            setDropletIp(statusData.dropletIp);
          } else if (statusData.status === "spawning") {
            setSpawning(true);
            setSpawnMessage(statusData.message ?? "Creating droplet…");
          } else if (statusData.status === "idle") {
            setDropletIp(null);
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mint]);

  // Poll spawn-status when in spawning state
  useEffect(() => {
    if (!mint || !spawning || dropletIp) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/openclaw/spawn-status?mint=${encodeURIComponent(mint)}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.status === "ready" && data.dropletIp) {
          setDropletIp(data.dropletIp);
          setSpawning(false);
          return;
        }
        if (data.status === "deleted") {
          setSpawning(false);
          setError(data?.message ?? "Droplet was removed.");
          return;
        }
        if (data.message) setSpawnMessage(data.message);
      } catch {
        if (!cancelled) setSpawnMessage("Checking again…");
      }
    };
    void poll();
    const interval = setInterval(() => { if (!cancelled) void poll(); }, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [mint, spawning, dropletIp]);

  const createIntent = async () => {
    if (!mint || !walletAddress || !selectedSize) return;
    setCreatingIntent(true);
    setError(null);
    try {
      if (!sshPublicKey) {
        const { publicKeyOpenSSH, privateKeyPem: pem } = await generateSshKeyPair();
        setSshPublicKey(publicKeyOpenSSH);
        setPrivateKeyPem(pem);
      }
      const res = await fetch("/api/openclaw/spawn-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mint, wallet: walletAddress, size: selectedSize }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Failed to create spawn intent");
        return;
      }
      setIntent({
        treasuryAddress: data.treasuryAddress ?? null,
        amountSol: data.amountSol ?? AMOUNT_BY_SIZE[selectedSize],
        memo: data.memo ?? mint,
        size: selectedSize,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create intent");
    } finally {
      setCreatingIntent(false);
    }
  };

  const skipSpawnPayment = process.env.NEXT_PUBLIC_OPENCLAW_SKIP_SPAWN_PAYMENT === "true" || process.env.NEXT_PUBLIC_OPENCLAW_SKIP_SPAWN_PAYMENT === "1";

  const sendPayment = async () => {
    if (!mint || !walletAddress || !intent?.treasuryAddress) {
      setError("Wallet or payment details missing.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      if (!skipSpawnPayment) {
        const connection = new Connection(
          process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com",
          "confirmed"
        );
        const lamports = Math.floor(intent.amountSol * LAMPORTS_PER_SOL);
        const tx = new Transaction();
        tx.add(
          SystemProgram.transfer({
            fromPubkey: new PublicKey(walletAddress),
            toPubkey: new PublicKey(intent.treasuryAddress),
            lamports,
          }),
          new TransactionInstruction({
            keys: [],
            programId: MEMO_PROGRAM_ID,
            data: Buffer.from(mint, "utf8"),
          })
        );
        const { blockhash } = await connection.getLatestBlockhash("confirmed");
        tx.recentBlockhash = blockhash;
        tx.feePayer = new PublicKey(walletAddress);
        const serialized = tx.serialize({ requireAllSignatures: false });
        await signAndSendTransaction({ transaction: serialized, wallet: wallet as any });
      }
      setPollingPayment(true);
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const checkRes = await fetch(`/api/openclaw/spawn-intent?mint=${encodeURIComponent(mint)}&check=1`);
        const checkData = await checkRes.json();
        if (checkData.intentNotFound) {
          setError("Session expired. Please choose a size and try again.");
          break;
        }
        if (checkData.status === "paid") {
          const paidSize = intent.size;
          setIntent(null);
          setSpawning(true);
          setSpawnMessage("Creating droplet…");
          setPollingPayment(false);
          setSending(false);
          // One key pair per spawn: generate at spawn time so the key we send and the .opencaw always match.
          const { publicKeyOpenSSH, privateKeyPem: pem } = await generateSshKeyPair();
          setSshPublicKey(publicKeyOpenSSH);
          setPrivateKeyPem(pem);
          const spawnRes = await fetch("/api/openclaw/spawn", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mint,
              wallet: walletAddress,
              size: paidSize,
              sshPublicKey: publicKeyOpenSSH,
            }),
          });
          const spawnData = await spawnRes.json();
          if (!spawnRes.ok) {
            setError(spawnData?.error ?? "Failed to create droplet");
            setSpawning(false);
          }
          return;
        }
      }
      if (pollingPayment) setError("Payment not detected yet. Check your wallet and try refreshing.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setSending(false);
      setPollingPayment(false);
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
        <p className="text-zinc-400 text-sm mb-4">Connect your wallet to spawn a droplet.</p>
        <Link href="/profile" className="rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold py-2.5 px-4 text-sm">
          Back to profile
        </Link>
      </div>
    );
  }

  if (launch && launch.creator !== walletAddress) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center bg-[#060608] text-white px-4">
        <p className="text-zinc-400 text-sm mb-4">You don’t own this launch.</p>
        <Link href="/profile" className="text-red-400 hover:text-red-300 text-sm">Back to profile</Link>
      </div>
    );
  }

  // Success: show droplet IP, SSH instructions (copy-paste snippet with key), setup guide, optional SOUL
  if (dropletIp) {
    const soul = launch?.seedPayload ? buildSoulMarkdown(launch.seedPayload) : "";
    const fullSnippet =
      privateKeyPem &&
      `ssh -i /dev/stdin root@${dropletIp} << 'KEY'
${privateKeyPem}
KEY`;
    const handleCopy = () => {
      if (!fullSnippet) return;
      navigator.clipboard.writeText(fullSnippet).then(() => {
        setSnippetCopied(true);
        setTimeout(() => setSnippetCopied(false), 2000);
      });
    };
    const handleReset = async () => {
      if (!mint || !walletAddress) return;
      try {
        const res = await fetch("/api/openclaw/spawn-reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mint, wallet: walletAddress }),
        });
        if (res.ok) {
          setDropletIp(null);
          setLaunch((l) => l ? { ...l, dropletIp: null } : l);
        }
      } catch {
        // ignore
      }
    };
    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-[#060608] text-white px-4 py-8">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-bold text-white mb-2">Droplet ready</h1>
          <p className="text-zinc-500 text-sm mb-6">
            Your VPS is up. Download Agent Connect to connect and install your agent—no terminal copy-paste required.
          </p>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-6">
            <div>
              <p className="text-sm font-semibold text-white mb-2">1. Download Agent Connect</p>
              <p className="text-zinc-400 text-sm mb-4">
                Install the desktop app (Mac). You’ll use it to connect to your droplet and run the agent setup.
              </p>
              <a
                href={AGENT_CONNECT_DOWNLOAD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-5 text-sm w-full sm:w-auto"
              >
                Download Agent Connect (Mac)
              </a>
            </div>
            {privateKeyPem && dropletIp ? (
              <>
                <p className="text-sm text-amber-200/90 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 mb-4">
                  Droplet is finishing setup. Wait 1–2 minutes before connecting, or you may see connection or authentication errors.
                </p>
                <div>
                  <p className="text-sm font-semibold text-white mb-2">2. Download your connection file</p>
                  <p className="text-zinc-400 text-sm mb-3">
                    After installing the app, download this file and open it with Agent Connect (or drag it into the app).
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const bundle: OpenClawConnectionBundle = {
                        version: 1,
                        host: dropletIp,
                        port: 22,
                        user: "root",
                        privateKeyPem,
                        mint: mint ?? undefined,
                        label: launch?.seedPayload?.name ? `OpenClaw: ${launch.seedPayload.name}` : undefined,
                      };
                      const blob = new Blob([JSON.stringify(bundle, null, 0)], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `openclaw-${mint ? mint.slice(0, 8) : "droplet"}.opencaw`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium py-2.5 px-4"
                  >
                    Download connection file
                  </button>
                  <p className="text-zinc-500 text-[10px] mt-2">
                    This file contains your private key. Store it securely and open it only in Agent Connect.
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white mb-2">3. Connect and install your agent</p>
                  <p className="text-zinc-400 text-sm mb-2">
                    Open Agent Connect, import the connection file, and click Connect. You’ll get a terminal session on your droplet—then follow the{" "}
                    <a href="https://docs.openclaw.ai" target="_blank" rel="noopener noreferrer" className="text-red-400 hover:text-red-300">
                      OpenClaw docs
                    </a>{" "}
                    to install and run your agent.
                  </p>
                </div>
                <div className="pt-4 border-t border-white/10">
                  <p className="text-xs font-semibold text-zinc-500 mb-2">Droplet IP</p>
                  <code className="block text-zinc-400 font-mono text-xs bg-white/5 px-3 py-2 rounded break-all">{dropletIp}</code>
                </div>
                <details className="group">
                  <summary className="text-zinc-500 text-xs font-medium cursor-pointer list-none">
                    Advanced: use terminal or Termius instead
                  </summary>
                  <div className="mt-3 space-y-3">
                    <p className="text-zinc-500 text-[10px]">
                      Copy-paste block or SSH config for Terminal / Termius:
                    </p>
                    {fullSnippet && (
                      <>
                        <pre className="text-xs text-zinc-400 font-mono bg-white/5 p-3 rounded overflow-x-auto whitespace-pre border border-white/10">
                          {fullSnippet}
                        </pre>
                        <button
                          type="button"
                          onClick={handleCopy}
                          className="rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-medium px-3 py-2"
                        >
                          {snippetCopied ? "Copied" : "Copy block"}
                        </button>
                      </>
                    )}
                    <pre className="text-xs text-zinc-400 font-mono bg-white/5 p-3 rounded overflow-x-auto whitespace-pre border border-white/10">
                      {`Host openclaw-droplet
  HostName ${dropletIp}
  User root
  IdentityFile ~/.ssh/openclaw-${mint ? mint.slice(0, 8) : "key"}`}
                    </pre>
                    <button
                      type="button"
                      onClick={() => {
                        if (!privateKeyPem) return;
                        const blob = new Blob([privateKeyPem], { type: "application/x-pem-file" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `openclaw-${mint ? mint.slice(0, 8) : "key"}`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-medium px-3 py-2"
                    >
                      Download key file
                    </button>
                  </div>
                </details>
              </>
            ) : (
              <p className="text-zinc-400 text-sm">
                Your connection file was only available when you spawned. Use “Reset to spawn again” below, then spawn again to get a new connection file.
              </p>
            )}
            <div>
              <p className="text-sm font-semibold text-white mb-2">(Optional) Agent identity</p>
              <p className="text-zinc-400 text-sm mb-2">
                After installing OpenClaw, you can paste the content below into <code className="text-zinc-400 bg-white/5 px-1 rounded">~/.openclaw/workspace/SOUL.md</code> to give your agent a name and personality from the seed.
              </p>
              {soul ? (
                <pre className="text-xs text-zinc-300 bg-white/5 p-4 rounded overflow-x-auto whitespace-pre-wrap break-words">
                  {soul}
                </pre>
              ) : (
                <p className="text-zinc-500 text-xs">No seed data for this launch.</p>
              )}
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="text-zinc-500 hover:text-zinc-400 text-sm underline"
            >
              Droplet destroyed? Reset to spawn again
            </button>
            <Link href="/profile" className="text-zinc-500 hover:text-zinc-400 text-sm">
              Back to profile
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Spawning: poll until ready
  if (spawning) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-[#060608] text-white px-4 py-8">
        <div className="max-w-md mx-auto">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 shrink-0 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
              <div>
                <p className="text-white font-medium">Creating your droplet</p>
                <p className="text-zinc-400 text-sm mt-0.5">{spawnMessage}</p>
              </div>
            </div>
            <p className="text-zinc-500 text-xs mt-4">
              This page updates every few seconds. When the droplet is ready, you’ll see SSH instructions here.
            </p>
          </div>
          <Link href="/profile" className="mt-6 inline-block text-zinc-500 hover:text-zinc-400 text-sm">
            Back to profile
          </Link>
        </div>
      </div>
    );
  }

  // Choose size or payment
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#060608] text-white px-4 py-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-xl font-bold text-white mb-2">Spawn droplet</h1>
        <p className="text-zinc-500 text-sm mb-6">
          Choose a droplet size and pay in SOL. You’ll get a minimal Ubuntu VPS; then SSH in and install OpenClaw using the on-screen guide.
        </p>
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        {!intent ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
            <p className="text-zinc-400 text-sm">Select RAM size</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedSize("2gb")}
                className={`rounded-xl border py-4 px-4 text-left transition ${
                  selectedSize === "2gb"
                    ? "border-red-500 bg-red-500/10 text-white"
                    : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/20"
                }`}
              >
                <span className="font-semibold block">2 GB RAM</span>
                <span className="text-xs">0.005 SOL</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedSize("4gb")}
                className={`rounded-xl border py-4 px-4 text-left transition ${
                  selectedSize === "4gb"
                    ? "border-red-500 bg-red-500/10 text-white"
                    : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/20"
                }`}
              >
                <span className="font-semibold block">4 GB RAM</span>
                <span className="text-xs">0.01 SOL</span>
              </button>
            </div>
            <button
              type="button"
              onClick={createIntent}
              disabled={!selectedSize || creatingIntent}
              className="w-full rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold py-3 px-4 text-sm"
            >
              {creatingIntent ? "Preparing…" : "Spawn droplet"}
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
            <p className="text-zinc-400 text-sm">
              Send <strong className="text-white">{intent.amountSol} SOL</strong> to the treasury with the mint as memo.
            </p>
            {intent.treasuryAddress && (
              <p className="text-[10px] font-mono text-zinc-500 break-all">Treasury: {intent.treasuryAddress}</p>
            )}
            <p className="text-[10px] text-zinc-500">
              Memo: <span className="font-mono text-zinc-400">{intent.memo ?? mint}</span>
            </p>
            <button
              type="button"
              onClick={sendPayment}
              disabled={sending || pollingPayment}
              className="w-full rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold py-3 px-4 text-sm"
            >
              {pollingPayment ? "Creating droplet…" : sending && !skipSpawnPayment ? "Sending…" : skipSpawnPayment ? "Create droplet (no payment)" : "Send SOL"}
            </button>
            <p className="text-[10px] text-zinc-500">
              {skipSpawnPayment ? "Payment is disabled for testing. Click to create the droplet." : "After you approve, we'll detect the payment and create your droplet."}
            </p>
          </div>
        )}
        <Link href="/profile" className="mt-6 inline-block text-zinc-500 hover:text-zinc-400 text-sm">
          Back to profile
        </Link>
      </div>
    </div>
  );
}
