/** QA 10 Nov 2026: atomic JSON (M3), Arabic counting, host render slots, notes retry timer. */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isJsonFileError, JsonFileError, readJsonFile, writeJsonAtomic } from "../src/io/atomicJson";
import { arabicCount, FILES, OTHER_FILES } from "../src/i18n/count";
import { loadLedger } from "../src/script/review";

const dirs: string[] = [];
const tmp = () => { const d = mkdtempSync(path.join(os.tmpdir(), "rio-")); dirs.push(d); return d; };
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); vi.useRealTimers(); });

describe("atomic JSON (M3)", () => {
  it("writes via a temp file and leaves nothing behind", async () => {
    const d = tmp(); const f = path.join(d, "plan.json");
    await writeJsonAtomic(f, { a: 1 });
    await writeJsonAtomic(f, { a: 2 });
    expect(JSON.parse(readFileSync(f, "utf8"))).toEqual({ a: 2 });
    expect(readdirSync(d)).toEqual(["plan.json"]);
  });
  it("a reader retries once (a writer finishing meanwhile), then gives an Arabic error", async () => {
    const d = tmp(); const f = path.join(d, "index.json");
    expect(await readJsonFile(f)).toBeNull();
    writeFileSync(f, '{"a":');
    setTimeout(() => writeFileSync(f, '{"a":1}'), 20);
    expect(await readJsonFile(f, 120)).toEqual({ a: 1 });
    writeFileSync(f, '{"a":');
    const err = await readJsonFile(f, 5).catch((e: JsonFileError) => e) as JsonFileError;
    expect(err).toBeInstanceOf(JsonFileError);
    expect(isJsonFileError(err)).toBe(true);
    expect(err.message).toMatch(/index\.json.*غير مكتمل أو تالف/);
  });
  it("a damaged review.json is never read as an empty ledger (which a decision would then overwrite)", async () => {
    const d = tmp();
    writeFileSync(path.join(d, "script.md"), "# x\n");
    writeFileSync(path.join(d, "review.json"), '{"version":1,"items":{"q1":');
    await expect(loadLedger(path.join(d, "script.md"))).rejects.toThrow(/review\.json/);
  });
});

describe("Arabic counting", () => {
  it("agrees the noun with the number", () => {
    expect([1, 2, 3, 10, 11, 99, 100, 101, 102, 103, 111].map((n) => arabicCount(n, OTHER_FILES))).toEqual([
      "ملف آخر", "ملفان آخران", "3 ملفات أخرى", "10 ملفات أخرى", "11 ملفًا آخر", "99 ملفًا آخر",
      "100 ملف آخر", "101 ملف آخر", "102 ملف آخر", "103 ملفات أخرى", "111 ملفًا آخر"]);
    expect(arabicCount(1, FILES)).toBe("ملف واحد");
    expect(arabicCount(5, FILES)).toBe("5 ملفات");
  });
});

