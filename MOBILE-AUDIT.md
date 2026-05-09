# MOBILE-AUDIT.md

UX audit for issue [#3 — Mobile UX audit + Bootstrap 3 → 5 migration](https://github.com/marekrogala/piosenka/issues/3).

Scope: web + mobile (PWA candidate). Real breakpoints: 320 / 375 / 414 / 768 / 1024 px.
Audit method: static build (`bash build.sh` → `out/`), served on `localhost:8002`,
headless Chrome screenshots per breakpoint, Lighthouse mobile (form-factor=mobile)
on 5 representative pages, manual template/CSS inspection.

Date: 2026-05-04. Branch: `claude/ecstatic-hawking-9eccb1`. Commit base: `65b8bfd3`.

Screenshots: [`MOBILE-AUDIT-screenshots/`](MOBILE-AUDIT-screenshots/).

---

## TL;DR

The site is **not usable on mobile in its current state**. Three blockers:

1. **Navigation is unreachable on phones (<768 px).** Hamburger button gets squeezed off-screen by the always-visible search input. Users on iPhone SE/12/14 cannot open the menu. **P0.**
2. **Chord-display table breaks layout on phones.** Lyrics + chords sit in a fixed two-column `<table>`; on 320/375/414 px the chord column is clipped off the right edge or wraps mid-symbol (`G A h (G`). Core feature unusable. **P0.**
3. **All touch targets are sub-spec.** Transposition buttons are `btn-sm` (~30 × 30 px), well below Apple HIG 44 × 44 / Material 48 × 48. Lighthouse `target-size` audit fails on every long page. **P0.**

Plus systemic issues: BS3 = 0 mobile-first utilities, no PWA artifacts, `font-size: 14px` on lyrics, render-blocking JS bundle from jQuery 2.1.1 + Typeahead + BS3 + FB SDK, no service worker, no manifest, JS reference error in production build (`CALENDAR_API_KEY is not defined`).

---

## Lighthouse Mobile (form-factor=mobile, headless Chrome 13.2.0)

| Page | Perf | A11y | BP | SEO |
|------|------|------|----|-----|
| `/` | 58 | 80 | 73 | 91 |
| `/spiewnik/` | 67 | 79 | 73 | 91 |
| `/spiewnik/jacek-kaczmarski/` (artist, 246 songs) | 65 | 73 | 73 | 91 |
| `/opracowanie/jacek-kaczmarski-1788/` (song) | 56 | 72 | 50 | 91 |
| `/szukaj/` | 60 | 94 | 73 | 100 |

Issue target: **Perf ≥ 90, A11y ≥ 95** — currently miss across the board.

Cross-page failing audits:

- `target-size`: failing on `/`, `/spiewnik/`, artist (246 hits), song
- `color-contrast`: failing every page (artist link blue on light bg)
- `image-alt`: failing every page with imagery
- `landmark-one-main`: every page — no `<main>` landmark
- `image-size-responsive`: every page — no `srcset`
- `unused-css-rules`: ~92 KiB bs3 css
- `unused-javascript`: ~234 KiB jQuery + Typeahead + BS3 + FB SDK
- `errors-in-console`: `ReferenceError: CALENDAR_API_KEY is not defined` (calendar.js, build-time injection broken)
- `cache-insight`: missing efficient cache lifetimes
- `frame-title` (song): YouTube `<iframe>` has no `title=`
- `link-name` (artist): `<a>` containing only image with no alt text

Song page Web Vitals (mobile, throttled): **FCP 9.4 s, LCP 19.8 s, CLS 0, TBT 50 ms**.
LCP destroyed by render-blocking compressed CSS bundle + Google Fonts + jQuery
in `<body>` end. CLS=0 is the only good metric.

---

## 6-Pillar Scoring

| Pillar | Score | Note |
|--------|-------|------|
| Copywriting | 3/4 | Polish copy is on-brand, literary, consistent. Small issue: header hero text is truncated on narrow viewports because parent has no overflow handling. |
| Visuals | 2/4 | Patterned paper background, hand-set headers — has character. Lacks responsive imagery (`srcset`/`loading="lazy"`), no icon system beyond legacy `glyphicon` (BS3 — fonts removed in BS5). |
| Color | 2/4 | Blue (`#0088cc`) link/accent + maroon (`#990000`) cards is OK on desktop. Contrast fails Lighthouse on link blue against patterned paper background. No dark-mode hooks (issue #133). |
| Typography | 1/4 | Body copy `font-size: 14px` (too small for mobile reading), `<h1>` 40 px hard-coded (overflows 320 px viewport on long titles), Ubuntu webfont blocks render with no `font-display: swap`. Search/text inputs rely on browser default; iOS Safari will zoom on focus when input font is < 16 px. |
| Spacing | 2/4 | Card-style `.section` padding is fine; lyrics use `<table>` so cell spacing is rigid and non-responsive. `.col-md-*` only — no `.col-sm-*` fallback, so phone layout collapses to 100 % stacked but sidebar content (YouTube embed, scores) loses prominence. |
| Experience Design | 1/4 | Nav inaccessible on phone (P0). Transposition controls thumb-distance ignored (top-right of header, not sticky/bottom). No PWA offline. Search field appears in two places (collapsed + expanded) — confusing. No skip-link, no `<main>`, no focus-visible styling. |

**Total: 11 / 24.** Clear "rebuild" territory for mobile, "keep but harden" territory for desktop.

---

## P0 — Blockers (must fix before public mobile push / PWA install)

### P0-1. Hamburger button squeezed off-screen on <768 px

- **Where:** [templates/base.html:42-56](templates/base.html#L42-L56), [assets/css/style.css:53-66](assets/css/style.css#L53-L66).
- **What:** `.navbar-header` is `display: flex`. `.pzt-collapsed-navbar-search { flex-grow: 1 }` lets the search input expand to all available width, pushing `.navbar-toggle` past the viewport edge. Visible in [`song_320.png`](MOBILE-AUDIT-screenshots/song_320.png), [`song_375.png`](MOBILE-AUDIT-screenshots/song_375.png), [`home_375.png`](MOBILE-AUDIT-screenshots/home_375.png) — no hamburger anywhere.
- **Impact:** Phone users cannot reach `/spiewnik/`, `/artykuly/`, `/o-stronie/` from any page except via direct link or back-button. Since this site is content-discovery-driven, this kills the funnel.
- **Fix:** in BS5 migration, replace navbar HTML with `navbar-expand-lg` pattern. Until then, hard-fix: give `.navbar-toggle` `flex-shrink: 0` and `order: 2`, give search `min-width: 0`. Better — hide the in-header search on <768 px and rely on a dedicated search icon in the navbar.

### P0-2. Chord column in lyrics table overflows / clips on phone

- **Where:** [templates/songs/lyrics.html](templates/songs/lyrics.html), rendered as `<table>` with two `<td>`s per line. See [`song_320.png`](MOBILE-AUDIT-screenshots/song_320.png) — last line shows `D` cut by viewport edge; on 768 chord cluster `(G D A)` wraps mid-symbol.
- **Impact:** chords are the reason this site exists. They're missing or unreadable on 60 %+ of mobile traffic.
- **Fix:** drop the `<table>` layout. Render each lyric line as a flex row (or grid) with: `[lyric] [chords (right-aligned, wrap allowed)]`. Cap lyric column at `min(60ch, 70%)`, chord column gets remainder, `white-space: nowrap` per chord cluster, `flex-wrap: wrap` on row. Or stacked layout on narrow: chord above word (current style on guitar-tab sites). Decision needed in #131.

### P0-3. Touch targets fail HIG/Material everywhere

- **Where:** transposition `btn-sm` ([templates/songs/song.html:56-77](templates/songs/song.html#L56-L77)), songbook artist link list ([templates/songs/artist.html:21-31](templates/songs/artist.html#L21-L31)) — densely packed `<li>` rows under default line-height, search input `height: 30px` ([assets/css/search.css:15-18](assets/css/search.css#L15-L18)).
- **Impact:** mistap rate. Lighthouse fails `target-size` with 246 violations on Kaczmarski page alone.
- **Fix (post-BS5):** `.btn` default in BS5 already meets 38 px; bump transposition controls to `btn-lg` on mobile (`.btn-lg{ min-height: 48px; min-width: 48px; }`). Add `padding: 8px 0` to song-list `<li>`, set `min-height: 44px` on tappable `<a>`.

### P0-4. JS console error breaks `calendar.js` in prod build

- **Where:** built bundle (`/static/CACHE/js/output.55908e98be1f.js`); root cause: `frontpage_context["calendar_api_key"]` from `private_gen_vars.yaml` is injected into `calendar.js` template at gen time. Fail mode: when var missing or build path skipped, the JS references undefined `CALENDAR_API_KEY`. Lighthouse logs: `ReferenceError: CALENDAR_API_KEY is not defined`.
- **Impact:** drops Best Practices score from ~90 to 50 on every page that includes calendar.js. Probably also stops events from rendering on home page.
- **Fix:** wrap calendar.js with a guard (`if (typeof CALENDAR_API_KEY === 'undefined') return;`) and fail loudly at build time when `private_gen_vars.yaml` is missing required keys (don't just `open()` — validate). Long-term: serve calendar from a static JSON snapshot built at deploy, no API key in client.

---

## P1 — Important (mobile feels broken without these)

### P1-1. Body / lyrics font too small for mobile

- `assets/css/song.css:59` — `.lyrics { font-size: 14px }`.
- iOS reading guidance is ≥ 16 px. 14 px on a high-DPR phone is fatiguing for a 4-stanza song.
- Fix: 16 px base for `.lyrics`, scale down only on print media. Re-test wrap behavior.

### P1-2. Inputs zoom-on-focus on iOS

- The two search inputs and the embedded GCSE search field rely on `form-control` defaults; iOS Safari triggers viewport zoom when the focused input has `font-size < 16px`.
- Fix: `input, select, textarea { font-size: 16px; }` baseline (wrap in `@media (max-width: 768px)` if you want 14 px on desktop).

### P1-3. No `<main>` landmark, no skip-link, missing alt text

- Lighthouse `landmark-one-main` and `image-alt` fail every page. Add `<main role="main">` wrapping `{% block content %}` in `templates/base.html`. Add `<a class="visually-hidden-focusable" href="#main">Przejdź do treści</a>` as first body element. Backfill alt text on artist thumbnails (templates/components/thumbnail.html etc.).

### P1-4. Transposition controls not thumb-reachable / not sticky

- Currently in upper-right `.song-gadget` block. On a long song the user scrolls 3+ screens away from controls.
- Fix: on mobile, render the gadget as a sticky bottom bar (CSS `position: sticky; bottom: 0;` or fixed within a safe-area-aware container). Same controls — same JS.

### P1-5. Typeahead + jQuery + BS3 = 234 KiB unused JS

- jQuery 2.1.1 is used by `song.js` (DOM toggling), `comments.js`, BS3 collapse/dropdown, Typeahead. BS5 drops jQuery; rewriting `song.js` ~80 LOC in vanilla is straightforward.
- Defer to issue [#63 — drop jQuery] but coordinate so BS3→BS5 PR removes the BS3 ones in same change.

### P1-6. Render-blocking CSS bundle and webfont

- `bootstrap.css` + 4 site CSS files compressed into one 92 KiB blob, render-blocking in `<head>`. Google Fonts `link rel=stylesheet` blocks paint. FCP at 9.4 s on song page is dominated by this.
- Fix: inline critical CSS for above-the-fold (header + first lyric paragraph), defer the rest. `link rel=preconnect` for fonts.googleapis. `font-display: swap`.

### P1-7. No `srcset` on artist photos / thumbnails

- All Artist pages serve full-resolution JPG/PNG even at 320 px. Lighthouse `image-size-responsive` fails site-wide. Add `srcset` with 320/640/1280 variants in `templates/components/thumbnail.html`. Generator already produces thumbnails — wire them up.

### P1-8. Color contrast on link colors over patterned paper

- `body` has `groovepaper.png` background; link blue `#0088cc` over the textured tile fails WCAG AA in spots.
- Fix: switch link color to `#0066a0` (passes AA on both `#fff` and the pattern), or add white card backing under text-heavy areas (already mostly there via `.section`).

---

## P2 — Nice-to-haves (mostly post-migration)

- **P2-1.** Songbook (`/spiewnik/`) renders as 1-col stack of huge artist photo cards on mobile (see [`spiewnik_375.png`](MOBILE-AUDIT-screenshots/spiewnik_375.png)). With ~50+ artists this is a long scroll. Consider a 2-column tile grid at 375 px+ (gap-2 g-2) and a sticky alphabet jumplist on the right.
- **P2-2.** Long artist pages (Kaczmarski has 246 songs in one `<ul>`). Lighthouse `dom-size` flagged. Add letter sectioning (`<h3>A</h3>` group) + back-to-top button.
- **P2-3.** Search lives in three places (header collapsed, header expanded, dedicated `/szukaj/`) and is implemented two different ways (Typeahead JSON for header, Google CSE for `/szukaj/`). Unify to one in-page experience.
- **P2-4.** Footer is a single-line copyright in tiny font. Add minimum: link to GitHub repo, email, accessibility statement, RSS link to `/blog/`.
- **P2-5.** No back-to-top button on long pages.
- **P2-6.** YouTube `<iframe>` uses no `loading="lazy"`, no `title`, no `srcdoc` placeholder. Both fix Lighthouse `frame-title` and improve LCP.
- **P2-7.** `<table>`-based lyrics block screen-readers; switch to semantic `<p>` paragraphs with chord spans. Reading order will be correct without ARIA hacks.
- **P2-8.** `body { background: url(groovepaper.png) }` repeats as a tile — adds a 5–10 KB request on every page, decorative-only. Replace with CSS `background: linear-gradient(...)` or a smaller SVG noise.
- **P2-9.** Replace `glyphicon` (BS3 font, removed in BS5) with Bootstrap Icons SVG sprite (small, no font load).
- **P2-10.** `_unidecode`-style `id`s in chord spans (`chords-t0..t11`) are fine but transposition iterates 12 hide/show calls per click; minor — vanilla rewrite can replace with a single class-swap.

---

## PWA Readiness Gap (for issue #2)

This audit's PWA evaluation: **not currently installable**.

| Requirement | Status |
|-------------|--------|
| `viewport` meta | ✓ (`width=device-width, initial-scale=1.0`) |
| HTTPS | ✓ (in production — Firebase Hosting) |
| `manifest.webmanifest` | ✗ — no manifest exists in `templates/` or `assets/` |
| `<link rel="manifest">` | ✗ |
| Service worker | ✗ — no `sw.js`, no `navigator.serviceWorker.register(...)` |
| Maskable icon set (192/512) | ✗ — only `feather_40.png` and `favicon.ico` |
| `theme-color` meta | ✗ |
| `apple-touch-icon` | ✗ |
| Offline fallback | ✗ |

Implication for issue #3 (this audit) feeding into issue #2 (PWA): **fix the mobile UX P0/P1 before shipping the manifest**, otherwise we ship an installable "app" that's broken on the device it installs to. Specific PWA-relevant fixes from above:

- P0-1 (nav reachable) — without it, an installed PWA can only navigate via back/forward.
- P1-2 (no input zoom) — installed PWA in standalone mode looks bad if every tap zooms.
- P1-6 (perf) — service-worker offline-first cache cannot mask 19.8 s LCP; fix the source first.
- Add `<meta name="theme-color" content="#212121">` (matches navbar inverse) and `<link rel="apple-touch-icon">` while editing `base.html` for BS5.

---

## BS3 → BS5 migration notes (Phase 2)

This audit confirms the issue's premise: BS3 is the root cause of items P0-1, P0-3, parts of P1-1/P1-2, and the 234 KiB JS dead weight. Concrete migration touch points discovered:

| BS3 in code | BS5 replacement |
|--------------|-----------------|
| `navbar navbar-inverse navbar-fixed-top` | `navbar navbar-dark bg-dark fixed-top navbar-expand-lg` |
| `navbar-toggle` + `data-toggle="collapse"` | `navbar-toggler` + `data-bs-toggle="collapse"` |
| `navbar-ex1-collapse`, `navbar-collapse` | `collapse navbar-collapse` (data-bs-target) |
| `.col-md-*` only | add `.col-12 .col-md-*` so phone gets explicit full-width |
| `glyphicon glyphicon-arrow-up/-home/-arrow-down/-music/-font/-question-sign` | Bootstrap Icons SVG (`bi-arrow-up`, `bi-house`, …) |
| `btn-default` | `btn-secondary` |
| `hidden-print` | `d-print-none` |
| `pull-left/right` (search if used) | `float-start/end` (or flex utilities) |
| `data-toggle="tooltip"` | `data-bs-toggle="tooltip"` (and JS init via vanilla `bootstrap.Tooltip`) |
| `well`, `panel`, `panel-default` | `card`, `card-body` |
| `form-control` height defaults | BS5 has 38 px / `form-control-lg` for 48 px on mobile |
| jQuery typeahead | swap to vanilla [Awesomplete](https://leaverou.github.io/awesomplete/) or native `<datalist>` (smaller, no jQuery) |

Custom CSS overrides (`assets/css/*.css`) to revisit during migration:

- `.section` re-implements `.card` — drop the custom rule, use `.card`.
- `body { padding-top: 41px }` is to clear `navbar-fixed-top` height — recompute for BS5 navbar height (~56 px).
- `.lyrics` blue left border — keep as opinion, but move to a new namespaced class (don't fight `blockquote` defaults).
- `.tip` color hardcoded to BS3's `#428bca` — replace with `var(--bs-link-color)`.

---

## Recommended sequencing

1. **PR 1 — non-BS3 P0 fixes** (small, safe to ship first):
   - Guard `calendar.js` against missing `CALENDAR_API_KEY` (P0-4).
   - Hard-fix the navbar flex order so hamburger appears (P0-1 stop-gap).
   - Add `<main>` landmark + skip-link + alt text backfill (P1-3).
   - Bump `.lyrics` font to 16 px and inputs to 16 px (P1-1, P1-2).
2. **PR 2 — BS3 → BS5 migration** (this is the big one). Branch off `main` after PR 1; do this as a single PR so reviewers can see the whole conversion. Keep template visual diff manageable by going file-by-file in commits.
3. **PR 3 — chord layout rewrite** (P0-2). Coordinate with issue #131 (highlight wrapped lines). Replace `<table>` with flex/grid; A/B before merge using same Kaczmarski 1788 page.
4. **PR 4 — sticky transposition + bottom-nav exploration** (P1-4). Optional bottom-nav prototype.
5. **PR 5 — perf** (P1-5/6/7): drop jQuery, lazy-load images, `srcset`, font-display swap, defer non-critical CSS.
6. **PR 6 — PWA wiring** (issue #2): manifest, icons, theme-color, service worker (offline cache for last-viewed song + songbook).

After PR 5: re-run Lighthouse, target ≥ 90 perf, ≥ 95 a11y.

---

## Open questions for the maintainer (decisions that affect Phase 2/3)

a) Bootstrap Icons vs Phosphor vs hand-rolled SVG sprite — recommend **Bootstrap Icons** (matches BS5, ~70 KB sprite, MIT). Fine for desktop; subset the SVG sprite for mobile.

b) Custom design tokens (CSS vars) on top of BS5, or stock BS5? — recommend **CSS vars on top**, scoped under `:root` and `[data-theme="dark"]`, so dark mode (#133) is one media-query away.

c) Tailwind/PostCSS pipeline? — **no for now**. Keep plain CSS + django-compress. The site is small enough that the build complexity is not worth it; revisit if a designer joins.

d) Songbook list virtualization — **not yet**. ~50 artists × 1 row each is fine. Kaczmarski's 246-song page deserves alphabet sectioning (P2-2) before any virtualization.

e) Drop `<table>` for lyrics — **yes**. Concrete proposal in P0-2 / coordinate with #131.

---

## Artifacts

- Screenshots (5 viewports × 5 pages + 3 long): [`MOBILE-AUDIT-screenshots/`](MOBILE-AUDIT-screenshots/)
- Lighthouse JSON reports: `/tmp/lh-audit/{home,song,spiewnik,artist,search}_lh.json` (not committed; rerun with the audit script in this PR)
- Audit script (re-runnable):
  ```bash
  bash build.sh
  (cd out && python3 -m http.server 8002 &)
  # screenshots
  CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  for w in 320 375 414 768 1024; do
    "$CHROME" --headless=new --hide-scrollbars --window-size=${w},900 \
      --screenshot=song_${w}.png http://localhost:8002/opracowanie/jacek-kaczmarski-1788/
  done
  # lighthouse
  npx lighthouse http://localhost:8002/opracowanie/jacek-kaczmarski-1788/ \
    --form-factor=mobile --output=html --output-path=./song_lh.html \
    --chrome-flags="--headless=new"
  ```
