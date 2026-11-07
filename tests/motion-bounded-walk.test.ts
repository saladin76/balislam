import { describe, expect, it } from "vitest";
import { fitDistanceWithin, fitDistance, locomote, gaitSpeed, type GaitId } from "../src/remotion/illus/gait";

describe("contained scene locomotion: short speech beats, without legacy changes", () => {
  const fps = 30;
  const scale = 1.75;
  for (const gait of ["heavy", "stroll", "walk", "brisk"] as GaitId[]) {
    for (const frames of [12, 24, 48]) {
      it(`${gait}: finishes a ${frames}-frame move before the next cue`, () => {
        const distance = fitDistanceWithin(gait, frames, scale, fps);
        expect(distance).toBeGreaterThan(0);
        const o = { x0: 200, moves: [{ start: 5, dx: distance, gait, durationFrames: frames }], scale, fps };
        const at = (f: number) => locomote(f, o);
        expect(at(5 + frames).moving).toBe(false);
        expect(at(5 + frames).v).toBe(0);
        // Numerical integration is discretized to one frame.
        expect(Math.abs(at(5 + frames + 2).x - (200 + distance))).toBeLessThan(4);
        expect(at(5 + frames + 2).x).toBe(at(5 + frames + 20).x);
        expect(at(5 + Math.floor(frames / 2)).amount).toBeLessThanOrEqual(1);
      });
    }
    it(`${gait}: opt-in distance respects gait speed and leaves legacy distance untouched`, () => {
      const maxTravel = fitDistanceWithin(gait, 50, scale, fps);
      expect(maxTravel / 50).toBeLessThan(gaitSpeed(gait, scale, fps));
      expect(fitDistanceWithin(gait, 0, scale, fps)).toBe(0);
      expect(fitDistance(gait, 30, scale, fps)).toBeGreaterThan(0);
      expect(fitDistanceWithin(gait, 50, scale, fps)).toBeGreaterThan(fitDistanceWithin(gait, 12, scale, fps));
    });
  }
});
