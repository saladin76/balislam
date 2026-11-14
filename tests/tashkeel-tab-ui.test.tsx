/**
 * «النص المشكول» في شريط الخطوة ١ (طلب المالك ١٤ نوفمبر: «أريد خانة هنا يتم وضعه فيه»، D132؛ القنوات الثلاث):
 * تبويب بجوار «السكريبت» يعرض tashkeel.md كاملًا ويُحرَّر كالسكريبت، بشارة «التشكيل ٩٩٪»، و«أنشئ النسخة المشكولة من
 * السكريبت» حين لا يوجد، ومشكلات المطابقة في مكانها، وسطر أسبقية «النطق»، وخيارا التعارض (409). عربي بأرقام عربية.
 */
import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SAY_PRECEDENCE, TashkeelView, tashkeelBadge, type TashkeelViewProps } from "../app/src/tabs/TashkeelTab";
import { STEPS, SUBTABS, stepOf } from "../app/src/shell/EpisodeSpine";
import { parseStudioHash, studioHash } from "../app/src/shell/route";
import type { TashkeelState } from "../app/src/api";
import { TECHNICAL_TEXT } from "../app/src/ui/format";

const src = (f: string) => readFileSync(path.resolve(import.meta.dirname, "..", f), "utf8");
const report = (o: Partial<TashkeelState["report"]> = {}): TashkeelState["report"] =>
  ({ file: true, words: 120, covered: 119, coverage: 119 / 120, min: 0.98, ok: true, gaps: [], ambiguous: [], ...o });
const state = (o: Partial<TashkeelState> = {}): TashkeelState => ({
  exists: true, text: "كَتَبَ الوَلَدُ الدَّرْسَ.\n", revision: "a".repeat(64), report: report(), alignment: [], saySentences: 0, toneMapStale: false, ...o,
});
const view = (o: Partial<TashkeelViewProps> = {}) => {
  const s = o.state === undefined ? state() : o.state;
  const p: TashkeelViewProps = { state: s, text: s?.text ?? "", check: s, order: ["c1-s1", "c1-s2", "c1-s3"], dirty: false, busy: false, conflict: false, error: "", msg: "",
    onText: () => {}, onSave: () => {}, onCreate: () => {}, onOverwrite: () => {}, onOpenSaved: () => {}, ...o };
  return renderToStaticMarkup(<TashkeelView {...p} />);
};

