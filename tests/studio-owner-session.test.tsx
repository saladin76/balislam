/**
 * D49 (owner decision, 9 Nov): the owner session stays open on the owner's device. The passphrase is
 * typed once; the server issues a revocable random token (only its HMAC is stored, in a git-ignored
 * local file); the browser keeps the token in localStorage. Every gate stays as strict: the token is a
 * credential only inside a loopback Studio HTTP request, never for the CLI or a direct service call.
 * All secrets below are test fixtures in a temporary folder.
 */
import { createHash, randomBytes } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { balApi } from "../app/server/api";
import { OWNER_SESSION_STORAGE_KEY, OwnerSessionProvider, useOwnerSession } from "../app/src/shell/ownerSession";
import { assertSceneOwner, openOwnerSession } from "../src/studio/sceneService";
import {
  ownerSessionCount, ownerSessionsFile, revokeOwnerSessionToken, runOwnerRequest,
} from "../src/studio/ownerSessions";
import { setOwnerPassphrase } from "../src/settings/env";

const repo = path.resolve(import.meta.dirname, "..");
const CH = "balislam";
const EP = "986";
const EP_DIR = "986-owner-session";
const PASS = "owner-session-fixture-2026";
const PASS2 = "owner-session-fixture-changed";
const ENV_KEYS = ["BAL_CHANNELS_DIR", "BAL_ENV_FILE", "BAL_WORKFLOW_HMAC_KEY", "BAL_STUDIO_OWNER_PASSPHRASE_SHA256", "BAL_OWNER_SESSIONS_FILE", "BAL_DRIVE_PREVIEWS_DIR"];
const saved: Record<string, string | undefined> = {};
let root = "";
let epDir = "";
let vite: ViteDevServer;
let server: http.Server;
let base = "";

