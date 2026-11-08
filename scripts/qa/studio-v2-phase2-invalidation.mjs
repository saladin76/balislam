#!/usr/bin/env node
/**
 * Studio V2 QA-08 destructive-negative TEST on an explicit QA-only MP4.
 * Run with: npx --no-install tsx scripts/qa/studio-v2-phase2-invalidation.mjs
 * Requires an approved real scene. Tamper + restore original bytes under the
 * actual Backend shared artifact mutex. No success without real HTTP.
 * On unexpected interruption, the uniquely named owned backup is retained.
 */
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { appendFile, copyFile, lstat, readFile, realpath, rename, rm, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const checks = [];
const result = { task: "Studio V2 QA-08 changed-and-restored MP4", checks, status: "BLOCKED" };
const ch = process.env.STUDIO_V2_QA_CHANNEL ?? "balislam";
const num = process.env.STUDIO_V2_QA_EPISODE ?? "";
const sceneId = process.env.STUDIO_V2_QA_SCENE ?? "c1-s1";
let fixture, backup, target, touched = false, restored = false, sharedLock, scope;
const add = (name, status, detail) => checks.push({ name, status, ...(detail ? { detail } : {}) });
const block = (why) => { add("PRECONDITION", "BLOCKED", why); throw Object.assign(Error(why), { blocked: true }); };
async function sha(file) {
  const hash = createHash("sha256");
  for await (const part of createReadStream(file)) hash.update(part);
  return hash.digest("hex");
}
async function restore() {
  if (!touched || restored || !backup) return;
  // Never restore under a fake lock; same lock domain as Backend/Render.
  await sharedLock(scope, async () => {
    const temp = target + ".qa08-restore-" + randomUUID();
    await copyFile(backup, temp);
    try { await rename(temp, target); }
    finally { await rm(temp, { force: true }); }
  });
  restored = true;
}
async function run() {
  if (process.env.STUDIO_V2_QA_MUTATE_APPROVED_AV !== "1")
    block("Explicit STUDIO_V2_QA_MUTATE_APPROVED_AV=1 required; approved QA video will be intentionally modified");
  if (!/^[0-9]{3}$/.test(num) || !/^c1-s[123]$/.test(sceneId) ||
      !["balislam", "dafatir-alzaman", "zubdat-alkutub"].includes(ch))
    block("Invalid QA channel, episode or scene");
  const base = new URL(process.env.STUDIO_V2_QA_BASE_URL ?? "about:blank");
  if (base.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(base.hostname) ||
      base.pathname !== "/" || base.search || base.hash) block("Loopback QA URL required");
  const secret = process.env.STUDIO_V2_OWNER_SECRET ?? "";
  if (secret.length < 32) block("Real authenticated owner secret required");
  fixture = await realpath(process.env.STUDIO_V2_QA_FIXTURE_DIR ?? "").catch(() => block("Missing fixture"));
  if (path.dirname(fixture) !== path.join(root, "channels", ch, "episodes") ||
      !new RegExp("^" + num + "-qa-[a-z0-9-]+$").test(path.basename(fixture)) ||
      (await readFile(path.join(fixture, ".studio-v2-qa-sentinel"), "utf8").catch(() => "")).trim() !== "STUDIO_V2_QA_ONLY")
    block("Refuse any path outside THIS sentinel-bearing QA-only worktree");
  const module = path.join(root, "src", "workflow", "sceneLockV2.ts");
  const lockLib = await import(module).catch(() => null);
  if (typeof lockLib?.withSceneArtifactLockV2 !== "function")
    block("Backend shared artifact mutex unavailable; run on approved composite checkout using tsx");
  sharedLock = lockLib.withSceneArtifactLockV2;
  scope = { channelsRoot: path.join(root, "channels"), channel: ch, episode: path.basename(fixture) };
  result.gitSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const endpoint = "/api/studio-v2/episodes/" + num + "/scenes" + "?channel=" + encodeURIComponent(ch);
  const get = async (p, method = "GET", body, cookie = "", csrf = "") => {
    const res = await fetch(new URL(p, base), {
      method, headers: { accept: "application/json", ...(method === "GET" ? {} : { origin: base.origin, "content-type": "application/json" }),
        ...(cookie ? { cookie } : {}), ...(csrf ? { "x-studio-v2-csrf": csrf } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(20_000), redirect: "manual",
    });
    return { status: res.status, json: await res.json(), cookie: res.headers.get("set-cookie") };
  };
  const login = await get("/api/studio-v2/session", "POST", { secret });
  if (login.status !== 200 || !login.json.csrfToken ||
      !/^studio_v2_sid=[a-f0-9]{64};/.test(login.cookie ?? ""))
    block("Real owner login unavailable");
  const cookie = login.cookie.split(";")[0], csrf = login.json.csrfToken;
  const current = () => get(endpoint, "GET", undefined, cookie, csrf);
  const before = await current();
  const first = before.json.scenes?.find((x) => x.id === sceneId);
  if (before.status !== 200 || first?.status !== "approved" || !first.fingerprint)
    block("Real scene must have a current signed owner AV approval before tamper");
  const reg = JSON.parse(await readFile(path.join(fixture, ".studio-v2-manifests", sceneId + ".json"), "utf8"));
  if (!/^[a-f0-9]{64}$/.test(reg.integrity?.mac ?? ""))
    block("Signed registered manifest missing");
  const relative = reg.manifest?.inputs?.video?.files?.[0];
  if (typeof relative !== "string" || !new RegExp("^previews/" + sceneId + "-[a-f0-9]{12}-[a-f0-9-]{36}\\.mp4$").test(relative))
    block("Not a pinned real production QA preview");
  target = path.resolve(fixture, relative);
  const st = await lstat(target);
  if (!target.startsWith(fixture + path.sep) || await realpath(target) !== target ||
      !st.isFile() || st.isSymbolicLink() || st.nlink !== 1 || st.size < 1000)
    block("Refuse unsafe or hardlinked MP4 target");
  const initialSha = await sha(target);
  backup = path.join(fixture, ".studio-v2-qa08-backup-" + randomUUID() + ".mp4");
  await sharedLock(scope, async () => {
    await copyFile(target, backup, 1); // COPYFILE_EXCL, never overwrite backup
    await appendFile(target, Buffer.from([0x00]));
    touched = true;
  });
  const changed = await current();
  const changedScene = changed.json.scenes?.find((x) => x.id === sceneId);
  if (changed.status !== 200 || changedScene?.status !== "needs_reapproval")
    throw Error("P0: Changed approved video was not revoked by real HTTP inspection");
  add("MUTATED_BYTES_REVOKED", "PASS", { initialSha, changedStatus: changedScene.status });
  await restore();
  const restoredSha = await sha(target);
  if (restoredSha !== initialSha) throw Error("Restore did not preserve exact original MP4 bytes");
  add("ORIGINAL_BYTES_RESTORED", "PASS", { restoredSha });
  const after = await current();
  const item = after.json.scenes?.find((x) => x.id === sceneId);
  if (after.status !== 200 || item?.status === "approved")
    throw Error("P0: Restored old bytes resurrected an invalidated owner approval");
  add("EDIT_RESTORE_STAYS_REVOKED", "PASS", { finalStatus: item?.status });
  const gate = await get("/api/studio-v2/episodes/" + num + "/assembly-eligibility?channel=" + encodeURIComponent(ch),
    "GET", undefined, cookie, csrf);
  if (gate.status === 200) throw Error("P0: Assembly incorrectly accepted restored-but-revoked scene");
  add("ASSEMBLY_STAYS_BLOCKED", "PASS", { http: gate.status });
  const stale = await get("/api/studio-v2/episodes/" + num + "/scenes/" + sceneId +
    "/commands?channel=" + encodeURIComponent(ch), "POST", {
      action: "approve", expectedFingerprint: first.fingerprint, reviewId: "0".repeat(48),
    }, cookie, csrf);
  if (stale.status === 200) throw Error("P0: Stale review ID / revoked fingerprint accepted");
  add("STALE_APPROVAL_REFUSED", "PASS", { http: stale.status });
  add("REAPPROVAL", "BLOCKED", "Requires new scene production, fresh 1x owner AV receipt and explicit signoff");
}
try { await run(); }
catch (e) { if (!e.blocked) add("EXECUTION", "FAIL", String(e)); }
finally {
  if (touched && !restored) {
    try { await restore(); add("RESTORE_ON_ERROR", "PASS", "QA-owned original bytes recovered under trusted lock"); }
    catch (e) { add("RESTORE_ON_ERROR", "FAIL", String(e) + " — owned backup retained at " + backup); }
  }
  if (restored && backup) {
    try {
      if (await sha(backup) === await sha(target)) await rm(backup);
      else add("BACKUP", "FAIL", "Different QA-owned backup retained for manual recovery: " + backup);
    } catch (e) { add("BACKUP", "FAIL", String(e)); }
  }
  result.totals = ["PASS", "FAIL", "BLOCKED", "NOT TESTED"].reduce((acc, status) => {
    acc[status] = checks.filter((x) => x.status === status).length; return acc;
  }, {});
  result.status = result.totals.FAIL ? "FAIL" : result.totals.BLOCKED ? "BLOCKED" : "PASS";
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.totals.FAIL ? 1 : result.totals.BLOCKED ? 2 : 0;
}
