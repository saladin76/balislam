#!/usr/bin/env node
/**
 * يفعّل خطافات المشروع (.githooks) في نسخة git هذه: بوابة التسليم قبل كل دفع.
 * يعمل تلقائيًا مع npm install / npm ci (السكريبت prepare)، ولا يفعل شيئًا خارج مستودع git.
 */
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync } from "node:fs";
import path from "node:path";
import { cleanGitEnv } from "./git-env.mjs";

const root = path.resolve(import.meta.dirname, "..");
// In a linked worktree .git is a FILE pointing to the shared original repository.
// `git config core.hooksPath` without --local worktree isolation would mutate
// the original repository's shared .git/config. npm ci/prepare inside a detached
// preview or temporary git worktree MUST NOT do so.
const dotGit = path.join(root, ".git");
if (!existsSync(dotGit) || !lstatSync(dotGit).isDirectory()) {
  console.log("Linked worktree or non-primary checkout: skipping shared Git hook configuration.");
  process.exit(0);
}
const inRepo = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: root, encoding: "utf8", env: cleanGitEnv() });
if (inRepo.status !== 0 || inRepo.stdout.trim() !== "true" || !existsSync(path.join(root, ".githooks", "pre-push"))) process.exit(0);
const cur = spawnSync("git", ["config", "--get", "core.hooksPath"], { cwd: root, encoding: "utf8", env: cleanGitEnv() }).stdout.trim();
if (cur !== ".githooks") {
  const r = spawnSync("git", ["config", "core.hooksPath", ".githooks"], { cwd: root, encoding: "utf8", env: cleanGitEnv() });
  if (r.status === 0) console.log("فُعّلت بوابة التسليم: كل git push يفحص الأنواع والاختبارات أولًا.");
}
