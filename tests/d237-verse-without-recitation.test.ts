/**
 * D237 (قرار المالك ٢٧ نوفمبر: «بوابة D35: ألغها. لا تلاوات؛ الآية تظهر مكتوبة، والمشهد يُعتمد عادي»)
 * — على خادم الاستوديو الحقيقي بقناة «بالإسلام» كما هي في المستودع (`verse.recitation: "none"`).
 *
 * يثبت: مشهد الآية بلا أي تلاوة يُجهَّز بطاقةً مكتوبة نهائية (لا علامة «التلاوة تُضاف لاحقًا»)، ويُعتمد اعتمادًا عاديًا
 * (لا «مشروط بالتلاوة»)، فيُفتح التجميع ويُعتمد ثم بوابة Master؛ ولا يُرفع للآية تسجيل (409). والاعتماد المشروط
 * القديم المسجَّل قبل القرار يصير اعتمادًا عاديًا بلا إعادة فتح، إلا البسملة التي تنتظر تسجيل المالك.
 * الحارس كما هو: لا يذهب نص الآية إلى الصوت المستنسخ (tests/quran-tts-guard.test.ts).
 * البديل الوحيد: رندر Remotion الثقيل خلف shotsPreview.
 */
import { execFileSync } from "node:child_process";
import { copyFile, mkdtemp, mkdir, readFile, rm, rmdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Plugin, type ViteDevServer } from "vite";
import { balApi } from "../app/server/api";
import { prepValidTail } from "./fixtures/prepValidScript";
import { passEditor } from "./fixtures/editorPass";
import { grantTestMacRenderPermit } from "./helpers/macRenderPermit";
import { versesAreCitations } from "../src/quran/citation";
import {
  approveSceneAv, approveScript, approveStoryboard, createSceneFirstProduction, sceneFirstProgress, submitSceneAvPreview,
} from "../src/studio/sceneProduction";
import { reconcileSceneLedger } from "../src/studio/sceneLedgerState";

const repo = path.resolve(import.meta.dirname, "..");
const CH = "balislam";
const EP = "984";
const EP_DIR = "984-d237-no-recitation";
const VERSE = "وَأَنْ لَيْسَ لِلْإِنْسَانِ إِلَّا مَا سَعَىٰ";

const ffmpeg = (args: string[]) => execFileSync("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", ...args]);

type Captured = { ids: string; draftMarks?: { pendingRecitation: string[] }; media: any };
const renders: Captured[] = [];
const renderStub = (): Plugin => ({
  name: "d237-stub-remotion-render",
  enforce: "pre",
  resolveId(source, importer) {
    if (source === "./episode" && importer?.replace(/\\/g, "/").includes("/src/render/shotsPreview.ts")) return "\0d237-render-stub";
    return null;
  },
  load(id) {
    if (id !== "\0d237-render-stub") return null;
    return `
      import { execFileSync } from "node:child_process";
      import { mkdirSync } from "node:fs";
      import path from "node:path";
      export const renderEpisode = async (o) => {
        mkdirSync(path.dirname(o.outFile), { recursive: true });
        execFileSync("ffmpeg", ["-nostdin","-hide_banner","-loglevel","error","-y",
          "-f","lavfi","-i","testsrc=size=320x180:rate=30:duration=2",
          "-f","lavfi","-i","sine=frequency=330:duration=2",
          "-t","2","-c:v","libx264","-pix_fmt","yuv420p","-preset","ultrafast","-c:a","aac","-b:a","64k",
          "-ar","44100","-ac","1","-shortest","-movflags","+faststart", o.outFile]);
        globalThis.__d237Renders?.push({ ids: o.plan.chapters.flatMap((c) => c.scenes.map((s) => s.id)).join(","),
          draftMarks: o.draftMarks, media: o.media });
        return o.outFile;
      };`;
  },
});

let root = "";
let epDir = "";
let vite: ViteDevServer;
let server: http.Server;
let base = "";
const saved: Record<string, string | undefined> = {};
const ENV_KEYS = ["BAL_CHANNELS_DIR", "BAL_ENV_FILE", "BAL_WORKFLOW_HMAC_KEY", "BAL_DRIVE_PREVIEWS_DIR",
  "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID", "BAL_CHANNEL"];

