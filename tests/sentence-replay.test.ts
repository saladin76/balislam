/**
 * إعادة تشغيل الجملة بعد توليدها (D105): بلاغ المالك ١٢ نوفمبر «لما أولّد جملة وأعيد تشغيلها مش بتشتغل».
 *
 * السبب: بعد التوليد يُركَّب صوت المشهد، فتعمل معاينة المشهد (Remotion Player، تلقائيًا وفي حلقة) ومعها عنصر صوت.
 * كان مشغّل الجمل يوقف عنصر الصوت وحده، والمشغّل يبقى «يعمل» فيعيد تشغيله فورًا؛ فيصل حدث «play» إلى مشغّل الجمل
 * فيوقف الجملة قبل أن تُسمع، في كل مرة. الآن: يُطلب من المشغّل نفسه أن يتوقف، والوسيط المكتوم لا يقطع الجملة.
 *
 * ومعه: مسار الوسائط يخدم تسجيل الجملة بمقاطع (206، Accept-Ranges) كما يطلبها Safari على الماك، وكل توليد اسم جديد.
 */
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { balApi } from "../app/server/api";
import { createSentencePlayer, type SentencePlayer } from "../app/src/workspace/sentencePlayer";
import { SOLO_AUDIO_EVENT } from "../app/src/ui/soloAudio";

class FakeAudio {
  static all: FakeAudio[] = [];
  src: string; currentTime = 0; duration = 2; readyState = 4; paused = true; plays = 0;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private ls: Record<string, ((e: unknown) => void)[]> = {};
  constructor(url: string) { this.src = url; FakeAudio.all.push(this); }
  play() { this.paused = false; this.plays++; return Promise.resolve(); }
  pause() { this.paused = true; }
  addEventListener(t: string, f: (e: unknown) => void) { (this.ls[t] ??= []).push(f); }
  removeEventListener(t: string, f: (e: unknown) => void) { this.ls[t] = (this.ls[t] ?? []).filter((x) => x !== f); }
  end() { this.currentTime = this.duration; this.paused = true; this.onended?.(); }
}

/**
 * A page with the scene preview as Remotion runs it: a Player that stays «playing» and puts its <audio> back on
 * at once when someone pauses only the element, unless the Player itself is paused (the solo-audio request).
 */
const pageWithPreview = (opts: { muted?: boolean } = {}) => {
  const ls: Record<string, ((e: { target: unknown }) => void)[]> = {};
  const fire = (t: string, target: unknown) => (ls[t] ?? []).forEach((f) => f({ target }));
  const preview = { playing: true, solo: 0 };
  const el = {
    paused: false, muted: Boolean(opts.muted), volume: 1,
    pause() {
      this.paused = true;
      // Remotion's sync: the Player still plays, so the element is played again right away
      if (preview.playing) queueMicrotask(() => { el.paused = false; fire("play", el); });
    },
  };
  const doc = {
    querySelectorAll: () => [el],
    addEventListener: (t: string, f: (e: { target: unknown }) => void) => { (ls[t] ??= []).push(f); },
    removeEventListener: (t: string, f: (e: { target: unknown }) => void) => { ls[t] = (ls[t] ?? []).filter((x) => x !== f); },
    dispatchEvent: (e: Event) => { if (e.type === SOLO_AUDIO_EVENT) { preview.solo++; preview.playing = false; el.paused = true; } fire(e.type, doc); return true; },
  } as unknown as Document;
  return { doc, el, preview, playOther: () => fire("play", el) };
};

const flush = () => new Promise((r) => setTimeout(r, 0));
let player: SentencePlayer;
const make = (doc: Document) => { player = createSentencePlayer({ createAudio: (u) => new FakeAudio(u) as never, doc, raf: () => 0, caf: () => {} }); return player; };
beforeEach(() => { FakeAudio.all = []; });

describe("إعادة تشغيل الجملة والمعاينة تعمل (D105)", () => {
  it("المعاينة بصوت تعمل: الجملة تُسمع حتى آخرها، ثم تُسمع مرة ثانية وثالثة", async () => {
    const page = pageWithPreview();
    const p = make(page.doc);
    for (let n = 1; n <= 3; n++) {
      expect(p.play("row:a", [{ id: "a", url: "/a-1.mp3" }])).toBe(true);
      await flush();
      expect(page.preview.playing).toBe(false);
      expect(p.state()?.key).toBe("row:a");
      const a = FakeAudio.all.at(-1)!;
      expect(a.paused).toBe(false);
      a.end();
      expect(p.state()).toBeNull();
      expect(FakeAudio.all).toHaveLength(n);
    }
    expect(page.preview.solo).toBe(3);
    p.dispose();
  });

  it("بعد توليد جديد: الملف الجديد يُشغَّل بعنصر جديد، لا العنصر القديم", async () => {
    const page = pageWithPreview();
    const p = make(page.doc);
    p.play("row:a", [{ id: "a", url: "/a-1.mp3" }]); await flush(); FakeAudio.all.at(-1)!.end();
    p.play("row:a", [{ id: "a", url: "/a-2.mp3" }]); await flush();
    expect(FakeAudio.all.map((x) => x.src)).toEqual(["/a-1.mp3", "/a-2.mp3"]);
    expect(p.state()?.key).toBe("row:a");
    p.dispose();
  });

  it("معاينة مكتومة تبدأ لا تقطع الجملة؛ وسيط يُسمع يبدأ يقطعها (صوت واحد في الصفحة)", async () => {
    const muted = pageWithPreview({ muted: true });
    const p = make(muted.doc);
    p.play("row:a", [{ id: "a", url: "/a.mp3" }]); await flush();
    muted.playOther();
    expect(p.state()?.key).toBe("row:a");
    p.dispose();

    const loud = pageWithPreview();
    const q = make(loud.doc);
    q.play("row:a", [{ id: "a", url: "/a.mp3" }]); await flush();
    loud.playOther();
    expect(q.state()).toBeNull();
    q.dispose();
  });

  it("المشغّل في المعاينة يستمع لطلب التوقف (Preview.tsx)", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(path.resolve(import.meta.dirname, "../app/src/ui/Preview.tsx"), "utf8");
    expect(src).toMatch(/onSoloAudio\(/);
    expect(src).toMatch(/\.pause\(\)/);
  });
});

