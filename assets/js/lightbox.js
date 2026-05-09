// lightbox.js: wires Luminous on .pzt-lightbox elements. Vanilla, no jQuery.
(function () {
  function init() {
    if (typeof Luminous === 'undefined') return;
    document.querySelectorAll('.pzt-lightbox').forEach(function (el) {
      new Luminous(el);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
