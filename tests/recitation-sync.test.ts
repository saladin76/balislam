import { describe, expect, it } from "vitest";
import { sceneFrames, sceneSeconds } from "../src/plan/duration";
import { recitationFrameSchedule, recitationSeconds } from "../src/quran/recitationTimeline";
import type { PlanScene } from "../src/plan/types";

const verse = (durationSec?: number): PlanScene => ({
  id: "c1-s1", template: "verse-card", props: { text: "آية موثقة", reference: "اختبار" },
  narration: "", line: 1, sfx: [], ayahKey: "1:1",
  ...(durationSec ? { durationSec } : {}),
});

describe("Quran recitation synchronized to verse display", () => {
  it("starts narration at frame zero and ends the verse on the last audio frame", () => {
    const rec = { file: "1-1.mp3", duration: 3.4 };
    const media = { voice: {}, recitations: { "1:1": rec } };
    expect(recitationFrameSchedule(rec, 30)).toEqual([{ file: "1-1.mp3", from: 0, durationInFrames: 102 }]);
    expect(sceneSeconds(verse(), media)).toBeCloseTo(3.4);
    expect(sceneFrames(verse(), media, 30)).toBe(102);
  });

  it("removes old manual long hold, without cutting measured verse audio", () => {
    const rec = { file: "1-1.mp3", duration: 6 };
    const media = { voice: {}, recitations: { "1:1": rec } };
    expect(sceneSeconds(verse(18), media)).toBe(6);
    expect(sceneSeconds(verse(2), media)).toBe(6);
  });

  it("schedules multi-ayah recordings contiguously with a shared frame boundary", () => {
    const rec = { file: "first.mp3", duration: 99, parts: [
      { file: "first.mp3", duration: 2.13 },
      { file: "second.mp3", duration: 3.57 },
      { file: "third.mp3", duration: 1.3 },
    ] };
    const schedule = recitationFrameSchedule(rec, 30);
    expect(schedule[0]!.from).toBe(0);
    expect(schedule[1]!.from).toBe(schedule[0]!.durationInFrames);
    expect(schedule[2]!.from).toBe(schedule[0]!.durationInFrames + schedule[1]!.durationInFrames);
    expect(schedule.at(-1)!.from + schedule.at(-1)!.durationInFrames).toBe(210);
    expect(recitationSeconds(rec)).toBeCloseTo(7);
    const media = { voice: {}, recitations: { "1:1": rec } };
    expect(sceneFrames(verse(), media, 30)).toBe(210);
  });

  it("keeps previous silent preview estimates when no recording has been provided", () => {
    const seconds = sceneSeconds(verse(), { voice: {}, recitations: {} });
    expect(seconds).toBeGreaterThan(0);
  });
});
