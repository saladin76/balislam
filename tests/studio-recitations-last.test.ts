/**
 * Owner decision (8 Nov): Quran recitations come LAST — over the REAL Studio server API.
 *
 * Proves: «جهّز كل المشاهد» drafts a verse scene that has no recitation (silent, plan-length, marked
 * «التلاوة تُضاف لاحقًا»); «معاينة قبل النهائية» joins every current cut and can never be recorded as the
 * assembly; a verse scene can be approved «مشروطًا بالتلاوة» so later scenes proceed, but assembly and Master
 * stay blocked; attaching the owner's recording yields a processed copy at the narration's loudness with the
 * original untouched and selectable; approving it re-opens only that verse scene; after its quick re-approval
 * with the recitation, the assembly opens. Stubs: the heavy Remotion render behind shotsPreview only.
 *
 * D237 (27 Nov 2026): the owner cancelled the recitation gate — every channel is now `verse.recitation: "none"` and a
 * verse scene is approved like any other (tests/d237-verse-without-recitation.test.ts). This file keeps guarding the
 * DORMANT machinery for a channel that would opt back into `"required"`: its copied channel.json says so explicitly.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFile, mkdtemp, mkdir, readFile, readdir, rm, rmdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Plugin, type ViteDevServer } from "vite";
import { balApi } from "../app/server/api";
import { sceneFrames } from "../src/plan/duration";
import { prepValidTail } from "./fixtures/prepValidScript";
import { passEditor } from "./fixtures/editorPass";

const repo = path.resolve(import.meta.dirname, "..");
const CH = "balislam";
/** No passphrase (owner decision 9 Nov): a page of another site is refused (403); the Studio page is the owner. */
const CROSS = { origin: "https://evil.example" };
const EP = "985";
const EP_DIR = "985-recitations-last";
const VERSE = "وَأَنْ لَيْسَ لِلْإِنْسَانِ إِلَّا مَا سَعَىٰ";

const ffmpeg = (args: string[]) => execFileSync("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", ...args]);
const probe = (file: string) => JSON.parse(execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_entries",
  "format=duration:stream=codec_type", file]).toString()) as { format: { duration: string }; streams: { codec_type: string }[] };

