import { browserPlanRevision } from "../src/plan/revision";
/**
 * «جهّز كل المشاهد» over the REAL Studio server API (same harness as studio-e2e-cycle.test.ts).
 *
 * Stubs: the heavy Remotion render behind shotsPreview (an ffmpeg clip with audio), and the ElevenLabs
 * HTTP API (intercepted in globalThis.fetch; it returns a real MP3). No keys, no network.
 * Proves: drafts exist for all scenes ahead of approval, without any submission or approval; approvals
 * stay strictly ordered on exact bytes; a missing voice key is reported, not a crash; editing scene 2
 * discards only its draft and re-opens only it; a second run re-queues only that scene.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFile, mkdtemp, mkdir, readFile, rm, rmdir, writeFile } from "node:fs/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Plugin, type ViteDevServer } from "vite";
import { balApi } from "../app/server/api";
import { PREP_VALID_TAIL } from "./fixtures/prepValidScript";

const repo = path.resolve(import.meta.dirname, "..");
const CH = "balislam";
const EP = "986";
const EP_DIR = "986-prepare-all";
/** No passphrase (owner decision 9 Nov): a page of another site is refused (403); the Studio page is the owner. */
const CROSS = { origin: "https://evil.example" };

const ffmpeg = (args: string[]) => execFileSync("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", ...args]);

const stubbedRenders: string[] = [];
const renderStub = (): Plugin => ({
  name: "prepare-stub-remotion-render",
  enforce: "pre",
  resolveId(source, importer) {
    if (source === "./episode" && importer?.replace(/\\/g, "/").includes("/src/render/shotsPreview.ts")) return "\0prepare-render-stub";
    return null;
  },
  load(id) {
    if (id !== "\0prepare-render-stub") return null;
    return `
      import { execFileSync } from "node:child_process";
      import { mkdirSync } from "node:fs";
      import path from "node:path";
      export const renderEpisode = async (o) => {
        mkdirSync(path.dirname(o.outFile), { recursive: true });
        execFileSync("ffmpeg", ["-nostdin","-hide_banner","-loglevel","error","-y",
          "-f","lavfi","-i","testsrc=size=320x180:rate=30:duration=2",
          "-f","lavfi","-i","sine=frequency=330:duration=2",
          "-c:v","libx264","-pix_fmt","yuv420p","-preset","ultrafast","-c:a","aac","-b:a","64k",
          "-shortest","-movflags","+faststart", o.outFile]);
        globalThis.__prepStubRenders?.push(o.plan.chapters.flatMap((c) => c.scenes.map((s) => s.id)).join(","));
        return o.outFile;
      };`;
  },
});

let root = "";
let epDir = "";
let vite: ViteDevServer;
let server: http.Server;
let base = "";
const realFetch = globalThis.fetch;
const elevenCalls: string[] = [];
let mp3 = Buffer.alloc(0);
const saved: Record<string, string | undefined> = {};
const ENV_KEYS = ["BAL_CHANNELS_DIR", "BAL_ENV_FILE", "BAL_WORKFLOW_HMAC_KEY", "BAL_DRIVE_PREVIEWS_DIR",
  "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID", "ELEVENLABS_MODEL_ID"];

