/**
 * العنوان والوصف والفصول (خطة «احترافية بلا مثيل»، المرحلة ٢ البند ٢): العنوان ≤ ٦٠ حرفًا والموضوع في أول ٤٠،
 * والفصول من حدود المشاهد الحقيقية بعد التجميع (sceneSeconds في سجل التجميع، وفيه قصّ البداية headTrimmed).
 * لا يقرأ حلقة حية ولا publish.json لمالك (KI-068): الخطة والحزمة مكتوبتان هنا.
 */
import { describe, expect, it } from "vitest";
import { resolveChapters, sceneStartsFor, chapterMarksText, type ChapterMark } from "../src/package/chapters";
import { chaptersText, checkTitle, keywordsOf, resolveDescription, CHAPTERS_TOKEN, type PublishKit } from "../src/package/social";
import { kitIssues } from "../src/package/quality";
import { buildYoutubeText } from "../src/package/youtube";
import { emptyMedia } from "../src/plan/media";
import type { Plan, PlanScene } from "../src/plan/types";

const scene = (id: string, narration: string): PlanScene => ({ id, template: "horizon-shot", narration, line: 1, props: {}, sfx: [], durationSec: 5 });
const ids = ["c1-s1", "c1-s2", "c1-s3", "c1-s4", "c1-s5", "c1-s6"];
// نص متصل: قسم واحد بلا عنوان («دفاتر الزمن 001»)، فلا فصول من الأقسام
const plan = {
  episode: "321", title: "حلقة للاختبار", channel: "dafatir-alzaman", themeId: "warm", domain: "islamic",
  chapters: [{ number: 1, title: "", scenes: ids.map((id, i) => scene(id, `جملة المشهد ${i + 1} في الحلقة.`)) }],
} as unknown as Plan;
// المشهد الأول بعد قصّ ٣٫١ ث من بدايته (KI-091): مدته في السجل بعد القص
const real = { sceneSeconds: { "c1-s1": 8.4, "c1-s2": 20, "c1-s3": 31.5, "c1-s4": 12, "c1-s5": 40, "c1-s6": 9 } };
const marks: ChapterMark[] = [
  { sceneId: "c1-s1", title: "البداية" },
  { sceneId: "c1-s3", title: "الخلافة في الأرض" },
  { sceneId: "c1-s5", title: "السجود والإباء" },
];

describe("حدود المشاهد الحقيقية", () => {
  it("بعد التجميع: بداية كل مشهد مجموع مدد ما قبله في الملف نفسه (بعد قصّ البداية)", () => {
    const at = sceneStartsFor(plan, emptyMedia, undefined, real);
    expect(at.estimated).toBe(false);
    expect(at.starts["c1-s1"]).toBe(0);
    expect(at.starts["c1-s2"]).toBeCloseTo(8.4);
    expect(at.starts["c1-s3"]).toBeCloseTo(28.4);
    expect(at.starts["c1-s5"]).toBeCloseTo(71.9);
    expect(at.total).toBeCloseTo(120.9);
  });
  it("قبل التجميع (مشهد بلا مقطع): من الخطة، ومعلَّمة تقديرية", () => {
    const { "c1-s6": _, ...partial } = real.sceneSeconds;
    expect(sceneStartsFor(plan, emptyMedia, undefined, { sceneSeconds: partial }).estimated).toBe(true);
  });
});

describe("فصول يوتيوب", () => {
  const at = sceneStartsFor(plan, emptyMedia, undefined, real);
  const errors = (m: ChapterMark[]) => resolveChapters(m, at).issues.filter((i) => i.level === "error").map((i) => i.message);
  it("ثلاثة فصول صحيحة: أوقات من الملف، والأول 0:00", () => {
    expect(resolveChapters(marks, at).issues).toEqual([]);
    expect(chapterMarksText(marks, at)).toBe("فصول الحلقة:\n0:00 البداية\n0:28 الخلافة في الأرض\n1:11 السجود والإباء");
  });
  it("الترتيب بالوقت لا بترتيب الإدخال", () => {
    expect(resolveChapters([marks[2]!, marks[0]!, marks[1]!], at).lines[0]).toBe("0:00 البداية");
  });
  it("أقل من ثلاثة، أو أول فصل ليس من البداية، أو فصل أقل من ١٠ ثوانٍ: لا يعرضها يوتيوب", () => {
    expect(errors(marks.slice(0, 2)).join()).toMatch(/من 3 فأكثر/);
    expect(errors([{ sceneId: "c1-s2", title: "أ" }, ...marks.slice(1)]).join()).toMatch(/0:00/);
    expect(errors([...marks, { sceneId: "c1-s6", title: "الخاتمة" }]).join()).toMatch(/9 ث؛ كل فصل 10/);
    expect(chapterMarksText(marks.slice(0, 2), at)).toBe("");
  });
  it("مشهد ليس في الخطة، أو فصل بلا عنوان، أو أثر أدوات في العنوان: خطأ", () => {
    expect(errors([...marks, { sceneId: "c9-s9", title: "س" }]).join()).toMatch(/ليس في الخطة/);
    expect(errors([marks[0]!, { ...marks[1]!, title: " " }, marks[2]!]).join()).toMatch(/اكتب عنوانه/);
    expect(errors([marks[0]!, { ...marks[1]!, title: "صُنع بـ Remotion" }, marks[2]!]).join()).toMatch(/أثر أدوات/);
  });
  it("النص المتصل بلا اختيار: لا فصول (D87)؛ وباختيار المالك: فصول في الوصف وyoutube.md", () => {
    expect(chaptersText(plan, emptyMedia, undefined, real)).toBe("");
    expect(chaptersText(plan, emptyMedia, undefined, real, marks)).toContain("0:28 الخلافة في الأرض");
    const yt = buildYoutubeText(plan, "---\ntitle: حلقة للاختبار\n---\n\nجملة.\n", emptyMedia, undefined, real, marks);
    expect(yt).toContain("1:11 السجود والإباء");
  });
});

