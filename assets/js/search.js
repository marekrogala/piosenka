$(document).ready(function(){
    var songs = new Bloodhound({
        datumTokenizer: Bloodhound.tokenizers.obj.nonword('value'),
        queryTokenizer: Bloodhound.tokenizers.nonword,
        prefetch: '/index/songs.json',
        limit: 10,
    });
    songs.initialize();

    // Prefer exact matches, so that "Ja" returns the song "Ja" before "Był Jazz"
    // See https://github.com/twitter/typeahead.js/issues/817 .
    // When the user has opted into the songbook view, also float their saved
    // songs above the rest within each match tier.
    var orig_get = songs.get;
    songs.get = function (query, cb) {
        return orig_get.apply( songs, [query, function (suggestions) {
            if ( !suggestions ) return cb(suggestions);
            var SB = window.Songbook;
            var boostSongbook = !!(SB && SB.getPreference("view") === "songbook");
            suggestions.forEach(function(s) {
                s.exact_match = query.toLowerCase() === s.name.toLowerCase()? 1: 0;
                s.song_slug = (s.url || "").replace(/^\/opracowanie\//, "").replace(/\/$/, "");
                s.in_songbook = SB && SB.has(s.song_slug) ? 1 : 0;
            });
            suggestions.sort(function(a, b) {
                if (a.exact_match !== b.exact_match) return b.exact_match - a.exact_match;
                if (boostSongbook && a.in_songbook !== b.in_songbook) return b.in_songbook - a.in_songbook;
                return 0;
            });
            cb(suggestions);
        } ]);
    };

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function songSuggestionTemplate(data) {
        var heart = data.in_songbook
            ? '<span class="songbook-suggestion__heart" aria-label="W moim śpiewniku">&#9829;</span>'
            : '';
        return '<div class="songbook-suggestion' +
            (data.in_songbook ? ' songbook-suggestion--in' : '') +
            '">' + heart +
            '<span class="songbook-suggestion__title">' + escapeHtml(data.name) + '</span>' +
            '</div>';
    }

    var artists = new Bloodhound({
        datumTokenizer: Bloodhound.tokenizers.obj.nonword('value'),
        queryTokenizer: Bloodhound.tokenizers.nonword,
        prefetch: '/index/artists.json',
    });
    artists.initialize();

    var selected = false;

    $('.search input').typeahead({
        hint: false,
        highlight: false,
    }, {
        name: 'songs',
        source: songs.ttAdapter(),
        templates: {
            header: '<p class="dataset-header">Piosenki</p>',
            suggestion: songSuggestionTemplate,
        }
    }, {
        name: 'artists',
        source: artists.ttAdapter(),
        templates: {
            header: '<p class="dataset-header">Artyści</p>',
        },
    }).on('typeahead:selected', function($e, data) {
      window.location = data.url;
      selected = true;
    }).on( "keydown", function(event) {
      if(event.which == 13 && !selected) {
        window.location = '/szukaj/?q=' + encodeURIComponent(this.value);
      }
    });
});
