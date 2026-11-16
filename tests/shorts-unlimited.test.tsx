/**
 * D151 (طلب المالك ١٦ نوفمبر: «خلي عدد الشورتس او الريلز داخل الاستديو غير محدود»): لا حد لعدد الشورتس في الحلقة.
 * كان الحد ستة في خمسة أماكن (فحص المقاطع، اختيار المقاطع للرندر، نص يوتيوب، حزمة الانتشار، شاشة «مقاطع الشورتس»)،
 * وكانت ثلاثة أماكن تفترض رقمًا من خانة واحدة (`-short-\d.mp4`: قائمة «النشر» وعدّاد الحلقة) أو ستة (تقدم المهمة،
 * والتقويم). هنا ٢٥ شورتًا وأكثر في حلقة واحدة للقنوات الثلاث، والقواعد على كل شورت وحده كما هي:
 * المكرر مرفوض، والعنوان المنشور بلا أثر أدوات، ولا عنوانان متطابقان في حزمة الانتشار.
 * الرحلة الحقيقية (رندر صغير، صوت وهمي، Drive مؤقت) في tests/e2e/many-shorts.test.ts.
 */
import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { checkShortsInput, shortFileNumber, shortSegments, shortsScenes, sortShortFiles } from "../src/plan/shorts";
import { findTraces } from "../src/package/traces";
import { buildYoutubeText } from "../src/package/youtube";
import { generatePublishKit } from "../src/package/social";
import { kitIssues } from "../src/package/quality";
import { loadChannel } from "../src/channel/index";
import { ShortsPicker, moveShort, shortsCountLabel } from "../app/src/tabs/ShortsPicker";
import { episodeShortsCount } from "../app/src/tabs/OpsRoom";
import { progressFrom, type LongJob } from "../app/server/jobQueue";
import type { Plan, PlanScene, PlanShort } from "../src/plan/types";

const repo = path.resolve(import.meta.dirname, "..");
const CHANNELS = ["balislam", "dafatir-alzaman", "zubdat-alkutub"] as const;
const WORDS = ["الصبر", "العمل", "الوقت", "الأمل", "الصدق", "العلم", "الطريق", "البداية"];
const scene = (id: string, narration: string, template = "alley-tale"): PlanScene => ({ id, template, line: 1, narration, sfx: [], props: {} } as PlanScene);
/** حلقة بثمانية مشاهد متكلَّمة في قسم واحد (نص متصل) وشاشة النهاية */
const plan = (channel: string): Plan => ({
  version: 1, episode: "987", title: "حلقة الشورتس الكثيرة", domain: "general", themeId: "x", channel, lang: "ar", updatedAt: "2026-11-16T00:00:00.000Z",
  chapters: [{ number: 1, title: "", scenes: [
    ...WORDS.map((w, i) => scene(`c1-s${i + 1}`, `هذه جملة عن ${w} في المشهد ${i + 1}، وفيها فكرة واحدة واضحة.`)),
    scene("c1-end", "", "end-screen"),
  ] }],
} as unknown as Plan);

/** ٢٥ مقطعًا مختلفًا من ثمانية مشاهد: الأفراد (٨)، والأزواج (٧)، والثلاثيات (٦)، والرباعيات (٤) */
const ranges = (n = 8): [number, number][] => [
  ...Array.from({ length: n }, (_, i) => [i, i] as [number, number]),
  ...Array.from({ length: n - 1 }, (_, i) => [i, i + 1] as [number, number]),
  ...Array.from({ length: n - 2 }, (_, i) => [i, i + 2] as [number, number]),
  ...Array.from({ length: 4 }, (_, i) => [i, i + 3] as [number, number]),
];
const many = (): PlanShort[] => ranges().map(([a, b], k) => ({ from: `c1-s${a + 1}`, to: `c1-s${b + 1}`, title: `${WORDS[a]} و${WORDS[b]}: الدرس رقم ${k + 1}` }));

