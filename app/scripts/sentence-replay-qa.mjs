/**
 * «الجمل»: إعادة تشغيل الجملة بعد توليدها، في متصفح حقيقي (D105). بلاغ المالك ١٢ نوفمبر:
 * «لما أولّد جملة وأعيد تشغيلها مش بتشتغل».
 *
 * Self-contained and free: starts its own Studio (app/vite.config.ts) in this process on a COPY of one episode under
 * renders/ (deleted at the end), with a signing key for the copy only and a fake ElevenLabs answered inside this process
 * (globalThis.fetch answers every non-local request in this process: a 1.5 s ffmpeg tone, never the network, never a real key;
 * the voice service's address is named only in src/voice/elevenlabs.ts, tests/quran-tts-guard.test.ts).
 * The preparation approval it writes lives in the copy's ledger and is deleted with it.
 *
 * Checks, each by the sentence's own <audio> reaching «ended» (heard to the end), with the scene preview playing:
 *   generate → play → play again; generate twice → play → play again; reload → play;
 *   the preview unmuted and playing → play the sentence (the preview pauses itself, the sentence is heard).
 * And the media route the way Safari asks for it (bytes=0-1 → 206 with Content-Range, Accept-Ranges: bytes).
 *
 *   node app/scripts/sentence-replay-qa.mjs [--port 4442] [--channel zubdat-alkutub] [--episode 001] [--scene c1-s1] [--shots <dir>]
 *
 * Playwright is resolved from the project, PLAYWRIGHT_MODULE, or /opt/node-tools. Exit code 1 when anything fails.
 */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : def; };
const port = Number(arg("port", "4442"));
const CH = arg("channel", "zubdat-alkutub");
const EP = arg("episode", "001");
const SCENE = arg("scene", "c1-s1");
const shots = arg("shots", "");
const repo = path.resolve(import.meta.dirname, "..", "..");

const load = () => {
  const bases = [process.cwd() + "/", process.env.PLAYWRIGHT_MODULE ? process.env.PLAYWRIGHT_MODULE.replace(/\/?$/, "/") : "", "/opt/node-tools/", "/opt/npm-tools/"].filter(Boolean);
  for (const b of bases) { try { return createRequire(b)("playwright"); } catch { /* next */ } }
  throw Error("Playwright not found (set PLAYWRIGHT_MODULE).");
};
const { chromium } = load();

// ── the copy (under renders/, so the media guard serves it like the owner's own files) ──
await mkdir(path.join(repo, "renders"), { recursive: true });
const root = await mkdtemp(path.join(repo, "renders", "sentence-replay-qa-"));
const chSrc = path.join(repo, "channels", CH);
const epName = (await readdir(path.join(chSrc, "episodes"))).find((d) => d.startsWith(`${EP}-`));
if (!epName) throw Error(`No episode ${EP} in ${CH}.`);
for (const f of await readdir(chSrc)) if (/\.(json|md)$/.test(f)) await cp(path.join(chSrc, f), path.join(root, CH, f));
// script, plan, boards and images only: no voice, no recitations, no previews, no renders
await cp(path.join(chSrc, "episodes", epName), path.join(root, CH, "episodes", epName), {
  recursive: true,
  filter: (src) => !/[\\/](voice|recitations|previews|out|renders|notes)([\\/]|$)/.test(path.relative(chSrc, src)) && !/\.(mp4|mov|webm|wav|mp3)$/i.test(src),
});
const tone = path.join(root, "tone.mp3");
execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=1.5", "-ac", "1", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "128k", tone]);
const mp3 = (await readFile(tone)).toString("base64");

process.env.BAL_CHANNELS_DIR = root;
process.env.BAL_ENV_FILE = path.join(root, ".env");
process.env.BAL_CONTENT_SYNC = "off";
await writeFile(process.env.BAL_ENV_FILE, "BAL_WORKFLOW_HMAC_KEY=LOCAL_TEST_ONLY__sentence_replay_qa_key_2026\n");
delete process.env.ELEVENLABS_API_KEY;
delete process.env.ELEVENLABS_VOICE_ID;

// ── fake voice service: every request that is not to this Studio is answered here, never sent ──
const realFetch = globalThis.fetch;
let ttsCalls = 0;
globalThis.fetch = async (input, init) => {
  const u = String(input?.url ?? input);
  if (/^http:\/\/127\.0\.0\.1:/.test(u)) return realFetch(input, init);
  const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { "content-type": "application/json" } });
  if (u.includes("/v1/voices/")) return json({ voice_id: "fake", name: "fake", category: "cloned" });
  if (u.includes("/with-timestamps")) {
    ttsCalls++;
    const chars = [...JSON.parse(init.body).text];
    const step = 1.4 / Math.max(1, chars.length);
    return json({ audio_base64: mp3, alignment: { characters: chars, character_start_times_seconds: chars.map((_, i) => i * step), character_end_times_seconds: chars.map((_, i) => (i + 1) * step) } });
  }
  return new Response(Buffer.from(mp3, "base64"), { status: 200, headers: { "content-type": "audio/mpeg" } });
};

