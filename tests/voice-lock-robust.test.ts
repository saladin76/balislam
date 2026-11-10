/**
 * QA H4 (10 Nov 2026): concurrent voice generation must never delete paid audio.
 * - one generateVoice per episode at a time (cross-process lockfile with PID + start time, stale recovery);
 * - voice/index.json written atomically and merged with what is on disk;
 * - unreferenced audio is moved to voice/superseded/, never deleted; files another writer made during the run are left alone;
 * - «جهّز كل المشاهد» holds the episode's busy key; it refuses while another job holds it.
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { encodeWav } from "../src/remotion/dafatir/audio/compose";
import { acquireLock, lockIsStale, processStartTime } from "../src/io/processLock";
import { prepareRunning, PREPARE_REFUSED_BUSY, startPrepareJob } from "../app/server/prepare";

let tmp = "";
const saved: Record<string, string | undefined> = {};
beforeAll(() => {
  for (const k of ["BAL_CHANNELS_DIR", "BAL_CHANNEL", "BAL_WORKFLOW_HMAC_KEY"]) saved[k] = process.env[k];
  tmp = mkdtempSync(path.join(os.tmpdir(), "voice-lock-"));
  cpSync(path.join("channels", "balislam"), path.join(tmp, "balislam"), { recursive: true, filter: (s) => !/[\\/](episodes|labs)([\\/]|$)/.test(s) });
  process.env.BAL_CHANNELS_DIR = tmp;
  process.env.BAL_WORKFLOW_HMAC_KEY = "a".repeat(64);
});
afterAll(() => {
  for (const [k, v] of Object.entries(saved)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  rmSync(tmp, { recursive: true, force: true });
});

const SR = 8000;
const mockClient = (delay: number, counter: { calls: number }) => ({
  modelId: "mock", voiceInfo: async () => null,
  tts: async (text: string) => {
    counter.calls++;
    await new Promise((r) => setTimeout(r, delay));
    const s = new Float32Array(SR / 4);
    for (let k = 0; k < s.length; k++) s[k] = Math.sin(k / (7 + (text.length % 5))) * 0.2;
    return { audio: Buffer.from(encodeWav(s, SR)), alignment: null, model: "mock" };
  },
  soundEffect: async () => Buffer.alloc(0), account: async () => ({}), voices: async () => [],
}) as any;

const makeEpisode = (num: string) => {
  const epDir = path.join(tmp, "balislam", "episodes", `${num}-lock`);
  mkdirSync(path.join(epDir, "voice"), { recursive: true });
  const lines = ["كَلِمَةٌ أُولَى.", "كَلِمَةٌ ثَانِيَةٌ.", "كَلِمَةٌ ثَالِثَةٌ.", "كَلِمَةٌ رَابِعَةٌ."];
  writeFileSync(path.join(epDir, "script.md"), `---\ntitle: "قفل"\nepisode: "${num}"\n---\n## الفصل 1 · تجربة\n${lines.join("\n")}\n`);
  writeFileSync(path.join(epDir, "plan.json"), JSON.stringify({ episode: num, title: "قفل", tone: "calm", chapters: [{ number: 1, title: "تجربة",
    scenes: lines.map((n, i) => ({ id: `c1-s${i + 1}`, template: "alley-tale", line: 6 + i, narration: n, sfx: [], props: {} })) }] }, null, 2));
  return epDir;
};

describe("voice lock and paid-audio safety (H4)", () => {
  it("a second concurrent run is refused with an Arabic message; the first run's audio and index survive", async () => {
    const epDir = makeEpisode("981");
    const { runWithChannel } = await import("../src/channel");
    const { generateVoice, VOICE_BUSY_MESSAGE } = await import("../src/voice/generate");
    const counter = { calls: 0 };
    const client = mockClient(1200, counter);
    const a = runWithChannel("balislam", () => generateVoice("981", { client, testOnlySkipGates: true, only: ["c1-s1", "c1-s2"] }));
    await new Promise((r) => setTimeout(r, 50));
    const b = runWithChannel("balislam", () => generateVoice("981", { client, testOnlySkipGates: true, only: ["c1-s3", "c1-s4"] }));
    const [ra, rb] = await Promise.allSettled([a, b]);
    expect(ra.status).toBe("fulfilled");
    expect(rb.status).toBe("rejected");
    expect((rb as PromiseRejectedResult).reason.message).toBe(VOICE_BUSY_MESSAGE);
    expect(counter.calls).toBe(2); // nothing paid for the refused run
    const index = JSON.parse(readFileSync(path.join(epDir, "voice", "index.json"), "utf8"));
    expect(Object.keys(index).sort()).toEqual(["c1-s1", "c1-s2"]);
    for (const clip of Object.values(index) as { file: string }[]) expect(existsSync(path.join(epDir, "voice", clip.file))).toBe(true);
    expect(existsSync(path.join(epDir, "voice", ".voice.lock"))).toBe(false);
    // The refused run, retried afterwards, succeeds and keeps the first run's clips.
    await runWithChannel("balislam", () => generateVoice("981", { client, testOnlySkipGates: true, only: ["c1-s3", "c1-s4"] }));
    const after = JSON.parse(readFileSync(path.join(epDir, "voice", "index.json"), "utf8"));
    expect(Object.keys(after).sort()).toEqual(["c1-s1", "c1-s2", "c1-s3", "c1-s4"]);
  }, 30_000);

  it("unknown audio is moved to voice/superseded (never deleted); a file written during the run by someone else is left alone; index entries written meanwhile are merged", async () => {
    const epDir = makeEpisode("983");
    const voice = path.join(epDir, "voice");
    writeFileSync(path.join(voice, "old-paid.mp3"), "old");
    const old = new Date(Date.now() - 3_600_000);
    utimesSync(path.join(voice, "old-paid.mp3"), old, old);
    const { runWithChannel } = await import("../src/channel");
    const { generateVoice } = await import("../src/voice/generate");
    const counter = { calls: 0 };
    const client = mockClient(300, counter);
    const run = runWithChannel("balislam", () => generateVoice("983", { client, testOnlySkipGates: true, only: ["c1-s1"] }));
    await new Promise((r) => setTimeout(r, 1300));
    // Another writer (e.g. the sentence path) adds a clip and its file in the middle of the run.
    writeFileSync(path.join(voice, "fresh-other.mp3"), "fresh");
    const disk = JSON.parse(readFileSync(path.join(voice, "index.json"), "utf8").trim() || "{}");
    // (index may not exist yet if the run is still before its first write)
    writeFileSync(path.join(voice, "index.json"), JSON.stringify({ ...disk, "c1-s4": { file: "fresh-other.mp3", hash: "x", text: "كَلِمَةٌ رَابِعَةٌ.", duration: 1, words: [] } }));
    await run;
    expect(existsSync(path.join(voice, "old-paid.mp3"))).toBe(false);
    expect(readFileSync(path.join(voice, "superseded", "old-paid.mp3"), "utf8")).toBe("old");
    expect(existsSync(path.join(voice, "fresh-other.mp3"))).toBe(true);
    const index = JSON.parse(readFileSync(path.join(voice, "index.json"), "utf8"));
    expect(Object.keys(index).sort()).toEqual(["c1-s1", "c1-s4"]);
    expect(readdirSync(voice).filter((f) => f.endsWith(".tmp"))).toEqual([]);
  }, 30_000);
});

describe("cross-process lock stale detection", () => {
  it("recovers a dead holder's lock and a reused PID; never a live holder's", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "plock-"));
    try {
      const file = path.join(dir, "x.lock");
      const dead = spawnSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"], { encoding: "utf8" });
      const deadPid = Number(dead.stdout);
      const host = os.hostname();
      writeFileSync(file, JSON.stringify({ pid: deadPid, start: "Thu Jan  1 00:00:00 1970", host, token: "t", purpose: "p", at: "" }));
      expect(lockIsStale(readFileSync(file, "utf8"))).toBe(true);
      const release = await acquireLock(file, { purpose: "test", busyMessage: "مشغول" });
      expect(JSON.parse(readFileSync(file, "utf8")).pid).toBe(process.pid);
      // A live holder (our parent) with its real start time: never stale.
      const parentStart = processStartTime(process.ppid);
      const live = JSON.stringify({ pid: process.ppid, start: parentStart, host, token: "t2", purpose: "p", at: "" });
      expect(lockIsStale(live)).toBe(false);
      // The same live PID but a different recorded start time = the PID was reused after a crash.
      if (parentStart) expect(lockIsStale(JSON.stringify({ pid: process.ppid, start: "Thu Jan  1 00:00:00 1970", host, token: "t3", purpose: "p", at: "" }))).toBe(true);
      // Another machine's lock (shared folder) is never guessed stale.
      expect(lockIsStale(JSON.stringify({ pid: deadPid, start: null, host: "other-host", token: "t4", purpose: "p", at: "" }))).toBe(false);
      await release();
      expect(existsSync(file)).toBe(false);
      // A live holder makes acquire fail with the given message, and its lock stays.
      writeFileSync(file, live);
      await expect(acquireLock(file, { purpose: "test", busyMessage: "مشغول الآن", waitMs: 100 })).rejects.toThrow("مشغول الآن");
      expect(readFileSync(file, "utf8")).toBe(live);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe("«جهّز كل المشاهد» and the episode busy key", () => {
  it("holds the key while running, refuses when another job holds it, and releases it at the end", async () => {
    const busy = new Set<string>();
    let finish!: () => void;
    const job = startPrepareJob("balislam/977", () => new Promise<void>((r) => { finish = r; }), busy);
    expect(job.status).toBe("running");
    expect(busy.has("balislam/977")).toBe(true);
    expect(prepareRunning("balislam/977")).toBe(true);
    await new Promise((r) => setTimeout(r, 5));
    finish();
    await new Promise((r) => setTimeout(r, 5));
    expect(job.status).toBe("done");
    expect(busy.has("balislam/977")).toBe(false);
    busy.add("balislam/978"); // e.g. an episode render
    expect(() => startPrepareJob("balislam/978", async () => {}, busy)).toThrow(PREPARE_REFUSED_BUSY);
  });
});
