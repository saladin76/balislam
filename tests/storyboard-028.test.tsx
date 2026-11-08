import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SHOTS } from "../src/remotion/illus/shots";
import { camAt, makeAt } from "../src/remotion/illus/shots/kit";
import { FOREGROUND } from "../src/remotion/illus/shots/ch6";
import { EVIDENCE_FOCUS, scaleSincereBeats, scaleSincereCast, scaleSincereEvidence } from "../src/remotion/illus/shots/scale";
import { spokenTimings } from "../src/remotion/scenes/Episode";
import { sceneFrames } from "../src/plan/duration";
import type { PlanScene } from "../src/plan/types";

/**
 * التوجيه 028 · إغلاق ستوري بورد الحلقة 001: c1-s3 «من الحكم إلى الدليل»، وزوايا ختام الأخوين c6-s19 → c6-s22،
 * وتأطير c6-s3، وضوء ما قبل الفجر في c6-s14 (الأفقي).
 */
type S = PlanScene & { props: Record<string, string> };
const plan = JSON.parse(fs.readFileSync(path.join(__dirname, "../channels/balislam/episodes/001-know-the-truth/plan.json"), "utf8"));
const scene = (id: string) => plan.chapters.flatMap((c: { scenes: S[] }) => c.scenes).find((s: S) => s.id === id) as S;
const ctx = (s: PlanScene) => {
  const dur = sceneFrames(s);
  return { dur, at: makeAt(spokenTimings(s.narration, dur), dur) };
};
const render = (id: string, frame: number, portrait = false) => {
  const s = scene(id);
  const { dur, at } = ctx(s);
  return SHOTS[s.props.shot!]!.render({ frame, fps: 30, dur, portrait, at });
};
const camOf = (id: string, frame: number, portrait = false) => camAt(frame, render(id, frame, portrait).cam);
const markup = (n: React.ReactNode) => renderToStaticMarkup(<svg>{n}</svg>);

describe("c1-s3 من الحكم إلى الدليل (التوجيه 028)", () => {
  const s = scene("c1-s3");
  const { dur, at } = ctx(s);
  const b = scaleSincereBeats(at);

  it("الترتيب على الكلمات: صادقًا ← لكن ← لا يكفي ← لإثبات", () => {
    expect(b.sincere).toBeLessThan(b.but);
    expect(b.but).toBeLessThan(b.enough);
    expect(b.enough).toBeLessThan(b.proof);
    expect(b.proof).toBeLessThan(dur);
  });

  it("النظرتان تتجهان إلى الميزان عند «لا يكفي» لا قبلها، والجسد واليد على الصدر كما هما", () => {
    const before = scaleSincereCast(b.enough - 1, b);
    const after = scaleSincereCast(b.enough + 24, b);
    expect(after.first.head).toBeGreaterThan(before.first.head + 10);
    expect(after.second.head).toBeGreaterThan(before.second.head + 6);
    expect(after.first.armFront).toEqual(before.first.armFront);
    expect(after.first.lean).toBe(before.first.lean);
    expect(after.second.armFront).toEqual(before.second.armFront);
  });

  it("الضوء عند «لإثبات» فقط، ومركزه محور العاتق فلا تُرجَّح كفة؛ والكاميرا ثابتة والشاهدان في الإطار", () => {
    expect(scaleSincereEvidence(b.enough, b)).toBe(0);
    expect(scaleSincereEvidence(b.proof + 20, b)).toBe(1);
    expect(EVIDENCE_FOCUS.cx).toBe(1020);
    for (const portrait of [false, true]) {
      const shot = render("c1-s3", dur - 1, portrait);
      expect(shot.cam).toHaveLength(1);
      expect(markup(shot.world)).toContain("radialGradient");
    }
  });

  it("الواقعة لا تتغير: لا حركة في الميزان والبرتقال بين بداية المشهد ونهايته", () => {
    const strip = (m: string) => m.replace(/<radialGradient[\s\S]*?<\/radialGradient>|<circle[^>]*url\([^)]*\)[^>]*\/>|<rect[^>]*url\([^)]*\)[^>]*\/>/g, "");
    const scaleOf = (m: string) => (m.match(/<line [^>]*stroke-width="7"[^>]*\/>/g) ?? []).join("");
    const a = strip(markup(render("c1-s3", 0).world));
    const z = strip(markup(render("c1-s3", dur - 1).world));
    expect(scaleOf(a)).toBe(scaleOf(z));
    expect((a.match(/r="13"/g) ?? []).length).toBe((z.match(/r="13"/g) ?? []).length);
  });
});

