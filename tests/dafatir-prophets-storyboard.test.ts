/**
 * D251: ستوري بورد «الخريطة الحيّة» و«المكان والنور» لحلقات الأنبياء والصحابة في «دفاتر الزمن».
 * - ستة مشاهد بنصها المنطوق حرفًا من خطط 002 و008، ونموذجان لكل مشهد من أسلوبه (أربع مجموعات نماذج)، وبطاقة آية داخل المشهد.
 * - حكم المراجعة العلمية: لا شخصية ولا ظل ولا ضوء ينوب عن أحد، ولا علامة متحركة على المسار، ولا قرص شمس.
 * - لا تصل إلى الإنتاج: «living-map» و«place-light» مقترحان فيرفضهما assertTemplatesApproved.
 * - مجموعة stills مسجَّلة بالقائمة المسموحة وحدها.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  FORBIDDEN_ELEMENTS, NISA_1, NISA_1_KEY, PM_BOARDS, PM_DIRECTION_VARIANTS, PM_ELEMENTS, PM_FOLDER, pmVariantName,
} from "../src/remotion/dafatir/prophets/boards";
import { assertTemplatesApproved, loadApprovals, PROPOSED } from "../src/plan/templateApproval";
import { registryTemplateKeys } from "../src/plan/templateRegistryKeys";
import { STORYBOARD_SETS, buildStillsJob, validateStillsJob } from "../src/render/worker/stillsProtocol";

const root = path.resolve(__dirname, "..");
type Scene = { id: string; narration?: string; props?: Record<string, unknown> };
const scenesOf = (ep: string): Scene[] =>
  JSON.parse(readFileSync(path.join(root, "channels/dafatir-alzaman/episodes", ep, "plan.json"), "utf8")).chapters.flatMap((c: { scenes: Scene[] }) => c.scenes);
/** المصدر بلا تعليقات (الحكم على الكود لا على شرحه) */
const code = (f: string) => readFileSync(path.join(root, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("D251: لوحات «الخريطة الحيّة» و«المكان والنور»", () => {
  it("ستة مشاهد، نموذجان لكل مشهد من أسلوبه، بمعرّفات storyboard- فريدة", () => {
    const scenes = [...new Set(PM_BOARDS.map((b) => b.scene))];
    expect(scenes).toEqual([1, 2, 3, 4, 5, 6]); // owner-pin-ok: ترقيم لوحات الستوري بورد في الكود (boards.ts)
    for (const s of scenes) {
      const bs = PM_BOARDS.filter((b) => b.scene === s);
      expect(bs.map((b) => b.variant)).toEqual(PM_DIRECTION_VARIANTS[bs[0]!.direction]);
    }
    for (const d of ["map", "place"] as const) expect(PM_BOARDS.filter((b) => b.direction === d).length).toBe(6);
    expect(new Set(PM_BOARDS.map((b) => b.composition)).size).toBe(PM_BOARDS.length);
    for (const b of PM_BOARDS) expect(b.composition).toMatch(/^storyboard-dafatir-prophets-s\d-[abcd]$/);
  });

  it("نص كل لوحة هو نص مشهدها في الخطة حرفًا (لا تتغير كلمة من السكريبت)", () => {
    for (const b of PM_BOARDS) {
      const s = scenesOf(b.episode).find((x) => x.id === b.sceneId);
      expect(s, `${b.episode}/${b.sceneId}`).toBeDefined();
      expect(b.narration).toBe(s!.narration);
    }
  });

  it("بطاقة الآية داخل المشهد بنص الخطة والسكريبت حرفًا (النساء ١ على c2-s10 من 002)", () => {
    const withVerse = PM_BOARDS.filter((b) => b.elements.includes("verse-card"));
    expect(withVerse.length).toBeGreaterThanOrEqual(1);
    for (const b of withVerse) {
      const s = scenesOf(b.episode).find((x) => x.id === b.sceneId)!;
      expect(s.props?.verseText).toBe(NISA_1);
      expect(s.props?.verseKey).toBe(NISA_1_KEY);
    }
    expect(readFileSync(path.join(root, "channels/dafatir-alzaman/episodes/002-ibna-adam/script.md"), "utf8")).toContain(`[آية: النساء 1 | ${NISA_1}]`);
    // البطاقة نفسها التي تستعملها «خط الأفق» (D242/D246)، لا بطاقة جديدة
    expect(code("src/remotion/dafatir/prophets/PlaceMapBoard.tsx")).toMatch(/<VerseCard show=\{1\} text=\{NISA_1\} refKey=\{NISA_1_KEY\} place="page"/);
  });

  it("حكم المراجعة العلمية: لا شخصية ولا ظل ولا ضوء ينوب عن أحد، ولا علامة متحركة على المسار، ولا قرص شمس", () => {
    for (const f of FORBIDDEN_ELEMENTS) expect(PM_ELEMENTS as readonly string[]).not.toContain(f);
    for (const b of PM_BOARDS) for (const e of b.elements) expect(PM_ELEMENTS as readonly string[]).toContain(e);
    // boards.ts يعرّف قائمة الممنوع نفسها بأسمائها، فالفحص على كود الرسم وحده
    for (const f of ["src/remotion/dafatir/prophets/PlaceMapBoard.tsx"]) {
      const src = code(f);
      expect(src).not.toMatch(/\b(figure|silhouette|person|people|human|walker|rider|caravan|camel|mover|traveler|sunDisc|sunRays|SunDisc)\b/i);
      expect(src).not.toMatch(/MapJourney|Rahhala.*mover|<Character|illus\/characters/);
    }
    // نص اللوحات للمالك: لا عنصر يُقرأ شخصًا أو قافلة (إلا نفيًا صريحًا «بلا/لا»)
    for (const b of PM_BOARDS) expect(`${b.title} ${b.motion}`).not.toMatch(/(?<![\u0600-\u06FF])(?<!(?:بلا|لا|ولا) )(شخص|شخصية|رجل|امرأة|قافلة|راكب|جمل|إنسان|يمشي)(?![\u0600-\u06FF])/);
  });

  it("مسجَّلة «مقترح» في approvals.json بالنماذج نفسها، ولا اعتماد قبل اختيار المالك", () => {
    const a = loadApprovals();
    for (const k of ["living-map", "place-light"]) {
      expect(a.templates[k]?.status).toBe(PROPOSED);
      expect(a.templates[k]?.storyboard).toBe(PM_FOLDER);
      expect(a.templates[k]?.approval).toBeUndefined();
    }
    for (const s of [1, 2, 3, 4, 5, 6]) {
      const t = a.templates[`storyboard:${PM_FOLDER}/مشهد-${s}`];
      expect(t?.status).toBe(PROPOSED);
      expect(t?.channel).toBe("dafatir-alzaman"); // owner-pin-ok: قناة الستوري بورد من الكود
      expect(t?.variants).toEqual(PM_BOARDS.filter((b) => b.scene === s).map(pmVariantName));
      expect(t?.approval).toBeUndefined();
    }
  });

  it("لا تصل إلى الإنتاج: بوابة D228 ترفض القالبين، ولا قالب ولا مدخل كتالوج بهما، وخطط البدايات كما هي", () => {
    const plan = (template: string) => ({ chapters: [{ scenes: [{ id: "s1", template, props: {} }] }] }) as never;
    expect(() => assertTemplatesApproved(plan("living-map"))).toThrow(/living-map \(مقترح\)/);
    expect(() => assertTemplatesApproved(plan("place-light"))).toThrow(/place-light \(مقترح\)/);
    expect(() => assertTemplatesApproved(plan("storyboard-dafatir-prophets-s1-a"))).toThrow(/غير مسجَّل/);
    expect(registryTemplateKeys().some((k) => /living-map|place-light|dafatir-prophets/.test(k))).toBe(false);
    expect(readFileSync(path.join(root, "src/remotion/scenes/catalog.ts"), "utf8")).not.toMatch(/PlaceMapBoard|dafatir\/prophets/);
    expect(readFileSync(path.join(root, "src/plan/templates.ts"), "utf8")).not.toMatch(/living-map|place-light|dafatir\/prophets/);
    for (const ep of ["002-ibna-adam", "008-ala-al-judi"]) {
      expect(readFileSync(path.join(root, "channels/dafatir-alzaman/episodes", ep, "plan.json"), "utf8")).not.toMatch(/living-map|place-light/);
    }
  });

  it("Root يسجّل كل لوحة صورةً ثابتة (Still) وحدها", () => {
    const src = readFileSync(path.join(root, "src/remotion/Root.tsx"), "utf8");
    expect(src).toMatch(/PM_STILLS\.map\(\(s\) => <Still key=\{s\.id\} id=\{s\.id\} component=\{PlaceMapBoard\}/);
  });

  it("مجموعة stills «dafatir-prophets» من القائمة المسموحة: ١٢ صورة 1920×1080 بأسماء عربية في مجلدها", () => {
    const set = STORYBOARD_SETS["dafatir-prophets"]!;
    expect(set.channel).toBe("dafatir-alzaman");
    expect(set.folder).toBe(PM_FOLDER);
    expect(set.boards.length).toBe(12);
    expect(set.boards.map((b) => b.arabicFile)).toContain("مشهد-1-نموذج-أ.png");
    expect(set.boards.map((b) => b.arabicFile)).toContain("مشهد-6-نموذج-د.png");
    const job = buildStillsJob("dafatir-prophets", "b".repeat(40));
    expect(validateStillsJob(job).stills.length).toBe(12);
    expect(() => validateStillsJob({ ...job, stills: [{ composition: "storyboard-zubdat-desk-s1-a", file: "zubdat-desk-s1-a.png" }] })).toThrow(/ليس من المجموعة/);
  });
});
