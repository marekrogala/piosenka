set -e
rm -rf out
mkdir out

# Fetch Tailwind binary on first run
if [ ! -x tools/tailwindcss ]; then
  echo "Tailwind binary missing at tools/tailwindcss"
  exit 1
fi

# Fetch Pagefind binary on first run
if [ ! -x tools/pagefind ]; then
  PF_VER="v1.5.2"
  PF_OS="$(uname -s)"
  PF_ARCH="$(uname -m)"
  case "$PF_OS-$PF_ARCH" in
    Darwin-arm64)  PF_ASSET="pagefind_extended-${PF_VER}-aarch64-apple-darwin.tar.gz" ;;
    Darwin-x86_64) PF_ASSET="pagefind_extended-${PF_VER}-x86_64-apple-darwin.tar.gz" ;;
    Linux-x86_64)  PF_ASSET="pagefind_extended-${PF_VER}-x86_64-unknown-linux-musl.tar.gz" ;;
    Linux-aarch64) PF_ASSET="pagefind_extended-${PF_VER}-aarch64-unknown-linux-musl.tar.gz" ;;
    *) echo "Unsupported platform: $PF_OS-$PF_ARCH"; exit 1 ;;
  esac
  echo "Fetching Pagefind ${PF_VER} for ${PF_OS}-${PF_ARCH}..."
  curl -sL "https://github.com/Pagefind/pagefind/releases/download/${PF_VER}/${PF_ASSET}" -o /tmp/pagefind.tar.gz
  tar -xzf /tmp/pagefind.tar.gz -C tools/
  mv tools/pagefind_extended tools/pagefind
  chmod +x tools/pagefind
fi

# Tailwind v4: compile input.css -> output.css (must run before collectstatic).
# @source directives in input.css drive class detection across templates + JS.
./tools/tailwindcss -i assets/css/input.css -o assets/css/output.css --minify
python manage.py compress --force
python manage.py collectstatic --noinput
RELEASE=1 python manage.py gen

# Pagefind index — runs AFTER gen.py so the generated HTML is indexed.
./tools/pagefind --site out --output-subdir _pagefind --quiet
