/**
 * D97 end to end through the real studio server (QA زبدة الكتب D-1، D-3، D-4): an episode whose scene text changed
 * after recording (remap-scene-ids --with-changed-text). Every sentence action the page sends with the id it read
 * is found (never 409 «المشهد غير موجود أو بلا تعليق.»), the old take reads «قديم» with its file, and the
 * episode-tone check counts what a tone would invalidate without writing or generating anything.
 * No key, no network: «ولّد» is refused for the key alone.
 */
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { balApi } from "../app/server/api";
import { encodeWav } from "../src/remotion/dafatir/audio/compose";
import { passEditor } from "./fixtures/editorPass";

const repo = path.resolve(import.meta.dirname, "..");
const CH = "zubdat-alkutub";
const ENV_KEYS = ["BAL_CHANNELS_DIR", "BAL_CHANNEL", "BAL_ENV_FILE", "BAL_WORKFLOW_HMAC_KEY", "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"];
const saved: Record<string, string | undefined> = {};
let root = "";
let epDir = "";
let vite: ViteDevServer;
let server: http.Server;
let base = "";
const SR = 44100;

const T1 = "كَتَبَ الوَلَدُ الدَّرْسَ.";
const T2_OLD = "ثُمَّ ذَهَبَ إِلَى البَيْتِ؟";
const T2_NEW = "ثُمَّ رَجَعَ إِلَى البَيْتِ؟";
const T3 = "وَنَامَ مُبَكِّرًا.";

