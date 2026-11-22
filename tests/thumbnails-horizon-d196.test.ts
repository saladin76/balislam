/**
 * D196 (قرار المالك ٢٢ نوفمبر: «الأغلفة الثلاثة الآن، الاتجاه معتمد»): رفع إيقاف KI-120 لأسلوب «دفتر الأفق» (دفاتر الزمن)،
 * وبقاؤه لغيره. المدخلات مكتوبة هنا، لا حلقة حية (KI-068).
 */
import { describe, expect, it } from "vitest";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { renderableConcepts, thumbHoldFor, type ThumbnailConcept } from "../src/package/thumbnails";
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
  it("التصميمان بلا تدرّج خلف الكلمات ولا ظل نص مموّه ولا وهج، وغلاف المشهد يقص شريط الترجمة المحروق", async () => {
    const code = await readFile(path.join(import.meta.dirname, "..", "src/remotion/Thumbnail.tsx"), "utf8");
    const part = (name: string) => { const a = code.indexOf(`const ${name}`); return code.slice(a, code.indexOf("\n};", a)); };
    for (const name of ["HorizonSceneThumb", "HorizonQuestionThumb"]) {
      const c = part(name);
      expect(c.length, name).toBeGreaterThan(200);
      expect(c, name).not.toMatch(/textShadow|blur\(|drop-shadow|radial-gradient/);
    }
    expect(part("HorizonSceneThumb")).toMatch(/SCENE_CAPTION_BAND/);
    const { SCENE_CAPTION_BAND } = await import("../src/remotion/Thumbnail");
    expect(SCENE_CAPTION_BAND).toBeGreaterThan(0.2);
  });
});
