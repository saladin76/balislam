import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { parseScript } from "../src/script/parse";
import { checkScript, configFromFile } from "../src/script/check";
import { generatePlan } from "../src/plan/generate";
import { loadChannel, domainIds } from "../src/channel";
import { templateFor } from "../src/script/episodes";
import { CHAPTERS_TOKEN, generatePublishKit } from "../src/package/social";
import { isSingleNarration, showsDivision } from "../src/script/divisions";
import { emptyMedia } from "../src/plan/media";

/**
 * «لا فصول، السرد واحد» (طلب صاحب القناة، ١١ نوفمبر، D87) للقنوات الثلاث: الحلقات 001 خطتها قسم واحد بلا عنوان،
 * وقوالب الحلقات الجديدة سرد متصل، والاستوديو لا يعرض «الفصل ١» لقسم بلا عنوان، ووصف النشر بلا قائمة فصول.
 */
const CHANNELS = ["balislam", "dafatir-alzaman", "zubdat-alkutub"] as const;
const EPISODES = {
  balislam: "tests/fixtures/one-narration/balislam",
  "dafatir-alzaman": "tests/fixtures/one-narration/dafatir-alzaman",
  "zubdat-alkutub": "tests/fixtures/one-narration/zubdat-alkutub",
} as const;
const DOMAIN = { balislam: "psychology", "dafatir-alzaman": "islamic", "zubdat-alkutub": "self" } as const;

