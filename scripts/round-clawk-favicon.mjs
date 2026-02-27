/**
 * Generates a rounded-corner favicon from public/clawk.png for the pumpfun route.
 * Run: node scripts/round-clawk-favicon.mjs
 */
import sharp from "sharp";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const inputPath = join(root, "public", "clawk.png");
const outputPath = join(root, "public", "clawk-favicon.png");

if (!existsSync(inputPath)) {
  console.error("clawk.png not found at public/clawk.png");
  process.exit(1);
}

const SIZE = 64;
const RADIUS = 14; // rounded corner radius in px

async function main() {
  const maskSvg = Buffer.from(
    `<svg width="${SIZE}" height="${SIZE}"><rect width="${SIZE}" height="${SIZE}" rx="${RADIUS}" ry="${RADIUS}" fill="white"/></svg>`
  );

  await sharp(inputPath)
    .resize(SIZE, SIZE, { fit: "cover" })
    .composite([{ input: maskSvg, blend: "dest-in" }])
    .png()
    .toFile(outputPath);

  console.log("Written: public/clawk-favicon.png (rounded corners)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
