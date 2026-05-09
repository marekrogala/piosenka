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

// Responsive image variants (AVIF / WebP / JPG) generated locally per
// build into static/img-variants/. Heavy collectively, so we don't
// precache them — instead cache them as the user reads articles /
// songs and the browser picks variants from the picture srcset.
registerRoute(
  ({ url }) =>
    url.origin === self.location.origin &&
    url.pathname.startsWith("/static/img-variants/"),
  new StaleWhileRevalidate({
    cacheName: "image-variants",
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

// Pagefind search index segments are loaded on-demand as the user types.
// Precache lists the entry + ui assets; this rule catches the rest.
registerRoute(
  ({ url }) =>
    url.origin === self.location.origin &&
    url.pathname.startsWith("/_pagefind/"),
  new StaleWhileRevalidate({
    cacheName: "pagefind",
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
