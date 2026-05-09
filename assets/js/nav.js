// nav.js: mobile drawer toggle. Vanilla, no jQuery.
// Hooks the hamburger button (#pzt-nav-toggle) and toggles the drawer
// (#pzt-nav-drawer). ESC closes the drawer.
(function () {
  function init() {
    var toggle = document.getElementById('pzt-nav-toggle');
    var drawer = document.getElementById('pzt-nav-drawer');
    if (!toggle || !drawer) return;

    function isOpen() {
      return drawer.classList.contains('open');
    }

    function open() {
      drawer.classList.add('open');
      drawer.removeAttribute('hidden');
      toggle.setAttribute('aria-expanded', 'true');
    }

    function close() {
      drawer.classList.remove('open');
      drawer.setAttribute('hidden', '');
      toggle.setAttribute('aria-expanded', 'false');
    }

    toggle.addEventListener('click', function () {
      if (isOpen()) close(); else open();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) {
        close();
        toggle.focus();
      }
    });

    // Close drawer when a nav link is followed (helps with hash links).
    drawer.addEventListener('click', function (e) {
      var t = e.target;
      while (t && t !== drawer) {
        if (t.tagName === 'A') { close(); break; }
        t = t.parentNode;
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
