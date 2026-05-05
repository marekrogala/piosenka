# REDESIGN-PLAN.md

Vision + concrete plan: take Piosenka z tekstem from BS3-era utility site to modern, beautiful, mobile-first reading & singing companion. Web + installable PWA, single codebase, Django generator stays.

Reference: [MOBILE-AUDIT.md](MOBILE-AUDIT.md) — current state pain points. This doc = target state + how to get there.

---

## 1. Vision

> *Piosenka z tekstem* = best place on the Polish internet to **read** a literary song and **play** it on guitar. Quiet, focused, serious about the text. Phone-first. Works offline. Feels like a thoughtful printed songbook, not a 2012 Bootstrap site.

Three user moments to optimize for:

| Moment | User | Win condition |
|--------|------|---------------|
| **Discover** | Someone read a name in an article, wants to hear it | Finds song in ≤ 2 taps from home, opens reader, plays YouTube embed |
| **Sing** | Guitar in lap, phone on music stand | Lyrics + chords readable from 60 cm, transpose / hide chords without scrolling, dim screen, no zoom-in needed |
| **Study** | Reads opracowanie + footnotes | Long-form reading, big type, footnotes inline, share quote |

Everything below derives from those three.

---

## 2. Design principles

1. **Text first.** Site exists for the lyric. Every pixel that isn't the lyric must justify itself.
2. **Mobile is the canvas.** Desktop = the same design with breathing room, not a different design.
3. **One screen, one job.** Reader screen ≠ songbook screen ≠ home. No persistent sidebars on mobile.
4. **Quiet by default, expressive on purpose.** Single accent color, single body typeface, single display typeface. Restraint = literary feel.
5. **Offline-first.** Once you opened a song, you can sing it on a train.
6. **Accessible by construction.** WCAG AA min. Screen-reader users get the lyric in reading order. Dark mode is real, not a tinted overlay.
7. **No SPA, no framework gravity.** Static HTML + a small vanilla JS layer. Build stays Django. Page weight target < 200 KB transferred for a song page.

---

## 3. Brand & identity

Current brand is solid (the feather logo, the literary blockquote tone) — keep and refine, don't replace.

**Mood board direction:** warm paper, ink, woodcut texture. Think Penguin Classics + Apple Books. Not Genius.com.

**Identity tokens:**

- **Wordmark:** `Piosenka z tekstem` set in display serif (Crimson Pro 700) + small caps subtitle. Feather mark unchanged but cleaned to single-color SVG.
- **Voice:** existing literary copywriting (the rotating Kaczmarski / Kleyff quotes in the hero) is excellent — make it the core of the home page, not a sidebar.
- **Photography:** keep grayscale artist portraits, add subtle warm duotone for cards. No stock photos.

---

## 4. Design system

All as CSS custom properties on `:root`, dark variant on `[data-theme="dark"]`. Single source of truth.

### 4.1 Color (light)

```css
:root {
  /* surface */
  --surface-paper:   #faf7f1;   /* page bg, warm cream */
  --surface-card:    #ffffff;   /* card bg */
  --surface-sunken:  #f0ece4;   /* divider zones */

  /* ink */
  --ink-1:  #1a1816;            /* body text */
  --ink-2:  #4a4540;            /* secondary */
  --ink-3:  #847d74;            /* tertiary, captions */
  --ink-4:  #c9c2b8;            /* hairlines */

  /* accent — single, used for links + interactive */
  --accent:        #8b1e2d;     /* deep oxblood, AA on cream */
  --accent-hover:  #6a141f;
  --accent-soft:   #f4e6e3;     /* tinted bg for chips */

  /* chord highlight — distinct from accent, low-saturation */
  --chord:         #2c5f7a;     /* slate teal, AA on cream */
}

[data-theme="dark"] {
  --surface-paper:   #161412;
  --surface-card:    #1f1c19;
  --surface-sunken:  #0e0c0b;
  --ink-1:  #f0eae0;
  --ink-2:  #b8afa3;
  --ink-3:  #847d74;
  --ink-4:  #3d3833;
  --accent:        #d97181;
  --accent-hover:  #e89aa6;
  --accent-soft:   #2a1a1d;
  --chord:         #7fb3c8;
}
```

