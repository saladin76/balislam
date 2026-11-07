import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Plan } from "../src/plan/types";
import { snapshotFromFiles } from "../src/workflow/artifacts";
import { assertOwnerToken, assertWorkflowForEpisode, workflowOwnerDecision, workflowReadForEpisode, unsafeQuranRecitationScenes } from "../src/workflow/server";
import { runWithChannel } from "../src/channel";

const digest = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
const owned: string[] = [];
const fixture = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "studio-workflow-bridge-"));
  owned.push(root);
  const dir = path.join(root, "balislam", "episodes", "001-test");
  await mkdir(dir, { recursive: true });
  const script = path.join(dir, "script.md");
  await writeFile(script, "sample script v1");
  const scene = { id: "c1-s1", template: "noor-text", line: 1,
    props: { text: "Example" }, narration: "Script voice", tone: "calm", sfx: [] };
  const plan = { episode: "001", title: "Test", chapters: [{ number: 1, title: "First", scenes: [scene] }] } as unknown as Plan;
  return { root, dir, script, scene, plan };
};
afterEach(async () => {
  await Promise.all(owned.splice(0).map(r => rm(r, { recursive: true, force: true })));
});

describe("real-byte Studio workflow snapshots (read-only)", () => {
  it("binds source citations and signoff, retains visual approval through tone changes, hashes actual voice bytes", async () => {
    const x = await fixture();
    const first = await snapshotFromFiles(x.script, x.plan);
    expect(first.script).toBeTruthy();
    expect(first.storyboard).toBeTruthy();
    expect(first.voice).toBeTruthy();
    expect(first.motion).toBeUndefined();
    x.scene.tone = "dramatic";
    const changedTone = await snapshotFromFiles(x.script, x.plan);
    expect(changedTone.storyboard).toEqual(first.storyboard);
    expect(changedTone.voice?.sha256).not.toBe(first.voice?.sha256);
    x.scene.narration = "Rewritten narration after approval";
    const changedNarration = await snapshotFromFiles(x.script, x.plan);
    // Narration edits also change the visual storyboard content; tone alone does not.
    expect(changedNarration.storyboard).not.toEqual(changedTone.storyboard);
    expect(changedNarration.voice?.sha256).not.toBe(changedTone.voice?.sha256);
    await writeFile(path.join(x.dir, "review.json"), '{"items":{"citations":"new"}}');
    expect((await snapshotFromFiles(x.script, x.plan)).script?.sha256).not.toBe(first.script?.sha256);
    await writeFile(path.join(x.dir, "script.md"), "sample script v2");
    expect((await snapshotFromFiles(x.script, x.plan)).script?.sha256).not.toBe(changedTone.script?.sha256);
    await mkdir(path.join(x.dir, "voice"));
    await writeFile(path.join(x.dir, "voice", "index.json"), JSON.stringify({
      "c1-s1": { file: "clip.mp3", text: "Script voice", duration: 1, words: [] },
    }));
    await writeFile(path.join(x.dir, "voice", "clip.mp3"), "VOICE-V1");
    const voice1 = (await snapshotFromFiles(x.script, x.plan)).voice;
    await writeFile(path.join(x.dir, "voice", "clip.mp3"), "VOICE-V2");
    const voice2 = (await snapshotFromFiles(x.script, x.plan)).voice;
    expect(voice2?.sha256).not.toBe(voice1?.sha256);
    await mkdir(path.join(x.dir, "recitations"));
    await writeFile(path.join(x.dir, "recitations", "index.json"), JSON.stringify({
      "53:39": { provider: "alquran-cloud", parts: [{ file: "cloud.mp3", duration: 3 }] },
    }));
    await writeFile(path.join(x.dir, "recitations", "cloud.mp3"), "CLOUD-RECITATION-ORIGINAL");
    const originalCloud = (await snapshotFromFiles(x.script, x.plan)).voice?.sha256;
    await writeFile(path.join(x.dir, "recitations", "cloud.mp3"), "CLOUD-RECITATION-TAMPERED");
    expect((await snapshotFromFiles(x.script, x.plan)).voice?.sha256).not.toBe(originalCloud);
  });

  it("hashes the EXACT preview and Master bytes and never treats existence as an approval", async () => {
    const x = await fixture();
    await mkdir(path.join(x.dir, "out", "package"), { recursive: true });
    await mkdir(path.join(x.dir, "previews"), { recursive: true });
    await writeFile(path.join(x.dir, "out", "storyboard-motion.json"), "MOTION-V1");
    await writeFile(path.join(x.dir, "previews", "episode.mp4"), "INTEGRATED-REVIEW-V1");
    const masterFile = path.join(x.dir, "out", "package", "001-episode.mp4");
    await writeFile(masterFile, "MASTER-EXACT-V1");
    const first = await snapshotFromFiles(x.script, x.plan);
    expect(first.motion).toBeTruthy();
    expect(first.av_review?.sha256).toBe(digest("INTEGRATED-REVIEW-V1"));
    expect(first.master?.sha256).toBe(digest("MASTER-EXACT-V1"));
    await writeFile(masterFile, "MASTER-EXACT-V2");
    const next = await snapshotFromFiles(x.script, x.plan);
    expect(next.master?.sha256).toBe(digest("MASTER-EXACT-V2"));
    expect(next.av_review).toEqual(first.av_review);
    await rm(masterFile);
    await symlink(path.join(x.dir, "script.md"), masterFile);
    await expect(snapshotFromFiles(x.script, x.plan)).rejects.toThrow(/regular file/);
  });

  it("refuses any traversal or symlinked recording and missing plan cannot produce downstream fingerprints", async () => {
    const x = await fixture();
    const partial = await snapshotFromFiles(x.script, null);
    expect(Object.keys(partial)).toEqual(["script"]);
    await mkdir(path.join(x.dir, "voice"));
    await writeFile(path.join(x.dir, "voice", "index.json"), JSON.stringify({
      "c1-s1": { file: "../outside.mp3", text: "Fake" },
    }));
    await expect(snapshotFromFiles(x.script, x.plan)).rejects.toThrow(/Unsafe voice clip/);
    await writeFile(path.join(x.dir, "voice", "index.json"), JSON.stringify({
      "c1-s1": { file: "clip.mp3", text: "Fake" },
    }));
    await symlink(x.script, path.join(x.dir, "voice", "clip.mp3"));
    await expect(snapshotFromFiles(x.script, x.plan)).rejects.toThrow(/regular file/);
  });
});

