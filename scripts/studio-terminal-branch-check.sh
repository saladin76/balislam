#!/usr/bin/env bash
# Isolated Mac validation of a named, specifically approved Studio GitHub branch.
# This script is executed from bash process substitution and never edits ~/.git/config,
# stashes, local branches, existing Mac media, launch agents or localhost:4321.
set -euo pipefail

REPO="${BAL_STUDIO_REPO:-$HOME/balislam}"
BRANCH="${BAL_STUDIO_TEST_BRANCH:-fix/studio-visual-storyboard-gate-20261106}"
TARGET="${BAL_STUDIO_TEST_DIR:-$HOME/balislam-storyboard-visual-preview}"
PORT="${BAL_STUDIO_TEST_PORT:-4323}"
MODE="${1:-check}"

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
[[ "$MODE" == check || "$MODE" == serve ]] || fail 'Usage: studio-terminal-branch-check.sh [check|serve]'
[[ "$BRANCH" =~ ^[a-zA-Z0-9][a-zA-Z0-9_/-]{2,130}$ ]] || fail 'Invalid branch ref'
[[ "$PORT" =~ ^[0-9]{4,5}$ ]] || fail 'Invalid port'
(( 10#$PORT >= 1024 && 10#$PORT <= 65535 )) || fail 'Port outside allowed range'
[[ -d "$REPO/.git" ]] || fail "Expected primary Git checkout: $REPO"
[[ "$REPO" != "$TARGET" ]] || fail 'Testing checkout must not be production root'
[[ ! "$TARGET" == "$REPO/"* ]] || fail 'Testing checkout cannot be inside production root'

# Defensive isolation also applies to every child command below.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_OBJECT_DIRECTORY
unset GIT_ALTERNATE_OBJECT_DIRECTORIES GIT_COMMON_DIR GIT_NAMESPACE GIT_PREFIX
unset GIT_QUARANTINE_PATH GIT_CEILING_DIRECTORIES GIT_DISCOVERY_ACROSS_FILESYSTEM
unset GIT_INTERNAL_SUPER_PREFIX

printf 'Fetching %s, keeping production checkout untouched...\n' "$BRANCH"
git -C "$REPO" fetch origin "refs/heads/$BRANCH:refs/remotes/origin/$BRANCH"
REF="$(git -C "$REPO" rev-parse --verify "refs/remotes/origin/$BRANCH^{commit}")"
if [[ ! -e "$TARGET" ]]; then
  git -C "$REPO" worktree add --detach "$TARGET" "$REF"
else
  [[ "$(git -C "$TARGET" rev-parse --is-inside-work-tree 2>/dev/null || true)" == true ]] || fail 'Testing target is not a Git worktree'
  [[ "$(git -C "$TARGET" rev-parse --show-toplevel)" == "$TARGET" ]] || fail 'Testing target path mismatch'
  [[ -z "$(git -C "$TARGET" status --porcelain --untracked-files=normal)" ]] || fail 'Testing worktree has user changes: refusing overwrite'
  git -C "$TARGET" switch --detach "$REF"
fi
printf 'TEST_HEAD %s\n' "$REF"

# npm prepare in the old main branch writes core.hooksPath to the SHARED .git/config.
# Skip lifecycle scripts on this temporary worktree; the P0 hooks installer is
# covered by a dedicated real-Git regression test in PR #61.
(cd "$TARGET" && npm ci --ignore-scripts --no-audit --no-fund)
(cd "$TARGET" && npm run gate)

if [[ "$MODE" == check ]]; then
  printf 'CHECK_OK %s (production untouched; no server started)\n' "$REF"
  exit 0
fi
printf 'PREVIEW_ONLY http://127.0.0.1:%s (not production; Ctrl+C to stop)\n' "$PORT"
cd "$TARGET"
exec npm run app -- --host 127.0.0.1 --port "$PORT" --strictPort
