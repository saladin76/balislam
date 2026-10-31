import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseScript } from "../src/script/parse";
import { generatePlan } from "../src/plan/generate";
import type { Plan } from "../src/plan/types";

const script = readFileSync(path.join(__dirname, "fixtures", "valid.md"), "utf8");
const scenes = (p: Plan) => p.chapters.flatMap((c) => c.scenes);

const editScene = (p: Plan, id: string, patch: Record<string, unknown>): Plan => ({
  ...p,
  chapters: p.chapters.map((c) => ({ ...c, scenes: c.scenes.map((s) => (s.id === id ? { ...s, ...patch, edited: true } : s)) })),
});

describe("إعادة توليد الخطة", () => {
  it("إضافة فقرة في منتصف الفصل لا تنقل تعديلات مشهد إلى مشهد آخر", () => {
    const first = generatePlan(parseScript(script));
    const target = first.chapters[1]!.scenes[1]!; // الفقرة الثانية في الفصل 2
    const edited = editScene(first, target.id, { props: { ...target.props, pose: "sit" }, durationSec: 9 });
    const inserted = script.replace("التأجيل لا يبدأ من الكسل.", "فقرة جديدة أُضيفت هنا.\n\nالتأجيل لا يبدأ من الكسل.");
    const again = generatePlan(parseScript(inserted), edited);
    const moved = scenes(again).find((s) => s.narration.startsWith(target.narration.slice(0, 20)))!;
    expect(moved.id).not.toBe(target.id);
    expect(moved.durationSec).toBe(9);
    expect(moved.props.pose).toBe("sit");
    const fresh = scenes(again).find((s) => s.narration.startsWith("فقرة جديدة"))!;
    expect(fresh.durationSec).toBeUndefined();
  });

  it("تعديل نص المشهد في السكريبت يُبقي اختياراته", () => {
    const first = generatePlan(parseScript(script));
    const target = first.chapters[2]!.scenes[0]!;
    const edited = editScene(first, target.id, { durationSec: 7 });
    const changed = script.replace("حين نؤجل، نشتري راحة قصيرة بثمن طويل.", "حين نؤجل نشتري راحة قصيرة، والثمن طويل.");
    const again = generatePlan(parseScript(changed), edited);
    expect(again.chapters[2]!.scenes[0]!.durationSec).toBe(7);
  });

  it("تغيير مرجع الآية يحدّث المرجع والنص حتى لو عُدّلت البطاقة", () => {
    const first = generatePlan(parseScript(script), null, { "53:39": "نص النجم" });
    const verse = scenes(first).find((s) => s.template === "verse-card")!;
    const edited = editScene(first, verse.id, { durationSec: 8 });
    const changed = script.replace(/النجم 39/g, "البقرة 286");
    const again = generatePlan(parseScript(changed), edited, { "53:39": "نص النجم" });
    const v = scenes(again).find((s) => s.template === "verse-card")!;
    expect(v.ayahKey).toBe("2:286");
    expect(v.props.reference).toContain("البقرة");
    expect(v.props.text).not.toBe("نص النجم");
  });

  it("درجة «حسن لغيره» تظهر حسنًا لا صحيحًا، واختلاف الهمزة/الياء لا يضيع الدرجة", () => {
    const hasan = script.replace("| صحيح | تحقق", "| حسن لغيره | تحقق");
    expect(scenes(generatePlan(parseScript(hasan))).find((s) => s.template === "hadith-card")!.props.grade).toBe("حسن");
    const spelled = hasan.replace("- حديث | صحيح البخاري 6446", "- حديث | صحيح البخارى 6446");
    expect(scenes(generatePlan(parseScript(spelled))).find((s) => s.template === "hadith-card")!.props.grade).toBe("حسن");
  });
});

describe("أسلوب الحلقة", () => {
  it("style يحدد القالب الافتراضي للفقرات التي بلا علامة", () => {
    for (const [style, template] of [["board", "board-story"], ["glow", "glow-story"], ["kinetic", "kinetic-text"]] as const) {
      const s = script.replace('episode: "001"', `episode: "001"\nstyle: ${style}`);
      const p = generatePlan(parseScript(s));
      const sc = p.chapters[1]!.scenes[0]!;
      expect(sc.template, style).toBe(template);
      if (template === "glow-story") expect(sc.props.wish).toBeTruthy();
    }
  });
});
