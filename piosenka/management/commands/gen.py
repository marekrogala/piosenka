import os
from datetime import datetime
import json

import yaml
from bs4 import BeautifulSoup
from django.conf import settings
from django.core.management.base import BaseCommand
from django.template import Context, Template, loader
from markdown2 import markdown
import re

from piosenka import lyrics
from piosenka import imageutils

PAGES = {
    "o-stronie": "page.html",
    "szukaj": "search.html",
}

ARTICLE_DIR = "artykuly"
BLOG_DIR = "blog"
SONGS_DIR = "opracowanie"
ARTISTS_DIR = "spiewnik"

CONTENT_DIR = "pages"
OUT_DIR = "out"

ROOT_PATH = os.path.abspath(os.path.join(__file__, "../../../.."))
OUT_DIR_PATH = os.path.join(ROOT_PATH, OUT_DIR)
CONTENT_PATH = os.path.join(ROOT_PATH, CONTENT_DIR)
ARTISTS_DIR_PATH = os.path.join(CONTENT_PATH, ARTISTS_DIR)


def parse_file(src_path):
    with open(src_path, "r") as file:
        lines = file.readlines()

        frontmatter, content = "".join(lines).split("---")[1:3]
        frontmatter_data = yaml.safe_load(frontmatter)

        if "pub_date" in frontmatter_data:
            frontmatter_data["pub_date"] = datetime.fromisoformat(
                frontmatter_data["pub_date"]
            )
        if "born_on" in frontmatter_data:
            frontmatter_data["born_on"] = datetime.fromisoformat(
                frontmatter_data["born_on"]
            ).date()
        if "died_on" in frontmatter_data:
            frontmatter_data["died_on"] = datetime.fromisoformat(
                frontmatter_data["died_on"]
            ).date()
        return (frontmatter_data, content)


CAPO_TO_ROMAN = [
    "",
    "I",
    "II",
    "III",
    "IV",
    "V",
    "VI",
    "VII",
    "VIII",
    "IX",
    "X",
    "XI",
    "XII",
]


def capo_to_roman(capo_fret):
    if capo_fret:
        return CAPO_TO_ROMAN[capo_fret]
    else:
        return None


def make_context_for_page(frontmatter_data, section=None):
    context_data = {
        "title": frontmatter_data.get("title"),
        "user_data": {"is_logged_in": False},
        "section": section,
        "cover_url": frontmatter_data.get("cover_image_thumb_600_300"),
        "pub_date": frontmatter_data.get("pub_date"),
        "author": frontmatter_data.get("author"),
        # Song-specific:
        "original_title": frontmatter_data.get("original_title"),
        "disambig": frontmatter_data.get("disambig"),
        "text_authors": frontmatter_data.get("text_authors"),
        "composers": frontmatter_data.get("composers"),
        "translators": frontmatter_data.get("translators"),
        "performers": frontmatter_data.get("performers"),
        "capo_fret": capo_to_roman(frontmatter_data.get("capo_fret")),
        "youtube_id": frontmatter_data.get("youtube_id"),
        "epigone": frontmatter_data.get("epigone"),
        # Note-specific:
        "url1": frontmatter_data.get("url1"),
        "url2": frontmatter_data.get("url2"),
        "ref1": frontmatter_data.get("ref1"),
        "ref2": frontmatter_data.get("ref2"),
        "ref2": frontmatter_data.get("ref2"),
        "image_full": frontmatter_data.get("image_full"),
        "image_thumb": frontmatter_data.get("image_thumb"),
        "score1_full": frontmatter_data.get("score1_full"),
        "score1_thumb": frontmatter_data.get("score1_thumb"),
        "score2_full": frontmatter_data.get("score2_full"),
        "score2_thumb": frontmatter_data.get("score2_thumb"),
        "score3_full": frontmatter_data.get("score3_full"),
        "score3_thumb": frontmatter_data.get("score3_thumb"),
        "image_src_url": frontmatter_data.get("image_src_url"),
        "image_author": frontmatter_data.get("image_author"),
        "image_license": frontmatter_data.get("image_license"),
        # Artist-specific:
        "name": frontmatter_data.get("name"),
        "featured": frontmatter_data.get("featured"),
        "category": frontmatter_data.get("category"),
        "born_on": frontmatter_data.get("born_on"),
        "died_on": frontmatter_data.get("died_on"),
        "filter_epigone": frontmatter_data.get("died_on"),
        # Article-specific:
        "lead": frontmatter_data.get("lead"),
    }

    if context_data["disambig"]:
        context_data["title"] += f" ({context_data['disambig']})"

    if "cover_credits" in frontmatter_data:
        cover_credits_html = markdown(frontmatter_data.get("cover_credits"))
        context_data["cover_credits_html"] = cover_credits_html

    return context_data


