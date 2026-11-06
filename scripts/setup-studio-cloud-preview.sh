#!/bin/bash
# Safe installer: never edits dirty worktrees or deletes media.
set -euo pipefail
ROOT="$HOME/balislam"
BASE="$HOME/Balislam-Preview-Sync"
TARGET="$HOME/balislam-cloud-preview-ready"
SERVICE="gui/$(id -u)/com.balislam.preview-sync"
echo "=== STOP LEGACY SCANNER ==="
launchctl bootout "$SERVICE" 2>/dev/null || true
if launchctl list | grep -q 'com.balislam.preview-sync'; then
  echo "ERROR: legacy service still running"; exit 1
fi
command -v python3 >/dev/null || { echo "ERROR: python3 missing"; exit 1; }
command -v rclone >/dev/null || { echo "ERROR: rclone missing"; exit 1; }
test -d "$ROOT/.git" || { echo "ERROR: $ROOT not a git checkout"; exit 1; }
mkdir -p "$BASE"
echo "=== ISOLATED WORKTREE ==="
if [ ! -d "$TARGET" ]; then
  git -C "$ROOT" worktree add --detach "$TARGET" FETCH_HEAD
else
  echo "Already exists; not overwriting: $TARGET"
fi
test -f "$TARGET/scripts/studio-preview-cloud.py" || { echo "ERROR: uploader missing"; exit 1; }
echo "=== OFFLINE TESTS ==="
(cd "$TARGET" && python3 -m unittest discover -s tests -p 'test_studio_preview_cloud.py' -v)
echo "=== DRIVE CONNECTION (READ ONLY) ==="
rclone lsf "studio_drive:Balislam-Studio-Previews/" --dirs-only >/dev/null
cat > "$BASE/render-cloud-preview.sh" <<'INNER'
#!/bin/bash
set -euo pipefail
PROJECT="$HOME/balislam-cloud-preview-ready"
cd "$PROJECT"
if [ ! -d node_modules ]; then
  echo "Missing dependencies. Run: cd \"$PROJECT\" && npm ci"
  exit 1
fi
export BAL_PREVIEW_CLOUD_AUTO=1
exec npm run bal -- "$@"
INNER
chmod 700 "$BASE/render-cloud-preview.sh"
echo "=== SETUP OK: NO FILES UPLOADED OR DELETED ==="
echo "To render using new opt-in sync: $BASE/render-cloud-preview.sh -c balislam render 001"
echo "Existing production apps and worktrees are NOT modified."