### 4.2 Typography

Two typefaces, four roles. Variable fonts, self-hosted (no Google Fonts blocking).

```css
:root {
  --font-display: "Crimson Pro", Georgia, serif;     /* H1, hero, song title */
  --font-body:    "Inter Variable", -apple-system, system-ui, sans-serif;  /* UI, lists, prose */
  --font-lyric:   "Crimson Pro", Georgia, serif;     /* lyric body — serif on purpose */
  --font-mono:    "JetBrains Mono", ui-monospace, monospace; /* chords */
}
```

Type scale (mobile / desktop):

| Role | Mobile | Desktop | Weight |
|------|--------|---------|--------|
| Display H1 (song title) | 32 / 1.15 | 56 / 1.1 | 700 |
| H2 | 22 / 1.25 | 28 / 1.3 | 600 |
| H3 | 18 / 1.3 | 20 / 1.35 | 600 |
| Body | 17 / 1.55 | 18 / 1.6 | 400 |
| Lyric | 18 / 1.7 | 20 / 1.75 | 400 |
| Chord | 14 / 1 | 14 / 1 | 600, mono |
| Caption | 14 / 1.4 | 14 / 1.4 | 400 |
| UI label | 15 / 1.2 | 15 / 1.2 | 500 |

All inputs ≥ 16 px (no iOS zoom). `font-display: swap`. Critical fonts inlined as `font-face` with `unicode-range` Latin Extended (Polish chars).

### 4.3 Spacing scale

8-pt grid:

```css
--space-1: 4px;  --space-2: 8px;  --space-3: 12px;
--space-4: 16px; --space-5: 24px; --space-6: 32px;
--space-7: 48px; --space-8: 64px; --space-9: 96px;
```

Reading column max-width: `--text-max: 68ch` (≈ 640 px at 18 px). Page gutter: `--gutter: clamp(16px, 5vw, 48px)`.

### 4.4 Radius, shadow, motion

```css
--radius-sm: 6px;  --radius-md: 12px;  --radius-lg: 20px;
--shadow-1: 0 1px 2px rgb(0 0 0 / 0.06);                    /* cards at rest */
--shadow-2: 0 6px 24px -8px rgb(0 0 0 / 0.18);              /* sticky bar, modals */
--motion-fast: 120ms cubic-bezier(.2,.8,.2,1);
--motion-base: 220ms cubic-bezier(.2,.8,.2,1);
@media (prefers-reduced-motion: reduce) {
  :root { --motion-fast: 0ms; --motion-base: 0ms; }
}
```

### 4.5 Touch & focus

- Tap target floor: 44 × 44 (iOS) / 48 × 48 (Android). Default `.btn` min-height 48 px.
- Focus ring: `outline: 2px solid var(--accent); outline-offset: 2px; border-radius: inherit;` — visible on every interactive element, never `:focus { outline: none }`.

---

## 5. Information architecture

Stays close to current — it works conceptually. Tighten the surfaces.

```
/
├── /spiewnik/                  songbook root: artist grid + alphabet jumplist
│   ├── /spiewnik/{artist}/     artist page: bio note + all songs grouped A–Z
│   └── /opracowanie/{slug}/    SONG = primary surface (reader)
├── /artykuly/                  longform articles
│   └── /artykuly/{slug}/
├── /blog/                      changelog / news
├── /szukaj/                    full search results page
└── /o-stronie/                 about
```

**Global nav (mobile, fixed bottom):**

```
[ ☰ Menu ]   [ 🔍 Szukaj ]   [ ⭐ Zapisane ]   [ 🌓 Tryb ]
```

Bottom nav reasoning: thumb reach, obvious targets, makes site feel app-like in PWA mode. Top of screen = brand + back/title only.

**Global nav (desktop ≥ 992 px):** classic top nav, brand left, links inline, search command-palette trigger right (`Cmd/Ctrl+K`).

