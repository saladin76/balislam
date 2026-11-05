import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LIGHT_PRESET_IDS, lightAt, parseLighting, parseLightingLines } from "../src/plan/lighting";
import { LitFigure, shadowGeometry } from "../src/remotion/illus/light";
import { POSES } from "../src/remotion/illus/Figure";

/**
 * الإضاءة والظلال والعمق (الأمر 008): نظام اختياري من خطة المشهد (حقل lighting).
 */
describe("خطة الإضاءة", () => {
  it("بلا حقل: لا إضاءة إطلاقًا (المشهد كما كان)", () => {
    expect(parseLighting(undefined)).toBeNull();
    expect(parseLighting("  \n ")).toBeNull();
  });

  it("الإعدادات الجاهزة تُقرأ، والسطور التالية تعدّلها", () => {
    for (const id of LIGHT_PRESET_IDS) expect(parseLightingLines(id).bad).toEqual([]);
    const r = parseLighting("night-lamp\nwarmth -0.5\nshadow hard 1.8\ndepth dof 0.4 fg")!;
    expect(r.key?.kind).toBe("lamp");
    expect(r.warmth).toBe(-0.5);
    expect(r.shadow).toEqual({ mode: "hard", length: 1.8 });
    expect(r.depth.dof).toBe(0.4);
    expect(r.depth.fg).toBe(true);
    // العمق اختياري: الافتراضي بلا ضبابية ولا ضباب
    expect(parseLighting("night-lamp")!.depth).toMatchObject({ dof: 0, fog: 0, parallax: 1, fg: false });
  });

  it("السطر الخاطئ أو القيمة خارج حدودها تُكشف برقم سطرها", () => {
    expect(parseLightingLines("night-lamp\nkey torch 1 2\nwarmth 3\nshadow blurry\ndepth dof 2").bad).toEqual([2, 3, 4, 5]);
  });

  it("تغير تدريجي للشدة عند الكلمة، وانتقال المصدر (تغير اتجاه الضوء)", () => {
    const rig = parseLighting("key lamp 1700 420\nfade 0.3 1 الحقيقة 40\nmove 300 420 60 30")!;
    const word = (w: string) => (w === "الحقيقة" ? 100 : undefined);
    expect(lightAt(rig, 50, word).intensity).toBeCloseTo(0.3, 5);
    const mid = lightAt(rig, 120, word).intensity;
    expect(mid).toBeGreaterThan(0.3);
    expect(mid).toBeLessThan(1);
    expect(lightAt(rig, 200, word).intensity).toBeCloseTo(1, 5);
    expect(lightAt(rig, 59, word).key!.x).toBe(1700);
    expect(lightAt(rig, 90, word).key!.x).toBeCloseTo(300, 5);
  });

  it("فحص الخطة يرفض الإضاءة غير الصالحة ويقبل الصالحة", async () => {
    const { planIssues } = await import("../src/plan/validate");
    const scene = (props: Record<string, string>) => ({
      version: 1 as const, episode: "000", title: "t", domain: "psychology" as const, themeId: "night" as const, channel: "balislam", updatedAt: "",
      chapters: [{ number: 1, title: "t", scenes: [{ id: "c1-s1", template: "alley-tale", narration: "يمشي في الحارة.", line: 0, props, sfx: [] }] }],
    });
    const msgs = (props: Record<string, string>) => planIssues(scene(props) as never).map((i) => i.message).join("\n");
    expect(msgs({ lighting: "night-lamp\nintensity 9" })).toContain("الإضاءة غير صالحة في السطر 2");
    expect(msgs({ lighting: "dawn-sun\ndepth fog 0.3" })).not.toContain("الإضاءة");
  });
});

