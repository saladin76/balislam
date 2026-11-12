/**
 * فحص النطق (العمل ٩): السطر تحت الجملة. تنبيه وحده، ولا يظهر شيء والفحص مطفأ أو غير مثبّت أو لصف آية أو بسملة.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PronunciationNote } from "../app/src/workspace/PronunciationNote";

const on = { state: "on" as const, pending: 0, checking: false, results: {
  a: { verdict: "suspect" as const, transcript: "والشكر مفتاح الفرج", suspects: [{ index: 0, word: "وَالصَّبْرُ.", heard: "والشكر" }] },
  b: { verdict: "ok" as const, transcript: "", suspects: [] },
} };

describe("سطر «كلمة قد تكون نُطقت خطأ»", () => {
  it("يذكر الكلمة وما سُمع مكانها، ويقول إنه لا يمنع الاعتماد", () => {
    const html = renderToStaticMarkup(<PronunciationNote view={on} rowId="a" kind="narration" />);
    expect(html).toContain("كلمة قد تكون نُطقت خطأ: «وَالصَّبْرُ»");
    expect(html).toContain("«والشكر»");
    expect(html).toContain("لا يمنع الاعتماد");
    expect(html).not.toMatch(/<button/);
  });
  it("لا شيء لجملة سليمة، ولا والفحص مطفأ أو غير مثبّت، ولا لصف آية أو بسملة", () => {
    expect(renderToStaticMarkup(<PronunciationNote view={on} rowId="b" kind="narration" />)).toBe("");
    expect(renderToStaticMarkup(<PronunciationNote view={{ state: "off" }} rowId="a" kind="narration" />)).toBe("");
    expect(renderToStaticMarkup(<PronunciationNote view={{ state: "not-installed" }} rowId="a" kind="narration" />)).toBe("");
    expect(renderToStaticMarkup(<PronunciationNote view={null} rowId="a" kind="narration" />)).toBe("");
    expect(renderToStaticMarkup(<PronunciationNote view={on} rowId="a" kind="basmala" />)).toBe("");
    expect(renderToStaticMarkup(<PronunciationNote view={on} rowId="a" kind="verse" />)).toBe("");
  });
});
