/**
 * Policy-changing endpoints need the owner (same credential as every owner action, D49 token OK);
 * an unknown channel answers 404, and no error the browser sees carries an absolute path.
 * All secrets below are test fixtures in a temporary folder.
 */
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { balApi } from "../app/server/api";
import { redactPaths } from "../app/server/util";
import { OWNER_SESSION_KEY } from "../app/src/api";
import { OWNER_SESSION_STORAGE_KEY } from "../app/src/shell/ownerSession";

const repo = path.resolve(import.meta.dirname, "..");
const CH = "balislam";
const PASS = "policy-endpoints-fixture-2026";
const ENV_KEYS = ["BAL_CHANNELS_DIR", "BAL_ENV_FILE", "BAL_WORKFLOW_HMAC_KEY", "BAL_STUDIO_OWNER_PASSPHRASE_SHA256", "BAL_OWNER_SESSIONS_FILE", "BAL_DRIVE_PREVIEWS_DIR"];
const saved: Record<string, string | undefined> = {};
let root = "";
let vite: ViteDevServer;
let server: http.Server;
let base = "";

const call = async (method: string, route: string, body?: unknown, token?: string, channel = CH) => {
  const r = await fetch(`${base}/api/${route}?channel=${channel}`, {
    method,
    headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(token ? { "x-studio-owner-token": token } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let parsed: any = text;
  try { parsed = JSON.parse(text); } catch { /* not json */ }
  return { status: r.status, body: parsed };
};

beforeAll(async () => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  await mkdir(path.join(repo, "renders"), { recursive: true });
  root = await mkdtemp(path.join(repo, "renders", "policy-endpoints-"));
  const chDir = path.join(root, CH);
  await mkdir(path.join(chDir, "episodes"), { recursive: true });
  for (const f of ["channel.json", "identity.json", "identity.default.json", "pronunciation.json"])
    await copyFile(path.join(repo, "channels", CH, f), path.join(chDir, f));
  process.env.BAL_CHANNELS_DIR = root;
  process.env.BAL_ENV_FILE = path.join(root, ".env");
  for (const k of ["BAL_OWNER_SESSIONS_FILE", "BAL_WORKFLOW_HMAC_KEY", "BAL_STUDIO_OWNER_PASSPHRASE_SHA256", "BAL_DRIVE_PREVIEWS_DIR"]) delete process.env[k];
  vite = await createServer({
    configFile: false, root: path.join(repo, "app"), logLevel: "error", appType: "custom",
    plugins: [balApi()],
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
  if (root) await rm(root, { recursive: true, force: true });
});

describe("policy-changing endpoints require the owner", () => {
  it("refuses PUT /api/channel, PUT /api/identity and POST /api/channels without the owner, accepts the session token", async () => {
    const channelFile = path.join(root, CH, "channel.json"), identityFile = path.join(root, CH, "identity.json");
    const channel = JSON.parse(await readFile(channelFile, "utf8"));
    const identity = JSON.parse(await readFile(identityFile, "utf8"));
    const before = [await readFile(channelFile, "utf8"), await readFile(identityFile, "utf8")];
    const loosened = { ...channel, rules: { ...channel.rules, faces: true } };
    const newChannel = { id: "policy-new", name: "جديدة", language: "ar", quran: true };

    // no passphrase yet, then no token, then a wrong token: all refused, nothing written
    for (const token of [undefined, "bos_" + "0".repeat(64), "wrong"]) {
      if (token === "bos_" + "0".repeat(64)) expect((await call("POST", "owner-passphrase", { passphrase: PASS })).body).toEqual({ set: true });
      const a = await call("PUT", "channel", { channel: loosened }, token);
      const b = await call("PUT", "identity", { identity }, token);
      const c = await call("POST", "channels", newChannel, token);
      for (const r of [a, b, c]) {
        expect(r.status).toBe(403);
        expect(r.body.error).toContain("جلسة المالك");
      }
    }
    expect([await readFile(channelFile, "utf8"), await readFile(identityFile, "utf8")]).toEqual(before);
    expect(existsSync(path.join(root, "policy-new"))).toBe(false);

    const opened = await call("POST", "owner-session", { passphrase: PASS });
    const token = opened.body.token as string;
    expect(token).toMatch(/^bos_[a-f0-9]{64}$/);
    expect((await call("PUT", "channel", { channel: loosened }, token)).status).toBe(200);
    expect(JSON.parse(await readFile(channelFile, "utf8")).rules.faces).toBe(true);
    expect((await call("PUT", "identity", { identity }, token)).status).toBe(200);
    expect((await call("POST", "channels", newChannel, token)).status).toBe(200);
    expect(existsSync(path.join(root, "policy-new", "channel.json"))).toBe(true);
    // reads stay open
    expect((await call("GET", "channel")).status).toBe(200);
  }, 60_000);

  it("the browser sends the token stored by the owner-session shell", () => {
    expect(OWNER_SESSION_KEY).toBe(OWNER_SESSION_STORAGE_KEY);
  });
});

describe("unknown channel and error hygiene", () => {
  it("answers 404 for an unknown channel and for a missing episode, with no absolute path", async () => {
    const r = await call("GET", "episodes", undefined, undefined, "no-such-channel");
    expect(r.status).toBe(404);
    expect(r.body.error).toContain("no-such-channel");
    const ep = await call("GET", "episodes/777");
    expect(ep.status).toBe(404);
    for (const res of [r, ep]) {
      expect(JSON.stringify(res.body)).not.toContain(repo);
      expect(JSON.stringify(res.body)).not.toContain(root);
    }
  }, 60_000);

  it("redacts absolute paths from error text", () => {
    const studio = "/Users/owner/balislam";
    expect(redactPaths(`ENOENT: open '${studio}/channels/x/plan.json'`, studio)).toBe("ENOENT: open 'channels/x/plan.json'");
    expect(redactPaths("cannot read /Users/owner/Desktop/secret.mp3 now", studio)).toBe("cannot read …/secret.mp3 now");
    expect(redactPaths("bad /home/someone/x/y.json", studio)).toBe("bad …/y.json");
    expect(redactPaths("C:\\Users\\owner\\a\\b.txt failed", "D:\\studio")).toBe("…\\b.txt failed");
    expect(redactPaths("الحلقة 001 غير موجودة", studio)).toBe("الحلقة 001 غير موجودة");
  });
});
