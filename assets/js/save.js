// pzt-saved: localStorage-backed list of saved songs.
// Used by the chord-bar star toggle and the /zapisane/ page.
(function () {
  var KEY = 'pzt-saved';

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return [];
      var v = JSON.parse(raw);
      return Array.isArray(v) ? v : [];
    } catch (e) {
      return [];
    }
  }

  function write(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch (e) {}
  }

  function isSaved(slug) {
    return read().some(function (e) { return e && e.slug === slug; });
  }

  function toggle(entry) {
    var list = read();
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].slug === entry.slug) { idx = i; break; }
    }
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      list.unshift({
        slug: entry.slug,
        title: entry.title || entry.slug,
        artist: entry.artist || '',
        url: entry.url || ('/opracowanie/' + entry.slug + '/'),
        savedAt: new Date().toISOString(),
      });
    }
    write(list);
    return idx < 0; // true = now saved
  }

  // Bind every save toggle on the page.
  function bindToggles() {
    var btns = document.querySelectorAll('.save-toggle');
    Array.prototype.forEach.call(btns, function (btn) {
      var slug = btn.getAttribute('data-song-slug') || '';
      if (!slug) return;
      var saved = isSaved(slug);
      btn.setAttribute('aria-pressed', saved ? 'true' : 'false');
      if (saved) btn.classList.add('is-saved');
      btn.addEventListener('click', function () {
        var nowSaved = toggle({
          slug: slug,
          title: btn.getAttribute('data-song-title') || '',
          artist: btn.getAttribute('data-song-artist') || '',
          url: window.location.pathname,
        });
        btn.setAttribute('aria-pressed', nowSaved ? 'true' : 'false');
        btn.classList.toggle('is-saved', nowSaved);
      });
    });
  }

  // Render saved-list on /zapisane/ page.
  function renderSavedList() {
    var listEl = document.getElementById('pzt-saved-list');
    var emptyEl = document.getElementById('pzt-saved-empty');
    if (!listEl) return;
    var list = read();
    if (!list.length) {
      listEl.hidden = true;
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    listEl.hidden = false;
    if (emptyEl) emptyEl.hidden = true;
    listEl.innerHTML = list.map(function (e) {
      var url = e.url || ('/opracowanie/' + e.slug + '/');
      var title = e.title || e.slug || '';
      var artist = e.artist || '';
      return (
        '<a class="pzt-saved-card" href="' + url + '">' +
          '<span class="pzt-saved-card-title">' + escapeHtml(title) + '</span>' +
          (artist ? '<span class="pzt-saved-card-artist">' + escapeHtml(artist) + '</span>' : '') +
        '</a>'
      );
    }).join('');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Public API for other modules.
  window.PztSaved = { read: read, isSaved: isSaved, toggle: toggle };

  function init() {
    bindToggles();
    renderSavedList();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
