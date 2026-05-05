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

  function applyView() {
    var view = Songbook.getPreference("view") || "all";
    document.documentElement.classList.toggle(
      "view-songbook",
      view === "songbook"
    );
    var toggles = document.querySelectorAll("[data-songbook-view-toggle]");
    Array.prototype.forEach.call(toggles, function (btn) {
      btn.setAttribute("aria-checked", view === "songbook" ? "true" : "false");
    });
    refreshArtistMenuStates();
  }

  function wireViewToggle() {
    var toggles = document.querySelectorAll("[data-songbook-view-toggle]");
    Array.prototype.forEach.call(toggles, function (btn) {
      btn.addEventListener("click", function () {
        var current = Songbook.getPreference("view") || "all";
        Songbook.setPreference(
          "view",
          current === "songbook" ? "all" : "songbook"
        );
      });
    });
  }

  function refreshArtistMenuStates() {
    // Artist menu items carry data-songbook-artist-item with a slug. JS marks
    // each one as in-songbook based on the precomputed artist→songs map that
    // the songbook index page embeds inline.
    var data = window.SongbookArtistSongs;
    if (!data) {
      var node = document.getElementById("songbook-artist-songs-data");
      if (node) {
        try {
          data = JSON.parse(node.textContent);
          window.SongbookArtistSongs = data;
        } catch (e) {
          data = null;
        }
      }
    }
    if (!data) return;
    var items = document.querySelectorAll("[data-songbook-artist-item]");
    Array.prototype.forEach.call(items, function (item) {
      var slug = item.getAttribute("data-artist-slug");
      var songs = (slug && data[slug]) || [];
      var inCount = Songbook.countInBulk(songs);
      item.setAttribute("data-in-songbook", inCount > 0 ? "true" : "false");
      item.setAttribute("data-in-count", String(inCount));
      var counter = item.querySelector("[data-songbook-artist-count]");
      if (counter) {
        counter.textContent = inCount > 0 ? inCount + "/" + songs.length : "";
      }
    });
  }

  // ===== Auto-switch + toast =====

  var TOAST_TIMEOUT_MS = 6000;
  var activeToast = null;

  function ensureToastHost() {
    var host = document.getElementById("songbook-toast-host");
    if (host) return host;
    host = document.createElement("div");
    host.id = "songbook-toast-host";
    host.className = "songbook-toast-host";
    host.setAttribute("aria-live", "polite");
    host.setAttribute("role", "status");
    document.body.appendChild(host);
    return host;
  }

  function showToast(message, action) {
    var host = ensureToastHost();
    host.innerHTML = "";
    var toast = document.createElement("div");
    toast.className = "songbook-toast";
    var msg = document.createElement("span");
    msg.className = "songbook-toast__message";
    msg.textContent = message;
    toast.appendChild(msg);
    if (action) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "songbook-toast__action";
      btn.textContent = action.label;
      btn.addEventListener("click", function () {
        action.onClick();
        host.innerHTML = "";
      });
      toast.appendChild(btn);
    }
    var dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = "songbook-toast__dismiss";
    dismiss.setAttribute("aria-label", "Zamknij");
    dismiss.innerHTML = "&times;";
    dismiss.addEventListener("click", function () {
      host.innerHTML = "";
    });
    toast.appendChild(dismiss);
    host.appendChild(toast);
    if (activeToast) clearTimeout(activeToast);
    activeToast = setTimeout(function () {
      if (host.firstChild === toast) host.innerHTML = "";
    }, TOAST_TIMEOUT_MS);
  }

  function maybeAutoSwitch(addedCount) {
    if (!addedCount) return;
    var view = Songbook.getPreference("view") || "all";
    var onboarded = !!Songbook.getPreference("onboarded");
    if (view === "songbook" || onboarded) return;
    Songbook.setPreference("view", "songbook");
    Songbook.setPreference("onboarded", true);
    var word = addedCount === 1 ? "piosenkę" : "piosenek";
    showToast(
      "Dodano " + addedCount + " " + word +
        ". Pokazuję teraz Twój śpiewnik na górze.",
      {
        label: "Cofnij",
        onClick: function () {
          Songbook.setPreference("view", "all");
        }
      }
    );
  }

  // ===== Settings page =====

  function setStatus(node, message, isError) {
    if (!node) return;
    node.textContent = message || "";
    node.classList.toggle("is-error", !!isError);
  }

  function refreshDump() {
    var node = document.querySelector("[data-songbook-dump]");
    if (!node) return;
    node.textContent = Songbook.exportJSON();
  }

  function refreshDefaultViewRadios() {
    var group = document.querySelector("[data-songbook-default-view]");
    if (!group) return;
    var current = Songbook.getPreference("view") || "all";
    var radios = group.querySelectorAll("input[type=radio]");
    Array.prototype.forEach.call(radios, function (radio) {
      radio.checked = radio.value === current;
    });
  }

  function wireSettings() {
    var settingsRoot = document.querySelector("[data-songbook-default-view]");
    if (settingsRoot) {
      refreshDefaultViewRadios();
      settingsRoot.addEventListener("change", function (event) {
        var target = event.target;
        if (target && target.name === "songbook-default-view") {
          Songbook.setPreference("view", target.value);
        }
      });
    }

    var exportBtn = document.querySelector("[data-songbook-export]");
    var exportStatus = document.querySelector("[data-songbook-export-status]");
    if (exportBtn) {
      exportBtn.addEventListener("click", function () {
        try {
          var blob = new Blob([Songbook.exportJSON()], {
            type: "application/json"
          });
          var url = URL.createObjectURL(blob);
          var ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
          var link = document.createElement("a");
          link.href = url;
          link.download = "moj-spiewnik-" + ts + ".json";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(function () {
            URL.revokeObjectURL(url);
          }, 0);
          setStatus(exportStatus, "Pobrano.");
        } catch (e) {
          setStatus(exportStatus, "Nie udało się pobrać.", true);
        }
      });
    }

    var importFile = document.querySelector("[data-songbook-import-file]");
    var importGo = document.querySelector("[data-songbook-import-go]");
    var importStatus = document.querySelector("[data-songbook-import-status]");
    if (importFile && importGo) {
      importFile.addEventListener("change", function () {
        importGo.disabled = !importFile.files || !importFile.files.length;
        setStatus(importStatus, "");
      });
      importGo.addEventListener("click", function () {
        if (!importFile.files || !importFile.files.length) return;
        var file = importFile.files[0];
        var reader = new FileReader();
        reader.onload = function () {
          var modeInput = document.querySelector(
            "input[name=songbook-import-mode]:checked"
          );
          var mode = modeInput ? modeInput.value : "merge";
          var result = Songbook.importJSON(reader.result, mode);
          if (result.ok) {
            setStatus(
              importStatus,
              "Wczytano " + result.count + " piosenek (" + mode + ")."
            );
            importFile.value = "";
            importGo.disabled = true;
          } else {
            setStatus(importStatus, result.error || "Błąd importu.", true);
          }
        };
        reader.onerror = function () {
          setStatus(importStatus, "Nie udało się odczytać pliku.", true);
        };
        reader.readAsText(file);
      });
    }

    var resetBtn = document.querySelector("[data-songbook-reset]");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        var ok = window.confirm(
          "Na pewno wyczyścić cały śpiewnik? Tej akcji nie da się cofnąć."
        );
        if (ok) Songbook.reset();
      });
    }

    refreshDump();
  }

  // ===== Onboarding tooltip (first artist-page visit) =====

  function maybeShowOnboarding() {
    if (Songbook.getPreference("onboarded")) return;
    var bar = document.querySelector("[data-songbook-bar]");
    if (!bar) return;
    if (document.querySelector(".songbook-onboarding")) return;
    var box = document.createElement("div");
    box.className = "songbook-onboarding";
    box.setAttribute("role", "note");
    box.innerHTML =
      '<span class="songbook-onboarding__message">' +
      'Tap rząd lub serce, żeby dodać piosenkę do swojego śpiewnika. ' +
      'Albo <b>Zaznacz wszystkie</b> naraz.' +
      '</span>' +
      '<button type="button" class="songbook-onboarding__dismiss" aria-label="Zamknij">&times;</button>';
    bar.parentNode.insertBefore(box, bar);
    var dismissBtn = box.querySelector(".songbook-onboarding__dismiss");
    var dismiss = function () {
      if (box.parentNode) box.parentNode.removeChild(box);
      Songbook.setPreference("onboarded", true);
    };
    dismissBtn.addEventListener("click", dismiss);
    bar.addEventListener("click", dismiss, { once: true });
    var firstHeart = document.querySelector("[data-songbook-row] [data-songbook-heart]");
    if (firstHeart) {
      firstHeart.addEventListener("click", dismiss, { once: true });
    }
  }

  ready(function () {
    applyView();
    refreshAllHearts();
    wireRows();
    wireBars();
    wireViewToggle();
    wireSettings();
    maybeShowOnboarding();
    Songbook.subscribe(function (event) {
      refreshAllHearts();
      var bars = document.querySelectorAll("[data-songbook-bar]");
      Array.prototype.forEach.call(bars, refreshBar);
      refreshArtistMenuStates();
      refreshDefaultViewRadios();
      refreshDump();
      if (event && event.type === "preference" && event.key === "view") {
        applyView();
      }
      if (event && event.type === "add") {
        maybeAutoSwitch(1);
      } else if (event && event.type === "bulk-add") {
        maybeAutoSwitch(event.slugs.length);
      }
    });
  });
})();