describe("host render slots", () => {
  it("never deletes another live process's slot (even a half-written one); removes a dead one", async () => {
    const SLOTS = path.join(os.tmpdir(), "bal-render-slots");
    mkdirSync(SLOTS, { recursive: true });
    const { hostSlots } = await import("../src/render/pool");
    const dead = Number(spawnSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"], { encoding: "utf8" }).stdout);
    const tag = `t${process.pid}${Date.now()}`;
    const live = path.join(SLOTS, `${process.ppid}-${tag}1.json`);
    const half = path.join(SLOTS, `${process.ppid}-${tag}2.json`);
    const gone = path.join(SLOTS, `${dead}-${tag}3.json`);
    const oldBad = path.join(SLOTS, `${process.ppid}-${tag}4.json`);
    try {
      writeFileSync(live, JSON.stringify({ id: "x", pid: process.ppid, owner: process.ppid, estimateMB: 100 }));
      writeFileSync(half, '{"id":"x","pid":');
      writeFileSync(gone, JSON.stringify({ id: "y", pid: dead, owner: dead, estimateMB: 100 }));
      writeFileSync(oldBad, "{");
      const old = new Date(Date.now() - 3_600_000); utimesSync(oldBad, old, old);
      const seen = hostSlots.foreign();
      expect(seen.some((s) => s.pid === process.ppid)).toBe(true);
      expect(existsSync(live)).toBe(true);
      expect(existsSync(half)).toBe(true);
      expect(existsSync(gone)).toBe(false);
      expect(existsSync(oldBad)).toBe(false);
    } finally { for (const f of [live, half, gone, oldBad]) rmSync(f, { force: true }); }
  });
});

describe("owner notes retry timer", () => {
  it("retries every 10 minutes while notes are pending and stops after a successful send", async () => {
    vi.useFakeTimers();
    const { scheduleStudioNotesSync, notesRetryPending, NOTES_RETRY_MS } = await import("../src/studio/notesSync");
    expect(NOTES_RETRY_MS).toBe(600_000);
    const results = [
      { ok: false as const, reason: "offline" as const, message: "no network", notes: ["n1"] },
      { ok: false as const, reason: "offline" as const, message: "no network", notes: ["n1"] },
      { ok: true as const, pushed: true, commit: "abc", notes: ["n1"] },
    ];
    let calls = 0;
    const sync = async () => results[Math.min(calls++, results.length - 1)]!;
    await scheduleStudioNotesSync("/x", () => {}, { enabled: true, sync });
    expect(calls).toBe(1);
    expect(notesRetryPending()).toBe(true);
    await vi.advanceTimersByTimeAsync(NOTES_RETRY_MS);
    expect(calls).toBe(2);
    expect(notesRetryPending()).toBe(true);
    await vi.advanceTimersByTimeAsync(NOTES_RETRY_MS);
    expect(calls).toBe(3);
    expect(notesRetryPending()).toBe(false);
    await vi.advanceTimersByTimeAsync(NOTES_RETRY_MS * 3);
    expect(calls).toBe(3);
  });
});

describe("orphaned word-fix fragments", () => {
  it("moves unrecorded old fragments to voice/superseded/sentences; keeps recorded and fresh ones", async () => {
    const { sweepOrphanWordFixFragments } = await import("../src/voice/fragmentSweep");
    const voice = path.join(tmp(), "voice");
    mkdirSync(path.join(voice, "sentences"), { recursive: true });
    writeFileSync(path.join(voice, "sentences.json"), JSON.stringify({ version: 1, scenes: { "c1-s1": { fragments: [{ file: "tabc-frag-1.mp3" }] } } }));
    const old = new Date(Date.now() - 3_600_000);
    for (const f of ["tabc-frag-1.mp3", "tabc-frag-2.mp3", "tabc-fix-2.wav", "tabc-frag-3.mp3", "take.mp3"]) writeFileSync(path.join(voice, "sentences", f), f);
    for (const f of ["tabc-frag-1.mp3", "tabc-frag-2.mp3", "tabc-fix-2.wav", "take.mp3"]) utimesSync(path.join(voice, "sentences", f), old, old);
    expect((await sweepOrphanWordFixFragments(voice)).sort()).toEqual(["tabc-fix-2.wav", "tabc-frag-2.mp3"]);
    expect(readdirSync(path.join(voice, "sentences")).sort()).toEqual(["tabc-frag-1.mp3", "tabc-frag-3.mp3", "take.mp3"]);
    expect(readdirSync(path.join(voice, "superseded", "sentences")).sort()).toEqual(["tabc-fix-2.wav", "tabc-frag-2.mp3"]);
    // An unreadable sentences.json: nothing is touched.
    writeFileSync(path.join(voice, "sentences.json"), "{");
    utimesSync(path.join(voice, "sentences", "tabc-frag-3.mp3"), old, old);
    expect(await sweepOrphanWordFixFragments(voice)).toEqual([]);
  });
});
