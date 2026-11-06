#!/usr/bin/env bash
# Safe localhost publication diagnostics. Does NOT change the active Git checkout.
set -euo pipefail
REPO="${BAL_STUDIO_REPO:-$HOME/balislam}"
BASE="$HOME/Balislam-Preview-Sync/release-audit"
BRANCH=feat/studio-local-release-audit
[[ -d "$REPO/.git" ]] || { echo 'ERROR: expected ~/balislam checkout' >&2; exit 2; }
command -v node >/dev/null || { echo 'ERROR: Node.js required' >&2; exit 2; }
mkdir -p "$BASE/scripts" "$BASE/tests"
printf 'Fetching release audit without modifying the production checkout...\n'
git -C "$REPO" fetch origin "$BRANCH"
git -C "$REPO" show "origin/$BRANCH:scripts/studio-release-audit.mjs" > "$BASE/scripts/studio-release-audit.mjs"
git -C "$REPO" show "origin/$BRANCH:tests/studio-release-audit.node.test.mjs" > "$BASE/tests/studio-release-audit.node.test.mjs"
git -C "$REPO" show "origin/$BRANCH:scripts/studio-worktree-locator.mjs" > "$BASE/scripts/studio-worktree-locator.mjs"
git -C "$REPO" show "origin/$BRANCH:tests/studio-worktree-locator.node.test.mjs" > "$BASE/tests/studio-worktree-locator.node.test.mjs"
printf 'Running isolated Node audit and locator tests...\n'
node --test "$BASE/tests/studio-release-audit.node.test.mjs" "$BASE/tests/studio-worktree-locator.node.test.mjs"
printf 'AUDIT_TESTS_OK\n\n'
printf 'Reading current production checkout (read-only)...\n'
set +e
node "$BASE/scripts/studio-release-audit.mjs" --root "$REPO" --episode 001
status=$?
set -e
case "$status" in
  0) echo 'AUDIT_DIAGNOSTIC_READY_FOR_FINAL_HUMAN_REVIEW (NOT permission to publish)' ;;
  1) echo 'AUDIT_BLOCKED: one or more episodes still need work; no files changed' ;;
  *) echo "AUDIT_ERROR $status" >&2; exit "$status" ;;
esac
printf '\nLocating candidate episode folders in registered Git worktrees (read-only):\n'
node "$BASE/scripts/studio-worktree-locator.mjs" --repo "$REPO" --episode 001
printf '\nFor channel-specific worktree media, run:\n'
printf 'node "%s/scripts/studio-release-audit.mjs" --root "/ABSOLUTE/WORKTREE/PATH" --channel zubdat-alkutub --episode 001\n' "$BASE"
