#!/usr/bin/env bash
# Headless Chrome screenshots at common mobile/desktop widths.
set -euo pipefail
CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
OUT_DIR="$(cd "$(dirname "$0")" && pwd)"
BASE_URL="${BASE_URL:-http://localhost:8002}"

shoot () {
  local name="$1" url="$2" w="$3" h="$4"
  "$CHROME" --headless=new --hide-scrollbars --no-sandbox --disable-gpu \
    --force-device-scale-factor=1 \
    --window-size="${w},${h}" \
    --screenshot="${OUT_DIR}/${name}_${w}.png" \
    "${BASE_URL}${url}" > /dev/null 2>&1
}

# routes: home / spiewnik / song / artist / search
shoot home       /                                       375 800
shoot home       /                                      1024 900
shoot spiewnik   /spiewnik/                              375 800
shoot spiewnik   /spiewnik/                             1024 900
shoot song       /opracowanie/jacek-kaczmarski-1788/     375 1100
shoot song       /opracowanie/jacek-kaczmarski-1788/    1024 1100
shoot artist     /spiewnik/jacek-kaczmarski/             375 1100
shoot artist     /spiewnik/jacek-kaczmarski/            1024 1100
shoot search     /szukaj/                                375 800
shoot search     /szukaj/                               1024 900
shoot zapisane   /zapisane/                              375 800
shoot zapisane   /zapisane/                             1024 900
echo "done"