const call = async (method: string, route: string, body?: unknown, headers: Record<string, string> = {}) => {
  const r = await realFetch(`${base}/api/${route}${route.includes("?") ? "&" : "?"}channel=${CH}`, {
    method,
    headers: { "sec-fetch-site": "same-origin", ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let parsed: any = text;
  try { parsed = JSON.parse(text); } catch { /* binary */ }
  return { status: r.status, body: parsed };
};
const state = async () => {
  const r = await call("GET", `episodes/${EP}/scene-production`);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r.body;
};
const decide = (cmd: Record<string, unknown>, headers: Record<string, string> = {}) => call("POST", `episodes/${EP}/scene-production`, cmd, headers);
/** Never submitted/approved ("queued" or "needs_revision" after an input change). */
const open = (status: string) => (status === "queued" || status === "needs_revision" ? "open" : status);
const ledger = async () => JSON.parse(await readFile(path.join(epDir, "scene-production.v1.json"), "utf8"));
/** Start «جهّز كل المشاهد» and wait for the background queue to finish. */
const prepareAll = async (body?: { renderOnly: true } | { voice: { confirm: true; fingerprint: string } }) => {
  const start = await call("POST", `episodes/${EP}/scene-prepare`, body);
  if (start.status !== 200) return start;
  for (let i = 0; i < 600; i++) {
    const r = await call("GET", `episodes/${EP}/scene-prepare`);
    if (r.body.job?.status !== "running") return r;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("prepare queue did not finish");
};

const scenes = [
  { id: "c1-s1", narration: "الصبر مفتاح الفرج." },
  { id: "c1-s2", narration: "والشكر يحفظ النعمة." },
  { id: "c1-s3", narration: "والرضا راحة القلب." },
];
const planOf = (s2text = "الشكر") => ({
  channel: CH, episode: EP, title: "تجهيز كل المشاهد",
  chapters: [{ number: 1, title: "تجربة", scenes: scenes.map((s, i) => ({
    id: s.id, template: "big-question", line: 7 + i, narration: s.narration, sfx: [], tone: "calm",
    props: { text: s.id === "c1-s2" ? s2text : s.narration.split(" ")[0] },
  })) }],
});

beforeAll(async () => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  await mkdir(path.join(repo, "renders"), { recursive: true });
  root = await mkdtemp(path.join(repo, "renders", "prepare-all-"));
  const chDir = path.join(root, CH);
  epDir = path.join(chDir, "episodes", EP_DIR);
  await mkdir(epDir, { recursive: true });
  for (const f of ["channel.json", "identity.json", "identity.default.json", "pronunciation.json"])
    await copyFile(path.join(repo, "channels", CH, f), path.join(chDir, f));
  process.env.BAL_CHANNELS_DIR = root;
  process.env.BAL_ENV_FILE = path.join(root, ".env");
  for (const k of ["BAL_WORKFLOW_HMAC_KEY", "BAL_DRIVE_PREVIEWS_DIR", "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"]) delete process.env[k];
  process.env.ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";
  (globalThis as any).__prepStubRenders = stubbedRenders;

  await writeFile(path.join(epDir, "script.md"),
    `---\ntitle: "تجهيز كل المشاهد"\ndomain: psychology\nepisode: "${EP}"\n---\n## الفصل 1 · تجربة\n${scenes.map((s) => s.narration).join("\n")}\n` + PREP_VALID_TAIL);
  await writeFile(path.join(epDir, "tashkeel.md"), "الصَّبْرُ مِفْتَاحُ الفَرَجِ. وَالشُّكْرُ يَحْفَظُ النِّعْمَةَ. وَالرِّضَا رَاحَةُ القَلْبِ.\n");
  await writeFile(path.join(epDir, "plan.json"), JSON.stringify(planOf(), null, 2));
  // Only the first scene has its narration already; the other two need voice.
  const voice = path.join(epDir, "voice");
  await mkdir(voice);
  ffmpeg(["-f", "lavfi", "-i", "sine=frequency=300:duration=1.5", "-c:a", "libmp3lame", "-b:a", "64k", path.join(voice, "c1-s1.mp3")]);
  await writeFile(path.join(voice, "index.json"), JSON.stringify({
    "c1-s1": { file: "c1-s1.mp3", hash: "pre-existing01", text: scenes[0]!.narration, duration: 1.5, words: [] },
  }, null, 2));
  mp3 = await readFile(path.join(voice, "c1-s1.mp3"));

  // ElevenLabs stub: the server runs in this process, so its fetch is this fetch.
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(typeof input === "string" ? input : input.url);
    if (!url.startsWith("https://api.elevenlabs.io")) return realFetch(input, init);
    elevenCalls.push(`${init?.method ?? "GET"} ${new URL(url).pathname}`);
    if (url.includes("/with-timestamps")) {
      const text = JSON.parse(init.body).text as string;
      expect(text).toMatch(/[ً-ْ]/); // voiced from the vowelized text
      return new Response(JSON.stringify({ audio_base64: mp3.toString("base64"), alignment: null }), { status: 200 });
    }
    if (/\/v1\/voices\//.test(url)) return new Response(JSON.stringify({ voice_id: "stub-voice", name: "stub", category: "cloned" }), { status: 200 });
    return new Response("not stubbed", { status: 404 });
  }) as typeof fetch;

  vite = await createServer({
    configFile: false, root: path.join(repo, "app"), logLevel: "error", appType: "custom",
    plugins: [renderStub(), balApi()],
    server: { middlewareMode: true, hmr: false, watch: null, fs: { allow: [repo, root] } },
  });
  server = http.createServer(vite.middlewares);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, 120_000);

afterAll(async () => {
  globalThis.fetch = realFetch;
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  await vite?.close();
  for (const k of ENV_KEYS) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  delete (globalThis as any).__prepStubRenders;
  if (root) await rm(root, { recursive: true, force: true });
  await rm(path.join(repo, "renders", ".private-media", "_render", CH, EP_DIR), { recursive: true, force: true });
  for (const dir of [path.join(repo, "renders", ".private-media", "_render", CH), path.join(repo, "renders", ".private-media", "_render"), path.join(repo, "renders", ".private-media")])
    await rmdir(dir).catch(() => undefined);
});

describe("«جهّز كل المشاهد»: drafts ahead of ordered approvals", () => {
  it("voices and pre-renders every scene without approving anything; approvals in any order; an edit discards only its draft", async () => {
    // ── Script and storyboard approvals (prerequisites) ─────────────────────────────────────────
    // Nothing is prepared before script + storyboard approval, nor from another site.
    expect((await call("POST", `episodes/${EP}/scene-prepare`)).status).toBe(409);
    let s = await state();
    expect((await decide({ action: "approve-script", reviewed: true, expectedSha256: s.script.sha256 })).status).toBe(200);
    const board = await call("PUT", `episodes/${EP}/storyboard`, { action: "approve", auditNote: "راجعت اللوحات الثلاث بصريًا: النص والتكوين والتوقيت مطابقة للسكريبت." });
    expect(board.status, JSON.stringify(board.body)).toBe(200);
    s = await state();
    expect((await decide({ action: "approve-storyboard", reviewed: true, expectedSha256: s.storyboard.sha256 })).status).toBe(200);
    expect((await call("POST", `episodes/${EP}/scene-prepare`, undefined, CROSS)).status).toBe(403);
    // «أوقف» (D36): owner-only; a stopped queue starts nothing new and approves nothing.
    expect((await call("DELETE", `episodes/${EP}/scene-prepare`, undefined, CROSS)).status).toBe(403);
    expect((await call("DELETE", `episodes/${EP}/scene-prepare`)).body).toMatchObject({ job: null });
    {
      const { prepareAllScenes } = await import("../src/studio/prepareAll");
      const { runWithChannel } = await import("../src/channel");
      const drafted: string[] = [];
      const stopped = await runWithChannel(CH, () => prepareAllScenes(EP, { voiceClient: null,
        render: async (_e, id) => { drafted.push(id); }, shouldStop: () => true }));
      expect(stopped).toMatchObject({ stopped: true, rendered: [], phase: "done" });
      expect(drafted).toEqual([]);
      // Audit item 5: a scene whose same inputs just failed is not rendered again by the queue…
      const failing = await runWithChannel(CH, () => prepareAllScenes(EP, { voiceClient: null,
        render: async (_e, id) => { drafted.push(id); throw Error("composition crashed"); } }));
      expect(failing.voice.status).toBe("no-key");
      expect(failing.failed).toEqual([expect.objectContaining({ id: "c1-s1", error: "composition crashed", sourceSha256: expect.any(String) })]);
      expect(drafted).toEqual(["c1-s1"]);
      const again = await runWithChannel(CH, () => prepareAllScenes(EP, { voiceClient: null,
        previousFailures: failing.failed, render: async (_e, id) => { drafted.push(id); } }));
      // 12 Nov (QA balislam 9): every undrafted scene with its real reason — the two waiting for their voice too.
      expect(again.skipped).toMatchObject([{ id: "c1-s2", reason: "voice" }, { id: "c1-s3", reason: "voice" },
        { id: "c1-s1", reason: "failed-before", error: "composition crashed" }]);
      expect(drafted).toEqual(["c1-s1"]); // nothing rendered
      // …but a network/browser failure is retried on the next press (rendering stub: nothing recorded).
      const offline = [{ ...failing.failed[0]!, error: "تعذّر تجهيز متصفح الرندر لأن الجهاز غير متصل بالإنترنت" }];
      const retry = await runWithChannel(CH, () => prepareAllScenes(EP, { voiceClient: null,
        previousFailures: offline, render: async (_e, id) => { drafted.push(id); throw Error("still failing"); } }));
      expect((retry.skipped ?? []).filter((x) => x.reason === "failed-before")).toEqual([]);
      expect(drafted).toEqual(["c1-s1", "c1-s1"]);
    }

    // ── No voice key: said plainly, nothing crashes, voiced scenes are still prepared ───────────
    const noKeyRead = await call("GET", `episodes/${EP}/scene-prepare`);
    expect(noKeyRead.body).toMatchObject({ job: null, voiceKey: false, needVoice: 2,
      voicePlan: { sentences: 2, scenes: ["c1-s2", "c1-s3"], excluded: [] } });
    expect(noKeyRead.body.voicePlan.chars).toBeGreaterThan(0);
    // A plain start (owner decision 15–16 Nov) is free: drafts of the scenes whose voice exists, no voice step.
    const noKey = await prepareAll();
    expect(noKey.body.job, JSON.stringify(noKey.body)).toMatchObject({ status: "done", voice: { status: "none", needed: 0 }, rendered: ["c1-s1"], failed: [] });
    // «ولّد الصوت الآن» confirmed without a key: said plainly, nothing crashes, nothing is called.
    const noKeyVoice = await prepareAll({ voice: { confirm: true, fingerprint: noKeyRead.body.voicePlan.fingerprint } });
    expect(noKeyVoice.body.job, JSON.stringify(noKeyVoice.body)).toMatchObject({ status: "done", voice: { status: "no-key", needed: 2 }, rendered: [], failed: [] });
    expect(elevenCalls).toEqual([]);
    s = await state();
    expect(s.prepared).toEqual({ ready: 1, total: 3 });

    // ── With a (stubbed) voice key: voices for the two scenes, then their drafts, in order ──────
    process.env.ELEVENLABS_API_KEY = "stub-key-not-real";
    process.env.ELEVENLABS_VOICE_ID = "stub-voice";
    // D145 «أنتج كل المشاهد الجاهزة»: free renders only — even with a key, no voice is generated (nothing paid).
    const free = await prepareAll({ renderOnly: true });
    expect(free.body.job, JSON.stringify(free.body)).toMatchObject({ status: "done", voice: { status: "none", needed: 0 }, rendered: [], failed: [] });
    expect(free.body.job.skipped).toMatchObject([{ id: "c1-s2", reason: "voice" }, { id: "c1-s3", reason: "voice" }]);
    expect(elevenCalls).toEqual([]);
    // «استأنف إنتاج المسودات» (a plain start) is free too, with a key: nothing paid without the owner's confirmed press.
    expect((await prepareAll()).body.job).toMatchObject({ status: "done", voice: { status: "none", needed: 0 }, rendered: [] });
    // «ولّد الصوت الآن» needs its confirmation, from the Studio page, of the plan the owner read.
    const plan = (await call("GET", `episodes/${EP}/scene-prepare`)).body.voicePlan;
    expect((await call("POST", `episodes/${EP}/scene-prepare`, { voice: {} })).status).toBe(400);
    expect((await call("POST", `episodes/${EP}/scene-prepare`, { voice: { confirm: true } })).status).toBe(400);
    expect((await call("POST", `episodes/${EP}/scene-prepare`, { voice: { confirm: true, fingerprint: plan.fingerprint } }, CROSS)).status).toBe(403);
    const stale = await call("POST", `episodes/${EP}/scene-prepare`, { voice: { confirm: true, fingerprint: "0".repeat(16) } });
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({ code: "VOICE_PLAN_CHANGED", voicePlan: { fingerprint: plan.fingerprint } });
    expect(elevenCalls).toEqual([]);
    const run = await prepareAll({ voice: { confirm: true, fingerprint: plan.fingerprint } });
    expect(run.body.job, JSON.stringify(run.body)).toMatchObject({ status: "done", voice: { status: "done", needed: 2, generated: 2 }, rendered: ["c1-s2", "c1-s3"], failed: [] });
    expect(elevenCalls.filter((c) => c.includes("with-timestamps"))).toHaveLength(2);
    expect(stubbedRenders).toEqual(["c1-s1", "c1-s2", "c1-s3"]);
    s = await state();
    expect(s.prepared).toEqual({ ready: 3, total: 3 });
    expect(s.scenes.map((x: any) => [x.id, open(x.status), x.draft, x.approved])).toEqual([
      ["c1-s1", "open", "ready", false], ["c1-s2", "open", "ready", false], ["c1-s3", "open", "ready", false]]);
    // Drafts are not decisions: the decision history holds only the script and storyboard.
    expect((await ledger()).history.map((h: any) => h.action)).toEqual(["approve-script", "approve-storyboard"]);
    expect(s.progress).toMatchObject({ currentScene: "c1-s1", approvedScenes: 0 });
    // A second run with nothing to do renders nothing (no duplicate work).
    expect((await prepareAll()).body.job.rendered).toEqual([]);
    expect(stubbedRenders).toHaveLength(3);

    // ── Approvals in ANY order (D145), each on the exact draft bytes ───────────────────────────
    expect((await decide({ action: "approve-scene", sceneId: "c1-s2", expectedSha256: s.candidates.scenes["c1-s2"], confirmedWatched: true })).status).toBe(409); // not submitted
    const approveDraft = async (id: string) => {
      const cur = await state();
      const sc = cur.scenes.find((x: any) => x.id === id);
      expect(sc.draft).toBe("ready");
      const bytes = cur.candidates.scenes[id];
      expect((await decide({ action: "approve-scene", sceneId: id, expectedSha256: bytes, confirmedWatched: true })).status).toBe(409); // not submitted
      const sub = await decide({ action: "submit-scene", sceneId: id, expectedSha256: sc.sourceSha256 });
      expect(sub.status, JSON.stringify(sub.body)).toBe(200);
      expect(sub.body.scenes.find((x: any) => x.id === id).previewSha256).toBe(bytes);
      expect((await decide({ action: "approve-scene", sceneId: id, expectedSha256: bytes })).status).toBe(409); // must be watched
      const ok = await decide({ action: "approve-scene", sceneId: id, expectedSha256: bytes, confirmedWatched: true });
      expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    };
    // The last scene first, then the first; scene 2 stays open.
    await approveDraft("c1-s3");
    expect((await state()).progress).toMatchObject({ currentScene: "c1-s1", unapprovedScenes: ["c1-s1", "c1-s2"], canAssemble: false });
    await approveDraft("c1-s1");
    // The approved scenes are never re-rendered by another prepare run.
    expect((await prepareAll()).body.job.rendered).toEqual([]);

    // ── Editing scene 2 discards only its draft and re-opens only it ────────────────────────────
    const before = await state();
    expect((await call("PUT", `episodes/${EP}/plan`, { plan: planOf("الشكر قيد النعم"), expectedRevision: await browserPlanRevision((await call("GET", `episodes/${EP}`)).body.plan) })).status).toBe(200);
    const after = await state();
    expect(after.scenes.map((x: any) => [x.id, x.status, x.draft])).toEqual([
      ["c1-s1", "approved", "none"], ["c1-s2", "queued", "stale"], ["c1-s3", "approved", "none"]]);
    expect(after.scenes[0].sourceSha256).toBe(before.scenes[0].sourceSha256);
    expect(after.scenes[2].sourceSha256).toBe(before.scenes[2].sourceSha256);
    expect(Object.keys((await ledger()).previewInputs).sort()).toEqual(["c1-s1", "c1-s3"]);
    expect(after.prepared).toEqual({ ready: 2, total: 3 });
    // The stale file can never be submitted.
    expect((await decide({ action: "submit-scene", sceneId: "c1-s2", expectedSha256: after.scenes[1].sourceSha256 })).status).toBe(409);
    // 11 Nov: the changed board was recorded by the ledger itself (no second approval of the preparation).
    expect(after.storyboard.approved && after.boards.current).toBe(true);
    expect(after.scenes[1].afterPreparation.what).toContain("board");
    // Re-queue: only the edited scene is rendered again.
    const again = await prepareAll();
    expect(again.body.job).toMatchObject({ status: "done", rendered: ["c1-s2"], failed: [] });
    expect(stubbedRenders).toEqual(["c1-s1", "c1-s2", "c1-s3", "c1-s2"]);
    await approveDraft("c1-s2");
    const done = await state();
    expect(done.progress).toMatchObject({ approvedScenes: 3, canAssemble: true, assemblyApproved: false, publishAllowed: false });
    expect((await ledger()).history.map((h: any) => h.action)).toEqual(["approve-script", "approve-storyboard",
      "submit-scene", "approve-scene", "submit-scene", "approve-scene", "update-after-preparation", "submit-scene", "approve-scene"]);
  }, 300_000);
});
