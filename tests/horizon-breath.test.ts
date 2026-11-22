/**
 * «خط الأفق» — الكاميرا الحية (D195، طلب المالك ٢٢ نوفمبر: التفاعلية ≥80٪ في «دفاتر الزمن 001»):
 * إعادة تأطير عند بدايات العبارات، ورجوع إلى الإطار الأول قبل القطع، ولا حركة في السكون المقصود.
 */
import { describe, expect, it } from "vitest";
import { BEAT, MIN_MOVE, activeTime, breathAt, breathBeats, breathStill } from "../src/remotion/dafatir/horizon/breath";
import { buildTimeline } from "../src/remotion/dafatir/horizon/timeline";
import { hzSentences } from "../src/remotion/dafatir/horizon/meta";

const tlOf = (text: string) => buildTimeline(hzSentences(text), 0.3);
const TEXT = "فمتى كانت تلك البداية؟ وأين كانت؟ لا نملك تاريخًا ثابتًا لخلق آدم عليه السلام، ولا نعرف مقدار الزمن الذي يفصل بينه وبين أقدم الحضارات التي وصلت إلينا آثارها.";

describe("الكاميرا الحية في «خط الأفق» (D195)", () => {
  it("تتحرك عند بدايات العبارات، وتعود إلى الإطار الأول قبل نهاية المشهد", () => {
    const tl = tlOf(TEXT), dur = tl.end + 1.5;
    const beats = breathBeats(tl, dur, breathStill(tl, dur, false));
    expect(beats.length).toBeGreaterThanOrEqual(3);
    expect(beats[beats.length - 1]!.to).toEqual({ s: 1, x: 0, y: 0 });
    expect(beats[beats.length - 1]!.at + BEAT.move).toBeLessThanOrEqual(dur);
    const end = breathAt(dur, beats);
    expect(end.s).toBeCloseTo(1, 6); expect(end.x).toBeCloseTo(0, 6);
    for (let i = 1; i < beats.length; i++) expect(beats[i]!.at - beats[i - 1]!.at).toBeGreaterThanOrEqual(BEAT.gap - 1e-9);
  });
  it("لا حركة داخل نافذة ذكر الله ولا تتداخل حركة معها، ولا يُضاف شيء بعدها للتعويض", () => {
    const tl = tlOf("أخبرنا الله أن آدم وزوجه هبطا إلى الأرض، وأن من اتبع هدى ربه فلا يضل ولا يشقى، وكانت تلك بداية الحياة على الأرض.");
    const dur = tl.end + 1.5, wins = breathStill(tl, dur, false);
    expect(wins.length).toBeGreaterThanOrEqual(2);
    const beats = breathBeats(tl, dur, wins);
    for (const b of beats) for (const [a, z] of wins) expect(b.at < z && b.at + b.d > a).toBe(false);
    for (const [a, z] of wins) {
      const before = breathAt(a, beats), mid = breathAt((a + z) / 2, beats), after = breathAt(z, beats);
      expect(mid).toEqual(before); expect(after).toEqual(before);
    }
  });
  it("مشهد التمهيد الساكن (verse-intro / verse-tag) ساكن كله: لا لحظة كاميرا", () => {
    const tl = tlOf(TEXT), dur = tl.end + 1;
    expect(breathBeats(tl, dur, breathStill(tl, dur, true))).toEqual([]);
  });
});

describe("الكاميرا لا تقف بين العبارات (تكملة D195، ٢٣ نوفمبر)", () => {
  const tl = tlOf("ثم سأل إبليس ربه أن يمهله إلى يوم البعث، فأمهله الله. وأعلن إبليس عزمه على إغواء البشر وإبعادهم عن الصراط المستقيم.");
  const dur = tl.end + 1.2, wins = breathStill(tl, dur, false), beats = breathBeats(tl, dur, wins), total = activeTime(dur, wins);
  const at = (t: number) => breathAt(t, beats, activeTime(t, wins) / total);
  const inWin = (t: number) => wins.some(([a, z]) => t >= a && t <= z);
  it("كل حركة ≥ أقصر حركة، ولا تدخل نافذة سكون", () => {
    for (const b of beats) {
      expect(b.d).toBeGreaterThanOrEqual(MIN_MOVE - 1e-9);
      for (const [a, z] of wins) expect(b.at < z && b.at + b.d > a).toBe(false);
    }
  });
  it("خارج السكون المقصود يتغير الإطار في كل نصف ثانية، وداخله لا يتغير، ويبدأ المشهد وينتهي في الإطار الأول", () => {
    for (let t = 0; t + 0.5 <= dur; t += 0.25) {
      if (inWin(t) || inWin(t + 0.5) || wins.some(([a, z]) => a > t && z < t + 0.5)) continue;
      const a = at(t), b = at(t + 0.5);
      expect(Math.abs(a.x - b.x) + Math.abs(a.s - b.s) * 1000, `t=${t}`).toBeGreaterThan(0.5);
    }
    for (const [a, z] of wins) { const m = at((a + z) / 2); expect(at(a)).toEqual(m); expect(at(Math.min(dur, z))).toEqual(m); }
    expect(at(0).x).toBeCloseTo(0, 6); expect(at(dur).x).toBeCloseTo(0, 6); expect(at(dur).s).toBeCloseTo(1, 6);
  });
});
