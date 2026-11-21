import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { Plan, PlanScene } from "../src/plan/types";
import {
  diversitySummary, fileStartsFromSeams, interactivityFrom, interactivitySummary, measureDiversity, measureInteractivity,
  mergeIntervals, minDistinctFor, parseFreezes, remapSpans, sceneComposition, subtractIntervals,
} from "../src/studio/quality";

/**
 * المرحلة A (خطة «احترافية بلا مثيل»)، المهمة ١: مقياسا التنوع والتفاعلية اللذان يستعملهما تيرمينال C والبطاقة.
 * كل الخطط هنا مصنوعة في الاختبار (KI-068: لا يثبت اختبار محتوى يحرره المالك).
 */
const scene = (id: string, template: string, props: Record<string, string> = {}): PlanScene => ({ id, template, narration: "", line: 0, props, sfx: [] });
const plan = (...chapters: PlanScene[][]): Plan => ({
  version: 1, episode: "t", title: "t", domain: "faith" as Plan["domain"], themeId: "x" as Plan["themeId"], updatedAt: "",
  chapters: chapters.map((scenes, i) => ({ number: i + 1, title: "", scenes })),
});

describe("مقياس التنوع", () => {
  it("مشهدان متتاليان بالمكان ومن فيه نفسيهما = التكوين نفسه، ولو اختلفت الكاميرا", () => {
    const r = measureDiversity(plan([
      scene("a", "alley-tale", { place: "market", camera: "rise", cast: "" }),
      scene("b", "alley-tale", { place: "market", camera: "drift", cast: "" }),
    ]));
    expect(r.repeats).toEqual([{ a: "a", b: "b", same: ["composition"], key: "alley-tale|place=market" }]);
    expect(r.ok).toBe(false);
  });

  it("الكاميرا نفسها على المكان نفسه = اللقطة نفسها؛ والكاميرا نفسها في مكان آخر ليست تكرارًا", () => {
    const r = measureDiversity(plan([
      scene("a", "alley-tale", { place: "home", camera: "drift", cast: "companion" }),
      scene("b", "alley-tale", { place: "home", camera: "drift", cast: "" }),
      scene("c", "alley-tale", { place: "alley", camera: "drift", cast: "" }),
    ]));
    expect(r.repeats.map((x) => [x.a, x.b, x.same])).toEqual([["a", "b", ["shot"]]]);
  });

  it("اللقطة المصمَّمة تحدد التكوين، ووضعها (mode) يفرّق بين لقطتين باسم واحد", () => {
    expect(sceneComposition(scene("a", "horizon-shot", { shot: "lib-names", mode: "present" })).composition)
      .not.toBe(sceneComposition(scene("b", "horizon-shot", { shot: "lib-names", mode: "name" })).composition);
    const r = measureDiversity(plan([
      scene("a", "horizon-shot", { shot: "lib-names", mode: "name" }),
      scene("b", "horizon-shot", { shot: "lib-names", mode: "name", ref: "البقرة · ٣٣" }),
    ]));
    expect(r.repeats.map((x) => x.same)).toEqual([["shot", "composition"]]);
  });

  it("تتابع الآيات ومراحل لوح الدعاء يُذكر ولا يُعد مخالفة (التوقير)، وشاشة الختام خارج الحساب", () => {
    const r = measureDiversity(plan([
      scene("v1", "verse-card", { reference: "البقرة · ١" }),
      scene("v2", "verse-card", { reference: "البقرة · ١" }),
      scene("d1", "dua-board", { shown: "" }),
      scene("d2", "dua-board", { shown: "" }),
      scene("end", "end-screen"),
      scene("end2", "end-screen"),
    ]));
    expect(r.repeats).toEqual([]);
    expect(r.sacredPairs).toEqual([{ a: "v1", b: "v2" }, { a: "d1", b: "d2" }]);
    expect(r.scenes).toBe(4);
  });

  it("الحد الأدنى للتكوينات المختلفة: نصف المشاهد، ولا أقل من ٤، ولا أكثر من عددها", () => {
    expect(minDistinctFor(2)).toBe(2);
    expect(minDistinctFor(6)).toBe(4);
    expect(minDistinctFor(50)).toBe(25);
    const alt = (n: number) => Array.from({ length: n }, (_, i) => scene(`s${i}`, "alley-tale", { place: i % 2 ? "home" : "alley", camera: "push" }));
    const r = measureDiversity(plan(alt(10)));
    expect(r.repeats).toEqual([]);
    expect([r.distinct, r.minDistinct, r.ok]).toEqual([2, 5, false]);
  });

  it("الشورت يُقاس وحده: فصل، أو مشاهد بعينها تعبر الفصول بترتيبها", () => {
    const p = plan([scene("a", "kinetic-text", { stage: "theme" })], [scene("b", "kinetic-text", { stage: "theme" }), scene("c", "big-question")]);
    expect(measureDiversity(p).repeats.map((x) => x.b)).toEqual(["b"]);
    expect(measureDiversity(p, { chapter: 2 }).repeats).toEqual([]);
    expect(measureDiversity(p, { sceneIds: ["a", "b"] }).repeats.map((x) => x.b)).toEqual(["b"]);
  });

  it("قالب جديد يمرّر حقوله (لـC) دون تعديل هذا الملف", () => {
    const p = plan([scene("a", "map-3d", { view: "globe", region: "x" }), scene("b", "map-3d", { view: "globe", region: "y" })]);
    expect(measureDiversity(p).repeats).toHaveLength(1);
    expect(measureDiversity(p, { fields: { "map-3d": { shot: ["view", "region"], layout: ["view", "region"] } } }).repeats).toEqual([]);
  });

  it("الملخص بالعربية يسمي كل تكرار", () => {
    const r = measureDiversity(plan([scene("a", "kinetic-text", { stage: "theme" }), scene("b", "kinetic-text", { stage: "theme" })]));
    expect(diversitySummary(r)).toContain("a ← b: اللقطة والتكوين نفساهما");
  });
});

