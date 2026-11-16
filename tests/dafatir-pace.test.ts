import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { checkPaceDoc } from "../src/voice/pace";
import type { Plan } from "../src/plan/types";

// طلب المالك (١٥ نوفمبر، «نفّذه الآن رغم التجميد»، B-004–B-006، D143): «خليه يبدأ من أول الكلام… تسريع شوية الصوت…
// وفيه مسافات بين الفقرات يحتاج الي جعله متصل وسرد واحد». السرعة والفاصل بأداة «سرعة الإلقاء» نفسها (D140) لا بآلية ثانية.
const EP = "channels/dafatir-alzaman/episodes/001-adam-beginning";

describe("دفاتر الزمن 001 بعد طلب المالك (D143)", () => {
  const p = JSON.parse(readFileSync(`${EP}/plan.json`, "utf8")) as Plan;
  const ids = p.chapters.flatMap((c) => c.scenes).map((s) => s.id);
  it("تبدأ من أول الكلام: لا غلاف ولا بسملة", () => {
    expect(ids).not.toContain("c1-s0");
    expect(ids).not.toContain("c1-s1");
    expect(p.chapters[0]!.scenes[0]!.narration.trim().length).toBeGreaterThan(0);
  });
  it("وبلا افتتاحية القناة قبله: أول ما يُرى ويُسمع «عرفت الأرض» (طلب المالك ١٦ نوفمبر: «خلي الفيديو يبدأ من اول عرفت الارض»)", () => {
    expect(p.intro).toBe(false);
    expect(p.chapters[0]!.scenes[0]!.narration.startsWith("عرفت الأرض")).toBe(true);
  });
  it("الإيقاع في pace.json (أداة D140): ملف صالح بسرعة أعلى من «متوسط» وفاصل أقصر من «عادي»", () => {
    const doc = JSON.parse(readFileSync(`${EP}/pace.json`, "utf8"));
    expect(checkPaceDoc(doc)).toEqual([]);
    expect(["fast"]).toContain(doc.episode?.speed);
    expect(["shorter", "shortest"]).toContain(doc.episode?.pause);
  });
});