const call = async (method: string, route: string, body?: unknown) => {
  const r = await fetch(`${base}/api/${route}${route.includes("?") ? "&" : "?"}channel=${CH}`, {
    method,
    headers: { "sec-fetch-site": "same-origin", ...(body !== undefined ? { "content-type": "application/json" } : {}) },
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
const decide = (cmd: Record<string, unknown>) => call("POST", `episodes/${EP}/scene-production`, cmd);
const ledger = async () => JSON.parse(await readFile(path.join(epDir, "scene-production.v1.json"), "utf8"));
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
const approve = async (id: string) => {
  const cur = await state();
  const sc = cur.scenes.find((x: any) => x.id === id);
  const bytes = cur.candidates.scenes[id];
  const sub = await decide({ action: "submit-scene", sceneId: id, expectedSha256: sc.sourceSha256 });
  expect(sub.status, JSON.stringify(sub.body)).toBe(200);
  const ok = await decide({ action: "approve-scene", sceneId: id, expectedSha256: bytes, confirmedWatched: true });
  expect(ok.status, JSON.stringify(ok.body)).toBe(200);
  return ok.body;
};

beforeAll(async () => {
  await grantTestMacRenderPermit();
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  await mkdir(path.join(repo, "renders"), { recursive: true });
  root = await mkdtemp(path.join(repo, "renders", "d237-"));
  const chDir = path.join(root, CH);
  epDir = path.join(chDir, "episodes", EP_DIR);
  await mkdir(epDir, { recursive: true });
  // القناة كما هي في المستودع، بلا تعديل: الحقل «none» نفسه هو ما يُختبر
  for (const f of ["channel.json", "identity.json", "identity.default.json", "pronunciation.json"])
    await copyFile(path.join(repo, "channels", CH, f), path.join(chDir, f));
  process.env.BAL_CHANNELS_DIR = root;
  process.env.BAL_ENV_FILE = path.join(root, ".env");
  process.env.BAL_CHANNEL = CH;
  for (const k of ["BAL_WORKFLOW_HMAC_KEY", "BAL_DRIVE_PREVIEWS_DIR", "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"]) delete process.env[k];
  (globalThis as any).__d237Renders = renders;

  await writeFile(path.join(epDir, "script.md"),
    `---\ntitle: "الآية مكتوبة"\ndomain: psychology\nepisode: "${EP}"\n---\n## الفصل 1 · تجربة\nالصبر مفتاح الفرج.\n\n[آية: النجم 39 | ${VERSE}]\n\nوالرضا راحة القلب.\n` + prepValidTail(["- آية | النجم 39 | المصحف"]));
  await passEditor(path.join(epDir, "script.md"));
  await writeFile(path.join(epDir, "plan.json"), JSON.stringify({
    channel: CH, episode: EP, title: "الآية مكتوبة",
    chapters: [{ number: 1, title: "تجربة", scenes: [
      { id: "c1-s1", template: "big-question", line: 7, narration: "الصبر مفتاح الفرج.", sfx: [], props: { question: "الصبر" } },
      { id: "c1-s2", template: "verse-card", line: 9, narration: "", ayahKey: "53:39", sfx: [], props: { text: VERSE, reference: "النجم · ٣٩" } },
      { id: "c1-s3", template: "big-question", line: 11, narration: "والرضا راحة القلب.", sfx: [], props: { question: "الرضا" } },
    ] }],
  }, null, 2));
  const voice = path.join(epDir, "voice");
  await mkdir(voice);
  const index: Record<string, unknown> = {};
  for (const [id, text] of [["c1-s1", "الصبر مفتاح الفرج."], ["c1-s3", "والرضا راحة القلب."]] as const) {
    ffmpeg(["-f", "lavfi", "-i", "sine=frequency=300:duration=1.5", "-c:a", "libmp3lame", "-b:a", "64k", path.join(voice, `${id}.mp3`)]);
    index[id] = { file: `${id}.mp3`, hash: `pre-${id}`, text, duration: 1.5, words: [] };
  }
  await writeFile(path.join(voice, "index.json"), JSON.stringify(index, null, 2));

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
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  await vite?.close();
  for (const k of ENV_KEYS) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  delete (globalThis as any).__d237Renders;
  if (root) await rm(root, { recursive: true, force: true });
  await rm(path.join(repo, "renders", ".private-media", "_render", CH, EP_DIR), { recursive: true, force: true });
  for (const dir of [path.join(repo, "renders", ".private-media", "_render", CH), path.join(repo, "renders", ".private-media", "_render"), path.join(repo, "renders", ".private-media")])
    await rmdir(dir).catch(() => undefined);
});

describe("D237: لا تلاوات — الآية مكتوبة ومشهدها يُعتمد عادي في القنوات الثلاث", () => {
  it("القنوات الثلاث في المستودع بلا تلاوة (`verse.recitation: \"none\"`)", () => {
    for (const ch of ["balislam", "dafatir-alzaman", "zubdat-alkutub"])
      expect(versesAreCitations(JSON.parse(readFileSync(path.join(repo, "channels", ch, "channel.json"), "utf8"))), ch).toBe(true);
  });

  it("مشهد آية بلا تلاوة: يُجهَّز بطاقةً نهائية، ويُعتمد عادي، ثم التجميع واعتماده وبوابة Master", async () => {
    let s = await state();
    expect((await decide({ action: "approve-script", reviewed: true, expectedSha256: s.script.sha256 })).status).toBe(200);
    const board = await call("PUT", `episodes/${EP}/storyboard`, { action: "approve", auditNote: "راجعت اللوحات الثلاث ومنها بطاقة الآية مكتوبة بنصها من السكريبت." });
    expect(board.status, JSON.stringify(board.body)).toBe(200);
    s = await state();
    expect((await decide({ action: "approve-storyboard", reviewed: true, expectedSha256: s.storyboard.sha256 })).status).toBe(200);
    s = await state();
    // لا مشهد ينتظر تلاوة
    expect(s.scenes.map((x: any) => [x.id, x.readyForAv, x.recitationPending])).toEqual([
      ["c1-s1", true, false], ["c1-s2", true, false], ["c1-s3", true, false]]);

    // لا يُطلب للآية تسجيل ولا يُقبل
    const listed = await call("GET", `episodes/${EP}/own-recitations`);
    expect(listed.body.verses ?? []).toEqual([]);
    const up = await call("POST", `episodes/${EP}/own-recitations`, { action: "upload", key: "53:39", name: "x.wav", data: "AAAA" });
    expect(up.status).toBe(409);

    // التجهيز: بطاقة الآية مسودة نهائية بلا علامة «التلاوة تُضاف لاحقًا» ولا تلاوة
    const run = await prepareAll();
    expect(run.body.job, JSON.stringify(run.body)).toMatchObject({ status: "done", rendered: ["c1-s1", "c1-s2", "c1-s3"], failed: [] });
    const verseDraft = renders.find((r) => r.ids === "c1-s2")!;
    expect(verseDraft.draftMarks).toBeUndefined();
    expect(verseDraft.media.recitations).toEqual({});

    // اعتماد عادي لكل مشهد، بأي ترتيب (D145) — الآية أولًا هنا
    const verse = await approve("c1-s2");
    expect(verse.scenes.find((x: any) => x.id === "c1-s2")).toMatchObject({ status: "approved", conditional: false, recitationPending: false });
    expect((await ledger()).history.at(-1).note).not.toMatch(/مشروط بالتلاوة/);
    await approve("c1-s3");
    await approve("c1-s1");
    s = await state();
    expect(s.progress).toMatchObject({ currentScene: null, approvedScenes: 3, canAssemble: true, recitationPending: [] });

    // التجميع واعتماده، ثم بوابة Master مفتوحة
    const asm = await call("POST", `episodes/${EP}/scene-av-assemble`);
    expect(asm.status, JSON.stringify(asm.body)).toBe(200);
    s = await state();
    const assemblySha = s.candidates.assemblySha256;
    expect((await decide({ action: "assemble", expectedSha256: assemblySha })).status).toBe(200);
    const { requireScenesReadyForMaster } = await import("../src/studio/sceneService");
    await expect(requireScenesReadyForMaster(EP)).rejects.toThrow(); // قبل اعتماد التجميع كما كان
    const asmOk = await decide({ action: "approve-assembly", expectedSha256: assemblySha });
    expect(asmOk.status, JSON.stringify(asmOk.body)).toBe(200);
    await expect(requireScenesReadyForMaster(EP)).resolves.toBeUndefined();
  }, 300_000);
});

describe("D237: الاعتماد المشروط القديم يصير اعتمادًا عاديًا بلا إعادة فتح", () => {
  const h = (c: string) => c.repeat(64);
  const AT = "2026-11-20T10:00:00.000Z";
  const legacy = () => {
    let p = createSceneFirstProduction({ channel: "balislam", episode: "x", scriptSha256: h("a"), storyboardSha256: h("b"),
      scenes: [{ id: "n", sourceSha256: h("1") }, { id: "v", sourceSha256: h("2") }, { id: "basm", sourceSha256: h("3") }] });
    p = approveStoryboard(approveScript(p, "owner", AT, h("a")), "owner", AT, h("b"));
    for (const [id, src, pv, cond] of [["n", h("1"), h("4"), false], ["v", h("2"), h("5"), true], ["basm", h("3"), h("6"), true]] as const) {
      p = submitSceneAvPreview(p, id, src, pv);
      p = approveSceneAv(p, id, { by: "owner", at: AT, previewSha256: pv, watchedWithAudio: true, recitationPending: cond });
    }
    return p;
  };
  it("الآية التي لم تعد تنتظر تلاوة يُرفع شرطها؛ والبسملة التي تنتظر تسجيل المالك تبقى مشروطة", () => {
    const p = legacy();
    expect(sceneFirstProgress(p)).toMatchObject({ recitationPending: ["v", "basm"], canAssemble: false });
    const now = reconcileSceneLedger(p, p, { n: false, v: false, basm: true });
    expect(now.scenes.map((s) => [s.id, s.status, s.approval?.recitationPending ?? null])).toEqual([
      ["n", "approved", null], ["v", "approved", null], ["basm", "approved", true]]);
    // الاعتماد نفسه (من، ومتى، وأي بايتات) لم يتغير، ولا مشهد أُعيد فتحه
    expect(now.scenes[1]!.approval).toMatchObject({ by: "owner", at: AT, previewSha256: h("5"), sourceSha256: h("2") });
    expect(sceneFirstProgress(now)).toMatchObject({ recitationPending: ["basm"], canAssemble: false });
    const done = reconcileSceneLedger(p, p, { n: false, v: false, basm: false });
    expect(sceneFirstProgress(done)).toMatchObject({ recitationPending: [], canAssemble: true });
    // بلا معلومات الحاضر (نداء قديم) لا يتغير شيء
    expect(reconcileSceneLedger(p, p)).toEqual(p);
  });
});
