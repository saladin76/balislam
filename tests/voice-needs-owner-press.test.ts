/**
 * Owner decision (15–16 Nov, «نعم»): after «اعتمد التجهيز» nothing paid starts on its own. The Studio shows
 * «جاهز لتوليد صوت N جملة في M مشهد — نحو X حرف من الرصيد» (verse/basmala scenes listed as never voiced) and waits
 * for «ولّد الصوت الآن» + its confirmation; only that press starts paid generation.
 *
 * Over the REAL Studio server API (same harness as studio-funnel-v3.test.ts), with a voice key configured from the
 * start (the case that used to pay on its own). Stubs: the Remotion render behind shotsPreview (an ffmpeg clip) and
 * the ElevenLabs HTTP API (intercepted in globalThis.fetch, a real MP3; no network, no real service).
 * Audited paths, each proven to send zero voice requests without the press: the approval itself, a repeated
 * approval, «استأنف التجهيز» / «أنتج كل المشاهد الجاهزة», the episode tone, the pronunciation dictionary, the pace,
 * «اصنع النسخة النهائية» (`bal make`), a stale or unconfirmed request, a Studio restart (prepare queue in memory;
 * paid jobs in the render-queue ledger are not resumed).
 */
import { execFileSync } from "node:child_process";
import { copyFile, mkdtemp, mkdir, readFile, rm, rmdir, writeFile } from "node:fs/promises";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer, type Plugin, type ViteDevServer } from "vite";
import { balApi } from "../app/server/api";
import { RenderPool, type TaskDef } from "../src/render/pool";

const repo = path.resolve(import.meta.dirname, "..");
const CH = "balislam";
const EP = "973";
const EP_DIR = "973-voice-needs-press";
const CROSS = { origin: "https://evil.example" };
const ffmpeg = (args: string[]) => execFileSync("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", ...args]);