**Search = command palette.** Single overlay on top of any page. Triggered from bottom nav or keyboard shortcut. Full-text fuzzy over song titles + artist names + first lyric line, results inline. No more dual Google CSE / Typeahead split.

---

## 6. Component library

Lean. Each component does one thing. Built on BS5 primitives + a thin `pzt-*` layer. No Tailwind.

| Component | Purpose | Notes |
|-----------|---------|-------|
| `pzt-app-bar` | Top bar — brand, back, page title | sticky, hides on scroll-down, shows on scroll-up |
| `pzt-bottom-nav` | Mobile bottom nav | 4 items, safe-area-inset aware |
| `pzt-search` | Command palette overlay | Cmd+K, tap, ESC closes |
| `pzt-card` | Generic surface (replaces `.section`) | radius-md, shadow-1 |
| `pzt-artist-tile` | Songbook grid tile | duotone photo, name, song count |
| `pzt-song-row` | Single song in a list | title + small chord/note badges |
| `pzt-chord-bar` | Sticky transposition + chord toggle | bottom-anchored on song page, above bottom-nav |
| `pzt-lyric-line` | One line of song | flex row: lyric (serif) + chords (mono, right) |
| `pzt-quote` | Literary blockquote | left rule, small attribution |
| `pzt-jumplist` | A-Z alphabet rail | sticky right side on songbook + artist pages |
| `pzt-toast` | Save feedback, copy-link | bottom, auto-dismiss |
| `pzt-skeleton` | Loading placeholder | for offline reload of cached pages |

All keyboard-accessible, all dark-mode aware, all ≥ 44 px tap.

---

## 7. Page-by-page redesign

### 7.1 Home `/`

**Goal:** show what the site is, surface 3-5 things to read right now, get out of the way.

```
┌──────────────────────────────┐
│  Piosenka z tekstem          │ ← wordmark, no fixed top bar visual noise
│  [literary tagline, 1 line]  │
├──────────────────────────────┤
│  ╭ FEATURED OPRACOWANIE ╮    │
│  │ Cover illustration   │    │ ← single hero card, big
│  │ Title (display)      │    │
│  │ Author · Note teaser │    │
│  ╰──────────────────────╯    │
├──────────────────────────────┤
│  Najnowsze opracowania       │
│  • 1788 — Kaczmarski         │
│  • Pan Podbipięta — …        │
│  → wszystkie                 │
├──────────────────────────────┤
│  Z bloga                     │
│  • Treść na GitHubie         │
├──────────────────────────────┤
│  [Literary rotating quote]   │ ← keep current rotating quote, restyled
└──────────────────────────────┘
```

Drop calendar entirely from home, or move to `/o-stronie/`. (Calendar API key issue → resolved: dummy out / remove the feature; covered in audit P0-4.)

### 7.2 Songbook `/spiewnik/`

**Goal:** browse all artists, get to one fast.

- 2-col tile grid on phone (artist photo duotone + name + song count), 4-col on desktop.
- Sticky alphabet rail right side: tap `K` → jumps to Kaczmarski. Active letter highlighted.
- Search field at top (opens command palette).
- Filter chips: `Wszyscy / Polscy / Tłumaczenia / Współcześni`.

### 7.3 Artist `/spiewnik/{artist}/`

**Goal:** read about artist, find a song quickly even with 246 of them.

- Hero: large duotone portrait, name in display serif, lifetime, 2-line bio.
- "Notki" expandable inline (current sidebar `notes` becomes accordion above song list).
- Songs grouped by first letter, anchor jumps from sticky alphabet rail.
- Each song row: title, chip if has opracowanie, mini sparkline if has chords.
- "Kompozycje epigońskie" — separate section below, same styling as Songs.

### 7.4 Song `/opracowanie/{slug}/` — the primary surface

**Goal:** read & sing. Everything else is secondary.

