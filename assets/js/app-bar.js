// app-bar.js — scroll-aware app bar (PR3)
// Hides on scroll-down past 100px, shows on scroll-up.
(function () {
  function init() {
    var bar = document.getElementById('pzt-app-bar');
    if (!bar) return;

    var lastY = window.scrollY || window.pageYOffset || 0;
    var ticking = false;
    var THRESHOLD = 100;

    function onScroll() {
      var y = window.scrollY || window.pageYOffset || 0;
      var dy = y - lastY;

      // Always show near top
      if (y < THRESHOLD) {
        bar.classList.remove('is-hidden');
      } else if (Math.abs(dy) > 4) {
        if (dy > 0) {
          bar.classList.add('is-hidden');
        } else {
          bar.classList.remove('is-hidden');
        }
      }
      lastY = y;
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (!ticking) {
        window.requestAnimationFrame(onScroll);
        ticking = true;
      }
    }, { passive: true });

    // Bottom-nav menu button reuses the existing drawer
    var bnMenu = document.getElementById('pzt-bn-menu');
    var drawer = document.getElementById('pzt-nav-drawer');
    if (bnMenu && drawer) {
      bnMenu.addEventListener('click', function () {
        var open = drawer.classList.toggle('open');
        if (open) {
          drawer.removeAttribute('hidden');
          bnMenu.setAttribute('aria-expanded', 'true');
        } else {
          drawer.setAttribute('hidden', '');
          bnMenu.setAttribute('aria-expanded', 'false');
        }
      });
    }

    // Bottom-nav theme toggle reuses theme.js helper
    var bnTheme = document.getElementById('pzt-bn-theme');
    if (bnTheme) {
      bnTheme.addEventListener('click', function () {
        if (window.PZT && typeof window.PZT.toggleTheme === 'function') {
          window.PZT.toggleTheme();
        }
        syncBnThemeIcons();
      });
    }
    syncBnThemeIcons();

    // Mark the active bottom-nav route
    var path = location.pathname.replace(/\/+$/, '/') || '/';
    document.querySelectorAll('.bottom-nav a.bn-item').forEach(function (a) {
      var href = a.getAttribute('href');
      if (!href) return;
      if (href === path) a.classList.add('is-active');
    });
  }

  function syncBnThemeIcons() {
    var sun = document.querySelector('#pzt-bn-theme .bn-icon-sun');
    var moon = document.querySelector('#pzt-bn-theme .bn-icon-moon');
    if (!sun || !moon) return;
    var dark = document.documentElement.classList.contains('dark');
    sun.style.display = dark ? 'none' : '';
    moon.style.display = dark ? '' : 'none';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