describe("الوصف", () => {
  it("{{الفصول}} يُستبدل؛ والوصف القديم بلا الرمز تُضاف فصوله بعد فقرته الأولى؛ وبلا فصول لا سطر زائد", () => {
    expect(resolveDescription(`خطاف.\n\n${CHAPTERS_TOKEN}\n\nخاتمة.`, "فصول الحلقة:\n0:00 أ")).toBe("خطاف.\n\nفصول الحلقة:\n0:00 أ\n\nخاتمة.");
    expect(resolveDescription("خطاف.\n\nخاتمة.", "فصول الحلقة:\n0:00 أ")).toBe("خطاف.\n\nفصول الحلقة:\n0:00 أ\n\nخاتمة.");
    expect(resolveDescription(`خطاف.\n\n${CHAPTERS_TOKEN}\n\nخاتمة.`, "")).toBe("خطاف.\n\nخاتمة.");
  });
  it("صيغ التوقير ليست وسومًا («عليه السلام» لا تصير #السلام #عليه)", () => {
    const k = keywordsOf("آدم عليه السلام وزوجه. آدم عليه السلام في الأرض. سبحانه وتعالى خلق الأرض.");
    expect(k).not.toContain("السلام");
    expect(k).not.toContain("عليه");
    expect(k).toContain("الأرض");
  });
});

describe("العنوان", () => {
  const kit = (titles: string[], chapters?: ChapterMark[]): PublishKit => ({
    version: 1, generatedBy: "edited", updatedAt: "2026-11-21T00:00:00.000Z",
    long: { titles: titles.map((text) => ({ text, angle: "زاوية" })), description: "عرفت الأرض أممًا كثيرة وتعاقبت عليها الأجيال.\n\n#دفاتر_الزمن",
      tags: ["دفاتر_الزمن", "التاريخ"], hashtags: ["#دفاتر_الزمن"], pinnedComment: "ما الذي توقفت عنده أكثر؟", thumbnailTexts: [], facebook: "عرفت الأرض أممًا كثيرة. ما رأيك؟",
      ...(chapters ? { chapters } : {}) },
    shorts: [],
  });
  it("أكثر من ٦٠ حرفًا: خطأ يمنع الحزمة؛ و٦٠ مقبول", () => {
    const long = "ا".repeat(30) + " " + "ب".repeat(30);
    expect(kitIssues(kit([long])).some((i) => i.level === "error" && /61 حرفًا؛ الحد 60/.test(i.message))).toBe(true);
    expect(kitIssues(kit(["ا".repeat(29) + " " + "ب".repeat(30)])).some((i) => /الحد 60/.test(i.message))).toBe(false);
  });
  it("الموضوع في أول ٤٠ حرفًا (فحص الاستوديو)", () => {
    const late = checkTitle(`${"قصة ".repeat(11)}آدم`, "youtube", ["آدم"]).find((c) => /أول ٤٠/.test(c.label));
    expect(late?.ok).toBe(false);
    expect(checkTitle("آدم عليه السلام وبداية البشرية", "youtube", ["آدم"]).find((c) => /أول ٤٠/.test(c.label))?.ok).toBe(true);
  });
  it("فصول لن تظهر في يوتيوب تمنع الحزمة حين يُعرف توقيت المشاهد", () => {
    const at = sceneStartsFor(plan, emptyMedia, undefined, real);
    expect(kitIssues(kit(["عنوان الحلقة للاختبار هنا"], marks.slice(0, 2)), { starts: at }).some((i) => i.where === "يوتيوب: الفصول" && i.level === "error")).toBe(true);
    expect(kitIssues(kit(["عنوان الحلقة للاختبار هنا"], marks), { starts: at }).filter((i) => i.where === "يوتيوب: الفصول")).toEqual([]);
  });
});
