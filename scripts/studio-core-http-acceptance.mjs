#!/usr/bin/env node
/**
 * Localhost HTTP acceptance for Studio Core on an isolated QA checkout.
 * Never writes to the real channels: only temporary copies of three configs.
 * No video rendering, no network APIs, no updates, no login credentials.
 *
 *   node scripts/studio-core-http-acceptance.mjs
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, statfsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ids = ["balislam", "dafatir-alzaman", "zubdat-alkutub"];
const originals = ids.map((id) => path.join(root, "channels", id, "channel.json"));
const queue = path.join(root, "renders", "studio-queue.json");
const vite = path.join(root, "node_modules", "vite", "bin", "vite.js");

const freeBytes = () => {
  const fs = statfsSync(root);
  return fs.bavail * fs.bsize;
};

const freePort = () => new Promise((resolve, reject) => {
  const server = createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    server.close((err) => err ? reject(err) : resolve(address.port));
  });
});

const stopChild = async (child) => {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  const deadline = Date.now() + 3000;
  while (child.exitCode === null && Date.now() < deadline) await delay(100);
  if (child.exitCode === null) child.kill("SIGKILL");
};

let fixture;
let server;
try {
  assert.ok(/^studio-core-channels-qa-/.test(path.basename(root)),
    "STOP: run only from the standalone studio-core-channels QA clone, never the main checkout");
  assert.ok(!existsSync(queue), "STOP: render queue exists; starting Vite could resume work");
  assert.ok(existsSync(vite), "STOP: install QA dependencies before acceptance");
  assert.ok(freeBytes() >= 6 * 1024 ** 3, "STOP: fewer than 6 GiB of disk free");

  fixture = await mkdtemp(path.join(os.tmpdir(), "studio-core-http-"));
  const channels = path.join(fixture, "channels");
  const temp = path.join(fixture, "temp");
  await mkdir(channels);
  await mkdir(temp);
  await writeFile(path.join(fixture, "empty.env"), "", { mode: 0o600 });

  const before = await Promise.all(originals.map((file) => readFile(file)));
  for (const id of ids) {
    const dst = path.join(channels, id);
    await mkdir(path.join(dst, "episodes"), { recursive: true });
    for (const name of ["channel.json", "identity.json", "identity.default.json"]) {
      await copyFile(path.join(root, "channels", id, name), path.join(dst, name));
    }
  }

  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const env = {
    ...process.env,
    BAL_CHANNELS_DIR: channels,
    BAL_ENV_FILE: path.join(fixture, "empty.env"),
    TMPDIR: temp,
    TMP: temp,
    TEMP: temp,
  };
  delete env.BAL_CHANNEL;
  server = spawn(process.execPath,
    [vite, "--config", "app/vite.config.ts", "--host", "127.0.0.1",
      "--port", String(port), "--strictPort"],
    { cwd: root, env, stdio: "ignore" });

  const request = (route, options = {}) => fetch(base + route, {
    ...options,
    signal: AbortSignal.timeout(10000),
  });
  let ready = false;
  for (let n = 0; n < 45; n++) {
    assert.equal(server.exitCode, null, "Studio server exited before it became ready");
    try {
      const res = await request("/api/channels");
      if (res.ok) { ready = true; break; }
    } catch { /* Startup only */ }
    await delay(250);
  }
  assert.ok(ready, "Studio API failed to start on isolated local port");

  const listing = await (await request("/api/channels")).json();
  for (const id of ids) {
    assert.ok(listing.some((x) => x.id === id && !x.error), `missing channel: ${id}`);
    const get = await request(`/api/channel?channel=${id}`);
    assert.equal(get.status, 200);
    assert.equal((await get.json()).id, id);
    assert.ok(get.headers.get("etag"));
  }
  console.log("PASS: three real HTTP channels isolated in temporary fixtures");

  const overview = await request("/api/ops?channel=balislam");
  assert.equal(overview.status, 200);
  const ops = await overview.json();
  for (const id of ids) assert.ok(ops.some((x) => x.channel?.id === id));
  console.log("PASS: operations room reads all three fixture channels");

  const endpoint = "/api/channel?channel=balislam";
  const get = await request(endpoint);
  const oldRevision = get.headers.get("etag");
  const original = await get.json();
  assert.ok(oldRevision && original.id === "balislam");

  const put = (channel, revision) => request(endpoint, {
    method: "PUT",
    headers: { "content-type": "application/json", "if-match": revision },
    body: JSON.stringify({ channel }),
  });
  const revised = { ...original, name: original.name + " [isolated HTTP QA]" };
  const saved = await put(revised, oldRevision);
  assert.equal(saved.status, 200, "valid conditional write must succeed");
  const updatedRevision = saved.headers.get("etag");
  assert.ok(updatedRevision && updatedRevision !== oldRevision, "ETag must advance");
  console.log("PASS: valid If-Match writes only the temporary channel copy");

  const stale = await put({ ...revised, name: "stale-clobber" }, oldRevision);
  assert.equal(stale.status, 409);
  const afterStale = await (await request(endpoint)).json();
  assert.equal(afterStale.name, revised.name);
  console.log("PASS: stale If-Match rejected with HTTP 409 without overwrite");

  const competingA = { ...revised, name: "HTTP race A" };
  const competingB = { ...revised, name: "HTTP race B" };
  const [a, b] = await Promise.all([
    put(competingA, updatedRevision),
    put(competingB, updatedRevision),
  ]);
  assert.deepEqual([a.status, b.status].sort((x, y) => x - y), [200, 409]);
  const winner = await (await request(endpoint)).json();
  assert.ok(["HTTP race A", "HTTP race B"].includes(winner.name));
  console.log("PASS: concurrent writers cannot both commit against one revision");

  const wrong = await request(endpoint, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ channel: { ...original, id: "dafatir-alzaman" } }),
  });
  assert.equal(wrong.status, 400);
  const blocked = await request(endpoint, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "origin": "https://evil.example",
      "sec-fetch-site": "cross-site",
    },
    body: "{}",
  });
  assert.equal(blocked.status, 403);
  console.log("PASS: ID mutation and cross-origin write rejected");

  const identityGet = await request("/api/identity?channel=balislam");
  assert.equal(identityGet.status, 200);
  const identityRevision = identityGet.headers.get("etag");
  const { identity } = await identityGet.json();
  assert.ok(identityRevision && identity?.themes && identity?.palettes);
  const changedIdentity = { ...identity, qaAcceptanceMarker: "temporary-only" };
  const identityPut = (revision) => request("/api/identity?channel=balislam", {
    method: "PUT",
    headers: { "content-type": "application/json", "if-match": revision },
    body: JSON.stringify({ identity: changedIdentity }),
  });
  assert.equal((await identityPut(identityRevision)).status, 200);
  assert.equal((await identityPut(identityRevision)).status, 409);
  console.log("PASS: identity save and stale identity conflict remain channel-scoped");

  for (let i = 0; i < originals.length; i++)
    assert.ok((await readFile(originals[i])).equals(before[i]), `original modified: ${ids[i]}`);
  for (const id of ids.slice(1)) {
    const file = path.join(channels, id, "channel.json");
    const originalFile = path.join(root, "channels", id, "channel.json");
    assert.ok((await readFile(file)).equals(await readFile(originalFile)),
      `foreign fixture channel modified: ${id}`);
  }
  console.log("PASS: all original files and both other channels remain byte-identical");
  console.log("ALL ISOLATED CORE HTTP WRITE ACCEPTANCE CHECKS PASSED");
} catch (error) {
  console.error("FAIL:", error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
} finally {
  await stopChild(server);
  if (fixture) await rm(fixture, { recursive: true, force: true });
}
