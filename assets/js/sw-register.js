// Service worker registration. Kept intentionally minimal here — the
// update flow (toast / "new version, refresh") lands in a later commit.

(function () {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  // Don't fight the dev server: skip registration in obviously local dev
  // contexts where the SW would interfere with hot reloading. Production
  // and the localhost preview of the static build still register.
  var loc = window.location;
  var isLocalDjango = loc.port === "8000" && loc.hostname === "localhost";
  if (isLocalDjango) {
    return;
  }

  window.addEventListener("load", function () {
    navigator.serviceWorker
      .register("/service-worker.js", { scope: "/" })
      .catch(function (err) {
        // Swallow — SW failure shouldn't break the page. Logged for diagnosis.
        console.warn("Service worker registration failed:", err);
      });
  });
})();
