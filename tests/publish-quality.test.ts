import { describe, expect, it } from "vitest";
import { isGenericTitle, kitIssues, repeatedSentences, truncation } from "../src/package/quality";
import { withoutShortHooks, type PublishKit } from "../src/package/social";

const kit = (patch: (k: PublishKit) => void = () => {}): PublishKit => {
  const k: PublishKit = {
    version: 1,
    generatedBy: "auto",
    updatedAt: "",
    long: { titles: [{ text: "كيف تعرف أنك على حق؟", angle: "" }], description: "وصف الحلقة كاملًا هنا.", tags: ["الحق", "التفكير"], hashtags: ["#بالإسلام"], pinnedComment: "ما الفكرة التي توقفت عندها؟", thumbnailTexts: [], facebook: "شاهد الحلقة كاملة وشاركنا رأيك." },
    shorts: [
      { chapter: 1, youtube: { title: "هل ترى الحقيقة فعلًا؟", description: "هل ترى الحقيقة كما هي فعلًا؟ سؤال الحلقة الأول.", hashtags: ["#الحق"] }, instagram: { caption: "سؤال يستحق التأمل اليوم. ما رأيك؟", hashtags: ["#الحق"] }, facebook: { caption: "ما رأيك في هذا السؤال؟", hashtags: [] } },
    ],
  };
  patch(k);
  return k;
};

describe("فحص جودة حزمة النشر", () => {
  it("حزمة سليمة بلا أخطاء", () => {
    expect(kitIssues(kit()).filter((i) => i.level === "error")).toEqual([]);
  });
  it("العنوان العام «لماذا؟» يُرفض مع اقتراح", () => {
    expect(isGenericTitle("لماذا؟")).toBe(true);
    const i = kitIssues(kit((k) => (k.shorts[0]!.youtube.title = "لماذا؟"))).find((x) => x.where.includes("الشورت 1: العنوان"));
    expect(i?.level).toBe("error");
    expect(i?.suggestion).toBeTruthy();
  });
  it("الجملة المكررة في كابشن إنستجرام تُرفض", () => {
    expect(repeatedSentences("نحن لا نقول فقط هذا. ثم نكمل الكلام هنا. نحن لا نقول فقط هذا.")).toHaveLength(1);
    const issues = kitIssues(kit((k) => (k.shorts[0]!.instagram.caption = "هذا سؤال مهم جدًا اليوم. وهذا شرح قصير. هذا سؤال مهم جدًا اليوم.")));
    expect(issues.some((i) => i.level === "error" && i.message.startsWith("جملة مكررة"))).toBe(true);
  });
  it("النص المبتور: علامة تنصيص مفتوحة أو كلمة ربط في آخره", () => {
    expect(truncation("قال: «اللهم أرنا الحق حقًا")).toBe("error");
    expect(truncation("الصبر مفتاح الفرج و")).toBe("error");
    expect(truncation("الصبر مفتاح…")).toBe("warning");
    expect(truncation("الصبر مفتاح الفرج.")).toBeNull();
  });
  it("الوسوم: المكرر والمقطوع بمسافة خطأ، والعام تنبيه", () => {
    const issues = kitIssues(kit((k) => (k.long.hashtags = ["#الحق", "#الحق", "#اكسبلور"])));
    expect(issues.some((i) => i.level === "error" && i.message.includes("مكرر"))).toBe(true);
    expect(issues.some((i) => i.level === "warning" && i.message.includes("عام"))).toBe(true);
  });
  it("عنوانا شورتين متطابقان خطأ", () => {
    const issues = kitIssues(kit((k) => k.shorts.push({ ...k.shorts[0]!, chapter: 2 })));
    expect(issues.some((i) => i.level === "error" && i.message.includes("في الشورت 1"))).toBe(true);
  });
  it("D207: لا خانة خطاف في الشورتس؛ الحزمة القديمة تُقرأ وتُحذف خانتها عند الحفظ، والاقتراح سؤال من نص الشورت", () => {
    const old = kit((k) => Object.assign(k.shorts[0]!, { hook: "خطاف قديم" }));
    const saved = withoutShortHooks(old);
    expect(Object.keys(saved.shorts[0]!)).not.toContain("hook");
    expect(saved.shorts[0]!.youtube.title).toBe("هل ترى الحقيقة فعلًا؟");
    expect(kitIssues(old).filter((i) => i.level === "error")).toEqual([]);
    const generic = kitIssues(kit((k) => (k.shorts[0]!.youtube.title = "لماذا؟"))).find((x) => x.where.includes("الشورت 1: العنوان"));
    expect(generic?.suggestion).toBe("هل ترى الحقيقة كما هي فعلًا؟");
  });
});