def add_lead(context, content_html, lead_max_len=200):
    # Extract text, removing all tags
    soup = BeautifulSoup(content_html, "html.parser")
    content_text = soup.get_text(separator=" ", strip=True)

    lead_html = content_text[:lead_max_len]
    read_more = False
    if len(content_text) > lead_max_len:
        last_space = lead_html.rfind(" ")
        if last_space != -1:
            lead_html = lead_html[:last_space]
        lead_html += "..."
        read_more = True

    context["lead_html"] = lead_html
    context["read_more"] = read_more


def write_page(context_data, template, out_file):
    template = loader.get_template(template)
    rendered_template = template.render(context_data)

    with open(out_file, "w") as f:
        f.write(rendered_template)


def make_artist_list(artists_by_slug, artist_slugs):
    ret = []
    if not artist_slugs:
        return ret

    for artist_slug in artist_slugs:
        assert artist_slug in artist_slugs
        artist = artists_by_slug[artist_slug]
        ret.append(artist)
    return ret


def generate_404_page():
    context = {
        "user_data": {"is_logged_in": False},
    }
    out_file_path = os.path.join(OUT_DIR_PATH, "404.html")
    write_page(context, "404.html", out_file_path)


def generate_saved_page():
    """Stub page for /zapisane/ — empty state today, populated by client-side JS later."""
    context = {}
    out_dir = os.path.join(OUT_DIR_PATH, "zapisane")
    os.makedirs(out_dir, exist_ok=True)
    out_file_path = os.path.join(out_dir, "index.html")
    write_page(context, "saved.html", out_file_path)


def generate_manifest():
    context = {
        "name": settings.MANIFEST_NAME,
        "short_name": settings.MANIFEST_SHORT_NAME,
        "description": settings.MANIFEST_DESCRIPTION,
        "lang": settings.MANIFEST_LANG,
        "theme_color": settings.MANIFEST_THEME_COLOR,
        "background_color": settings.MANIFEST_BACKGROUND_COLOR,
    }
    out_file_path = os.path.join(OUT_DIR_PATH, "manifest.webmanifest")
    write_page(context, "pwa/manifest.webmanifest", out_file_path)


def generate_offline_page():
    context = {"user_data": {"is_logged_in": False}}
    out_file_path = os.path.join(OUT_DIR_PATH, "offline.html")
    write_page(context, "offline.html", out_file_path)


def generate_pages():
    for page, template in PAGES.items():
        src_path = os.path.join(CONTENT_PATH, page, "index.md")
        frontmatter_data, content = parse_file(src_path)

        out_dir = os.path.join(OUT_DIR_PATH, page)
        os.makedirs(out_dir, exist_ok=True)
        out_file_path = os.path.join(out_dir, "index.html")

        context = make_context_for_page(frontmatter_data)
        context["content_html"] = markdown(content, extras=["break-on-newline"])
        write_page(context, template, out_file_path)


