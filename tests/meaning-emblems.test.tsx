import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MANUAL_CUES, cueKindOf, cuesFor, parseCues } from "../src/plan/sceneCues";
import { MeasureScale, PracticeCount, VerifyLens, ordinalOf } from "../src/remotion/illus/emblems";
import { PROP_IDS, propNamesAr } from "../src/remotion/illus/places";
import { emblemSpec } from "../src/remotion/scenes/AlleyTale";

/**
 * قاعدة صاحب المشروع (١١ نوفمبر): «أي كلمات ليس لها عناصر في المكتبة يُصمَّم لها عناصر جديدة وتُضاف في المكتبة».
 * عناصر الحلقة 001: العدسة (التثبت/التحقق)، عدّاد الممارسات (الأولى/الثانية/الثالثة)، والميزان (المال مقياسًا).
 */
describe("شارات المعنى الجديدة", () => {
  it("التثبت والتحقق يُقترحان آليًا، و«تحقق» وحدها لا (تحقق الحلم = وقع)", () => {
    expect(cueKindOf("التثبت")).toBe("verify");
    expect(cueKindOf("التحقق")).toBe("verify");
    expect(cueKindOf("بالتحقق")).toBe("verify");
    expect(cueKindOf("تحقق")).toBeNull();
    expect(cuesFor("ولا تنشر معلومة قبل التحقق منها.").map((c) => c.kind)).toContain("verify");
    expect(cuesFor("وأخيرًا تحقق الحلم.").map((c) => c.kind)).not.toContain("verify");
  });

  it("الأولى والمقياس لا يُقترحان آليًا أبدًا (للمرة الأولى، الوهلة الأولى، مقياس الحرارة)", () => {
    const kinds = cuesFor("رأيته للمرة الأولى، ومن الوهلة الأولى عرفت المقياس.").map((c) => c.kind);
    expect(kinds).not.toContain("step");
    expect(kinds).not.toContain("measure");
  });

  it("المعنى اليدوي لا يُقبل إلا بكلمة من قائمته", () => {
    expect(parseCues("step | الأولى\nstep | المرة\nmeasure | المقياس\nmeasure | الميزان").map((c) => `${c.kind}:${c.word}`)).toEqual(["step:الأولى", "measure:المقياس"]);
    for (const [k, ws] of MANUAL_CUES) for (const w of ws) expect(parseCues(`${k} | ${w}`)).toHaveLength(1);
  });

  it("العدّاد يضيء رقم الممارسة المنطوقة", () => {
    expect(ordinalOf("الأولى:")).toBe(1);
    expect(ordinalOf("الثانية")).toBe(2);
    expect(ordinalOf("الثالثة")).toBe(3);
    const svg = renderToStaticMarkup(<svg><PracticeCount n={2} t={1} /></svg>);
    for (const d of ["١", "٢", "٣"]) expect(svg).toContain(d);
  });

  it("لا تُرسم الشارة قبل لحظة كلمتها", () => {
    expect(renderToStaticMarkup(<svg><VerifyLens t={0} scan={0} /></svg>)).toBe("<svg></svg>");
    expect(renderToStaticMarkup(<svg><MeasureScale t={0} tip={0} /></svg>)).toBe("<svg></svg>");
    expect(renderToStaticMarkup(<svg><PracticeCount n={1} t={0} /></svg>)).toBe("<svg></svg>");
  });

  it("الشارات في مكتبة القناة بأسمائها", () => {
    for (const id of ["verify", "steps", "measure"] as const) {
      expect(PROP_IDS).toContain(id);
      expect(propNamesAr[id]).toBeTruthy();
    }
  });

  it("الشارة وعمودها المحجوز داخل الإطار بالاتجاهين", () => {
    for (const portrait of [false, true]) {
      const VW = portrait ? 608 : 1920;
      for (const k of ["step", "verify", "measure"] as const) {
        const e = emblemSpec(k, portrait);
        expect(e.hw * 2 * e.s + e.edge).toBeLessThanOrEqual(e.reserve);
        expect(e.reserve).toBeLessThan(VW * (portrait ? 0.38 : 0.3));
        expect(e.y - e.hh * e.s).toBeGreaterThan(portrait ? 160 : 180); // تحت الكابشن
      }
    }
  });
});