const call = async (method: string, route: string, body?: unknown) => {
  const r = await fetch(`${base}/api/${route}${route.includes("?") ? "&" : "?"}channel=${CH}`, {
    method,
    headers: { "sec-fetch-site": "same-origin", ...(body !== undefined ? { "content-type": "application/json" } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => null) as any };
};
const writePlan = (narration: string, tone?: string) => writeFile(path.join(epDir, "plan.json"), JSON.stringify({
  episode: "984", title: "اختبار", ...(tone ? { tone } : {}),
  chapters: [{ number: 1, title: "", scenes: [{ id: "c1-s1", template: "zubdat-shot", line: 6, narration, sfx: [], props: {} }] }],
}, null, 2) + "\n");

beforeAll(async () => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  await mkdir(path.join(repo, "renders"), { recursive: true });
  root = await mkdtemp(path.join(repo, "renders", "sentence-stale-route-"));
  const chDir = path.join(root, CH);
  epDir = path.join(chDir, "episodes", "984-stale-route");
  await mkdir(path.join(epDir, "voice"), { recursive: true });
  for (const f of ["channel.json", "identity.json", "identity.default.json", "pronunciation.json", "pronunciations.json"]) await copyFile(path.join(repo, "channels", CH, f), path.join(chDir, f)).catch(() => {});
  process.env.BAL_CHANNELS_DIR = root;
  process.env.BAL_CHANNEL = CH;
  process.env.BAL_ENV_FILE = path.join(root, ".env");
  process.env.BAL_WORKFLOW_HMAC_KEY = "LOCAL_TEST_ONLY__sentence_stale_route_key_2026";
  delete process.env.ELEVENLABS_API_KEY;
  delete process.env.ELEVENLABS_VOICE_ID;
  await writeFile(process.env.BAL_ENV_FILE, `BAL_WORKFLOW_HMAC_KEY=${process.env.BAL_WORKFLOW_HMAC_KEY}\n`);
  // the owner's state: the scene recorded on its old text and adopted into sentences, then the text changed
  const old = `${T1} ${T2_OLD} ${T3}`;
  await writeFile(path.join(epDir, "script.md"), `---\ntitle: "اختبار"\nepisode: "984"\n---\n${old}\n`);
  await passEditor(path.join(epDir, "script.md"));
  await writeFile(path.join(epDir, "tashkeel.md"), `${old}\n${T2_NEW}\n`);
  await writePlan(old);
  const ws: { word: string; start: number; end: number }[] = [];
  let t = 0.3;
  for (const w of old.split(" ")) { ws.push({ word: w, start: t, end: t + 0.3 }); t += /[.؟]$/.test(w) ? 0.9 : 0.34; }
  await writeFile(path.join(epDir, "voice", "scenehash0000002.wav"), Buffer.from(encodeWav(new Float32Array(Math.round((t + 0.4) * SR)).map((_, k) => Math.sin(k / 9) * 0.2), SR)));
  await writeFile(path.join(epDir, "voice", "index.json"), JSON.stringify({ "c1-s1": { file: "scenehash0000002.wav", hash: "scenehash0000002", text: old, duration: t + 0.4, words: ws } }, null, 2));
  vite = await createServer({
    configFile: false, root: path.join(repo, "app"), logLevel: "error", appType: "custom",
    plugins: [balApi()],
    server: { middlewareMode: true, hmr: false, watch: null, fs: { allow: [repo, root] } },
  });
  server = http.createServer(vite.middlewares);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const adopt = await call("POST", "episodes/984/sentences", { action: "adopt", sceneId: "c1-s1", index: 0 });
  expect(adopt.status).toBe(200);
  await writePlan(`${T1} ${T2_NEW} ${T3}`);
  await writeFile(path.join(epDir, "script.md"), `---\ntitle: "اختبار"\nepisode: "984"\n---\n${T1} ${T2_NEW} ${T3}\n`);
  await passEditor(path.join(epDir, "script.md"));
}, 60_000);
afterAll(async () => {
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  await vite?.close();
  for (const k of ENV_KEYS) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  if (root) await rm(root, { recursive: true, force: true });
});

describe("a «قديم» scene through /api/episodes/<ep>/sentences (D97)", () => {
  it("reads «قديم» with the old take, and the same ids twice", async () => {
    const a = await call("GET", "episodes/984/sentences");
    const b = await call("GET", "episodes/984/sentences");
    expect(a.status).toBe(200);
    const rows = a.body.scenes[0].rows;
    expect(rows.map((r: { id: string }) => r.id)).toEqual(b.body.scenes[0].rows.map((r: { id: string }) => r.id));
    expect(rows.map((r: { status: string }) => r.status)).toEqual(["generated", "old", "generated"]);
    expect(rows[1].audio.file).toMatch(/\.wav$/);
    expect(rows[1].recordedOn).toBe(T2_OLD);
    const media = await fetch(`${base}/api/episodes/984/media/sentences/${encodeURIComponent(rows[1].audio.file)}?channel=${CH}`);
    expect(media.status).toBe(200);
  }, 60_000);

  it("tone, pause, edit, split, merge, heard and delete on the id the page read: 200, never «المشهد غير موجود»", async () => {
    const rows = (await call("GET", "episodes/984/sentences")).body.scenes[0].rows;
    const id = rows[1].id;
    for (const body of [
      { action: "tone", id, tone: "warm" },
      { action: "pause", id, ms: 600 },
      { action: "heard", id, value: false },
      { action: "split", id, at: 2 },
      { action: "merge", id },
      { action: "edit", id, text: T2_NEW },
      { action: "add", id, text: "جُمْلَةٌ مُضَافَةٌ." },
    ]) {
      const r = await call("POST", "episodes/984/sentences", body);
      expect(r.body?.error ?? "").not.toMatch(/المشهد غير موجود/);
      expect(r.status, JSON.stringify(body)).toBe(200);
    }
    const now = (await call("GET", "episodes/984/sentences")).body.scenes[0].rows;
    const del = await call("POST", "episodes/984/sentences", { action: "delete", id: now[2].id });
    expect(del.status).toBe(200);
    const gen = await call("POST", "episodes/984/sentences", { action: "generate", id });
    expect(gen.body.error).not.toMatch(/المشهد غير موجود/);
    expect(gen.status).toBeGreaterThanOrEqual(400);
    // nothing paid was dropped: the old take is still the sentence's (current or history)
    const doc = JSON.parse(await readFile(path.join(epDir, "voice", "sentences.json"), "utf8"));
    const files = doc.scenes["c1-s1"].sentences.flatMap((s: any) => [...(s.takes ?? []), ...(s.audio ? [s.audio] : [])].map((a: any) => a.file));
    expect(files).toContain(rows[1].audio.file);
  }, 60_000);

  it("GET …/sentences/tone-impact counts what a tone would invalidate, writes nothing and generates nothing", async () => {
    const plan = await readFile(path.join(epDir, "plan.json"), "utf8");
    const doc = await readFile(path.join(epDir, "voice", "sentences.json"), "utf8");
    const calm = await call("GET", "episodes/984/sentences/tone-impact?tone=calm");
    expect(calm.status).toBe(200);
    expect(calm.body.sentences.length).toBeGreaterThan(0);
    expect((await call("GET", "episodes/984/sentences/tone-impact?tone=grave")).status).toBeGreaterThanOrEqual(400);
    expect((await call("GET", "episodes/984/sentences/tone-impact?tone=loud")).status).toBeGreaterThanOrEqual(400);
    expect(await readFile(path.join(epDir, "plan.json"), "utf8")).toBe(plan);
    expect(await readFile(path.join(epDir, "voice", "sentences.json"), "utf8")).toBe(doc);
  }, 60_000);
});
