/**
 * D220 (قرار المالك ٢٤ نوفمبر): «حد الصفحة الفاضية يبقى كما هو، لكن لا تُحسب الصفحة فارغة إن كان فيها عنصر يُرسم أو يتحرك
 * في تلك اللحظة». الحركة = تغيّر مساحة المشهد عن العينة السابقة فوق عتبة ضجيج freezedetect نفسها. الملفات مصنوعة هنا.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FREEZE_NOISE } from "../src/studio/quality/interactivity";
import {
  BLANK_INK_MIN, BLANK_MOTION_MIN, INK_H, INK_W, blankIntervals, blankReport, detectInkSamples, frameChange, isBlankSample, splitStacked,
} from "../src/studio/quality/blankFrame";

describe("D220: لا يُحسب فارغًا ما يُرسم أو يتحرك", () => {
  it("الحد ٦٠ كما هو، وعتبة الحركة هي عتبة ضجيج الشاشة الواقفة", () => {
    expect(BLANK_INK_MIN).toBe(60);
    expect(BLANK_MOTION_MIN).toBe(FREEZE_NOISE);
  });

  it("تغيّر الإطار كما يحسبه freezedetect (متوسط الفرق المطلق ÷ ٢٥٦)", () => {
    const a = new Uint8Array(100).fill(10), b = new Uint8Array(100).fill(10);
    expect(frameChange(a, b)).toBe(0);
    expect(frameChange(new Uint8Array(4).fill(0), new Uint8Array(4).fill(255))).toBeCloseTo(255 / 256, 6);
    b[0] = 110; // نقطة واحدة تغيّرت ١٠٠ درجة في ١٠٠ نقطة
    expect(frameChange(a, b)).toBeCloseTo(100 / (100 * 256), 9);
  });

  it("عينة قليلة الحبر: فارغة إن سكنت (أو لا سابقة لها)، وليست فارغة إن تحركت فوق العتبة", () => {
    expect(isBlankSample({ t: 0, ink: 10 })).toBe(true);
    expect(isBlankSample({ t: 0, ink: 10, motion: BLANK_MOTION_MIN })).toBe(true);
    expect(isBlankSample({ t: 0, ink: 10, motion: BLANK_MOTION_MIN * 2 })).toBe(false);
    expect(isBlankSample({ t: 0, ink: BLANK_INK_MIN, motion: 0 })).toBe(false);
  });

  it("الصفحة الفارغة الساكنة أثناء الكلام تُذكر، والتي يُرسم فيها شيء لا تُذكر", () => {
    const starts = [{ id: "c1-s34", start: 0 }];
    const still = Array.from({ length: 30 }, (_, i) => ({ t: i / 5, ink: 20, motion: 0.0001 }));
    expect(blankReport(still, [{ from: 0, to: 6 }], starts).spans).toHaveLength(1);
    const drawing = still.map((s) => (s.t >= 0.79 && s.t < 5.19 ? { ...s, motion: 0.01 } : s));
    // أقل من ثانية ساكنة في أولها وفي آخرها: لا تزيد أي منهما على الحد
    expect(blankReport(drawing, [{ from: 0, to: 6 }], starts).ok).toBe(true);
    expect(blankIntervals(drawing).map((x) => [x.from, Math.round(x.to * 10) / 10])).toEqual([[0, 0.8], [5.2, 6]]);
  });

  it("الإطار المكدّس: الحواف يسارًا والرمادي يمينًا", () => {
    const f = new Uint8Array(2 * INK_W * INK_H);
    for (let y = 0; y < INK_H; y++) { f.fill(1, y * 2 * INK_W, y * 2 * INK_W + INK_W); f.fill(2, y * 2 * INK_W + INK_W, (y + 1) * 2 * INK_W); }
    const { edges, gray } = splitStacked(f);
    expect([edges.length, gray.length]).toEqual([INK_W * INK_H, INK_W * INK_H]);
    expect([new Set(edges), new Set(gray)].map((s) => [...s])).toEqual([[1], [2]]);
  });

  it("ffmpeg على ملف حقيقي: صفحة ساكنة فارغة، ثم تتلاشى إليها (تتحرك بلا حواف)، ثم ساكنة", async () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), "bal-blank-motion-"));
    try {
      const f = path.join(tmp, "v.mp4");
      const page = "color=c=0xF0E6D2:s=640x360:r=30:d=2";
      execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", page, "-f", "lavfi", "-i", `${page},fade=t=in:st=0:d=2`, "-f", "lavfi", "-i", page,
        "-filter_complex", "[0][1][2]concat=n=3:v=1:a=0[v]", "-map", "[v]", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-y", f]);
      const xs = await detectInkSamples(f);
      expect(xs.length).toBeGreaterThanOrEqual(29);
      expect(xs.every((s) => s.ink < BLANK_INK_MIN)).toBe(true); // لا حواف في أي إطار
      expect(xs[0]!.motion).toBeUndefined();
      const b = blankIntervals(xs);
      expect(b).toHaveLength(2);
      expect(b[0]!.from).toBe(0);
      expect(b[0]!.to).toBeLessThan(2.3);
      expect(b[1]!.from).toBeGreaterThan(3.9);
      expect(b[1]!.from).toBeLessThan(4.5);
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  }, 60_000);
});
