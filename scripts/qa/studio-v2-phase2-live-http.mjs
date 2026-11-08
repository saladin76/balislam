#!/usr/bin/env node
/**
 * Studio V2 QA-08. Real HTTP acceptance only; NO mocked production routes.
 * The running Vite server MUST be a separate, QA-only integration worktree.
 *
 * Phases: security, gate-before-first, review-negative, after-first,
 * after-second, assembly. No script/Storyboard signoff or AV approval is faked.
 * Missing components are BLOCKED, never counted PASS.
 */
import { readFile, realpath, mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const phase = process.argv.find((x) => x.startsWith("--phase="))?.slice(8) ?? "security";
const phases = new Set(["security", "gate-before-first", "review-negative", "after-first", "after-second", "assembly"]);
const report = { task: "Studio V2 QA-08 live HTTP", phase, gitSha: null, source: "REAL HTTP only", checks: [], status: "NOT TESTED" };
const add = (id, status, details = {}) => report.checks.push({ id, status, ...details });
const blocked = (id, reason) => add(id, "BLOCKED", { reason });
const pass = (id, details = {}) => add(id, "PASS", details);
const fail = (id, reason) => add(id, "FAIL", { reason });
const q = (value) => encodeURIComponent(value);

async function main() {
  if (!phases.has(phase)) { blocked("CONFIG", "Unknown QA-08 phase"); return; }
  const rawUrl = process.env.STUDIO_V2_QA_BASE_URL;
  const ch = process.env.STUDIO_V2_QA_CHANNEL ?? "balislam";
  const episode = process.env.STUDIO_V2_QA_EPISODE ?? "";
  const fixture = process.env.STUDIO_V2_QA_FIXTURE_DIR ?? "";
  const secret = process.env.STUDIO_V2_OWNER_SECRET;
  const writes = process.env.STUDIO_V2_QA_ALLOW_WRITES === "1";
  if (!rawUrl || !fixture || !secret || !/^[0-9]{3}$/.test(episode) ||
      !["balislam", "dafatir-alzaman", "zubdat-alkutub"].includes(ch)) {
    blocked("CONFIG", "Provide STUDIO_V2_QA_BASE_URL, STUDIO_V2_QA_FIXTURE_DIR, STUDIO_V2_OWNER_SECRET, STUDIO_V2_QA_EPISODE (NNN) and valid channel");
    return;
  }
  let base;
  try { base = new URL(rawUrl); } catch { blocked("CONFIG", "Invalid base URL"); return; }
  if (base.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(base.hostname) ||
      base.username || base.password || base.pathname !== "/" || base.search || base.hash) {
    blocked("SAFETY", "Only an HTTP loopback QA server root is allowed");
    return;
  }
  let resolved;
  try { resolved = await realpath(fixture); } catch { blocked("SAFETY", "QA fixture directory missing"); return; }
  const expected = path.join(root, "channels", ch, "episodes");
  if (path.dirname(resolved) !== expected || !new RegExp("^" + episode + "-qa-[a-z0-9-]+$").test(path.basename(resolved))) {
    blocked("SAFETY", "Fixture must be an NNN-qa-* episode in THIS checkout and channel");
    return;
  }
  const sentinel = path.join(resolved, ".studio-v2-qa-sentinel");
  try {
    if ((await readFile(sentinel, "utf8")).trim() !== "STUDIO_V2_QA_ONLY") throw Error();
  } catch { blocked("SAFETY", "Missing exact .studio-v2-qa-sentinel; no HTTP calls issued"); return; }
  if (secret.length < 32) { blocked("CONFIG", "Owner secret too short"); return; }
  report.gitSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const url = (endpoint) => new URL(endpoint, base).toString();
  const ep = "/api/studio-v2/episodes/" + episode;
  const scoped = (suffix) => ep + suffix + "?channel=" + q(ch);
  const scene = (id, suffix) => scoped("/scenes/" + id + suffix);
  const origin = base.origin;
  const request = async (endpoint, { method = "GET", body, cookie, csrf, overrideOrigin, contentType = "application/json", extra = {} } = {}) => {
    const headers = { "accept": "application/json", ...extra };
    if (body !== undefined) headers["content-type"] = contentType;
    if (method !== "GET") headers.origin = overrideOrigin ?? origin;
    if (cookie) headers.cookie = cookie;
    if (csrf) headers["x-studio-v2-csrf"] = csrf;
    const response = await fetch(url(endpoint), {
      method, headers, redirect: "manual", cache: "no-store",
      signal: AbortSignal.timeout(15_000),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const type = response.headers.get("content-type") ?? "";
    const payload = type.includes("json") ? await response.json() : await response.text();
    return { status: response.status, payload, headers: response.headers };
  };
  const check = async (id, action, expected) => {
    try {
      const response = await action();
      if (expected.includes(response.status)) pass(id, { http: response.status, code: response.payload?.code });
      else if (response.status === 503) blocked(id, "Required runtime dependency is unavailable (" + (response.payload?.code ?? "HTTP 503") + ")");
      else fail(id, "Expected HTTP " + expected.join("/") + ", got " + response.status + " (" + (response.payload?.code ?? "no-code") + ")");
      return response;
    } catch (e) { fail(id, String(e)); return null; }
  };
  const anonymous = await check("HTTP_ANONYMOUS_SCENES", () => request(scoped("/scenes")), [401]);
  const invalid = await check("HTTP_FORGED_LOGIN_ROLE", () => request("/api/studio-v2/session", {
    method: "POST", body: { secret, role: "owner" },
  }), [401]);
  // Single malformed credential request to avoid lockout/rate-limit disruption.
  const login = await check("HTTP_OWNER_SESSION", () => request("/api/studio-v2/session", {
    method: "POST", body: { secret },
  }), [200]);
  if (!login || login.status !== 200) {
    blocked("AUTHENTICATED_CASES", "Real owner session unavailable; no privileged commands attempted");
    return;
  }
  const setCookie = login.headers.get("set-cookie") ?? "";
  if (!/^studio_v2_sid=[a-f0-9]{64};/.test(setCookie) ||
      !setCookie.includes("HttpOnly") || !setCookie.includes("SameSite=Strict") ||
      !/^[a-f0-9]{64}$/.test(login.payload?.csrfToken ?? "")) {
    fail("SESSION_COOKIE", "HTTP-only SameSite owner cookie/CSRF token malformed");
    return;
  }
  pass("SESSION_COOKIE", { attributes: ["HttpOnly", "SameSite=Strict"] });
  const cookie = setCookie.split(";")[0];
  const csrf = login.payload.csrfToken;
  const authenticated = (endpoint, opts = {}) => request(endpoint, { cookie, csrf, ...opts });
  await check("HTTP_SESSION_READ", () => authenticated("/api/studio-v2/session"), [200]);
  await check("HTTP_LEGACY_QUARANTINE", () => authenticated("/api/channels"), [423]);
  await check("HTTP_CROSS_ORIGIN", () => authenticated(scoped("/sources"), {
    method: "POST", overrideOrigin: "http://evil.invalid",
    body: { stage: "script", expectedFingerprint: "0".repeat(64), note: "test" },
  }), [403]);
  await check("HTTP_MISSING_CSRF", () => authenticated(scoped("/sources"), {
    method: "POST", csrf: "", body: { stage: "script", expectedFingerprint: "0".repeat(64), note: "test" },
  }), [403]);
  await check("HTTP_WRONG_CSRF", () => authenticated(scoped("/sources"), {
    method: "POST", csrf: "0".repeat(64),
    body: { stage: "script", expectedFingerprint: "0".repeat(64), note: "test" },
  }), [403]);
  await check("HTTP_FORGED_SOURCE_ACTOR", () => authenticated(scoped("/sources"), {
    method: "POST",
    body: { stage: "script", expectedFingerprint: "0".repeat(64), note: "test", actor: "owner" },
  }), [400]);
  await check("HTTP_FORGED_SCENE_EVIDENCE", () => authenticated(scene("c1-s1", "/commands"), {
    method: "POST",
    body: { action: "approve", expectedFingerprint: "0".repeat(64), reviewId: "0".repeat(48), watched: true },
  }), [400]);
  await check("HTTP_FORGED_RENDER_SPEC", () => authenticated(scene("c1-s1", "/render"), {
    method: "POST", body: {
      expectedRevision: 0, path: "/tmp/forged.mp4", actor: "owner",
      sourceApproved: true, recitationEvidence: { origin: "owner-upload" },
    },
  }), [400]);
  await check("HTTP_UNSCOPED_REVIEW_ID", () => authenticated(scoped("/scenes/c1-s1/media") + "&reviewId=" + "0".repeat(48)), [409, 403]);
  const state = await check("HTTP_REAL_SCENE_INSPECTION", () => authenticated(scoped("/scenes")), [200]);
  if (!state || state.status !== 200 || !Array.isArray(state.payload?.scenes)) {
    blocked("THREE_SCENE_GATE", "Real server scene read-model unavailable");
    return;
  }
  const scenes = state.payload.scenes;
  const order = scenes.map((x) => x.id);
  if (JSON.stringify(order) !== JSON.stringify(["c1-s1", "c1-s2", "c1-s3"])) {
    fail("FIXTURE_ORDER", "Expected exact three-scene locked server order c1-s1,c1-s2,c1-s3; observed " + JSON.stringify(order));
    return;
  }
  pass("FIXTURE_ORDER", { order });
  const statuses = Object.fromEntries(scenes.map((x) => [x.id, x.status]));
  if (phase === "security") {
    blocked("RENDER_AV_MASTER", "Security phase is not real rendering, full owner viewing or Master acceptance");
    return;
  }
  const sources = await check("HTTP_SOURCES_INSPECTION", () => authenticated(scoped("/sources")), [200]);
  const ready = sources?.status === 200 && sources.payload?.script?.approved === true &&
    sources.payload?.storyboard?.approved === true;
  if (phase === "gate-before-first") {
    if (!writes) { blocked("SCENE_PREPARATION", "Set STUDIO_V2_QA_ALLOW_WRITES=1 after verifying synthetic QA fixture"); return; }
    if (!ready) { blocked("SOURCE_SIGNOFF", "Owner must explicitly approve real script and Storyboard; QA never forges signoff"); return; }
    for (const id of ["c1-s2", "c1-s3"]) {
      if (statuses[id] === "draft") await check("PREPARE_WORKFLOW_STATE_" + id, () => authenticated(scene(id, "/commands"), {
        method: "POST", body: { action: "prepare" },
      }), [200]);
      else add("PREPARE_" + id, statuses[id] === "prepared" ? "PASS" : "NOT TESTED", { observedStatus: statuses[id] });
    }
    blocked("FUTURE_ASSET_PREPARATION", "prepare command only marks the workflow; actual future asset generation and rights must be verified separately");
    await check("SCENE_2_BEGIN_BLOCKED", () => authenticated(scene("c1-s2", "/commands"), {
      method: "POST", body: { action: "begin" },
    }), [409]);
    await check("SCENE_3_BEGIN_BLOCKED", () => authenticated(scene("c1-s3", "/commands"), {
      method: "POST", body: { action: "begin" },
    }), [409]);
    await check("ASSEMBLY_PREMATURE_BLOCKED", () => authenticated(scoped("/assembly-eligibility")), [409]);
    blocked("FIRST_SCENE_REAL_RENDER", "Requires trusted signed render spec, opt-in real Remotion Mac execution and independent output verification");
    blocked("FIRST_SCENE_AV_APPROVAL", "Requires actual browser 1x owner review; never synthesize a completed receipt");
    return;
  }
  if (phase === "review-negative") {
    const first = scenes[0];
    if (first.status !== "in_review" || !first.fingerprint) {
      blocked("AV_REVIEW", "Scene 1 must be submitted with registered real MP4 before review-negative phase");
      return;
    }
    const start = await check("REAL_AV_REVIEW_START", () => authenticated(scene(first.id, "/review/start"), {
      method: "POST", body: { expectedFingerprint: first.fingerprint },
    }), [200]);
    if (!start || start.status !== 200) return;
    const reviewId = start.payload.reviewId;
    await check("AV_CANNOT_FINISH_UNWATCHED", () => authenticated(scene(first.id, "/review/" + reviewId + "/finish"), {
      method: "POST", body: { confirmation: "reviewed_av" },
    }), [409]);
    await check("AV_REJECT_FAKE_BOOL", () => authenticated(scene(first.id, "/review/" + reviewId + "/finish"), {
      method: "POST", body: { watched: true },
    }), [409]);
    await check("AV_REJECT_FAST_SEEK", () => authenticated(scene(first.id, "/review/" + reviewId + "/tick"), {
      method: "POST", body: { challenge: start.payload.challenge, positionSec: start.payload.durationSec },
    }), [409]);
    await check("AV_REJECT_STALE_FP", () => authenticated(scene(first.id, "/review/start"), {
      method: "POST", body: { expectedFingerprint: "0".repeat(64) },
    }), [409]);
    blocked("HUMAN_AV_1X", "Negative receipt checks do not prove real owner playback/attention; complete actual Chrome 1x before explicit approval");
    return;
  }
  if (phase === "after-first" || phase === "after-second") {
    const expectedApprovals = phase === "after-first" ? ["c1-s1"] : ["c1-s1", "c1-s2"];
    if (!expectedApprovals.every((id) => statuses[id] === "approved")) {
      blocked("PRIOR_SCENE_APPROVALS", "Real owner AV approvals required: " + expectedApprovals.join(","));
      return;
    }
    pass("PRIOR_SCENE_APPROVALS", { approved: expectedApprovals });
    if (!writes) { blocked("NEXT_SCENE_BEGIN", "Set STUDIO_V2_QA_ALLOW_WRITES=1 for isolated QA fixture"); return; }
    const next = phase === "after-first" ? "c1-s2" : "c1-s3";
    await check("NEXT_SCENE_BEGIN_" + next, () => authenticated(scene(next, "/commands"), {
      method: "POST", body: { action: "begin" },
    }), [200]);
    if (phase === "after-first") await check("SCENE_3_STILL_BLOCKED", () => authenticated(scene("c1-s3", "/commands"), {
      method: "POST", body: { action: "begin" },
    }), [409]);
    blocked("NEXT_RENDER_AND_HUMAN_REVIEW", "Separate current-byte real Remotion rendering and 1x review before next phase");
    return;
  }
  if (phase === "assembly") {
    if (!order.every((id) => statuses[id] === "approved")) {
      blocked("ASSEMBLY_ELIGIBILITY", "All three current exact AV scenes need real owner approvals");
      return;
    }
    await check("REAL_ASSEMBLY_ELIGIBILITY", async () => {
      const r = await authenticated(scoped("/assembly-eligibility"));
      if (r.status === 200 && !/^[a-f0-9]{64}$/.test(r.payload?.sceneAssemblyFingerprint ?? ""))
        return { ...r, status: 599 };
      return r;
    }, [200]);
    blocked("MASTER_PUBLISH", "Eligibility is NOT Master assembly, full-episode viewing, exact Master approval or publication");
  }
}

try { await main(); }
catch (e) { fail("UNHANDLED", e instanceof Error ? e.message : String(e)); }
report.summary = ["PASS", "FAIL", "BLOCKED", "NOT TESTED"].reduce((a, key) => {
  a[key] = report.checks.filter((c) => c.status === key).length; return a;
}, {});
report.status = report.summary.FAIL ? "FAIL" : report.summary.BLOCKED ? "BLOCKED" : report.summary["NOT TESTED"] ? "NOT TESTED" : "PASS";
const evidence = process.env.STUDIO_V2_QA_EVIDENCE_DIR;
if (evidence && path.isAbsolute(evidence)) {
  const realRoot = await realpath(root).catch(() => root);
  const target = path.resolve(evidence);
  if (target.startsWith(realRoot + path.sep) && target.includes(path.sep + ".studio-v2-qa-evidence" + path.sep)) {
    await mkdir(target, { recursive: true, mode: 0o700 });
    await writeFile(path.join(target, "phase2-" + phase + ".json"), JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
  } else console.error("QA evidence path rejected: must be inside this checkout under .studio-v2-qa-evidence/");
}
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.summary.FAIL ? 1 : report.summary.BLOCKED ? 2 : report.summary["NOT TESTED"] ? 3 : 0;
