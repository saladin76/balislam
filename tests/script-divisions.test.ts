import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseScript } from "../src/script/parse";
import { checkScript, configFromFile } from "../src/script/check";
import { generatePlan } from "../src/plan/generate";
import { loadChannel, channelInfo, domainIds } from "../src/channel";
import { chapterEyebrow } from "../src/remotion/scenes/eyebrow";
import { shortSegments, segmentPlan } from "../src/plan/shorts";
import { buildSrt } from "../src/package/captions";
import { chaptersText, generatePublishKit } from "../src/package/social";
import { emptyMedia } from "../src/plan/media";
import { scenesOf } from "../src/remotion/scenes/Episode";
import { tashkeelReport, tashkeelDenominatorLine } from "../src/voice/tashkeelReport";
import type { Plan } from "../src/plan/types";

/**
 * الأقسام الإنتاجية اختيارية (0..N) لكل القنوات بقاعدة واحدة، وبيانات الإنتاج لا تصير نصًا منطوقًا ولا ترجمة
 * ولا نصًا على الشاشة (src/script/divisions.ts، src/plan/shorts.ts). D82، اعتمده صاحب المشروع ١١ نوفمبر (D83).
 */
const CHANNELS = ["balislam", "dafatir-alzaman", "zubdat-alkutub"] as const;
const EPISODES: Record<(typeof CHANNELS)[number], string> = {
  balislam: "channels/balislam/episodes/001-know-the-truth",
  "dafatir-alzaman": "channels/dafatir-alzaman/episodes/001-adam-beginning",
  "zubdat-alkutub": "channels/zubdat-alkutub/episodes/001-awwal-marra-osalli",
};
const configFor = (id: string) => {
  const ch = loadChannel(id);
  return { ...configFromFile(), domains: domainIds(ch), fixedChapters: ch.script?.fixedChapters, practicalStep: ch.script?.practicalStep };
};

const CONTINUOUS = `---
title: "كيف تعرف أنك على حق؟"
domain: DOMAIN
episode: "002"
alt_titles: ["أ؟", "ب؟", "ج؟"]
---

في سوق صغير وقف شخصان أمام ميزان واحد.

[مشهد: kinetic-text]
نظر الأول وقال: هذا ظلم.

ونظر الثاني وقال: بل هذا عدل.

## الاستشهادات

- مصدر | مثال للتوضيح

## الخطوة العملية

استمع إلى حجة من يخالفك كاملة.
`;

describe("نص متصل بلا أقسام", () => {
  it("يُقرأ قسمًا ضمنيًا واحدًا بلا عنوان، بلا تنبيه «نص خارج الفصول»", () => {
    const p = parseScript(CONTINUOUS.replace("DOMAIN", "psychology"));
    expect(p.chapters).toHaveLength(1);
    expect(p.chapters[0]).toMatchObject({ number: 1, title: "", implicit: true });
    expect(p.chapters[0]!.blocks.filter((b) => b.kind === "narration")).toHaveLength(3);
    expect(p.parseIssues.map((i) => i.code)).not.toContain("text-outside-chapters");
  });

  for (const id of CHANNELS) {
    it(`${id}: الفحص يقبله بلا خطأ عدد الفصول ولا تنبيه عنوان، والخطة بمعرّفات c1-sN وشاشة نهاية`, () => {
      const ch = loadChannel(id);
      const src = CONTINUOUS.replace("DOMAIN", domainIds(ch)[0]!);
      const parsed = parseScript(src);
      const r = checkScript(parsed, configFor(id));
      const codes = r.issues.map((i) => i.code);
      expect(codes).not.toContain("chapter-count");
      expect(codes).not.toContain("chapter-title");
      expect(codes).not.toContain("chapter-length");
      expect(r.issues.filter((i) => i.level === "error")).toEqual([]);
      expect(r.stats.divisions).toBe(0);
      const plan = generatePlan(parsed, null, {}, ch);
      expect(plan.chapters.map((c) => [c.number, c.title])).toEqual([[1, ""]]);
      expect(plan.chapters[0]!.scenes.map((s) => s.id)).toEqual(["c1-s1", "c1-s2", "c1-s3", "c1-end"]);
      // لا شارة قسم على الشاشة ولا وصف فصول بلا عنوان
      expect(chapterEyebrow(channelInfo(ch), "الفصل", plan.chapters[0]!)).toBeUndefined();
      expect(chaptersText(plan, emptyMedia, channelInfo(ch))).toBe("");
      // لا شورتس تُشتق آليًا من نص متصل
      const pick = shortSegments(plan);
      expect(pick.source).toBe("none");
      expect(pick.segments).toEqual([]);
    });
  }
});

