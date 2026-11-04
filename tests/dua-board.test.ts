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

  it("كل إشارة في مشاهد اللوح بالحلقة 001 كلمتها منطوقة فعلًا في جملة المشهد", () => {
    const plan = JSON.parse(readFileSync("channels/balislam/episodes/001-know-the-truth/plan.json", "utf8"));
    const scenes = plan.chapters.flatMap((c: { scenes: unknown[] }) => c.scenes) as { id: string; template: string; narration: string; props: Record<string, string> }[];
    const board = scenes.filter((s) => s.template === "dua-board");
    expect(board.length).toBeGreaterThan(0);
    for (const s of board) {
      const t = estimateTimings(s.narration, 6, 300);
      const lines = (s.props.cues ?? "").split("\n").filter((l) => l.includes("|"));
      for (const line of lines) {
        const word = line.split("|")[1]!.trim();
        const [k, nth] = word.split("#");
        const hits = t.filter((w) => w.word.replace(/[«»"،,.:؛]/g, "").replace(/^[وفبل](?=.)/, "") === k!.replace(/^[وفبل](?=.)/, "") || w.word.replace(/[«»"،,.:؛]/g, "") === k);
        expect(hits.length, `${s.id}: «${word}»`).toBeGreaterThanOrEqual(Number(nth || 1));
      }
    }
  });

  it("الدعاء لا يُنسب إلى النبي ﷺ في اللوح، ونصه مطابق للسكريبت", () => {
    const plan = JSON.parse(readFileSync("channels/balislam/episodes/001-know-the-truth/plan.json", "utf8"));
    const scenes = plan.chapters.flatMap((c: { scenes: unknown[] }) => c.scenes) as { template: string; narration: string; props: Record<string, string> }[];
    const duaScene = scenes.find((s) => s.template === "dua-board" && /dua \|/.test(s.props.cues ?? ""))!;
    const shown = duaScene.props.dua!.replace(/[|/]/g, " ").replace(/\s+/g, " ").trim();
    const spoken = duaScene.narration.replace(/[«».]/g, "").replace(/\s+/g, " ").trim();
    expect(shown).toBe(spoken);
    for (const s of scenes.filter((x) => x.template === "dua-board")) expect(s.props.source ?? "").not.toMatch(/النبي|رسول|ﷺ/);
  });
});
