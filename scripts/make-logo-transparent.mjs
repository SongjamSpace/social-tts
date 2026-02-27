/**
 * Makes black background transparent in the moltspaces logo.
 * Run: node scripts/make-logo-transparent.mjs
 */
import sharp from "sharp";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const sources = [
  join(root, "public", "images", "moltspaces-logo-source.png"),
  join(process.env.HOME || "", ".cursor", "projects", "Users-adamplace-moltspaces-ui-draft", "assets", "moltspaces-18849d45-3723-41fb-ad25-96865d5608be.png"),
];

let inputPath = sources.find((p) => existsSync(p));
if (!inputPath) {
  console.error("Logo source not found. Tried:", sources);
  process.exit(1);
}

const BLACK_THRESHOLD = 40; // pixels with R,G,B all below this become transparent

const input = await sharp(inputPath);
const { data, info } = await input.raw().ensureAlpha().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;

for (let i = 0; i < data.length; i += channels) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  if (r <= BLACK_THRESHOLD && g <= BLACK_THRESHOLD && b <= BLACK_THRESHOLD) {
    data[i + 3] = 0; // set alpha to 0
  }
}

const outPath = join(root, "public", "images", "moltspaces-logo.png");
await sharp(data, { raw: { width, height, channels } })
  .png()
  .toFile(outPath);

console.log("Written:", outPath);
