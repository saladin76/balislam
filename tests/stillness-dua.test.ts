import { describe, expect, it } from "vitest";
import { duaRanges, intendedStillness, mergeSpans } from "../src/render/stillness";
import type { Plan } from "../src/plan/types";

const words = (s: string) => s.split(/\s+/).filter(Boolean);

describe("السكون المقصود: الدعاء المقتبس كله ذكر لله", () => {
  it("يلتقط العبارة المقتبسة التي تبدأ بنداء لله، من أولها إلى آخرها", () => {
    expect(duaRanges(words("«اللهم أرنا الحق حقًّا وارزقنا اتباعه»."))).toEqual([[0, 5]]);
    expect(duaRanges(words("وقل دائمًا: «ربنا أعنا على الخير» ثم امض."))).toEqual([[2, 5]]);
    expect(duaRanges(words("«رب يسر لنا أمرنا»"))).toEqual([[0, 3]]);
  });
  it("لا يلتقط اقتباسًا ليس دعاء، ولا كلمة دعاء بلا اقتباس", () => {
    expect(duaRanges(words("ثم يقول: «أنا إنسان صريح»."))).toEqual([]);
    expect(duaRanges(words("من الأدعية المأثورة في كلام أهل العلم:"))).toEqual([]);
    expect(duaRanges(words("وهو دعاء حسن المعنى، نسأل الله فيه"))).toEqual([]);
  });
  it("مشهد يُقرأ فيه الدعاء يُستثنى من أول الدعاء إلى آخره، في أي قالب", () => {
    for (const template of ["dua-board", "kinetic-text", "alley-tale"]) {
      const plan = { chapters: [{ number: 1, title: "", scenes: [{ id: "a", template, narration: "«اللهم أرنا الأشياء كما هي».", props: {} }] }] } as unknown as Plan;
      const spans = mergeSpans(intendedStillness(plan, 0));
      expect(spans).toHaveLength(1);
      expect(spans[0]!.why).toContain("دعاء");
      expect(spans[0]!.to - spans[0]!.from).toBeGreaterThan(1.5);
    }
  });
  it("الجملة التي تذكر الدعاء ولا تقرؤه لا تُستثنى إلا عند ذكر الله", () => {
    const plan = { chapters: [{ number: 1, title: "", scenes: [{ id: "a", template: "alley-tale", narration: "تأمل كيف يجمع هذا الدعاء بين أربعة مطالب.", props: {} }] }] } as unknown as Plan;
    expect(intendedStillness(plan, 0)).toEqual([]);
  });
});

describe("السكون المقصود: تمهيد الآية في أي قالب", () => {
  const plan = (intro: string, next = "verse-card") =>
    ({ chapters: [{ number: 1, title: "", scenes: [{ id: "a", template: "alley-tale", narration: intro, props: {} }, { id: "b", template: next, narration: "", props: {} }] }] }) as unknown as Plan;
  it("الجملة التي تسبق بطاقة الآية وتنتهي بنقطتين تُستثنى كلها", () => {
    const spans = mergeSpans(intendedStillness(plan("وقد حذّر من ذلك، فقال الله تعالى:"), 0));
    expect(spans[0]).toMatchObject({ from: 0 });
    expect(spans[0]!.why).toContain("تمهيد آية");
  });
  it("جملة قبل مشهد آخر، أو لا تنتهي بنقطتين، لا تُستثنى كلها", () => {
    expect(intendedStillness(plan("وتذكر هذا المعنى:", "alley-tale"), 0)).toEqual([]);
    expect(intendedStillness(plan("وهذا معنى واضح في حياتنا."), 0).filter((x) => x.why !== "آية")).toEqual([]);
  });
});

describe("السكون المقصود: زمن قراءة الاستشهاد البصري الصامت (دفاتر الزمن V9)", () => {
  const scene = (props: Record<string, unknown>) =>
    ({ chapters: [{ number: 1, title: "", scenes: [{ id: "a", template: "horizon-shot", narration: "وخلق لهما مكانًا يسكنانه.", durationSec: 9, props: { shot: "permit", ...props } }] }] }) as unknown as Plan;
  it("بعد آخر كلمة حتى نهاية المشهد يُستثنى حين يعرض المشهد نص آية", () => {
    const spans = mergeSpans(intendedStillness(scene({ verseKey: "2:35", verseText: "نص", verseFrom: "وخلق" }), 0));
    expect(spans.at(-1)!.why).toContain("آية");
    expect(spans.at(-1)!.to).toBeGreaterThan(spans.at(-1)!.from + 0.5);
  });
  it("ولا يُستثنى شيء في المشهد نفسه بلا آية معروضة", () => {
    expect(intendedStillness(scene({}), 0)).toEqual([]);
  });
});
