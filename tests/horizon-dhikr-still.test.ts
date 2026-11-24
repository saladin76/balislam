/**
 * D214 (قرار المالك ٢٤ نوفمبر، «دفاتر الزمن» بشكل «خط الأفق»): السكون على كلمات الذكر وحدها ± ربع ثانية يشمل رسم المشهد نفسه
 * (لا الكاميرا وحدها)، والحد ٩٥٪ للتفاعلية في هذه القناة.
 */
import { describe, expect, it } from "vitest";
import { activeTime, breathStill } from "../src/remotion/dafatir/horizon/breath";
import { buildTimeline } from "../src/remotion/dafatir/horizon/timeline";
import { hzSentences } from "../src/remotion/dafatir/horizon/meta";
import { visualClock } from "../src/remotion/scenes/HorizonShot";
import { INTERACTIVITY_MIN, interactivityMinFor } from "../src/studio/quality/interactivity";

const tl = buildTimeline(hzSentences("أول إنسان خلقه الله سبحانه وتعالى، ومنه ومن زوجه بدأ نسل البشر الذي انتشر في الأرض."), 0.3);
const dur = tl.end + 1.2;
const wins = breathStill(tl, dur, false);
/** النوافذ المتداخلة (كلمة لكل نافذة) مدموجة */
const merged = [...wins].sort((x, y) => x[0] - y[0]).reduce<[number, number][]>((m, w) => { const l = m[m.length - 1]; if (l && w[0] <= l[1]) l[1] = Math.max(l[1], w[1]); else m.push([w[0], w[1]]); return m; }, []);
const word = (w: string) => tl.words.find((x) => x.w === w)!;

describe("ساعة الرسم المرئية في «خط الأفق» (D214)", () => {
  it("نوافذ السكون على كلمات الذكر وحدها ± ربع ثانية، لا على الجملة كلها", () => {
    const allah = word("الله"), taala = word("وتعالى");
    expect(merged.some(([a, b]) => a <= allah.s - 0.25 + 1e-9 && b >= taala.e + 0.25 - 1e-9)).toBe(true);
    // «أول إنسان» و«نسل البشر» خارج السكون
    for (const w of ["أول", "نسل", "الأرض"]) expect(wins.some(([a, b]) => word(w).s > a && word(w).s < b)).toBe(false);
  });
  it("الزمن المرئي ثابت داخل النافذة، ومتصل بعدها بلا قفزة", () => {
    const [a, b] = merged[0]!;
    expect(activeTime(a + 0.1, wins)).toBeCloseTo(activeTime(b - 0.1, wins), 9);
    expect(activeTime(b + 1 / 30, wins) - activeTime(b, wins)).toBeCloseTo(1 / 30, 6);
  });
  it("كل حدث عند كلمته خارج السكون: الكلمة تبدأ في الزمن المرئي عندما تُنطق", () => {
    const vis = visualClock(tl, dur, undefined, wins);
    for (const w of tl.words) {
      const inWin = wins.some(([a, b]) => w.s > a && w.s < b);
      if (inWin) continue;
      const vw = vis.tl.words.find((x) => x.w === w.w && x.sent === w.sent)!;
      expect(vw.s).toBeCloseTo(activeTime(w.s, wins), 9);
    }
    expect(vis.dur).toBeCloseTo(dur - merged.reduce((s, [a, b]) => s + (b - a), 0), 6);
  });
});

describe("حد التفاعلية لكل قناة (D214)", () => {
  it("دفاتر الزمن ٩٥٪، والقناتان الأخريان على الحد العام", () => {
    expect(interactivityMinFor("dafatir-alzaman")).toBe(95);
    expect(interactivityMinFor("balislam")).toBe(INTERACTIVITY_MIN);
    expect(interactivityMinFor(undefined)).toBe(INTERACTIVITY_MIN);
  });
});