def generate_articles():
    article_dir_path = os.path.join(CONTENT_PATH, ARTICLE_DIR)
    articles = []
    for subdir, _, _ in os.walk(article_dir_path):
        index_md_path = os.path.join(subdir, "index.md")
        if not os.path.exists(index_md_path):
            continue
        frontmatter_data, content = parse_file(index_md_path)

        out_dir = os.path.join(OUT_DIR_PATH, os.path.relpath(subdir, CONTENT_PATH))
        os.makedirs(out_dir, exist_ok=True)
        out_file_path = os.path.join(out_dir, "index.html")

        article_context = make_context_for_page(frontmatter_data, section="articles")
        content_html = markdown(content, extras=["break-on-newline"])
        article_context["content_html"] = content_html
        article_slug = os.path.relpath(subdir, article_dir_path).strip("/")
        article_context["get_absolute_url"] = f"/artykuly/{article_slug}/"
        article_context["thumb_url"] = frontmatter_data.get("cover_image_thumb_420_210")
        thumb_source = (
            frontmatter_data.get("cover_image_thumb_600_300")
            or frontmatter_data.get("cover_image_thumb_420_210")
        )
        article_context["thumb_picture"] = (
            imageutils.picture_context(
                thumb_source,
                alt="",
                sizes="(max-width: 600px) 100vw, (max-width: 1024px) 66vw, 800px",
            ) if thumb_source else None
        )

        if article_context["lead"]:
            article_context["lead_html"] = markdown(article_context["lead"])
        else:
            add_lead(article_context, content_html, 200)

        write_page(article_context, "page.html", out_file_path)
        articles.append(article_context)
    articles.sort(key=lambda x: x["pub_date"], reverse=True)
    context = {
        "articles": articles,
        "user_data": {"is_logged_in": False},
    }
    out_file_path = os.path.join(OUT_DIR_PATH, ARTICLE_DIR, "index.html")
    write_page(context, "articles/index.html", out_file_path)
    return articles


def generate_posts():
    blog_dir_path = os.path.join(CONTENT_PATH, BLOG_DIR)
    posts = []
    for subdir, _, _ in os.walk(blog_dir_path):
        index_md_path = os.path.join(subdir, "index.md")
        if not os.path.exists(index_md_path):
            continue
        frontmatter_data, content = parse_file(index_md_path)

        out_dir = os.path.join(OUT_DIR_PATH, os.path.relpath(subdir, CONTENT_PATH))
        os.makedirs(out_dir, exist_ok=True)
        out_file_path = os.path.join(out_dir, "index.html")

        content_html = markdown(content, extras=["break-on-newline"])
        post_context = make_context_for_page(frontmatter_data, section="blog")
        post_context["content_html"] = content_html
        post_slug = os.path.relpath(subdir, blog_dir_path).strip("/")
        post_context["get_absolute_url"] = f"/blog/{post_slug}/"
        add_lead(post_context, content_html, 500)

        write_page(post_context, "page.html", out_file_path)
        posts.append(post_context)
    posts.sort(key=lambda x: x["pub_date"], reverse=True)
    context = {
        "all_posts": posts,
        "new_posts": posts[:5],
        "user_data": {"is_logged_in": False},
    }
    out_file_path = os.path.join(OUT_DIR_PATH, BLOG_DIR, "index.html")
    write_page(context, "blog/index.html", out_file_path)
    return posts


def parse_artists():
    artists_by_slug = {}
    for subdir, _, _ in os.walk(ARTISTS_DIR_PATH):
        index_md_path = os.path.join(subdir, "index.md")
        if not os.path.exists(index_md_path):
            continue
        frontmatter_data, content = parse_file(index_md_path)
        artist_slug = os.path.relpath(subdir, ARTISTS_DIR_PATH).strip("/")
        artist = make_context_for_page(frontmatter_data, section="songs")
        artist["slug"] = artist_slug
        artist["get_absolute_url"] = f"/spiewnik/{artist_slug}/"
        # Square portrait variants for tiles + hero portraits.
        portrait_url = artist.get("image_full") or artist.get("image_thumb")
        artist["portrait_picture"] = (
            imageutils.picture_context(
                portrait_url,
                alt=artist.get("name") or "",
                sizes="(max-width: 600px) 50vw, (max-width: 1024px) 33vw, 25vw",
                square=True,
                css_class="pzt-artist-tile-img",
            ) if portrait_url else None
        )
        artist["hero_picture"] = (
            imageutils.picture_context(
                portrait_url,
                alt=artist.get("name") or "",
                sizes="(max-width: 600px) 60vw, (max-width: 1024px) 280px, 320px",
                square=True,
                css_class="pzt-artist-hero-img",
            ) if portrait_url else None
        )
        artists_by_slug[artist_slug] = artist
    return artists_by_slug