```
┌──────────────────────────────┐
│  ← Kaczmarski · 1788         │ ← compact app bar, brand + crumb
├──────────────────────────────┤
│            1788              │ ← display serif, 32px mobile / 56 desktop
│   Tekst · Muzyka · Kapo III  │
├──────────────────────────────┤
│  Ta pierwsza morska podróż…  │
│  Łotry przy burtach…       D G│ ← lyric serif 18px, chord mono right-aligned
│                                │
│  Czym żeśmy, marni…          │ ← paragraph spacing
├──────────────────────────────┤
│  [opracowanie note inline]   │ ← was sidebar, now flows below lyric
├──────────────────────────────┤
│  📺 Nagranie YouTube         │ ← lazy embed, click-to-load placeholder
│  🎼 Nuty (3 obrazki)         │ ← thumbnail grid, lightbox
└──────────────────────────────┘
[ ⏶  ⌂  ⏷  │  ♫  A  │  ⛶  🌓 ] ← sticky bottom chord-bar, ≥48px each
```

Sticky `pzt-chord-bar` pinned to bottom (above `pzt-bottom-nav` on mobile, floating right on desktop). Buttons:

- ⏶ / ⌂ / ⏷ — transpose up / home / down
- ♫ / A — chords on / lyrics-only
- ⛶ — performance mode (full-screen reader, no nav, big type, screen-stays-on via `WakeLock` API)
- 🌓 — dark/light toggle

**Performance mode** (⛶): full-screen, type bumps to 22 px, hides everything chrome, swipe horizontally → previous/next song in artist's list, swipe up → exit. This is the killer feature for live use.

**Chord rendering:** drop the `<table>`. Render each line as:

```html
<p class="pzt-lyric-line">
  <span class="lyric">Ta pierwsza morska podróż do Australii!</span>
  <span class="chords"><span>D</span> <span>G</span></span>
</p>
```

CSS:
```css
.pzt-lyric-line {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--space-4);
  align-items: baseline;
}
.pzt-lyric-line .chords {
  font: 600 14px/1 var(--font-mono);
  color: var(--chord);
  white-space: nowrap;
}
@media (max-width: 480px) {
  /* on tiny phones, chord above lyric */
  .pzt-lyric-line { grid-template-columns: 1fr; gap: 2px; }
  .pzt-lyric-line .chords { order: -1; }
}
```

Coordinates with #131 (visually mark wrapped lines): wrapped lyric lines get `padding-left: 1ch; border-left: 2px solid var(--ink-4)` on the wrapped portion (use CSS `text-wrap: pretty` + `:has(> .wrap)` once the lyric splitter generates the markup; or a JS pass at build time).

### 7.5 Search `/szukaj/` + command palette

