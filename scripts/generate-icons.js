// PWA icon generator. Builds icon-192, icon-512, icon-maskable-512 and
// apple-touch-icon from the project's existing feather artwork.
//
// Source artwork (assets/images/feather_black_128.png) is a dark feather
// on transparent. We invert it to a light feather and composite onto a
// dark canvas (#212121) — same dark as the navbar — so the installed
// app icon matches the brand instead of looking like a flat dark blob.

const sharp = require("sharp");
const path = require("path");

const SRC = path.resolve(__dirname, "..", "assets", "images", "feather_black_128.png");
const OUT_DIR = path.resolve(__dirname, "..", "assets", "images");

const CANVAS_BG = { r: 0x21, g: 0x21, b: 0x21, alpha: 1 };

async function buildIcon(size, padRatio, filename) {
  const inner = Math.round(size * padRatio);
  const offset = Math.round((size - inner) / 2);

  // Negate RGB channels so the dark feather becomes light. alpha:false
  // is critical — without it the alpha channel is also inverted and the
  // background bleeds into where the feather should be transparent.
  const featherBuffer = await sharp(SRC)
    .resize(inner, inner, { fit: "contain", kernel: "lanczos3" })
    .negate({ alpha: false })
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: CANVAS_BG,
    },
  })
    .composite([{ input: featherBuffer, left: offset, top: offset }])
    .png()
    .toFile(path.join(OUT_DIR, filename));

  console.log(`Wrote ${filename} (${size}x${size}, inner ${inner}px)`);
}

async function main() {
  // Regular icons: 78% safe area is plenty since the platform doesn't
  // crop them.
  await buildIcon(192, 0.78, "icon-192.png");
  await buildIcon(512, 0.78, "icon-512.png");
  // Maskable: outer 20% may be cropped on Android, so the feather sits
  // inside the inner 60% safe zone.
  await buildIcon(512, 0.6, "icon-maskable-512.png");
  await buildIcon(180, 0.78, "apple-touch-icon.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
