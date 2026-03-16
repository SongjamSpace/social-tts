#!/usr/bin/env node
/**
 * Calls POST /api/openclaw/backfill-launch to add or update OpenClaw launch
 * records in Firestore (for profile "My agents" and spawn/hatch).
 *
 * Usage:
 *   CREATOR=<wallet> [MINTS=<mint1,mint2>] [BASE_URL=https://your-app.vercel.app] [BACKFILL_SECRET=...] node scripts/backfill-openclaw-launch.mjs
 *
 * Example (backfill one mint, e.g. "John"):
 *   CREATOR=Fh9ADtb7JPTmst7y3Gegt5FaPv4Re5vibPGJf3WWLkDL MINTS=3nWgb7QMtUziSc7qXkxAGrxPdqU7RaMJah4bC7aoseve BASE_URL=https://your-app.vercel.app node scripts/backfill-openclaw-launch.mjs
 */
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const CREATOR = process.env.CREATOR?.trim();
const MINTS = process.env.MINTS?.trim()
  ? process.env.MINTS.split(",").map((m) => m.trim()).filter(Boolean)
  : undefined;
const BACKFILL_SECRET = process.env.BACKFILL_SECRET?.trim();

if (!CREATOR) {
  console.error("CREATOR (creator wallet) is required.");
  console.error("Example: CREATOR=YourWallet... MINTS=3nWgb7Q... node scripts/backfill-openclaw-launch.mjs");
  process.exit(1);
}

const body = { creator: CREATOR };
if (MINTS?.length) body.mints = MINTS;
if (BACKFILL_SECRET) body.secret = BACKFILL_SECRET;

const url = `${BASE_URL.replace(/\/$/, "")}/api/openclaw/backfill-launch`;
console.log("POST", url, body);

fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})
  .then(async (res) => {
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("Error:", res.status, json);
      process.exit(1);
    }
    console.log("Success:", json);
    if (json.backfilled != null) console.log("Backfilled", json.backfilled, "launch(es):", json.mints || []);
  })
  .catch((err) => {
    console.error("Request failed:", err.message);
    process.exit(1);
  });
