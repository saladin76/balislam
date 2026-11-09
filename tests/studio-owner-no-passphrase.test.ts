/**
 * Owner decision (9 Nov 2026, «اجعله بدون كلمة سر»; supersedes D49): the Studio asks for no passphrase.
 * A Studio request whose real socket address is loopback and that passes the same-origin checks IS the
 * owner; anything else is refused (403). The ledger stays signed with the machine key and tampering is
 * still detected; every other gate is unchanged. All keys below are test fixtures in a temporary folder.
 */
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { balApi } from "../app/server/api";
import { assertSceneOwner, isOwnerAuthError } from "../src/studio/sceneService";
import { inStudioRequest, isLoopbackHost, runOwnerRequest } from "../src/studio/ownerContext";

const repo = path.resolve(import.meta.dirname, "..");
const CH = "balislam";
const EP = "986";
const EP_DIR = "986-owner-loopback";
const ENV_KEYS = ["BAL_CHANNELS_DIR", "BAL_ENV_FILE", "BAL_WORKFLOW_HMAC_KEY", "BAL_STUDIO_OWNER_PASSPHRASE_SHA256", "BAL_DRIVE_PREVIEWS_DIR"];
const saved: Record<string, string | undefined> = {};
let root = "";
let epDir = "";
let vite: ViteDevServer;
let server: http.Server;
let port = 0;

/** A test-only header makes the server see another socket address (as if the request came over the LAN). */
const REMOTE = "x-test-remote-address";

