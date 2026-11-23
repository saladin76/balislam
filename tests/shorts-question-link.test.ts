/**
 * الشورتس (المرحلة ٢ البند ٣): عنوان سؤال ورابط الحلقة؛ وبندا «التغليف» و«الشورتس» لبطاقة الجودة (البند ٦، إلى A).
 * لا يقرأ publish.json لمالك (KI-068): الحزم مكتوبة هنا، والسكريبت من tests/fixtures.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseScript } from "../src/script/parse";
import { generatePlan } from "../src/plan/generate";
import { generatePublishKit, kitToMarkdown, type PublishKit } from "../src/package/social";
import { kitIssues } from "../src/package/quality";
import { EPISODE_LINK_TOKEN, isDuaTitle, isEpisodeUrl, isQuestionTitle, questionFrom, resolveEpisodeLink } from "../src/package/shortsLink";
import { packagingCard, shortsCard } from "../src/package/qualityCard";

const URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

describe("رابط الحلقة", () => {
  it("رابط فيديو يوتيوب فقط", () => {
    for (const u of [URL, "https://youtu.be/dQw4w9WgXcQ", "https://youtube.com/watch?v=dQw4w9WgXcQ&t=30s", "https://m.youtube.com/watch?v=dQw4w9WgXcQ"]) expect(isEpisodeUrl(u), u).toBe(true);
    for (const u of ["", "youtube.com/watch?v=dQw4w9WgXcQ", "https://www.youtube.com/@channel", "https://example.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/short"]) expect(isEpisodeUrl(u), u).toBe(false);
  });
  it("الرمز يصير الرابط؛ وبلا رابط السطر العام كما كان", () => {
    expect(resolveEpisodeLink(`خطاف؟\n\n${EPISODE_LINK_TOKEN}\n\n#وسم`, URL)).toBe(`خطاف؟\n\nالحلقة كاملة: ${URL}\n\n#وسم`);
    expect(resolveEpisodeLink(`خطاف؟\n\n${EPISODE_LINK_TOKEN}`, undefined)).toBe("خطاف؟\n\nالحلقة كاملة على القناة.");
  });
  it("حزمة قديمة بلا الرمز: سطرها العام يصير الرابط، أو يُضاف بعد الخطاف، ولا يتكرر", () => {
    expect(resolveEpisodeLink("خطاف؟\n\nالحلقة كاملة على القناة.\n\n#وسم", URL)).toBe(`خطاف؟\n\nالحلقة كاملة: ${URL}\n\n#وسم`);
    expect(resolveEpisodeLink("خطاف؟\n\n#وسم", URL)).toBe(`خطاف؟\n\nالحلقة كاملة: ${URL}\n\n#وسم`);
    const once = resolveEpisodeLink("خطاف؟\n\n#وسم", URL);
    expect(resolveEpisodeLink(once, URL)).toBe(once);
  });
});

describe("عنوان سؤال", () => {
  it("ينتهي بـ«؟» ولو بعده «| القناة»", () => {
    expect(isQuestionTitle("كيف تعرف أنك على حق؟")).toBe(true);
    expect(isQuestionTitle("متى كانت البداية؟ | دفاتر الزمن")).toBe(true);
    expect(isQuestionTitle("سر الصلاة: الإقبال")).toBe(false);
  });
  it("الدعاء يُعرف فلا يُقترح تحويله إلى سؤال (توقير)", () => {
    expect(isDuaTitle("اللهم أرنا الحق حقًّا")).toBe(true);
    expect(isDuaTitle("ربنا لا تزغ قلوبنا")).toBe(true);
    expect(isDuaTitle("كيف تعرف أنك على حق؟")).toBe(false);
  });
  it("سؤال من نص الشورت: الأقصر الذي يُقرأ وحده، بلا أداة عطف في أوله", () => {
    expect(questionFrom("عرفت الأرض أممًا كثيرة. ولكن هل كل كلمة جارحة حق؟ وما معنى ذلك كله في حياتنا اليوم؟")).toBe("هل كل كلمة جارحة حق؟");
    expect(questionFrom("لماذا؟ جملة بلا سؤال.")).toBeUndefined();
  });
  it("الحزمة الآلية: رمز الرابط في وصف يوتيوب وفيسبوك، لا في إنستجرام", () => {
    const script = readFileSync(path.join(__dirname, "fixtures", "valid.md"), "utf8");
    const kit = generatePublishKit(generatePlan(parseScript(script)), script, undefined);
    for (const s of kit.shorts) {
      expect(s.youtube.description).toContain(EPISODE_LINK_TOKEN);
      expect(s.facebook.caption).toContain(EPISODE_LINK_TOKEN);
      expect(s.instagram.caption).not.toContain(EPISODE_LINK_TOKEN);
    }
    const md = kitToMarkdown({ ...kit, long: { ...kit.long, episodeUrl: URL } }, "حلقة");
    expect(md).not.toContain(EPISODE_LINK_TOKEN);
    expect(md).toContain(`الحلقة كاملة: ${URL}`);
  });
});

const short = (n: number, title: string): PublishKit["shorts"][number] => ({
  chapter: n,
  youtube: { title, description: `خطاف الشورت ${n} هنا.\n\n${EPISODE_LINK_TOKEN}\n\n#دفاتر_الزمن`, hashtags: ["#دفاتر_الزمن"] },
  instagram: { caption: `خطاف الشورت ${n} هنا. ما رأيك؟`, hashtags: ["#دفاتر_الزمن"] },
  facebook: { caption: `خطاف الشورت ${n} هنا. ما رأيك؟`, hashtags: ["#دفاتر_الزمن"] },
});
const kit = (p: Partial<PublishKit["long"]> = {}, shorts = [short(1, "كيف بدأت الحكاية كلها؟"), short(2, "من كان أول إنسان؟")]): PublishKit => ({
  version: 1, generatedBy: "edited", updatedAt: "2026-11-21T00:00:00.000Z",
  long: { titles: [{ text: "خلق آدم عليه السلام وبداية البشرية", angle: "الأساسي" }], description: "عرفت الأرض أممًا كثيرة وتعاقبت عليها الأجيال.\n\n#دفاتر_الزمن",
    tags: ["دفاتر_الزمن", "التاريخ"], hashtags: ["#دفاتر_الزمن"], pinnedComment: "ما الذي توقفت عنده أكثر؟", thumbnailTexts: [], facebook: "عرفت الأرض أممًا كثيرة. ما رأيك؟",
    thumbnails: [{ kind: "title", text: "أول إنسان" }, { kind: "scene", text: "", sceneId: "c1-s4" }, { kind: "question", text: "متى كانت البداية؟" }], ...p },
  shorts,
});

describe("الفحص", () => {
  it("شورت ليس سؤالًا: تنبيه لا يمنع صنع الحلقة؛ والدعاء برسالته", () => {
    const issues = kitIssues(kit({}, [short(1, "سر الصلاة: الإقبال"), short(2, "اللهم أرنا الحق حقًّا")]));
    const mine = issues.filter((i) => /الشورت [12]: العنوان/.test(i.where));
    expect(mine.map((i) => i.level)).toEqual(["warning", "warning"]);
    expect(mine[1]!.message).toMatch(/دعاء لا يُحوَّل إلى سؤال/);
  });
  it("رابط ليس فيديو يوتيوب: خطأ؛ ولا رابط مع وجود شورتس: تنبيه", () => {
    expect(kitIssues(kit({ episodeUrl: "https://example.com/x" })).some((i) => i.where === "رابط الحلقة" && i.level === "error")).toBe(true);
    expect(kitIssues(kit()).filter((i) => i.where === "رابط الحلقة").map((i) => i.level)).toEqual(["warning"]);
    expect(kitIssues(kit({ episodeUrl: URL })).filter((i) => i.where === "رابط الحلقة")).toEqual([]);
  });
});

describe("بطاقة الجودة (إلى A)", () => {
  const ctx = { title: "خلق آدم عليه السلام وبداية البشرية", scenes: [{ id: "c1-s4", sacred: false }] };
  it("كل البنود ✓ حين تكتمل، إلا الأغلفة ما دام «مشهد» و«سؤال» موقوفَين (KI-120)", () => {
    const p = packagingCard(kit({ episodeUrl: URL }), ctx);
    expect(p.items.filter((i) => !i.ok).map((i) => i.id)).toEqual(["thumbnails"]);
    expect(p.items.find((i) => i.id === "thumbnails")!.detail).toMatch(/KI-120/);
    expect(shortsCard(kit({ episodeUrl: URL }))).toMatchObject({ ok: true, missing: [] });
  });
  it("ما ينقص يُسمّى بالعربية، بأسماء بنود ثابتة", () => {
    const p = packagingCard(kit({ thumbnails: undefined }), ctx);
    expect(p.ok).toBe(false);
    expect(p.items.find((i) => i.id === "thumbnails")).toMatchObject({ ok: false, detail: "لم تُكتب" });
    const s = shortsCard(kit({}, [short(1, "سر الصلاة: الإقبال")]));
    expect(s.items.map((i) => [i.id, i.ok])).toEqual([["shorts-exist", true], ["shorts-question", false], ["shorts-link", false]]);
    expect(s.missing).toEqual(["كل شورت بعنوان سؤال: الشورت 1", "رابط الحلقة في وصف كل شورت: يُكتب بعد نشر الحلقة"]);
    expect(shortsCard(kit({}, [])).items[0]).toMatchObject({ id: "shorts-exist", ok: false });
  });
});