const { createServer } = await import("vite");
const vite = await createServer({ configFile: path.join(repo, "app", "vite.config.ts"), logLevel: "error", server: { port, strictPort: true, host: "127.0.0.1", hmr: false, watch: null } });
await vite.listen();
const origin = `http://127.0.0.1:${port}`;
const fails = [];
const ok = (cond, what) => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) fails.push(what); };
const api = async (method, route, body) => {
  const r = await realFetch(`${origin}/api/episodes/${EP}/${route}?channel=${CH}`, { method, headers: { origin, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw Error(`${method} ${route}: ${j?.error ?? r.status}`);
  return j;
};

let browser;
try {
  // the copy's preparation (signed with the copy's key; nothing of the owner's ledger is touched)
  const sp = await api("GET", "scene-production");
  if (!(sp.script?.approved && sp.storyboard?.approved))
    await api("POST", "approve-preparation", { reviewed: true, scriptSha256: sp.script.sha256, storyboardSha256: sp.storyboard.sha256, note: "QA copy" });
  process.env.ELEVENLABS_API_KEY = "fake-key-for-qa";
  process.env.ELEVENLABS_VOICE_ID = "fakevoice";
  let read = await api("GET", "sentences");
  const scene = read.scenes.find((s) => s.id === SCENE);
  if (!scene || scene.rows.length < 2) throw Error(`Scene ${SCENE} needs two sentences.`);
  for (const r of scene.rows) if (r.kind === "narration") read = (await api("POST", "sentences", { action: "tone", id: r.id, tone: "calm" })).read;
  // every sentence voiced (fake), so the scene's voice is composed and the preview plays it, as on the owner's Mac
  for (const r of read.scenes.find((s) => s.id === SCENE).rows) if (r.kind === "narration") await api("POST", "sentences", { action: "generate", id: r.id });
  read = await api("GET", "sentences");
  const s1 = read.scenes.find((s) => s.id === SCENE);
  ok(s1.audio.state === "sentences", `scene voice composed from its sentences (${s1.audio.state})`);

  // ── the media route as Safari asks for it ──
  const file = s1.rows[1].audio.file;
  const mediaUrl = `${origin}/api/episodes/${EP}/media/sentences/${encodeURIComponent(file)}?channel=${CH}`;
  const probe = await realFetch(mediaUrl, { headers: { range: "bytes=0-1" } });
  ok(probe.status === 206 && /^bytes 0-1\/\d+$/.test(probe.headers.get("content-range") ?? "") && probe.headers.get("accept-ranges") === "bytes" && probe.headers.get("content-type") === "audio/mpeg",
    `Safari probe bytes=0-1 → ${probe.status} ${probe.headers.get("content-range")} ${probe.headers.get("accept-ranges")} ${probe.headers.get("content-type")}`);

  browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    // every sentence <audio> (new Audio(url)) reports how far it got
    window.__heard = [];
    const OA = window.Audio;
    window.Audio = function (u) {
      const a = new OA(u);
      const rec = { src: String(u), ended: false, played: false };
      window.__heard.push(rec);
      a.addEventListener("playing", () => { rec.played = true; });
      a.addEventListener("ended", () => { rec.ended = true; });
      return a;
    };
  });
  const open = async () => {
    await page.goto(`${origin}/?link#/${CH}/${EP}/episode/${SCENE}`);
    await page.waitForSelector(".sv-pc button", { timeout: 30_000 });
    await page.waitForTimeout(2500);
    await page.locator('button[aria-label^="الجملة ٢"]').first().click();
    await page.waitForTimeout(300);
  };
  const playBtn = () => page.locator(".sv-pc button").first();
  const previewPlaying = () => page.locator(".ms-pc-play").first().getAttribute("aria-label").then((l) => l === "أوقف").catch(() => false);
  const playOnce = async (what) => {
    const before = await page.evaluate(() => window.__heard.length);
    const wasPlaying = await previewPlaying();
    await playBtn().click();
    await page.waitForFunction((n) => window.__heard.length > n && window.__heard.at(-1).ended, before, { timeout: 8000 }).catch(() => {});
    const last = await page.evaluate(() => window.__heard.at(-1));
    ok(Boolean(last?.ended), `${what}: sentence heard to its end${wasPlaying ? " (preview was playing)" : ""} [${last ? last.src.split("/").pop().split("?")[0] : "no audio"}]`);
    return last?.src;
  };
  const generate = async () => {
    await page.getByRole("button", { name: /ولّد الجملة|أعد التوليد/ }).first().click();
    await page.waitForFunction(() => !document.body.innerText.includes("جارٍ التوليد"), null, { timeout: 30_000 });
    await page.waitForTimeout(1500);
  };

  await open();
  ok(await previewPlaying(), "scene preview autoplays with the composed voice (the case of the report)");
  await generate();
  const a = await playOnce("generate → play");
  await page.waitForTimeout(400);
  const b = await playOnce("→ play again");
  ok(a === b, "the same take both times");
  await generate(); await generate();
  const c = await playOnce("generate twice → play");
  ok(c !== a, "the newest take is played after generating again");
  await page.waitForTimeout(400);
  await playOnce("→ play again");
  if (shots) { await mkdir(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, "sentence-replay.png") }); }
  await page.reload();
  await open();
  await playOnce("reload → play");
  // the preview unmuted and playing, then the sentence
  const unmute = page.locator('.ms-pc button[aria-label="أعد الصوت"]').first();
  if (await unmute.count()) await unmute.click();
  if (!(await previewPlaying())) await page.locator(".ms-pc-play").first().click();
  await page.waitForTimeout(800);
  await playOnce("preview unmuted and playing → play");
  ok(!(await previewPlaying()), "the preview paused itself for the sentence");
  ok(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  ok(ttsCalls > 0, `fake voice answered ${ttsCalls} requests (none sent out)`);
} catch (e) {
  fails.push(String(e?.message ?? e));
  console.error("FAIL", e);
} finally {
  await browser?.close();
  await vite.close();
  await rm(root, { recursive: true, force: true });
}
console.log(fails.length ? `\n${fails.length} failed` : "\nall passed");
process.exit(fails.length ? 1 : 0);
