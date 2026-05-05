// yt-lazy: replace YT placeholder with iframe on click.
(function () {
  function init() {
    var btns = document.querySelectorAll('.yt-embed-placeholder');
    Array.prototype.forEach.call(btns, function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-yt-id');
        if (!id) return;
        var titleEl = btn.querySelector('.yt-embed-title');
        var title = titleEl ? titleEl.textContent : 'YouTube';
        var wrap = document.createElement('div');
        wrap.className = 'yt-embed-frame';
        var iframe = document.createElement('iframe');
        iframe.src = 'https://www.youtube.com/embed/' + id + '?autoplay=1';
        iframe.title = title;
        iframe.setAttribute('allowfullscreen', '');
        iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
        iframe.setAttribute('loading', 'lazy');
        wrap.appendChild(iframe);
        btn.parentNode.replaceChild(wrap, btn);
      });
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