describe("ختام الأخوين c6-s19 → c6-s22 (التوجيه 028)", () => {
  const d19 = ctx(scene("c6-s19")).dur;
  const d20 = ctx(scene("c6-s20")).dur;
  const d21 = ctx(scene("c6-s21")).dur;

  for (const portrait of [false, true]) {
    const o = portrait ? "العمودي" : "الأفقي";
    it(`${o}: c6-s19 ثلاث زوايا بقطعات (الاثنان، ثم الأخ، ثم البطل) في مناطق مستقلة لا قص`, () => {
      const cam = render("c6-s19", 0, portrait).cam;
      expect(cam).toHaveLength(3);
      expect(cam[1]!.cut && cam[2]!.cut).toBe(true);
      const x0 = cam[0]!.x;
      expect(x0).toBeLessThan(2500);
      expect(cam[1]!.x).toBeGreaterThan(8000);
      expect(cam[2]!.x).toBeGreaterThan(12000);
    });

    it(`${o}: c6-s20 يبدأ بتأطير آخر c6-s19، وc6-s21 يبدأ بتأطير آخر c6-s20 وينتهي بتأطير c6-s22`, () => {
      expect(camOf("c6-s20", 0, portrait)).toEqual(camOf("c6-s19", d19 - 1, portrait));
      expect(camOf("c6-s21", 0, portrait)).toEqual(camOf("c6-s20", d20 - 1, portrait));
      expect(camOf("c6-s21", d21 - 1, portrait)).toEqual(camOf("c6-s22", 0, portrait));
    });

    it(`${o}: c6-s21 عودة قصيرة إلى الأخ عند «الحق» ثم يجمعهما الإطار عند «مستعدًا»`, () => {
      const cam = render("c6-s21", 0, portrait).cam;
      expect(cam).toHaveLength(3);
      expect(cam[1]!.x).toBeGreaterThan(8000);
      expect(cam[1]!.x).toBeLessThan(12000);
      expect(cam[2]!.x).toBeLessThan(2500);
      expect(cam[2]!.t - cam[1]!.t).toBeGreaterThanOrEqual(20);
    });
  }

  it("c6-s22 مجمَّد: الرسم نفسه في كل إطار", () => {
    const still = markup(render("c6-s22", 0).world);
    expect(still.length).toBeGreaterThan(500);
    for (const f of [30, 90]) expect(markup(render("c6-s22", f).world)).toBe(still);
  });
});

describe("c6-s3 وc6-s14 (التوجيه 028)", () => {
  it("c6-s3 تأطير ثابت مختلف عن آخر c6-s1 وعن c6-s4", () => {
    for (const portrait of [false, true]) {
      const s3 = camOf("c6-s3", 0, portrait);
      const s1 = camOf("c6-s1", ctx(scene("c6-s1")).dur - 1, portrait);
      const s4 = camOf("c6-s4", 0, portrait);
      expect(render("c6-s3", 0, portrait).cam).toHaveLength(1);
      expect(s3.z).toBeGreaterThan(s1.z + 0.6);
      expect(s3.z).toBeGreaterThan(s4.z + 0.6);
    }
  });

  it("c6-s14 الأفقي: المصباح داخل الإطار في أوله، وطبقة البرودة تزول مع الضوء", () => {
    const c = camOf("c6-s14", 0);
    const half = { w: 960 / c.z, h: 540 / c.z };
    expect(Math.abs(620 - c.x)).toBeLessThan(half.w - 60);
    expect(Math.abs(330 - c.y)).toBeLessThan(half.h - 40);
    const d = ctx(scene("c6-s14")).dur;
    expect(markup(render("c6-s14", d - 1).world)).toContain('opacity="0"');
  });
});

describe("عنصر المقدمة في زاويتي الأخوين (ملحق 028، concept-028b)", () => {
  // مناطق الزاويتين في ch6.tsx: زاوية الأخ عند 9000، وزاوية البطل عند 13000
  const ANG = { bro: 9000, hero: 13000 };
  const inFrame = (id: string, frame: number, portrait: boolean, fgX: number) => {
    const c = camOf(id, frame, portrait);
    const half = (portrait ? 304 : 960) / c.z;
    return Math.abs(fgX - c.x) < half;
  };
  for (const portrait of [false, true]) {
    const o = portrait ? "العمودي" : "الأفقي";
    const P = portrait ? FOREGROUND.portrait : FOREGROUND.landscape;
    it(`${o}: الأخ المقابل داخل الإطار في لقطتي الكتف، بموضعه عند طرف الإطار لا وسطه`, () => {
      const s19 = ctx(scene("c6-s19")).dur;
      expect(inFrame("c6-s19", 170, portrait, ANG.bro + P.dx)).toBe(true);
      expect(inFrame("c6-s19", s19 - 1, portrait, ANG.hero - P.dx)).toBe(true);
      expect(inFrame("c6-s21", 70, portrait, ANG.bro + P.dx)).toBe(true);
      const c = camOf("c6-s19", 170, portrait);
      expect(ANG.bro + P.dx - c.x).toBeGreaterThan(((portrait ? 304 : 960) / c.z) * 0.6);
    });
  }

  it("يُرسم بملابسه لا ظلًا صامتًا: لون معطفه في الرسم، وطبقة الليل فوقه جزئية", () => {
    expect(FOREGROUND.night).toBeLessThan(0.35);
    expect(FOREGROUND.shade).toBeGreaterThan(1);
    const m = markup(render("c6-s19", 170).world);
    expect(m).toContain("feGaussianBlur");
  });

  it("c6-s20 القريبة بلا عنصر مقدمة بعد الاقتراب", () => {
    const d = ctx(scene("c6-s20")).dur;
    expect(inFrame("c6-s20", d - 1, false, ANG.hero - FOREGROUND.landscape.dx + 260)).toBe(false);
  });
});
