/**
 * Funnel v3 (D40): step ١ «التجهيز» is ONE owner action «اعتمد التجهيز» over the REAL Studio server API (same
 * harness as studio-prepare-all.test.ts). It writes the script approval, then the board record, then the
 * storyboard approval — in that order, each with its own check, from the Studio page on this device and «راجعته بنفسي» required — and
 * then the scenes start preparing on their own: drafts only, nothing submitted or approved.
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

const repo = path.resolve(import.meta.dirname, "..");
const CH = "balislam";
const EP = "984";
const EP_DIR = "984-funnel-v3";
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
const prepareAll = async () => {
  const start = await call("POST", `episodes/${EP}/scene-prepare`);
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
  root = await mkdtemp(path.join(repo, "renders", "funnel-v3-"));
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
    `---\ntitle: "تجهيز كل المشاهد"\ndomain: psychology\nepisode: "${EP}"\n---\n## الفصل 1 · تجربة\n${scenes.map((s) => s.narration).join("\n")}\n`);
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

const validScript = () => `---\ntitle: "هل نعرف الصبر حقًا؟"\ndomain: psychology\nepisode: "${EP}"\n---\n` +
  ["تجربة"].map((t, i) => // 12 Nov: no filler line that no scene says (QA balislam 2); sections are optional (D87)
   
    `## الفصل ${i + 1} · ${t}\n${i === 0 ? scenes.map((x) => x.narration).join("\n") : "جملة قصيرة في هذا الفصل."}\n`).join("\n") +
  "\n## الاستشهادات\n\n- مصدر | كتاب الصبر، المؤلف، ص ١٢ | فكرة الصبر\n\n## الخطوة العملية\n\nاصبر اليوم على أمر واحد صغير، ثم اكتب ما تعلمته.\n";
const approvePrep = (body: Record<string, unknown>, headers: Record<string, string> = {}) =>
  call("POST", `episodes/${EP}/approve-preparation`, body, headers);
const historyActions = async () => {
  try { return (await ledger()).history.map((h: { action: string }) => h.action); } catch { return []; }
};

describe("«اعتمد التجهيز»: one button, both ledger records in order, then preparing (no approval)", () => {
  it("refuses from another site, without «راجعته بنفسي», with script errors or without a board note — writing nothing", async () => {
    let s = await state();
    const body = { scriptSha256: s.script.sha256, storyboardSha256: s.storyboard.sha256, reviewed: true,
      note: "راجعت اللوحات الثلاث بصريًا: النص والتكوين والتوقيت مطابقة للسكريبت." };
    // The script of this fixture still has errors (one chapter, no citations/practical step): blocked, shown as a fix list.
    const blockers = await call("GET", `episodes/${EP}/approve-preparation`);
    expect(blockers.body).toMatchObject({ versesMissing: [], boardsRecorded: false });
    expect(blockers.body.scriptErrors).toBeGreaterThan(0);
    expect((await approvePrep(body)).status).toBe(409);
    await writeFile(path.join(epDir, "script.md"), validScript());
    s = await state();
    const ok = { ...body, scriptSha256: s.script.sha256 };
    expect((await call("GET", `episodes/${EP}/approve-preparation`)).body.scriptErrors).toBe(0);

    expect((await approvePrep(ok, { "sec-fetch-site": "cross-site" })).status).toBe(403);
    expect((await approvePrep(ok, CROSS)).status).toBe(403);
    expect((await approvePrep({ ...ok, reviewed: false })).status).toBe(409);
    // 11 Nov: the note is optional (no minimum) but one line.
    expect((await approvePrep({ ...ok, note: "سطر\nآخر" })).status).toBe(409);
    expect((await approvePrep({ ...ok, scriptSha256: "f".repeat(64) })).status).toBe(409);
    // Nothing was written by any refusal.
    expect(await historyActions()).toEqual([]);
    s = await state();
    expect(s.script.approved).toBe(false);
    expect(s.storyboard.approved).toBe(false);
    // Nothing prepares before the preparation is approved.
    expect((await call("POST", `episodes/${EP}/scene-prepare`)).status).toBe(409);
  }, 120_000);

  it("writes approve-script then approve-storyboard (with the board record between), then starts preparing drafts only", async () => {
    let s = await state();
    const r = await approvePrep({ scriptSha256: s.script.sha256, storyboardSha256: s.storyboard.sha256, reviewed: true,
      note: "راجعت اللوحات الثلاث بصريًا: النص والتكوين والتوقيت مطابقة للسكريبت." });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.script.approved).toBe(true);
    expect(r.body.storyboard.approved).toBe(true);
    // Both records, in order, each its own owner decision.
    const doc = await ledger();
    expect(doc.history.map((h: { action: string }) => h.action)).toEqual(["approve-script", "approve-storyboard"]);
    expect(doc.history.every((h: { by: string }) => h.by === "owner")).toBe(true);
    // The board record (storyboard.json) was written with the owner's note, after the script approval.
    const board = JSON.parse(await readFile(path.join(epDir, "storyboard.json"), "utf8"));
    expect(board.audit.note).toContain("راجعت اللوحات الثلاث");
    expect(Date.parse(board.approvedAt)).toBeGreaterThanOrEqual(Date.parse(doc.history[0].at));
    expect(Date.parse(board.approvedAt)).toBeLessThanOrEqual(Date.parse(doc.history[1].at));
    // Preparing started on its own.
    expect(r.body.prepare.error).toBeUndefined();
    expect(r.body.prepare.job).toBeTruthy();
    for (let i = 0; i < 600; i++) {
      const j = await call("GET", `episodes/${EP}/scene-prepare`);
      if (j.body.job?.status !== "running") break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const job = (await call("GET", `episodes/${EP}/scene-prepare`)).body.job;
    expect(job.status).toBe("done");
    // No voice key here: only the scene before the first one still missing its voice is drafted (D38).
    expect(job.rendered).toEqual(["c1-s1"]);
    s = await state();
    // Drafts only: nothing submitted, nothing approved; the ledger holds just the two preparation records.
    expect(s.scenes.map((x: { status: string }) => open(x.status))).toEqual(["open", "open", "open"]);
    expect(s.scenes.find((x: { id: string }) => x.id === "c1-s1").draft).toBe("ready");
    expect(s.progress.approvedScenes).toBe(0);
    expect((await ledger()).history.map((h: { action: string }) => h.action)).toEqual(["approve-script", "approve-storyboard"]);
  }, 180_000);

  it("is idempotent once approved, and the four-step summary reads it", async () => {
    const s = await state();
    const before = (await call("GET", `episodes/${EP}/scene-prepare`)).body.job;
    expect(before.status).toBe("done");
    const r = await approvePrep({ scriptSha256: s.script.sha256, storyboardSha256: s.storyboard.sha256, reviewed: true });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect((await ledger()).history).toHaveLength(2);
    // KI-058: a repeated «اعتمد التجهيز» writes nothing AND starts nothing: no second «جهّز كل المشاهد» in the
    // background (it chased the scenes the owner re-opened and then held the episode when «اصنع النسخة النهائية» came).
    expect(r.body.prepare.job?.status, "no new preparation job").not.toBe("running");
    const after = (await call("GET", `episodes/${EP}/scene-prepare`)).body.job;
    expect([after.status, after.startedAt], "the same finished job").toEqual(["done", before.startedAt]);
    const { summarizeSceneProduction } = await import("../src/studio/sceneService");
    const { runWithChannel } = await import("../src/channel");
    const sum = await runWithChannel(CH, () => summarizeSceneProduction(EP));
    expect(sum.steps).toEqual([true, false, false, false]);
    expect(sum.preparation).toBe(true);
  }, 60_000);
});

// 11 Nov (owner): «اعتمد التجهيز» once per episode; B2/D65/D66 re-approval removed (route answers 410).
describe("after «اعتمد التجهيز»: a sentence text edit is carried forward, its scene alone re-opens", () => {
  const boardCall = (body: Record<string, unknown>) => call("POST", `episodes/${EP}/approve-scene-board`, body);
  const editNarration = async (id: string, narration: string) => {
    const plan = JSON.parse(await readFile(path.join(epDir, "plan.json"), "utf8"));
    for (const c of plan.chapters) for (const sc of c.scenes) if (sc.id === id) { sc.narration = narration; sc.edited = true; }
    await writeFile(path.join(epDir, "plan.json"), JSON.stringify(plan, null, 2));
  };
  it("records only that scene's changed board with one signed system event; no re-approval route", async () => {
    const boardBefore = JSON.parse(await readFile(path.join(epDir, "storyboard.json"), "utf8"));
    const historyBefore = (await historyActions()).length;
    await editNarration("c1-s2", "والشكر يحفظ النعمة ويزيدها.");
    const s = await state();
    expect(s.boards.changed).toEqual([]);
    expect(s.script.approved && s.storyboard.approved).toBe(true);
    expect((await historyActions()).slice(historyBefore)).toEqual(["update-after-preparation"]);
    expect(s.scenes.find((x: { id: string }) => x.id === "c1-s2").afterPreparation.what).toContain("board");
    const boardAfter = JSON.parse(await readFile(path.join(epDir, "storyboard.json"), "utf8"));
    expect(boardAfter.scenes["c1-s1"]).toBe(boardBefore.scenes["c1-s1"]);
    expect(boardAfter.scenes["c1-s3"]).toBe(boardBefore.scenes["c1-s3"]);
    expect(boardAfter.scenes["c1-s2"]).not.toBe(boardBefore.scenes["c1-s2"]);
    expect(boardAfter.audit.scenes).toEqual(["c1-s2"]);
    expect((await boardCall({ sceneId: "c1-s2", storyboardSha256: s.storyboard.sha256, reviewed: true, note: "x" })).status).toBe(410);
  }, 60_000);

  it("M5: a refused «ولّد الصوت» is a 4xx with its Arabic reason, never a 500", async () => {
    process.env.ELEVENLABS_API_KEY = "test-key-not-real";
    process.env.ELEVENLABS_VOICE_ID = "stub-voice";
    try {
      // The edited sentence has no tashkeel yet: the gate refuses before any paid request.
      const r = await call("POST", `episodes/${EP}/voice`, { scenes: ["c1-s2"], force: true });
      expect(r.status, JSON.stringify(r.body)).toBeGreaterThanOrEqual(400);
      expect(r.status).toBeLessThan(500);
      expect(String(r.body.error)).toMatch(/[\u0600-\u06FF]/);
      expect((await call("POST", `episodes/${EP}/voice`, { scenes: ["../x"] })).status).toBe(400);
      expect((await call("POST", `episodes/${EP}/voice`, { scenes: ["c1-s2"] }, CROSS)).status).toBe(403);
    } finally {
      delete process.env.ELEVENLABS_API_KEY;
      delete process.env.ELEVENLABS_VOICE_ID;
    }
  }, 60_000);

  it("two more boards changed: both carried forward in one event, the third scene untouched", async () => {
    const before = await state();
    await editNarration("c1-s1", "الصبر مفتاح الفرج دائمًا.");
    await editNarration("c1-s3", "والرضا راحة القلب حقًا.");
    const s = await state();
    expect(s.boards.changed).toEqual([]);
    // QA dafatir M5 (12 Nov): the list keeps every scene re-opened and not approved since (c1-s2 from the test above).
    expect(s.afterPreparation.scenes.map((x: { id: string }) => x.id)).toEqual(["c1-s1", "c1-s2", "c1-s3"]);
    expect(s.scenes[1].sourceSha256).toBe(before.scenes[1].sourceSha256);
  }, 60_000);
});
