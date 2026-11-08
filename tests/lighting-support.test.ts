import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LIGHTING_SUPPORT, lightingHelp, lightingIssues, type LightFeature } from "../src/plan/lighting";

/**
 * الأمر 009: لا يُقبل إعداد إضاءة لا أثر له. لكل قالب يعلن دعم خاصية، يُرسم المشهد بها وبدونها
 * ويجب أن يختلف الناتج؛ وما لا يعلنه القالب يرفضه فحص الخطة برسالة واضحة.
 */
let F = 0;
vi.mock("remotion", async (orig) => {
  const m = await orig<typeof import("remotion")>();
  return { ...m, useCurrentFrame: () => F, useVideoConfig: () => ({ fps: 30, width: 1920, height: 1080, durationInFrames: 300, id: "t", defaultProps: {}, props: {}, defaultCodec: null }) };
});

/** لكل خاصية: إضاءة الأساس، والإضاءة نفسها مع الخاصية، والإطار الذي يُقارن عنده */
const PROBES: Record<LightFeature, { base: string; with: string; frame?: number }> = {
  preset: { base: "", with: "night-lamp" },
  key: { base: "night-lamp", with: "night-lamp\nkey lamp 500 400" },
  intensity: { base: "night-lamp", with: "night-lamp\nintensity 0.3" },
  ambient: { base: "night-lamp", with: "night-lamp\nambient 0.3" },
  warmth: { base: "night-lamp", with: "night-lamp\nwarmth -0.8" },
  back: { base: "night-lamp\nback 0", with: "night-lamp\nback 1" },
  shadow: { base: "night-lamp", with: "night-lamp\nshadow hard" },
  "shadow.length": { base: "night-lamp", with: "night-lamp\nshadow soft 2.2" },
  fade: { base: "night-lamp", with: "night-lamp\nfade 0.2 1 0 60", frame: 20 },
  move: { base: "night-lamp", with: "night-lamp\nmove 300 400 0 30", frame: 60 },
  "depth.dof": { base: "night-lamp", with: "night-lamp\ndepth dof 0.6" },
  "depth.fog": { base: "night-lamp", with: "night-lamp\ndepth fog 0.6" },
  "depth.parallax": { base: "night-lamp", with: "night-lamp\ndepth parallax 1.8", frame: 150 },
  "depth.fg": { base: "night-lamp", with: "night-lamp\ndepth fg" },
};

const render = async (template: string, lighting: string, frame: number, orientation = "landscape") => {
  F = frame;
  const props = { themeId: "night", orientation, ...(lighting ? { lighting } : {}) };
  if (template === "alley-tale") {
    const { AlleyTale } = await import("../src/remotion/scenes/AlleyTale");
    return renderToStaticMarkup(React.createElement(AlleyTale, { narration: "يمشي في الحارة مساء. يقف أمام الباب ويفكر.", place: "alley", mood: "night", cues: "door | الباب", ...props } as never));
  }
  const { RoadJourney, roadJourneySample } = await import("../src/remotion/scenes/RoadJourney");
  return renderToStaticMarkup(React.createElement(RoadJourney, { ...roadJourneySample, ...props } as never));
};

describe("كل إعداد إضاءة مقبول له أثر فعلي في قالبه", () => {
  it("لكل خاصية مسبار اختبار (خاصية جديدة بلا مسبار تُسقط الاختبار)", () => {
    for (const sup of Object.values(LIGHTING_SUPPORT)) for (const f of sup.features) expect(PROBES[f], f).toBeDefined();
  });

  for (const [template, sup] of Object.entries(LIGHTING_SUPPORT)) {
    for (const f of sup.features) {
      it(`«${sup.name}»: ${f} يغير الرسم`, async () => {
        const p = PROBES[f];
        const frame = p.frame ?? 100;
        // الإعداد نفسه مقبول بلا أخطاء في هذا القالب
        expect(lightingIssues(template, { lighting: p.with }).filter((i) => i.level === "error")).toEqual([]);
        expect(await render(template, p.with, frame)).not.toBe(await render(template, p.base, frame));
      }, 30_000);
    }
  }

  it("«الحارة» العمودي: طبقة المقدمة تقع داخل الإطار الظاهر لا خارجه", async () => {
    const m = await render("alley-tale", "night-lamp\ndepth fg", 0, "portrait");
    const vb = /viewBox="(-?[\d.]+) 0 608 1080"/.exec(m)!;
    expect(vb).not.toBeNull();
    // بداية مسار العمود (حافته اليمنى) داخل الشريحة العمودية
    const col = /M(-?[\d.]+) -200 L(-?[\d.]+) -200/.exec(m.slice(m.lastIndexOf("pointer-events")))!;
    const edge = Number(col[2]);
    expect(edge).toBeGreaterThan(Number(vb[1]));
    expect(edge).toBeLessThan(Number(vb[1]) + 608 / 2);
  });
});

