import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { collectActualArtifactDigests, sha256File, type ArtifactManifest } from "../src/workflow/artifacts";
import { type WorkflowIdentity } from "../src/workflow/store";

process.env.BAL_WORKFLOW_HMAC_KEY = "LOCAL_TEST_ONLY__workflow_gates_256_bit_key_2026_testing";
const roots: string[] = [];
const stageEvidenceFile = {
  script: "script-review.json", storyboard: "storyboard-review.json",
  voice: "voice-review.json", motion: "motion-review.json",
  av_review: "av-review.json", master: "master-review.json",
} as const;
const fileByStage = {
  script: ["script.md", stageEvidenceFile.script],
  storyboard: ["storyboard.json", "images/shot.png", stageEvidenceFile.storyboard],
  voice: ["voice/clip.mp3", stageEvidenceFile.voice],
  motion: ["motion.mp4", stageEvidenceFile.motion],
  av_review: ["av.mp4", stageEvidenceFile.av_review],
};
const make = async (channel: WorkflowIdentity["channel"] = "balislam", episode = "001-demo") => {
  const channelsRoot = await mkdtemp(path.join(os.tmpdir(), "workflow-contract-"));
  roots.push(channelsRoot);
  const scope: WorkflowIdentity = { channelsRoot, channel, episode };
  const dir = path.join(channelsRoot, channel, "episodes", episode);
  await mkdir(path.join(dir, "voice"), { recursive: true });
  await mkdir(path.join(dir, "images"), { recursive: true });
  for (const name of new Set([...Object.values(fileByStage).flat(), ...Object.values(stageEvidenceFile), "master.mp4"])) {
    await writeFile(path.join(dir, name), name + ":V1");
  }
  const manifest: ArtifactManifest = {
    stages: Object.fromEntries(Object.entries(fileByStage).map(([stage, files]) => [stage, { version: stage + "-V1", files }])),
    master: { version: "master-V1", file: "master.mp4" },
  };
  return { scope, dir, manifest };
};
afterEach(async () => {
  await Promise.all(roots.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

// The trusted six-stage service (src/workflow/service.ts) was removed with the
// legacy workflow; only the live server-side artifact digest collector remains.
describe("server-side artifact digests", () => {
  it("builds stage hashes from owned files; changes to bytes invalidate the digest, Master is exact file SHA", async () => {
    const x = await make();
    const a = await collectActualArtifactDigests(x.scope, x.manifest);
    expect(a.master?.sha256).toBe(await sha256File(path.join(x.dir, "master.mp4")));
    await writeFile(path.join(x.dir, "script-review.json"), "UPDATED SOURCE REVIEW");
    const b = await collectActualArtifactDigests(x.scope, x.manifest);
    expect(a.script?.sha256).not.toBe(b.script?.sha256);
    expect(a.master?.sha256).toBe(b.master?.sha256);
    expect(a.voice?.sha256).toBe(b.voice?.sha256);
  });

});
