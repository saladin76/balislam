#!/bin/bash
# Explicit opt-in macOS LaunchAgent for a narrow GitHub handoff queue only.
# Default action is status. No broad directory scanning or local deletion.
set -euo pipefail
MODE="${1:-status}"
BASE="$HOME/Balislam-Preview-Sync"
TARGET="$HOME/balislam-cloud-preview-ready"
NAME="com.balislam.handoff-bridge"
SERVICE="gui/$(id -u)/$NAME"
PLIST="$HOME/Library/LaunchAgents/$NAME.plist"
WRAPPER="$BASE/run-handoff-bridge.sh"

status() {
  if launchctl list | grep -Fq "$NAME"; then
    echo "BRIDGE_AGENT_RUNNING"
  else
    echo "BRIDGE_AGENT_STOPPED"
  fi
  echo "BRIDGE_AGENT_CONFIG $PLIST"
}
case "$MODE" in
  status)
    status
    ;;
  disable)
    launchctl bootout "$SERVICE" 2>/dev/null || true
    launchctl disable "$SERVICE" 2>/dev/null || true
    echo "BRIDGE_AGENT_DISABLED"
    ;;
  enable)
    test -f "$TARGET/scripts/studio-handoff-bridge.py" || { echo "ERROR: bridge missing"; exit 1; }
    test -x "$BASE/studio-handoff.sh" || { echo "ERROR: verified uploader missing"; exit 1; }
    test -s "$BASE/verified-python-path.txt" || { echo "ERROR: verified Python missing"; exit 1; }
    test -d "$HOME/balislam/.git" || { echo "ERROR: repository missing"; exit 1; }
    if launchctl list | grep -Fq 'com.balislam.preview-sync'; then
      echo "ERROR: legacy broad scanner must remain stopped"
      exit 1
    fi
    # Validate the CURRENT queue before enabling; never auto-run a bad queue.
    PYTHON="$(cat "$BASE/verified-python-path.txt")"
    "$PYTHON" "$TARGET/scripts/studio-handoff-bridge.py" --fetch --dry-run
    umask 077
    mkdir -p "$BASE" "$HOME/Library/LaunchAgents"
    cat > "$WRAPPER" <<'INNER'
#!/bin/bash
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
BASE="$HOME/Balislam-Preview-Sync"
PYTHON="$(cat "$BASE/verified-python-path.txt")"
exec "$PYTHON" "$HOME/balislam-cloud-preview-ready/scripts/studio-handoff-bridge.py" --fetch
INNER
    chmod 700 "$WRAPPER"
    # plistlib escapes paths and writes correctly formed XML.
    "$PYTHON" - "$PLIST" "$WRAPPER" "$BASE" "$NAME" <<'PY'
import plistlib
import sys
from pathlib import Path
plist, wrapper, base, label = map(Path, sys.argv[1:5])
payload = {
    "Label": str(label),
    "ProgramArguments": ["/bin/bash", str(wrapper)],
    "EnvironmentVariables": {"HOME": str(Path.home()), "PATH": "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"},
    "RunAtLoad": True,
    "StartInterval": 300,
    "StandardOutPath": str(base / "bridge-agent.log"),
    "StandardErrorPath": str(base / "bridge-agent-error.log"),
}
with plist.open("wb") as out:
    plistlib.dump(payload, out)
PY
    # Fix Label: use the literal service ID, not a filesystem path.
    "$PYTHON" - "$PLIST" "$NAME" <<'PY'
import plistlib
import sys
from pathlib import Path
p = Path(sys.argv[1])
with p.open("rb") as f:
    obj = plistlib.load(f)
obj["Label"] = sys.argv[2]
with p.open("wb") as f:
    plistlib.dump(obj, f)
PY
    launchctl bootout "$SERVICE" 2>/dev/null || true
    launchctl enable "$SERVICE"
    launchctl bootstrap "gui/$(id -u)" "$PLIST"
    echo "BRIDGE_AGENT_ENABLED_5_MIN"
    echo "LOG $BASE/bridge-agent.log"
    ;;
  *)
    echo "Usage: $0 [status|enable|disable]"
    exit 2
    ;;
esac
