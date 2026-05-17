(function () {
  const q = document.querySelector('.lead-quote-disclosure');
  if (!q) return;
  const mq = window.matchMedia('(min-width: 768px)');
  function sync() { q.open = mq.matches; }
  sync();
  mq.addEventListener('change', sync);
})();
