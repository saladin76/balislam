#!/bin/bash
# Safe Studio V3 acceptance: no auto scheduler, renders, uploads, or cleanup.
set -euo pipefail
TARGET="$HOME/balislam-cloud-preview-ready"
BASE="$HOME/Balislam-Preview-Sync"
test -f "$TARGET/package.json" || { echo "ERROR: isolated Studio checkout unavailable"; exit 1; }
test -x "$BASE/studio-handoff.sh" || { echo "ERROR: verified Mac uploader missing"; exit 1; }
cd "$TARGET"
echo "=== VERIFY ISOLATED CHECKOUT ==="
git status --short
if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: isolated worktree contains changes; cannot validate an unknown state"
  exit 1
fi
echo "COMMIT $(git rev-parse --short HEAD)"
echo "=== NODE DEPENDENCIES ==="
if [ ! -d node_modules ]; then
  npm ci
else
  echo "Existing node_modules present; using installed dependencies"
fi
echo "=== TYPESCRIPT ==="
npm run typecheck
echo "=== STUDIO REVIEW TESTS ==="
npm exec -- vitest run tests/studio-delivery-center.test.ts tests/studio-review-notes.test.ts
echo "=== CLOUD AND BRIDGE PYTHON SAFETY ==="
PYTHON="$(cat "$BASE/verified-python-path.txt")"
PYTHONDONTWRITEBYTECODE=1 "$PYTHON" -m unittest discover -s tests -p 'test_studio_preview_cloud.py' -v
PYTHONDONTWRITEBYTECODE=1 "$PYTHON" -m unittest discover -s tests -p 'test_studio_handoff_bridge.py' -v
echo "=== QUEUED JOBS READ-ONLY ==="
"$PYTHON" scripts/studio-handoff-bridge.py --fetch --dry-run
echo "=== AGENT STATE (NO ENABLE) ==="
bash scripts/setup-studio-handoff-agent.sh status
echo "=== STUDIO V3 PRELIMINARY ACCEPTANCE PASSED ==="
echo "Next: inspect Studio UI visually and verify an actual production handoff before merging."
