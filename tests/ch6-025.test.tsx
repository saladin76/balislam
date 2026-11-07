import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SHOTS } from "../src/remotion/illus/shots";
import { CH6_SHOTS } from "../src/remotion/illus/shots/ch6";
import { makeAt } from "../src/remotion/illus/shots/kit";
import { spokenTimings } from "../src/remotion/scenes/Episode";
import { sceneFrames } from "../src/plan/duration";
import { normalizeArabic } from "../src/script/quranMeta";
import type { PlanScene } from "../src/plan/types";

/**
 * التوجيه 025 · الفصل 6 ختام الحلقة (storyboard/ch6-plan.md)، وتصحيحات الفصل 5 (ch5-v2).
 */
const plan = JSON.parse(fs.readFileSync(path.join(__dirname, "../channels/balislam/episodes/001-know-the-truth/plan.json"), "utf8"));
const chapter = (n: number) => plan.chapters.find((c: { number: number }) => c.number === n).scenes as (PlanScene & { props: Record<string, string> })[];
const ch6 = chapter(6);
const ch5 = chapter(5);
const words = (s: string) => s.split(/\s+/).map((w) => normalizeArabic(w.replace(/[«»"“”'؟?!.,،:؛…ـ()]/g, "")));
const ctx = (s: PlanScene) => {
  const dur = sceneFrames(s);
  return { dur, at: makeAt(spokenTimings(s.narration, dur), dur) };
};
const markup = (n: React.ReactNode) => renderToStaticMarkup(<svg>{n}</svg>);
const render = (s: PlanScene & { props: Record<string, string> }, frame: number, portrait = false) => {
  const { dur, at } = ctx(s);
  return SHOTS[s.props.shot!]!.render({ frame, fps: 30, dur, portrait, at });
};

describe("الفصل 6 (التوجيه 025)", () => {
  it("كل مشهد سرد له لقطة من الفصل؛ الآية والنص الحركي والشاشة الختامية كما هي، والآية بلا نص", () => {
    for (const s of ch6) {
      if (s.template !== "alley-tale") continue;
      expect(CH6_SHOTS[s.props.shot!], s.id).toBeTruthy();
    }
    expect(ch6.find((s) => s.id === "c6-s9")!.props.text).toBe("");
    expect(ch6.find((s) => s.id === "c6-s23")!.template).toBe("kinetic-text");
  });

  for (const s of ch6.filter((x) => x.props.shot)) {
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

  for (const [id, shot] of [["c6-s8", "cafe-still"], ["c6-s22", "brother-bench-still"]] as const) {
    it(`${id}: سكون مقصود بكاميرا واحدة ولا تغير بين الإطارات`, () => {
      const s = ch6.find((x) => x.id === id)!;
      expect(s.props.shot).toBe(shot);
      const { dur } = ctx(s);
      for (const portrait of [false, true]) {
        const a = render(s, 0, portrait);
        const b = render(s, dur - 1, portrait);
        expect(a.cam).toHaveLength(1);
        expect(markup(b.world)).toBe(markup(a.world));
      }
    });
  }

  it("قصة الأخ أحداث مستقلة بالترتيب: لا طرق قبل c6-s15، والظرف معه حتى c6-s16 ثم في يد الأخ", () => {
    const order = ["c6-s1", "c6-s4", "c6-s14", "c6-s15", "c6-s16", "c6-s19", "c6-s24"];
    const idx = order.map((id) => ch6.findIndex((s) => s.id === id));
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
    // الباب لا يُفتح إلا بالطرق: في c6-s15 قبل «أخطأت» وبعد فتح الباب مشهدان مختلفان
    const knock = ch6.find((x) => x.id === "c6-s15")!;
    const k = ctx(knock);
    expect(markup(render(knock, k.at("أخطأت", 0) - 4).world)).not.toBe(markup(render(knock, k.at("أخطأت", 0) + 40).world));
    const give = ch6.find((x) => x.id === "c6-s16")!;
    const { dur, at } = ctx(give);
    const before = markup(render(give, at("الحق", 0) + 4).world);
    const after = markup(render(give, dur - 1).world);
    expect(before).not.toBe(after);
  });

  it("لا حدث عند «الوحي» في c6-s18: التكوين ثابت حتى «العلم»", () => {
    const s = ch6.find((x) => x.id === "c6-s18")!;
    const { at } = ctx(s);
    const a = at("الوحي", 0) - 6;
    const b = at("العلم", 1) - 2;
    // الماء في النافورة حيّ، فلا يُقارن العالم كله: لا مفتاح كاميرا في النافذة، والحدث التالي عند «العلم» نفسها
    expect(b).toBeGreaterThan(a);
    expect(render(s, 0).cam.filter((k) => k.t > a && k.t < b)).toEqual([]);
  });
});

describe("تصحيحات الفصل 5 (التوجيه 025)", () => {
  it("c5-s8: الرفض بفعل في الكرسي (رقعة تحت الساق)، بلا تلويح", () => {
    const s = ch5.find((x) => x.id === "c5-s8")!;
    const { dur } = ctx(s);
    const end = markup(render(s, dur - 1).world);
    expect(end).toMatch(/L\d+(\.\d+)? \d+(\.\d+)? Z/);
  });

  it("c5-s20: الميزان مائل قبل «بميزان» ومستوٍ بعده (نتيجة البرتقالة الناقصة)", () => {
    const s = ch5.find((x) => x.id === "c5-s20")!;
    const { at } = ctx(s);
    const tM = at("بميزان", 0);
    expect(markup(render(s, tM - 2).world)).not.toBe(markup(render(s, tM + 60).world));
  });
});
