import { afterEach, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupOwnedAcceptanceTemp } from "../scripts/studio-acceptance-temp.mjs";

const owned: string[] = [];
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "studio-acceptance-cleanup-"));
  owned.push(root);
  const run = path.join(root, "run-one");
  const scratch = path.join(run, "temp");
  const peer = path.join(root, "run-peer");
  await mkdir(scratch, { recursive: true });
  await mkdir(peer);
  await writeFile(path.join(run, "acceptance.json"), '{"result":"FAIL"}');
  await writeFile(path.join(peer, "do-not-delete.txt"), "PEER EVIDENCE");
  return { root, run, scratch, peer };
}
afterEach(async () => {
  for (const root of owned.splice(0)) await rm(root, { recursive: true, force: true });
});

describe("isolated Mac acceptance scratch lifecycle", () => {
  it("removes only owned temp fixtures on failure without deleting the audit or another run", async () => {
    const { run, scratch, peer } = await fixture();
    const voice = path.join(scratch, "bal-voice-fixture");
    const rec = path.join(scratch, "bal-rec-fixture");
    await mkdir(voice);
    await mkdir(rec);
    await writeFile(path.join(voice, "sample.bin"), Buffer.alloc(1024 * 1024, 11));
    await writeFile(path.join(rec, "sample.bin"), Buffer.alloc(1024 * 1024, 22));
    // A symlink inside owned scratch must never be followed to peer evidence.
    await symlink(peer, path.join(scratch, "peer-link"), "dir");
    const r = await cleanupOwnedAcceptanceTemp(run, scratch);
    expect(r.before).toEqual(expect.arrayContaining(["bal-voice-fixture", "bal-rec-fixture", "peer-link"]));
    expect(r).toMatchObject({ clean: true, after: [] });
    expect(existsSync(scratch)).toBe(false);
    expect(await readFile(path.join(run, "acceptance.json"), "utf8")).toContain("FAIL");
    expect(await readFile(path.join(peer, "do-not-delete.txt"), "utf8")).toBe("PEER EVIDENCE");
  });
  it("rejects cleanup across runs and leaves unrelated content untouched", async () => {
    const { run, scratch, peer } = await fixture();
    await expect(cleanupOwnedAcceptanceTemp(run, peer)).rejects.toThrow(/ownership/);
    expect(existsSync(scratch)).toBe(true);
    expect(await readFile(path.join(peer, "do-not-delete.txt"), "utf8")).toBe("PEER EVIDENCE");
  });
  it("refuses a linked scratch root instead of deleting the link target", async () => {
    const { run, scratch, peer } = await fixture();
    await rm(scratch, { recursive: true });
    await symlink(peer, scratch, "dir");
    await expect(cleanupOwnedAcceptanceTemp(run, scratch)).rejects.toThrow(/ownership/);
    expect(await readFile(path.join(peer, "do-not-delete.txt"), "utf8")).toBe("PEER EVIDENCE");
  });
  it("repeated cycles release their own large scratch while preserving all reports", async () => {
    const { run, scratch } = await fixture();
    for (let cycle = 0; cycle < 3; cycle++) {
      if (cycle > 0) await mkdir(scratch);
      const fixtureDir = path.join(scratch, `bal-voice-cycle-${cycle}`);
      await mkdir(fixtureDir);
      await writeFile(path.join(fixtureDir, "audio.bin"), Buffer.alloc(512 * 1024));
      const result = await cleanupOwnedAcceptanceTemp(run, scratch);
      expect(result.clean).toBe(true);
      expect(existsSync(scratch)).toBe(false);
      expect(await readFile(path.join(run, "acceptance.json"), "utf8")).toContain("FAIL");
    }
  });

  it("parallel run cleanup never deletes a peer's scratch or its evidence", async () => {
    const { root, run, scratch, peer } = await fixture();
    const peerScratch = path.join(peer, "temp");
    await mkdir(peerScratch);
    await writeFile(path.join(scratch, "one.bin"), "ONE");
    await writeFile(path.join(peerScratch, "two.bin"), "TWO");
    const first = await cleanupOwnedAcceptanceTemp(run, scratch);
    expect(first.clean).toBe(true);
    expect(await readFile(path.join(peerScratch, "two.bin"), "utf8")).toBe("TWO");
    // A peer is allowed to finish independently, not be swept by run-one.
    const second = await cleanupOwnedAcceptanceTemp(peer, peerScratch);
    expect(second.clean).toBe(true);
    expect(await readFile(path.join(peer, "do-not-delete.txt"), "utf8")).toBe("PEER EVIDENCE");
    expect(existsSync(path.join(root, "run-one", "acceptance.json"))).toBe(true);
  });

});
