import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { HZ_SCENES } from "../src/remotion/dafatir/horizon/episode001";
import { HZ_LEAD, HZ_META, hzSentences } from "../src/remotion/dafatir/horizon/meta";
import { buildTimeline } from "../src/remotion/dafatir/horizon/timeline";
import { SceneCloseContext } from "../src/remotion/dafatir/horizon/book";
import { sceneSeconds } from "../src/plan/duration";
import { SACRED_WORD } from "../src/render/stillness";
import type { Plan } from "../src/plan/types";

const EP = "channels/dafatir-alzaman/episodes/001-adam-beginning";
const plan = JSON.parse(readFileSync(`${EP}/plan.json`, "utf8")) as Plan;
const scenes = plan.chapters.flatMap((c) => c.scenes).filter((s) => s.template === "horizon-shot");

/**
 * توقير ذكر الله: لا يبدأ عنصر ولا تتحرك الكاميرا من قبل لفظ الجلالة بربع ثانية إلى ما بعده بربع ثانية.
 * يُرسم المشهد في كل إطار من النافذة ويجب أن يطابق الإطار الأول تمامًا.
 */
describe("دفاتر الزمن 001 — السكون عند ذكر الله", () => {
  // withClose: كما في الرندر الفعلي، يضع غلاف المشهد نهاية آخر كلمة فيبدأ الخروج (قلب أو خفوت) بعد إغلاق الفكرة
  it.each([false, true])("لا تغيير في الكادر حول كل لفظ جلالة في مشاهد «خط الأفق» (لحظة الإغلاق: %s)", (withClose) => {
    const bad: string[] = [];
    for (const s of scenes) {
      const shot = String(s.props.shot);
      const tl = buildTimeline(hzSentences(s.narration), HZ_LEAD);
      const dur = sceneSeconds(s);
      const Comp = HZ_SCENES[shot]!;
      const close = withClose && tl.words.length && !HZ_META[shot]!.minEnd ? tl.words[tl.words.length - 1]!.e : undefined;
      const draw = (t: number) =>
        renderToStaticMarkup(
          <SceneCloseContext.Provider value={close}>
            <Comp t={t} tl={tl} dur={dur} exit={HZ_META[shot]!.exit} p={s.props as Record<string, string>} />
          </SceneCloseContext.Provider>,
        );
      for (const w of tl.words) {
        if (!SACRED_WORD.test(w.w)) continue;
        const a = Math.max(0, w.s - 0.25);
        const b = Math.min(dur, w.e + 0.25);
        const ref = draw(a);
        for (let t = a + 1 / 30; t <= b; t += 1 / 30) {
          if (draw(t) !== ref) {
            bad.push(`${s.id} (${shot}) «${w.w}» @${t.toFixed(2)}`);
            break;
          }
        }
      }
    }
    expect(bad).toEqual([]);
  }, 300_000);
});