// ── مسار الوسائط: تسجيل الجملة بمقاطع كما يطلبها Safari ──
const repo = path.resolve(import.meta.dirname, "..");
const CH = "balislam";
let root = "";
let vite: ViteDevServer;
let server: http.Server;
let base = "";
const saved: Record<string, string | undefined> = {};
const ENV_KEYS = ["BAL_CHANNELS_DIR", "BAL_ENV_FILE", "BAL_WORKFLOW_HMAC_KEY"];
const BYTES = Buffer.from(Array.from({ length: 1000 }, (_, i) => i % 256));

beforeAll(async () => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  await mkdir(path.join(repo, "renders"), { recursive: true });
  root = await mkdtemp(path.join(repo, "renders", "sentence-replay-"));
  const epDir = path.join(root, CH, "episodes", "984-replay");
  await mkdir(path.join(epDir, "voice", "sentences"), { recursive: true });
  for (const f of ["channel.json", "identity.json", "identity.default.json", "pronunciation.json"])
    await copyFile(path.join(repo, "channels", CH, f), path.join(root, CH, f));
  await writeFile(path.join(epDir, "script.md"), `---\ntitle: "اختبار"\nepisode: "984"\n---\n## الفصل 1 · تجربة\nنَصٌّ.\n`);
  await writeFile(path.join(epDir, "voice", "sentences", "t1-abc-mwdo1.mp3"), BYTES);
  process.env.BAL_CHANNELS_DIR = root;
  process.env.BAL_ENV_FILE = path.join(root, ".env");
  process.env.BAL_WORKFLOW_HMAC_KEY = "LOCAL_TEST_ONLY__sentence_replay_signing_key_2026";
  await writeFile(process.env.BAL_ENV_FILE, "");
  vite = await createServer({
    configFile: false, root: path.join(repo, "app"), logLevel: "error", appType: "custom", plugins: [balApi()],
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

describe("GET /api/episodes/<ep>/media/sentences/<file> بمقاطع (Safari)", () => {
  const url = () => `${base}/api/episodes/984/media/sentences/t1-abc-mwdo1.mp3?channel=${CH}`;
  const get = (range?: string) => fetch(url(), { headers: { "sec-fetch-dest": "audio", "sec-fetch-site": "same-origin", ...(range ? { range } : {}) } });

  it("بلا Range: 200 بالملف كله ونوعه وAccept-Ranges وبلا ذاكرة مؤقتة", async () => {
    const r = await get();
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("audio/mpeg");
    expect(r.headers.get("accept-ranges")).toBe("bytes");
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("content-length")).toBe("1000");
    expect(Buffer.from(await r.arrayBuffer()).equals(BYTES)).toBe(true);
  });

  it("bytes=0-1 (أول ما يطلبه Safari): 206 ببايتين وContent-Range", async () => {
    const r = await get("bytes=0-1");
    expect(r.status).toBe(206);
    expect(r.headers.get("content-range")).toBe("bytes 0-1/1000");
    expect(r.headers.get("content-length")).toBe("2");
    expect([...Buffer.from(await r.arrayBuffer())]).toEqual([0, 1]);
  });

  it("bytes=500- وbytes=-100 ونهاية بعد الحجم: 206 بالحدود الصحيحة؛ وبداية بعد الحجم 416", async () => {
    const open = await get("bytes=500-");
    expect(open.status).toBe(206);
    expect(open.headers.get("content-range")).toBe("bytes 500-999/1000");
    expect((await open.arrayBuffer()).byteLength).toBe(500);
    const suffix = await get("bytes=-100");
    expect(suffix.headers.get("content-range")).toBe("bytes 900-999/1000");
    expect((await suffix.arrayBuffer()).byteLength).toBe(100);
    const over = await get("bytes=990-5000");
    expect(over.headers.get("content-range")).toBe("bytes 990-999/1000");
    const bad = await get("bytes=2000-");
    expect(bad.status).toBe(416);
    expect(bad.headers.get("content-range")).toBe("bytes */1000");
  });

  it("التشغيل الثاني يطلب الملف نفسه فيصل كاملًا مرة أخرى", async () => {
    for (let i = 0; i < 2; i++) {
      const r = await get("bytes=0-");
      expect(r.status).toBe(206);
      expect((await r.arrayBuffer()).byteLength).toBe(1000);
    }
  });
});
