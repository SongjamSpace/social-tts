/**
 * Generates favicons from the Eve logo: black rounded square with logo on top.
 * Run: node scripts/make-eve-favicon.mjs
 * Output: public/favicon-*.png, apple-touch-icon.png, android-chrome-*.png
 */
import sharp from "sharp";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const logoPath = join(root, "public", "images", "eve-logo.png");

if (!existsSync(logoPath)) {
  console.error("Eve logo not found at public/images/eve-logo.png");
  process.exit(1);
}

// Rounded corner radius as fraction of size (e.g. 0.2 = 20%)
const ROUND_RATIO = 0.2;
const LOGO_PADDING = 0.85; // logo fits inside 85% of size

async function makeFavicon(size) {
  const radius = Math.max(2, Math.round(size * ROUND_RATIO));
  const bgSvg = Buffer.from(
    `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#000"/></svg>`
  );
  const logoInset = Math.round(size * (1 - LOGO_PADDING) / 2);
  const logoSize = size - 2 * logoInset;

  const logoBuf = await sharp(logoPath)
    .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const { width: lw, height: lh } = await sharp(logoBuf).metadata();
  const left = Math.round((size - (lw ?? logoSize)) / 2);
  const top = Math.round((size - (lh ?? logoSize)) / 2);

  return sharp(bgSvg)
    .png()
    .composite([{ input: logoBuf, left, top }])
    .png();
}

async function main() {
  const sizes = [
    { name: "favicon-16x16.png", size: 16 },
    { name: "favicon-32x32.png", size: 32 },
    { name: "favicon-48x48.png", size: 48 },
    { name: "favicon-64x64.png", size: 64 },
    { name: "favicon-512x512.png", size: 512 },
    { name: "apple-touch-icon.png", size: 180 },
    { name: "android-chrome-192x192.png", size: 192 },
    { name: "android-chrome-512x512.png", size: 512 },
  ];

  for (const { name, size } of sizes) {
    const outPath = join(root, "public", name);
    await makeFavicon(size).then((p) => p.toFile(outPath));
    console.log("Written: public/" + name);
  }

  console.log("Done. Eve favicons: black rounded square with logo.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
