import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SHOTS } from "../src/remotion/illus/shots";
import { CH4_SHOTS } from "../src/remotion/illus/shots/ch4";
import { makeAt } from "../src/remotion/illus/shots/kit";
import { spokenTimings } from "../src/remotion/scenes/Episode";
import { sceneFrames } from "../src/plan/duration";
import { normalizeArabic } from "../src/script/quranMeta";
import type { PlanScene } from "../src/plan/types";

/**
 * التوجيه 023 · ستوري بورد الفصل 4 (التخطيط في storyboard/ch4-plan.md): لوح الدعاء مرجع لا يتغير،
 * والأمثلة بين بطاقاته لها كاميرا عمودية مستقلة، والختام في زقاق الفصل 3: c4-s16 وc4-s17 (ذكر الله) ساكنان تمامًا.
 */
const plan = JSON.parse(fs.readFileSync(path.join(__dirname, "../channels/balislam/episodes/001-know-the-truth/plan.json"), "utf8"));
const ch4 = plan.chapters.find((c: { number: number }) => c.number === 4).scenes as (PlanScene & { props: { shot?: string; source?: string } })[];
const words = (s: string) => s.split(/\s+/).map((w) => normalizeArabic(w.replace(/[«»"“”'؟?!.,،:؛…ـ()]/g, "")));
const ctx = (s: PlanScene) => {
  const dur = sceneFrames(s);
  return { dur, at: makeAt(spokenTimings(s.narration, dur), dur) };
};

describe("الفصل 4 (التوجيه 023)", () => {
  it("لوح الدعاء باقٍ في مشاهده، والمصدر لا ينسب الدعاء إلى النبي ﷺ", () => {
    const boards = ch4.filter((s) => s.template === "dua-board").map((s) => s.id);
    expect(boards).toEqual(["c4-s1", "c4-s2", "c4-s3", "c4-s4", "c4-s5", "c4-s6", "c4-s8", "c4-s12", "c4-s13", "c4-s14", "c4-s15"]);
    const src = ch4.find((s) => s.id === "c4-s1")!.props.source!;
    expect(src).toBe("من الأدعية المأثورة في كلام أهل العلم");
    expect(src).not.toMatch(/النبي|رسول|ﷺ/);
  });

  it("كل مشهد سرد في الفصل له لقطة، وكلمات أحداث الختام في نصه", () => {
    for (const s of ch4.filter((x) => x.template === "alley-tale")) expect(SHOTS[s.props.shot!], s.id).toBeTruthy();
    for (const s of ch4.filter((x) => x.props.shot && CH4_SHOTS[x.props.shot])) {
      const { dur, at: real } = ctx(s);
      const asked: string[] = [];
      const at = (w: string, f: number) => (asked.push(w), real(w, f));
      for (const portrait of [false, true]) for (const f of [0, Math.round(dur / 2), dur - 1]) {
        const shot = SHOTS[s.props.shot!]!.render({ frame: f, fps: 30, dur, portrait, at });
        expect(renderToStaticMarkup(<svg>{shot.world}</svg>).length).toBeGreaterThan(500);
      }
      const toks = words(s.narration);
      for (const w of new Set(asked)) {
        const k = normalizeArabic(w);
        expect(toks.some((t) => t === k || [..."وفبل"].some((p) => t === p + k)), `${s.id}: «${w}»`).toBe(true);
      }
    }
  });

  for (const id of ["c4-s16", "c4-s17"]) {
    it(`${id}: ذكر الله، سكون تام بكاميرا واحدة`, () => {
      const s = ch4.find((x) => x.id === id)!;
      expect(s.props.shot).toBe("lane-threshold-still");
      const { dur, at } = ctx(s);
      for (const portrait of [false, true]) {
        const a = SHOTS["lane-threshold-still"]!.render({ frame: 0, fps: 30, dur, portrait, at });
        const b = SHOTS["lane-threshold-still"]!.render({ frame: dur - 1, fps: 30, dur, portrait, at });
        expect(a.cam).toHaveLength(1);
        expect(renderToStaticMarkup(<svg>{b.world}</svg>)).toBe(renderToStaticMarkup(<svg>{a.world}</svg>));
      }
    });
  }

  it("الأمثلة لها كاميرا عمودية مستقلة، ولقطة الهاتف بعين البطل تُرسم في العمودي", () => {
    for (const id of ["c4-s7", "c4-s9", "c4-s10", "c4-s11"]) {
      const s = ch4.find((x) => x.id === id)!;
      const { dur, at } = ctx(s);
      const L = SHOTS[s.props.shot!]!.render({ frame: 0, fps: 30, dur, portrait: false, at });
      const P = SHOTS[s.props.shot!]!.render({ frame: 0, fps: 30, dur, portrait: true, at });
      expect(JSON.stringify(P.cam), id).not.toBe(JSON.stringify(L.cam));
    }
    for (const id of ["c4-s9", "c4-s10"]) {
      const s = ch4.find((x) => x.id === id)!;
      const { dur, at } = ctx(s);
      const P = SHOTS[s.props.shot!]!.render({ frame: id === "c4-s9" ? dur - 1 : 0, fps: 30, dur, portrait: true, at });
      expect(P.cam.some((k) => k.cut && k.x > 5000), id).toBe(true);
      expect(renderToStaticMarkup(<svg>{P.world}</svg>), id).toContain("translate(5000 0)");
    }
  });
});
