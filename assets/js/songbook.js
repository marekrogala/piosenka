// Local-only personal songbook. Uses localStorage. No backend, no tracking.
(function () {
  "use strict";

  var STORAGE_KEY = "mojaPiosenkaSongbook";
  var WRITE_DEBOUNCE_MS = 300;

  var defaultState = {
    version: 1,
    songs: [],
    preferences: { view: "all", onboarded: false }
  };

  var state = load();
  var subscribers = [];
  var writeTimer = null;

  function load() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return clone(defaultState);
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return clone(defaultState);
      return {
        version: parsed.version || 1,
        songs: Array.isArray(parsed.songs) ? parsed.songs.slice() : [],
        preferences: Object.assign(
          {},
          defaultState.preferences,
          parsed.preferences || {}
        )
      };
    } catch (e) {
      return clone(defaultState);
    }
  }

  function persist() {
    if (writeTimer) clearTimeout(writeTimer);
    writeTimer = setTimeout(function () {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        // Quota exceeded or storage disabled. Silently degrade — UI still works.
      }
    }, WRITE_DEBOUNCE_MS);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function asSet() {
    return new Set(state.songs);
  }

  function emit(event) {
    subscribers.forEach(function (cb) {
      try {
        cb(event);
      } catch (e) {
        // Subscriber threw. Don't break other subscribers.
      }
    });
  }

  var Songbook = {
    has: function (songSlug) {
      return state.songs.indexOf(songSlug) !== -1;
    },

    add: function (songSlug) {
      if (!songSlug || this.has(songSlug)) return false;
      state.songs.push(songSlug);
      persist();
      emit({ type: "add", slug: songSlug });
      return true;
    },

    remove: function (songSlug) {
      var idx = state.songs.indexOf(songSlug);
      if (idx === -1) return false;
      state.songs.splice(idx, 1);
      persist();
      emit({ type: "remove", slug: songSlug });
      return true;
    },

    toggle: function (songSlug) {
      return this.has(songSlug) ? !this.remove(songSlug) : this.add(songSlug);
    },

    addBulk: function (songSlugs) {
      var current = asSet();
      var added = [];
      songSlugs.forEach(function (slug) {
        if (slug && !current.has(slug)) {
          state.songs.push(slug);
          current.add(slug);
          added.push(slug);
        }
      });
      if (added.length) {
        persist();
        emit({ type: "bulk-add", slugs: added });
      }
      return added.length;
    },

    removeBulk: function (songSlugs) {
      var toRemove = new Set(songSlugs);
      var removed = [];
      state.songs = state.songs.filter(function (slug) {
        if (toRemove.has(slug)) {
          removed.push(slug);
          return false;
        }
        return true;
      });
      if (removed.length) {
        persist();
        emit({ type: "bulk-remove", slugs: removed });
      }
      return removed.length;
    },

    countInBulk: function (songSlugs) {
      var current = asSet();
      var n = 0;
      songSlugs.forEach(function (slug) {
        if (current.has(slug)) n++;
      });
      return n;
    },

    allSongs: function () {
      return state.songs.slice();
    },

    subscribe: function (callback) {
      subscribers.push(callback);
      return function () {
        var idx = subscribers.indexOf(callback);
        if (idx !== -1) subscribers.splice(idx, 1);
      };
    },

    getPreference: function (key) {
      return state.preferences[key];
    },

    setPreference: function (key, value) {
      if (state.preferences[key] === value) return;
      state.preferences[key] = value;
      persist();
      emit({ type: "preference", key: key, value: value });
    },

    exportJSON: function () {
      return JSON.stringify(state, null, 2);
    },

    importJSON: function (data, mode) {
      var parsed;
      try {
        parsed = typeof data === "string" ? JSON.parse(data) : data;
      } catch (e) {
        return { ok: false, error: "Niepoprawny JSON." };
      }
      if (!parsed || !Array.isArray(parsed.songs)) {
        return { ok: false, error: "Brakuje listy piosenek w pliku." };
      }
      if (mode === "merge") {
        this.addBulk(parsed.songs);
      } else {
        state.songs = parsed.songs.slice();
        if (parsed.preferences) {
          state.preferences = Object.assign(
            {},
            defaultState.preferences,
            parsed.preferences
          );
        }
        persist();
        emit({ type: "import" });
      }
      return { ok: true, count: parsed.songs.length };
    },

    reset: function () {
      state = clone(defaultState);
      persist();
      emit({ type: "reset" });
    }
  };

  window.Songbook = Songbook;

  // ===== DOM wiring =====

  function ready(callback) {
    if (document.readyState !== "loading") {
      callback();
    } else {
      document.addEventListener("DOMContentLoaded", callback);
    }
  }

  function setHeartState(button, isIn) {
    button.setAttribute("aria-pressed", isIn ? "true" : "false");
    var slug = button.getAttribute("data-song-slug");
    var verb = isIn ? "Usuń" : "Dodaj";
    var titleHint = button.getAttribute("data-song-title");
    if (titleHint) {
      button.setAttribute(
        "aria-label",
        verb + " „" + titleHint + "” " + (isIn ? "z mojego śpiewnika" : "do mojego śpiewnika")
      );
    } else {
      button.setAttribute(
        "aria-label",
        verb + (isIn ? " z mojego śpiewnika" : " do mojego śpiewnika")
      );
    }
    var label = button.querySelector(".song-heart-button__label");
    if (label) {
      label.textContent = isIn ? "W śpiewniku" : "Dodaj do śpiewnika";
    }
  }

  function setRowState(row, isIn) {
    row.setAttribute("data-in-songbook", isIn ? "true" : "false");
    var heart = row.querySelector("[data-songbook-heart]");
    if (heart) {
      heart.setAttribute("aria-pressed", isIn ? "true" : "false");
      var titleEl = row.querySelector(".song-row__title");
      var title = titleEl ? titleEl.textContent.trim() : "";
      var verb = isIn ? "Usuń" : "Dodaj";
      heart.setAttribute(
        "aria-label",
        verb + (title ? " „" + title + "”" : "") + (isIn ? " z mojego śpiewnika" : " do mojego śpiewnika")
      );
    }
  }

  function flash(element) {
    element.classList.remove("songbook-flash");
    // Force reflow so re-adding the class restarts the animation.
    void element.offsetWidth;
    element.classList.add("songbook-flash");
  }

  function refreshAllHearts() {
    var hearts = document.querySelectorAll("[data-songbook-heart]");
    Array.prototype.forEach.call(hearts, function (btn) {
      var slug = btn.getAttribute("data-song-slug");
      if (!slug) return;
      var isIn = Songbook.has(slug);
      if (btn.classList.contains("song-heart-button")) {
        setHeartState(btn, isIn);
      }
      var row = btn.closest("[data-songbook-row]");
      if (row) setRowState(row, isIn);
    });
  }

  function pageSongSlugs() {
    var rows = document.querySelectorAll("[data-songbook-row]");
    var slugs = [];
    Array.prototype.forEach.call(rows, function (row) {
      var slug = row.getAttribute("data-song-slug");
      if (slug) slugs.push(slug);
    });
    return slugs;
  }

  function refreshBar(bar) {
    var slugs = pageSongSlugs();
    var inCount = Songbook.countInBulk(slugs);
    var total = slugs.length;
    var counter = bar.querySelector("[data-songbook-counter]");
    if (counter) {
      counter.innerHTML =
        "W moim śpiewniku: <strong>" + inCount + "/" + total + "</strong>";
    }
    var addBtn = bar.querySelector("[data-songbook-bulk-add]");
    var removeBtn = bar.querySelector("[data-songbook-bulk-remove]");
    if (addBtn) addBtn.disabled = inCount === total;
    if (removeBtn) removeBtn.disabled = inCount === 0;
  }

  function wireRows() {
    document.addEventListener("click", function (event) {
      var heart = event.target.closest("[data-songbook-heart]");
      if (!heart) return;
      event.preventDefault();
      var slug = heart.getAttribute("data-song-slug");
      if (!slug) return;
      Songbook.toggle(slug);
    });
  }

  function wireBars() {
    var bars = document.querySelectorAll("[data-songbook-bar]");
    Array.prototype.forEach.call(bars, function (bar) {
      refreshBar(bar);
      var addBtn = bar.querySelector("[data-songbook-bulk-add]");
      var removeBtn = bar.querySelector("[data-songbook-bulk-remove]");
      if (addBtn) {
        addBtn.addEventListener("click", function () {
          var slugs = pageSongSlugs();
          var added = Songbook.addBulk(slugs);
          if (added) flash(bar);
        });
      }
      if (removeBtn) {
        removeBtn.addEventListener("click", function () {
          var slugs = pageSongSlugs();
          var removed = Songbook.removeBulk(slugs);
          if (removed) flash(bar);
        });
      }
    });
  }

  ready(function () {
    refreshAllHearts();
    wireRows();
    wireBars();
    Songbook.subscribe(function () {
      refreshAllHearts();
      var bars = document.querySelectorAll("[data-songbook-bar]");
      Array.prototype.forEach.call(bars, refreshBar);
    });
  });
})();
