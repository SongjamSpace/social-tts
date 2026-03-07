/**
 * Process white-on-black line art: make black transparent, keep all white strokes, trim padding.
 * Usage: node scripts/eve-logo-white-on-black.mjs [input.png]
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
  process.exit(1);
}
if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

async function main() {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const out = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * channels];
    const g = data[channels === 4 ? i * 4 + 1 : i * 3 + 1];
    const b = data[channels === 4 ? i * 4 + 2 : i * 3 + 2];
    const luminance = (r + g + b) / (3 * 255);
    const visible = luminance > 0.2;
    out[i * 4] = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = visible ? 255 : 0;
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