const startStudio = async () => {
  vite = await createServer({
    configFile: false, root: path.join(repo, "app"), logLevel: "error", appType: "custom",
    plugins: [balApi()],
    server: { middlewareMode: true, hmr: false, watch: null, fs: { allow: [repo, root] } },
  });
  server = http.createServer(vite.middlewares);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
};
const stopStudio = async () => {
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  await vite?.close();
};
type Res = { status: number; body: any };
const call = async (method: string, route: string, body?: unknown, token?: string): Promise<Res> => {
  const r = await fetch(`${base}/api/${route}${route.includes("?") ? "&" : "?"}channel=${CH}`, {
    method,
    headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(token ? { "x-studio-owner-token": token } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let parsed: any = text;
  try { parsed = JSON.parse(text); } catch { /* not json */ }
  return { status: r.status, body: parsed };
};
const state = async () => (await call("GET", `episodes/${EP}/scene-production`)).body;
const decide = (cmd: Record<string, unknown>, token: string) => call("POST", `episodes/${EP}/scene-production`, cmd, token);

/** Every git-tracked file's text (to prove no token/passphrase leaked into the repository). */
const trackedContains = (needle: string): string[] => {
  const out = execFileSync("git", ["grep", "-l", "-F", needle, "--", ".", ":!tests/studio-owner-session.test.tsx"], { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  return out ? out.split("\n") : [];
};
const safeTrackedContains = (needle: string) => { try { return trackedContains(needle); } catch { return []; } };
const allText = async (dir: string): Promise<string> => {
  let acc = "";
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) acc += await allText(p);
    else acc += await readFile(p, "utf8").catch(() => "");
  }
  return acc;
};

beforeAll(async () => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  await mkdir(path.join(repo, "renders"), { recursive: true });
  root = await mkdtemp(path.join(repo, "renders", "owner-session-"));
  const chDir = path.join(root, CH);
  epDir = path.join(chDir, "episodes", EP_DIR);
  await mkdir(epDir, { recursive: true });
  for (const f of ["channel.json", "identity.json", "identity.default.json", "pronunciation.json"])
    await copyFile(path.join(repo, "channels", CH, f), path.join(chDir, f));
  process.env.BAL_CHANNELS_DIR = root;
  process.env.BAL_ENV_FILE = path.join(root, ".env");
  delete process.env.BAL_OWNER_SESSIONS_FILE;
  delete process.env.BAL_WORKFLOW_HMAC_KEY;
  delete process.env.BAL_STUDIO_OWNER_PASSPHRASE_SHA256;
  delete process.env.BAL_DRIVE_PREVIEWS_DIR;
  const narration = "الصبر مفتاح الفرج.";
  await writeFile(path.join(epDir, "script.md"),
    `---\ntitle: "جلسة المالك"\ndomain: psychology\nepisode: "${EP}"\n---\n## الفصل 1 · تجربة\n${narration}\n`);
  await writeFile(path.join(epDir, "plan.json"), JSON.stringify({
    channel: CH, episode: EP, title: "جلسة المالك",
    chapters: [{ number: 1, title: "تجربة", scenes: [{ id: "c1-s1", template: "big-question", line: 7, narration, sfx: [], props: { text: "الصبر" } }] }],
  }, null, 2));
  await startStudio();
}, 120_000);

afterAll(async () => {
  await stopStudio();
  for (const k of ENV_KEYS) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  if (root) await rm(root, { recursive: true, force: true });
});

describe("D49: persistent, device-bound owner session", { timeout: 120_000 }, () => {
  let token = "";

  it("is issued only after the correct passphrase, and only its HMAC is stored (git-ignored, beside .env)", async () => {
    // No passphrase yet: no session.
    expect((await call("POST", "owner-session", { passphrase: PASS })).body).toEqual({ ok: false });
    expect((await call("POST", "owner-passphrase", { passphrase: PASS })).body).toEqual({ set: true });
    expect((await call("POST", "owner-session", { passphrase: "wrong-passphrase" })).body).toEqual({ ok: false });
    expect((await call("POST", "owner-session", {})).body).toEqual({ ok: false });
    expect(ownerSessionCount()).toBe(0);
    const opened = await call("POST", "owner-session", { passphrase: PASS });
    expect(opened.status).toBe(200);
    expect(opened.body.ok).toBe(true);
    token = opened.body.token;
    expect(token).toMatch(/^bos_[a-f0-9]{64}$/);
    // A token cannot open another session (the passphrase is required to open one).
    expect((await call("POST", "owner-session", { passphrase: token })).body).toEqual({ ok: false });

    const file = ownerSessionsFile();
    expect(file).toBe(path.join(root, ".studio", "owner-sessions.json"));
    const text = await readFile(file, "utf8");
    expect(text).not.toContain(token);
    expect(text).not.toContain(token.slice(4));
    expect(text).not.toContain(createHash("sha256").update(token).digest("hex")); // keyed HMAC, not a plain hash
    expect(text).not.toContain(PASS);
    expect(() => execFileSync("git", ["check-ignore", "-q", ".studio/owner-sessions.json"], { cwd: repo, stdio: "ignore" })).not.toThrow();
    expect((await call("GET", "owner-session", undefined, token)).body).toEqual({ open: true });
  });

  it("decisions are accepted with the token after a refresh and a Studio restart; the ledger verifies the same way", async () => {
    let s = await state();
    // Studio restart: nothing about the session lives in memory.
    await stopStudio();
    await startStudio();
    expect((await call("GET", "owner-session", undefined, token)).body).toEqual({ open: true });
    s = await state();
    const viaToken = await decide({ action: "approve-script", expectedSha256: s.script.sha256 }, token);
    expect(viaToken.status, JSON.stringify(viaToken.body)).toBe(200);
    expect(viaToken.body.script.approved).toBe(true);

    // The next decision with the passphrase itself (still accepted): same ledger, same verification.
    const board = await call("PUT", `episodes/${EP}/storyboard`, { action: "approve", auditNote: "راجعت اللوحة بصريًا: النص والتكوين والتوقيت مطابقة للسكريبت." });
    expect(board.status, JSON.stringify(board.body)).toBe(200);
    s = await state();
    const viaPass = await decide({ action: "approve-storyboard", expectedSha256: s.storyboard.sha256 }, PASS);
    expect(viaPass.status, JSON.stringify(viaPass.body)).toBe(200);

    const ledgerFile = path.join(epDir, "scene-production.v1.json");
    const ledger = JSON.parse(await readFile(ledgerFile, "utf8"));
    expect(ledger.mac).toMatch(/^[a-f0-9]{64}$/);
    const [a, b] = ledger.history.slice(-2);
    expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort()); // a token decision is recorded exactly like a passphrase one
    // A reader re-verifies the signature: tampering breaks it for both kinds of entry.
    expect((await state()).storyboard.approved).toBe(true);
    const raw = await readFile(ledgerFile, "utf8");
    await writeFile(ledgerFile, raw.replace(/"mac": "[a-f0-9]{64}"/, `"mac": "${"0".repeat(64)}"`));
    expect((await call("GET", `episodes/${EP}/scene-production`)).status).not.toBe(200);
    await writeFile(ledgerFile, raw);
    expect((await state()).storyboard.approved).toBe(true);

    // Neither the token nor the passphrase is written into the episode, the ledger or any tracked file.
    const everything = await allText(path.join(root, CH));
    expect(everything).not.toContain(token);
    expect(everything).not.toContain(PASS);
    expect(safeTrackedContains(token)).toEqual([]);
    expect(safeTrackedContains(PASS)).toEqual([]);
  }, 120_000); // restarts the Studio server: slow under the full parallel suite

  it("a wrong or forged token is refused; a record written by hand is worthless without the machine key", async () => {
    const forged = `bos_${randomBytes(32).toString("hex")}`;
    expect((await decide({ action: "reset-assembly" }, forged)).status).toBe(403);
    expect((await decide({ action: "reset-assembly" }, `${token}0`)).status).toBe(403);
    expect((await decide({ action: "reset-assembly" }, token.toUpperCase())).status).toBe(403);
    const file = ownerSessionsFile();
    const doc = JSON.parse(await readFile(file, "utf8"));
    const before = JSON.stringify(doc);
    doc.sessions.push({ id: createHash("sha256").update(forged).digest("hex"), bind: doc.sessions[0].bind, createdAt: new Date().toISOString() });
    await writeFile(file, JSON.stringify(doc));
    expect((await call("GET", "owner-session", undefined, forged)).body).toEqual({ open: false });
    await writeFile(file, before);
  });

  it("the token is never a credential outside a loopback Studio request (CLI, direct calls, LAN)", () => {
    // Direct service call / CLI: only the passphrase counts.
    expect(() => assertSceneOwner(token)).toThrow(/authentication/);
    expect(() => assertSceneOwner(PASS)).not.toThrow();
    expect(() => openOwnerSession(PASS)).toThrow(/this device/);
    // Inside a loopback request it is accepted …
    expect(() => runOwnerRequest("127.0.0.1", () => assertSceneOwner(token))).not.toThrow();
    expect(() => runOwnerRequest("::1", () => assertSceneOwner(token))).not.toThrow();
    // … and refused from any other address, even with a valid token.
    for (const addr of ["192.168.1.20", "10.0.0.5", "::ffff:192.168.1.20", "fe80::1", undefined])
      expect(() => runOwnerRequest(addr, () => assertSceneOwner(token)), String(addr)).toThrow(/authentication/);
    expect(() => runOwnerRequest("192.168.1.20", () => openOwnerSession(PASS))).toThrow(/this device/);
  });

  it("«أغلق الجلسة» revokes the token on the server", async () => {
    const second = (await call("POST", "owner-session", { passphrase: PASS })).body.token as string;
    expect((await call("DELETE", "owner-session", undefined, second)).body).toEqual({ open: false });
    expect((await call("GET", "owner-session", undefined, second)).body).toEqual({ open: false });
    expect((await decide({ action: "reset-assembly" }, second)).status).toBe(403);
    // The first device session is unaffected.
    expect((await call("GET", "owner-session", undefined, token)).body).toEqual({ open: true });
    runOwnerRequest("127.0.0.1", () => revokeOwnerSessionToken("not-a-token")); // harmless
  });

  it("changing the passphrase revokes every session", async () => {
    const other = (await call("POST", "owner-session", { passphrase: PASS })).body.token as string;
    expect((await call("POST", "owner-passphrase", { passphrase: PASS2, current: PASS })).body).toEqual({ set: true });
    for (const t of [token, other]) {
      expect((await call("GET", "owner-session", undefined, t)).body).toEqual({ open: false });
      expect((await decide({ action: "reset-assembly" }, t)).status).toBe(403);
    }
    expect(ownerSessionCount()).toBe(0);
    // Even a sessions file restored from before the change is refused (bound to the old passphrase hash).
    const fresh = (await call("POST", "owner-session", { passphrase: PASS2 })).body.token as string;
    expect(fresh).toMatch(/^bos_/);
    const kept = await readFile(ownerSessionsFile(), "utf8");
    await setOwnerPassphrase(PASS, PASS2);
    await mkdir(path.dirname(ownerSessionsFile()), { recursive: true });
    await writeFile(ownerSessionsFile(), kept);
    expect((await call("GET", "owner-session", undefined, fresh)).body).toEqual({ open: false });
  });
});

describe("D49: the browser keeps the token, never the passphrase", () => {
  const Probe: React.FC = () => { const s = useOwnerSession(); return <span data-open={String(s.open)}>{s.secret ? "has-token" : "none"}</span>; };
  const withStorage = (items: Record<string, string>, fn: () => string) => {
    const g = globalThis as any;
    const prev = g.window;
    g.window = { localStorage: { getItem: (k: string) => items[k] ?? null, setItem: (k: string, v: string) => { items[k] = v; }, removeItem: (k: string) => { delete items[k]; } } };
    try { return fn(); } finally { if (prev === undefined) delete g.window; else g.window = prev; }
  };

  it("a new page (refresh) reads the stored token and shows the session open without asking", () => {
    const t = `bos_${"a1".repeat(32)}`;
    const html = withStorage({ [OWNER_SESSION_STORAGE_KEY]: t }, () => renderToStaticMarkup(<OwnerSessionProvider><Probe /></OwnerSessionProvider>));
    expect(html).toContain('data-open="true"');
    expect(html).toContain("has-token");
  });

  it("nothing stored, or something that is not a token (e.g. a passphrase), keeps the session closed", () => {
    for (const items of [{}, { [OWNER_SESSION_STORAGE_KEY]: PASS }] as Record<string, string>[]) {
      const html = withStorage(items, () => renderToStaticMarkup(<OwnerSessionProvider><Probe /></OwnerSessionProvider>));
      expect(html).toContain('data-open="false"');
    }
    // Blocked storage (private mode) does not crash the Studio.
    const g = globalThis as any;
    g.window = { get localStorage() { throw new Error("blocked"); } };
    try { expect(renderToStaticMarkup(<OwnerSessionProvider><Probe /></OwnerSessionProvider>)).toContain('data-open="false"'); }
    finally { delete g.window; }
  });

  it("the client never stores the passphrase: only the server's token goes to localStorage", async () => {
    const src = await readFile(path.join(repo, "app/src/shell/ownerSession.tsx"), "utf8");
    expect(src).toMatch(/storage\.set\(r\.token\)/);
    expect(src.match(/storage\.set\(/g)?.length).toBe(1);
  });
});
