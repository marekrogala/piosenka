"""
Responsive image pipeline for the static site generator.

For each source image (a remote URL to a Google Cloud Storage file) we
download it once, generate WebP + JPG variants at 320/640/1280 wide, and
write them under out/static/img-variants/. Templates then point at the
locally served variants via a `<picture>` partial.

Variants are keyed by the SHA1 of the source URL so duplicates collapse
and re-runs of the build are idempotent (we skip files that already
exist on disk).
"""

import hashlib
import os
import re
import urllib.request
from urllib.parse import urlparse, quote

from PIL import Image, ImageOps

VARIANT_WIDTHS = (320, 640, 1280)
VARIANT_FORMATS = ("webp", "jpg")
JPEG_QUALITY = 82
WEBP_QUALITY = 78

# Resolved at import time from gen.py constants.
_OUT_DIR = None
_VARIANTS_SUBDIR = "static/img-variants"
_DOWNLOAD_CACHE_DIR = None  # filled lazily; lives outside out/ to survive cleans

# In-process cache: url -> ResponsiveImage
_url_cache = {}


class ResponsiveImage:
    """Holds the generated variants for a single source image."""

    __slots__ = ("base_url", "width", "height", "is_square_crop")

    def __init__(self, base_url, width, height, is_square_crop=False):
        self.base_url = base_url  # e.g. "/static/img-variants/abc123"
        self.width = width  # natural width of the largest variant
        self.height = height  # natural height of the largest variant
        self.is_square_crop = is_square_crop


def configure(out_dir, root_path):
    """Initialize module-level paths. Call once from gen.py."""
    global _OUT_DIR, _DOWNLOAD_CACHE_DIR
    _OUT_DIR = out_dir
    _DOWNLOAD_CACHE_DIR = os.path.join(root_path, ".cache", "img-source")
    os.makedirs(_DOWNLOAD_CACHE_DIR, exist_ok=True)
    os.makedirs(os.path.join(_OUT_DIR, _VARIANTS_SUBDIR), exist_ok=True)


def _slug_for_url(url):
    """Stable, filesystem-safe key for a source URL."""
    h = hashlib.sha1(url.encode("utf-8")).hexdigest()[:16]
    # Append a hint of the original filename for debuggability.
    name = os.path.basename(urlparse(url).path) or "img"
    name = re.sub(r"[^A-Za-z0-9._-]", "_", name)[:48]
    return f"{h}-{name}"


def _download_to_cache(url):
    """Download URL into local cache dir, return local path. Cached on disk."""
    slug = _slug_for_url(url)
    cache_path = os.path.join(_DOWNLOAD_CACHE_DIR, slug)
    if os.path.exists(cache_path) and os.path.getsize(cache_path) > 0:
        return cache_path
    try:
        # Percent-encode non-ASCII characters in the path while leaving the
        # scheme/host alone. Sources include filenames with Polish/Spanish chars.
        parsed = urlparse(url)
        encoded_path = quote(parsed.path, safe="/%")
        safe_url = parsed._replace(path=encoded_path).geturl()
        req = urllib.request.Request(safe_url, headers={"User-Agent": "piosenka-gen/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp, open(cache_path, "wb") as f:
            f.write(resp.read())
        return cache_path
    except Exception as exc:  # network error, dead URL etc.
        print(f"[imageutils] download failed for {url}: {exc}")
        return None


def _save_variant(img, out_path, fmt):
    """Save `img` (Pillow image) as fmt to out_path."""
    if fmt == "webp":
        img.save(out_path, format="WEBP", quality=WEBP_QUALITY, method=6)
    elif fmt == "jpg":
        rgb = img.convert("RGB") if img.mode != "RGB" else img
        rgb.save(out_path, format="JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
    else:
        raise ValueError(f"unknown fmt {fmt}")


def _resize_for_width(img, target_w):
    """Resize preserving aspect; returns new image."""
    w, h = img.size
    if w <= target_w:
        return img.copy()
    ratio = target_w / float(w)
    new_h = max(1, int(round(h * ratio)))
    return img.resize((target_w, new_h), Image.LANCZOS)


def _square_crop(img, target_w):
    """Center-crop to a square then resize to target_w x target_w."""
    w, h = img.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    cropped = img.crop((left, top, left + side, top + side))
    if side == target_w:
        return cropped
    return cropped.resize((target_w, target_w), Image.LANCZOS)


def get_or_build(url, square=False):
    """
    Return a ResponsiveImage for the given remote URL.

    If square=True the variants are center-cropped to a square (used for
    artist tiles & the artist hero portrait).

    Returns None if the source could not be downloaded — callers should
    gracefully fall back to the original URL.
    """
    if not url:
        return None
    cache_key = (url, square)
    if cache_key in _url_cache:
        return _url_cache[cache_key]

    src_path = _download_to_cache(url)
    if not src_path:
        return None

    slug = _slug_for_url(url) + ("-sq" if square else "")
    base_rel = f"/{_VARIANTS_SUBDIR}/{slug}"
    out_dir = os.path.join(_OUT_DIR, _VARIANTS_SUBDIR)

    # Open once.
    try:
        with Image.open(src_path) as im:
            im.load()
            # Apply EXIF orientation so portraits come out the right way up.
            im = ImageOps.exif_transpose(im)
            largest_w = 0
            largest_h = 0
            for w in VARIANT_WIDTHS:
                if square:
                    variant = _square_crop(im, w)
                else:
                    variant = _resize_for_width(im, w)
                vw, vh = variant.size
                if vw > largest_w:
                    largest_w = vw
                    largest_h = vh
                for fmt in VARIANT_FORMATS:
                    out_path = os.path.join(out_dir, f"{slug}-{w}.{fmt}")
                    if os.path.exists(out_path) and os.path.getsize(out_path) > 0:
                        continue  # idempotent
                    _save_variant(variant, out_path, fmt)
    except Exception as exc:
        print(f"[imageutils] processing failed for {url}: {exc}")
        return None

    result = ResponsiveImage(
        base_url=base_rel,
        width=largest_w,
        height=largest_h,
        is_square_crop=square,
    )
    _url_cache[cache_key] = result
    return result


def picture_context(url, alt="", sizes=None, square=False, css_class=""):
    """
    Return a context dict for the responsive_image.html partial.
    """
    if sizes is None:
        sizes = "(max-width: 600px) 50vw, (max-width: 1024px) 33vw, 25vw"
    ri = get_or_build(url, square=square)
    if ri is None:
        # Fallback: render the original URL with width/height stripped.
        return {
            "fallback_src": url,
            "alt": alt,
            "sizes": sizes,
            "css_class": css_class,
            "ri": None,
        }
    # Reference width/height for the "default" 640w variant.
    if square:
        width = 640
        height = 640
    else:
        # Best estimate using natural ratio of the largest variant.
        width = 640
        height = int(round(ri.height * (640.0 / max(1, ri.width)))) if ri.width else 640
    return {
        "ri": ri,
        "alt": alt,
        "sizes": sizes,
        "css_class": css_class,
        "width": width,
        "height": height,
    }
