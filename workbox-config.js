// Workbox build config. Used by `npm run build:sw` after the Django
// build has produced `out/`.
//
// generateSW mode produces a single self-contained service worker file
// with the Workbox runtime inlined — no extra files to copy, no external
// CDN, no second-step bootstrap.

module.exports = {
  globDirectory: "out/",
  globPatterns: [
    "static/css/**/*.css",
    "static/js/**/*.js",
    "static/CACHE/**/*.{js,css}",
    "static/images/icon-192.png",
    "static/images/icon-512.png",
    "static/images/icon-maskable-512.png",
    "static/images/apple-touch-icon.png",
    "static/images/favicon*.png",
    "static/images/feather*.png",
    "static/images/patterns/*.png",
    "static/third_party/**/*.{js,css,woff,woff2,ttf,eot,svg}",
    "index/*.json",
    "manifest.webmanifest",
  ],
  globIgnores: [
    "**/node_modules/**",
    "**/*.map",
  ],
  swDest: "out/service-worker.js",
  inlineWorkboxRuntime: true,
  sourcemap: false,
  cleanupOutdatedCaches: true,
  skipWaiting: false,
  clientsClaim: false,
  // Bump precache size cap a bit; default 2MB is a tight fit for Bootstrap.
  maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
};
