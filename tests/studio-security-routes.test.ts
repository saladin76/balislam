import { browserPlanRevision } from "../src/plan/revision";
/**
 * Security QA (10 Nov) over the real Studio server:
 *  H1 — every response (HTML and API) refuses framing (X-Frame-Options DENY, CSP frame-ancestors 'none');
 *  H2 — EVERY mutating route goes through one middleware: loopback socket + loopback Host + a same-origin
 *       Origin or Sec-Fetch-Site; enumerated from the route names in app/server/api.ts and extra.ts;
 *  H6 — the direct approve-script / approve-storyboard routes carry the «اعتمد التجهيز» checks;
 *  M4 — PUT /plan keeps the designed-plan guard (D46) and writes a backup before overwriting;
 *  C1 — /api/voice-sample is owner-only and refuses Quran before any request to the voice service.
 * All keys below are test fixtures in a temporary folder; nothing reaches a paid service.
 */
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { balApi, studioSecurityHeaders } from "../app/server/api";
import { studioRequestRefusal } from "../app/server/security";
import { PREP_VALID_TAIL } from "./fixtures/prepValidScript";

const repo = path.resolve(import.meta.dirname, "..");
const CH = "balislam";
const EP = "984";
const EP_DIR = "984-security-routes";
const ENV_KEYS = ["BAL_CHANNELS_DIR", "BAL_ENV_FILE", "BAL_WORKFLOW_HMAC_KEY", "BAL_DRIVE_PREVIEWS_DIR", "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"];
const saved: Record<string, string | undefined> = {};
const REMOTE = "x-test-remote-address";
let root = "";
let epDir = "";
let vite: ViteDevServer;
let server: http.Server;
let port = 0;

const narration = "الصبر مفتاح الفرج.";
const scriptText = `---\ntitle: "حماية الاستوديو"\ndomain: psychology\nepisode: "${EP}"\n---\n## الفصل 1 · تجربة\n${narration}\n` + PREP_VALID_TAIL;
const planOf = (extra: Record<string, unknown>[] = []) => ({
  channel: CH, episode: EP, title: "حماية الاستوديو",
  chapters: [{ number: 1, title: "تجربة", scenes: [{ id: "c1-s1", template: "big-question", line: 7, narration, sfx: [], props: { text: "الصبر" } }, ...extra] }],
});

