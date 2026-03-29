import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/services/firebase-admin.service";
import { createSpawnDroplet } from "@/lib/digitalocean";
import { generateKeyPairSync } from "crypto";

const OPENCLAW_LAUNCHES = "openclaw_launches";
const SPAWN_INTENTS = "spawn_intents";

/** Generate Ed25519 SSH key pair server-side (fallback when client WebCrypto doesn't support Ed25519). */
function generateServerSshKeyPair(): { publicKeyOpenSSH: string; privateKeyPem: string } {
  const pair = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "der" },
  });
  // Build OpenSSH public key from raw 32-byte Ed25519 public key (last 32 bytes of SPKI DER)
  const rawPub = pair.publicKey.subarray(pair.publicKey.length - 32);
  const keyType = Buffer.from("ssh-ed25519");
  const pubBuf = Buffer.alloc(4 + keyType.length + 4 + 32);
  pubBuf.writeUInt32BE(keyType.length, 0);
  keyType.copy(pubBuf, 4);
  pubBuf.writeUInt32BE(32, 4 + keyType.length);
  rawPub.copy(pubBuf, 4 + keyType.length + 4);
  const publicKeyOpenSSH = `ssh-ed25519 ${pubBuf.toString("base64")}`;

  // Build OpenSSH private key format
  const privateSeed = (pair.privateKey as Buffer).subarray((pair.privateKey as Buffer).length - 32);
  const secret64 = Buffer.alloc(64);
  privateSeed.copy(secret64, 0);
  rawPub.copy(secret64, 32);

  const magic = Buffer.from("openssh-key-v1\0");
  const none = Buffer.from("none");
  const writeStr = (b: Buffer, off: number, s: Buffer) => { b.writeUInt32BE(s.length, off); s.copy(b, off + 4); return off + 4 + s.length; };

  const pubSecSize = 4 + keyType.length + 4 + 32;
  const checkint = (Math.random() * 0xffffffff) >>> 0;
  let encSize = 4 + 4 + 4 + keyType.length + 4 + 32 + 4 + 64 + 4; // checkint*2 + type + pub + secret + comment
  const padLen = (8 - (encSize % 8)) % 8;
  encSize += padLen;
  const encBuf = Buffer.alloc(encSize);
  let e = 0;
  encBuf.writeUInt32BE(checkint, e); e += 4;
  encBuf.writeUInt32BE(checkint, e); e += 4;
  e = writeStr(encBuf, e, keyType);
  encBuf.writeUInt32BE(32, e); rawPub.copy(encBuf, e + 4); e += 4 + 32;
  encBuf.writeUInt32BE(64, e); secret64.copy(encBuf, e + 4); e += 4 + 64;
  encBuf.writeUInt32BE(0, e); e += 4;
  for (let i = 1; i <= padLen; i++) encBuf[e + i - 1] = i & 0xff;

  const totalSize = magic.length + (4 + none.length) * 2 + 4 + 4 + (4 + pubSecSize) + (4 + encBuf.length);
  const out = Buffer.alloc(totalSize);
  let off = 0;
  magic.copy(out, off); off += magic.length;
  off = writeStr(out, off, none);
  off = writeStr(out, off, none);
  out.writeUInt32BE(0, off); off += 4; // empty kdf options
  out.writeUInt32BE(1, off); off += 4; // nkeys
  const pubSec = Buffer.alloc(pubSecSize);
  let ps = writeStr(pubSec, 0, keyType);
  pubSec.writeUInt32BE(32, ps); rawPub.copy(pubSec, ps + 4);
  off = writeStr(out, off, pubSec);
  off = writeStr(out, off, encBuf);

  const b64 = out.toString("base64");
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += 70) lines.push(b64.slice(i, i + 70));
  const privateKeyPem = `-----BEGIN OPENSSH PRIVATE KEY-----\n${lines.join("\n")}\n-----END OPENSSH PRIVATE KEY-----`;

  return { publicKeyOpenSSH, privateKeyPem };
}

/**
 * POST /api/openclaw/spawn
 * Body: { mint: string, wallet: string, size: "2gb" | "4gb" }
 * Verifies spawn intent is paid, creates minimal droplet with chosen size, stores deployDropletId on launch.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mint = typeof body?.mint === "string" ? body.mint.trim() : "";
    const wallet = typeof body?.wallet === "string" ? body.wallet.trim() : "";
    const size = body?.size === "4gb" ? "4gb" : "2gb";
    const sshPublicKey = typeof body?.sshPublicKey === "string" ? body.sshPublicKey.trim() : undefined;

    if (!mint || !wallet) {
      return NextResponse.json(
        { error: "mint and wallet are required" },
        { status: 400 }
      );
    }
    // Generate SSH key pair server-side if client didn't provide one (e.g. mobile wallet browser)
    let serverGeneratedKeyPair: { publicKeyOpenSSH: string; privateKeyPem: string } | null = null;
    let effectiveSshPublicKey = sshPublicKey;
    if (!effectiveSshPublicKey || effectiveSshPublicKey.length < 50) {
      serverGeneratedKeyPair = generateServerSshKeyPair();
      effectiveSshPublicKey = serverGeneratedKeyPair.publicKeyOpenSSH;
    }

    const db = getAdminFirestore();

    const intentSnap = await db.collection(SPAWN_INTENTS).doc(mint).get();
    if (!intentSnap.exists) {
      return NextResponse.json(
        { error: "Spawn intent not found" },
        { status: 404 }
      );
    }
    const intent = intentSnap.data()!;
    const skipPayment = process.env.OPENCLAW_SKIP_SPAWN_PAYMENT === "true" || process.env.OPENCLAW_SKIP_SPAWN_PAYMENT === "1";
    if (!skipPayment && intent.status !== "paid") {
      return NextResponse.json(
        { error: "Payment not confirmed. Complete payment first." },
        { status: 400 }
      );
    }
    if (intent.wallet !== wallet) {
      return NextResponse.json(
        { error: "Wallet does not match spawn intent" },
        { status: 403 }
      );
    }
    if ((intent.size === "4gb" ? "4gb" : "2gb") !== size) {
      return NextResponse.json(
        { error: "Size does not match paid intent" },
        { status: 400 }
      );
    }

    const launchRef = db.collection(OPENCLAW_LAUNCHES).doc(mint);
    const launchSnap = await launchRef.get();
    if (!launchSnap.exists) {
      return NextResponse.json(
        { error: "Launch record not found" },
        { status: 404 }
      );
    }

    const doToken = process.env.DIGITALOCEAN_TOKEN?.trim();
    if (!doToken) {
      return NextResponse.json(
        { error: "VPS not configured. Set DIGITALOCEAN_TOKEN in the server environment." },
        { status: 503 }
      );
    }

    const result = await createSpawnDroplet({ mint, size, sshPublicKey: effectiveSshPublicKey });
    await launchRef.update({
      deployDropletId: result.dropletId,
      hatchStatus: "spawning",
      hatchedAt: new Date(),
    });

    return NextResponse.json({
      status: "spawning",
      dropletId: result.dropletId,
      message: "Droplet created. This page will update once the droplet is ready.",
      ...(serverGeneratedKeyPair ? { serverKeyPair: serverGeneratedKeyPair } : {}),
    });
  } catch (e) {
    console.error("[openclaw/spawn]", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: `Spawn failed: ${message}` },
      { status: 503 }
    );
  }
}
