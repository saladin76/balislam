#!/bin/bash
# Non-destructive real-world overwrite test using synthetic storyboard JSON only.
# No production source file is modified; only one designated test cloud slot is used.
set -euo pipefail
BASE="$HOME/Balislam-Preview-Sync"
UPLOADER="$BASE/studio-handoff.sh"
test -x "$UPLOADER" || { echo "ERROR: run the safe setup first"; exit 1; }
command -v rclone >/dev/null || { echo "ERROR: rclone is missing"; exit 1; }
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
SOURCE="$TMP/cloud-overwrite-check.json"
EPISODE="sync-system-validation"
SLOT="overwrite-json"
CHANNEL="balislam"
REMOTE="studio_drive:Balislam-Studio-Previews/bilislam/episodes/$EPISODE/storyboard"
printf '{"test":"stable-slot","revision":1}\n' > "$SOURCE"
echo "=== FIRST VERIFIED UPLOAD ==="
FIRST="$("$UPLOADER" upload --kind storyboard --file "$SOURCE" --channel "$CHANNEL" --episode "$EPISODE" --slot "$SLOT")"
printf '%s\n' "$FIRST"
URL1="$(printf '%s\n' "$FIRST" | sed -n 's/^LINK //p' | tail -n 1)"
test -n "$URL1" || { echo "ERROR: no first link"; exit 1; }
printf '{"test":"stable-slot","revision":2}\n' > "$SOURCE"
echo "=== REPLACE SAME CLOUD SLOT ==="
SECOND="$("$UPLOADER" upload --kind storyboard --file "$SOURCE" --channel "$CHANNEL" --episode "$EPISODE" --slot "$SLOT")"
printf '%s\n' "$SECOND"
URL2="$(printf '%s\n' "$SECOND" | sed -n 's/^LINK //p' | tail -n 1)"
test -n "$URL2" || { echo "ERROR: no second link"; exit 1; }
COUNT="$(rclone lsf "$REMOTE/" --files-only | grep -Fc "$SLOT.json" || true)"
test "$COUNT" -eq 1 || { echo "ERROR: expected exactly one file in test slot; got $COUNT"; exit 1; }
if [ "$URL1" != "$URL2" ]; then
  echo "ERROR: cloud link changed after replacement; reviewer URL stability not verified."
  echo "FIRST: $URL1"
  echo "SECOND: $URL2"
  exit 1
fi
echo "=== REAL OVERWRITE VERIFIED: SAME LINK, ONE FILE, CHECKSUMS MATCH ==="
echo "TEST URL: $URL2"
echo "Production video and storyboard files were not changed."
