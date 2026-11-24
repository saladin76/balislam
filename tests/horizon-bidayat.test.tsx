import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";
import { HZ_SCENES } from "../src/remotion/dafatir/horizon/episode001";
import { EP001_META, HZ_LEAD, HZ_META, hzEstimateSeconds, hzSentences } from "../src/remotion/dafatir/horizon/meta";
import { buildTimeline } from "../src/remotion/dafatir/horizon/timeline";
import { SceneCloseContext } from "../src/remotion/dafatir/horizon/book";
import { LIB_META } from "../src/remotion/dafatir/lib/meta";
import { BD_META } from "../src/remotion/dafatir/bidayat/meta";
import { BD_SCENES } from "../src/remotion/dafatir/bidayat";
import { parseBidayatPlan, type BdPlanRow } from "../src/remotion/dafatir/bidayat/plans";
import { SACRED_WORD } from "../src/render/stillness";
import { normalizeArabic } from "../src/script/quranMeta";

/**
 * لقطات «البدايات» الجديدة (دفاتر الزمن 002–009، bdNN-…) بجملها الحقيقية من خطط المشاهد (scenes.md):
 * التسجيل، وكل كلمة صُمم عليها موجودة في جملتها، والتوقير (لا يبدأ عنصر ولا يتحرك شيء ولا الكاميرا من قبل كلمة الذكر بربع ثانية
 * إلى ما بعدها بربع ثانية، كما في tests/horizon-sacred.test.tsx لـ001)، وحدث في كل جملة.
 */
const DIR = "channels/dafatir-alzaman/episodes";
const EPS = ["002", "003", "004", "005", "006", "007", "008", "009"];
const plans: Record<string, BdPlanRow[]> = Object.fromEntries(
  EPS.map((e) => {
    const dir = readdirSync(DIR).find((d) => d.startsWith(`${e}-`))!;
    return [e, parseBidayatPlan(readFileSync(`${DIR}/${dir}/scenes.md`, "utf8"))];
  }),
);

const setup = (r: BdPlanRow) => {
  const tl = buildTimeline(hzSentences(r.narration), HZ_LEAD);
  const dur = hzEstimateSeconds(r.narration, r.shot);
  const Comp = HZ_SCENES[r.shot]!;
  const meta = HZ_META[r.shot]!;
  const draw = (t: number, close?: number) =>
    renderToStaticMarkup(
      <SceneCloseContext.Provider value={close}>
        <Comp t={t} tl={tl} dur={dur} exit={meta.exit} p={{ shot: r.shot }} />
      </SceneCloseContext.Provider>,
    );
  return { tl, dur, draw };
};

describe("لقطات «البدايات» — التسجيل", () => {
  it("كل لقطة جديدة في الخطط مسجلة برسمها وبياناتها، ولا لقطة مسجلة بلا موضع في خطة", () => {
    const used = new Set(Object.values(plans).flat().map((r) => r.shot));
    expect(used.size).toBeGreaterThan(150);
    const missing = [...used].filter((s) => !HZ_SCENES[s] || !HZ_META[s]);
    expect(missing).toEqual([]);
    for (const k of Object.keys(BD_META)) {
      expect(BD_SCENES[k], k).toBeTruthy();
      expect(used.has(k), `${k} ليس في أي خطة`).toBe(true);
      expect(LIB_META[k] ?? EP001_META[k], `${k} مكرر`).toBeUndefined();
    }
    for (const k of Object.keys(BD_SCENES)) expect(BD_META[k], k).toBeTruthy();
  });
});

describe.each(EPS)("البدايات %s — اللقطات الجديدة بجملها", (ep) => {
  const rows = plans[ep]!;

  it("كل لقطة تُرسم على جملتها وكل كلمة صُممت عليها موجودة", () => {
    expect(rows.length).toBeGreaterThan(5);
    const bad: string[] = [];
    for (const r of rows) {
      const { tl, dur, draw } = setup(r);
      for (const t of [0, tl.end / 3, (2 * tl.end) / 3, tl.end, dur - 0.1]) {
        try {
          draw(t);
        } catch (e) {
          bad.push(`${r.id} (${r.shot}) @${t.toFixed(1)}: ${(e as Error).message}`);
          break;
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it.each([false, true])("التوقير: لا تغيير في الرسم ولا الكاميرا حول كل كلمة ذكر ±٠٫٢٥ ث (لحظة الإغلاق: %s)", (withClose) => {
    const bad: string[] = [];
    for (const r of rows) {
      const { tl, dur, draw } = setup(r);
      const close = withClose && tl.words.length ? tl.words[tl.words.length - 1]!.e : undefined;
      for (const w of tl.words) {
        if (!SACRED_WORD.test(normalizeArabic(w.w))) continue;
        const a = Math.max(0, w.s - 0.25);
        const b = Math.min(dur, w.e + 0.25);
        const ref = draw(a, close);
        for (let t = a + 1 / 30; t <= b; t += 1 / 30) {
          if (draw(t, close) !== ref) {
            bad.push(`${r.id} (${r.shot}) «${w.w}» @${t.toFixed(2)}`);
            break;
          }
        }
      }
    }
    expect(bad).toEqual([]);
  }, 300_000);

  it("في كل جملة حدث رسم (لا جملة على صفحة واقفة)", () => {
    const bad: string[] = [];
    for (const r of rows) {
      const { tl, draw } = setup(r);
      for (const s of tl.sentences) if (draw(s.s) === draw(s.e + 0.3)) bad.push(`${r.id} (${r.shot}): «${s.text.slice(0, 40)}»`);
    }
    expect(bad).toEqual([]);
  });
});
