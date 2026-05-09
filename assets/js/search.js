// search.js — Pagefind-backed command palette (PR3)
//
// Behavior:
//   - Opens on Cmd+K / Ctrl+K, on `/` (when not typing in another input),
//     and on click of any [data-pzt-search-trigger] element.
//   - Loads Pagefind lazily on first open via dynamic import('/_pagefind/pagefind.js').
//   - Debounced search (180ms). Renders up to 10 results.
//   - Keyboard: ArrowUp / ArrowDown to navigate, Enter to open, Escape to close.
//   - Empty input shows recent searches from localStorage (max 6).
//   - On `/szukaj/` page: auto-opens palette and prevents closing without nav.

(function () {
  'use strict';

  var PALETTE_ID = 'pzt-palette';
  var INPUT_ID = 'pzt-palette-input';
  var RESULTS_ID = 'pzt-palette-results';
  var TRIGGER_SELECTOR = '[data-pzt-search-trigger]';
  var STORAGE_KEY = 'pzt-recent-searches';
  var MAX_RECENT = 6;
  var MAX_RESULTS = 10;
  var DEBOUNCE_MS = 180;

  var pagefindPromise = null;
  var palette = null;
  var input = null;
  var resultsEl = null;
  var debounceTimer = null;
  var activeIndex = -1;
  var lastQuery = '';
  var currentResults = []; // [{url, title, excerpt}]
  var lastFocus = null;
  var requestId = 0;

  function $(id) {
    return document.getElementById(id);
  }

  function getRecent() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.slice(0, MAX_RECENT) : [];
    } catch (e) { return []; }
  }

  function pushRecent(q) {
    if (!q) return;
    try {
      var arr = getRecent().filter(function (x) { return x !== q; });
      arr.unshift(q);
      if (arr.length > MAX_RECENT) arr.length = MAX_RECENT;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch (e) {}
  }

  function loadPagefind() {
    if (pagefindPromise) return pagefindPromise;
    // Dynamic import — only requested on first open. Pagefind ships its own wasm.
    pagefindPromise = import('/_pagefind/pagefind.js').then(function (mod) {
      if (mod && typeof mod.options === 'function') {
        // tells Pagefind where to find the rest of the bundle
        return Promise.resolve(mod.options({ baseUrl: '/' })).then(function () { return mod; });
      }
      return mod;
    }).catch(function (err) {
      console.warn('[pzt-search] Pagefind failed to load', err);
      pagefindPromise = null; // allow retry
      throw err;
    });
    return pagefindPromise;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function renderEmpty() {
    var recent = getRecent();
    if (!recent.length) {
      resultsEl.innerHTML =
        '<div class="pzt-palette-empty">Wpisz tytuł piosenki, autora lub fragment tekstu.</div>';
      currentResults = [];
      activeIndex = -1;
      return;
    }
    var html = '<div class="pzt-palette-section-title">Ostatnie</div>';
    html += recent.map(function (q, i) {
      return (
        '<a class="pzt-palette-result" href="#" data-recent="' + escapeHtml(q) +
        '" data-idx="' + i + '" role="option">' +
        '<div class="pzt-palette-result-title">' + escapeHtml(q) + '</div>' +
        '</a>'
      );
    }).join('');
    resultsEl.innerHTML = html;
    currentResults = recent.map(function (q) { return { recent: true, query: q }; });
    activeIndex = recent.length ? 0 : -1;
    updateActive();
  }

  function renderResults(items) {
    if (!items.length) {
      resultsEl.innerHTML = '<div class="pzt-palette-empty">Brak wyników.</div>';
      currentResults = [];
      activeIndex = -1;
      return;
    }
    var html = items.map(function (it, i) {
      var url = it.url || '';
      var title = escapeHtml(it.title || url);
      var excerpt = it.excerpt || ''; // Pagefind already returns highlighted HTML with <mark>
      return (
        '<a class="pzt-palette-result" href="' + escapeHtml(url) + '" data-idx="' + i + '" role="option">' +
        '<div class="pzt-palette-result-title">' + title + '</div>' +
        (excerpt ? '<div class="pzt-palette-result-excerpt">' + excerpt + '</div>' : '') +
        '<div class="pzt-palette-result-url">' + escapeHtml(url) + '</div>' +
        '</a>'
      );
    }).join('');
    resultsEl.innerHTML = html;
    currentResults = items;
    activeIndex = items.length ? 0 : -1;
    updateActive();
  }

  function renderLoading() {
    resultsEl.innerHTML = '<div class="pzt-palette-empty">Szukanie…</div>';
  }

  function updateActive() {
    var nodes = resultsEl.querySelectorAll('.pzt-palette-result');
    nodes.forEach(function (n, i) {
      if (i === activeIndex) {
        n.classList.add('is-active');
        n.setAttribute('aria-selected', 'true');
        // keep within scroll
        var top = n.offsetTop;
        var bot = top + n.offsetHeight;
        if (top < resultsEl.scrollTop) resultsEl.scrollTop = top;
        else if (bot > resultsEl.scrollTop + resultsEl.clientHeight) {
          resultsEl.scrollTop = bot - resultsEl.clientHeight;
        }
      } else {
        n.classList.remove('is-active');
        n.removeAttribute('aria-selected');
      }
    });
  }

  function runSearch(q) {
    var rid = ++requestId;
    if (!q) {
      renderEmpty();
      return;
    }
    renderLoading();
    loadPagefind().then(function (pf) {
      return pf.search(q);
    }).then(function (search) {
      if (rid !== requestId) return; // stale
      if (!search || !search.results) {
        renderResults([]);
        return;
      }
      var slice = search.results.slice(0, MAX_RESULTS);
      // Each result's data() is async — load all in parallel
      return Promise.all(slice.map(function (r) { return r.data(); })).then(function (datas) {
        if (rid !== requestId) return;
        var items = datas.map(function (d) {
          return {
            url: d.url || d.raw_url || '',
            title: (d.meta && d.meta.title) || d.url || 'Wynik',
            excerpt: d.excerpt || ''
          };
        });
        renderResults(items);
      });
    }).catch(function (err) {
      if (rid !== requestId) return;
      console.warn('[pzt-search] search error', err);
      resultsEl.innerHTML =
        '<div class="pzt-palette-empty">Błąd wyszukiwania. Sprawdź połączenie.</div>';
    });
  }

  function onInput() {
    var q = (input.value || '').trim();
    lastQuery = q;
    clearTimeout(debounceTimer);
    if (!q) {
      renderEmpty();
      return;
    }
    debounceTimer = setTimeout(function () { runSearch(q); }, DEBOUNCE_MS);
  }

  function openItem(item) {
    if (!item) return;
    if (item.recent) {
      input.value = item.query;
      onInput();
      input.focus();
      return;
    }
    if (item.url) {
      pushRecent(lastQuery);
      // close palette so back-button works as expected
      close();
      window.location.href = item.url;
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!currentResults.length) return;
      activeIndex = (activeIndex + 1) % currentResults.length;
      updateActive();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!currentResults.length) return;
      activeIndex = (activeIndex - 1 + currentResults.length) % currentResults.length;
      updateActive();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && currentResults[activeIndex]) {
        openItem(currentResults[activeIndex]);
      } else if (lastQuery) {
        // No selection — submit search
        runSearch(lastQuery);
      }
      return;
    }
  }

  function open() {
    if (!palette) return;
    if (!palette.hasAttribute('hidden')) return;
    lastFocus = document.activeElement;
    palette.removeAttribute('hidden');
    document.body.classList.add('pzt-palette-open');
    setTimeout(function () {
      input.focus();
      input.select();
    }, 0);
    // Prime Pagefind in background
    loadPagefind().catch(function () {});
    if (!input.value) renderEmpty();
  }

  function close() {
    if (!palette || palette.hasAttribute('hidden')) return;
    palette.setAttribute('hidden', '');
    document.body.classList.remove('pzt-palette-open');
    if (lastFocus && typeof lastFocus.focus === 'function') {
      try { lastFocus.focus(); } catch (e) {}
    }
  }

  function isTypingTarget(el) {
    if (!el) return false;
    var tag = (el.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  function bindGlobal() {
    document.addEventListener('keydown', function (e) {
      // Cmd+K / Ctrl+K
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        open();
        return;
      }
      // `/` when not typing
      if (e.key === '/' && !isTypingTarget(e.target) && palette && palette.hasAttribute('hidden')) {
        e.preventDefault();
        open();
        return;
      }
    });

    document.addEventListener('click', function (e) {
      var trigger = e.target.closest && e.target.closest(TRIGGER_SELECTOR);
      if (trigger) {
        e.preventDefault();
        open();
      }
    });
  }

  function bindPalette() {
    input.addEventListener('input', onInput);
    input.addEventListener('keydown', onKeyDown);

    // Close on backdrop click or any element marked data-pzt-palette-close
    palette.addEventListener('click', function (e) {
      var t = e.target;
      if (t.matches && (t.matches('[data-pzt-palette-close]') || t.matches('.pzt-palette-backdrop'))) {
        close();
      }
    });

    // Click on a result row
    resultsEl.addEventListener('click', function (e) {
      var row = e.target.closest && e.target.closest('.pzt-palette-result');
      if (!row) return;
      e.preventDefault();
      var idx = parseInt(row.getAttribute('data-idx') || '-1', 10);
      if (idx >= 0 && currentResults[idx]) openItem(currentResults[idx]);
    });

    // Hover sync
    resultsEl.addEventListener('mousemove', function (e) {
      var row = e.target.closest && e.target.closest('.pzt-palette-result');
      if (!row) return;
      var idx = parseInt(row.getAttribute('data-idx') || '-1', 10);
      if (idx >= 0 && idx !== activeIndex) {
        activeIndex = idx;
        updateActive();
      }
    });
  }

  function init() {
    palette = $(PALETTE_ID);
    input = $(INPUT_ID);
    resultsEl = $(RESULTS_ID);
    if (!palette || !input || !resultsEl) return;

    bindPalette();
    bindGlobal();

    // /szukaj/ page: auto-open the palette so direct URLs work
    var path = location.pathname.replace(/\/+$/, '/');
    if (path === '/szukaj/') {
      // open after first paint
      setTimeout(open, 50);
    }

    // expose minimal API for debugging
    window.PZT = window.PZT || {};
    window.PZT.openSearch = open;
    window.PZT.closeSearch = close;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