describe("explicit authenticated owner decisions fail closed", () => {
  it("requires strong configured token; never accepts empty, wrong, or unconfigured credentials", () => {
    const key = "secret-owner-key-with-40-random-characters-2026";
    expect(() => assertOwnerToken(key, key)).not.toThrow();
    expect(() => assertOwnerToken("bad-token", key)).toThrow(/authentication/);
    expect(() => assertOwnerToken("", key)).toThrow(/authentication/);
    expect(() => assertOwnerToken(key, "")).toThrow(/not configured/);
  });

  it("submission does not grant approval, script changes reset review, publish stays blocked", async () => {
    const x = await fixture();
    const previousRoot = process.env.BAL_CHANNELS_DIR;
    const previousKey = process.env.BAL_STUDIO_OWNER_TOKEN;
    process.env.BAL_CHANNELS_DIR = x.root;
    process.env.BAL_STUDIO_OWNER_TOKEN = "studio-isolated-test-owner-token-1234567890";
    try {
      await runWithChannel("balislam", async () => {
        const before = await workflowReadForEpisode("001");
        expect(before.approvals.script?.status).toBe("draft");
        const expectedFingerprint = before.fingerprints.script!;
        const request = { stage: "script" as const, action: "submit" as const,
          expectedFingerprint, note: "This version has been submitted for human review." };
        await expect(workflowOwnerDecision("001", request, "bad")).rejects.toThrow(/authentication/);
        const submitted = await workflowOwnerDecision("001", request, process.env.BAL_STUDIO_OWNER_TOKEN);
        expect(submitted.approvals.script?.status).toBe("in_review");
        expect(submitted.approvals.script?.reviewer).toBeUndefined();
        await expect(workflowOwnerDecision("001", {
          ...request, action: "approve", confirmWatched: true,
        }, process.env.BAL_STUDIO_OWNER_TOKEN)).rejects.toThrow();
        await expect(assertWorkflowForEpisode("001", "publish")).rejects.toThrow();
        await writeFile(x.script, "changed during owner review");
        const after = await workflowReadForEpisode("001");
        expect(after.approvals.script?.status).toBe("draft");
        expect(after.fingerprints.script).not.toBe(expectedFingerprint);
      });
    } finally {
      if (previousRoot === undefined) delete process.env.BAL_CHANNELS_DIR;
      else process.env.BAL_CHANNELS_DIR = previousRoot;
      if (previousKey === undefined) delete process.env.BAL_STUDIO_OWNER_TOKEN;
      else process.env.BAL_STUDIO_OWNER_TOKEN = previousKey;
    }
  });
});

describe("Quran recitation rights preserve the owner's silent-card choice", () => {
  const plan = { chapters: [{ number: 1, title: "a", scenes: [{
    id: "c1-s1", template: "verse-card", ayahKey: "53:39", narration: "", props: { text: "verse" }, sfx: [],
  }] }] } as unknown as Plan;
  it("does not invent a recitation when none is selected", () => {
    expect(unsafeQuranRecitationScenes(plan, {}, false)).toEqual([]);
    expect(unsafeQuranRecitationScenes(plan, {}, true)).toEqual(["c1-s1"]);
  });
  it("rejects unproven licensed/Foundation files and accepts verified own or Cloud sources", () => {
    const media = (source: "licensed" | "quran-foundation" | "manual" | "alquran-cloud") => ({
      "53:39": { source, file: "verse.mp3", duration: 2 },
    });
    expect(unsafeQuranRecitationScenes(plan, media("licensed"), false)).toEqual(["c1-s1"]);
    expect(unsafeQuranRecitationScenes(plan, media("quran-foundation"), true)).toEqual(["c1-s1"]);
    expect(unsafeQuranRecitationScenes(plan, media("manual"), true)).toEqual([]);
    expect(unsafeQuranRecitationScenes(plan, media("alquran-cloud"), true)).toEqual([]);
  });
});
