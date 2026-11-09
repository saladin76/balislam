import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { INK_SHOTS, habitHeartCues } from "../src/remotion/zubdat/shots";
import { makeAt, makeEnd, Sun, type Z } from "../src/remotion/zubdat/inkKit";
import { estimateTimings, type WordTiming } from "../src/remotion/scenes/timing";

/**
 * توجيه صاحب القناة على c1-s1 (٩ نوفمبر، «الحركة غير مناسبة»):
 * الشبكة تبدأ الاختفاء عند «لكنَّ» وتفرغ الصفحة قبل «سؤالًا»؛ «؟» يبدأ مع «سؤالًا» على صفحة فارغة؛
 * الشمس وعلامات الصلوات بالحبر الأسود والفسفوري للقلب وحده؛ والشعار يتلاشى إلى الورقة لا إلى سواد.
 */
let FRAME = 0;
vi.mock("remotion", async (orig) => {
  const actual = await orig<typeof import("remotion")>();
  return { ...actual, useCurrentFrame: () => FRAME, useVideoConfig: () => ({ fps: 30, width: 1920, height: 1080, durationInFrames: 76, id: "t", defaultProps: {}, props: {}, defaultCodec: null }) };
});

const HL = "#E8F542";
const z: Z = { ink: "#111111", paper: "#FFFFFF", hl: HL, alert: "#FF6B4A", faint: "#4A4A4A" };
const plan = JSON.parse(readFileSync("channels/zubdat-alkutub/episodes/001-awwal-marra-osalli/plan.json", "utf8"));
const scene = plan.chapters[0].scenes[0];
const narration: string = scene.narration;

/** توقيت مقيس من مقطع المالك (Whisper، بالثواني من بداية المشهد) — شكل الصوت الحقيقي لا التقدير */
const REAL: [number, number, string][] = [
  [0.17, 0.53, "نُصَلِّي"], [0.53, 0.77, "كُلَّ"], [0.77, 1.25, "يَوْمٍ."], [1.25, 2.21, "نَقِفُ،"], [2.21, 3.15, "وَنَقْرَأُ،"],
  [3.15, 4.11, "وَنَرْكَعُ،"], [4.11, 4.99, "وَنَسْجُدُ."], [4.99, 5.51, "وَمَعَ"], [5.51, 6.13, "السِّنِينَ،"], [6.13, 6.71, "نَحْفَظُ"],
  [6.71, 7.03, "هَذِهِ"], [7.03, 7.73, "الْأَفْعَالَ"], [7.73, 8.17, "حَتَّى"], [8.17, 8.63, "تَصِيرَ"], [8.63, 9.37, "مَأْلُوفَةً"],
  [9.37, 9.73, "لَنَا."], [9.73, 10.35, "لَكِنَّ"], [10.35, 11.19, "سُؤَالًا"], [11.19, 11.73, "يَسْتَحِقُّ"], [11.73, 11.97, "أَنْ"],
  [11.97, 12.47, "نَسْأَلَهُ"], [12.47, 13.27, "لِأَنْفُسِنَا:"], [13.27, 13.91, "هَلْ"], [13.91, 14.33, "يَحْضُرُ"], [14.33, 14.89, "قَلْبُنَا"],
  [14.89, 15.07, "فِي"], [15.07, 15.65, "الصَّلَاةِ"], [15.65, 16.09, "كَمَا"], [16.09, 16.53, "يَحْضُرُ"], [16.53, 17.41, "جَسَدُنَا؟"],
];
const cases: { name: string; dur: number; timings: WordTiming[] }[] = [
  { name: "توقيت الصوت الحقيقي", dur: 535, timings: REAL.map(([s, e, word]) => ({ word, start: Math.round(s * 30), end: Math.round(e * 30) })) },
  { name: "التوقيت التقديري", dur: 450, timings: estimateTimings(narration, 6, 450 - 12) },
];

const world = (frame: number, dur: number, timings: WordTiming[]) =>
  renderToStaticMarkup(<svg>{INK_SHOTS["habit-heart"]!.render({ frame, dur, z, at: makeAt(timings, dur), end: makeEnd(timings, dur), logo: () => null, reg: () => {} }).world}</svg>);
/** شفافية مجموعة الشبكة (أول مجموعة في المشهد: شريط اليوم وتكراراته) */
const gridOpacity = (markup: string) => Number(/^<svg><g><g opacity="([\d.e-]+)"/.exec(markup)?.[1]);
const hasQuestion = (markup: string) => markup.includes(">؟</text>");
const start = (timings: WordTiming[], bare: string) => timings.find((t) => t.word.replace(/[ً-ْ«»:،.؟]/g, "") === bare)!.start;

