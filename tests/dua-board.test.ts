import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseBoardCues } from "../src/remotion/scenes/DuaBoard";
import { estimateTimings } from "../src/remotion/scenes/timing";

describe("لوح الدعاء", () => {
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
      dua: "اللهم أرنا الحق حقًّا وارزقنا اتباعه / وأرنا الباطل باطلًا وارزقنا اجتنابه",
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
      expect(scene.props.source ?? "").not.toMatch(/النبي|رسول|ﷺ/);
      if (/dua \|/.test(scene.props.cues ?? "")) {
        const shown = (scene.props.dua ?? "").replace(/[|/]/g, " ").replace(/\s+/g, " ").trim();
        const spoken = scene.narration.replace(/[«».]/g, "").replace(/\s+/g, " ").trim();
        expect(shown).toBe(spoken);
      }
    }
  });
});