type Captured = { ids: string; quality?: string; scenePreview?: boolean; draftMarks?: { pendingRecitation: string[] }; plan: any; media: any };
const renders: Captured[] = [];
const renderStub = (): Plugin => ({
  name: "recitations-last-stub-remotion-render",
  enforce: "pre",
  resolveId(source, importer) {
    if (source === "./episode" && importer?.replace(/\\/g, "/").includes("/src/render/shotsPreview.ts")) return "\0recit-last-render-stub";
    return null;
  },
  load(id) {
    if (id !== "\0recit-last-render-stub") return null;
    // Same contract as the real renderer: draft marks only on a scene draft, never on a Master;
    // a scene draft always carries an audio track (silence where the recitation will go).
    return `
      import { execFileSync } from "node:child_process";
      import { mkdirSync } from "node:fs";
      import path from "node:path";
      export const renderEpisode = async (o) => {
        if (o.draftMarks && (o.quality === "master" || !o.scenePreview)) throw new Error("draft marks never to a Master");
        mkdirSync(path.dirname(o.outFile), { recursive: true });
        const silent = Boolean(o.draftMarks?.pendingRecitation?.length);
        execFileSync("ffmpeg", ["-nostdin","-hide_banner","-loglevel","error","-y",
          "-f","lavfi","-i","testsrc=size=320x180:rate=30:duration=2",
          "-f","lavfi","-i", silent ? "anullsrc=r=44100:cl=mono" : "sine=frequency=330:duration=2",
          "-t","2","-c:v","libx264","-pix_fmt","yuv420p","-preset","ultrafast","-c:a","aac","-b:a","64k",
          "-ar","44100","-ac","1","-shortest","-movflags","+faststart", o.outFile]);
        globalThis.__recitLastRenders?.push({ ids: o.plan.chapters.flatMap((c) => c.scenes.map((s) => s.id)).join(","),
          quality: o.quality, scenePreview: o.scenePreview, draftMarks: o.draftMarks, plan: o.plan, media: o.media });
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

const call = async (method: string, route: string, body?: unknown, headers: Record<string, string> = {}) => {
  const r = await fetch(`${base}/api/${route}${route.includes("?") ? "&" : "?"}channel=${CH}`, {
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
const approveCurrent = async (id: string) => {
  const cur = await state();
  expect(cur.progress.currentScene).toBe(id);
  const sc = cur.scenes.find((x: any) => x.id === id);
  const bytes = cur.candidates.scenes[id];
  const sub = await decide({ action: "submit-scene", sceneId: id, expectedSha256: sc.sourceSha256 });
  expect(sub.status, JSON.stringify(sub.body)).toBe(200);
  const ok = await decide({ action: "approve-scene", sceneId: id, expectedSha256: bytes, confirmedWatched: true });
  expect(ok.status, JSON.stringify(ok.body)).toBe(200);
  return ok.body;
};

const planOf = () => ({
  channel: CH, episode: EP, title: "التلاوة آخرًا",
  chapters: [{ number: 1, title: "تجربة", scenes: [
    { id: "c1-s1", template: "big-question", line: 7, narration: "الصبر مفتاح الفرج.", sfx: [], props: { question: "الصبر" } },
    { id: "c1-s2", template: "verse-card", line: 9, narration: "", ayahKey: "53:39", sfx: [],
      props: { text: VERSE, reference: "النجم · ٣٩", reciter: "" } },
    { id: "c1-s3", template: "big-question", line: 11, narration: "والرضا راحة القلب.", sfx: [], props: { question: "الرضا" } },
  ] }],
});

beforeAll(async () => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  await mkdir(path.join(repo, "renders"), { recursive: true });
  root = await mkdtemp(path.join(repo, "renders", "recitations-last-"));
  const chDir = path.join(root, CH);
  epDir = path.join(chDir, "episodes", EP_DIR);
  await mkdir(epDir, { recursive: true });
  for (const f of ["channel.json", "identity.json", "identity.default.json", "pronunciation.json"])
    await copyFile(path.join(repo, "channels", CH, f), path.join(chDir, f));
  { // D237: the real channels carry «none»; this dormant-machinery test opts back into «required».
    const cfg = JSON.parse(await readFile(path.join(chDir, "channel.json"), "utf8"));
    await writeFile(path.join(chDir, "channel.json"), JSON.stringify({ ...cfg, verse: { ...cfg.verse, recitation: "required" } }, null, 2));
  }
  process.env.BAL_CHANNELS_DIR = root;
  process.env.BAL_ENV_FILE = path.join(root, ".env");
  process.env.BAL_CHANNEL = CH;
  for (const k of ["BAL_WORKFLOW_HMAC_KEY", "BAL_DRIVE_PREVIEWS_DIR", "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"]) delete process.env[k];
  (globalThis as any).__recitLastRenders = renders;

  await writeFile(path.join(epDir, "script.md"),
    `---\ntitle: "التلاوة آخرًا"\ndomain: psychology\nepisode: "${EP}"\n---\n## الفصل 1 · تجربة\nالصبر مفتاح الفرج.\n\n[آية: النجم 39 | ${VERSE}]\n\nوالرضا راحة القلب.\n` + prepValidTail(["- آية | النجم 39 | القارئ: …"]));
  await passEditor(path.join(epDir, "script.md"));
  await writeFile(path.join(epDir, "plan.json"), JSON.stringify(planOf(), null, 2));
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
  delete (globalThis as any).__recitLastRenders;
  if (root) await rm(root, { recursive: true, force: true });
  await rm(path.join(repo, "renders", ".private-media", "_render", CH, EP_DIR), { recursive: true, force: true });
  for (const dir of [path.join(repo, "renders", ".private-media", "_render", CH), path.join(repo, "renders", ".private-media", "_render"), path.join(repo, "renders", ".private-media")])
    await rmdir(dir).catch(() => undefined);
});

describe("dormant D35 machinery (a channel opting into `recitation: \"required\"`; none does since D237)", () => {
  it("drafts, previews and conditionally approves a verse scene; the owner's polished recording re-opens only it", async () => {
    let s = await state();
    expect((await decide({ action: "approve-script", reviewed: true, expectedSha256: s.script.sha256 })).status).toBe(200);
    const board = await call("PUT", `episodes/${EP}/storyboard`, { action: "approve", auditNote: "راجعت اللوحات الثلاث بصريًا ومنها بطاقة الآية بنصها من السكريبت." });
    expect(board.status, JSON.stringify(board.body)).toBe(200);
    s = await state();
    expect((await decide({ action: "approve-storyboard", reviewed: true, expectedSha256: s.storyboard.sha256 })).status).toBe(200);
    s = await state();
    expect(s.scenes.map((x: any) => [x.id, x.readyForAv, x.recitationPending])).toEqual([
      ["c1-s1", true, false], ["c1-s2", true, true], ["c1-s3", true, false]]);

    // ── «جهّز كل المشاهد» no longer stops at the verse: a silent, marked draft of the plan's length ──
    const run = await prepareAll();
    expect(run.body.job, JSON.stringify(run.body)).toMatchObject({ status: "done", rendered: ["c1-s1", "c1-s2", "c1-s3"], failed: [] });
    const verseDraft = renders.find((r) => r.ids === "c1-s2")!;
    expect(verseDraft).toMatchObject({ quality: "preview", scenePreview: true, draftMarks: { pendingRecitation: ["c1-s2"] } });
    expect(verseDraft.media.recitations).toEqual({});
    const verseScene = verseDraft.plan.chapters[0].scenes[0];
    // Silence for exactly the plan's estimate of the verse (no recitation length to follow yet).
    expect(sceneFrames(verseScene, verseDraft.media)).toBe(sceneFrames(verseScene, { voice: {}, recitations: {} }));
    expect(sceneFrames(verseScene, verseDraft.media)).toBe(7 * 30);
    for (const id of ["c1-s1", "c1-s3"]) expect(renders.find((r) => r.ids === id)?.draftMarks).toBeUndefined();
    s = await state();
    expect(s.prepared).toEqual({ ready: 3, total: 3 });
    expect(probe(path.join(epDir, "previews", "scene-c1-s2-av.mp4")).streams.map((x) => x.codec_type).sort()).toEqual(["audio", "video"]);

    // ── «معاينة قبل النهائية»: owner only; every current cut in order; not the assembly ──
    expect((await call("POST", `episodes/${EP}/scene-prefinal`, undefined, CROSS)).status).toBe(403);
    const pre = await call("POST", `episodes/${EP}/scene-prefinal`);
    expect(pre.status, JSON.stringify(pre.body)).toBe(200);
    expect(pre.body).toMatchObject({ scenes: 3, recitationPending: ["c1-s2"], preview: "prefinal-no-recitation.mp4" });
    const preFile = path.join(epDir, "previews", "prefinal-no-recitation.mp4");
    expect(Number(probe(preFile).format.duration)).toBeGreaterThan(5.5);
    expect((await call("GET", `episodes/${EP}/scene-prefinal`)).body.preview).toBe("prefinal-no-recitation.mp4");
    const preSha = createHash("sha256").update(await readFile(preFile)).digest("hex");
    expect(existsSync(path.join(epDir, "previews", "episode.mp4"))).toBe(false);
    expect((await decide({ action: "assemble", expectedSha256: preSha })).status).toBe(409);
    expect((await decide({ action: "approve-assembly", expectedSha256: preSha, confirmedWatched: true, seamsChecked: s.seams })).status).toBe(409);
    expect((await ledger()).history.map((h: any) => h.action)).toEqual(["approve-script", "approve-storyboard"]);

    // ── Ordered approval: the verse is approved «مشروطًا بالتلاوة», later scenes proceed ──
    await approveCurrent("c1-s1");
    const cond = await approveCurrent("c1-s2");
    expect(cond.scenes[1]).toMatchObject({ status: "approved", conditional: true, recitationPending: true });
    expect((await ledger()).history.at(-1).note).toMatch(/^اعتماد مشروط بالتلاوة/);
    await approveCurrent("c1-s3");
    s = await state();
    expect(s.progress).toMatchObject({ currentScene: null, approvedScenes: 3, canAssemble: false, recitationPending: ["c1-s2"] });

    // ── Final gates unchanged: no assembly, no Master while a recitation is pending ──
    const assemble = await call("POST", `episodes/${EP}/scene-av-assemble`);
    expect(assemble.status).toBe(409);
    expect(assemble.body.error).toMatch(/recitation/);
    const { requireScenesReadyForMaster } = await import("../src/studio/sceneService");
    await expect(requireScenesReadyForMaster(EP)).rejects.toThrow(/recitation/);

    // ── The owner uploads his own recording: processed copy at the narration's loudness, original kept ──
    const wav = path.join(root, "my-recitation.wav");
    ffmpeg(["-f", "lavfi", "-i", "aevalsrc='0.001*(2*random(0)-1)+0.02*sin(2*PI*220*t)*between(t,0.7,3.2)':s=44100:d=4", wav]);
    const upBytes = await readFile(wav);
    expect((await call("POST", `episodes/${EP}/own-recitations`, { action: "upload", key: "53:39", name: "my-recitation.wav", data: upBytes.toString("base64") }, CROSS)).status).toBe(403);
    const up = await call("POST", `episodes/${EP}/own-recitations`, { action: "upload", key: "53:39", name: "my-recitation.wav", data: upBytes.toString("base64") });
    expect(up.status, JSON.stringify(up.body)).toBe(200);
    const cand = up.body.candidate;
    expect(cand.variant).toBe("processed");
    expect(cand.polish.target.source).toBe("narration");
    expect(Math.abs(cand.variants.processed.loudness.integrated - cand.polish.target.integrated)).toBeLessThanOrEqual(1);
    expect(cand.variants.processed.loudness.truePeak).toBeLessThanOrEqual(-1);
    expect(cand.polish.before.integrated).toBeLessThan(cand.polish.target.integrated - 5);
    expect(cand.polish.trim.trimmedHead).toBeGreaterThan(0.4);
    expect(cand.polish.trim.trimmedTail).toBeGreaterThan(0.3);
    // No time stretch: processed length = kept span; the original copy keeps the full length.
    expect(Math.abs(cand.variants.processed.duration - (cand.polish.trim.end - cand.polish.trim.start))).toBeLessThan(0.1);
    expect(Math.abs(cand.variants.original.duration - 4)).toBeLessThan(0.1);
    const recDir = path.join(epDir, "recitations");
    const originals = await readdir(path.join(recDir, "originals"));
    expect(originals).toHaveLength(1);
    expect((await readFile(path.join(recDir, "originals", originals[0]!))).equals(upBytes)).toBe(true);
    // The owner can switch back to the original, and again to the processed copy.
    const toOriginal = await call("POST", `episodes/${EP}/own-recitations`, { action: "select", key: "53:39", variant: "original" });
    expect(toOriginal.body.candidate).toMatchObject({ variant: "original", file: cand.variants.original.file });
    const back = await call("POST", `episodes/${EP}/own-recitations`, { action: "select", key: "53:39", variant: "processed" });
    expect(back.body.candidate).toMatchObject({ variant: "processed", file: cand.variants.processed.file });
    const listed = await call("GET", `episodes/${EP}/own-recitations`);
    expect(listed.body.verses).toEqual([{ key: "53:39", sceneId: "c1-s2", reference: "النجم · ٣٩" }]);
    expect(listed.body.pending["53:39"].variants.processed.loudness.integrated).toBe(cand.variants.processed.loudness.integrated);
    // The players in «التلاوات» (PreFinal.tsx audioUrl) load both copies through the episode media route.
    for (const v of ["processed", "original"] as const) {
      const r = await fetch(`${base}/api/episodes/${EP}/media/recitations/${encodeURIComponent(cand.variants[v].file)}?channel=${CH}`);
      expect(r.status, v).toBe(200);
      expect((await r.arrayBuffer()).byteLength).toBeGreaterThan(1000);
    }
    // Uploading alone changes nothing in the scene ledger.
    expect((await state()).scenes[1]).toMatchObject({ status: "approved", conditional: true });

    const ok = await call("POST", `episodes/${EP}/own-recitations`, { action: "approve", key: "53:39", reciter: "صاحب القناة",
      rightsEvidence: "تسجيلي الخاص لهذه الحلقة بتاريخ ٨ نوفمبر", note: "استمعت إلى التلاوة كاملة بعد المعالجة", listened: true });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);

    // ── Only the verse scene re-opens for a quick recitation check ──
    s = await state();
    expect(s.scenes.map((x: any) => [x.id, x.status, x.recitationPending])).toEqual([
      ["c1-s1", "approved", false], ["c1-s2", "needs_revision", false], ["c1-s3", "approved", false]]);
    expect(s.progress).toMatchObject({ currentScene: "c1-s2", canAssemble: false, recitationPending: [] });
    const render = await call("POST", `episodes/${EP}/scene-av-render`, { sceneId: "c1-s2", expectedSha256: s.scenes[1].sourceSha256 });
    expect(render.status, JSON.stringify(render.body)).toBe(200);
    const withRec = renders.at(-1)!;
    expect(withRec.ids).toBe("c1-s2");
    expect(withRec.draftMarks).toBeUndefined();
    expect(Object.keys(withRec.media.recitations)).toEqual(["53:39"]);
    const final = await approveCurrent("c1-s2");
    expect(final.scenes[1]).toMatchObject({ status: "approved", conditional: false });
    s = await state();
    expect(s.progress).toMatchObject({ canAssemble: true, recitationPending: [] });
    const assembled = await call("POST", `episodes/${EP}/scene-av-assemble`);
    expect(assembled.status, JSON.stringify(assembled.body)).toBe(200);
    // Still no Master without the assembly's own 1× approval.
    await expect(requireScenesReadyForMaster(EP)).rejects.toThrow();
  }, 300_000);
});