def generate_songs(artists_by_slug):
    songs_by_artist_slug = {}
    pending = []  # list of (context, out_file_path) to write after computing prev/next

    songs_dir_path = os.path.join(CONTENT_PATH, SONGS_DIR)
    song_notes = []
    for subdir, _, _ in os.walk(songs_dir_path):
        index_md_path = os.path.join(subdir, "index.md")
        if not os.path.exists(index_md_path):
            continue
        frontmatter_data, content = parse_file(index_md_path)
        song_slug = os.path.relpath(subdir, songs_dir_path).strip("/")

        out_dir = os.path.join(OUT_DIR_PATH, os.path.relpath(subdir, CONTENT_PATH))
        os.makedirs(out_dir, exist_ok=True)
        out_file_path = os.path.join(out_dir, "index.html")

        content_html = lyrics.render_lyrics(content)
        context = make_context_for_page(frontmatter_data, section="songs")
        context["slug"] = song_slug
        context["content_html"] = content_html
        context["get_absolute_url"] = f"/opracowanie/{song_slug}/"
        artist_slugs = set(
            (context["text_authors"] if context["text_authors"] else [])
            + (context["composers"] if context["composers"] else [])
            + (context["translators"] if context["translators"] else [])
            + (context["performers"] if context["performers"] else [])
        )
        # Track raw artist slug list for prev/next ordering decisions later.
        context["_artist_slugs"] = list(artist_slugs)
        for artist_slug in artist_slugs:
            if artist_slug not in songs_by_artist_slug:
                songs_by_artist_slug[artist_slug] = []
            songs_by_artist_slug[artist_slug].append(context)
        context["text_authors"] = make_artist_list(
            artists_by_slug, context["text_authors"]
        )
        context["composers"] = make_artist_list(artists_by_slug, context["composers"])
        context["translators"] = make_artist_list(
            artists_by_slug, context["translators"]
        )
        context["performers"] = make_artist_list(artists_by_slug, context["performers"])

        notes = []
        for root, _, files in os.walk(subdir):
            for file in files:
                if file == "index.md" or not file.endswith(".md"):
                    continue
                file_path = os.path.join(root, file)
                print(f"{file_path}")
                note_frontmatter_data, note_content = parse_file(file_path)
                note_content_html = markdown(note_content, extras=["break-on-newline"])
                note_context = make_context_for_page(
                    note_frontmatter_data, section="songs"
                )
                note_context["content_html"] = note_content_html
                note_context["song"] = context
                if note_context.get("image_thumb"):
                    note_context["thumb_picture"] = imageutils.picture_context(
                        note_context.get("image_full") or note_context["image_thumb"],
                        alt=note_context.get("title") or "",
                        sizes="(max-width: 600px) 100vw, (max-width: 1024px) 320px, 320px",
                    )
                notes.append(note_context)

        context["notes"] = notes
        context["num_notes"] = len(notes)
        pending.append((context, out_file_path))
        song_notes += notes

    # Compute prev/next URL for each song using the first artist's sorted song list.
    # Falls back to global chronological order (by pub_date desc) when no artist list helps.
    sorted_by_artist = {}
    for artist_slug, songs in songs_by_artist_slug.items():
        sorted_by_artist[artist_slug] = sorted(songs, key=polish_sort_key)

    for context, out_file_path in pending:
        prev_url = None
        next_url = None
        artist_slugs = context.get("_artist_slugs") or []
        if artist_slugs:
            primary = artist_slugs[0]
            siblings = sorted_by_artist.get(primary, [])
            try:
                idx = next(
                    i
                    for i, s in enumerate(siblings)
                    if s["get_absolute_url"] == context["get_absolute_url"]
                )
                if idx > 0:
                    prev_url = siblings[idx - 1]["get_absolute_url"]
                if idx < len(siblings) - 1:
                    next_url = siblings[idx + 1]["get_absolute_url"]
            except StopIteration:
                pass
        context["prev_song_url"] = prev_url
        context["next_song_url"] = next_url
        # Drop helper before render
        context.pop("_artist_slugs", None)
        write_page(context, "songs/song.html", out_file_path)

    return songs_by_artist_slug, song_notes