// Frozen D87 snapshots: owner edits never become hard-coded test expectations.
describe("نسخ الحلقات 001 المحفوظة: سرد واحد بلا فصول", () => {
  it.each(CHANNELS)("%s: السكريبت بلا «## الفصل» والخطة قسم واحد بلا عنوان", (ch) => {
    const script = readFileSync(`${EPISODES[ch]}/script.md`, "utf8");
    expect(script).not.toMatch(/^## (الفصل|الْفَصْلُ)/m);
    const plan = JSON.parse(readFileSync(`${EPISODES[ch]}/plan.json`, "utf8")) as { chapters: { number: number; title: string }[] };
    expect(plan.chapters.map((c) => [c.number, c.title])).toEqual([[1, ""]]);
    expect(isSingleNarration(plan.chapters)).toBe(true);
    const tk = readFileSync(`${EPISODES[ch]}/tashkeel.md`, "utf8");
    expect(tk).not.toMatch(/^## (الفصل|الْفَصْلُ)/m);
  });
  it("بالإسلام 001: لا قائمة فصول في وصف النشر، وبقية الوصف كما هو", () => {
    const kit = JSON.parse(readFileSync(`${EPISODES.balislam}/publish.json`, "utf8")) as { long: { description: string } };
    expect(kit.long.description).not.toContain(CHAPTERS_TOKEN);
    expect(kit.long.description).not.toContain("في هذه الحلقة:");
    expect(kit.long.description.startsWith("كيف تعرف أنك على حق؟\n\nالخطوة العملية:")).toBe(true);
    expect(kit.long.description).toContain("كل المحتوى مراجَع شرعيًا قبل النشر.");
    const research = readFileSync(`${EPISODES.balislam}/research.md`, "utf8");
    expect(research).not.toMatch(/الفصل \d|ستة فصول/);
  });
});

// The live 001 episodes too (review of PR #97): whatever the owner edits, no «## الفصل» heading comes back (D87).
// Only the rule is asserted, never the owner's text: no chapter heading line in the script or tashkeel, and no plan
// division titled or written as a chapter.
const LIVE_001 = {
  balislam: "channels/balislam/episodes/001-know-the-truth",
  "dafatir-alzaman": "channels/dafatir-alzaman/episodes/001-adam-beginning",
  "zubdat-alkutub": "channels/zubdat-alkutub/episodes/001-awwal-marra-osalli",
} as const;
const CHAPTER_HEADING = /^\s*#{1,6}\s*(الفصل|الْفَصْلُ|الفَصْلُ|فصل)(?![\p{L}\p{M}])/mu;
describe("الحلقات 001 الحية: لا عنوان «## الفصل» في السكريبت ولا في الخطة", () => {
  it.each(CHANNELS)("%s", (ch) => {
    const dir = LIVE_001[ch];
    expect(readFileSync(`${dir}/script.md`, "utf8")).not.toMatch(CHAPTER_HEADING);
    if (existsSync(`${dir}/tashkeel.md`)) expect(readFileSync(`${dir}/tashkeel.md`, "utf8")).not.toMatch(CHAPTER_HEADING);
    const plan = JSON.parse(readFileSync(`${dir}/plan.json`, "utf8")) as { chapters: { title?: string; scenes: { narration?: string }[] }[] };
    for (const c of plan.chapters) {
      expect(c.title ?? "").not.toMatch(/^\s*(الفصل|الْفَصْلُ|الفَصْلُ)/u);
      for (const sc of c.scenes) expect(sc.narration ?? "").not.toMatch(CHAPTER_HEADING);
    }
  });
  it("the pattern catches the heading forms D87 removed", () => {
    for (const t of ["## الفصل 1 · البداية", "## الْفَصْلُ الأَوَّلُ", "### فصل 2"]) expect(t).toMatch(CHAPTER_HEADING);
    expect("في هذا الفصل نتعلم").not.toMatch(CHAPTER_HEADING);
  });
});

describe("الحلقات الجديدة: القالب سرد واحد، والنشر بلا فصول", () => {
  it.each(CHANNELS)("%s: القالب يُقرأ قسمًا ضمنيًا واحدًا ويمر على الفحص بلا خطأ أقسام، وخطته قسم واحد", (ch) => {
    const text = readFileSync(templateFor(ch, "script.md")!, "utf8").replace("{{TITLE}}", "كيف نبدأ؟").replace("{{DOMAIN}}", DOMAIN[ch]).replace("{{EPISODE}}", "002");
    const parsed = parseScript(text);
    const channel = loadChannel(ch);
    const r = checkScript(parsed, { ...configFromFile(), domains: domainIds(channel), fixedChapters: channel.script?.fixedChapters, practicalStep: channel.script?.practicalStep });
    expect(r.issues.filter((i) => i.level === "error" && /فصل|قسم|chapter/i.test(`${i.code} ${i.message}`))).toEqual([]);
    expect(r.stats.divisions).toBe(0);
    const plan = generatePlan(parsed, null, {}, channel);
    expect(plan.chapters.map((c) => [c.number, c.title])).toEqual([[1, ""]]);
    const kit = generatePublishKit(plan, text, emptyMedia, channel);
    expect(kit.long.description).not.toContain(CHAPTERS_TOKEN);
    expect(kit.long.description).not.toContain("في هذه الحلقة:");
    for (const sh of kit.shorts) expect(Object.keys(sh)).not.toContain("hook"); // D207: لا خطاف في الشورتس
  });
  it("خطة بأقسام معنونة: قائمة الفصول باقية كما كانت", () => {
    const text = `---\ntitle: "كيف نبدأ؟"\ndomain: psychology\nepisode: "002"\n---\n\n## الفصل 1 · البداية\n\nأ ب ج.\n\n## الفصل 2 · الطريق\n\nد ه و.\n\n## الفصل 3 · الوصول\n\nز ح ط.\n`;
    const plan = generatePlan(parseScript(text), null, {}, loadChannel("balislam"));
    expect(generatePublishKit(plan, text, emptyMedia, loadChannel("balislam")).long.description).toContain(CHAPTERS_TOKEN);
  });
});

describe("showsDivision: لا «الفصل ١» لقسم بلا عنوان في سرد واحد", () => {
  it("قسم واحد بلا عنوان لا يُذكر؛ قسم معنون أو أكثر من قسم يُذكر كما كان", () => {
    expect(showsDivision([{ title: "" }], { title: "" })).toBe(false);
    expect(showsDivision([{ title: "  " }], { title: "  " })).toBe(false);
    expect(showsDivision([{ title: "البداية" }], { title: "البداية" })).toBe(true);
    expect(showsDivision([{ title: "" }, { title: "" }], { title: "" })).toBe(true);
    expect(isSingleNarration([])).toBe(true);
    expect(isSingleNarration([{ title: "" }, { title: "" }])).toBe(false);
  });
});

describe("شاشة النهاية تبقى بتعديلها حين يتغير عدد الأقسام (c6-end ← c1-end)", () => {
  it("تعديل c6-end المحفوظ ينتقل إلى c1-end في التوليد من سكريبت بلا أقسام", () => {
    const ep = EPISODES["zubdat-alkutub"];
    const old = JSON.parse(readFileSync("channels/zubdat-alkutub/episodes/001-awwal-marra-osalli/versions/2026-11-11-cfed78ed-headings/plan.json", "utf8"));
    const end = old.chapters.at(-1).scenes.at(-1);
    expect(end.id).toBe("c6-end");
    expect(end.edited).toBe(true);
    const plan = generatePlan(parseScript(readFileSync(`${ep}/script.md`, "utf8")), old, {}, loadChannel("zubdat-alkutub"));
    const now = plan.chapters[0]!.scenes.at(-1)!;
    expect(now.id).toBe("c1-end");
    expect({ ...now, id: end.id, line: end.line }).toEqual(end);
  });
});