describe("مقياس التفاعلية: الحساب", () => {
  it("الفترات: دمج وطرح", () => {
    expect(mergeIntervals([{ from: 2, to: 4 }, { from: 1, to: 2.5 }, { from: 6, to: 9 }], 8)).toEqual([{ from: 1, to: 4 }, { from: 6, to: 8 }]);
    expect(subtractIntervals([{ from: 0, to: 10 }], [{ from: 2, to: 3 }, { from: 5, to: 12 }])).toEqual([{ from: 0, to: 2 }, { from: 3, to: 5 }]);
  });

  it("يقرأ مخرجات freezedetect، والسكون بلا نهاية يمتد إلى آخر الفيديو", () => {
    const log = "[freezedetect @ 0x1] lavfi.freezedetect.freeze_start: 1.2\n[freezedetect @ 0x1] lavfi.freezedetect.freeze_duration: 2\n[freezedetect @ 0x1] lavfi.freezedetect.freeze_end: 3.2\n[freezedetect @ 0x1] lavfi.freezedetect.freeze_start: 8.5\n";
    expect(parseFreezes(log, 10)).toEqual([{ from: 1.2, to: 3.2 }, { from: 8.5, to: 10 }]);
  });

  it("السكون المقصود خارج البسط والمقام، والسكون غير المقصود فوق ثانيتين يُسمّى", () => {
    // 100 ث: سكون 10–40 منها 10–30 آية مقصودة → المحسوب 80 ث، الساكن منه 10 ث → 87.5%
    const r = interactivityFrom(100, [{ from: 10, to: 40 }], [{ from: 10, to: 30 }]);
    expect([r.counted, r.moving, r.exempt, r.percent, r.ok]).toEqual([80, 70, 20, 87.5, true]);
    expect(r.still).toEqual([{ from: 30, to: 40 }]);
    expect(interactivitySummary(r)).toContain("0:30–0:40");
  });

  it("الحد ٨٠٪ بلا تقريب لأعلى: ٧٩٫٩٩٪ ✗", () => {
    expect(interactivityFrom(10000, [{ from: 0, to: 2001 }]).ok).toBe(false);
    expect(interactivityFrom(10000, [{ from: 0, to: 2000 }]).ok).toBe(true);
  });

  it("يُزاح السكون المقصود من زمن الخطة إلى زمن الملف المجمّع بسجل الوصلات (وقص البداية KI-091)", () => {
    const starts = fileStartsFromSeams({ sceneSeconds: { a: 9.5, b: 6, c: 4 }, seams: [{ at: 9.5 }, { at: 15.5 }], headTrimmed: 0.5 });
    expect([...starts]).toEqual([["a", -0.5], ["b", 9.5], ["c", 15.5]]);
    const plan0 = [{ id: "a", start: 0 }, { id: "b", start: 10 }, { id: "c", start: 16.2 }];
    const moved = remapSpans([{ from: 1, to: 2, why: "ذكر الله" }, { from: 16.2, to: 20, why: "آية" }], plan0, starts);
    expect(moved).toEqual([{ from: 0.5, to: 1.5, why: "ذكر الله" }, { from: 15.5, to: 19.3, why: "آية" }]);
    expect(moved.map((x) => x.to - x.from)).toEqual([1, expect.closeTo(3.8, 6)]);
  });
});

