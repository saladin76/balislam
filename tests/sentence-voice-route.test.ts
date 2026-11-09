/**
 * «الجمل» عبر خادم الاستوديو الحقيقي (D50): القراءة والفعل من صفحة الاستوديو بلا كلمة مرور (قرار ٩ نوفمبر)،
 * وكل فعل من موقع آخر 403،
 * و«ولّد» بلا مفتاح يُرفض برسالة عربية دون أي طلب خارجي.
 */
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { balApi } from "../app/server/api";

const repo = path.resolve(import.meta.dirname, "..");
const CH = "balislam";
const ENV_KEYS = ["BAL_CHANNELS_DIR", "BAL_ENV_FILE", "BAL_WORKFLOW_HMAC_KEY", "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"];
const saved: Record<string, string | undefined> = {};
let root = "";
let vite: ViteDevServer;
let server: http.Server;
let base = "";

const call = async (method: string, route: string, body?: unknown, headers: Record<string, string> = {}) => {
  const r = await fetch(`${base}/api/${route}?channel=${CH}`, {
    method,
    headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => null) as any };
};

beforeAll(async () => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  await mkdir(path.join(repo, "renders"), { recursive: true });
  root = await mkdtemp(path.join(repo, "renders", "sentence-route-"));
  const chDir = path.join(root, CH);
  const epDir = path.join(chDir, "episodes", "985-sentence-route");
  await mkdir(epDir, { recursive: true });
  for (const f of ["channel.json", "identity.json", "identity.default.json", "pronunciation.json"])
    await copyFile(path.join(repo, "channels", CH, f), path.join(chDir, f));
  process.env.BAL_CHANNELS_DIR = root;
  process.env.BAL_ENV_FILE = path.join(root, ".env");
  process.env.BAL_WORKFLOW_HMAC_KEY = "LOCAL_TEST_ONLY__sentence_route_signing_key_2026";
  delete process.env.ELEVENLABS_API_KEY;
  delete process.env.ELEVENLABS_VOICE_ID;
  await writeFile(process.env.BAL_ENV_FILE, `BAL_WORKFLOW_HMAC_KEY=${process.env.BAL_WORKFLOW_HMAC_KEY}\n`);
  const narration = "الصَّبْرُ مِفْتَاحُ الفَرَجِ. وَالشُّكْرُ زِينَةُ النِّعَمِ.";
  await writeFile(path.join(epDir, "script.md"), `---\ntitle: "اختبار"\nepisode: "985"\n---\n## الفصل 1 · تجربة\n${narration}\n`);
  await writeFile(path.join(epDir, "tashkeel.md"), `${narration}\n`);
  await writeFile(path.join(epDir, "plan.json"), JSON.stringify({ episode: "985", title: "اختبار", tone: "calm", chapters: [{ number: 1, title: "تجربة", scenes: [
    { id: "c1-s1", template: "alley-tale", line: 6, narration, sfx: [], props: {} }] }] }, null, 2));
  vite = await createServer({
    configFile: false, root: path.join(repo, "app"), logLevel: "error", appType: "custom",
    plugins: [balApi()],
    server: { middlewareMode: true, hmr: false, watch: null, fs: { allow: [repo, root] } },
  });
  server = http.createServer(vite.middlewares);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, 60_000);
afterAll(async () => {
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  await vite?.close();
  for (const k of ENV_KEYS) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  if (root) await rm(root, { recursive: true, force: true });
});

describe("GET/POST /api/episodes/<ep>/sentences", () => {
  it("القراءة مفتوحة، والفعل من موقع آخر 403، ومن صفحة الاستوديو يُقبل مباشرة", async () => {
    const read = await call("GET", "episodes/985/sentences");
    expect(read.status).toBe(200);
    expect(read.body.scenes[0].rows.map((r: { text: string }) => r.text)).toEqual(["الصَّبْرُ مِفْتَاحُ الفَرَجِ.", "وَالشُّكْرُ زِينَةُ النِّعَمِ."]);
    expect(read.body.voiceKey).toBe(false);
    const id = read.body.scenes[0].rows[0].id;
    expect((await call("POST", "episodes/985/sentences", { action: "pause", id, ms: 700 }, { origin: "https://evil.example" })).status).toBe(403);
    expect((await call("POST", "episodes/985/sentences", { action: "pause", id, ms: 700 }, { "sec-fetch-site": "cross-site" })).status).toBe(403);
    const ok = await call("POST", "episodes/985/sentences", { action: "pause", id, ms: 700 });
    expect(ok.status).toBe(200);
    expect(ok.body.read.scenes[0].rows[0].pauseAfterMs).toBe(700);
    expect(ok.body.planChanged).toBe(false);
  }, 60_000);

  it("«ولّد» بلا مفتاح يُرفض (409) بسبب واضح، وتعديل النص يرجع الخطة الجديدة", async () => {
    const read = await call("GET", "episodes/985/sentences");
    const id = read.body.scenes[0].rows[1].id;
    // لا اعتماد للسكريبت بعد: البوابة نفسها تقول ذلك قبل أي طلب
    const gen = await call("POST", "episodes/985/sentences", { action: "generate", id });
    expect(gen.status).toBe(409);
    expect(gen.body.error).toMatch(/اعتمد|الستوري بورد|مفاتيح/);
    const edit = await call("POST", "episodes/985/sentences", { action: "edit", id, text: "وَالشُّكْرُ زِينَةُ النِّعَمِ كُلِّهَا." });
    expect(edit.status).toBe(200);
    expect(edit.body.planChanged).toBe(true);
    expect(edit.body.plan.chapters[0].scenes[0].narration).toBe("الصَّبْرُ مِفْتَاحُ الفَرَجِ. وَالشُّكْرُ زِينَةُ النِّعَمِ كُلِّهَا.");
  }, 60_000);
});
