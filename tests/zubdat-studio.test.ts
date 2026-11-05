import { afterEach, describe, expect, it } from "vitest";
import { checkInkScene, STANDARDS, assertZubdat, VOICE_SCORECARD, VISUAL_SCORECARD } from "../src/studio/zubdat";
import { KIT_SHOTS, parseInkArgs } from "../src/remotion/zubdat/kitShots";
import { INK_SHOTS } from "../src/remotion/zubdat/shots";
import { estimateTimings } from "../src/remotion/scenes/timing";
import type { PlanScene } from "../src/plan/types";

const span = (shot: string, narration: string, labels = "", cues = "") => {
  const dur = 240;
  const scene = { id: "t", template: "ink-shot", narration, line: 1, props: { shot, labels, cues }, sfx: [] } as unknown as PlanScene;
  return { scene, dur, timings: estimateTimings(narration, 6, dur - 12), voiced: false };
};

describe("استوديو زبدة الكتب", () => {
  const prev = process.env.BAL_CHANNEL;
  afterEach(() => { if (prev === undefined) delete process.env.BAL_CHANNEL; else process.env.BAL_CHANNEL = prev; });

  it("أدوات الاستوديو مسجلة في مكتبة مشاهد الحبر دون أن تغيّر مشاهد 001", () => {
    for (const id of Object.keys(KIT_SHOTS)) expect(INK_SHOTS[id]).toBe(KIT_SHOTS[id]);
    for (const id of ["attention-line", "first-time", "wudu", "recap"]) expect(INK_SHOTS[id]).toBeDefined();
  });

  it("كل أداة تُخصَّص لكتاب مختلف بالعبارات وحدها، بلا توقيت مفقود ولا نص غير منطوق", () => {
    const cases: [string, string, string, string?][] = [
      ["kit-book", "نَقْرَأُ كِتَابَ «صَيْدُ الْخَاطِرِ» لِابْنِ الْجَوْزِيِّ، وَسُؤَالُهُ: كَيْفَ نُمْسِكُ الْفِكْرَةَ؟", "صيد الخاطر | ابن الجوزي | كيف نمسك الفكرة؟"],
      ["kit-ideas", "ثَلَاثُ عَادَاتٍ: نَبْدَأُ صَغِيرًا، وَنُكَرِّرُ كُلَّ يَوْمٍ، وَنَقِيسُ التَّقَدُّمَ.", "نبدأ صغيرا | نكرر كل يوم | نقيس التقدم"],
      ["kit-shift", "مِنْ قِرَاءَةٍ سَرِيعَةٍ إِلَى فَهْمٍ عَمِيقٍ.", "قراءة سريعة | فهم عميق"],
      ["kit-chain", "عَادَةٌ صَغِيرَةٌ، ثُمَّ تَكْرَارٌ، ثُمَّ نَتِيجَةٌ.", "عادة صغيرة | تكرار | نتيجة"],
      ["kit-meter", "كُلَّمَا قَرَأْنَا ارْتَفَعَ الْفَهْمُ، وَإِذَا تَرَكْنَا هَبَطَ.", "", "rise | ارتفع\nfall | هبط"],
    ];
    for (const [shot, narr, labels, cues] of cases) {
      const r = checkInkScene(span(shot, narr, labels, cues));
      expect(r.findings.filter((f) => f.level === "error"), shot).toEqual([]);
      expect(r.cues, shot).toBeGreaterThan(0);
    }
  });

  it("يكشف العبارة غير المنطوقة والتوقيت على كلمة غائبة", () => {
    const r = checkInkScene(span("kit-shift", "مِنْ قِرَاءَةٍ سَرِيعَةٍ إِلَى فَهْمٍ عَمِيقٍ.", "قراءة سريعة | حفظ دائم"));
    expect(r.findings.some((f) => f.code === "unspoken")).toBe(true);
    expect(r.findings.some((f) => f.code === "cue")).toBe(true);
  });

  it("لا يكتب عبارة فيها ذكر الله، وينبّه إليها", () => {
    const r = checkInkScene(span("kit-ideas", "نَحْمَدُ اللهَ، وَنَتَعَلَّمُ، وَنَعْمَلُ.", "نحمد الله | نتعلم | نعمل"));
    expect(r.texts.some((t) => t.text.includes("الله"))).toBe(false);
    expect(r.findings.some((f) => f.code === "sacred-label")).toBe(true);
    expect(r.findings.some((f) => f.code === "sacred")).toBe(false);
  });

  it("حقلا العبارات والتوقيت يُقرآن كما يكتبهما المخرج", () => {
    expect(parseInkArgs(" أ | ب ", "rise | ارتفع\nidea2 | ما#2\nبلا فاصل")).toEqual({ labels: ["أ", "ب"], cues: { rise: "ارتفع", idea2: "ما#2" } });
  });

  it("المعايير مصنفة وتغطي المجالات السبعة، والبطاقتان مجموعهما 100", () => {
    expect(new Set(STANDARDS.map((s) => s.area)).size).toBe(7);
    expect(STANDARDS.every((s) => ["standard", "tool", "episode"].includes(s.level))).toBe(true);
    expect(VOICE_SCORECARD.reduce((n, [, w]) => n + w, 0)).toBe(100);
    expect(VISUAL_SCORECARD.reduce((n, [, w]) => n + w, 0)).toBe(100);
  });

  it("أدوات الاستوديو لقناة زبدة الكتب وحدها", () => {
    process.env.BAL_CHANNEL = "balislam";
    expect(() => assertZubdat()).toThrow();
    process.env.BAL_CHANNEL = "zubdat-alkutub";
    expect(() => assertZubdat()).not.toThrow();
  });
});
