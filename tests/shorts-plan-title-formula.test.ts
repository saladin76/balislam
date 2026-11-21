/**
 * جدول الشورتس اليومي (ريلزان يوميًا لكل قناة) وصيغة عنوان كل قناة (المرحلة ٢، البندان ٢ و٣).
 * المدخلات مكتوبة هنا؛ لا تُقرأ حلقة حية (KI-068).
 */
import { describe, expect, it } from "vitest";
import { planShorts, scheduleSummary, type ShortItem } from "../src/package/shortsSchedule";
import { formulaProblem, TITLE_FORMULAS } from "../src/package/titleFormula";
import { kitIssues } from "../src/package/quality";
import type { PublishKit } from "../src/package/social";

const ep = (source: string, count: number, episodeDate: string): ShortItem[] => Array.from({ length: count }, (_, i) => ({ source, n: i + 1, episodeDate }));
const ids = (d: { shorts: ShortItem[] }) => d.shorts.map((s) => `${s.source}#${s.n}`);

describe("جدول الشورتس: ريلزان يوميًا", () => {
  it("الأحدث أولًا، ومصدران مختلفان في اليوم ما أمكن، ولا تكرار", () => {
    const plan = planShorts({ from: "2026-11-23", days: 3, perDay: 2, items: [...ep("001", 4, "2026-11-01"), ...ep("002", 4, "2026-11-22")] });
    expect(plan.map(ids)).toEqual([["002#1", "001#1"], ["002#2", "001#2"], ["002#3", "001#3"]]);
    const all = plan.flatMap(ids);
    expect(new Set(all).size).toBe(all.length);
  });
  it("حلقة واحدة: شورتاها في اليوم نفسه بترتيبهما", () => {
    expect(planShorts({ from: "2026-11-23", days: 2, perDay: 2, items: ep("001", 4, "2026-11-22") }).map(ids)).toEqual([["001#1", "001#2"], ["001#3", "001#4"]]);
  });
  it("لا شورت قبل نشر حلقته (رابطه يشير إليها)", () => {
    const plan = planShorts({ from: "2026-11-23", days: 2, perDay: 2, items: ep("003", 2, "2026-11-24") });
    expect(plan[0]!.shorts).toEqual([]);
    expect(plan[0]!.gap).toBe(2);
    expect(ids(plan[1]!)).toEqual(["003#1", "003#2"]);
  });
  it("الفجوات تُعدّ وتُسمّى: إشارة لصنع شورتس أو سلسلة مستقلة", () => {
    const plan = planShorts({ from: "2026-11-23", days: 3, perDay: 2, items: ep("001", 3, "2026-11-20") });
    expect(plan.map((d) => d.gap)).toEqual([0, 1, 2]);
    expect(scheduleSummary(plan, 2)).toMatchObject({ full: 1, firstGap: "2026-11-24", missing: 3 });
  });
  it("السلسلة اليومية المستقلة تملأ بعد الحلقة الأحدث وقبل الأقدم", () => {
    const items = [...ep("001", 2, "2026-10-01"), ...ep("002", 1, "2026-11-22"), { source: "series:كلمة-اليوم", n: 1 }, { source: "series:كلمة-اليوم", n: 2 }];
    expect(planShorts({ from: "2026-11-23", days: 2, perDay: 2, items }).map(ids)).toEqual([["002#1", "series:كلمة-اليوم#1"], ["series:كلمة-اليوم#2", "001#1"]]);
  });
  it("التقويم اليدوي يعلو: يوم محدد كما هو، ويوم إجازة بلا شورت؛ والمنشور لا يعود", () => {
    const plan = planShorts({
      from: "2026-11-23", days: 3, perDay: 2, items: ep("001", 6, "2026-11-20"), published: ["001#1"],
      calendar: { "2026-11-23": { shorts: [{ ep: "001", n: 5 }] }, "2026-11-24": { off: true } },
    });
    expect(plan.map((d) => [ids(d), d.manual])).toEqual([[["001#5"], true], [[], true], [["001#2", "001#3"], false]]);
  });
});

describe("صيغة عنوان كل قناة", () => {
  it("بالإسلام: سؤال من حياة المشاهد", () => {
    expect(formulaProblem("balislam", "كيف تعرف أنك على حق؟")).toBeNull();
    expect(formulaProblem("balislam", "هل تؤجل ما يهمك؟ | عادات القلب", { series: "عادات القلب" })).toBeNull();
    expect(formulaProblem("balislam", "اعرف الحق")).toMatch(/سؤال/);
  });
  it("دفاتر الزمن: الموضوع ثم «:» ثم الزاوية، والموضوع قصير", () => {
    expect(formulaProblem("dafatir-alzaman", "آدم عليه السلام: كيف بدأت قصة الإنسان؟")).toBeNull();
    expect(formulaProblem("dafatir-alzaman", "خلق آدم عليه السلام وبداية البشرية")).toMatch(/«:»/);
    expect(formulaProblem("dafatir-alzaman", "قصة طويلة جدًا عن الإنسان منذ أول الخلق: البداية")).toMatch(/٣٠ حرفًا/);
  });
  it("زبدة الكتب: الفكرة ثم «|» ثم اسم الكتاب", () => {
    expect(formulaProblem("zubdat-alkutub", "لماذا نصلي ولا نشعر؟ | أول مرة أصلي", { book: "أول مرة أصلي" })).toBeNull();
    expect(formulaProblem("zubdat-alkutub", "لماذا نصلي ولا نشعر؟", { book: "أول مرة أصلي" })).toMatch(/«\|»/);
    expect(formulaProblem("zubdat-alkutub", "لماذا نصلي ولا نشعر؟ | كتاب آخر", { book: "أول مرة أصلي" })).toMatch(/اسم الكتاب/);
  });
  it("مثال كل صيغة يحققها، وقناة بلا صيغة لا تُفحص", () => {
    for (const [ch, f] of Object.entries(TITLE_FORMULAS)) expect(formulaProblem(ch, f.example, { book: "أول مرة أصلي" }), ch).toBeNull();
    expect(formulaProblem("other", "أي عنوان")).toBeNull();
  });
  it("مخالفة الصيغة تنبيه في الحزمة لا خطأ يمنعها", () => {
    const kit = { version: 1, generatedBy: "edited", updatedAt: "", shorts: [],
      long: { titles: [{ text: "خلق آدم عليه السلام وبداية البشرية", angle: "" }], description: "عرفت الأرض أممًا كثيرة وتعاقبت عليها الأجيال.\n\n#دفاتر_الزمن",
        tags: ["دفاتر_الزمن", "التاريخ"], hashtags: ["#دفاتر_الزمن"], pinnedComment: "ما الذي توقفت عنده أكثر؟", thumbnailTexts: [], facebook: "عرفت الأرض أممًا كثيرة. ما رأيك؟" } } as PublishKit;
    const i = kitIssues(kit, { channel: "dafatir-alzaman" }).filter((x) => /الصيغة/.test(x.message));
    expect(i.map((x) => x.level)).toEqual(["warning"]);
  });
});
