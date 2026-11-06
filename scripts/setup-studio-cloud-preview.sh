#!/bin/bash
# Safe installer: never edits dirty worktrees or deletes media.
set -euo pipefail
ROOT="$HOME/balislam"
BASE="$HOME/Balislam-Preview-Sync"
TARGET="$HOME/balislam-cloud-preview-ready"
SERVICE="gui/$(id -u)/com.balislam.preview-sync"
echo "=== STOP LEGACY SCANNER ==="
launchctl bootout "$SERVICE" 2>/dev/null || true
# Prevent the old broad-scanning LaunchAgent from restarting at next login.
launchctl disable "$SERVICE" 2>/dev/null || true
if launchctl list | grep -q 'com.balislam.preview-sync'; then
  echo "ERROR: legacy service still running"; exit 1
fi
# Apple's CommandLineTools python3 can exist but fail at posix_spawn.
# Test actual interpreter execution, not just command -v.
find_python() {
  local candidate
  for candidate in \
    /opt/homebrew/bin/python3 \
    /usr/local/bin/python3 \
    /opt/homebrew/opt/python@*/bin/python3* \
    /usr/local/opt/python@*/bin/python3* \
    "$(command -v python3 2>/dev/null || true)"; do
    if [ -x "$candidate" ] && "$candidate" -c 'import sys, fcntl, unittest; assert sys.version_info >= (3, 9)' >/dev/null 2>&1; then
      PYTHON_BIN="$candidate"
      return 0
    fi
  done
  return 1
}
echo "=== VERIFY USABLE PYTHON ==="
if ! find_python; then
  if ! command -v brew >/dev/null 2>&1; then
    echo "ERROR: macOS Python is broken and Homebrew is not available"; exit 1
  fi
  echo "Mac CommandLineTools Python is broken; installing free Homebrew Python."
  brew install python
  find_python || { echo "ERROR: Homebrew Python still unavailable"; exit 1; }
fi
echo "USING PYTHON: $PYTHON_BIN"
command -v rclone >/dev/null || { echo "ERROR: rclone missing"; exit 1; }
test -d "$ROOT/.git" || { echo "ERROR: $ROOT not a git checkout"; exit 1; }
mkdir -p "$BASE"
echo "=== ISOLATED WORKTREE ==="
REF="$(git -C "$ROOT" rev-parse FETCH_HEAD)"
if [ ! -d "$TARGET" ]; then
  git -C "$ROOT" worktree add --detach "$TARGET" "$REF"
else
  # No reset/clean: preserve any work the user may have put in this checkout.
  test "$(git -C "$TARGET" rev-parse --is-inside-work-tree 2>/dev/null)" = "true" ||
    { echo "ERROR: existing target is not a Git worktree"; exit 1; }
  if [ -n "$(git -C "$TARGET" status --porcelain)" ]; then
    echo "ERROR: isolated worktree contains local changes; refusing to overwrite"; exit 1
  fi
  echo "Updating existing CLEAN isolated worktree."
  git -C "$TARGET" switch --detach "$REF"
fi
test -f "$TARGET/scripts/studio-preview-cloud.py" || { echo "ERROR: uploader missing"; exit 1; }
echo "=== OFFLINE TESTS ==="
(cd "$TARGET" && "$PYTHON_BIN" -m unittest discover -s tests -p 'test_studio_preview_cloud.py' -v)
echo "=== DRIVE CONNECTION (READ ONLY) ==="
rclone lsf "studio_drive:Balislam-Studio-Previews/" --dirs-only >/dev/null
printf '%s\n' "$PYTHON_BIN" > "$BASE/verified-python-path.txt"
cat > "$BASE/render-cloud-preview.sh" <<'INNER'
#!/bin/bash
set -euo pipefail
PROJECT="$HOME/balislam-cloud-preview-ready"
cd "$PROJECT"
if [ ! -d node_modules ]; then
  echo "Missing dependencies. Run: cd \"$PROJECT\" && npm ci"
  exit 1
fi
export BAL_PREVIEW_PYTHON="$(cat "$HOME/Balislam-Preview-Sync/verified-python-path.txt")"
export BAL_PREVIEW_CLOUD_AUTO=1
exec npm run bal -- "$@"
INNER
chmod 700 "$BASE/render-cloud-preview.sh"
echo "=== SETUP OK: NO FILES UPLOADED OR DELETED ==="
echo "To render using new opt-in sync: $BASE/render-cloud-preview.sh -c balislam render 001"
echo "Existing production apps and worktrees are NOT modified."
