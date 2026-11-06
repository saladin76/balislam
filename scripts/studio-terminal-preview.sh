#!/usr/bin/env bash
# Mac-only non-destructive Studio preview from a named GitHub branch.
# Does not touch ~/balislam's checked-out branch, channel media, approval data or launch agents.
set -euo pipefail

REPO="${BAL_STUDIO_REPO:-$HOME/balislam}"
TARGET="${BAL_STUDIO_PREVIEW_DIR:-$HOME/balislam-studio-terminal-preview}"
BRANCH="fix/recitation-exact-timing-and-voice-gates"
PORT="${BAL_STUDIO_PREVIEW_PORT:-4322}"
MODE="${1:-check}"

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
case "$MODE" in check|serve) ;; *) fail 'Usage: studio-terminal-preview.sh [check|serve]' ;; esac
[[ "$PORT" =~ ^[0-9]{2,5}$ ]] || fail 'Invalid port'
(( 10#$PORT >= 1024 && 10#$PORT <= 65535 )) || fail 'Port outside unprivileged range'
command -v git >/dev/null || fail 'Git is required'
command -v npm >/dev/null || fail 'npm is required'
[[ -d "$REPO/.git" ]] || fail "Expected Git checkout at $REPO"
[[ "$TARGET" != "$REPO" ]] || fail 'Preview directory must be separate from production checkout'

printf 'Fetching exact preview branch without resetting main...\n'
git -C "$REPO" fetch origin "refs/heads/$BRANCH:refs/remotes/origin/$BRANCH"
REF="$(git -C "$REPO" rev-parse --verify "refs/remotes/origin/$BRANCH^{commit}")"
if [[ ! -e "$TARGET" ]]; then
  git -C "$REPO" worktree add --detach "$TARGET" "$REF"
else
  [[ "$(git -C "$TARGET" rev-parse --is-inside-work-tree 2>/dev/null || true)" == true ]] || fail 'Existing target is not a Git worktree'
  [[ -z "$(git -C "$TARGET" status --porcelain --untracked-files=normal)" ]] || fail "Preview worktree has changes; preserved them. For a new clean check, set BAL_STUDIO_PREVIEW_DIR to a FRESH path, e.g. \$HOME/balislam-recitation-next-preview. Do not reset or delete the existing worktree."
  git -C "$TARGET" switch --detach "$REF"
fi
printf 'Preview commit: %s\n' "$REF"
printf 'Installing exact locked dependencies in isolated preview...\n'
# Linked worktrees must never run npm prepare, which can rewrite the primary Git hooks config.
(cd "$TARGET" && npm ci --ignore-scripts --no-audit --no-fund)
printf 'Running the project gate before any server starts...\n'
(cd "$TARGET" && npm run gate)
if [[ "$MODE" == check ]]; then
  printf 'CHECK_OK %s (production unchanged; no server started)\n' "$REF"
  exit 0
fi
printf 'PREVIEW_ONLY http://127.0.0.1:%s (not production; Ctrl+C to stop)\n' "$PORT"
cd "$TARGET"
exec npm run app -- --host 127.0.0.1 --port "$PORT" --strictPort
