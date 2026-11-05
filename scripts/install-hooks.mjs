#!/usr/bin/env node
/**
 * يفعّل خطافات المشروع (.githooks) في نسخة git هذه: بوابة التسليم قبل كل دفع.
 * يعمل تلقائيًا مع npm install / npm ci (السكريبت prepare)، ولا يفعل شيئًا خارج مستودع git.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const inRepo = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: root, encoding: "utf8" });
if (inRepo.status !== 0 || inRepo.stdout.trim() !== "true" || !existsSync(path.join(root, ".githooks", "pre-push"))) process.exit(0);
const cur = spawnSync("git", ["config", "--get", "core.hooksPath"], { cwd: root, encoding: "utf8" }).stdout.trim();
if (cur !== ".githooks") {
  const r = spawnSync("git", ["config", "core.hooksPath", ".githooks"], { cwd: root, encoding: "utf8" });
  if (r.status === 0) console.log("فُعّلت بوابة التسليم: كل git push يفحص الأنواع والاختبارات أولًا.");
}
