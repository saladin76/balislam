import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defaultOverlays, resolveOverlays } from "../brand/identity/index";
import { parseScript } from "../src/script/parse";
import { generatePlan } from "../src/plan/generate";

const script = readFileSync(path.join(__dirname, "fixtures", "valid.md"), "utf8");

describe("عناصر الشاشة", () => {
  it("الأخص يغلب: القناة ← الحلقة ← المشهد، و«تلقائي» لا يغيّر شيئًا", () => {
    expect(resolveOverlays()).toEqual(defaultOverlays);
    const r = resolveOverlays({ captions: false, watermark: true }, { captions: true }, undefined, { chapterLabel: false });
    expect(r).toEqual({ captions: true, chapterLabel: false, motif: true, watermark: true });
    expect(resolveOverlays({ captions: undefined } as never).captions).toBe(true);
  });

  it("إعادة توليد الخطة تحفظ اختيارات الحلقة والمشهد", () => {
    const first = generatePlan(parseScript(script));
    const sceneId = first.chapters[1]!.scenes[0]!.id;
    const edited = {
      ...first,
      overlays: { chapterLabel: false },
      chapters: first.chapters.map((c) => ({ ...c, scenes: c.scenes.map((s) => (s.id === sceneId ? { ...s, overlays: { captions: false } } : s)) })),
    };
    const again = generatePlan(parseScript(script), edited);
    expect(again.overlays).toEqual({ chapterLabel: false });
    expect(again.chapters[1]!.scenes[0]!.overlays).toEqual({ captions: false });
    expect(again.chapters[0]!.scenes[0]!.overlays).toBeUndefined();
  });
});
