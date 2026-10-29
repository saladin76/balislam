import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseScript } from "../src/script/parse";
import { generatePlan } from "../src/plan/generate";
import { sceneSeconds } from "../src/plan/duration";
import { templateDefs } from "../src/plan/templates";

const parsed = parseScript(readFileSync(path.join(__dirname, "fixtures", "valid.md"), "utf8"));
const quran = { "53:39": "وَأَنْ لَيْسَ لِلْإِنْسَانِ إِلَّا مَا سَعَىٰ" };

describe("خطة الحلقة", () => {
  const plan = generatePlan(parsed, null, quran);
  const scenes = plan.chapters.flatMap((c) => c.scenes);

  it("تولّد ستة فصول ومشاهدها بمعرّفات ثابتة", () => {
    expect(plan.chapters).toHaveLength(6);
    expect(plan.themeId).toBe("paper");
    expect(scenes[0]?.id).toBe("c1-s1");
    expect(new Set(scenes.map((s) => s.id)).size).toBe(scenes.length);
  });

  it("تقرأ القالب وخياراته من علامة المشهد", () => {
    expect(scenes[0]?.template).toBe("big-question");
    expect(scenes[1]?.template).toBe("character-talk");
    expect(scenes[1]?.props.pose).toBe("think");
  });

  it("الآية تصبح بطاقة بنصها ومرجعها العربي", () => {
    const verse = scenes.find((s) => s.template === "verse-card");
    expect(verse?.ayahKey).toBe("53:39");
    expect(verse?.props.text).toBe(quran["53:39"]);
    expect(verse?.props.reference).toBe("النجم · ٣٩");
  });

  it("جملة الربط تُضم للمشهد السابق والمؤثر يُلحق بالمشهد التالي", () => {
    expect(scenes[1]?.narration).toContain("لنبدأ من حيث يبدأ التأجيل.");
    const withSfx = scenes.find((s) => s.sfx.some((x) => x.id === "page-turn"));
    expect(withSfx?.narration).toContain("المهمة الصعبة");
  });

  it("إعادة التوليد تحفظ تعديلات المستخدم", () => {
    const edited = structuredClone(plan);
    const s = edited.chapters[0]!.scenes[1]!;
    s.props.element = "smartphone";
    s.backdrop = "room-living";
    s.edited = true;
    const again = generatePlan(parsed, edited, quran);
    const s2 = again.chapters[0]!.scenes[1]!;
    expect(s2.props.element).toBe("smartphone");
    expect(s2.backdrop).toBe("room-living");
    expect(s2.narration).toBe(s.narration);
  });

  it("المدة تُحسب من طول التعليق، واليدوية تتقدم عليها", () => {
    const s = scenes[1]!;
    expect(sceneSeconds(s)).toBeGreaterThan(4);
    expect(sceneSeconds({ ...s, durationSec: 12 })).toBe(12);
  });

  it("كل القوالب الاثني عشر معرّفة", () => {
    expect(templateDefs).toHaveLength(12);
  });
});
