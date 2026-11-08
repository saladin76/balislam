import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SceneDecisionActions, fmtTime, problemNote } from "../app/src/workspace/SceneProductionPanel";

const noop = () => {};
const base = {
  stage: "review" as const, voice: "missing" as const, voiceBusy: false, canVoice: true, readyForAv: true,
  ownerOpen: true, pending: false, problem: null, problemText: "", tone: "", confirming: false, reviewed: false,
  onVoice: noop, onProblem: noop, onProblemText: noop, onTone: noop, onCancelProblem: noop, onSubmitProblem: noop,
  onConfirm: noop, onApprove: noop, onSubmitScene: noop, onRender: noop,
};
const buttons = (html: string) => [...html.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((m) => m[1]);

describe("الخطوة ٣: قرار المشهد الحالي", () => {
  it("أربعة أفعال فقط تحت المعاينة، و«اعتمد» الزر الممتلئ الوحيد", () => {
    const html = renderToStaticMarkup(<SceneDecisionActions {...base} />);
    expect(buttons(html)).toEqual(["توليد الصوت", "الحركة غير مناسبة", "النبرة غير مناسبة", "اعتمد"]);
    expect(html.match(/btn primary/g)).toHaveLength(1);
    expect(html).toMatch(/btn primary[^"]*"[^>]*>اعتمد/);
  });

  it("الصوت المطابق يصير «إعادة توليد الصوت» ويهدأ زره", () => {
    const html = renderToStaticMarkup(<SceneDecisionActions {...base} voice="ok" />);
    expect(buttons(html)[0]).toBe("إعادة توليد الصوت");
    expect(html).not.toContain("s3-cta");
  });

  it("«الحركة غير مناسبة» تفتح «ما المشكلة؟» بلحظتها، والملاحظة تبدأ بـ «[الحركة @…]»", () => {
    const html = renderToStaticMarkup(<SceneDecisionActions {...base} problem={{ kind: "motion", at: 12.6 }} />);
    expect(html).toContain("ما المشكلة؟");
    expect(html).toContain("0:12");
    expect(problemNote("motion", 12.6, " العنصر يقفز ")).toBe("[الحركة @0:12] العنصر يقفز");
    expect(problemNote("tone", 75, "هادئة")).toBe("[النبرة @1:15] هادئة");
    expect(fmtTime(0)).toBe("0:00");
  });

  it("«النبرة غير مناسبة» تختار من نبرات المحرك نفسها", () => {
    const html = renderToStaticMarkup(<SceneDecisionActions {...base} problem={{ kind: "tone", at: 3 }} />);
    expect(html).toContain("مثل الحلقة");
    expect(html).toContain("أرسل وأعد توليد الصوت");
  });

  it("«اعتمد» تطلب تأكيد المشاهدة، والقرارات تمر بالمسار القائم نفسه", () => {
    const html = renderToStaticMarkup(<SceneDecisionActions {...base} confirming />);
    expect(html).toContain("شاهدته بالصوت كاملًا");
    const ui = readFileSync(path.join(__dirname, "../app/src/workspace/SceneProductionPanel.tsx"), "utf8");
    // A ready draft of the current scene is submitted (exact bytes, checked) before the same act() path decides.
    expect(ui).toContain('reviewCurrent("correct-scene", problemNote("motion"');
    expect(ui).toContain('reviewCurrent("approve-scene")');
    expect(ui).toContain('action: "submit-scene", expectedSha256: scene.sourceSha256, sceneId: currentId');
    expect(ui).toContain("?.previewSha256 !== candidate");
    expect(ui).toContain("return act(action, sha, currentId, noteText)");
    expect(ui).toContain('act("approve-scene", scene.previewSha256!, currentId)');
    expect(ui).toContain("api.voice(episodeId, { scenes: [sceneId], force })");
  });
});
