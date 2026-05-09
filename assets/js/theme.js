// theme.js: light/dark theme handling. Vanilla, no jQuery.
// The pre-flicker bootstrap in <head> already sets `class="dark"` on <html>
// from localStorage / prefers-color-scheme. This file:
//   - keeps the toggle button icon in sync (sun ↔ moon)
//   - exposes window.PZT.toggleTheme() for the toggle button
//   - reacts to OS-level theme changes when the user has not pinned a preference
(function () {
  var STORAGE_KEY = 'pzt-theme';
  var root = document.documentElement;

  function isDark() {
    return root.classList.contains('dark');
  }

  function syncIcons() {
    var sun = document.querySelector('#pzt-theme-toggle .icon-sun');
    var moon = document.querySelector('#pzt-theme-toggle .icon-moon');
    if (!sun || !moon) return;
    if (isDark()) {
      sun.style.display = 'none';
      moon.style.display = '';
    } else {
      sun.style.display = '';
      moon.style.display = 'none';
    }
  }

  function setTheme(mode) {
    if (mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try { localStorage.setItem(STORAGE_KEY, mode); } catch (e) {}
    syncIcons();
  }

  function toggleTheme() {
    setTheme(isDark() ? 'light' : 'dark');
  }

  function init() {
    syncIcons();
    var btn = document.getElementById('pzt-theme-toggle');
    if (btn) {
      btn.addEventListener('click', toggleTheme);
    }
    // React to OS theme flips only when the user has no stored preference.
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var listener = function (e) {
        var stored = null;
        try { stored = localStorage.getItem(STORAGE_KEY); } catch (err) {}
        if (stored) return;
        if (e.matches) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
        syncIcons();
      };
      if (mq.addEventListener) {
        mq.addEventListener('change', listener);
      } else if (mq.addListener) {
        mq.addListener(listener);
      }
    }
  }

  window.PZT = window.PZT || {};
  window.PZT.toggleTheme = toggleTheme;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
