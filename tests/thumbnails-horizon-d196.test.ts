/**
 * D196 (قرار المالك ٢٢ نوفمبر: «الأغلفة الثلاثة الآن، الاتجاه معتمد»): رفع إيقاف KI-120 لأسلوب «دفتر الأفق» (دفاتر الزمن)،
 * وبقاؤه لغيره. المدخلات مكتوبة هنا، لا حلقة حية (KI-068).
 */
import { describe, expect, it } from "vitest";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { renderableConcepts, thumbHoldFor, thumbnailIssues, type ThumbnailConcept } from "../src/package/thumbnails";
import { packagingCard } from "../src/package/qualityCard";
import type { PublishKit } from "../src/package/social";

const TITLE = "خلق آدم عليه السلام وبداية البشرية";
const scenes = [{ id: "c1-s1", sacred: false }, { id: "c1-s2", sacred: true }, { id: "c1-s3", sacred: false }];
const good: ThumbnailConcept[] = [
  { kind: "title", text: "أول إنسان" },
  { kind: "scene", text: "قبل المدن", sceneId: "c1-s3", atSeconds: 4 },
  { kind: "question", text: "متى بدأت؟" },
];

describe("D196: «دفتر الأفق» يرسم الأغلفة الثلاثة، والأساليب الأخرى موقوف فيها «مشهد» و«سؤال» (KI-120)", () => {
  it("الترتيب الثابت للملفات، والإيقاف لغير «دفتر الأفق» كما كان", () => {
    expect(renderableConcepts([good[2]!, good[1]!, good[0]!], "horizon").render.map((c) => c.kind)).toEqual(["title", "scene", "question"]);
    expect(thumbHoldFor("horizon")).toEqual({});
    for (const style of [undefined, "mihrab", "highlighter", "circle"]) expect(Object.keys(thumbHoldFor(style)).sort()).toEqual(["question", "scene"]);
    expect(renderableConcepts(good).held.map((c) => c.kind)).toEqual(["scene", "question"]);
  });
  it("بطاقة الجودة: بند الأغلفة يكتمل لـ«دفتر الأفق» بأغلفة سليمة، ويبقى ناقصًا لغيره", () => {
    const kit = { version: 1, generatedBy: "edited", updatedAt: "", shorts: [],
      long: { titles: [{ text: TITLE, angle: "" }], description: "", tags: [], hashtags: [], pinnedComment: "", thumbnailTexts: [], facebook: "", thumbnails: good } } as unknown as PublishKit;
    const item = (style?: string) => packagingCard(kit, { title: TITLE, scenes, thumbStyle: style }).items.find((i) => i.id === "thumbnails")!;
    expect(item("horizon").ok).toBe(true);
    expect(item("mihrab").ok).toBe(false);
    expect(item(undefined).ok).toBe(false);
  });
  it("v2 (ملاحظة المالك): الأغلفة الثلاثة من صور الحلقة، بلا سماء متدرجة ولا نجوم ولا ظل مموّه ولا وهج، وثلاثة تخطيطات مختلفة", async () => {
    const code = await readFile(path.join(import.meta.dirname, "..", "src/remotion/Thumbnail.tsx"), "utf8");
    const part = (name: string) => { const a = code.indexOf(`const ${name}`); return code.slice(a, code.indexOf("\n};", a)); };
    const names = ["HorizonTitleFrameThumb", "HorizonSceneThumb", "HorizonQuestionThumb"];
    for (const name of names) {
      const c = part(name);
      expect(c.length, name).toBeGreaterThan(200);
      expect(c, name).not.toMatch(/linear-gradient|radial-gradient|textShadow|blur\(|drop-shadow|<circle/);
      expect(c, name).toMatch(/<FramePhoto /);
    }
    // ثلاثة تخطيطات: صورة يسار وكلمات يمين / صورة كاملة وشريط أحمر / صورة أعلى وسؤال أسفل
    expect(part("HorizonTitleFrameThumb")).toMatch(/width: 800, height: 720/);
    expect(part("HorizonSceneThumb")).toMatch(/background: RED/);
    expect(part("HorizonQuestionThumb")).toMatch(/height: 440/);
  });
  it("بؤرة اللقطة: تملأ الإطار ولا تُظهر شريط الترجمة المحروق، وتُفحص حدودها", async () => {
    const { focusBox, SCENE_CAPTION_BAND } = await import("../src/remotion/Thumbnail");
    const b = focusBox(1280, 560, { x: 0.8, y: 0.5, zoom: 1.6 });
    expect(b.left).toBeLessThanOrEqual(0); expect(b.left + b.iw).toBeGreaterThanOrEqual(1280);
    expect(b.top).toBeLessThanOrEqual(0); expect(b.top + b.ih * (1 - SCENE_CAPTION_BAND)).toBeGreaterThanOrEqual(560 - 1e-6);
    const bad = thumbnailIssues([good[0]!, { ...good[1]!, focus: { x: 2, y: 0.5, zoom: 1 } }, good[2]!], { titles: [TITLE], scenes });
    expect(bad.some((i) => i.level === "error" && /بؤرة/.test(i.message))).toBe(true);
    const sacred = thumbnailIssues([{ ...good[0]!, sceneId: "c1-s2" }, good[1]!, good[2]!], { titles: [TITLE], scenes });
    expect(sacred.some((i) => i.level === "error" && /آية/.test(i.message))).toBe(true);
  });
  it("التصميمان بلا تدرّج خلف الكلمات ولا ظل نص مموّه ولا وهج، وغلاف المشهد يقص شريط الترجمة المحروق", async () => {
    const code = await readFile(path.join(import.meta.dirname, "..", "src/remotion/Thumbnail.tsx"), "utf8");
    const part = (name: string) => { const a = code.indexOf(`const ${name}`); return code.slice(a, code.indexOf("\n};", a)); };
    expect(part("focusBox")).toMatch(/SCENE_CAPTION_BAND/);
    const { SCENE_CAPTION_BAND } = await import("../src/remotion/Thumbnail");
    expect(SCENE_CAPTION_BAND).toBeGreaterThan(0.2);
  });
});

describe("D196 v4: لقطة الغلاف من Master الـ4K حين يكون أحدث من فيديو المشهد", () => {
  it("بداية المشهد في Master = المقدمة (لا أكثر منها) + أطوال المشاهد قبله", async () => {
    const { masterSceneStart } = await import("../src/package/thumbnailFrame");
    const ids = ["a", "b", "c"], cuts = { a: 10, b: 20, c: 5 };
    expect(masterSceneStart(ids, cuts, "a", 35, 0)).toBe(0);
    expect(masterSceneStart(ids, cuts, "c", 35, 0)).toBe(30);
    expect(masterSceneStart(ids, cuts, "c", 38, 3)).toBe(33);
    expect(masterSceneStart(ids, cuts, "b", 50, 3)).toBe(13);
    expect(masterSceneStart(ids, cuts, "x", 35, 0)).toBeNull();
    expect(masterSceneStart(ids, { a: 10, b: 20 }, "a", 35, 0)).toBeNull();
  });
  it("Master أقدم من فيديو المشهد (أُعيد المشهد بعده) أو بلا موضع: فيديو المشهد نفسه", async () => {
    const { useMasterFrame } = await import("../src/package/thumbnailFrame");
    expect(useMasterFrame({ masterMtimeMs: 2, cutMtimeMs: 1, start: 4 })).toBe(true);
    expect(useMasterFrame({ masterMtimeMs: 1, cutMtimeMs: 2, start: 4 })).toBe(false);
    expect(useMasterFrame({ cutMtimeMs: 1, start: 4 })).toBe(false);
    expect(useMasterFrame({ masterMtimeMs: 2, cutMtimeMs: 1, start: null })).toBe(false);
  });
});

describe("D196 v5: الأغلفة من رندر 4K — Master، ثم لقطة 4K للمشهد، ثم فيديو المشهد آخرًا", () => {
  it("ترتيب المصدر", async () => {
    const { pickFrameSource } = await import("../src/package/thumbnailFrame");
    expect(pickFrameSource({ masterUsable: true, still: true })).toBe("master");
    expect(pickFrameSource({ masterUsable: true, still: false })).toBe("master");
    expect(pickFrameSource({ masterUsable: false, still: true })).toBe("still");
    expect(pickFrameSource({ masterUsable: false, still: false })).toBe("cut");
  });
  it("لقطة 4K من خطة المشهد نفسها كما يُرندر فيديوه: مشهد واحد، والمقدمة فقط إن كان أول الحلقة", async () => {
    const { sceneCutPlan, stillFrameAt } = await import("../src/package/sceneStill");
    const s = (id: string) => ({ id, template: "x", narration: "", props: {} });
    const full = { title: "t", chapters: [{ number: 1, title: "a", scenes: [s("c1-s1"), s("c1-s2")] }, { number: 2, title: "b", scenes: [s("c2-s1")] }] } as never;
    const first = sceneCutPlan(full, "c1-s1")!;
    expect(first.chapters.flatMap((c) => c.scenes.map((x) => x.id))).toEqual(["c1-s1"]);
    expect("intro" in first && (first as { intro?: unknown }).intro === false).toBe(false);
    const later = sceneCutPlan(full, "c2-s1")!;
    expect(later.chapters.map((c) => c.number)).toEqual([2]);
    expect((later as { intro?: unknown }).intro).toBe(false);
    expect(sceneCutPlan(full, "nope")).toBeNull();
    expect(stillFrameAt(14, 900)).toBe(420);
    expect(stillFrameAt(40, 900)).toBe(899);
    expect(stillFrameAt(-1, 900)).toBe(0);
  });
  it("D196 v6 (بعد D207): لقطة الغلاف من خطة المشهد نفسه، والمشهد اللاحق يبدأ من إطاره الأول ولا خطاف في أي قناة", async () => {
    const { sceneCutPlan } = await import("../src/package/sceneStill");
    const { cutPlans } = await import("../src/plan/sceneCut");
    const s = (id: string) => ({ id, template: "x", narration: "", props: {}, sfx: [] });
    const full = { title: "t", coldOpen: { scene: "c1-s3", words: 6, to: 3.5 },
      chapters: [{ number: 1, title: "a", scenes: [s("c1-s1"), s("c1-s2"), s("c1-s3")] }] } as never;
    // أول الحلقة: المشهد وحده (لا مصدر خطاف ملحق ولو بقي حقل قديم في الخطة)
    expect(cutPlans(full, ["c1-s1"]).mediaPlan.chapters.flatMap((c) => c.scenes.map((x) => x.id))).toEqual(["c1-s1"]);
    // مشهد لاحق: لا مقدمة، فلحظة الغلاف (atSeconds) من بداية المشهد نفسه
    const later = sceneCutPlan(full, "c1-s2")!;
    expect((later as { intro?: unknown }).intro).toBe(false);
    expect(cutPlans(full, ["c1-s2"]).mediaPlan.chapters.flatMap((c) => c.scenes.map((x) => x.id))).toEqual(["c1-s2"]);
    const { existsSync } = await import("node:fs");
    expect(existsSync(path.join(import.meta.dirname, "..", "src/plan/coldOpen.ts"))).toBe(false);
  });
  it("قاعدة القرآن في رأس قواعد الأغلفة، ولا غلاف «وعود كاذبة» في الكود", async () => {
    const code = await readFile(path.join(import.meta.dirname, "..", "src/package/thumbnails.ts"), "utf8");
    expect(code).toContain("لا غلاف يشطب كلمات من القرآن");
  });
});
