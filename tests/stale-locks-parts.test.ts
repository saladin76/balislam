/** QA M1 (stale preview-index lock) and M2 (stale Drive .part files), 10 Nov 2026. */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { PREVIEW_LOCK_BUSY, withPreviewIndexLock } from "../src/render/episodePreviews";
import { cleanStaleParts, hostTag, partFileFor } from "../src/io/partFiles";
import { processStartTime } from "../src/io/processLock";

const deadPid = () => Number(spawnSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"], { encoding: "utf8" }).stdout);
const owner = (pid: number, start: string | null) => JSON.stringify({ pid, start, host: os.hostname(), token: "t", purpose: "preview index", at: "" });
const UUID = "0b8c2f3e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";

describe("preview index lock (M1)", () => {
  it("recovers a crashed writer's lock, an ownerless old lock, and waits on (never removes) a live one", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "plock-"));
    const lock = path.join(dir, ".preview-index.lock");
    try {
      mkdirSync(lock); writeFileSync(path.join(lock, "owner.json"), owner(deadPid(), null));
      expect(await withPreviewIndexLock(dir, async () => "ok")).toBe("ok");
      expect(existsSync(lock)).toBe(false);

      mkdirSync(lock); // an older build's lock (no owner file), left an hour ago
      const old = new Date(Date.now() - 3_600_000); utimesSync(lock, old, old);
      expect(await withPreviewIndexLock(dir, async () => "ok2")).toBe("ok2");

      const live = owner(process.ppid, processStartTime(process.ppid));
      mkdirSync(lock); writeFileSync(path.join(lock, "owner.json"), live);
      await expect(withPreviewIndexLock(dir, async () => "never", 300)).rejects.toThrow(PREVIEW_LOCK_BUSY);
      expect(readFileSync(path.join(lock, "owner.json"), "utf8")).toBe(live);
      rmSync(lock, { recursive: true });
      mkdirSync(lock); // a fresh ownerless lock (being created right now): not recovered
      await expect(withPreviewIndexLock(dir, async () => "never", 300)).rejects.toThrow(PREVIEW_LOCK_BUSY);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe("Drive .part cleanup (M2)", () => {
  it("removes only this machine's crashed parts and old legacy parts", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "parts-"));
    try {
      const mine = path.basename(partFileFor(path.join(dir, "master.mp4")));
      expect(mine).toMatch(new RegExp(`^\\.master\\.mp4\\.${hostTag()}-${process.pid}-`));
      const crashed = `.master.mp4.${hostTag()}-${deadPid()}-${UUID}.part`;
      const liveOther = `.short-1.mp4.${hostTag()}-${process.ppid}-${UUID}.part`;
      const otherHost = `.thumb.png.${hostTag("another-mac")}-${deadPid()}-${UUID}.part`;
      const legacyOld = `.notes.txt.${UUID}.part`;
      const legacyNew = `.manifest.json.${UUID}.part`;
      const unrelated = "master.mp4";
      for (const f of [mine, crashed, liveOther, otherHost, legacyOld, legacyNew, unrelated]) writeFileSync(path.join(dir, f), "x");
      const old = new Date(Date.now() - 2 * 24 * 3_600_000); utimesSync(path.join(dir, legacyOld), old, old);
      expect((await cleanStaleParts(dir)).sort()).toEqual([crashed, legacyOld].sort());
      for (const f of [mine, liveOther, otherHost, legacyNew, unrelated]) expect(existsSync(path.join(dir, f))).toBe(true);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
