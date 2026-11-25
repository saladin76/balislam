import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseBoardCues, arabicInkRevealStyle } from "../src/remotion/scenes/DuaBoard";
import { estimateTimings } from "../src/remotion/scenes/timing";
import { parseScript } from "../src/script/parse";
import { duaAttributionProblems } from "../src/plan/duaAttribution";

describe("لوح الدعاء", () => {
  it("يظهر النص العربي كامل الحروف بلا قناع يقص التشكيل أثناء الحركة", () => {
    const before = arabicInkRevealStyle(0);
    const midway = arabicInkRevealStyle(0.5);
    const after = arabicInkRevealStyle(1);
    expect(before.opacity).toBe(0);
    expect(midway.opacity).toBe(0.5);
    expect(after.opacity).toBe(1);
    for (const state of [before, midway, after]) {
      expect(state).not.toHaveProperty("clipPath");
      expect(state).not.toHaveProperty("overflow", "hidden");
    }
  });

  it("كل عنصر يظهر لحظة نطق كلمته، والكلمة المكررة بترتيبها", () => {
    const narration = "«اللهم أرنا الحق حقًّا وارزقنا اتباعه، وأرنا الباطل باطلًا وارزقنا اجتنابه».";
    const t = estimateTimings(narration, 6, 200);
    const [a, b] = parseBoardCues("x | وارزقنا\ny | وارزقنا#2", t, 200);
    expect(a!.at).toBe(t[4]!.start);
    expect(b!.at).toBe(t[9]!.start);
  });

  // اختبار وحدة مستقل عن اختيارات المخرج في الحلقة 001.
  // قد تستخدم الحلقة قالبًا آخر، ولا يعني ذلك تعطّل قالب لوح الدعاء.
  const fixture = {
    id: "fixture-dua",
    template: "dua-board",
    narration: "«اللهم أرنا الحق حقًّا وارزقنا اتباعه، وأرنا الباطل باطلًا وارزقنا اجتنابه».",
    props: {
      cues: "dua | اللهم\nask1 | الحق\nask2 | وارزقنا\nask4 | وارزقنا#2",
      dua: "اللهم أرنا الحق حقًّا وارزقنا اتباعه، / وأرنا الباطل باطلًا وارزقنا اجتنابه",
      source: "من كلام أهل العلم",
    },
  };
  type BoardScene = typeof fixture;
  const checkCues = (s: BoardScene) => {
    const timings = estimateTimings(s.narration, 6, 300);
    const lines = (s.props.cues ?? "").split("\n").filter((l) => l.includes("|"));
    for (const line of lines) {
      const word = line.split("|")[1]!.trim();
      const [k, nth] = word.split("#");
      const hits = timings.filter((w) =>
        w.word.replace(/[«»"،,.:؛]/g, "").replace(/^[وفبل](?=.)/, "") === k!.replace(/^[وفبل](?=.)/, "") ||
        w.word.replace(/[«»"،,.:؛]/g, "") === k);
      expect(hits.length, `${s.id}: «${word}»`).toBeGreaterThanOrEqual(Number(nth || 1));
    }
  };

  it("كل إشارة في قالب اللوح التجريبي كلمتها منطوقة", () => {
    checkCues(fixture);
  });

  it("الدعاء الظاهر في قالب اللوح مطابق للمنطوق بلا نسبة نبوية غير صحيحة", () => {
    const shown = fixture.props.dua.replace(/[|/]/g, " ").replace(/\s+/g, " ").trim();
    const spoken = fixture.narration.replace(/[«».]/g, "").replace(/\s+/g, " ").trim();
    expect(shown).toBe(spoken);
    expect(fixture.props.source).not.toMatch(/النبي|رسول|ﷺ/);
  });

  it("مشاهد اللوح الموجودة فعلًا في الخطة لا تحتوي إحالات غير منطوقة أو نسبًا ممنوعًا", () => {
    const plan = JSON.parse(readFileSync("channels/balislam/episodes/001-know-the-truth/plan.json", "utf8"));
    const scenes = plan.chapters.flatMap((c: { scenes: unknown[] }) => c.scenes) as BoardScene[];
    const boards = scenes.filter((s) => s.template === "dua-board");
    for (const scene of boards) {
      checkCues(scene);
      if (/dua \|/.test(scene.props.cues ?? "")) {
        const shown = (scene.props.dua ?? "").replace(/[|/]/g, " ").replace(/\s+/g, " ").trim();
        const spoken = scene.narration.replace(/[«».]/g, "").replace(/\s+/g, " ").trim();
        expect(shown).toBe(spoken);
      }
    }
    // D225: النسبة النبوية في المصدر لا تُقبل إلا لحديث مذكور في استشهادات السكريبت (سجل التوثيق نفسه في الاستوديو)
    const script = parseScript(readFileSync("channels/balislam/episodes/001-know-the-truth/script.md", "utf8"));
    const hadiths = script.citations.filter((c) => c.kind === "hadith").map((c) => ({ ref: (c.fields[0] ?? "").trim() }));
    expect(duaAttributionProblems(boards, hadiths, false)).toEqual([]);
  });

  describe("D225: ﷺ في المصدر لحديث موثّق وحده، والمنع باقٍ في غيره", () => {
    const board = (source: string) => ({ id: "x", template: "dua-board", props: { source } });
    const muslim = [{ ref: "صحيح مسلم 770", status: "verified" as const }];

    it("لوحة فيها ﷺ بلا توثيق تُرفض", () => {
      expect(duaAttributionProblems([board("من دعاء النبي ﷺ")], [], false)).toHaveLength(1);
      expect(duaAttributionProblems([board("من دعاء النبي ﷺ")], [], true)).toHaveLength(1);
      expect(duaAttributionProblems([board("صحيح مسلم ٧٧٠ · من دعائه ﷺ")], [], false)).toHaveLength(1);
    });

    it("حديث آخر غير الذي يذكره المصدر لا يكفي، ولا مصدر بلا رقم", () => {
      expect(duaAttributionProblems([board("صحيح البخاري ٦٣٠٦ · من دعائه ﷺ")], muslim, true)).toHaveLength(1);
      expect(duaAttributionProblems([board("صحيح مسلم · من دعائه ﷺ")], [{ ref: "صحيح مسلم", status: "verified" }], true)).toHaveLength(1);
      expect(duaAttributionProblems([board("رسول الله ﷺ")], muslim, true)).toHaveLength(1);
    });

    it("في الاستوديو: الحديث المذكور لكنه غير موثّق بعد في review.json يُرفض", () => {
      for (const status of ["pending", "changed", "rejected"] as const)
        expect(duaAttributionProblems([board("صحيح مسلم ٧٧٠ · من دعائه ﷺ")], [{ ref: "صحيح مسلم 770", status }], true)).toHaveLength(1);
    });

    it("حديث موثّق يذكره المصدر برقمه يُقبل، ولوحة بلا نسبة نبوية لا تتأثر", () => {
      expect(duaAttributionProblems([board("صحيح مسلم ٧٧٠ · من دعائه ﷺ في قيام الليل")], muslim, true)).toEqual([]);
      expect(duaAttributionProblems([board("من الأدعية المأثورة في كلام أهل العلم")], [], true)).toEqual([]);
    });
  });
});
