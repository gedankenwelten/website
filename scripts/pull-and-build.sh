#!/bin/bash
# pull-and-build.sh — der Pi baut die Astro-Fassung selbst (Sicherheitsnetz).
#
# Tagsüber schippert der Mac (gwship). Dieser Lauf hängt am 03:00-Cron und
# holt auf, falls tagsüber nichts kam: Inhalt (GitHub) und Projekt (Forgejo)
# ziehen, bauen, atomar tauschen — mit demselben Lock wie swap-public.sh.
#
# Erwartet:
#   /home/luc/services/gedankenwelten          Inhalt (content/) + public/ (Caddy-Root)
#   /home/luc/services/gedankenwelten-neu/src  dieses Projekt (Forgejo-Klon, node_modules installiert)

set -euo pipefail

INHALT_REPO="/home/luc/services/gedankenwelten"
PROJEKT="/home/luc/services/gedankenwelten-neu/src"
LOG="[$(date '+%F %T')] pull-and-build (astro)"

exec 200>/tmp/gw-build.lock
flock -n 200 || { echo "$LOG: build/swap läuft bereits — übersprungen"; exit 0; }

cd "$INHALT_REPO"
ALT_INHALT=$(git rev-parse HEAD); git fetch origin --quiet; NEU_INHALT=$(git rev-parse origin/main)
cd "$PROJEKT"
ALT_PROJ=$(git rev-parse HEAD); git fetch origin --quiet; NEU_PROJ=$(git rev-parse origin/main)

if [ "$ALT_INHALT" = "$NEU_INHALT" ] && [ "$ALT_PROJ" = "$NEU_PROJ" ] && [ -f "$INHALT_REPO/public/index.html" ]; then
  exit 0
fi
echo "$LOG: Inhalt $ALT_INHALT → $NEU_INHALT · Projekt $ALT_PROJ → $NEU_PROJ"

# Nur vorspulen — beide Klone werden hier nie von Hand geändert.
cd "$INHALT_REPO" && git merge --ff-only origin/main --quiet
cd "$PROJEKT" && git merge --ff-only origin/main --quiet
if [ "$ALT_PROJ" != "$NEU_PROJ" ] || [ ! -d node_modules ]; then npm ci --silent; fi

# Bauen — Inhalt liegt hier nicht unter ~/Gedankenwelten, sondern im Service-Ordner.
# `public/assets` ist auf dem Mac ein Symlink in den Pool (Banner) und nicht im
# Repo — hier zeigt er auf den Service-Ordner. Ohne ihn bricht Vite beim
# Kopieren von public/ ab (ENOENT, 05.09.).
ln -sfn "$INHALT_REPO/content/assets" public/assets
rm -rf dist
GW_INHALT="$INHALT_REPO/content" NOINDEX=0 nice -n 10 ionice -c2 -n7 npm run build --silent
[ -f dist/index.html ] || { echo "$LOG: Build unvollständig — kein Swap"; exit 1; }

rm -rf "$INHALT_REPO/public_new"
cp -r dist "$INHALT_REPO/public_new"
chmod -R o+r "$INHALT_REPO/public_new"

cd "$INHALT_REPO"
rm -rf public_old
[ -e public ] && mv public public_old
mv public_new public
rm -rf public_old

python3 "$INHALT_REPO/scripts/indexnow_ping.py" || true
echo "$LOG: fertig, neue Version live"
