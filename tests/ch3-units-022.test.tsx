import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SHOTS } from "../src/remotion/illus/shots";
import { CH3_SHOTS } from "../src/remotion/illus/shots/ch3";
import { makeAt } from "../src/remotion/illus/shots/kit";
import { spokenTimings } from "../src/remotion/scenes/Episode";
import { sceneFrames } from "../src/plan/duration";
import { normalizeArabic } from "../src/script/quranMeta";
import type { PlanScene } from "../src/plan/types";

/**
 * التوجيه 022 · الفصل 3 بوحدات مترابطة (التخطيط في storyboard/ch3-plan.md): كل مشهد alley-tale في الفصل له لقطة مصمَّمة،
 * وكل كلمة يُبنى عليها حدث موجودة في نصه (لا حدث على توقيت تقديري)، واللقطة تُرسم بالاتجاهين،
 * وتمهيد الآية c3-s13 وتفسيرها c3-s15 والجسر c3-s22 ساكنة تمامًا (القاعدة الثانية: السكون المقصود).
 */
const plan = JSON.parse(fs.readFileSync(path.join(__dirname, "../channels/balislam/episodes/001-know-the-truth/plan.json"), "utf8"));
const ch3 = plan.chapters.find((c: { number: number }) => c.number === 3).scenes as (PlanScene & { props: { shot?: string } })[];
const words = (s: string) => s.split(/\s+/).map((w) => normalizeArabic(w.replace(/[«»"“”'؟?!.,،:؛…ـ()]/g, "")));

describe("الفصل 3: الوحدات الخمس (التوجيه 022)", () => {
  it("كل مشهد سرد في الفصل له لقطة مصمَّمة من وحدات الفصل، والآية تبقى بطاقتها", () => {
    for (const s of ch3) {
      if (s.template === "verse-card") continue;
      expect(s.props.shot, s.id).toBeTruthy();
      expect(CH3_SHOTS[s.props.shot!], s.id).toBeTruthy();
      expect(SHOTS[s.props.shot!], s.id).toBeTruthy();
    }
  });

  for (const s of ch3.filter((x) => x.props.shot)) {
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

  for (const [id, shot] of [["c3-s13", "night-window-still"], ["c3-s15", "night-window-still"], ["c3-s22", "lane-dawn-still"]] as const) {
    it(`${id}: سكون مقصود (ذكر الله أو الآية أو الدعاء): كاميرا واحدة ولا تغير بين الإطارات`, () => {
      const s = ch3.find((x) => x.id === id)!;
      expect(s.props.shot).toBe(shot);
      const dur = sceneFrames(s);
      const at = makeAt(spokenTimings(s.narration, dur), dur);
      for (const portrait of [false, true]) {
        const a = SHOTS[shot]!.render({ frame: 0, fps: 30, dur, portrait, at });
        const b = SHOTS[shot]!.render({ frame: dur - 1, fps: 30, dur, portrait, at });
        expect(a.cam).toHaveLength(1);
        expect(renderToStaticMarkup(<svg>{b.world}</svg>)).toBe(renderToStaticMarkup(<svg>{a.world}</svg>));
      }
    });
  }
});
