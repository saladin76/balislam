#!/usr/bin/env bash
# Safe, storyboard-only delivery. Dafatir 001 V1 + V1.1 as actually present in Git.
# No video/audio, no Git writes, no deletions, no remote public-sharing changes.
# Defaults to CHECK-ONLY. Destination is a VERIFIED EXACT Google Drive folder ID.
set -euo pipefail

MODE="${1:-check}"
[[ "$MODE" == "check" || "$MODE" == "upload" ]] || {
  echo "Usage: handoff-storyboard.sh check|upload --source-root /ABSOLUTE/MAC/WORKTREE" >&2; exit 2;
}
shift || true
SOURCE_ROOT=""
REMOTE="studio_drive"
FOLDER_ID="1wiFhT_4u98hLMpJQQwk1TUvNft54pMbp"
while (( $# )); do
  case "$1" in
    --source-root) [[ $# -ge 2 ]] || exit 2; SOURCE_ROOT="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done
[[ "$SOURCE_ROOT" == /* && -d "$SOURCE_ROOT" ]] || {
  echo "Supply the exact absolute source checkout directory with --source-root." >&2; exit 2;
}
SOURCE_ROOT="$(cd "$SOURCE_ROOT" && pwd -P)"
command -v rclone >/dev/null || { echo "rclone not installed on Mac" >&2; exit 1; }
command -v python3 >/dev/null || { echo "python3 required" >&2; exit 1; }
command -v shasum >/dev/null || { echo "shasum required" >&2; exit 1; }
command -v md5 >/dev/null || { echo "macOS md5 required" >&2; exit 1; }

EP="$SOURCE_ROOT/channels/dafatir-alzaman/episodes/001-adam-beginning"
DOCS="$EP/tech-reviews/020/docs"
# No automatic video or asset tree scanning. These four reviewed items are
# literal and versioned; slots cannot replace v1 with v1.1.
SOURCE_FILES=(
  "storyboard-001-v1.pdf"
  "storyboard-001-v1.json"
  "storyboard-001-v1.1.pdf"
  "storyboard-001-v1.1.json"
)

# An exact Google Drive ID avoids duplicate "episodes" folder ambiguity.
DRIVE_ARGS=(--drive-root-folder-id "$FOLDER_ID")
if ! REMOTE_FILES="$(rclone lsf "$REMOTE:" "${DRIVE_ARGS[@]}" --files-only 2>&1)"; then
  echo "Cannot inspect the exact Drive folder: $REMOTE_FILES" >&2
  exit 1
fi

RECEIPTS="${BAL_STORYBOARD_RECEIPTS_DIR:-$HOME/Balislam-Preview-Sync/storyboard-receipts}"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$$"
LOG="$RECEIPTS/dafatir-001-storyboards-$RUN_ID.log"
if [[ "$MODE" == "upload" ]]; then
  mkdir -p "$RECEIPTS"
  umask 077
  printf 'run=%s channel=dafatir-alzaman episode=001-adam-beginning folder_id=%s\n' "$RUN_ID" "$FOLDER_ID" >> "$LOG"
fi

for NAME in "${SOURCE_FILES[@]}"; do
  SOURCE="$DOCS/$NAME"
  [[ -f "$SOURCE" && -s "$SOURCE" && ! -L "$SOURCE" ]] || {
    echo "Missing, empty or symlink source: $SOURCE" >&2; exit 1;
  }
  HASH="$(shasum -a 256 "$SOURCE" | awk '{print $1}')"
  MD5="$(md5 -q "$SOURCE")"
  BYTES="$(stat -f %z "$SOURCE")"
  printf '%s %s bytes=%s sha256=%s md5=%s\n' "$MODE" "$NAME" "$BYTES" "$HASH" "$MD5"
  TARGET="$REMOTE:$NAME"

  if printf '%s\n' "$REMOTE_FILES" | grep -Fxq "$NAME"; then
    EXISTING="$(rclone md5sum "$TARGET" "${DRIVE_ARGS[@]}" | awk 'NR==1 { print tolower($1) }')"
    if [[ "$EXISTING" != "$MD5" ]]; then
      echo "REFUSED: remote version exists with DIFFERENT bytes: $NAME (no overwrite permitted)" >&2
      exit 1
    fi
    printf 'EXISTS_IDENTICAL %s\n' "$NAME"
  fi

  if [[ "$MODE" == "check" ]]; then continue; fi

  # If the file already exists with same hash rclone copyto is idempotent;
  # never update unrelated handoff.md, index, voice or video files.
  # Even a concurrent upload must never cause this command to overwrite
  # an existing version; verify the final hash after the transfer.
  rclone copyto "$SOURCE" "$TARGET" "${DRIVE_ARGS[@]}" --retries 3 --ignore-existing
  CLOUD_MD5="$(rclone md5sum "$TARGET" "${DRIVE_ARGS[@]}" | awk 'NR==1 { print tolower($1) }')"
  [[ "$CLOUD_MD5" == "$MD5" ]] || {
    printf 'FAILED_MISMATCH file=%s local_md5=%s remote_md5=%s\n' "$NAME" "$MD5" "$CLOUD_MD5" >> "$LOG"
    echo "FAILED: Drive MD5 differs for $NAME" >&2; exit 1;
  }
  # The provider ID is read back from Drive metadata; no public link creation
  # via "rclone link" (which may modify sharing permissions).
  JSON="$(rclone lsjson "$TARGET" "${DRIVE_ARGS[@]}" --stat --hash)"
  FILE_ID="$(printf '%s' "$JSON" | python3 -c 'import json,sys; obj=json.load(sys.stdin); print(obj.get("ID", ""))')"
  if [[ ! "$FILE_ID" =~ ^[A-Za-z0-9_-]{15,}$ ]]; then
    printf 'VERIFIED_BYTES_LINK_PENDING file=%s sha256=%s md5=%s\n' "$NAME" "$HASH" "$MD5" >> "$LOG"
    echo "VERIFIED bytes, but provider file ID unavailable: $NAME" >&2
    exit 1
  fi
  LINK="https://drive.google.com/file/d/$FILE_ID/view"
  printf 'VERIFIED file=%s version=%s bytes=%s sha256=%s md5=%s file_id=%s link=%s\n' \
    "$NAME" "$([[ "$NAME" == *v1.1* ]] && echo v1.1 || echo v1)" "$BYTES" "$HASH" "$MD5" "$FILE_ID" "$LINK" | tee -a "$LOG"
done

if [[ "$MODE" == "check" ]]; then
  echo "CHECK_ONLY: four files inspected, no data sent, no existing assets modified."
else
  echo "UPLOAD_DONE: append-only receipt $LOG; inspect verified files in the exact Drive folder."
  echo "DRIVE_FOLDER https://drive.google.com/drive/folders/$FOLDER_ID"
fi
