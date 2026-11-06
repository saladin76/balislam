# Studio on Mac: Terminal rollout (safe staging first)

The active production Studio is run locally with `npm run app` at `http://127.0.0.1:4321`. GitHub PRs and Vercel previews **do not install or publish code to this Mac**. The owner runs the local Terminal commands after an approved change.

## Test PR #49 without changing production

The preview uses a separate Git worktree and port 4322. It neither merges nor resets `~/balislam`, and does not enable any LaunchAgent, uploader, or automatic deletion.

From Terminal on the owner's Mac:

```bash
cd "$HOME/balislam"
git fetch origin integration/studio-localhost-acceptance-20261106
bash <(git show origin/integration/studio-localhost-acceptance-20261106:scripts/studio-terminal-preview.sh) check
```

Expected success is `CHECK_OK <commit>`. Do not claim tests passed until the Mac prints this. To open an isolated Studio preview after the gate succeeds:

```bash
cd "$HOME/balislam"
bash <(git show origin/integration/studio-localhost-acceptance-20261106:scripts/studio-terminal-preview.sh) serve
```

Then open `http://127.0.0.1:4322`. Use Ctrl+C to stop. A successful preview is **not a production release**. The preview uses a distinct checkout but shares the same home-directory runtime services; avoid changing episodes, approvals, and local production data during UI inspection. The intended use is read-only verification.

## Production deployment — only after PR review and merge to main

Never use `fresh-start.command` for routine updates: it resets tracked state and archives generated media. Never use `git reset --hard`, `git clean`, broad worktree scans, or automatic deletion to publish Studio.

Before any production update, stop the existing Studio server, ensure the owner has approved the merged commit, and verify `~/balislam` is the intended checkout on clean `main`. If it is dirty, on another branch, or contains local work, stop and resolve it safely rather than discard changes.

```bash
cd "$HOME/balislam"
git status --short
git branch --show-current
git fetch origin main
git pull --ff-only origin main
npm ci --no-audit --no-fund
npm run gate
npm run app -- --port 4321 --strictPort
```

These are *manual production steps*, not commands run by the connector. If any stage fails, do not claim deployment success; do not merge PR #47 merely to bypass the gate. Opening `http://127.0.0.1:4321` only establishes that the server is running — UI and delivery checks still need confirmation.

## Handoff safety remains separate

The GitHub→Mac→Drive synthetic bridge smoke test passed; production Claude media handoff, queue write permissions and live Studio report display still need acceptance. The legacy broad-scanning LaunchAgent must stay disabled. Do not execute `scripts/setup-studio-handoff-agent.sh enable` until explicit owner approval **and** all security gates are complete.

Review/change order: #47 underlying guarded sync → #49 follow-up fixes and Terminal validation. If #47 advances concurrently, refresh/rebase #49 and rerun the gate before merging.
