// "Add to home screen" prompt. Native banner on Chrome/Edge via the
// beforeinstallprompt event; instructional banner on iOS Safari (which
// has no programmatic install API).

(function () {
  var STORAGE_KEY = "pzt_install_prompt_dismissed";
  var DISMISS_DAYS = 30;

  function dismissedRecently() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      var ts = parseInt(raw, 10);
      if (!ts) return false;
      return Date.now() - ts < DISMISS_DAYS * 86400000;
    } catch (e) {
      return false;
    }
  }

  function recordDismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch (e) {
      /* private mode etc. */
    }
  }

  function isStandalone() {
    if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) {
      return true;
    }
    return window.navigator.standalone === true;
  }

  function isIosSafari() {
    var ua = window.navigator.userAgent;
    var iOS = /iPhone|iPad|iPod/.test(ua) && !window.MSStream;
    var webkit = /WebKit/.test(ua);
    var notChrome = !/CriOS|FxiOS|EdgiOS/.test(ua);
    return iOS && webkit && notChrome;
  }

  function buildBanner(html) {
    var el = document.createElement("div");
    el.id = "pzt-install-banner";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "Zainstaluj aplikację");
    el.innerHTML = html;
    document.body.appendChild(el);
    return el;
  }

  function bindClose(banner) {
    var close = banner.querySelector(".pzt-install-close");
    if (close) {
      close.addEventListener("click", function () {
        recordDismiss();
        banner.remove();
      });
    }
  }

  // ---- Native (Chrome / Edge / Android Chrome) ----
  var deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    if (isStandalone() || dismissedRecently()) {
      return;
    }
    e.preventDefault();
    deferredPrompt = e;
    showNativeBanner();
  });

  function showNativeBanner() {
    if (document.getElementById("pzt-install-banner")) return;
    var banner = buildBanner(
      '<div class="pzt-install-text">' +
        "<strong>Zainstaluj aplikację</strong> — szybsze otwieranie, " +
        "działa bez internetu." +
        "</div>" +
        '<button type="button" class="pzt-install-action">Zainstaluj</button>' +
        '<button type="button" class="pzt-install-close" aria-label="Zamknij">×</button>'
    );
    bindClose(banner);
    var action = banner.querySelector(".pzt-install-action");
    action.addEventListener("click", function () {
      if (!deferredPrompt) {
        banner.remove();
        return;
      }
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(function () {
        deferredPrompt = null;
        banner.remove();
        // Mark dismissed regardless of choice — we don't want to re-prompt.
        recordDismiss();
      });
    });
  }

  // ---- iOS Safari (no native API) ----
  function showIosBanner() {
    if (document.getElementById("pzt-install-banner")) return;
    var banner = buildBanner(
      '<div class="pzt-install-text">' +
        "Zainstaluj jako aplikację: dotknij " +
        '<span class="pzt-install-share" aria-hidden="true"></span>' +
        ' <strong>Udostępnij</strong>, a potem <strong>Dodaj do ekranu początkowego</strong>.' +
        "</div>" +
        '<button type="button" class="pzt-install-close" aria-label="Zamknij">×</button>'
    );
    bindClose(banner);
  }

  if (isIosSafari() && !isStandalone() && !dismissedRecently()) {
    // Wait until DOM is ready and slightly past initial paint so the
    // banner doesn't compete with first-load layout.
    var schedule = function () {
      setTimeout(showIosBanner, 1200);
    };
    if (document.readyState === "complete") {
      schedule();
    } else {
      window.addEventListener("load", schedule);
    }
  }
})();
