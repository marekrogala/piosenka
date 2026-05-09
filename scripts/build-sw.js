// Bundle the service worker source with esbuild, then run
// workbox-build's injectManifest on the bundled output to inject the
// precache list in place of `self.__WB_MANIFEST`.

const path = require("path");
const esbuild = require("esbuild");
const { injectManifest } = require("workbox-build");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "assets", "js", "service-worker.src.js");
const BUNDLED = path.join(ROOT, "out", "_service-worker.bundled.js");
const OUT = path.join(ROOT, "out", "service-worker.js");

async function main() {
  await esbuild.build({
    entryPoints: [SRC],
    bundle: true,
    outfile: BUNDLED,
    format: "iife",
    target: "es2020",
    minify: true,
    sourcemap: false,
    logLevel: "warning",
  });

  const result = await injectManifest({
    swSrc: BUNDLED,
    swDest: OUT,
    globDirectory: path.join(ROOT, "out"),
    globPatterns: [
      // App shell — the bundled CSS/JS that base.html actually references.
      "static/CACHE/**/*.{js,css}",
      "static/css/install-prompt.css",
      "static/fonts/*.woff2",
      "static/icons/*.svg",
      "static/third_party/**/*.{js,css,woff,woff2,ttf,eot,svg}",
      // App icons + favicons.
      "static/images/icon-192.png",
      "static/images/icon-512.png",
      "static/images/icon-maskable-512.png",
      "static/images/apple-touch-icon.png",
      "static/images/favicon*.png",
      "static/images/feather*.png",
      // Pagefind search index — small, lets search work offline.
      "_pagefind/pagefind.js",
      "_pagefind/pagefind-ui.js",
      "_pagefind/pagefind-ui.css",
      "_pagefind/wasm.*.pagefind",
      "_pagefind/pagefind-entry.json",
      "_pagefind/pagefind.*.pf_meta",
      "manifest.webmanifest",
      "offline.html",
    ],
    globIgnores: [
      "**/node_modules/**",
      "**/*.map",
      "_service-worker.bundled.js",
      // Individual unbundled JS — django-compress already bundled them
      // into static/CACHE/js/output.*.js, which is what HTML loads.
      "static/js/**",
      "static/css/output.css",
      "static/css/input.css",
    ],
    maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
  });

  // Drop the intermediate bundled file so it doesn't get deployed.
  require("fs").unlinkSync(BUNDLED);

  console.log(
    `Service worker written to ${path.relative(ROOT, OUT)} ` +
      `(precaching ${result.count} URLs, ` +
      `${(result.size / 1024 / 1024).toFixed(2)} MB).`
  );
  if (result.warnings.length) {
    console.warn("Warnings:", result.warnings);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