def generate_songbook_index(artists_by_slug, songs_by_artist_slug):
    hero_artists = [
        artists_by_slug["jacek-kaczmarski"],
        artists_by_slug["przemyslaw-gintrowski"],
        artists_by_slug["kaczmarski-gintrowski-lapinski"],
        artists_by_slug["pawel-wojcik"],
        artists_by_slug["jacek-kowalski"],
        artists_by_slug["mariusz-zadura"],
    ]

    polish_artists = []
    foreign_artists = []
    community_artists = []
    all_featured = []
    for artist_slug, artist in artists_by_slug.items():
        if not artist["featured"]:
            continue
        artist["song_count"] = len(songs_by_artist_slug.get(artist_slug, []))

        if artist["category"] == "POLISH":
            polish_artists.append(artist)
        elif artist["category"] == "FOREIGN":
            foreign_artists.append(artist)
        elif artist["category"] == "COMMUNITY":
            community_artists.append(artist)
        all_featured.append(artist)

    polish_artists.sort(key=lambda x: artist_sort_key(x["name"]))
    foreign_artists.sort(key=lambda x: artist_sort_key(x["name"]))
    community_artists.sort(key=lambda x: artist_sort_key(x["name"]))
    all_featured.sort(key=lambda x: artist_sort_key(x["name"]))

    # Compute jumplist letters and per-artist starting letter.
    letters_present = []
    seen_letters = set()
    for artist in all_featured:
        first = artist_first_letter(artist["name"])
        artist["jump_letter"] = first
        artist["jump_anchor"] = _slug_letter(first)
        # data-tags string for client-side filter chips.
        tags = []
        cat = artist.get("category")
        if cat == "POLISH":
            tags.append("polski")
        if cat == "FOREIGN":
            tags.append("zagraniczny")
        if cat == "COMMUNITY":
            tags.append("wspolczesny")
        # Heuristic: surviving artist => "wspolczesny"
        if not artist.get("died_on"):
            tags.append("wspolczesny")
        # Translation artists land in foreign, mark them
        if cat == "FOREIGN":
            tags.append("tlumaczenie")
        artist["filter_tags"] = " ".join(sorted(set(tags)))
        if first not in seen_letters:
            seen_letters.add(first)
            letters_present.append(first)
    letters_present.sort(key=letter_sort_key)
    jump_letters = [{"letter": l, "anchor": _slug_letter(l)} for l in letters_present]

    # Group artists for rendering with letter-anchored sections.
    artist_groups_map = {}
    for artist in all_featured:
        artist_groups_map.setdefault(artist["jump_letter"], []).append(artist)
    artist_groups = [
        {"letter": l, "anchor": _slug_letter(l), "artists": artist_groups_map[l]}
        for l in letters_present
    ]

    song_index_context = {
        "hero_artists": hero_artists,
        "polish": polish_artists,
        "foreign": foreign_artists,
        "community": community_artists,
        "all_artists": all_featured,
        "artist_groups": artist_groups,
        "jump_letters": jump_letters,
    }
    out_dir = os.path.join(OUT_DIR_PATH, ARTISTS_DIR)
    os.makedirs(out_dir, exist_ok=True)
    out_file_path = os.path.join(out_dir, "index.html")
    write_page(song_index_context, "songs/index.html", out_file_path)
    return song_index_context

POLISH_ORDER = str.maketrans({
    'a': 'a0', 'ą': 'a1', 'c': 'c0', 'ć': 'c1', 'e': 'e0', 'ę': 'e1',
    'l': 'l0', 'ł': 'l1', 'n': 'n0', 'ń': 'n1', 'o': 'o0', 'ó': 'o1',
    's': 's0', 'ś': 's1', 'z': 'z0', 'ź': 'z1', 'ż': 'z2',
})

def polish_sort_key(song):
    text = song["title"]
    # Removes leading non-word chars: '„Obym się mylił”' -> 'Obym się mylił”'
    text_clean = re.sub(r'^[\s\W]+', '', text, flags=re.UNICODE)
    return text_clean.lower().translate(POLISH_ORDER)


def artist_sort_key(name):
    """Sort artists by surname when possible. Falls back to whole name."""
    if not name:
        return ""
    # If multi-word, sort by last token then first token (common Polish convention).
    parts = name.split()
    if len(parts) >= 2:
        key = parts[-1] + " " + " ".join(parts[:-1])
    else:
        key = name
    return key.lower().translate(POLISH_ORDER)


