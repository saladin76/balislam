import { afterEach, describe, expect, it } from "vitest";
import { checkInkScene, STANDARDS, assertZubdat, VOICE_SCORECARD, VISUAL_SCORECARD } from "../src/studio/zubdat";
import { KIT_SHOTS, parseInkArgs } from "../src/remotion/zubdat/kitShots";
import { INK_SHOTS } from "../src/remotion/zubdat/shots";
import { estimateTimings } from "../src/remotion/scenes/timing";
import type { PlanScene } from "../src/plan/types";
import React from "react";
import { readFileSync } from "node:fs";
import { Write } from "../src/remotion/zubdat/inkKit";

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
    // الأمر 016: لا معيار ملزم بلا مصدر، والأدوات اختيارية، وأشكالها ونطاق «لا نص إلا ما يُنطق» بانتظار المراجعة
    expect(STANDARDS.filter((s) => s.status === "binding").every((s) => s.source.trim().length > 0)).toBe(true);
    const by = Object.fromEntries(STANDARDS.map((s) => [s.id, s.status]));
    expect([by.N2, by.N3, by.I2, by.N1]).toEqual(["option", "option", "pending", "pending"]);
    expect(VOICE_SCORECARD.reduce((n, [, w]) => n + w, 0)).toBe(100);
    expect(VISUAL_SCORECARD.reduce((n, [, w]) => n + w, 0)).toBe(100);
  });

  it("أدوات الاستوديو لقناة زبدة الكتب وحدها", () => {
    process.env.BAL_CHANNEL = "balislam";
    expect(() => assertZubdat()).toThrow();
    process.env.BAL_CHANNEL = "zubdat-alkutub";
    expect(() => assertZubdat()).not.toThrow();
  });
  it("الأمر 017: خانات العدّاد عند كلمة العدد لا تكشف فكرة قبل كلمتها، والمقياس بلا تدريج ولا أرقام", () => {
    const narration = "يَبْدَأُ الْكِتَابُ مِنْ ثَلَاثِ فِكَرٍ: الْخَاطِرُ يَمُرُّ سَرِيعًا، وَمَا لَا يُكْتَبُ يَضِيعُ، وَالْكِتَابَةُ تَحْفَظُهُ.";
    const sp = span("kit-ideas", narration, "الخاطر يمر سريعا | ما لا يكتب يضيع | الكتابة تحفظه");
    const tm = sp.timings;
    const tCount = tm.find((w) => w.word.includes("ثَلَاثِ"))!.start;
    const tFirst = tm.find((w) => w.word.includes("الْخَاطِرُ"))!.start;
    const writes = (node: React.ReactNode, out: { text: string; p: number }[] = []) => {
      if (Array.isArray(node)) node.forEach((n) => writes(n, out));
      else if (React.isValidElement(node)) {
        const el = node as React.ReactElement<Record<string, unknown>>;
        if (el.type === Write) out.push({ text: String(el.props.text), p: Number(el.props.p) });
        else writes(el.props.children as React.ReactNode, out);
      }
      return out;
    };
    const at = (w: string, frac: number, nth = 1) => { const k = w.replace(/[\u064B-\u0652]/g, ""); const hit = tm.filter((t) => t.word.replace(/[\u064B-\u0652«»:،.]/g, "").replace(/^و/, "") === k)[nth - 1]; return hit ? hit.start : Math.round(frac * sp.dur); };
    const end = (w: string, frac: number, nth = 1) => at(w, frac, nth) + 10;
    const render = (frame: number) => KIT_SHOTS["kit-ideas"]!.render({ frame, dur: sp.dur, z: { ink: "#111", paper: "#fff", hl: "#E8F542", alert: "#C2412D", faint: "#888" }, at, end, logo: () => null, reg: () => {}, args: parseInkArgs("الخاطر يمر سريعا | ما لا يكتب يضيع | الكتابة تحفظه") });
    const mid = Math.round((tCount + tFirst) / 2);
    expect(tFirst - tCount).toBeGreaterThan(4);
    expect(writes(render(mid).world).filter((w) => w.p > 0)).toEqual([]);
    expect(JSON.stringify(render(mid).world, (_k, v) => (typeof v === "function" ? undefined : v))).toContain("strokeDasharray");
    // المقياس: لا خطوط تدريج قصيرة على جانب العمود (كانت ثلاثًا في الأمر 016)
    const meter = KIT_SHOTS["kit-meter"]!.render({ frame: 200, dur: 240, z: { ink: "#111", paper: "#fff", hl: "#E8F542", alert: "#C2412D", faint: "#888" }, at: () => 100, end: () => 120, logo: () => null, reg: () => {}, args: parseInkArgs("انخفض | ارتفع | حضورها", "rise | ارتفع") });
    expect(JSON.stringify(meter.world, (_k, v) => (typeof v === "function" ? undefined : v))).not.toMatch(/"type":"line"/);
  });

  it("الأمر 017: الترجمة بلا تشكيل في زبدة الكتب وحدها (script.captionTashkeel)", () => {
    const cfg = (id: string) => JSON.parse(readFileSync(`channels/${id}/channel.json`, "utf8"));
    expect(cfg("zubdat-alkutub").script?.captionTashkeel).toBe(false);
    for (const id of ["balislam", "dafatir-alzaman"]) expect(cfg(id).script?.captionTashkeel).not.toBe(false);
  });
});
