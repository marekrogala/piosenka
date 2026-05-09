// pzt-perf-mode: full-screen reading mode for the song page.
// - Toggled via .perf-mode-trigger in the chord-bar.
// - Hides chrome, bumps lyric type, requests Wake Lock.
// - Horizontal swipe / arrow keys / prev-next buttons navigate to neighboring songs.
// - Up-swipe / Esc / close button exits.
(function () {
  var dialog = null;
  var wakeLock = null;
  var touchStart = null;

  function $(sel, root) { return (root || document).querySelector(sel); }

  function syncStateToDialog() {
    // Mirror chord-bar state (transposition, chord visibility) into the dialog
    // by triggering the global song.js handlers via the buttons inside the dialog.
    // The song.js script already binds .trans-* and .chords-* buttons by class —
    // dialog buttons share those classes, so they Just Work.
  }

  function requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
      navigator.wakeLock.request('screen').then(function (sentinel) {
        wakeLock = sentinel;
        sentinel.addEventListener('release', function () { wakeLock = null; });
      }).catch(function () {});
    } catch (e) {}
  }

  function releaseWakeLock() {
    if (wakeLock) {
      try { wakeLock.release(); } catch (e) {}
      wakeLock = null;
    }
  }

  function open() {
    if (!dialog) return;
    document.documentElement.classList.add('perf-mode');
    if (typeof dialog.showModal === 'function') {
      try { dialog.showModal(); } catch (e) { dialog.setAttribute('open', ''); }
    } else {
      dialog.setAttribute('open', '');
    }
    // Best-effort fullscreen.
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(function () {});
      }
    } catch (e) {}
    requestWakeLock();
    syncStateToDialog();
  }

  function close() {
    if (!dialog) return;
    document.documentElement.classList.remove('perf-mode');
    if (typeof dialog.close === 'function') {
      try { dialog.close(); } catch (e) { dialog.removeAttribute('open'); }
    } else {
      dialog.removeAttribute('open');
    }
    if (document.fullscreenElement && document.exitFullscreen) {
      try { document.exitFullscreen().catch(function () {}); } catch (e) {}
    }
    releaseWakeLock();
  }

  function navigateTo(url) {
    if (!url) return;
    window.location.href = url;
  }

  function getNeighborUrls() {
    var bar = document.getElementById('pzt-chord-bar');
    return {
      prev: bar ? bar.getAttribute('data-prev-song-url') : null,
      next: bar ? bar.getAttribute('data-next-song-url') : null,
    };
  }

  function bindSwipe() {
    if (!dialog) return;
    var inner = dialog.querySelector('.pzt-perf-inner') || dialog;
    inner.addEventListener('touchstart', function (e) {
      if (!e.touches || !e.touches.length) return;
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
    }, { passive: true });
    inner.addEventListener('touchend', function (e) {
      if (!touchStart || !e.changedTouches || !e.changedTouches.length) {
        touchStart = null; return;
      }
      var t = e.changedTouches[0];
      var dx = t.clientX - touchStart.x;
      var dy = t.clientY - touchStart.y;
      var adx = Math.abs(dx); var ady = Math.abs(dy);
      var dt = Date.now() - touchStart.t;
      touchStart = null;
      if (dt > 800) return;
      var n = getNeighborUrls();
      if (adx > 80 && adx > ady) {
        if (dx < 0) navigateTo(n.next); else navigateTo(n.prev);
      } else if (ady > 80 && ady > adx && dy < 0) {
        // up-swipe to exit
        close();
      }
    }, { passive: true });
  }

  function bindKeys() {
    document.addEventListener('keydown', function (e) {
      if (!document.documentElement.classList.contains('perf-mode')) return;
      var n = getNeighborUrls();
      if (e.key === 'ArrowRight') { e.preventDefault(); navigateTo(n.next); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); navigateTo(n.prev); }
      // Esc handled natively by <dialog>.
    });
  }

  function init() {
    dialog = document.getElementById('pzt-perf-mode');
    if (!dialog) return;

    var triggers = document.querySelectorAll('.perf-mode-trigger');
    Array.prototype.forEach.call(triggers, function (b) {
      b.addEventListener('click', open);
    });

    var closers = dialog.querySelectorAll('.perf-close-trigger');
    Array.prototype.forEach.call(closers, function (b) {
      b.addEventListener('click', close);
    });

    var prevBtns = dialog.querySelectorAll('.perf-prev-trigger');
    Array.prototype.forEach.call(prevBtns, function (b) {
      b.addEventListener('click', function () { navigateTo(getNeighborUrls().prev); });
    });
    var nextBtns = dialog.querySelectorAll('.perf-next-trigger');
    Array.prototype.forEach.call(nextBtns, function (b) {
      b.addEventListener('click', function () { navigateTo(getNeighborUrls().next); });
    });

    // Disable prev/next buttons when no neighbor.
    var n = getNeighborUrls();
    Array.prototype.forEach.call(prevBtns, function (b) { if (!n.prev) b.disabled = true; });
    Array.prototype.forEach.call(nextBtns, function (b) { if (!n.next) b.disabled = true; });

    dialog.addEventListener('close', function () {
      document.documentElement.classList.remove('perf-mode');
      releaseWakeLock();
    });

    // Re-acquire wake lock on visibility regain.
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && document.documentElement.classList.contains('perf-mode')) {
        requestWakeLock();
      }
    });

    bindSwipe();
    bindKeys();

    // Auto-open via ?perf=1 (used for screenshots / deep links).
    try {
      var sp = new URLSearchParams(window.location.search);
      if (sp.get('perf') === '1') open();
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
