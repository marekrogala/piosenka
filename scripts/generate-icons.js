const sharp = require("sharp");
const path = require("path");

const SRC = path.resolve(__dirname, "..", "assets", "images", "feather_black_128.png");
const OUT_DIR = path.resolve(__dirname, "..", "assets", "images");

const BG = { r: 0, g: 0, b: 0, alpha: 1 };

async function buildIcon(size, padRatio, filename) {
  const inner = Math.round(size * padRatio);
  const offset = Math.round((size - inner) / 2);

  const featherBuffer = await sharp(SRC)
    .resize(inner, inner, { fit: "contain", kernel: "lanczos3" })
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BG,
    },
  })
    .composite([{ input: featherBuffer, left: offset, top: offset }])
    .png()
    .toFile(path.join(OUT_DIR, filename));

  console.log(`Wrote ${filename} (${size}x${size}, inner ${inner}px)`);
}

async function main() {
  await buildIcon(192, 0.78, "icon-192.png");
  await buildIcon(512, 0.78, "icon-512.png");
  await buildIcon(512, 0.6, "icon-maskable-512.png");
  await buildIcon(180, 0.78, "apple-touch-icon.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
