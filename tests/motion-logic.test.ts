import { describe, expect, it } from "vitest";
import { inspectMotionLogic } from "../src/plan/motionLogic";
import type { PlanScene } from "../src/plan/types";

const scene = (narration: string, props: Record<string, string>, template = "alley-tale"): PlanScene => ({
  id: "c1-s1", template, narration, line: 1, props, sfx: [],
});

describe("فحص منطق الحركة بالنسبة إلى السكريبت", () => {
  it("يتحقق من الكلمات المحفّزة للأحداث الموجودة وبالترتيب", () => {
    const r = inspectMotionLogic(scene("رأى خبرًا ثم قرر الاعتذار", { cues: "news | خبرًا\napologize | الاعتذار" }), { pct: 88, still: 1 });
    expect(r.matched).toBe(2);
    expect(r.total).toBe(2);
    expect(r.status).toBe("no-obvious-issues");
  });

  it("يحتفظ بوقت الكلمة المتوقع من محاذاة الصوت دون ادعاء قياس الحركة", () => {
    const r = inspectMotionLogic(
      scene("سمع خبرًا ثم اعتذر", { cues: "news | خبرًا" }),
      { pct: 91, still: 0 },
      [
        { word: "سمع", start: 0.1, end: 0.5 },
        { word: "خبرًا", start: 0.6, end: 0.9 },
        { word: "ثم", start: 1, end: 1.2 },
        { word: "اعتذر", start: 1.3, end: 1.7 },
      ],
    );
    expect(r.cues?.[0]?.expectedVoiceStartSec).toBe(0.6);
    expect(r.cues?.[0]?.wordIndex).toBe(1);
  });

  it("ينبّه عند غياب نشاط مرئي قرب الكلمة المنطوقة مع وجود محاذاة صوت", () => {
    const r = inspectMotionLogic(
      scene("سمع خبرًا ثم اعتذر", { cues: "news | خبرًا" }),
      { pct: 0, still: 3, perSecond: [0, 0, 0], activityThreshold: 2.5 },
      [
        { word: "سمع", start: 0, end: 0.4 },
        { word: "خبرًا", start: 1, end: 1.4 },
        { word: "ثم", start: 1.5, end: 1.8 },
        { word: "اعتذر", start: 2, end: 2.4 },
      ],
    );
    expect(r.findings.some((f) => f.kind === "timing" && f.message.includes("لم تُرصد حركة"))).toBe(true);
  });

  it("ينبّه عند ربط الحدث بكلمة غير منطوقة", () => {
    const r = inspectMotionLogic(scene("قرر التراجع عن الخطأ", { cues: "news | خبرًا" }), { pct: 93, still: 0 });
    expect(r.status).toBe("needs-review");
    expect(r.findings.some((x) => x.kind === "timing" && x.level === "warning")).toBe(true);
  });

  it("ينبّه إلى الأحداث المعكوسة ولو كانت كل كلماتها موجودة", () => {
    const r = inspectMotionLogic(scene("قال خبرًا ثم اعتذر", { cues: "apologize | اعتذر\nnews | خبرًا" }));
    expect(r.matched).toBe(2);
    expect(r.status).toBe("needs-review");
    expect(r.findings.some((x) => x.message.includes("ترتيب"))).toBe(true);
  });

  it("يعرض سكونًا طويلًا ضمن الإيقاع دون تحويله إلى رفض تلقائي", () => {
    const r = inspectMotionLogic(scene("لحظة تأمل", {}), { pct: 56, still: 4 });
    expect(r.findings.some((x) => x.kind === "rhythm" && x.level === "warning")).toBe(true);
    expect(r.findings.some((x) => x.message.includes("ليست مشكلة تلقائية"))).toBe(true);
  });

  it("يفحص مراسي السبورة ورسومها عند وجود معلومات كافية", () => {
    const r = inspectMotionLogic(scene("سؤال مهم الآن", { beats: "question-mark | سؤال" }, "board-story"));
    expect(r.total).toBe(1);
    expect(r.matched).toBe(1);
  });

  it("يفرق بين الدليل القابل للفحص والفهم الفني الذي يحتاج مشاهدة", () => {
    const r = inspectMotionLogic(scene("هذا المشهد يحتاج مراجعة بصرية", {}));
    expect(r.total).toBe(0);
    expect(r.status).toBe("not-assessable");
    expect(r.findings.some((x) => x.message.includes("مراجعة") || x.message.includes("مشاهدة"))).toBe(true);
  });
});
