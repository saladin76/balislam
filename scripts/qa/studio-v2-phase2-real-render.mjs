#!/usr/bin/env node
/**
 * Studio V2 QA-08 REAL Remotion acceptance on a local synthetic 3-scene fixture.
 * Explicit opt-in, serialized, run only on a composite integration worktree.
 * This script does NOT manufacture human AV approval or Master eligibility.
 */
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { constants } from "node:fs";
import { open, readFile, realpath, lstat, statfs, stat, rm, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const report = { task: "Studio V2 QA-08 actual Remotion", checkoutSha: null, checks: [], overall: "BLOCKED" };
const add = (id, status, detail) => report.checks.push({ id, status, ...(detail ? { detail } : {}) });
const deny = (message) => { add("PRECONDITION", "BLOCKED", message); throw Object.assign(Error(message), { qaBlocked: true }); };
const hash = (b) => createHash("sha256").update(b).digest("hex");
const ch = process.env.STUDIO_V2_QA_CHANNEL ?? "balislam";
const ep = process.env.STUDIO_V2_QA_EPISODE ?? "";
const id = process.env.STUDIO_V2_QA_SCENE ?? "c1-s1";
const filename = process.env.STUDIO_V2_QA_FIXTURE_DIR ?? "";
const baseUrl = process.env.STUDIO_V2_QA_BASE_URL ?? "";
const secret = process.env.STUDIO_V2_OWNER_SECRET ?? "";
let leaseFile;
let leaseStat;
let leaseValue;
let fixture;

async function validate() {
  if (process.env.STUDIO_V2_QA_ALLOW_RENDER !== "1" ||
      process.env.STUDIO_V2_QA_RENDER_SERIAL !== "1")
    deny("Opt-in requires STUDIO_V2_QA_ALLOW_RENDER=1 and STUDIO_V2_QA_RENDER_SERIAL=1");
  if (process.platform !== "darwin")
    deny("Real Remotion acceptance is Mac-only by policy; Linux technical FFmpeg smoke is separate");
  if (!/^[0-9]{3}$/.test(ep) || !/^c1-s[123]$/.test(id) ||
      !["balislam", "dafatir-alzaman", "zubdat-alkutub"].includes(ch) ||
      !filename || secret.length < 32) deny("Invalid QA-only scope or owner configuration");
  let base;
  try { base = new URL(baseUrl); } catch { deny("Invalid loopback URL"); }
  if (base.protocol !== "http:" ||
      !["127.0.0.1", "localhost", "[::1]"].includes(base.hostname) ||
      base.pathname !== "/" || base.search || base.hash || base.username || base.password)
    deny("Render requests require a loopback-only QA HTTP server");
  try { fixture = await realpath(filename); } catch { deny("QA fixture missing"); }
  if (path.dirname(fixture) !== path.join(root, "channels", ch, "episodes") ||
      !new RegExp("^" + ep + "-qa-[a-z0-9-]+$").test(path.basename(fixture)) ||
      (await readFile(path.join(fixture, ".studio-v2-qa-sentinel"), "utf8").catch(() => "")).trim() !== "STUDIO_V2_QA_ONLY")
    deny("Require a sentinel-bearing NNN-qa-* fixture inside this checkout");
  const ffprobe = process.env.STUDIO_V2_FFPROBE ?? "";
  const ffmpeg = process.env.STUDIO_V2_FFMPEG_BIN ?? "";
  const browser = process.env.STUDIO_V2_BROWSER_EXECUTABLE ?? "";
  for (const binary of [ffprobe, ffmpeg, browser])
    if (!path.isAbsolute(binary) || !(await stat(binary).catch(() => null))?.isFile())
      deny("Missing absolute installed ffprobe, ffmpeg or Chrome executable");
  if (os.freemem() < 1.8 * 1024 ** 3)
    deny("Available free RAM below 1.8 GiB; do not start heavy Mac renderer");
  const disk = await statfs(fixture);
  if (Number(disk.bavail) * Number(disk.bsize) < 7 * 1024 ** 3)
    deny("Free disk below 7 GiB; do not start heavy renderer");
  report.checkoutSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  report.environment = { platform: process.platform, qaEpisode: path.basename(fixture), scene: id };
  add("RESOURCE_PREFLIGHT", "PASS", "Mac with >=1.8 GiB free RAM, >=7 GiB free disk and real binary paths");
  leaseFile = path.join(fixture, ".studio-v2-qa-render.lock");
  leaseValue = JSON.stringify({ nonce: randomUUID(), pid: process.pid, gitSha: report.checkoutSha });
  let handle;
  try { handle = await open(leaseFile, "wx", 0o600); }
  catch { deny("Another QA renderer lock already exists; never steal or remove it"); }
  leaseStat = await handle.stat();
  try { await handle.writeFile(leaseValue); await handle.sync(); }
  finally { await handle.close(); }
  return base;
}
async function run(base) {
  const endpoint = "/api/studio-v2/episodes/" + ep;
  const q = "?channel=" + encodeURIComponent(ch);
  const toUrl = (p) => new URL(p, base).toString();
  const request = async (p, method = "GET", body, cookie = "", csrf = "") => {
    const headers = { accept: "application/json", ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(method === "GET" ? {} : { origin: base.origin }),
      ...(cookie ? { cookie } : {}), ...(csrf ? { "x-studio-v2-csrf": csrf } : {}) };
    const res = await fetch(toUrl(p), { method, headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15 * 60 * 1000), redirect: "manual" });
    const text = await res.text();
    let payload;
    try { payload = JSON.parse(text); } catch { payload = { invalidJson: true }; }
    return { status: res.status, payload, headers: res.headers };
  };
  const login = await request("/api/studio-v2/session", "POST", { secret });
  if (login.status !== 200 || !login.payload.csrfToken) deny("Authenticated owner HTTP session unavailable");
  const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];
  if (!/^studio_v2_sid=[a-f0-9]{64}$/.test(cookie)) deny("Missing real HttpOnly owner session cookie");
  const csrf = login.payload.csrfToken;
  const get = (p) => request(p, "GET", undefined, cookie, csrf);
  const post = (p, body) => request(p, "POST", body, cookie, csrf);
  const scope = endpoint + "/scenes" + q;
  const before = await get(scope);
  if (before.status !== 200 || !Array.isArray(before.payload.scenes)) deny("Server-scoped current scenes not available");
  const scenes = before.payload.scenes;
  if (scenes.map((s) => s.id).join(",") !== "c1-s1,c1-s2,c1-s3") deny("Locked plan is not the exact QA 3-scene order");
  const target = scenes.find((s) => s.id === id);
  if (target?.status !== "producing") deny("Scene must be explicitly begun by owner, and prior scenes approved");
  if (scenes.slice(0, scenes.indexOf(target)).some((s) => s.status !== "approved"))
    deny("Prior scene does not carry current owner approval");
  const spec = path.join(fixture, ".studio-v2-render-specs", id + ".json");
  const specStat = await lstat(spec).catch(() => null);
  if (!specStat?.isFile() || specStat.isSymbolicLink() || specStat.nlink !== 1)
    deny("Signed server-owned render spec missing; QA will NOT invent it");
  const renderPath = endpoint + "/scenes/" + id + "/render" + q;
  const rendered = await post(renderPath, { expectedRevision: before.payload.revision });
  if (rendered.status !== 200 || rendered.payload.status !== "rendered") {
    add("REAL_RENDER", rendered.status === 503 ? "BLOCKED" : "FAIL",
      "HTTP " + rendered.status + " " + (rendered.payload.code ?? "non-rendered"));
    return;
  }
  add("REAL_RENDER", "PASS", "Backend invoked trusted Remotion and independently registered result");
  const registryFile = path.join(fixture, ".studio-v2-manifests", id + ".json");
  const registry = JSON.parse(await readFile(registryFile, "utf8"));
  if (!registry.integrity?.mac || !/^[a-f0-9]{64}$/.test(registry.integrity.mac))
    throw Error("Signed registry missing expected HMAC representation");
  const relative = registry.manifest?.inputs?.video?.files?.[0];
  if (typeof relative !== "string" ||
      !new RegExp("^previews/" + id + "-[a-f0-9]{12}-[a-f0-9-]{36}\\.mp4$").test(relative))
    throw Error("Registry did not publish a pinned, immutable QA scene MP4");
  const mp4 = path.resolve(fixture, relative);
  if (!mp4.startsWith(fixture + path.sep) || await realpath(mp4) !== mp4)
    throw Error("Unsafe/symlinked scene output");
  const st = await lstat(mp4);
  if (!st.isFile() || st.isSymbolicLink() || st.nlink !== 1 || st.size < 1000)
    throw Error("MP4 is not a normal immutable scene file");
  const digest = hash(await readFile(mp4));
  if (digest !== rendered.payload.video?.sha256) throw Error("Rendered and stored SHA-256 mismatch");
  add("MP4_SHA_MANIFEST", "PASS", { sha256: digest, bytes: st.size, relativeFile: relative });
  const ffprobeBinary = process.env.STUDIO_V2_FFPROBE;
  const probe = JSON.parse(execFileSync(ffprobeBinary, [
    "-v", "error", "-show_streams", "-show_format", "-of", "json", mp4,
  ], { encoding: "utf8", timeout: 60_000, maxBuffer: 5 * 1024 * 1024 }));
  if (!probe.streams?.some((s) => s.codec_type === "video" && s.codec_name === "h264") ||
      !(Number(probe.format?.duration) > 0))
    throw Error("Real MP4 probe invalid video codec/duration");
  add("REAL_FFPROBE", "PASS", { durationSec: Number(probe.format.duration), streams: probe.streams.map((s) => ({ codec: s.codec_name, type: s.codec_type })) });
  execFileSync(process.env.STUDIO_V2_FFMPEG_BIN, [
    "-hide_banner", "-loglevel", "error", "-i", mp4, "-f", "null", "-",
  ], { timeout: 180_000, maxBuffer: 1024 * 1024 });
  add("REAL_FULL_DECODE", "PASS");
  const after = await get(scope);
  const scene = after.payload?.scenes?.find((s) => s.id === id);
  if (after.status !== 200 || scene?.status !== "producing" || !/^[a-f0-9]{64}$/.test(scene.fingerprint ?? ""))
    throw Error("Server did not project the real current MP4 as producing/unsubmitted");
  const submitted = await post(endpoint + "/scenes/" + id + "/commands" + q, {
    action: "submit", expectedFingerprint: scene.fingerprint,
  });
  if (submitted.status !== 200) throw Error("Actual MP4 submission rejected with HTTP " + submitted.status);
  add("REAL_SUBMIT_FOR_AV", "PASS", "No automatic AV review/approval");
  const final = await get(scope);
  if (final.payload?.scenes?.find((s) => s.id === id)?.status !== "in_review")
    throw Error("Scene is not in_review after explicit server-side submission");
  add("NO_AUTO_APPROVAL", "PASS", "Await separately authenticated owner 1x playback and explicit decision");
  add("HUMAN_AV_ATTENTION", "BLOCKED", "Actual Chrome/owner review still required; this runner cannot approve");
}
try {
  const base = await validate();
  await run(base);
} catch (error) {
  if (!error.qaBlocked) add("RUN", "FAIL", String(error));
} finally {
  if (leaseFile && leaseStat && leaseValue) {
    try {
      const current = await lstat(leaseFile);
      if (current.isFile() && !current.isSymbolicLink() &&
          current.ino === leaseStat.ino && current.dev === leaseStat.dev &&
          (await readFile(leaseFile, "utf8")) === leaseValue) await rm(leaseFile);
    } catch (e) { add("LEASE_CLEANUP", "FAIL", String(e)); }
  }
  report.totals = ["PASS", "FAIL", "BLOCKED", "NOT TESTED"].reduce((out, state) => {
    out[state] = report.checks.filter((x) => x.status === state).length; return out;
  }, {});
  report.overall = report.totals.FAIL ? "FAIL" : report.totals.BLOCKED ? "BLOCKED" : "PASS";
  const evidenceDir = path.join(root, ".studio-v2-qa-evidence", "real-remotion");
  if (process.env.STUDIO_V2_QA_EVIDENCE === "1" && fixture) {
    await mkdir(evidenceDir, { recursive: true, mode: 0o700 });
    await writeFile(path.join(evidenceDir, "scene-" + id + ".json"),
      JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
  }
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.totals.FAIL ? 1 : report.totals.BLOCKED ? 2 : 0;
}
