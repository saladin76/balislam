import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SHOTS } from "../src/remotion/illus/shots";
import { SHOP_CHAIR } from "../src/remotion/illus/shots/interior";
import { GROUND } from "../src/remotion/illus/world";
import { makeAt } from "../src/remotion/illus/shots/kit";
import { spokenTimings } from "../src/remotion/scenes/Episode";
import { sceneFrames } from "../src/plan/duration";
import type { PlanScene } from "../src/plan/types";

/**
 * التوجيه 021: الحركة منطقية في كل لقطة.
 * c1-s7: الكرسي لا يتحرك إلا ويد الزميل على المقعد (لا تأرجح ذاتي)، والفراغ تحت الساق القصيرة ظاهر قبل الضغط وبعده.
 * c2-s12: الميزان لا يتحرك في النصف الثاني (المعنى في الثبات) حتى تُعلّق البطاقة.
 * c2-s5: لا درجة في صحن الدار؛ التكبر من الفعل لا من مكان الوقوف.
 */
const plan = JSON.parse(fs.readFileSync(path.join(__dirname, "../channels/balislam/episodes/001-know-the-truth/plan.json"), "utf8"));
const scene = (id: string) => plan.chapters.flatMap((c: { scenes: PlanScene[] }) => c.scenes).find((s: PlanScene) => s.id === id) as PlanScene & { props: { shot: string } };
const ctx = (id: string) => {
  const s = scene(id);
  const dur = sceneFrames(s);
  return { s, dur, at: makeAt(spokenTimings(s.narration, dur), dur) };
};
const world = (id: string, frame: number, portrait = false) => {
  const { s, dur, at } = ctx(id);
  return renderToStaticMarkup(<svg>{SHOTS[s.props.shot]!.render({ frame, fps: 30, dur, portrait, at }).world}</svg>);
};

describe("التوجيه 021", () => {
  it("c1-s7: الفراغ تحت الساق القصيرة ظاهر في كل إطار قبل الضغط وبعد آخر رفع؛ والكرسي لا يميل وحده", () => {
    const { dur, at } = ctx("c1-s7");
    const p0 = at("صحيحة", 0.35) - 6;
    const { x, depth, leg, short } = SHOP_CHAIR;
    const gapRect = `<rect x="${x - depth / 2 - 3}" y="${GROUND - short}" width="${leg + 6}" height="${short}"`;
    for (let f = 0; f < p0; f++) expect(world("c1-s7", f), `إطار ${f}`).toContain(gapRect);
    for (let f = p0 + 30 + 24; f < dur; f++) expect(world("c1-s7", f), `إطار ${f}`).toContain(gapRect);
    // في ذروة الضغط تلمس الساق الأرض فيختفي الفراغ
    expect(world("c1-s7", p0 + 12)).not.toContain(`width="${leg + 6}" height="${short}"`);
  });

  it("c2-s12: النصف الثاني ساكن حتى البطاقة (لا حركة ميزان مكررة)", () => {
    const { at } = ctx("c2-s12");
    const half = at("والباطل", 0.42);
    const tJ = at("تبريرا", 0.78);
    const a = world("c2-s12", half);
    const b = world("c2-s12", tJ - 8);
    // الميزان نفسه بالميل نفسه: المقارنة بعد حذف ما يتحرك في خلفية الدكان (لا شيء من الميزان)
    const beam = (m: string) => m.match(/<line x1="[^"]+" y1="[^"]+" x2="[^"]+" y2="[^"]+" stroke="[^"]+" stroke-width="7"/g);
    expect(beam(a)).not.toBeNull();
    expect(beam(a)).toEqual(beam(b));
  });

  it("c2-s5: لا درجة تحت المتكبر", () => {
    expect(world("c2-s5", 60)).not.toMatch(/width="300" height="44"/);
  });
});