describe("ما لا يُنفذ يُرفض برسالة واضحة", () => {
  it("طبقة المقدمة في «الطريق» مرفوضة مع السبب", () => {
    const msg = lightingIssues("road-journey", { lighting: "dawn-sun\ndepth dof 0.4 fg" }).map((i) => i.message).join("\n");
    expect(msg).toContain("depth fg");
    expect(msg).toContain("غير مدعوم في «الطريق»");
    expect(msg).toContain("طريق مفتوح");
  });

  it("قالب لا يقرأ الإضاءة يرفض الحقل كله", () => {
    const msg = lightingIssues("light-stage", { lighting: "night-lamp" });
    expect(msg[0]?.level).toBe("error");
    expect(msg[0]?.message).toContain("غير مدعومة في هذا القالب");
    expect(lightingIssues("light-stage", {})).toEqual([]);
  });

  it("اللقطة المصمَّمة لا تقرأ الإضاءة: رفض الجمع بينهما", () => {
    expect(lightingIssues("alley-tale", { lighting: "night-lamp", shot: "cafe-news-agrees" }).map((i) => i.message).join()).toContain("اللقطة المصمَّمة");
  });

  it("بلا مصدر: fade وmove وintensity وطول الظل والظل الحاد بلا أثر فتُرفض", () => {
    const msgs = lightingIssues("alley-tale", { lighting: "key off\nintensity 0.5\nfade 0 1 0\nmove 1 1 0\nshadow hard 2" }).map((i) => i.message);
    for (const w of ["intensity", "fade", "move", "طول الظل", "shadow hard"]) expect(msgs.join("\n")).toContain(w);
    // ما له أثر بلا مصدر مقبول: العتمة العامة والدفء والضوء الخلفي وإلغاء الظل
    expect(lightingIssues("alley-tale", { lighting: "key off\nambient 0.5\nwarmth 0.3\nback 0.4\nshadow off" })).toEqual([]);
  });

  it("المنظور مع كاميرا ثابتة: تنبيه لأنه لا يظهر", () => {
    const w = lightingIssues("alley-tale", { lighting: "night-lamp\ndepth parallax 1.6", cameraMode: "composed", cameraPlan: "ثابت" });
    expect(w.map((i) => i.level)).toEqual(["warning"]);
  });

  it("نص المساعدة في الاستوديو يطابق القدرات: الطريق لا يذكر fg إلا مرفوضًا", () => {
    expect(lightingHelp("alley-tale")).toContain("parallax قيمة fg");
    const road = lightingHelp("road-journey");
    expect(road).not.toContain("parallax قيمة fg");
    expect(road).toContain("depth fg غير مدعوم هنا");
  });
});

describe("الشخصيات الثانوية", () => {
  it("الشاهدان والحاضرة في «الحارة» تضيئهم إضاءة المشهد، وبدونها لا يتغيرون", async () => {
    F = 80;
    const { AlleyTale } = await import("../src/remotion/scenes/AlleyTale");
    const scene = (lighting?: string) =>
      renderToStaticMarkup(React.createElement(AlleyTale, { narration: "يشهد الناس ما حدث.", place: "alley", mood: "night", cast: "witnesses", themeId: "night", orientation: "landscape", ...(lighting ? { lighting } : {}) } as never));
    const lit = scene("night-lamp");
    // ظل ملقى لكل شخصية مضاءة: البطل + ثلاثة في الموقف
    expect((lit.match(/feGaussianBlur/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(scene()).not.toContain("feGaussianBlur");
  });
});