describe("الشريط: «النص المشكول» بجوار «السكريبت» في الخطوة ١", () => {
  it("تبويب رابع للتجهيز بعد السكريبت، باسمه العربي، ورابطه يبقى", () => {
    expect(STEPS[0]!.tabs).toEqual(["storyboard", "script", "tashkeel", "research"]);
    expect(stepOf("tashkeel")).toBe(0);
    expect(SUBTABS.tashkeel).toBe("النص المشكول");
    const r = parseStudioHash("#/zubdat-alkutub/001/tashkeel");
    expect(r).toEqual({ channel: "zubdat-alkutub", episode: "001", tab: "tashkeel" });
    expect(studioHash(r)).toBe("#/zubdat-alkutub/001/tashkeel");
    const app = src("app/src/App.tsx");
    expect(app).toMatch(/\{ id: "script", label: "السكريبت"[^\n]*\n\s*\{ id: "tashkeel", label: "النص المشكول", sub: /);
    expect(app).not.toMatch(/tashkeel[^\n]*(balislam|dafatir|zubdat)/); // the same tab in the three channels
  });
  it("الشارة: «التشكيل ٩٩٪» بأرقام عربية ولا تُقرّب إلى الحد، و«غير موجود» بلا ملف", () => {
    expect(tashkeelBadge(state())).toBe("التشكيل ٩٩٪");
    expect(tashkeelBadge(state({ report: report({ coverage: 0.979 }) }))).toBe("التشكيل ٩٧٪");
    expect(tashkeelBadge(state({ exists: false }))).toBe("غير موجود");
  });
});

describe("المحرر: كالسكريبت", () => {
  it("النص كاملًا في محرر واحد، و«محفوظ»، وزر «حفظ» معطّل بلا تعديل؛ وسطر الأسبقية ظاهر", () => {
    const html = view();
    expect(html).toContain('id="tashkeel-editor"');
    expect(html).toContain("كَتَبَ الوَلَدُ الدَّرْسَ.");
    expect(html).toContain("محفوظ");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*title="Ctrl\+S"/);
    expect(html).toContain(SAY_PRECEDENCE);
    expect(SAY_PRECEDENCE).toMatch(/«النطق».*يعلو.*لتلك الجملة وحدها/);
    expect(html).toContain("للصوت وحده");
  });
  it("تعديل غير محفوظ: «غير محفوظ» و«حفظ» مفعّل، والفحص «قبل الحفظ»", () => {
    const html = view({ dirty: true, text: "كَتَبَ" });
    expect(html).toContain("غير محفوظ");
    expect(html).toMatch(/class="btn s12-save is-dirty"(?![^>]*disabled)/);
    expect(html).toContain("قبل الحفظ");
  });
  it("التعارض (409): التعديل باقٍ، والخياران «احفظ تعديلي فوقها» و«افتح النسخة المحفوظة»", () => {
    const html = view({ dirty: true, text: "تعديلي", conflict: true });
    expect(html).toContain("تعديلك باقٍ هنا");
    expect(html).toContain("احفظ تعديلي فوقها");
    expect(html).toContain("افتح النسخة المحفوظة");
    expect(html).toContain("تعديلي");
  });
});

describe("لا ملف: «أنشئ النسخة المشكولة من السكريبت»", () => {
  it("الزر، والقول صراحةً إن التغطية منخفضة حتى يُشكَّل وإن التوليد متوقف تحت ٩٨٪؛ بلا محرر ولا شريط", () => {
    const html = view({ state: state({ exists: false, text: "", revision: "none", report: report({ file: false, coverage: 0, ok: false }) }) });
    expect(html).toContain("أنشئ النسخة المشكولة من السكريبت");
    expect(html).toContain("منخفضة حتى تُشكَّل");
    expect(html).toContain("متوقف تحت ٩٨٪");
    expect(html).not.toContain('id="tashkeel-editor"');
    expect(html).not.toContain("فحص التشكيل");
  });
});

describe("المطابقة والتغطية في مكانهما", () => {
  it("جملة بلا نظير، وجملة تختلف بعد حذف التشكيل؛ باسم المشهد لا معرّفه، ومعها تقرير التغطية نفسه", () => {
    const html = view({ state: state({
      report: report({ coverage: 0.9, ok: false, covered: 108, gaps: [{ sceneId: "c1-s3", words: ["ونبدأ"], narration: "ونبدأ الآن." }] }),
      alignment: [
        { sceneId: "c1-s3", sentence: "ونبدأ الآن.", problem: "missing", words: ["ونبدأ", "الآن"] },
        { sceneId: "c1-s1", sentence: "كتب الولد الدرس.", problem: "mismatch", words: ["الدرس"] },
      ] }) });
    expect(html).toContain("لا جملة مقابلة لها في النسخة المشكولة");
    expect(html).toContain("تختلف عن السكريبت بعد حذف التشكيل: الدرس");
    expect(html).toContain("مشكلتان في المطابقة");
    expect(html).toContain("التشكيل ٩٠٪");
    expect(html).toContain("كلمات ستُنطق بلا تشكيل"); // TashkeelBox, the same report as the voice tool
    expect(html).toMatch(/المشهد ٣/);
    const visible = html.replace(/<[^>]*>/g, " "); // what the owner reads (a hover title may name the scene id)
    for (const re of TECHNICAL_TEXT) expect(visible).not.toMatch(re);
    expect(html).not.toMatch(/[0-9]٪|tashkeel\.md/);
  });
  it("دفاتر الزمن: خريطة النبرة على نسخة سابقة تُذكر في سطر؛ والجمل ذات «النطق» تُعدّ خارج الفحص", () => {
    const html = view({ state: state({ toneMapStale: true, saySentences: 2 }) });
    expect(html).toContain("خريطة النبرة بُنيت على نسخة مشكولة سابقة");
    expect(html).toContain("جملتان لها «النطق» مكتوبًا");
  });
});

describe("الحفظ في الخادم والوضع الليلي والهاتف", () => {
  it("المسار يحفظ tashkeel.md بنسخة الملف (409)، والأسلوب من متغيرات الهوية مع قاعدة الهاتف", () => {
    const route = src("app/server/routes/preparation.ts");
    expect(route).toContain('parts[2] === "tashkeel"');
    expect(route).toContain("TashkeelStaleError");
    expect(route).toMatch(/send\(res, 409, \{ error: error\.message, code: error\.code/);
    const css = src("app/src/shell/screens-s12.css");
    expect(css).toMatch(/s12-empty-doc[^}]*padding/);
    expect(css).toMatch(/@media \(max-width: 900px\) \{[^}]*s12-precedence/);
    const tab = src("app/src/tabs/TashkeelTab.tsx");
    expect(tab).not.toMatch(/#[0-9a-fA-F]{3,6}\b/); // colours come from the theme (light and dark)
  });
});
