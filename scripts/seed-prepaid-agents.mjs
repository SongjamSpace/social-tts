#!/usr/bin/env node
/**
 * Seeds Firestore `openclaw_launches` with pre-paid agent records.
 * Uses Firebase Admin SDK directly (requires FIREBASE_SERVICE_ACCOUNT_KEY or
 * GOOGLE_APPLICATION_CREDENTIALS in env).
 *
 * Usage:
 *   node scripts/seed-prepaid-agents.mjs
 *
 * Reads .env.local automatically for Firebase credentials.
 *
 * Idempotent — safe to re-run. Uses set-with-merge so existing fields are preserved.
 */
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

// Load .env.local (dotenv not installed; parse manually)
try {
  const envFile = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* .env.local not found; rely on environment */ }

const PREPAID_AGENTS = [
  {
    mint: "prepaid_mayor_31TpSHid",
    wallet: "31TpSHidXrpKZugvKQgZ3mRFhP8iCKyH2q9xMKL2fYH4",
    name: "Mayor",
    ticker: "$MAYOR",
    imageUrl: "https://firebasestorage.googleapis.com/v0/b/moltspaces.firebasestorage.app/o/openclaw%2Fmayor.jpeg?alt=media&token=f5420725-68c7-4051-85d1-ca41b071f4d7",
  },
  {
    mint: "prepaid_mayor_Fh9ADtb7",
    wallet: "Fh9ADtb7JPTmst7y3Gegt5FaPv4Re5vibPGJf3WWLkDL",
    name: "Mayor",
    ticker: "$MAYOR",
    imageUrl: "https://firebasestorage.googleapis.com/v0/b/moltspaces.firebasestorage.app/o/openclaw%2Fmayor.jpeg?alt=media&token=f5420725-68c7-4051-85d1-ca41b071f4d7",
  },
];

const projectId = process.env.NEXT_PUBLIC_FB_PROJECT_ID;
const keyJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();

let credential;
if (keyJson) {
  try {
    credential = cert(JSON.parse(keyJson));
  } catch (e) {
    console.error("Invalid FIREBASE_SERVICE_ACCOUNT_KEY JSON:", e);
    process.exit(1);
  }
}
if (!credential) {
  try {
    credential = applicationDefault();
  } catch {
    console.error("No Firebase credentials found. Set FIREBASE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS.");
    process.exit(1);
  }
}

const app = initializeApp({ projectId, credential });
const db = getFirestore(app);

for (const agent of PREPAID_AGENTS) {
  const ref = db.collection("openclaw_launches").doc(agent.mint);
  await ref.set(
    {
      mint: agent.mint,
      creator: agent.wallet,
      seedPayload: {
        name: agent.name,
        ticker: agent.ticker,
        imageUrl: agent.imageUrl,
      },
      createdAt: new Date(),
      agentUrl: null,
      hatchStatus: null,
      dropletIp: null,
      prepaid: true,
    },
    { merge: true }
  );
  console.log(`✓ Seeded ${agent.name} (${agent.mint}) for wallet ${agent.wallet}`);
}

console.log("Done.");
process.exit(0);
