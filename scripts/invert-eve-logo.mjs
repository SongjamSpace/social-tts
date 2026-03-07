/**
 * Invert logo (black → white) and make white background transparent.
 * Usage: node scripts/invert-eve-logo.mjs [input.png]
 * Output: public/images/eve-logo.png
 */
import sharp from "sharp";
import { existsSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const inputPath = process.argv[2] || join(root, "public", "images", "eve-logo-source.png");
const outDir = join(root, "public", "images");
const outputPath = join(outDir, "eve-logo.png");

if (!existsSync(inputPath)) {
  console.error("Input image not found:", inputPath);
  console.error("Usage: node scripts/invert-eve-logo.mjs [input.png]");
  process.exit(1);
}
if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

async function main() {
  const image = sharp(inputPath);
  const { data, info } = await image
    .ensureAlpha()
    .negate({ alpha: false }) // invert RGB only
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const out = Buffer.alloc(width * height * 4);
  const threshold = 0.85; // treat pixel as "background" if luminance > 85% (was white, now dark after negate logic)
  // After negate: original black → white (255), original white → black (0). We want original white (now black) to be transparent.
  // So: make pixels that are near black (0,0,0) transparent; keep white (255,255,255) as white.
  for (let i = 0; i < width * height; i++) {
    const r = data[i * channels];
    const g = data[channels === 4 ? i * 4 + 1 : i * 3 + 1];
    const b = data[channels === 4 ? i * 4 + 2 : i * 3 + 2];
    const luminance = (r + g + b) / (3 * 255);
    out[i * 4] = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = luminance < 0.15 ? 0 : 255; // dark pixels (original white bg) → transparent
  }

  await sharp(out, { raw: { width, height, channels: 4 } })
    .png()
    .trim({ threshold: 1 })
    .toFile(outputPath);

  console.log("Written:", outputPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
