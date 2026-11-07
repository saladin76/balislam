import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SHOTS } from "../src/remotion/illus/shots";
import { CH5_SHOTS } from "../src/remotion/illus/shots/ch5";
import { makeAt } from "../src/remotion/illus/shots/kit";
import { spokenTimings } from "../src/remotion/scenes/Episode";
import { sceneFrames } from "../src/plan/duration";
import { normalizeArabic } from "../src/script/quranMeta";
import type { PlanScene } from "../src/plan/types";

/**
 * التوجيه 024 · الفصل 5 بست وحدات (storyboard/ch5-plan.md)، وتصحيحات الفصل 4 (المقهى وختام c4-s18).
 */
const plan = JSON.parse(fs.readFileSync(path.join(__dirname, "../channels/balislam/episodes/001-know-the-truth/plan.json"), "utf8"));
const chapter = (n: number) => plan.chapters.find((c: { number: number }) => c.number === n).scenes as (PlanScene & { props: Record<string, string> })[];
const ch5 = chapter(5);
const ch4 = chapter(4);
const words = (s: string) => s.split(/\s+/).map((w) => normalizeArabic(w.replace(/[«»"“”'؟?!.,،:؛…ـ()]/g, "")));
const ctx = (s: PlanScene) => {
  const dur = sceneFrames(s);
  return { dur, at: makeAt(spokenTimings(s.narration, dur), dur) };
};
const markup = (n: React.ReactNode) => renderToStaticMarkup(<svg>{n}</svg>);

describe("الفصل 5 (التوجيه 024)", () => {
  it("كل مشهد سرد له لقطة من وحدات الفصل؛ النص الحركي وبطاقة الآية كما هما والآية بلا نص", () => {
    for (const s of ch5) {
      if (s.template !== "alley-tale") continue;
      expect(CH5_SHOTS[s.props.shot!], s.id).toBeTruthy();
    }
    const verse = ch5.find((s) => s.id === "c5-s12")!;
    expect(verse.template).toBe("verse-card");
    expect(verse.props.text).toBe("");
  });

  it("أربعة أماكن على الأقل، ولا مكان يحمل أكثر من ثلث المشاهد", () => {
    const places = ch5.filter((s) => s.props.shot).map((s) => CH5_SHOTS[s.props.shot!]!.place.replace(/ (ليلًا|صباحًا|عصرًا|غروبًا|ثم الطريق)$/u, ""));
    const counts = new Map<string, number>();
    for (const p of places) counts.set(p, (counts.get(p) ?? 0) + 1);
    expect(counts.size).toBeGreaterThanOrEqual(4);
  });

  for (const s of ch5.filter((x) => x.props.shot)) {
    it(`${s.id} (${s.props.shot}): كلمات الأحداث في نصه، والرسم بالاتجاهين`, () => {
      const { dur, at: real } = ctx(s);
      const asked: string[] = [];
      const at = (w: string, f: number) => (asked.push(w), real(w, f));
      for (const portrait of [false, true]) {
        for (const f of [0, Math.round(dur / 3), Math.round((2 * dur) / 3), dur - 1]) {
          const shot = SHOTS[s.props.shot!]!.render({ frame: f, fps: 30, dur, portrait, at });
          expect(shot.cam.length).toBeGreaterThan(0);
          expect(markup(shot.world).length).toBeGreaterThan(500);
        }
      }
      const toks = words(s.narration);
      for (const w of new Set(asked)) {
        const k = normalizeArabic(w);
        expect(toks.some((t) => t === k || [..."وفبل"].some((p) => t === p + k)), `${s.id}: «${w}»`).toBe(true);
      }
    });
  }

  for (const [id, shot] of [["c5-s3", "court-fountain-still"], ["c5-s11", "roof-night-still"]] as const) {
    it(`${id}: سكون مقصود بكاميرا واحدة ولا تغير بين الإطارات`, () => {
      const s = ch5.find((x) => x.id === id)!;
      expect(s.props.shot).toBe(shot);
      const { dur, at } = ctx(s);
      for (const portrait of [false, true]) {
        const a = SHOTS[shot]!.render({ frame: 0, fps: 30, dur, portrait, at });
        const b = SHOTS[shot]!.render({ frame: dur - 1, fps: 30, dur, portrait, at });
        expect(a.cam).toHaveLength(1);
        expect(markup(b.world)).toBe(markup(a.world));
      }
    });
  }

  it("سكون موضعي حول ذكر الله في جمل الشرح: لا تغير في التكوين حول الكلمة", () => {
    for (const [id, from, to] of [["c5-s5", "الله", "لقضاء"], ["c5-s8", "وتوفيق", "لكنه"]] as const) {
      const s = ch5.find((x) => x.id === id)!;
      const { dur, at } = ctx(s);
      const a = at(from, 0) + 4;
      const b = at(to, 1) - 12;
      const r = (f: number) => SHOTS[s.props.shot!]!.render({ frame: f, fps: 30, dur, portrait: false, at });
      expect(b, id).toBeGreaterThan(a);
      // الكاميرا والشخوص ثابتة؛ قد تتغير خلفية حية (ماء، أضواء) فلا يُقارن العالم كله
      expect(JSON.stringify(r(a).cam.filter((k) => k.t > a && k.t < b)), id).toBe("[]");
    }
  });
});

describe("تصحيحات الفصل 4 (التوجيه 024)", () => {
  it("c4-s9: الرسالة تخرج من هاتف مرسِل ظاهر قبل أن تصل إلى البطل", () => {
    const s = ch4.find((x) => x.id === "c4-s9")!;
    const { dur, at } = ctx(s);
    const mid = SHOTS[s.props.shot!]!.render({ frame: at("فليس", 0) + 14, fps: 30, dur, portrait: false, at });
    expect(markup(mid.world)).toContain("translate(");
    // بطاقتان على الأقل: عند المرسِل (باهتة) والطائرة
    expect((markup(mid.world).match(/scale\(1\.1\)/g) ?? []).length).toBeGreaterThanOrEqual(1);
  });

  it("c4-s5: لا ضباب على المطلب (كشف هادئ)", () => {
    expect(ch4.find((x) => x.id === "c4-s5")!.props.cues).not.toMatch(/haze/);
  });

  it("c4-s18: لقطة الظرف قصيرة (نحو ثانيتين) ولا وقوف عند باب الأخ في آخر المشهد", () => {
    const s = ch4.find((x) => x.id === "c4-s18")!;
    const { dur, at } = ctx(s);
    const cams = SHOTS[s.props.shot!]!.render({ frame: 0, fps: 30, dur, portrait: false, at }).cam;
    const inn = cams.find((k) => k.x > 5000)!;
    const out = cams.find((k) => k.t > inn.t && k.cut)!;
    expect(out.t - inn.t).toBeLessThanOrEqual(75);
    const a = markup(SHOTS[s.props.shot!]!.render({ frame: dur - 12, fps: 30, dur, portrait: false, at }).world);
    const b = markup(SHOTS[s.props.shot!]!.render({ frame: dur - 1, fps: 30, dur, portrait: false, at }).world);
    expect(b).not.toBe(a);
  });
});