describe("مقياس التفاعلية: على فيديو حقيقي (ffmpeg)", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "bal-quality-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const ff = (args: string[]) => execFileSync("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: ["ignore", "pipe", "pipe"] });

  it("٣ ث ثابتة ثم ٣ ث متحركة: النصف؛ وباستثناء الثابتة سكونًا مقصودًا: ١٠٠٪", async () => {
    const file = path.join(dir, "half.mp4");
    ff(["-f", "lavfi", "-i", "color=c=0x334455:s=640x360:r=30:d=3", "-f", "lavfi", "-i", "testsrc2=s=640x360:r=30:d=3",
      "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0,format=yuv420p[v]", "-map", "[v]", "-c:v", "libx264", "-crf", "18", file]);
    const plain = await measureInteractivity(file);
    expect(plain.percent).toBeGreaterThan(45);
    expect(plain.percent).toBeLessThan(55);
    expect(plain.ok).toBe(false);
    expect(plain.still.length).toBe(1);
    const sacred = await measureInteractivity(file, [{ from: 0, to: 3 }]);
    expect(sacred.percent).toBeGreaterThan(95);
    expect(sacred.ok).toBe(true);
  }, 60_000);

  it("الترجمة المتغيرة أسفل الإطار لا تُحسب حركة (مساحة المشهد كما في motionMeter)", async () => {
    const file = path.join(dir, "captions.mp4");
    // إطار ثابت، ومربع يتبدل لونه كل ٠٫٣ ث في أسفل ١٥٪ من الإطار (مكان الترجمة)
    ff(["-f", "lavfi", "-i", "color=c=0x334455:s=640x360:r=30:d=4",
      "-vf", "drawbox=x=100:y=310:w=440:h=40:color=white@1:t=fill:enable='lt(mod(t,0.6),0.3)',format=yuv420p", "-c:v", "libx264", "-crf", "18", file]);
    expect((await measureInteractivity(file)).percent).toBeLessThan(5);
  }, 60_000);
});

describe("بدايات المشاهد في زمن الخطة", () => {
  it("تطابق ما يحسبه intendedStillness (فتُزاح نوافذه بلا خطأ)", async () => {
    const { planSceneStarts } = await import("../src/studio/quality");
    const { intendedStillness } = await import("../src/render/stillnessSpans");
    const p = plan([
      { ...scene("a", "kinetic-text", { stage: "theme" }), durationSec: 4 },
      { ...scene("v", "verse-card", { reference: "البقرة · ١" }), durationSec: 6 },
      { ...scene("b", "big-question"), durationSec: 3 },
    ]);
    const media = { voice: {}, recitations: {} };
    const verse = intendedStillness(p, 0, media).find((x) => x.why === "آية")!;
    expect(planSceneStarts(p, media).find((x) => x.id === "v")!.start).toBeCloseTo(verse.from, 6);
  });
});
