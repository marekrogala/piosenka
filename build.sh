set -e
rm -rf out
mkdir out
# Tailwind v4: compile input.css -> output.css (must run before collectstatic).
# @source directives in input.css drive class detection across templates + JS.
./tools/tailwindcss -i assets/css/input.css -o assets/css/output.css --minify
python manage.py compress --force
python manage.py collectstatic --noinput
RELEASE=1 python manage.py gen