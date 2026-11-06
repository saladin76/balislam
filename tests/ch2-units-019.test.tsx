import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SHOTS } from "../src/remotion/illus/shots";
import { CH2_SHOTS } from "../src/remotion/illus/shots/ch2";
import { makeAt } from "../src/remotion/illus/shots/kit";
import { spokenTimings } from "../src/remotion/scenes/Episode";
import { sceneFrames } from "../src/plan/duration";
import { normalizeArabic } from "../src/script/quranMeta";
import type { PlanScene } from "../src/plan/types";

/**
 * التوجيه 019 · الفصل 2 بأربع وحدات مترابطة: كل مشهد alley-tale في الفصل له لقطة مصمَّمة،
 * وكل كلمة يُبنى عليها حدث موجودة في نصه (لا حدث على توقيت تقديري)، واللقطة تُرسم بالاتجاهين،
 * وتمهيد الآية c2-s10 ساكن تمامًا (القاعدة الثانية: السكون المقصود).
 */
const plan = JSON.parse(fs.readFileSync(path.join(__dirname, "../channels/balislam/episodes/001-know-the-truth/plan.json"), "utf8"));
const ch2 = plan.chapters.find((c: { number: number }) => c.number === 2).scenes as (PlanScene & { props: { shot?: string } })[];
const words = (s: string) => s.split(/\s+/).map((w) => normalizeArabic(w.replace(/[«»"“”'؟?!.,،:؛…ـ()]/g, "")));

describe("الفصل 2: الوحدات الأربع", () => {
  it("كل مشهد سرد في الفصل له لقطة مصمَّمة من وحدات الفصل، والآية تبقى بطاقتها", () => {
    for (const s of ch2) {
      if (s.template === "verse-card") continue;
      expect(s.props.shot, s.id).toBeTruthy();
      expect(CH2_SHOTS[s.props.shot!], s.id).toBeTruthy();
      expect(SHOTS[s.props.shot!], s.id).toBeTruthy();
    }
  });

  for (const s of ch2.filter((x) => x.props.shot)) {
    it(`${s.id} (${s.props.shot}): كلمات الأحداث في نصه، والرسم بالاتجاهين`, () => {
      const dur = sceneFrames(s);
      const real = makeAt(spokenTimings(s.narration, dur), dur);
      const asked: string[] = [];
      const at = (w: string, f: number) => {
        asked.push(w);
        return real(w, f);
      };
      const toks = words(s.narration);
      for (const portrait of [false, true]) {
        for (const f of [0, Math.round(dur / 3), Math.round((2 * dur) / 3), dur - 1]) {
          const shot = SHOTS[s.props.shot!]!.render({ frame: f, fps: 30, dur, portrait, at });
          expect(shot.cam.length).toBeGreaterThan(0);
          expect(renderToStaticMarkup(<svg>{shot.world}</svg>).length).toBeGreaterThan(500);
        }
      }
      for (const w of new Set(asked)) {
        const k = normalizeArabic(w);
        expect(toks.some((t) => t === k || [..."وفبل"].some((p) => t === p + k)), `${s.id}: «${w}»`).toBe(true);
      }
    });
  }

  it("c2-s10 تمهيد الآية: كاميرا واحدة ولا تغير بين الإطارات", () => {
    const s = ch2.find((x) => x.id === "c2-s10")!;
    const dur = sceneFrames(s);
    const at = makeAt(spokenTimings(s.narration, dur), dur);
    for (const portrait of [false, true]) {
      const a = SHOTS["stall-still"]!.render({ frame: 0, fps: 30, dur, portrait, at });
      const b = SHOTS["stall-still"]!.render({ frame: dur - 1, fps: 30, dur, portrait, at });
      expect(a.cam).toHaveLength(1);
      expect(renderToStaticMarkup(<svg>{b.world}</svg>)).toBe(renderToStaticMarkup(<svg>{a.world}</svg>));
    }
  });
});
