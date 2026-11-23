import { describe, expect, it } from "vitest";
import { closingSceneId, reviewerIssues, reviewerLine, withClosingCredit, withReviewerLine } from "../src/package/reviewer";
import { resolveDescription } from "../src/package/social";
import { kitTraceHits } from "../src/package/social";

const permission = { date: "2026-11-20", scope: "الأدلة والأحكام في الحلقة", writtenConfirmed: true, recordedAt: "2026-11-23T20:00:00.000Z" };

describe("«راجعها علميًا»: لا يظهر إلا بإذن مكتوب مسجّل لهذه الحلقة", () => {
  it("بلا إذن: لا سطر، والوصف كما هو حرفًا بحرف", () => {
    expect(reviewerLine({ name: "د. فلان" })).toBeNull();
    expect(reviewerLine(undefined)).toBeNull();
    const d = "فقرة.\n\nالخطوة.\n\n#بالإسلام";
    expect(withReviewerLine(d, { name: "د. فلان" })).toBe(d);
    expect(resolveDescription(d, "", { name: "د. فلان" })).toBe(d);
  });
  it("إذن ناقص (بلا تأكيد الإذن المكتوب أو بلا تاريخ أو بلا نطاق): لا يظهر ويُرفض حفظه", () => {
    for (const p of [{ ...permission, writtenConfirmed: false }, { ...permission, date: "" }, { ...permission, scope: " " }]) {
      const r = { name: "د. فلان", permission: p };
      expect(reviewerLine(r)).toBeNull();
      expect(reviewerIssues(r).length).toBeGreaterThan(0);
    }
    expect(reviewerIssues({ name: " ", permission })).toContain("«راجعها علميًا»: الإذن مسجّل بلا اسم المراجع.");
  });
  it("بإذن مكتمل: السطر قبل فقرة الهاشتاجات، ولا يتكرر", () => {
    const r = { name: "د. فلان الفلاني", permission };
    expect(reviewerIssues(r)).toEqual([]);
    expect(reviewerLine(r)).toBe("راجعها علميًا: د. فلان الفلاني");
    const d = "فقرة.\n\nالخطوة.\n\n#بالإسلام";
    expect(withReviewerLine(d, r)).toBe("فقرة.\n\nالخطوة.\n\nراجعها علميًا: د. فلان الفلاني\n\n#بالإسلام");
    expect(withReviewerLine(withReviewerLine(d, r), r)).toBe(withReviewerLine(d, r));
    expect(withReviewerLine("فقرة واحدة.", r)).toBe("فقرة واحدة.\n\nراجعها علميًا: د. فلان الفلاني");
  });
  it("القاعدة الأولى: اسم أداة مكان الاسم يُرفض ويقع في فحص آثار الحزمة", () => {
    const r = { name: "ChatGPT", permission };
    expect(reviewerLine(r)).toBeNull();
    expect(reviewerIssues(r).some((x) => x.includes("القاعدة الأولى"))).toBe(true);
    expect(kitTraceHits({ long: { reviewer: r } }).length).toBeGreaterThan(0);
  });
  it("شاشة النهاية: c<N>-end وإلا آخر مشهد", () => {
    expect(closingSceneId({ chapters: [{ scenes: [{ id: "c1-s1" }, { id: "c1-end" }] }, { scenes: [{ id: "c2-s1" }] }] })).toBe("c1-end");
    expect(closingSceneId({ chapters: [{ scenes: [{ id: "c1-s1" }, { id: "c1-s2" }] }] })).toBe("c1-s2");
    expect(closingSceneId({ chapters: [] })).toBeNull();
  });
});

describe("«راجعها علميًا» في آخر الفيديو: شاشة النهاية وحدها", () => {

  const plan = () => ({ chapters: [{ scenes: [{ id: "c1-s1", props: {} as Record<string, string> }, { id: "c1-end", props: { step: "س" } as Record<string, string> }] }] });
  it("يكتب السطر في شاشة النهاية، ولا يغيّر شيئًا إن كان كما هو، ويحذفه بلا إذن", () => {
    const p = plan();
    expect(withClosingCredit(p, "راجعها علميًا: د. فلان")).toEqual({ changed: true, sceneId: "c1-end" });
    expect(p.chapters[0]!.scenes[1]!.props).toEqual({ step: "س", reviewerCredit: "راجعها علميًا: د. فلان" });
    expect(p.chapters[0]!.scenes[0]!.props).toEqual({});
    expect(withClosingCredit(p, "راجعها علميًا: د. فلان").changed).toBe(false);
    expect(withClosingCredit(p, null)).toEqual({ changed: true, sceneId: "c1-end" });
    expect(p.chapters[0]!.scenes[1]!.props).toEqual({ step: "س" });
    expect(withClosingCredit(p, null).changed).toBe(false);
  });
});