def artist_first_letter(name):
    """Polish-aware first letter for jumplist grouping. Uses surname if multi-word."""
    if not name:
        return "?"
    parts = name.split()
    base = parts[-1] if len(parts) >= 2 else name
    base = re.sub(r'^[\s\W]+', '', base, flags=re.UNICODE)
    if not base:
        return "?"
    return base[0].upper()


# Letter ordering for the alphabet rail — Polish letters get inserted after their base.
LETTER_ORDER = list("AĄBCĆDEĘFGHIJKLŁMNŃOÓPQRSŚTUVWXYZŹŻ")
LETTER_RANK = {ch: i for i, ch in enumerate(LETTER_ORDER)}

def letter_sort_key(letter):
    return LETTER_RANK.get(letter, 999)


def _slug_letter(letter):
    """A url-safe anchor id for a Polish letter (e.g., Ł -> l, Ż -> z2)."""
    mapping = {
        'A': 'a', 'Ą': 'a1', 'B': 'b', 'C': 'c', 'Ć': 'c1', 'D': 'd',
        'E': 'e', 'Ę': 'e1', 'F': 'f', 'G': 'g', 'H': 'h', 'I': 'i',
        'J': 'j', 'K': 'k', 'L': 'l', 'Ł': 'l1', 'M': 'm', 'N': 'n',
        'Ń': 'n1', 'O': 'o', 'Ó': 'o1', 'P': 'p', 'Q': 'q', 'R': 'r',
        'S': 's', 'Ś': 's1', 'T': 't', 'U': 'u', 'V': 'v', 'W': 'w',
        'X': 'x', 'Y': 'y', 'Z': 'z', 'Ź': 'z1', 'Ż': 'z2',
    }
    return mapping.get(letter, letter.lower() if letter else 'misc')


def song_first_letter(title):
    if not title:
        return "?"
    text_clean = re.sub(r'^[\s\W]+', '', title, flags=re.UNICODE)
    if not text_clean:
        return "?"
    return text_clean[0].upper()

def generate_artists(artists_by_slug, songs_by_artist_slug, song_index_context):
    for artist_slug, artist_context in artists_by_slug.items():
        if not artist_context["featured"]:
            continue

        subdir = os.path.join(ARTISTS_DIR_PATH, artist_slug)
        notes = []
        for root, _, files in os.walk(subdir):
            for file in files:
                if file == "index.md" or not file.endswith(".md"):
                    continue
                file_path = os.path.join(root, file)
                print(f"{file_path}")
                note_frontmatter_data, note_content = parse_file(file_path)
                note_content_html = markdown(note_content, extras=["break-on-newline"])
                note_context = make_context_for_page(
                    note_frontmatter_data, section="songs"
                )
                note_context["content_html"] = note_content_html
                if note_context.get("image_thumb"):
                    note_context["thumb_picture"] = imageutils.picture_context(
                        note_context.get("image_full") or note_context["image_thumb"],
                        alt=note_context.get("title") or "",
                        sizes="(max-width: 600px) 100vw, (max-width: 1024px) 320px, 320px",
                    )
                notes.append(note_context)
        out_dir = os.path.join(OUT_DIR_PATH, os.path.relpath(subdir, CONTENT_PATH))
        os.makedirs(out_dir, exist_ok=True)
        out_file_path = os.path.join(out_dir, "index.html")

        songs = songs_by_artist_slug[artist_slug]
        songs.sort(key=lambda x: x["title"])

        if artist_context["filter_epigone"]:
            filtered_songs = [song for song in songs if not song.get("epigone")]
            epigone_songs = [song for song in songs if song.get("epigone")]
        else:
            filtered_songs = songs
            epigone_songs = []

        epigone_songs = sorted(epigone_songs, key=polish_sort_key)
        filtered_songs = sorted(filtered_songs, key=polish_sort_key)

        artist_context["songs"] = filtered_songs
        artist_context["epigone_songs"] = epigone_songs

        # Group songs by first letter for the redesigned A-Z layout + jumplist.
        groups_map = {}
        for song in filtered_songs:
            letter = song_first_letter(song["title"])
            groups_map.setdefault(letter, []).append(song)
        sorted_letters = sorted(groups_map.keys(), key=letter_sort_key)
        artist_context["song_groups"] = [
            {"letter": l, "anchor": _slug_letter(l), "songs": groups_map[l]}
            for l in sorted_letters
        ]
        artist_context["song_letters"] = [
            {"letter": l, "anchor": _slug_letter(l)} for l in sorted_letters
        ]

        notes.sort(key=lambda x: x["pub_date"], reverse=True)
        artist_context["notes"] = notes
        artist_context.update(song_index_context)
        write_page(artist_context, "songs/artist.html", out_file_path)