const renderStub = (): Plugin => ({
  name: "voice-press-stub-remotion-render",
  enforce: "pre",
  resolveId(source, importer) {
    if (source === "./episode" && importer?.replace(/\\/g, "/").includes("/src/render/shotsPreview.ts")) return "\0voice-press-render-stub";
    return null;
  },
  load(id) {
    if (id !== "\0voice-press-render-stub") return null;
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
/** Every request that reached the (stubbed) voice service. */
const elevenCalls: string[] = [];
const tts = () => elevenCalls.filter((c) => c.includes("with-timestamps"));
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
const state = async () => (await call("GET", `episodes/${EP}/scene-production`)).body;
const settle = async () => {
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
// `designed`: `bal make` uses the plan as it is (never rewritten from the script in this test).
const planOf = () => ({
  channel: CH, episode: EP, title: "الصوت بضغطة المالك", designed: true, tone: "calm",
  chapters: [{ number: 1, title: "تجربة", scenes: scenes.map((s, i) => ({
    id: s.id, template: "alley-tale", line: 7 + i, narration: s.narration, sfx: [], tone: "calm",
    props: { text: s.narration.split(" ")[0] },
  })) }],
});
const validScript = () => `---\ntitle: "هل نعرف الصبر حقًا؟"\ndomain: psychology\nepisode: "${EP}"\n---\n` +
  `## الفصل 1 · تجربة\n${scenes.map((x) => x.narration).join("\n")}\n` +
  "\n## الاستشهادات\n\n- مصدر | كتاب الصبر، المؤلف، ص ١٢ | فكرة الصبر\n\n## الخطوة العملية\n\nاصبر اليوم على أمر واحد صغير، ثم اكتب ما تعلمته.\n";

beforeAll(async () => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  await mkdir(path.join(repo, "renders"), { recursive: true });
  root = await mkdtemp(path.join(repo, "renders", "voice-press-"));
  const chDir = path.join(root, CH);
  epDir = path.join(chDir, "episodes", EP_DIR);
  await mkdir(epDir, { recursive: true });
  for (const f of ["channel.json", "identity.json", "identity.default.json", "pronunciation.json"])
    await copyFile(path.join(repo, "channels", CH, f), path.join(chDir, f));
  process.env.BAL_CHANNELS_DIR = root;
  process.env.BAL_ENV_FILE = path.join(root, ".env");
  for (const k of ["BAL_WORKFLOW_HMAC_KEY", "BAL_DRIVE_PREVIEWS_DIR"]) delete process.env[k];
  // A voice key from the start: the case that used to generate on its own right after «اعتمد التجهيز».
  process.env.ELEVENLABS_API_KEY = "stub-key-not-real";
  process.env.ELEVENLABS_VOICE_ID = "stub-voice";
  process.env.ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";

  await writeFile(path.join(epDir, "script.md"), validScript());
  await writeFile(path.join(epDir, "tashkeel.md"), "الصَّبْرُ مِفْتَاحُ الفَرَجِ. وَالشُّكْرُ يَحْفَظُ النِّعْمَةَ. وَالرِّضَا رَاحَةُ القَلْبِ.\n");
  await writeFile(path.join(epDir, "plan.json"), JSON.stringify(planOf(), null, 2));
  const voice = path.join(epDir, "voice");
  await mkdir(voice);
  ffmpeg(["-f", "lavfi", "-i", "sine=frequency=300:duration=1.5", "-c:a", "libmp3lame", "-b:a", "64k", path.join(voice, "c1-s1.mp3")]);
  await writeFile(path.join(voice, "index.json"), JSON.stringify({
    "c1-s1": { file: "c1-s1.mp3", hash: "pre-existing01", text: scenes[0]!.narration, duration: 1.5, words: [] },
  }, null, 2));
  mp3 = await readFile(path.join(voice, "c1-s1.mp3"));

  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(typeof input === "string" ? input : input.url);
    if (!url.startsWith("https://api.elevenlabs.io")) return realFetch(input, init);
    elevenCalls.push(`${init?.method ?? "GET"} ${new URL(url).pathname}`);
    if (url.includes("/with-timestamps")) return new Response(JSON.stringify({ audio_base64: mp3.toString("base64"), alignment: null }), { status: 200 });
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
  if (root) await rm(root, { recursive: true, force: true });
  await rm(path.join(repo, "renders", ".private-media", "_render", CH, EP_DIR), { recursive: true, force: true });
  for (const dir of [path.join(repo, "renders", ".private-media", "_render", CH), path.join(repo, "renders", ".private-media", "_render"), path.join(repo, "renders", ".private-media")])
    await rmdir(dir).catch(() => undefined);
});

describe("«اعتمد التجهيز» → no voice request until «ولّد الصوت الآن» is confirmed", () => {
  let shown: any;

  it("the approval starts only free drafts and answers the count and cost (key configured, zero requests)", async () => {
    const s = await state();
    const r = await call("POST", `episodes/${EP}/approve-preparation`, { scriptSha256: s.script.sha256, storyboardSha256: s.storyboard.sha256, reviewed: true, note: "راجعته بنفسي" });
    expect(r.status, JSON.stringify(r.body).slice(0, 800)).toBe(200);
    expect(r.body.prepare.error).toBeUndefined();
    shown = r.body.prepare.voicePlan;
    expect(shown).toMatchObject({ sentences: 2, scenes: ["c1-s2", "c1-s3"], excluded: [] });
    expect(shown.chars).toBeGreaterThan(20);
    expect(shown.credits).toBe(shown.chars);
    const job = (await settle()).body.job;
    expect(job).toMatchObject({ status: "done", voice: { status: "none", needed: 0 }, rendered: ["c1-s1"], failed: [] });
    expect(job.skipped).toMatchObject([{ id: "c1-s2", reason: "voice" }, { id: "c1-s3", reason: "voice" }]);
    expect(elevenCalls, "no request at all after the approval").toEqual([]);
    // A repeated approval (stale page, second tab) starts nothing and reads the same plan.
    const again = await call("POST", `episodes/${EP}/approve-preparation`, { scriptSha256: s.script.sha256, storyboardSha256: s.storyboard.sha256, reviewed: true });
    expect(again.status).toBe(200);
    expect(again.body.prepare.voicePlan.fingerprint).toBe(shown.fingerprint);
    expect(elevenCalls).toEqual([]);
  }, 180_000);

  it("«استأنف التجهيز», «أنتج كل المشاهد الجاهزة», the episode tone, the pronunciation dictionary and the pace pay nothing", async () => {
    for (const body of [undefined, { renderOnly: true }]) {
      expect((await call("POST", `episodes/${EP}/scene-prepare`, body)).status).toBe(200);
      expect((await settle()).body.job.voice).toMatchObject({ status: "none", needed: 0 });
    }
    const tone = await call("POST", `episodes/${EP}/sentences/tone-scope`, { sceneId: null, tone: "warm" });
    expect(tone.status, JSON.stringify(tone.body).slice(0, 400)).toBe(200);
    const back = await call("POST", `episodes/${EP}/sentences/tone-scope`, { sceneId: null, tone: "calm" });
    expect(back.status).toBe(200);
    const lex = await call("POST", `episodes/${EP}/pronunciations`, { op: "set", word: "الرضا", say: "الرِّضا" });
    expect(lex.status, JSON.stringify(lex.body).slice(0, 400)).toBe(200);
    expect((await call("POST", `episodes/${EP}/pronunciations`, { op: "remove", word: "الرضا" })).status).toBe(200);
    const pace = await call("POST", `episodes/${EP}/scene-prepare`, { pace: "apply" });
    expect(pace.status, JSON.stringify(pace.body).slice(0, 400)).toBeLessThan(500);
    await settle();
    expect(elevenCalls).toEqual([]);
  }, 180_000);

  it("«اصنع النسخة النهائية» never generates the missing voice; it refuses before anything is paid", async () => {
    const { makeEpisode, missingVoiceMessage } = await import("../src/package/make");
    const { runWithChannel } = await import("../src/channel");
    const err = await runWithChannel(CH, () => makeEpisode({ episode: EP, skipVideo: true })).then(() => null, (e: Error) => e.message);
    expect(err).toMatch(/النسخة النهائية لا تولّد صوتًا وحدها/);
    expect(missingVoiceMessage(2, 40)).toContain("لم يُصرف شيء");
    expect(elevenCalls).toEqual([]);
  }, 120_000);

  it("refuses a request without the confirmation, from another site, or for a plan the owner did not read", async () => {
    const plan = (await call("GET", `episodes/${EP}/scene-prepare`)).body.voicePlan;
    expect((await call("POST", `episodes/${EP}/scene-prepare`, { voice: true })).status).toBe(400);
    expect((await call("POST", `episodes/${EP}/scene-prepare`, { voice: { fingerprint: plan.fingerprint } })).status).toBe(400);
    expect((await call("POST", `episodes/${EP}/scene-prepare`, { voice: { confirm: true, fingerprint: plan.fingerprint } }, CROSS)).status).toBe(403);
    const stale = await call("POST", `episodes/${EP}/scene-prepare`, { voice: { confirm: true, fingerprint: "f".repeat(16) } });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe("VOICE_PLAN_CHANGED");
    expect(stale.body.voicePlan.fingerprint).toBe(plan.fingerprint);
    expect(elevenCalls).toEqual([]);
  }, 60_000);

  it("only the confirmed press voices exactly the scenes shown, then drafts them", async () => {
    const plan = (await call("GET", `episodes/${EP}/scene-prepare`)).body.voicePlan;
    const r = await call("POST", `episodes/${EP}/scene-prepare`, { voice: { confirm: true, fingerprint: plan.fingerprint } });
    expect(r.status, JSON.stringify(r.body).slice(0, 600)).toBe(200);
    const job = (await settle()).body.job;
    expect(job, JSON.stringify(job).slice(0, 900)).toMatchObject({ status: "done", voice: { status: "done", needed: 2, generated: 2 }, rendered: ["c1-s2", "c1-s3"], failed: [] });
    expect(tts()).toHaveLength(2);
    // Nothing left to pay for: the panel disappears (no scenes), and a new plain start pays nothing.
    expect((await call("GET", `episodes/${EP}/scene-prepare`)).body.voicePlan).toMatchObject({ scenes: [], sentences: 0, chars: 0 });
    expect((await call("POST", `episodes/${EP}/scene-prepare`)).status).toBe(200);
    await settle();
    expect(tts()).toHaveLength(2);
    // Drafts only: nothing approved on the owner's behalf.
    expect((await state()).progress.approvedScenes).toBe(0);
  }, 180_000);

  it("lists verse and basmala scenes as never voiced; the basmala scene's narration sentences are counted", async () => {
    const plan = JSON.parse(await readFile(path.join(epDir, "plan.json"), "utf8"));
    plan.chapters[0].scenes.push(
      { id: "c1-s4", template: "verse-card", line: 10, narration: "", sfx: [], ayahKey: "2:153", props: { reference: "البقرة ١٥٣" } },
      { id: "c1-s5", template: "alley-tale", line: 11, narration: "بسم الله الرحمن الرحيم. نبدأ بالصبر.", sfx: [], tone: "calm", props: { text: "نبدأ" } },
    );
    await writeFile(path.join(epDir, "plan.json"), JSON.stringify(plan, null, 2));
    const before = elevenCalls.length;
    const read = (await call("GET", `episodes/${EP}/scene-prepare`)).body.voicePlan;
    expect(read.excluded).toEqual([{ id: "c1-s4", reason: "verse" }, { id: "c1-s5", reason: "basmala" }]);
    // Neither is ever in what would be paid for (the basmala scene's own narration waits for its fix: text ≠ script).
    expect(read.scenes).not.toContain("c1-s4");
    const { voicePlanLine, voicePlanExcluded } = await import("../app/src/workspace/PrepareAll");
    expect(voicePlanLine({ sentences: 1, scenes: ["c1-s5"], chars: 12 })).toBe("جاهز لتوليد صوت جملة واحدة في مشهد واحد — نحو ١٢ حرفًا من الرصيد");
    expect(voicePlanLine({ sentences: 14, scenes: ["a", "b", "c"], chars: 640 })).toBe("جاهز لتوليد صوت ١٤ جملة في ٣ مشاهد — نحو ٦٤٠ حرفًا من الرصيد");
    expect(voicePlanExcluded(read, plan.chapters[0].scenes.map((x: { id: string }) => x.id))).toBe("المشهد ٤ (آية: تلاوتك)، المشهد ٥ (البسملة: تسجيلك، وجمل الراوي فيه تُحسب)");
    expect(elevenCalls.length, "reading the plan is free").toBe(before);
  }, 60_000);
});

describe("a Studio restart resumes nothing paid", () => {
  it("the prepare queue lives in memory: a restarted server has no job and a read starts none", async () => {
    vi.resetModules();
    const fresh = await import("../app/server/prepare");
    expect(fresh.prepareJob(`${CH}/${EP}`)).toBeNull();
    // Only these owner POSTs start it; no read, no startup hook, no timer (source of the one server file).
    const api = readFileSync(path.join(repo, "app/server/api.ts"), "utf8");
    expect(api.match(/startPrepare\(/g)).toHaveLength(4); // approval (free), pace (free), voice (confirmed), plain (free)
    expect(api).not.toMatch(/recoverStudioQueue[\s\S]{0,200}startPrepare/);
  });

  it("queued paid jobs in the render-queue ledger stay stopped with a card; free ones resume", async () => {
    const { attachRecovered, longJobs, busy, PAID_JOB_NOT_RESUMED, paidJobDef } = await import("../app/server/jobQueue");
    const d = mkdtempSync(path.join(os.tmpdir(), "voice-press-pool-"));
    try {
      const ledger = path.join(d, "studio-queue.json");
      const noop = (id: string, kind: string, args: string[] = []): TaskDef => ({ id, cmd: process.execPath, args: ["-e", "", ...args], cwd: d,
        costKey: `long:${kind}`, meta: { type: "long", job: { kind, channel: "zz-test", episode: kind === "sfx" ? undefined : "999", title: kind } } });
      const blocker: TaskDef = { id: "blocker", cmd: process.execPath, args: ["-e", "setTimeout(()=>{},60000)"], cwd: d };
      const p1 = new RenderPool({ ledger, cpus: 1, maxParallel: 1, pollMs: 20, foreign: () => [], oomCount: () => null, oomVictims: () => new Set<number>() });
      p1.add(blocker);
      p1.add(noop("sfx-job", "sfx"));
      p1.add(noop("voice-cli", "package", ["--generate-voice"]));
      p1.add(noop("make-job", "make"));
      await new Promise((r) => setTimeout(r, 300));
      expect(p1.tasks.get("sfx-job")!.status).toBe("queued");
      await p1.save();
      const p2 = new RenderPool({ ledger, cpus: 1, maxParallel: 1, pollMs: 20, foreign: () => [], oomCount: () => null, oomVictims: () => new Set<number>() });
      const r = await p2.recover(attachRecovered);
      // The Master from existing voice is free (it refuses missing voice): it resumes. Paid work does not.
      expect(r.requeued).toEqual(["make-job"]);
      expect(p2.tasks.has("sfx-job")).toBe(false);
      expect(p2.tasks.has("voice-cli")).toBe(false);
      for (const id of ["sfx-job", "voice-cli"]) expect(longJobs.get(id)).toMatchObject({ status: "error", error: PAID_JOB_NOT_RESUMED, recovered: true });
      await p2.idle();
      expect(longJobs.get("make-job")?.status).toBe("done");
      expect(busy.has("zz-test/999")).toBe(false);
      expect(paidJobDef({ args: ["bin/bal.mjs", "--channel", "x", "make", "1"], meta: { type: "long", job: { kind: "make" } } })).toBe(false);
      for (const id of ["sfx-job", "voice-cli", "make-job"]) longJobs.delete(id);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  }, 30_000);
});

describe("the panel the owner sees (step ٢ header and the spine)", () => {
  const plan = { sentences: 14, scenes: ["c1-s2", "c1-s3", "c1-s5"], chars: 640, credits: 640,
    excluded: [{ id: "c1-s4", reason: "verse" as const }], fingerprint: "abc" };
  const order = ["c1-s1", "c1-s2", "c1-s3", "c1-s4", "c1-s5"];
  it("shows the count, the cost and the never-voiced scenes, and a press that only asks for confirmation", async () => {
    const React = (await import("react")).default;
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { VoicePlanPanel } = await import("../app/src/workspace/PrepareAll");
    let generated = 0;
    const html = renderToStaticMarkup(React.createElement(VoicePlanPanel, { plan, order, voiceKey: true, busy: false, onGenerate: () => { generated++; } }));
    expect(html).toContain("جاهز لتوليد صوت ١٤ جملة في ٣ مشاهد — نحو ٦٤٠ حرفًا من الرصيد");
    expect(html).toContain("لا يُرسل إلى الصوت المستنسخ أبدًا: المشهد ٤ (آية: تلاوتك)");
    expect(html).toContain("ولّد الصوت الآن");
    expect(html).not.toContain("نعم، ولّد الصوت"); // the confirmation comes only after the first press
    expect(generated).toBe(0);
    const noKey = renderToStaticMarkup(React.createElement(VoicePlanPanel, { plan, order, voiceKey: false, busy: false, onGenerate: () => { generated++; } }));
    expect(noKey).toContain("لا يوجد مفتاح صوت");
    expect(noKey).not.toContain("ولّد الصوت الآن");
    // The request is sent from the confirmation button alone; the first press only opens it.
    const src = readFileSync(path.join(repo, "app/src/workspace/PrepareAll.tsx"), "utf8");
    expect(src.match(/onGenerate\(plan\.fingerprint\)/g)).toHaveLength(1);
    expect(src).toMatch(/onClick=\{\(\) => \{ setConfirming\(false\); onGenerate\(plan\.fingerprint\); \}\}>نعم، ولّد الصوت/);
    expect(src).toMatch(/onClick=\{\(\) => setConfirming\(true\)\}[\s\S]{0,140}>ولّد الصوت الآن/);
  });
});
