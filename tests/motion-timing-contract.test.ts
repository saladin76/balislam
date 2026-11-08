import { describe, expect, it } from "vitest";
import { resolveMotionTimings, type ApprovedEpisodeTiming, type MotionWord } from "../src/plan/motionTiming";

const words = ["الحق", "واضح", "اليوم"];
const estimates: MotionWord[] = words.map((word, i) => ({ word, start: i * 20, end: i * 20 + 18 }));
const approved: ApprovedEpisodeTiming = {
  episodeId: "qa-001",
  voiceSha256: "a".repeat(64),
  approvedVoiceSha256: "a".repeat(64),
  approvedBy: "operator",
  approvedAt: "2026-11-07T12:00:00Z",
  wholeEpisodeApproved: true,
  words: estimates,
};
const base = { episodeId: "qa-001", expectedWords: words, durationFrames: 120, estimates };

describe("Studio motion timing follows whole-episode voice approval", () => {
  it("permits estimates only for preview", () => {
    expect(resolveMotionTimings({ ...base, mode: "preview" }).status).toBe("estimate");
    expect(() => resolveMotionTimings({ ...base, mode: "final" })).toThrow(/approved audio/);
  });
  it("uses real word timings when exact audio hash and episode match", () => {
    const r = resolveMotionTimings({ ...base, mode: "final", approval: approved });
    expect(r).toMatchObject({ status: "approved", audioSha256: "a".repeat(64), timings: estimates });
  });
  it("fails closed when recording bytes change, or scope is less than full episode", () => {
    expect(() => resolveMotionTimings({ ...base, mode: "final", approval: { ...approved, voiceSha256: "b".repeat(64) } })).toThrow();
    expect(() => resolveMotionTimings({ ...base, mode: "final", approval: { ...approved, wholeEpisodeApproved: false } as never })).toThrow();
    expect(() => resolveMotionTimings({ ...base, mode: "final", approval: { ...approved, episodeId: "another" } })).toThrow();
  });
  it("rejects old text, missing words, overlaps and invalid evidence", () => {
    expect(() => resolveMotionTimings({ ...base, mode: "final", approval: { ...approved, words: estimates.slice(0, 2) } })).toThrow();
    expect(() => resolveMotionTimings({ ...base, mode: "final", approval: { ...approved, words: [{ ...estimates[0]!, word: "النص" }, ...estimates.slice(1)] } })).toThrow();
    expect(() => resolveMotionTimings({ ...base, mode: "final", approval: { ...approved, words: [estimates[0]!, { ...estimates[1]!, start: 0 }, estimates[2]!] } })).toThrow();
    expect(() => resolveMotionTimings({ ...base, mode: "final", approval: { ...approved, approvedBy: "" } })).toThrow();
  });
  it("retiming leaves visual asset objects untouched", () => {
    const visualAsset = { id: "alley-qa", hash: "asset-unchanged" };
    const resolved = resolveMotionTimings({ ...base, mode: "final", approval: approved });
    resolved.timings[0]!.word = "updated";
    expect(approved.words[0]!.word).toBe("الحق");
    expect(visualAsset).toEqual({ id: "alley-qa", hash: "asset-unchanged" });
  });
});
