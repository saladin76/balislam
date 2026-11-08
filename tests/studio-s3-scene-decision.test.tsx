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
  onConfirm: noop, onApprove: noop, onRender: noop,
};
const buttons = (html: string) => [...html.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((m) => m[1]);

describe("الخطوة ٢: قرار المشهد الحالي (funnel v3: «اعتمد» أولًا)", () => {
  it("«اعتمد» أول الشريط (يمين الشاشة) والممتلئ الوحيد، ثم أزرار الحل؛ ولا «جهّز كل المشاهد» في شريط المشهد", () => {
    const html = renderToStaticMarkup(<SceneDecisionActions {...base} />);
    expect(buttons(html)).toEqual(["اعتمد", "الحركة غير مناسبة", "النبرة غير مناسبة", "ولّد الصوت"]);
    expect(html.match(/btn primary/g)).toHaveLength(1);
    expect(html).toMatch(/btn primary[^"]*"[^>]*>اعتمد/);
    expect(html).not.toContain("جهّز كل المشاهد");
  });

  it("الصوت المطابق يصير «أعد توليد الصوت» آخر الشريط ويهدأ زره؛ ومشهد بلا تعليق بلا زر صوت", () => {
    const html = renderToStaticMarkup(<SceneDecisionActions {...base} voice="ok" />);
    expect(buttons(html)).toEqual(["اعتمد", "الحركة غير مناسبة", "النبرة غير مناسبة", "أعد توليد الصوت"]);
    expect(html).not.toContain("s3-cta");
    expect(buttons(renderToStaticMarkup(<SceneDecisionActions {...base} voice="none" />))).toEqual(["اعتمد", "الحركة غير مناسبة", "النبرة غير مناسبة"]);
  });

  it("القرار غير المتاح كله (مشهد غير الحالي): سطر واحد وزر واحد، بلا شريط معطّل", () => {
    const html = renderToStaticMarkup(<SceneDecisionActions {...base} stage="render" readyForAv={false}
      locked={{ reason: "يُعتمد بعد ما قبله، بالترتيب.", action: { label: "إلى المشهد الحالي (٣)", onClick: noop } }} />);
    expect(html).not.toContain("s3-actbar");
    expect(buttons(html)).toEqual(["إلى المشهد الحالي (٣)"]);
    expect(html.match(/btn primary/g)).toHaveLength(1);
  });

  it("الأسباب الحقيقية: جلسة المالك المقفلة، ومفتاح الصوت الناقص", () => {
    const html = renderToStaticMarkup(<SceneDecisionActions {...base} ownerOpen={false} canVoice={false} />);
    expect(html).toContain("افتح جلسة المالك من أعلى الصفحة");
    expect(html).toContain("أضف مفتاح الصوت من الإعدادات");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>اعتمد</);
  });

  it("مشهد لم يجهز بعد: «اعتمد» ينتظر في مكانه، وسطر تقدمه؛ و«أنتج هذا المشهد» هادئ حين لا يعمل التجهيز", () => {
    const idle = renderToStaticMarkup(<SceneDecisionActions {...base} stage="render" />);
    expect(buttons(idle)).toEqual(["اعتمد", "الحركة غير مناسبة", "النبرة غير مناسبة", "ولّد الصوت", "أنتج هذا المشهد"]);
    expect(idle.match(/btn primary/g)).toHaveLength(1);
    expect(idle).toMatch(/<button[^>]*btn primary[^>]*disabled=""[^>]*>اعتمد</);
    expect(idle).toContain("لم تُجهَّز معاينة هذا المشهد بعد");
    const now = renderToStaticMarkup(<SceneDecisionActions {...base} stage="render" preparing="now" />);
    expect(buttons(now)).toEqual(["اعتمد", "الحركة غير مناسبة", "النبرة غير مناسبة", "ولّد الصوت"]);
    expect(now).toContain("يُجهَّز هذا المشهد الآن");
    expect(renderToStaticMarkup(<SceneDecisionActions {...base} stage="render" preparing="queued" />)).toContain("في دور التجهيز");
    // «الحركة/النبرة غير مناسبة» لا تُسجَّل إلا على معاينة مُرسلة (correct-scene يشترط previewSha256)؛ لا مسار جديد
    const ui = readFileSync(path.join(__dirname, "../app/src/workspace/SceneProductionPanel.tsx"), "utf8");
    expect(ui).toContain("locked={lock ??");
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