describe("c1-s1 (habit-heart): توجيه المالك ٩ نوفمبر", () => {
  it("المشهد هو habit-heart، وهو وحده يستعمل هذه اللقطة", () => {
    expect(scene.id).toBe("c1-s1");
    expect(scene.props.shot).toBe("habit-heart");
    const uses = JSON.stringify(plan).match(/"shot":\s*"habit-heart"/g) ?? [];
    expect(uses).toHaveLength(1);
  });

  it("لحظات الشبكة و«؟» من الكلمتين: خروج يبدأ عند «لكنَّ» وينتهي قبل «سؤالًا»، و«؟» عند «سؤالًا»", () => {
    expect(habitHeartCues(300, 318)).toEqual({ gridStart: 300, gridEnd: 317, qStart: 318 });
    // كلمتان متلاصقتان جدًا: الخروج يبقى قبل «؟» ولا يتداخل
    const tight = habitHeartCues(300, 303);
    expect(tight.gridEnd).toBeLessThan(tight.qStart);
    expect(tight.gridEnd - tight.gridStart).toBeGreaterThanOrEqual(6);
  });

  /** يرسم المشهد إطارًا إطارًا (مئات الإطارات)؛ على جهاز بنواتين وتحت الاختبارات المتوازية يتجاوز حد 5 ث الافتراضي. */
  const HEAVY = 30_000;
  for (const c of cases) {
    it(`${c.name}: الشبكة كاملة قبل «لكنَّ»، وتبدأ الاختفاء عندها، وتفرغ الصفحة قبل «سؤالًا»`, () => {
      const tL = start(c.timings, "لكن"), tQ = start(c.timings, "سؤالا");
      expect(tQ).toBeGreaterThan(tL);
      expect(gridOpacity(world(tL - 1, c.dur, c.timings))).toBe(1);
      expect(gridOpacity(world(tL + 3, c.dur, c.timings))).toBeLessThan(1);
      expect(gridOpacity(world(tQ - 1, c.dur, c.timings))).toBe(0);
      expect(gridOpacity(world(tQ, c.dur, c.timings))).toBe(0);
    }, HEAVY);

    it(`${c.name}: «؟» لا يظهر قبل «سؤالًا»، ويُرسم من بدايتها على صفحة فارغة`, () => {
      const tQ = start(c.timings, "سؤالا");
      for (let f = 0; f < tQ + 1; f++) expect(hasQuestion(world(f, c.dur, c.timings)), `frame ${f}`).toBe(false);
      const drawing = world(tQ + 4, c.dur, c.timings);
      expect(hasQuestion(drawing)).toBe(true);
      expect(gridOpacity(drawing)).toBe(0);
    }, HEAVY);

    it(`${c.name}: لا فسفوري قبل «قلبنا» (الشمس وعلامات الصلوات بالحبر)، والقلب وحده فسفوري`, () => {
      const tHeart = start(c.timings, "قلبنا");
      const tQ = start(c.timings, "سؤالا");
      // من البداية إلى ما قبل «؟» (لا قلم يكتب، فلا غطاء القلم الفسفوري)
      // الفسفوري الوحيد في المشهد قبل «؟» هو هالة القلب، ومجموعتها مخفية حتى «قلبنا»
      const heartHalo = `<ELLIPSE CX="760" CY="600" RX="170" RY="160" FILL="${HL}"`;
      for (let f = 0; f < tQ; f += 3) {
        const m = world(f, c.dur, c.timings).toUpperCase();
        expect(m.split(HL).length - 1, `frame ${f}`).toBe(1);
        expect(m, `frame ${f}`).toMatch(new RegExp(`<G OPACITY="0"><ELLIPSE CX="760" CY="600" RX="170" RY="160" FILL="${HL}"`));
      }
      const heart = world(tHeart + 30, c.dur, c.timings).toUpperCase();
      expect(heart).toContain(heartHalo);
      expect(heart).toMatch(new RegExp(`<G OPACITY="1"><ELLIPSE CX="760" CY="600"`));
    }, HEAVY);
  }

  it("الشمس بالحبر الأسود وحده، بلا فسفوري", () => {
    const m = renderToStaticMarkup(<svg><Sun x={0} y={0} z={z} /></svg>);
    expect(m.toUpperCase()).not.toContain(HL);
    expect(m).toContain(`stroke="${z.ink}"`);
  });

  it("الشعار يتلاشى إلى ورقة الدفتر لا إلى سواد", async () => {
    const { ChannelIntro, introFrames } = await import("../src/remotion/scenes/ChannelIntro");
    FRAME = introFrames("highlighter") - 1;
    const m = renderToStaticMarkup(<ChannelIntro kind="highlighter" orientation="landscape" />);
    // الورقة تحت المحتوى المتلاشي: بياض الورق وسطوره وهامشه، قبل طبقة الشعار
    const page = m.indexOf('stroke-opacity="0.055"');
    const logo = m.indexOf("Lalezar");
    expect(page).toBeGreaterThanOrEqual(0);
    expect(logo).toBeGreaterThan(page);
    expect(m).toContain('stroke-opacity="0.055"');
    // القنوات الأخرى بلا تغيير: لا ورقة تحت افتتاحيتها
    FRAME = 0;
  });
});
