import { describe, expect, it } from "vitest";
import { findSilentEdges, parseSilenceEvents } from "../scripts/studio-recitation-silence.mjs";

describe("read-only Quran source silence inspection", () => {
  it("reports actual silence at the start/end of a source recording without inferring audio cuts", () => {
    const log = [
      "[silencedetect] silence_start: 0",
      "[silencedetect] silence_end: 0.310 | silence_duration: 0.310",
      "[silencedetect] silence_start: 1.300",
      "[silencedetect] silence_end: 1.650 | silence_duration: 0.350",
      "[silencedetect] silence_start: 3.770",
      "[silencedetect] silence_end: 4.000 | silence_duration: 0.230",
    ].join("\n");
    expect(findSilentEdges(log, 4)).toEqual({
      leadingSec: 0.31, trailingSec: 0.23, middlePauses: 1,
    });
  });
  it("supports silence to EOF and distinguishes internal reciter pauses", () => {
    const log = "[silencedetect] silence_start: 0.9\n[silencedetect] silence_end: 1.2\n[silencedetect] silence_start: 2.8";
    const r = findSilentEdges(log, 3.25);
    expect(r.leadingSec).toBe(0);
    expect(r.trailingSec).toBeCloseTo(0.45);
    expect(r.middlePauses).toBe(1);
    expect(parseSilenceEvents(log).ongoingStart).toBe(2.8);
  });
  it("does not fabricate silence when no events are recorded", () => {
    expect(findSilentEdges("size=0kB time=00:00:03.00", 3)).toEqual({
      leadingSec: 0, trailingSec: 0, middlePauses: 0,
    });
    expect(() => findSilentEdges("", 0)).toThrow();
  });
});