- `/szukaj/` page becomes thin wrapper around the same palette UI, for direct URL share.
- Drop Google CSE. Build a static JSON index at gen time: `{title, artist, slug, firstLine, hasChords}` per song, ~50 KB gzipped. Client-side fuzzy via [Fuse.js](https://fusejs.io) (~7 KB gzipped) or hand-rolled trigram.
- Results live: title bold-matched, artist subtitle, ⏎ to open. Recent searches saved to `localStorage`.

### 7.6 Article `/artykuly/{slug}/`

- Long-form reader column (`max-width: 68ch`), serif body 19 px.
- Drop cap on first paragraph (optional, CSS `::first-letter`).
- Pull quotes styled like `pzt-quote`.
- Reading-time estimate top: "≈ 7 min".
- Footnotes inline (sidenotes on desktop ≥ 1100 px via Tufte CSS pattern, popovers on mobile).

### 7.7 About / footer

- About: keep tone, modernize layout. Contributors as small avatar grid.
- Footer: real footer. Repo link, RSS, contact, license, accessibility statement, GH issue trigger ("zgłoś błąd w opracowaniu").

---

## 8. Tech stack — modernized but boring

Goal: maintainable in 2030 by one person on a weekend.

### 8.1 What stays

- Django generator (`piosenka/management/commands/gen.py`) — works, content authors don't touch it.
- Markdown content in `pages/` — never breaking that.
- Firebase Hosting deploy.

### 8.2 What changes

| Concern | Before | After | Why |
|---------|--------|-------|-----|
| CSS framework | Bootstrap 3 (custom) | **Tailwind CSS v4** + design tokens via `@theme` | smaller bundle (~8 KB purged vs BS5 ~30 KB), no global CSS leaks, dark mode built-in, JIT, single CSS import; tokens become first-class via `@theme` directive |
| CSS toolchain | django-compress only | **Tailwind standalone CLI** binary (no Node) → output → django-compress | adds zero npm/Node dependency; binary committed under `tools/` or fetched in build.sh |
| Icons | Glyphicon font (BS3) | [Lucide](https://lucide.dev) SVG sprite, subset (~12 icons) | matches Tailwind ecosystem, no font load, scalable, ARIA-friendly. BS Icons also fine — Lucide picked for cleaner mobile look |
| Dropdown / tooltip | jQuery + BS3 plugins | [Floating UI](https://floating-ui.com) (~3 KB) | vanilla, framework-agnostic, used by shadcn/Radix etc. |
| Modal | BS3 modal | Native `<dialog>` element + 20 LOC helper | zero deps, accessible, baseline support since 2022 |
| JS framework | jQuery 2.1.1 | Vanilla ES2022 | ~80 LOC of song.js trivially converts, kills 84 KB |
| Search | Google CSE + jQuery Typeahead | [Pagefind](https://pagefind.app) (build-time index) + custom palette UI | designed for static sites, scales to 10 K+ pages, no third-party load, offline-capable |
| Fonts | Google Fonts CDN (blocking) | Self-hosted Crimson Pro + Inter + JetBrains Mono, subset Latin Ext | no third-party request, instant FCP, `font-display: swap` |
| Comments | Disqus (loaded eagerly, ~800 KB) | Disqus, **lazy-loaded** via IntersectionObserver | already wired in [`templates/base/rows/disqus.html`](templates/base/rows/disqus.html); defer until user scrolls near comments section. Migration to Giscus = separate decision, post-PR-6 |
| Analytics | gtag inline blocking | Plausible (privacy-first, 1 KB) or self-hosted Umami | smaller, GDPR-clean, no cookie banner needed |
| FB SDK | Loaded on every page | Removed | unused, 100+ KB |
| Image variants | Single full-size JPG | Pillow at gen time → 320 / 640 / 1280 + AVIF + WebP | `<img srcset>` works, `loading="lazy"`, half the page weight |

### 8.3 Why Tailwind v4 over BS5 / plain CSS

- **Tailwind v4 setup = one CSS file, no config.** `@import "tailwindcss"; @theme { --color-*, --font-* }`. Tokens become Tailwind utilities automatically (`bg-paper`, `text-ink-1`, `font-display`).
- **Standalone CLI binary** (Linux/macOS/Windows) = drop-in to `build.sh`; no `package.json`, no `node_modules`, no `npm install` step.
- **Smaller production bundle** than BS5 (~8 KB purged for our component count vs ~30 KB BS5 minified + custom layer).
- **Dark mode primitive** (`dark:bg-paper-dark` etc.) — no manual `[data-theme="dark"]` plumbing.
- **Component count is small** (~10 reusable). Tailwind utilities cover layout, spacing, color; only ~150 LOC of `@layer components { … }` for repeating patterns (`.lyric-line`, `.chord-bar`, etc.).
- **AI-friendly** — class soup in one HTML file beats hopping across 6 CSS files.
- **BS3 → Tailwind cost ≈ BS3 → BS5 cost.** Both = rewriting class names on every template. Tailwind = cleaner endpoint, smaller bundle, less legacy paradigm.

### 8.4 What does **not** change

- No React, no SPA, no client-side router. Each page = real HTML.
- No Node toolchain. Tailwind via standalone binary.
- No CMS. PRs to `pages/` stays the contribution model.

### 8.5 Project structure additions

```
assets/
├── css/
│   ├── input.css             ← @import "tailwindcss" + @theme tokens + @layer components
│   └── (compiled output goes via Tailwind CLI, then django-compress)
├── js/
│   ├── search.js             ← Pagefind UI binding + palette
│   ├── song.js               ← vanilla: transpose, chord toggle, perf-mode
│   ├── theme.js              ← prefers-color-scheme + manual toggle (toggles `.dark` on <html>)
│   ├── nav.js                ← bottom-nav + drawer + scroll-aware app bar
│   ├── lazy-disqus.js        ← IntersectionObserver loader for Disqus
│   └── tooltip.js            ← Floating UI wrapper (~30 LOC)
├── icons/
│   └── sprite.svg            ← Lucide subset, ~12 icons (back, transpose, chord, music, share, star, sun, moon, search, menu, x, expand)
tools/
├── tailwindcss               ← standalone binary, fetched once, committed or in build.sh
└── pagefind                  ← standalone binary
```

`build.sh` becomes:
```bash
set -e
rm -rf out
mkdir out

# Tailwind compile (standalone binary, no Node)
./tools/tailwindcss -i assets/css/input.css -o assets/css/output.css --minify

python manage.py compress --force
python manage.py collectstatic --noinput
RELEASE=1 python manage.py gen

# Pagefind index (after HTML is generated)
./tools/pagefind --site out --output-subdir _pagefind
```

`templates/base.html` becomes a thin shell with `{% block app_bar %}`, `{% block content %}`, `{% block bottom_nav %}` — every page composes from there.

### 8.6 Sample `input.css`

```css
@import "tailwindcss";

@theme {
  --color-paper: #faf7f1;
  --color-card: #ffffff;
  --color-sunken: #f0ece4;
  --color-ink-1: #1a1816;
  --color-ink-2: #4a4540;
  --color-ink-3: #847d74;
  --color-ink-4: #c9c2b8;
  --color-accent: #8b1e2d;
  --color-accent-hover: #6a141f;
  --color-accent-soft: #f4e6e3;
  --color-chord: #2c5f7a;

  --font-display: "Crimson Pro", Georgia, serif;
  --font-body: "Inter Variable", system-ui, sans-serif;
  --font-lyric: "Crimson Pro", Georgia, serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}

@layer components {
  .lyric-line {
    @apply grid grid-cols-[1fr_auto] items-baseline gap-4 py-1
           font-lyric text-[19px] leading-[1.75] text-ink-1;
  }
  .lyric-line .chords {
    @apply font-mono text-[14px] font-semibold text-chord whitespace-nowrap;
  }
  @media (max-width: 480px) {
    .lyric-line { @apply grid-cols-1 gap-0; }
    .lyric-line .chords { order: -1; }
  }

  .chord-bar {
    @apply fixed inset-x-0 bottom-0 z-30 mx-auto flex w-fit gap-2
           rounded-t-2xl border border-ink-4 bg-card p-2 shadow-2xl;
  }
  .chord-bar button {
    @apply grid h-12 w-12 place-items-center rounded-md text-ink-1
           hover:bg-sunken focus-visible:outline focus-visible:outline-2
           focus-visible:outline-accent;
  }
}

/* dark variants applied via `dark:` utility on each class */
```

---

## 9. PWA — first class (separate branch / issue #2)

PWA work happens on a **separate branch** (issue #2), not in the redesign main line. Sequencing: redesign branch lands first → PWA branch rebases on top → ships when stable. Reasoning: PWA installable shell is cheap to add, but installing a broken UX is worse than no install. Land PR1–5 first, then attack issue #2 cleanly.

PWA scope when that branch starts (recap from #2 + this audit):

- `manifest.webmanifest` — name, short_name "Piosenka", `display: standalone`, `theme_color: #8b1e2d` (light) / `#161412` (dark via media), icons 192 / 512 / maskable, start_url `/`.
- Service worker (Workbox or hand-rolled, ~150 LOC):
  - precache: shell (Tailwind output.css, base.js, sprite.svg, fonts, offline.html).
  - runtime cache strategy:
    - HTML: stale-while-revalidate, max 200 song pages
    - CSS/JS: cache-first, version-busted by build
    - images: cache-first, max 100, expire 60 d
- "Install app" prompt: contextual, after user opens 3 different songs (not on first paint).
- "Save offline" star icon on song page → curated offline list, visible in `⭐ Zapisane` bottom-nav tab.
- Wake Lock API in performance mode → screen stays on while singing.
- Web Share API → "Udostępnij" sheet on each song.

**Hooks placed in PR1–5 (redesign branch) so PWA branch has zero retrofit cost:**

- `<meta name="theme-color">` already in `base.html` (PR1).
- `⭐ Zapisane` tab in bottom-nav stub renders empty list when no SW (PR3).
- Wake Lock + share buttons render even without SW; PWA branch wires them.
- `localStorage`-based "saved songs" works without SW; SW only adds offline cache for those entries.

---

## 10. Roadmap — 6 PRs over ~6 working sessions

Sequenced for safety. Each PR ships and is merge-able alone.

### PR 1 — Critical P0 bug fixes (½ day, ships immediately)

Tightly scoped — only P0 audit blockers. PR2 throws out the CSS anyway, so no token foundation here.

- Hard-fix navbar flex so hamburger appears on <768 px (`.navbar-toggle { flex-shrink:0; order:2 }`, `.pzt-collapsed-navbar-search { min-width:0 }`).
- `calendar.js` guard: bail if `CALENDAR_API_KEY` undefined.
- Add `<main>` landmark + skip-link + missing `alt=""` on artist photos / thumbnails.
- Bump `.lyrics` and `input` font to 16 px to stop iOS zoom-on-focus.
- Add `<meta name="theme-color" content="#212121">` placeholder (real value in PR2 tokens).
- Acceptance: nav reachable on iPhone SE, no JS console errors, Lighthouse a11y ≥ 85, no visual regression on desktop.

### PR 2 — Tailwind v4 rewrite + drop jQuery (2–3 days, biggest PR)

- Fetch `tailwindcss` standalone binary into `tools/`, wire into `build.sh`.
- Create `assets/css/input.css` with `@import "tailwindcss"`, `@theme` tokens (light + dark), `@layer components { … }` for repeating patterns.
- Drop `assets/third_party/bootstrap/`, `assets/third_party/jquery/`, `assets/third_party/typeahead/`.
- Rewrite all template files (`templates/**/*.html`) in Tailwind utilities. Keep markup mostly identical, swap classes.
- Rewrite `assets/js/song.js`, `assets/js/comments.js` in vanilla ES2022.
- Replace `glyphicon` with Lucide SVG sprite (12-icon subset).
- Self-host Crimson Pro + Inter + JetBrains Mono (subset Latin Ext + Latin Ext-A), drop Google Fonts.
- Add `theme.js`: respects `prefers-color-scheme`, manual toggle stored in `localStorage`, toggles `.dark` class on `<html>`.
- New `navbar` with proper mobile collapse pattern (`<details>` + small JS).
- Drop FB SDK script entirely.
- Acceptance: zero visual regression on desktop home + 1 song + 1 artist (side-by-side screenshots), JS console clean, Lighthouse perf ≥ 80 mobile, bundle < 100 KB CSS+JS shell.

### PR 3 — Mobile shell: app-bar + bottom-nav + Pagefind palette (1–2 days)

- Implement `app-bar` (sticky top, hides on scroll-down) and `bottom-nav` (4 items: Menu / Szukaj / Zapisane / Tryb) as Tailwind components.
- Wire Pagefind: standalone binary in `tools/`, indexes `out/` after gen.py, output goes to `out/_pagefind/`.
- Build command palette UI (vanilla) on top of Pagefind: Cmd/Ctrl+K opens overlay, results bound to keyboard.
- Redirect `/szukaj/` page to open palette on load.
- `⭐ Zapisane` tab renders saved-songs list from `localStorage` (placeholder for PWA branch).
- Acceptance: nav reachable everywhere on phone, Cmd+K opens search anywhere, Pagefind index built into deploy.

### PR 4 — Song reader rewrite (2 days, biggest visual leap)

- New `pzt-lyric-line` markup (drop `<table>`).
- Sticky `pzt-chord-bar`.
- Performance mode (`⛶` full-screen with WakeLock + horizontal swipe).
- Coordinates with issue #131 (wrapped-line marker).
- Acceptance: read 1788 on iPhone SE in landscape with sun glare — every chord visible, every tap target ≥ 48 px.

### PR 5 — Songbook + artist + home redesign (1–2 days)

- Artist tile grid for `/spiewnik/`, alphabet jumplist, filter chips.
- Artist page hero + grouped song list.
- Home: drop calendar, hero featured opracowanie, latest list, rotating quote restyled.
- Image pipeline: gen.py emits 320/640/1280 AVIF+WebP + JPG fallback, templates use `<img srcset>` + `loading="lazy"`.
- Acceptance: home page transferred ≤ 200 KB on first load.

### PR 6 — Perf polish (1 day, on redesign branch)

- Lazy-load Disqus via IntersectionObserver (already wired in `templates/base/rows/disqus.html`).
- Replace gtag with Plausible (1 KB) or self-hosted Umami.
- Inline critical CSS for above-the-fold (Tailwind output already small, but for FCP).
- Image pipeline tightening: AVIF first, WebP fallback, `<picture>` element.
- Acceptance: Lighthouse perf ≥ 90 mobile on song page, a11y ≥ 95 every page, total shell ≤ 50 KB JS.

**PWA branch (issue #2)** spawns from main after PR6 lands — separate scope, separate PR set.

**Total estimate:** 7–10 working days of focused effort. After PR 6, this is a 2025-grade site.

---

## 11. Out of scope (acknowledged, deferred)

- Native iOS/Android wrapper (Capacitor) — PWA is enough for v1.
- User accounts, favorites sync across devices — localStorage is fine for v1.
- Comments rewrite — Disqus is ugly but works; lazy-load is the win.
- Auto-scroll for long songs (#132).
- Editor / contributor UI on the site — PR-based contribution model stays.

---

## 12. Open decisions for maintainer

a) Color accent — **deep oxblood** (`#8b1e2d`) as proposed, vs forest green (`#1d4d3a`), vs ink-only (no accent, all neutrals + serif weight). All three pass AA. Recommendation: oxblood — gives the site a printed-book feel, distinct from every other guitar-tab site.

b) Lyric typeface — **Crimson Pro** (warm humanist serif), vs Source Serif 4 (more modern), vs EB Garamond (classic). Recommendation: Crimson Pro — variable, free, excellent Polish-character coverage, ~25 KB subset.

c) Search engine — Fuse.js (5 KB) vs MiniSearch (10 KB, BM25 ranking) vs Pagefind (smarter chunking, generated at build). Recommendation: **Pagefind** — designed for static sites, indexes at build, zero runtime config, scales to ~10k pages.

d) Comments — keep Disqus lazy-loaded vs migrate to **Giscus** (GitHub Discussions, fits the project's PR-based ethos perfectly). Recommendation: Giscus, post-PR-6.

e) Performance mode swipe — left/right between songs in artist's list, vs left/right between paragraphs of same song. Recommendation: between songs (matches mental model of a paper songbook).

---

## 13. Success metrics

After PR 6, measure on real production traffic for 30 days:

- Lighthouse mobile perf ≥ 90 on song page
- Lighthouse mobile a11y ≥ 95 on every page
- Mobile bounce rate (GA) drops ≥ 25 % on song pages
- ≥ 5 % of weekly mobile users install PWA within 60 days
- Time-on-song increases (proxy for "they're actually singing along")
- Zero JS console errors in production

If those land, this site became "mega świetna, piękna, super użyteczna i zmodernizowana" — by any measurable definition.

---

## 14. Inspiration / reference

- [Genius.com](https://genius.com) — what NOT to do (ad-heavy, distracting). We're the opposite.
- [Tufte CSS](https://edwardtufte.github.io/tufte-css/) — typography & sidenotes
- [Penguin Classics covers](https://www.penguin.co.uk/series/PCLAS/penguin-classics) — restraint, identity through type
- [Apple Books Reader](https://www.apple.com/apple-books/) — page transitions, type controls
- [Substack reader](https://substack.com/) — long-form rhythm
- [Songsterr](https://www.songsterr.com/) — interactive guitar features (we don't go that far, but cf. their mobile chord-stick UX)
- [Pagefind demo](https://pagefind.app/) — static-site search done right