describe("الظلال", () => {
  const lamp = { kind: "lamp" as const, x: 1400, y: 430 };

  it("الظل يميل بعيدًا عن المصدر ويطول كلما ابتعدت الشخصية عنه، ويخف", () => {
    const near = shadowGeometry(1300, lamp, 1, "soft", 1);
    const far = shadowGeometry(600, lamp, 1, "soft", 1);
    // الشخصية يسار المصباح: الظل يميل إلى اليسار (skew موجب = بعيدًا)
    expect(Math.sign(far.skew)).toBe(Math.sign(600 - 1400));
    expect(Math.abs(far.skew)).toBeGreaterThan(Math.abs(near.skew));
    expect(far.fade).toBeLessThan(near.fade);
    // على الجهة الأخرى من المصباح ينقلب اتجاهه
    expect(Math.sign(shadowGeometry(1900, lamp, 1, "soft", 1).skew)).toBe(1);
  });

  it("الشمس العالية ظل قصير مجتمع، والمنخفضة ظل أطول", () => {
    const noon = shadowGeometry(960, { kind: "sun", x: 700, y: -900 }, 1, "soft", 1);
    const dawn = shadowGeometry(960, { kind: "sun", x: 2300, y: 600 }, 1, "soft", 1);
    expect(dawn.flat).toBeGreaterThan(noon.flat);
    expect(Math.abs(dawn.skew)).toBeGreaterThan(Math.abs(noon.skew));
  });

  it("لا ظل أسود حاد: الشفافية دون 0.9 دائمًا، والناعم أنعم من الحاد", () => {
    for (const x of [200, 900, 1400, 1800])
      for (const mode of ["soft", "hard"] as const) expect(shadowGeometry(x, lamp, 1.5, mode, 2.5).fade).toBeLessThanOrEqual(0.9);
    expect(shadowGeometry(900, lamp, 1, "soft", 1).blur).toBeGreaterThan(shadowGeometry(900, lamp, 1, "hard", 1).blur);
  });

  it("shadow off يعطّل الظلال كليًا (للقوالب التي لا تحتاجها)", () => {
    const render = (lighting: string) => {
      const light = lightAt(parseLighting(lighting)!, 0, () => undefined);
      return renderToStaticMarkup(React.createElement("svg", null, React.createElement(LitFigure, { light, x: 900, y: 860, scale: 1.75, pose: POSES.stand, frame: 0 })));
    };
    expect(render("night-lamp")).toContain("feGaussianBlur");
    const off = render("night-lamp\nshadow off");
    expect(off).not.toContain("feGaussianBlur");
    expect(off).not.toContain("contact");
  });
});

describe("الطبقة المشتركة (الأمر 009)", () => {
  const fig = { x: 900, y: 860, scale: 1.75, pose: POSES.stand, frame: 3 };
  it("SceneFigure بلا إضاءة = الشخصية العادية حرفيًا", async () => {
    const { SceneFigure } = await import("../src/remotion/illus/light");
    const { Figure } = await import("../src/remotion/illus/Figure");
    const a = renderToStaticMarkup(React.createElement("svg", null, React.createElement(SceneFigure, { light: null, ...fig, flip: true })));
    const b = renderToStaticMarkup(React.createElement("svg", null, React.createElement(Figure, { ...fig, flip: true })));
    expect(a).toBe(b);
  });

  it("figureLight حساب خالص: جهة الضوء والحافة وظل التماس دون رسم", async () => {
    const { figureLight } = await import("../src/remotion/illus/light");
    const light = lightAt(parseLighting("night-lamp")!, 0, () => undefined);
    const l = figureLight(light, { x: 600, scale: 1.75, facing: -1 });
    expect(l.side).toBe(1); // المصباح عند 1420 يمين الشخصية
    expect(l.behind).toBe(true); // تنظر يسارًا والضوء من خلفها
    expect(l.geo!.skew).toBeLessThan(0);
    expect(figureLight(lightAt(parseLighting("night-lamp\nshadow off")!, 0, () => undefined), { x: 600, scale: 1 }).contact).toBeNull();
  });

  it("ألوان الإضاءة من القناة: لوحة أخرى تغير الألوان لا الحسابات", async () => {
    const { LightPaletteContext, BALISLAM_LIGHT, LitFigure } = await import("../src/remotion/illus/light");
    const light = lightAt(parseLighting("night-lamp")!, 0, () => undefined);
    const draw = (pal?: typeof BALISLAM_LIGHT) => {
      const el = React.createElement("svg", null, React.createElement(LitFigure, { light, ...fig }));
      return renderToStaticMarkup(pal ? React.createElement(LightPaletteContext.Provider, { value: pal }, el) : el);
    };
    const other = draw({ ...BALISLAM_LIGHT, shadow: "#202020", warm: "#E8F542" });
    expect(draw(BALISLAM_LIGHT)).toBe(draw());
    expect(other).not.toBe(draw());
    expect(other).toContain("#202020");
    // البنية نفسها: عدد العناصر لا يتغير
    expect(other.split("<").length).toBe(draw().split("<").length);
  });
});
