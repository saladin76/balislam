# Git worktrees — safety boundary for Studio production

**Scope (2026-11-06):** `fix/gate-git-env-isolation` repairs a confirmed P0 incident where a Git pre-push hook inherited `GIT_DIR` from a linked worktree. A test's `git init` ran against the original repository and changed `core.bare`, even though the apparent test directory was temporary.

## What is protected in this patch

1. `scripts/git-env.mjs` cleans repository-location environment variables (`GIT_DIR`, `GIT_COMMON_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`, object directories etc.) before child processes. Call `childEnv(extra)`, which also removes any location variables mistakenly passed in `extra`.
2. `scripts/gate.mjs`, `scripts/docs-sync.mjs`, `scripts/install-hooks.mjs`, `app/server/update.ts` and `app/server/extra.ts` apply the clean environment when running subprocesses.
3. Vitest setup scrubs these variables before tests; Git-test helpers pass clean env explicitly. Tests use **temporary test repositories** and compare original temp-repository `.git/config` and branch/stash references.
4. `scripts/install-hooks.mjs` refuses to run shared Git `core.hooksPath` writes when `root/.git` is a **file** (linked worktree); this prevents incidental changes from `npm ci`/prepare inside detached Studio previews.
5. Existing commands do **not** automatically `git stash`, `git reset --hard`, rewrite local primary branches or merge production commits.

## Important structural limitation

Linked worktrees by definition share their **common Git metadata** (branch references, config, objects and stash) with the primary checkout. It is **not possible to guarantee** that *any arbitrary* command or malicious executable run inside a linked worktree cannot modify shared data. The protections above address known project subprocess flows and are covered by regression tests — they are **not sandbox isolation**.

To absolutely separate execution for potentially untrusted `git push` hooks or tests, use an **independent `git clone`** in a separate directory, not a linked `git worktree`. Then compare primary `git status`, config, stash and branch refs before and after; do not copy credentials into the clone. An approved push intentionally changes the remote branch; that is separate from preserving primary *local* refs. Keep credentials guarded and never auto-merge to `main`.

## Mac acceptance required before merging PR #61

- Run isolated TypeScript and Vitest gate at the **exact PR commit**, recording Git SHA.
- Confirm `tests/git-env-isolation.test.ts` exercise a real pre-push hook in throwaway linked worktrees and preserve the primary fixture config/stash/refs.
- Use a clean independent clone for any additional network push probe; never use production `~/balislam` for an adversarial test.
- Inspect original production `.git/config`, `git stash list`, `git branch --list`, and `git status` before and after; verify no unexpected changes.
- On any red gate, keep PR draft and do not force push, reset or merge.

No Vercel, no automatic launch agent, no public publishing.