def generate_artist_index(artists_by_slug):
    resp = []
    for artist_slug, artist in artists_by_slug.items():
        if not "featured" in artist or not artist["featured"]:
            continue
        resp.append(
            {
                "name": artist["name"],
                "value": artist["name"],
                "tokens": artist["name"].split(),
                "url": artist["get_absolute_url"],
            }
        )
    out_dir_path = os.path.join(OUT_DIR_PATH, "index")
    out_file_path = os.path.join(out_dir_path, "artists.json")
    os.makedirs(out_dir_path, exist_ok=True)
    with open(out_file_path, "w") as f:
        json.dump(resp, f, ensure_ascii=False, indent=4)


def generate_song_index(all_songs):
    resp = []
    for song in all_songs:
        resp.append(
            {
                "name": song["title"],
                "value": song["title"],
                "tokens": song["title"].split(),
                "url": song["get_absolute_url"],
            }
        )
    out_dir_path = os.path.join(OUT_DIR_PATH, "index")
    out_file_path = os.path.join(out_dir_path, "songs.json")
    os.makedirs(out_dir_path, exist_ok=True)
    with open(out_file_path, "w") as f:
        json.dump(resp, f, ensure_ascii=False, indent=4)


def attach_responsive_image(context, url_key, picture_key, alt="", sizes=None, square=False, css_class=""):
    """Helper: read context[url_key], compute picture context, store under context[picture_key]."""
    url = context.get(url_key)
    if not url:
        context[picture_key] = None
        return
    ctx = imageutils.picture_context(url, alt=alt, sizes=sizes, square=square, css_class=css_class)
    context[picture_key] = ctx


class Command(BaseCommand):
    help = "Generates the static pages."

    def handle(self, *args, **options):
        imageutils.configure(OUT_DIR_PATH, ROOT_PATH)
        generate_pages()
        generate_404_page()
        generate_saved_page()
        generate_manifest()
        generate_offline_page()

        articles = generate_articles()
        articles.sort(key=lambda x: x["pub_date"], reverse=True)
        posts = generate_posts()
        artists_by_slug = parse_artists()
        songs_by_artist_slug, song_notes = generate_songs(artists_by_slug)
        songbook_index_context = generate_songbook_index(artists_by_slug, songs_by_artist_slug)
        generate_artists(artists_by_slug, songs_by_artist_slug, songbook_index_context)

        all_songs = {}
        for artist_songs in songs_by_artist_slug.values():
            for song in artist_songs:
                all_songs[song["get_absolute_url"]] = song
        all_songs = list(all_songs.values())
        all_songs.sort(key=lambda x: x["pub_date"], reverse=True)

        song_notes.sort(key=lambda x: x["pub_date"], reverse=True)

        # Featured opracowanie = latest song-note pair. The note sits on a song.
        featured_note = song_notes[0]
        featured_song = featured_note["song"]
        # If the featured song's first text-author has a portrait, prefer that
        # for the hero image (more humane than the note thumbnail).
        hero_picture = featured_note.get("thumb_picture")
        author_artist = None
        if featured_song.get("text_authors"):
            author_artist = featured_song["text_authors"][0]
        elif featured_song.get("performers"):
            author_artist = featured_song["performers"][0]
        if author_artist and author_artist.get("hero_picture"):
            hero_picture = author_artist["hero_picture"]

        frontpage_context = {
            "post": posts[0],
            "posts": posts[:3],
            "featured_note": featured_note,
            "featured_song": featured_song,
            "featured_artist": author_artist,
            "hero_picture": hero_picture,
            "latest_notes": song_notes[:5],
            "songs": all_songs[:5],
            "article": articles[0],
        }

        out_file_path = os.path.join(OUT_DIR_PATH, "index.html")
        write_page(frontpage_context, "frontpage/index.html", out_file_path)

        generate_artist_index(artists_by_slug)
        generate_song_index(all_songs)
