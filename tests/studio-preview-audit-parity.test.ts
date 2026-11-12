import { describe, expect, it } from "vitest";
import { motionFingerprint } from "../src/render/motionFingerprint";
import { staleMotionScenes } from "../src/render/motionValidity";
import { sceneHash } from "../src/plan/sceneHash";
import type { Plan } from "../src/plan/types";
import type { EpisodeMedia } from "../src/plan/media";
import type { StoryboardMotion } from "../src/render/storyboardMotion";

const plan = {
  channel: "balislam",
  chapters: [{ scenes: [{ id: "c1-s1", narration: "نص تجريبي", line: 1, template: "alley-tale",
    props: { cameraMode: "directed", camera: "still" }, sfx: [] }] }],
} as unknown as Plan;
const media = { voice: {}, recitations: {}, images: [], sfx: [] } as unknown as
  Pick<EpisodeMedia, "voice" | "recitations" | "images" | "sfx">;
const hash = (p: Plan, channel: string, orientation: "landscape" | "portrait" = "landscape",
  assets: {file: string; size: number; mtime: number}[] = [], renderer = "v1") =>
  motionFingerprint(p, media, { name: channel }, { id: channel }, orientation, assets, renderer);

describe("preview/audit parity and channel isolation", () => {
  it("binds each report to its exact channel and identity", () => {
    expect(hash(plan, "balislam")).not.toBe(hash(plan, "dafatir-alzaman"));
    expect(hash(plan, "dafatir-alzaman")).not.toBe(hash(plan, "zubdat-alkutub"));
  });
  it("invalidates results when the rendering code, inputs, or direction change", () => {
    const base = hash(plan, "balislam");
    expect(hash(plan, "balislam", "landscape", [], "v2")).not.toBe(base);
    expect(hash(plan, "balislam", "portrait")).not.toBe(base);
    expect(hash(plan, "balislam", "landscape", [{file: "shot.png", size: 20, mtime: 1}])).not.toBe(base);
    const changed = JSON.parse(JSON.stringify(plan)) as Plan;
    changed.chapters[0]!.scenes[0]!.props.camera = "track";
    expect(hash(changed, "balislam")).not.toBe(base);
  });
  it("rejects an old or incomplete measurement instead of showing it as current", () => {
    const fingerprint = hash(plan, "balislam");
    const shot = plan.chapters[0]!.scenes[0]!;
    const report: StoryboardMotion = {
      at: "2026-11-04T00:00:00Z", percent: 0, orientation: "landscape",
      inputHash: fingerprint, scenes: { [shot.id]: { hash: sceneHash(shot), pct: 0, still: 3, from: 0 } },
    };
    expect(staleMotionScenes(plan, report, fingerprint)).toEqual([]);
    expect(staleMotionScenes(plan, report, hash(plan, "balislam", "landscape", [], "v2"))).toEqual([shot.id]);
    delete report.scenes[shot.id];
    expect(staleMotionScenes(plan, report, fingerprint)).toEqual([shot.id]);
  });
});