describe("لا حد لعدد الشورتس (المحرك)", () => {
  for (const ch of CHANNELS) {
    it(`${ch}: ٢٥ شورتًا تُقبل وتُرندر كلها بأرقامها، وتظهر في نص يوتيوب وحزمة الانتشار`, () => {
      const p = plan(ch);
      const input = many();
      expect(input).toHaveLength(25);
      const c = checkShortsInput(p, input, findTraces);
      expect(c.errors).toEqual([]);
      expect(c.shorts).toHaveLength(25);
      const pick = shortSegments({ ...p, shorts: c.shorts });
      expect(pick.issues).toEqual([]);
      expect(pick.segments.map((s) => s.n)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
      expect(pick.segments.at(-1)!.sceneIds).toEqual(["c1-s4", "c1-s5", "c1-s6", "c1-s7"]);
      const withShorts = { ...p, shorts: c.shorts };
      const channel = loadChannel(ch);
      const media = { mode: "file", base: "", voice: {}, sfx: {}, recitations: {} } as never;
      const yt = buildYoutubeText(withShorts, `---\ntitle: "${p.title}"\n---\n`, media, channel);
      expect(yt).toContain("### الشورت 25 ·");
      expect(yt).not.toContain("### الشورت 26");
      const kit = generatePublishKit(withShorts, `---\ntitle: "${p.title}"\n---\n`, media, channel);
      expect(kit.shorts).toHaveLength(25);
      // القاعدة على كل شورت كما هي: عنوان كل شورت غير عنوان غيره
      expect(kitIssues(kit).filter((i) => /العنوان نفسه في الشورت/.test(i.message))).toEqual([]);
    });
  }
  it("القواعد على كل شورت باقية مع الكثرة: المكرر مرفوض، والعنوان بأثر أدوات مرفوض، بلا رسالة «أكثر عدد»", () => {
    const p = plan("balislam");
    const list = [...many(), { from: "c1-s1", to: "c1-s1" }];
    const dup = checkShortsInput(p, list, findTraces);
    expect(dup.errors).toHaveLength(1);
    expect(dup.errors[0]).toMatch(/الشورت 26: المقطع نفسه مكرر/);
    const trace = checkShortsInput(p, [...many(), { from: "c1-s5", to: "c1-s8", title: "صُنع بـ ElevenLabs" }], findTraces);
    expect(trace.errors.join(" ")).toMatch(/الشورت 26: العنوان يكشف أدوات الإنتاج/);
    // ستون مقطعًا (كل المقاطع المختلفة من عشرة مشاهد إلا واحدًا): لا حد
    const ten = { ...p, chapters: [{ ...p.chapters[0]!, scenes: Array.from({ length: 11 }, (_, i) => scene(`c1-s${i + 1}`, `جملة ${i + 1}.`)) }] } as Plan;
    const all: PlanShort[] = [];
    for (let a = 0; a < 11; a++) for (let b = a; b < 11; b++) all.push({ from: `c1-s${a + 1}`, to: `c1-s${b + 1}` });
    expect(all.length).toBe(66);
    expect(checkShortsInput(ten, all).errors).toEqual([]);
    expect(shortSegments({ ...ten, shorts: all }).segments).toHaveLength(66);
    expect(readFileSync(path.join(repo, "src/plan/shorts.ts"), "utf8")).not.toMatch(/أكثر عدد للشورتس|export const SHORTS_MAX/);
  });
  it("الخطة القديمة بأقسام: شورت لكل قسم بلا قص عند السادس", () => {
    const p = { ...plan("balislam"), chapters: Array.from({ length: 9 }, (_, i) => ({ number: i + 1, title: `قسم ${i + 1}`, scenes: [scene(`c${i + 1}-s1`, `جملة ${i + 1}.`)] })) } as Plan;
    const pick = shortSegments(p);
    expect(pick.source).toBe("divisions");
    expect(pick.segments.map((s) => s.chapter)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});

describe("أسماء الملفات بأرقام بلا خانات ثابتة", () => {
  it("رقم الشورت من اسمه، والترتيب عددي (2 قبل 10)، والترجمة تُعرف أيضًا", () => {
    expect(shortFileNumber("987-short-12.mp4")).toBe(12);
    expect(shortFileNumber("987-short-3.ar.srt")).toBe(3);
    expect(shortFileNumber("987-episode.mp4")).toBeNull();
    expect(shortFileNumber("987-thumbnail-1.png")).toBeNull();
    const names = ["987-short-10.mp4", "987-short-2.mp4", "987-episode.mp4", "987-short-1.mp4", "987-short-25.mp4", "987-short-3.ar.srt"];
    expect(sortShortFiles(names)).toEqual(["987-short-1.mp4", "987-short-2.mp4", "987-short-10.mp4", "987-short-25.mp4"]);
    expect(sortShortFiles(names.map((name) => ({ name }))).map((f) => f.name)).toEqual(["987-short-1.mp4", "987-short-2.mp4", "987-short-10.mp4", "987-short-25.mp4"]);
  });
  it("«النشر» وعدّاد الحلقة يعدّان `-short-12.mp4` (لا خانة واحدة)، وصناعة الشورتس تحذف ما زاد عن المقاطع المحفوظة", () => {
    const tab = readFileSync(path.join(repo, "app/src/tabs/PublishTab.tsx"), "utf8");
    expect(tab).not.toMatch(/-short-\\d\\\.mp4/);
    expect(tab).toContain("sortShortFiles(files)");
    expect(tab).not.toContain("الشورتس الستة");
    const overview = readFileSync(path.join(repo, "app/server/routes/overview.ts"), "utf8");
    expect(overview).not.toMatch(/-short-\\d\\\.mp4/);
    const pkg = readFileSync(path.join(repo, "src/package/package.ts"), "utf8");
    expect(pkg).toMatch(/k !== null && k > shorts\.length/);
    expect(pkg).not.toMatch(/shortSegments\(plan, /);
  });
});

describe("تقدم مهمة الشورتس بعددها", () => {
  const job = (): LongJob => ({ kind: "shorts", pct: 0 } as LongJob);
  it("الشورت n من N يأخذ نصيبه من 80→98%، لا يتجاوز 98، ويتقدم بالترتيب حتى الخامس والعشرين", () => {
    const seen: number[] = [];
    for (let n = 1; n <= 25; n++) {
      const j = job();
      progressFrom(j, `FRAMES الشورت ${n} من 25 50`);
      seen.push(j.pct);
      const k = job();
      progressFrom(k, `الشورت ${n} من 25: 40%`);
      expect(k.pct).toBeGreaterThanOrEqual(80);
      expect(k.pct).toBeLessThanOrEqual(98);
    }
    for (let i = 1; i < seen.length; i++) expect(seen[i]!).toBeGreaterThan(seen[i - 1]!);
    expect(seen.at(-1)!).toBeLessThanOrEqual(98);
    // السطر القديم بلا «من N» (ستة) يبقى مفهومًا
    const old = job();
    progressFrom(old, "FRAMES الشورت 3 50");
    expect(old.pct).toBeCloseTo(87.5, 1);
  });
});

describe("التقويم: شورتس الحلقة بعددها", () => {
  it("عدد شورتس الحلقة ما في خطتها أو ما صُنع، أيهما أكثر (لا ستة)", () => {
    expect(episodeShortsCount({ package: { video: true, shorts: 0, planned: 25, thumbnails: 3, updatedAt: null } })).toBe(25);
    expect(episodeShortsCount({ package: { video: true, shorts: 12, planned: 8, thumbnails: 3, updatedAt: null } })).toBe(12);
    expect(episodeShortsCount({ package: { video: false, shorts: 0, thumbnails: 0, updatedAt: null } })).toBe(0);
    const ops = readFileSync(path.join(repo, "app/src/tabs/OpsRoom.tsx"), "utf8");
    expect(ops).not.toMatch(/\[1, 2, 3, 4, 5, 6\]|x\.n <= 6|n <= 6\)|Math\.min\(6,/);
  });
});

describe("الواجهة: ثلاثون شورتًا وأكثر", () => {
  const p = plan("balislam");
  const thirty: PlanShort[] = [...many(), { from: "c1-s5", to: "c1-s8" }, { from: "c1-s1", to: "c1-s5" }, { from: "c1-s2", to: "c1-s6" }, { from: "c1-s3", to: "c1-s7" }, { from: "c1-s4", to: "c1-s8" }];
  const read = { saved: thirty, suggested: [], divisions: 1, titleMax: 100, scenes: shortsScenes(p, () => 10) };
  it("كل الصفوف مرقّمة بلا «من ٦»، و«أضف شورتًا» متاح، و«الموضع» لكل صف", () => {
    expect(checkShortsInput(p, thirty).errors).toEqual([]);
    const t0 = performance.now();
    const html = renderToStaticMarkup(<ShortsPicker episodeId="987" approved initial={read} />);
    const ms = performance.now() - t0;
    expect(ms, "rendering 30 rows stays fast").toBeLessThan(1500);
    expect((html.match(/class="shp-row/g) ?? []).length).toBe(30);
    expect(html).toContain('data-short="30"');
    expect(html).toContain("٣٠ شورتًا");
    expect(html).not.toMatch(/من ٦|من 6/);
    expect(html).toContain("لا حد لعددها");
    expect(html).toMatch(/<button type="button" class="btn">أضف شورتًا<\/button>/);
    expect(html).toContain('aria-label="موضع الشورت ٣٠"');
    expect((html.match(/>الموضع ٣٠</g) ?? []).length).toBe(30);
    expect(html).toContain('aria-label="عنوان الشورت ٢٥"');
  });
  it("النقل إلى أي موضع، والعدّ بالعربية الصحيحة", () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ key: i + 1 }));
    expect(moveShort(rows, 30, 0).map((r) => r.key).slice(0, 3)).toEqual([30, 1, 2]);
    expect(moveShort(rows, 1, 29).map((r) => r.key).slice(-2)).toEqual([30, 1]);
    expect(moveShort(rows, 5, 4)).toBe(rows);
    expect(moveShort(rows, 99, 0)).toBe(rows);
    expect([0, 1, 2, 3, 10, 11, 25, 100, 103].map(shortsCountLabel)).toEqual(
      ["لا شورتس", "شورت واحد", "شورتان", "٣ شورتس", "١٠ شورتس", "١١ شورتًا", "٢٥ شورتًا", "١٠٠ شورت", "١٠٣ شورتس"]);
  });
  it("رقم الصف يتسع لثلاث خانات، والصفحة وحدها المتمرِّر (D64)", () => {
    const css = readFileSync(path.join(repo, "app/src/tabs/shorts.css"), "utf8");
    expect(css).toMatch(/\.shp-n \{[^}]*min-width: 28px/);
    expect(css).not.toMatch(/overflow(-y)?:\s*(auto|scroll)/);
  });
});
