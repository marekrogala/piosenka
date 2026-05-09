// comments.js: render the latest Disqus comments for the homepage.
// Vanilla, no jQuery.
(function () {
  var MAX_LENGTH = 200;
  var URL = 'https://disqus.com/api/3.0/forums/listPosts.json'
    + '?forum=piosenka&limit=5&related=thread'
    + '&api_key=iAruOUIdDbkbz8yMfYkDqbfPCjc2vclRu7tnSOoCr6cbYC4TiBmDrVyxpQb0yBFM';

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function init() {
    var container = document.getElementById('last-comments');
    if (!container) return;

    fetch(URL)
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res || res.code !== 0 || !res.response) return;
        var html = '';
        for (var i = 0; i < res.response.length; i++) {
          var post = res.response[i];
          var raw = post.raw_message || '';
          var content = raw.length < MAX_LENGTH ? raw : raw.substring(0, MAX_LENGTH) + ' (...)';
          html += '<div class="comment">'
            + '<p class="content">' + escapeHtml(content) + '</p>'
            + '<p class="attribution"><b>' + escapeHtml(post.author && post.author.name || '') + '</b> – '
            + '<a href="' + escapeHtml(post.thread && post.thread.link || '#') + '">'
            + escapeHtml(post.thread && post.thread.title || '') + '</a></p>'
            + '</div>';
        }
        container.innerHTML = html;
      })
      .catch(function () { /* silently swallow network errors */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
