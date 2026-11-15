import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SHOTS } from "../src/remotion/illus/shots";
import { FRUIT_PAN, OCCLUDER, SX, WEIGHT_PAN_BOX } from "../src/remotion/illus/shots/ep001";
import { GROUND } from "../src/remotion/illus/world";
import { ctxFor, framingIssues, planScenes } from "./helpers/ep001Shots";

/**
 * ملاحظة المالك nce96d54edd (١٥ نوفمبر، بالإسلام 001، c1-s3 «نظر الأول إلى الميزان، وقال: هذا ظلم»):
 * «المشهد غير مظبوط مع الكلام والجمل والمعنى». كان الحاجب دائرة كبيرة تغطي الميزان كله، ولا حدث عند «وقال».
 * قرار المالك: تبقى الفكرة (لا يرى الأول الثقل) وتتضح: صُرّة تحجب الكفة اليسرى والثقل وحدهما، والميزان ويد البائع
 * ظاهران، وعند «وقال» يشير الأول، و«ظلم» بطاقة أكبر.
 */
const scene = planScenes().find((s) => s.props.shot === "ep001-scale-witness1")!;
const inSack = (x: number, y: number) => ((x - OCCLUDER.cx) / OCCLUDER.rx) ** 2 + ((y - OCCLUDER.cy) / OCCLUDER.ry) ** 2 <= 1;
const markup = (frame: number, portrait = false) => {
  const c = ctxFor(scene, portrait);
  return renderToStaticMarkup(<svg>{SHOTS[scene.props.shot!]!.render({ frame, fps: 30, dur: c.dur, portrait, at: c.at }).world}</svg>);
};
const startOf = (bare: string) => {
  const c = ctxFor(scene, false);
  return c.timings.find((t) => t.word.replace(/[ً-ْ،.:؟]/g, "") === bare)!.start;
};

describe("c1-s3: ما يراه الأول (ملاحظة nce96d54edd)", () => {
  it("الصُّرّة تحجب الكفة اليسرى والثقل وحدهما: كفة الفاكهة وعمود الميزان خارجها", () => {
    const b = WEIGHT_PAN_BOX;
    for (const [x, y] of [[b.lo, b.top], [b.hi, b.top], [b.lo, b.bottom], [b.hi, b.bottom]] as const) expect(inSack(x, y), `${x},${y}`).toBe(true);
    expect(inSack(FRUIT_PAN[0], FRUIT_PAN[1])).toBe(false);
    for (let y = GROUND - 480; y <= GROUND - 160; y += 20) expect(inSack(SX, y), `post ${y}`).toBe(false);
  });

  it("عند «وقال» يشير الأول، لا قبلها", () => {
    const tQ = startOf("وقال");
    expect(markup(tQ - 6)).not.toContain('data-pose="point"');
    expect(markup(tQ + 10)).toContain('data-pose="point"');
  });

  it("التأطير سليم بالاتجاهين", () => {
    expect(framingIssues(scene, false)).toEqual([]);
    expect(framingIssues(scene, true)).toEqual([]);
  });
});
