// Service worker registration + update flow.
//
// On registration we watch for a newly-installed SW that's waiting to
// take over. When that happens (and a previous SW was already in
// control of the page, i.e. this isn't a first-time install) we show
// a small toast: "new version, refresh". Click → tell the waiting SW
// to skipWaiting, then reload the page when it claims control.

(function () {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  // Don't fight the dev server.
  var loc = window.location;
  if (loc.port === "8000" && loc.hostname === "localhost") {
    return;
  }

  function showUpdateToast(reg) {
    if (document.getElementById("pzt-update-toast")) {
      return;
    }
    var toast = document.createElement("div");
    toast.id = "pzt-update-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.innerHTML =
      '<div class="pzt-update-text">Nowa wersja jest dostępna.</div>' +
      '<button type="button" class="pzt-update-action">Odśwież</button>' +
      '<button type="button" class="pzt-update-close" aria-label="Zamknij">×</button>';
    document.body.appendChild(toast);

    var closing = false;
    function close() {
      if (closing) return;
      closing = true;
      toast.remove();
    }

    toast.querySelector(".pzt-update-close").addEventListener("click", close);
    toast.querySelector(".pzt-update-action").addEventListener("click", function () {
      if (!reg.waiting) {
        // Race: SW already activated. Just reload.
        window.location.reload();
        return;
      }
      // Reload as soon as the new SW takes control.
      var refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", function () {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
    });
  }

  function trackInstalling(reg, worker) {
    worker.addEventListener("statechange", function () {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        showUpdateToast(reg);
      }
    });
  }

  window.addEventListener("load", function () {
    navigator.serviceWorker
      .register("/service-worker.js", { scope: "/" })
      .then(function (reg) {
        // A worker was already waiting from a previous tab/visit.
        if (reg.waiting && navigator.serviceWorker.controller) {
          showUpdateToast(reg);
        }
        // A new worker started installing right now (or will).
        if (reg.installing) {
          trackInstalling(reg, reg.installing);
        }
        reg.addEventListener("updatefound", function () {
          if (reg.installing) {
            trackInstalling(reg, reg.installing);
          }
        });
      })
      .catch(function (err) {
        // SW failure shouldn't break the page. Logged for diagnosis.
        console.warn("Service worker registration failed:", err);
      });
  });
})();