beforeAll(async () => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  await mkdir(path.join(repo, "renders"), { recursive: true });
  root = await mkdtemp(path.join(repo, "renders", "security-routes-"));
  const chDir = path.join(root, CH);
  epDir = path.join(chDir, "episodes", EP_DIR);
  await mkdir(epDir, { recursive: true });
  for (const f of ["channel.json", "identity.json", "identity.default.json", "pronunciation.json"])
    await copyFile(path.join(repo, "channels", CH, f), path.join(chDir, f));
  process.env.BAL_CHANNELS_DIR = root;
  process.env.BAL_ENV_FILE = path.join(root, ".env");
  delete process.env.BAL_WORKFLOW_HMAC_KEY;
  delete process.env.BAL_DRIVE_PREVIEWS_DIR;
  // Fixture values only: the Quran guard must refuse before any request is built.
  process.env.ELEVENLABS_API_KEY = "test-only-not-a-key";
  process.env.ELEVENLABS_VOICE_ID = "test-voice";
  await writeFile(path.join(epDir, "script.md"), scriptText);
  await writeFile(path.join(epDir, "plan.json"), JSON.stringify(planOf(), null, 2));
  vite = await createServer({
    configFile: false, root: path.join(repo, "app"), logLevel: "error", appType: "custom",
    plugins: [studioSecurityHeaders(), balApi()],
    server: { middlewareMode: true, hmr: false, watch: null, fs: { allow: [repo, root] } },
  });
  server = http.createServer((req, res) => {
    const fake = req.headers[REMOTE];
    if (typeof fake === "string") Object.defineProperty(req.socket, "remoteAddress", { value: fake, configurable: true });
    vite.middlewares(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
}, 120_000);

afterAll(async () => {
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  await vite?.close();
  for (const k of ENV_KEYS) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  if (root) await rm(root, { recursive: true, force: true });
});

type Res = { status: number; body: any; headers: http.IncomingHttpHeaders };
/** Raw HTTP so the Host header can be set (fetch forbids it); a fresh socket per request. */
const raw = (method: string, p: string, body?: unknown, headers: Record<string, string> = {}): Promise<Res> =>
  new Promise((resolve, reject) => {
    const data = body !== undefined ? JSON.stringify(body) : undefined;
    const req = http.request({ agent: false, host: "127.0.0.1", port, method, path: p,
      headers: { ...(data ? { "content-type": "application/json", "content-length": Buffer.byteLength(data) } : {}), ...headers } }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (c) => { text += c; });
      res.on("end", () => { let parsed: any = text; try { parsed = JSON.parse(text); } catch { /* not json */ } resolve({ status: res.statusCode ?? 0, body: parsed, headers: res.headers }); });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
const api = (method: string, route: string, body?: unknown, headers: Record<string, string> = {}) =>
  raw(method, `/api/${route}${route.includes("?") ? "&" : "?"}channel=${CH}`, body, headers);
const same = () => ({ origin: `http://127.0.0.1:${port}`, "sec-fetch-site": "same-origin" });

/** Every route name the two route files dispatch on, as /api/<name> and /api/episodes/<ep>/<name>. */
const enumerateRoutes = (): string[] => {
  const src = ["api.ts", "extra.ts"].map((f) => readFileSync(path.join(repo, "app", "server", f), "utf8")).join("\n");
  const top = [...new Set([...src.matchAll(/parts\[0\] === "([a-z0-9-]+)"/g)].map((m) => m[1]!))];
  const ep = [...new Set([...src.matchAll(/parts\[2\] === "([a-z0-9-]+)"/g)].map((m) => m[1]!))];
  return [...top.map((t) => t), `episodes`, `episodes/${EP}`, ...ep.map((e) => `episodes/${EP}/${e}`), `channel`, "settings/test", "voice-sample", "labs/x/storyboards/y/1/decision"];
};

describe("H1: no framing", { timeout: 60_000 }, () => {
  it("HTML, assets and API responses all carry X-Frame-Options DENY and CSP frame-ancestors 'none'", async () => {
    for (const r of [await raw("GET", "/index.html"), await raw("GET", "/src/main.tsx"), await api("GET", "episodes"), await api("POST", "ideas", {}, {})]) {
      expect(r.headers["x-frame-options"]).toBe("DENY");
      expect(String(r.headers["content-security-policy"])).toMatch(/(^|; )frame-ancestors 'none'$/);
    }
  });
  it("a request from a framing page on another site is refused", async () => {
    // What a page on evil.test that frames or fetches the Studio sends: its own Origin and cross-site.
    const framed = await api("DELETE", `episodes/${EP}/scene-prepare`, undefined, { origin: "http://evil.test:4801", "sec-fetch-site": "cross-site" });
    expect(framed.status).toBe(403);
    expect(framed.headers["x-frame-options"]).toBe("DENY");
  });
});

describe("H2: one middleware for every mutating route", () => {
  it("unit: the rule", () => {
    const ok = { method: "POST", headers: { host: "127.0.0.1:4321", origin: "http://127.0.0.1:4321" }, socket: { remoteAddress: "127.0.0.1" } };
    expect(studioRequestRefusal(ok)).toBeNull();
    expect(studioRequestRefusal({ ...ok, headers: { host: "127.0.0.1:4321", "sec-fetch-site": "same-origin" } })).toBeNull();
    expect(studioRequestRefusal({ ...ok, headers: { host: "127.0.0.1:4321" } })).not.toBeNull(); // neither Origin nor Sec-Fetch-Site
    expect(studioRequestRefusal({ ...ok, headers: { host: "127.0.0.1:4321", origin: "null" } })).not.toBeNull();
    expect(studioRequestRefusal({ ...ok, headers: { host: "127.0.0.1:4321", origin: "http://localhost:4321" } })).not.toBeNull(); // not same-origin
    expect(studioRequestRefusal({ ...ok, headers: { host: "evil.example:4321", origin: "http://evil.example:4321" } })).not.toBeNull();
    expect(studioRequestRefusal({ ...ok, socket: { remoteAddress: "192.168.1.20" } })).not.toBeNull();
    expect(studioRequestRefusal({ ...ok, headers: { ...ok.headers, "sec-fetch-site": "same-site" } })).not.toBeNull();
    expect(studioRequestRefusal({ method: "GET", headers: { host: "localhost:4321" }, socket: { remoteAddress: "127.0.0.1" } })).toBeNull();
    expect(studioRequestRefusal({ method: "GET", headers: { host: "evil.example" }, socket: { remoteAddress: "127.0.0.1" } })).not.toBeNull();
  });

  it("the refusal runs before any route handler in api.ts", () => {
    const src = readFileSync(path.join(repo, "app", "server", "api.ts"), "utf8");
    const guard = src.indexOf("studioRequestRefusal(req)");
    expect(guard).toBeGreaterThan(0);
    expect(guard).toBeLessThan(src.indexOf("handleExtra({"));
    expect(guard).toBeLessThan(src.indexOf('parts[0] === "episodes"'));
  });

  it("every route × every write method: 403 for foreign Host, missing Origin and Sec-Fetch-Site, non-loopback socket", async () => {
    const routes = enumerateRoutes();
    expect(routes.length).toBeGreaterThan(50);
    const before = await readFile(path.join(epDir, "plan.json"), "utf8");
    const cases: [string, Record<string, string>][] = [
      ["foreign Host", { host: `evil.example:${port}`, origin: `http://evil.example:${port}`, "sec-fetch-site": "same-origin" }],
      ["no Origin, no Sec-Fetch-Site", {}],
      ["non-loopback socket", { ...same(), [REMOTE]: "192.168.1.20" }],
      ["foreign Origin", { origin: "https://evil.example", "sec-fetch-site": "same-origin" }],
    ];
    const failures: string[] = [];
    for (const route of routes) for (const method of ["POST", "PUT", "PATCH", "DELETE"]) for (const [name, headers] of cases) {
      const r = await api(method, route, { confirm: EP, action: "x" }, headers);
      if (r.status !== 403) failures.push(`${method} /api/${route} (${name}) → ${r.status}`);
    }
    expect(failures).toEqual([]);
    expect(await readFile(path.join(epDir, "plan.json"), "utf8")).toBe(before);
    expect(existsSync(path.join(epDir, "plan.backup-last.json"))).toBe(false);
  }, 120_000);

  it("the owner's page itself still writes", async () => {
    const r = await api("PUT", "ideas", { ideas: [{ id: "qa", title: "فكرة" }] }, same());
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const r2 = await api("PUT", "ideas", { ideas: [] }, { "sec-fetch-site": "same-origin" });
    expect(r2.status, JSON.stringify(r2.body)).toBe(200);
  });
});

describe("C1: /api/voice-sample", { timeout: 60_000 }, () => {
  it("is owner-only and refuses Quran before any request to the voice service", async () => {
    expect((await api("POST", "voice-sample", { text: "الصبر مفتاح الفرج" }, {})).status).toBe(403);
    const r = await api("POST", "voice-sample", { text: "﴿قُلْ هُوَ اللَّهُ أَحَدٌ﴾" }, same());
    expect(r.status).toBe(400);
    expect(r.body.code).toBe("QURAN_TTS");
    expect((await api("POST", "voice-sample", { text: "[آية: الإخلاص 1]" }, same())).body.code).toBe("QURAN_TTS");
  });
});

describe("H6: direct script / storyboard approvals carry the preparation checks", { timeout: 60_000 }, () => {
  it("refuses without «راجعته بنفسي», with script errors, and a storyboard with a verse without its text", async () => {
    const s = (await api("GET", `episodes/${EP}/scene-production`)).body;
    const decide = (cmd: Record<string, unknown>) => api("POST", `episodes/${EP}/scene-production`, cmd, same());
    const noReview = await decide({ action: "approve-script", expectedSha256: s.script.sha256 });
    expect(noReview.status).toBe(409);
    expect(noReview.body.code).toBe("PREPARATION_CHECKS");
    await writeFile(path.join(epDir, "script.md"), `---\ntitle: "x"\ndomain: psychology\nepisode: "${EP}"\n---\n## الفصل 1 · تجربة\nقال تعالى ﴿وأن ليس للإنسان﴾\n`);
    const s2 = (await api("GET", `episodes/${EP}/scene-production`)).body;
    const errors = await decide({ action: "approve-script", reviewed: true, expectedSha256: s2.script.sha256 });
    expect(errors.status).toBe(409);
    expect(errors.body.error).toMatch(/script errors/);
    await writeFile(path.join(epDir, "script.md"), scriptText);
    await writeFile(path.join(epDir, "plan.json"), JSON.stringify(planOf([{ id: "c1-s2", template: "verse-card", ayahKey: "53:39", line: 9, narration: "", sfx: [], props: { text: "" } }]), null, 2));
    const s3 = (await api("GET", `episodes/${EP}/scene-production`)).body;
    const verse = await decide({ action: "approve-storyboard", reviewed: true, expectedSha256: s3.storyboard.sha256 });
    expect(verse.status).toBe(409);
    expect(verse.body.error).toMatch(/آية بلا نصها/);
    const ledger = path.join(epDir, "scene-production.json");
    expect(existsSync(ledger) ? JSON.parse(await readFile(ledger, "utf8")).history ?? [] : []).toEqual([]);
    await writeFile(path.join(epDir, "plan.json"), JSON.stringify(planOf(), null, 2));
  });
});

describe("M4: PUT /plan", { timeout: 60_000 }, () => {
  const designed = () => ({ ...planOf(), chapters: [{ number: 1, title: "تجربة", scenes: [
    { id: "c1-s1", template: "alley-tale", line: 7, narration, sfx: [], props: { shot: "market-gate", text: "الصبر" } }] }] });
  it("never replaces a designed plan with one that drops its design unless confirmed with the episode number; backs up first", async () => {
    await writeFile(path.join(epDir, "plan.json"), JSON.stringify(designed(), null, 2));
    const before = await readFile(path.join(epDir, "plan.json"), "utf8");
    const flat = planOf();
    const expectedRevision = await browserPlanRevision((await api("GET", `episodes/${EP}`)).body.plan);
    const refused = await api("PUT", `episodes/${EP}/plan`, { plan: flat, expectedRevision }, same());
    expect(refused.status).toBe(409);
    expect(refused.body.lost).toEqual(["c1-s1"]);
    expect(await readFile(path.join(epDir, "plan.json"), "utf8")).toBe(before);
    expect((await api("PUT", `episodes/${EP}/plan`, { plan: flat, expectedRevision, overwriteDesigned: true, confirmEpisode: "001" }, same())).status).toBe(409);

    // An ordinary edit of the designed plan (props) is saved, after the rolling backup.
    const edited = designed();
    edited.chapters[0]!.scenes[0]!.props.text = "الصبر جميل";
    const ok = await api("PUT", `episodes/${EP}/plan`, { plan: edited, expectedRevision }, same());
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(await readFile(path.join(epDir, "plan.backup-last.json"), "utf8")).toBe(before);

    // Explicit replacement with the episode number: a timestamped backup is written first.
    const forced = await api("PUT", `episodes/${EP}/plan`, { plan: flat, expectedRevision: ok.body.planRevision, overwriteDesigned: true, confirmEpisode: EP }, same());
    expect(forced.status, JSON.stringify(forced.body)).toBe(200);
    expect(forced.body.backup).toMatch(/^plan\.backup-.*\.json$/);
    const backups = (await readdir(epDir)).filter((f) => /^plan\.backup-\d/.test(f));
    expect(backups).toHaveLength(1);
    expect(JSON.parse(await readFile(path.join(epDir, backups[0]!), "utf8")).chapters[0].scenes[0].props.text).toBe("الصبر جميل");
  });
});

// Actual HTTP contract, independent of the client queue.
describe("plan revision conflict protection", () => {
  it("rejects missing revisions without touching the file", async () => {
    const before = await readFile(path.join(epDir, "plan.json"), "utf8");
    const current = (await api("GET", "episodes/" + EP)).body.plan;
    const result = await api("PUT", "episodes/" + EP + "/plan", { plan: current }, same());
    expect(result.status).toBe(409);
    expect(result.body.code).toBe("PLAN_REVISION_REQUIRED");
    expect(await readFile(path.join(epDir, "plan.json"), "utf8")).toBe(before);
  });
  it("accepts one simultaneous write and refuses its stale competitor", async () => {
    const current = (await api("GET", "episodes/" + EP)).body.plan;
    const expectedRevision = await browserPlanRevision(current);
    const results = await Promise.all(["one", "two"].map((title) => api("PUT", "episodes/" + EP + "/plan", {
      plan: { ...current, title }, expectedRevision,
    }, same())));
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(results.find((r) => r.status === 409)!.body.error).toContain("لم نكتب فوقها");
    const saved = (await api("GET", "episodes/" + EP)).body.plan;
    expect(saved.title).toBe(results[0]!.status === 200 ? "one" : "two");
  });
});
