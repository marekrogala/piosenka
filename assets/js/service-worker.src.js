// Service worker source. workbox-build's injectManifest replaces the
// __WB_MANIFEST placeholder with the precache list at build time.

import {
  precacheAndRoute,
  createHandlerBoundToURL,
  cleanupOutdatedCaches,
} from "workbox-precaching";
import { registerRoute, setCatchHandler } from "workbox-routing";
import { StaleWhileRevalidate, NetworkFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Allow the page to ask the SW to take over immediately. Used by the
// E5 update flow.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

const HTML_PATH_RE = /^\/(opracowanie|spiewnik|artykuly|blog|szukaj|o-stronie|zapisane)(\/|$)/;

// Song / artist / article / blog pages: stale-while-revalidate.
// Once visited, they keep working offline; on revisit Workbox refreshes
// them in the background.
registerRoute(
  ({ request, url }) =>
    request.mode === "navigate" &&
    url.origin === self.location.origin &&
    HTML_PATH_RE.test(url.pathname),
  new StaleWhileRevalidate({
    cacheName: "html-pages",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 500,
        maxAgeSeconds: 60 * 60 * 24 * 30,
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// Homepage: network-first (changes most often).
registerRoute(
  ({ request, url }) =>
    request.mode === "navigate" &&
    url.origin === self.location.origin &&
    url.pathname === "/",
  new NetworkFirst({
    cacheName: "homepage",
    networkTimeoutSeconds: 4,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 1, maxAgeSeconds: 60 * 60 * 24 * 7 }),
    ],
  })
);

// Cover images, score thumbs etc. served from Google Cloud Storage.
registerRoute(
  ({ url }) =>
    url.origin === "https://storage.googleapis.com" &&
    url.pathname.startsWith("/piosenka-media/"),
  new StaleWhileRevalidate({
    cacheName: "media-images",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 300,
        maxAgeSeconds: 60 * 60 * 24 * 90,
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// Google Fonts CSS + font files (Ubuntu).
registerRoute(
  ({ url }) => url.origin === "https://fonts.googleapis.com",
  new StaleWhileRevalidate({ cacheName: "google-fonts-stylesheets" })
);
registerRoute(
  ({ url }) => url.origin === "https://fonts.gstatic.com",
  new StaleWhileRevalidate({
    cacheName: "google-fonts-webfonts",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
    ],
  })
);

// Offline fallback. When a navigation request fails and no cache entry
// exists, serve the precached offline page instead of the browser's
// default offline error.
const offlineFallback = createHandlerBoundToURL("/offline.html");
setCatchHandler(async ({ request }) => {
  if (request.mode === "navigate") {
    return offlineFallback({ request });
  }
  return Response.error();
});