describe("الأقسام 0..N اختيارية بقاعدة واحدة", () => {
  const withDivisions = (n: number, titled = true) => {
    const heads = Array.from({ length: n }, (_, i) => `## الفصل ${i + 1}${titled ? ` · قسم ${i + 1}` : ""}\n\nجملة القسم رقم ${i + 1} هنا.\n`).join("\n");
    return `---\ntitle: "سؤال؟"\ndomain: psychology\nepisode: "003"\n---\n\n${heads}\n## الاستشهادات\n\n- مصدر | مثال\n\n## الخطوة العملية\n\nخطوة.\n`;
  };
  for (const n of [1, 2, 7]) {
    it(`${n} قسم بلا عناوين: لا خطأ عدد ولا تنبيه عنوان افتراضيًا`, () => {
      const r = checkScript(parseScript(withDivisions(n, false)), configFromFile());
      const codes = r.issues.map((i) => i.code);
      expect(codes).not.toContain("chapter-count");
      expect(codes).not.toContain("chapter-title");
      expect(r.stats.divisions).toBe(n);
    });
  }
  it("العدد المفروض لا يكون إلا باختيار صريح (fixedChapters = true)", () => {
    const r = checkScript(parseScript(withDivisions(2)), { ...configFromFile(), fixedChapters: true });
    expect(r.issues.find((i) => i.code === "chapter-count")?.level).toBe("error");
    const ok = checkScript(parseScript(withDivisions(6)), { ...configFromFile(), fixedChapters: true });
    expect(ok.issues.map((i) => i.code)).not.toContain("chapter-count");
  });
  it("لا قناة من الثلاث تفرض العدد ولا تُظهر عنوان القسم على الشاشة (بلا فرع باسم قناة)", () => {
    for (const id of CHANNELS) {
      const s = loadChannel(id).script;
      expect(s?.fixedChapters === true, id).toBe(false);
      expect(s?.divisionTitlesOnScreen === true, id).toBe(false);
    }
  });
});

