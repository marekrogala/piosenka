(function () {
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.pzt-yt-placeholder');
    if (!btn) return;
    e.preventDefault();

    const id = btn.dataset.youtubeId;
    if (!id) return;

    const iframe = document.createElement('iframe');
    iframe.src = 'https://www.youtube.com/embed/' + encodeURIComponent(id) + '?autoplay=1&enablejsapi=1';
    iframe.className = 'pzt-max-width';
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
    iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    iframe.setAttribute('allowfullscreen', '');

    btn.replaceWith(iframe);
    document.dispatchEvent(new CustomEvent('pzt:youtube-loaded', { detail: { iframe: iframe } }));
  });
})();
