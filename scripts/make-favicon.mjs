/**
 * Generates favicons from the moltspaces logo at -15deg (same angle as the site).
 * Run: node scripts/make-favicon.mjs
 */
import sharp from "sharp";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const logoPath = join(root, "public", "images", "moltspaces-logo.png");
const sourcePath = join(root, "public", "images", "moltspaces-logo-source.png");
const inputPath = existsSync(logoPath) ? logoPath : sourcePath;

if (!existsSync(inputPath)) {
  console.error("Logo not found. Need public/images/moltspaces-logo.png or moltspaces-logo-source.png");
  process.exit(1);
}

const ROTATE_DEGREES = -15; // same as site: rotate-[-15deg]
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

// Rotate, trim transparent edges, then resize to fit inside size×size so the icon fills the canvas
function pipeline(size) {
  return sharp(inputPath)
    .rotate(ROTATE_DEGREES, { background: TRANSPARENT })
    .trim({ threshold: 1 })
    .resize(size, size, { fit: "contain", background: TRANSPARENT })
    .png();
}

async function main() {
  // Max size: 512x512 (PWA / high-DPI standard)
  await pipeline(512).toFile(join(root, "public", "favicon-512x512.png"));
  console.log("Written: public/favicon-512x512.png");

  await pipeline(64).toFile(join(root, "public", "favicon-64x64.png"));
  console.log("Written: public/favicon-64x64.png");

  await pipeline(48).toFile(join(root, "public", "favicon-48x48.png"));
  console.log("Written: public/favicon-48x48.png");

  await pipeline(32).toFile(join(root, "public", "favicon-32x32.png"));
  console.log("Written: public/favicon-32x32.png");

  await pipeline(16).toFile(join(root, "public", "favicon-16x16.png"));
  console.log("Written: public/favicon-16x16.png");

  await pipeline(180).toFile(join(root, "public", "apple-touch-icon.png"));
  console.log("Written: public/apple-touch-icon.png");

  await pipeline(192).toFile(join(root, "public", "android-chrome-192x192.png"));
  console.log("Written: public/android-chrome-192x192.png");

  await pipeline(512).toFile(join(root, "public", "android-chrome-512x512.png"));
  console.log("Written: public/android-chrome-512x512.png");

  console.log("Done. Favicons: logo trimmed and fitted at -15deg (icon fills canvas).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