describe("بيانات الإنتاج لا تصير صوتًا ولا ترجمة ولا نصًا على الشاشة (حلقات 001 للقنوات الثلاث)", () => {
  for (const id of CHANNELS) {
    it(`${id} 001`, () => {
      const ch = loadChannel(id);
      const dir = EPISODES[id];
      const src = readFileSync(`${dir}/script.md`, "utf8");
      const parsed = parseScript(src);
      const stored = JSON.parse(readFileSync(`${dir}/plan.json`, "utf8")) as Plan;
      // الخطة المولَّدة من السكريبت والخطة المحفوظة: النص المنطوق (narration) هو وحده ما يُرسل إلى الصوت
      // (src/voice/generate.ts jobsFor) والترجمة (buildSrt)
      for (const plan of [generatePlan(parsed, stored, {}, ch), stored]) {
        const scenes = plan.chapters.flatMap((c) => c.scenes);
        const shotIds = scenes.map((s) => s.props.shot).filter(Boolean) as string[];
        for (const s of scenes) {
          const n = s.narration;
          expect(n, s.id).not.toMatch(/\[|\]|^#|\bbridge\s*:|\|/m);
          expect(n, s.id).not.toMatch(/\bc\d+-(s\d+|end)\b/);
          expect(n, s.id).not.toMatch(/الفصل\s+[0-9٠-٩]+/);
          expect(n, s.id).not.toMatch(/القارئ\s*:|مشهد\s*:|آية\s*:|استشهاد\s*:/);
          for (const shot of shotIds) expect(n.includes(shot), `${s.id} ← ${shot}`).toBe(false);
        }
        const srt = buildSrt(plan, scenesOf({ plan }).map((x) => x.scene), emptyMedia);
        expect(srt).not.toMatch(/\[|\]|##|bridge|القارئ|c\d+-s\d+/);
        expect(srt).not.toMatch(/الفصل\s+[0-9٠-٩]+\s*·/);
        for (const shot of shotIds) expect(srt.includes(shot)).toBe(false);
        // الشارة أعلى المشهد: لا عنوان قسم على الشاشة في أي قسم
        for (const c of plan.chapters) expect(chapterEyebrow(channelInfo(ch), "الفصل", c), `${id} ${c.number}`).toBeUndefined();
      }
    });
  }
});

describe("الشورتس من مقاطع الخطة لا من عدد الأقسام", () => {
  const plan = (): Plan => ({
    version: 1, episode: "009", title: "ت", domain: "psychology" as Plan["domain"], themeId: "night" as Plan["themeId"], updatedAt: "",
    chapters: [
      { number: 1, title: "أ", scenes: [{ id: "c1-s1", template: "kinetic-text", narration: "أولى.", line: 1, props: {}, sfx: [] }, { id: "c1-s2", template: "kinetic-text", narration: "ثانية.", line: 2, props: {}, sfx: [] }] },
      { number: 2, title: "ب", scenes: [{ id: "c2-s1", template: "kinetic-text", narration: "ثالثة.", line: 3, props: {}, sfx: [] }, { id: "c2-end", template: "end-screen", narration: "", line: 4, props: {}, sfx: [] }] },
    ],
  });
  it("الخطة القديمة بلا مقاطع: شورت لكل قسم كما كان", () => {
    const pick = shortSegments(plan());
    expect(pick.source).toBe("divisions");
    expect(pick.segments.map((s) => [s.chapter, s.sceneIds])).toEqual([[1, ["c1-s1", "c1-s2"]], [2, ["c2-s1"]]]);
    const sp = segmentPlan(plan(), pick.segments[1]!);
    expect(sp.chapter).toBe(2);
    expect(scenesOf(sp).map((x) => x.scene.id)).toEqual(["c2-s1"]);
  });
  it("المقاطع المختارة تعبر الأقسام، بلا شاشة النهاية، ومشهد غير موجود يُرفض بسبب", () => {
    const p = { ...plan(), shorts: [{ from: "c1-s2", to: "c2-s1", title: "عنوان للنشر" }, { from: "c9-s1", to: "c1-s1" }] };
    const pick = shortSegments(p);
    expect(pick.source).toBe("plan");
    expect(pick.segments).toEqual([{ n: 1, title: "عنوان للنشر", sceneIds: ["c1-s2", "c2-s1"] }]);
    expect(pick.issues.join(" ")).toContain("c9-s1");
    const sp = segmentPlan(p, { n: 1, title: "", sceneIds: ["c1-s2", "c2-s1"] });
    expect(sp.plan.chapters).toHaveLength(1);
    expect(sp.plan.chapters[0]!.title).toBe("");
    expect(scenesOf(sp).map((x) => x.scene.id)).toEqual(["c1-s2", "c2-s1"]);
    // حزمة النشر تأخذ المقاطع نفسها
    const kit = generatePublishKit(p, `---\ntitle: "ت؟"\ndomain: psychology\nepisode: "009"\n---\n`, emptyMedia);
    expect(kit.shorts).toHaveLength(1);
  });
  it("إعادة توليد الخطة تُبقي مقاطع المالك", () => {
    const ch = loadChannel("balislam");
    const parsed = parseScript(CONTINUOUS.replace("DOMAIN", domainIds(ch)[0]!));
    const first = generatePlan(parsed, null, {}, ch);
    const again = generatePlan(parsed, { ...first, shorts: [{ from: "c1-s1", to: "c1-s2" }] }, {}, ch);
    expect(again.shorts).toEqual([{ from: "c1-s1", to: "c1-s2" }]);
  });
});

describe("مقام التشكيل: مفحوصة X من Y، مستبعدة Z مع السبب", () => {
  it("يعدّ الحروف التي لا يلتبس نطقها والرموز بلا حرف عربي", () => {
    const idx = { plain: ["كتب", "الدرس"], voweled: ["كَتَبَ", "الدَّرْسَ"] };
    const r = tashkeelReport([{ id: "a", narration: "في عام ٢٠٢٠ كتب الدرس — ثم" }], idx);
    expect(r.spoken).toBe(7);
    expect(r.words).toBe(3);
    expect(r.excluded).toMatchObject({ plain: 2, plainWords: { "في": 1, "ثم": 1 }, nonArabic: 2 });
    const line = tashkeelDenominatorLine({ ...r, skipped: { verseScenes: 2, silentScenes: 1, managedScenes: 0 } });
    expect(line).toContain("مفحوصة 3 من 7 كلمة منطوقة، مستبعدة 4");
    expect(line).toContain("2 مشهد آية");
  });
});