beforeAll(async () => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  await mkdir(path.join(repo, "renders"), { recursive: true });
  root = await mkdtemp(path.join(repo, "renders", "owner-loopback-"));
  const chDir = path.join(root, CH);
  epDir = path.join(chDir, "episodes", EP_DIR);
  await mkdir(epDir, { recursive: true });
  for (const f of ["channel.json", "identity.json", "identity.default.json", "pronunciation.json"])
    await copyFile(path.join(repo, "channels", CH, f), path.join(chDir, f));
  process.env.BAL_CHANNELS_DIR = root;
  process.env.BAL_ENV_FILE = path.join(root, ".env");
  delete process.env.BAL_WORKFLOW_HMAC_KEY;
  delete process.env.BAL_DRIVE_PREVIEWS_DIR;
  // A passphrase hash left in an old .env is simply ignored now.
  process.env.BAL_STUDIO_OWNER_PASSPHRASE_SHA256 = "a".repeat(64);
  // An old sessions file is left alone and never read.
  await mkdir(path.join(root, ".studio"), { recursive: true });
  await writeFile(path.join(root, ".studio", "owner-sessions.json"), "{ not json");
  const narration = "الصبر مفتاح الفرج.";
  await writeFile(path.join(epDir, "script.md"),
    `---\ntitle: "المالك على جهازه"\ndomain: psychology\nepisode: "${EP}"\n---\n## الفصل 1 · تجربة\n${narration}\n`);
  await writeFile(path.join(epDir, "plan.json"), JSON.stringify({
    channel: CH, episode: EP, title: "المالك على جهازه",
    chapters: [{ number: 1, title: "تجربة", scenes: [{ id: "c1-s1", template: "big-question", line: 7, narration, sfx: [], props: { text: "الصبر" } }] }],
  }, null, 2));
  vite = await createServer({
    configFile: false, root: path.join(repo, "app"), logLevel: "error", appType: "custom",
    plugins: [balApi()],
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

type Res = { status: number; body: any };
/** Raw HTTP so the Host header can be set (fetch forbids it). */
const call = (method: string, route: string, body?: unknown, headers: Record<string, string> = {}): Promise<Res> =>
  new Promise((resolve, reject) => {
    const data = body !== undefined ? JSON.stringify(body) : undefined;
    // agent: false — a fresh socket per request (the fake address is set on the socket).
    const req = http.request({ agent: false, host: "127.0.0.1", port, method, path: `/api/${route}${route.includes("?") ? "&" : "?"}channel=${CH}`,
      headers: { ...(data ? { "content-type": "application/json", "content-length": Buffer.byteLength(data) } : {}), ...headers } }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (c) => { text += c; });
      res.on("end", () => { let parsed: any = text; try { parsed = JSON.parse(text); } catch { /* not json */ } resolve({ status: res.statusCode ?? 0, body: parsed }); });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
const same = () => ({ origin: `http://127.0.0.1:${port}`, "sec-fetch-site": "same-origin" });
const state = async () => (await call("GET", `episodes/${EP}/scene-production`)).body;
const decide = (cmd: Record<string, unknown>, headers: Record<string, string> = same()) =>
  call("POST", `episodes/${EP}/scene-production`, cmd, headers);

describe("no passphrase: the loopback, same-origin Studio request is the owner", { timeout: 120_000 }, () => {
  it("refuses a request from another address or another site with 403, and writes nothing", async () => {
    const s = await state();
    const cmd = { action: "approve-script", expectedSha256: s.script.sha256, confirmedWatched: true };
    for (const addr of ["192.168.1.20", "10.0.0.5", "::ffff:192.168.1.20", "fe80::1"]) {
      const r = await decide(cmd, { ...same(), [REMOTE]: addr });
      expect(r.status, addr).toBe(403);
    }
    expect((await decide(cmd, { origin: "https://evil.example" })).status).toBe(403);
    expect((await decide(cmd, { "sec-fetch-site": "cross-site" })).status).toBe(403);
    // DNS rebinding: a page on another name that resolves to 127.0.0.1 (Host and Origin are that name).
    expect((await decide(cmd, { host: `evil.example:${port}`, origin: `http://evil.example:${port}` })).status).toBe(403);
    expect((await decide(cmd, { host: `evil.example:${port}` })).status).toBe(403);
    // Policy edits (channel rules) follow the same single rule.
    expect((await call("PUT", "channel", { channel: {} }, { ...same(), [REMOTE]: "192.168.1.20" })).status).toBe(403);
    expect((await state()).script.approved).toBe(false);
  });

  it("approves directly by click (no header, no token), and the ledger is signed and verified", async () => {
    let s = await state();
    const ok = await decide({ action: "approve-script", expectedSha256: s.script.sha256, confirmedWatched: true });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.script.approved).toBe(true);
    // Every other gate is unchanged: order and the board record still refuse (409, not 403).
    s = await state();
    expect((await decide({ action: "approve-storyboard", expectedSha256: s.storyboard.sha256, confirmedWatched: true })).status).toBe(409);
    const board = await call("PUT", `episodes/${EP}/storyboard`, { action: "approve", auditNote: "راجعت اللوحة بصريًا: النص والتكوين والتوقيت مطابقة للسكريبت." }, same());
    expect(board.status, JSON.stringify(board.body)).toBe(200);
    s = await state();
    expect((await decide({ action: "approve-storyboard", expectedSha256: "0".repeat(64), confirmedWatched: true })).status).toBe(409);
    const sb = await decide({ action: "approve-storyboard", expectedSha256: s.storyboard.sha256, confirmedWatched: true });
    expect(sb.status, JSON.stringify(sb.body)).toBe(200);

    const ledgerFile = path.join(epDir, "scene-production.v1.json");
    const raw = await readFile(ledgerFile, "utf8");
    const ledger = JSON.parse(raw);
    expect(ledger.mac).toMatch(/^[a-f0-9]{64}$/);
    expect(ledger.history.every((h: { by: string }) => h.by === "owner")).toBe(true);
    // Tampering is still detected: a forged mac, or a changed decision under the old mac.
    await writeFile(ledgerFile, raw.replace(/"mac": "[a-f0-9]{64}"/, `"mac": "${"0".repeat(64)}"`));
    expect((await call("GET", `episodes/${EP}/scene-production`)).status).not.toBe(200);
    await writeFile(ledgerFile, raw.replace(/"by": "owner"/, `"by": "ownr"`));
    expect((await call("GET", `episodes/${EP}/scene-production`)).status).not.toBe(200);
    await writeFile(ledgerFile, raw);
    expect((await state()).storyboard.approved).toBe(true);
    // The machine key is still created locally in .env; no passphrase is written anywhere.
    const envText = await readFile(path.join(root, ".env"), "utf8");
    expect(envText).toMatch(/^BAL_WORKFLOW_HMAC_KEY=[a-f0-9]{64}$/m);
    expect(envText).not.toMatch(/PASSPHRASE/);
    // The old sessions file was not touched.
    expect(await readFile(path.join(root, ".studio", "owner-sessions.json"), "utf8")).toBe("{ not json");
  });

  it("the passphrase and session endpoints are gone", async () => {
    for (const [m, r] of [["GET", "owner-passphrase"], ["POST", "owner-passphrase"], ["POST", "owner-passphrase/check"], ["GET", "owner-session"], ["POST", "owner-session"], ["DELETE", "owner-session"]] as const)
      expect((await call(m, r, m === "GET" || m === "DELETE" ? undefined : { passphrase: "x" }, same())).status, `${m} ${r}`).toBe(404);
  });
});

describe("assertSceneOwner: one policy", () => {
  it("allows the owner's CLI (no Studio request) and a loopback same-origin request", () => {
    expect(inStudioRequest()).toBe(false);
    expect(() => assertSceneOwner()).not.toThrow();
    for (const remoteAddress of ["127.0.0.1", "::1", "::ffff:127.0.0.1"])
      expect(() => runOwnerRequest({ remoteAddress, sameOrigin: true, host: "127.0.0.1:4321" }, () => assertSceneOwner()), remoteAddress).not.toThrow();
    expect(() => runOwnerRequest({ remoteAddress: "::1", sameOrigin: true, host: "localhost:4321" }, () => assertSceneOwner())).not.toThrow();
  });

  it("refuses any other request with the owner-auth code (403)", () => {
    const refused = (facts: Parameters<typeof runOwnerRequest>[0]) => {
      try { runOwnerRequest(facts, () => assertSceneOwner()); return null; } catch (e) { return e; }
    };
    for (const remoteAddress of ["192.168.1.20", "10.0.0.5", "::ffff:192.168.1.20", "fe80::1", undefined]) {
      const e = refused({ remoteAddress, sameOrigin: true, host: "127.0.0.1:4321" });
      expect(e, String(remoteAddress)).toBeTruthy();
      expect(isOwnerAuthError(e)).toBe(true);
    }
    expect(isOwnerAuthError(refused({ remoteAddress: "127.0.0.1", sameOrigin: false, host: "127.0.0.1:4321" }))).toBe(true);
    for (const host of ["evil.example:4321", "", undefined, "192.168.1.20:4321"])
      expect(isOwnerAuthError(refused({ remoteAddress: "127.0.0.1", sameOrigin: true, host })), String(host)).toBe(true);
    expect(isLoopbackHost("[::1]:4321")).toBe(true);
  });

  it("no passphrase, token or browser storage is left in the code", () => {
    const grep = (pattern: string, ...paths: string[]) => {
      try { return execFileSync("git", ["grep", "-l", "-E", pattern, "--", ...paths], { cwd: repo, encoding: "utf8" }).trim(); }
      catch { return ""; }
    };
    expect(grep("x-studio-owner-token|bal\\.ownerSession|BAL_OWNER_PASSPHRASE|BAL_STUDIO_OWNER_PASSPHRASE_SHA256|owner-sessions\\.json", "src", "app/src", "app/server")).toBe("");
    expect(grep("localStorage", "app/src/api.ts")).toBe("");
  });
});
