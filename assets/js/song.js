// Song page: chord transposition + show/hide chords. Vanilla, no jQuery.
(function () {
  var GadgetState = { CHORDS_ON: 0, CHORDS_OFF: 2 };
  var state = GadgetState.CHORDS_ON;
  var transposition = 0;

  function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function setDisabled(sel, disabled) {
    $$(sel).forEach(function (el) {
      if (disabled) {
        el.setAttribute('disabled', '');
      } else {
        el.removeAttribute('disabled');
      }
    });
  }

  function setActive(sel, active) {
    $$(sel).forEach(function (el) {
      if (active) {
        el.classList.add('btn-primary');
        el.classList.remove('btn-secondary');
      } else {
        el.classList.add('btn-secondary');
        el.classList.remove('btn-primary');
      }
    });
  }

  function applyState() {
    setActive('.chords-trigger', false);
    if (state === GadgetState.CHORDS_ON) {
      $$('.chord-section, .chords').forEach(function (el) {
        el.style.display = '';
      });
      setActive('.chords-normal-trigger', true);
      setDisabled('.trans-up-trigger, .trans-home-trigger, .trans-down-trigger', false);
    } else if (state === GadgetState.CHORDS_OFF) {
      $$('.chord-section, .chords').forEach(function (el) {
        el.style.display = 'none';
      });
      setActive('.chords-none-trigger', true);
      setDisabled('.trans-up-trigger, .trans-home-trigger, .trans-down-trigger', true);
    }
  }

  function transpose() {
    for (var i = 0; i <= 11; i++) {
      $$('.chords-t' + i).forEach(function (el) { el.style.display = 'none'; });
    }
    $$('.chords-t' + transposition).forEach(function (el) { el.style.display = ''; });
    applyState();
  }

  function bind() {
    $$('.chords-normal-trigger').forEach(function (b) {
      b.addEventListener('click', function () { state = GadgetState.CHORDS_ON; applyState(); });
    });
    $$('.chords-none-trigger').forEach(function (b) {
      b.addEventListener('click', function () { state = GadgetState.CHORDS_OFF; applyState(); });
    });
    $$('.trans-up-trigger').forEach(function (b) {
      b.addEventListener('click', function () {
        transposition = (transposition + 1) % 12; transpose();
      });
    });
    $$('.trans-home-trigger').forEach(function (b) {
      b.addEventListener('click', function () { transposition = 0; transpose(); });
    });
    $$('.trans-down-trigger').forEach(function (b) {
      b.addEventListener('click', function () {
        transposition = (transposition + 11) % 12; transpose();
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
