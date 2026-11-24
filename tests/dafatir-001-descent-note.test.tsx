import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { HZ_SCENES } from "../src/remotion/dafatir/horizon/episode001";
import { HZ_LEAD, HZ_META, hzSentences, verseWindow } from "../src/remotion/dafatir/horizon/meta";
import { buildTimeline } from "../src/remotion/dafatir/horizon/timeline";
import { sceneSeconds } from "../src/plan/duration";
import type { Plan } from "../src/plan/types";

// ملاحظة المالك n5e4cc7da30 (١٥ نوفمبر، c1-s37): «حركة الهبوط غير مناسبة ابدا وكذلك المشهد فيه فراغ في النهاية».
const EP = "channels/dafatir-alzaman/episodes/001-adam-beginning";
const plan = JSON.parse(readFileSync(`${EP}/plan.json`, "utf8")) as Plan;
const s = plan.chapters.flatMap((c) => c.scenes).find((x) => x.id === "c1-s37")!;
const props = s.props as Record<string, string>;
const shot = String(props.shot);
const tl = buildTimeline(hzSentences(s.narration), HZ_LEAD);
const dur = sceneSeconds(s);
const Comp = HZ_SCENES[shot]!;
const draw = (t: number) => renderToStaticMarkup(<Comp t={t} tl={tl} dur={dur} exit={HZ_META[shot]!.exit} p={props} />);

describe("دفاتر الزمن 001 — c1-s37 «الهبوط إلى الأرض» بعد ملاحظة المالك", () => {
  it("لا نقاط حبر تنزل على قوس (لا تمثيل لآدم وزوجه)، ولا قوس منقّط", () => {
    for (let t = 0; t < dur; t += 0.25) {
      const html = draw(t);
      // النقطتان القديمتان (r=11 وr=9 بحبر داكن) والقوس المنقّط "6 12"؛ سن القلم في WriteIn ليس منهما
      expect(/<circle[^>]*r="(11|9)"/.test(html), `@${t.toFixed(2)}`).toBe(false);
      expect(html.includes('stroke-dasharray="6 12"'), `@${t.toFixed(2)}`).toBe(false);
    }
  });

  it("فراغ النهاية أقصر: البطاقة تبدأ عند «آدم» لا «وأن»، فتنتهي قراءتها بعد آخر كلمة بأقل من 3.5 ثانية (كانت 5.8)", () => {
    // زمن القراءة نفسه (verseReadSeconds) لا يتغير؛ البطاقة لا تبدأ قبل «آدم» حتى لا تظهر مع لفظ الجلالة في «أخبرنا الله»
    const vw = verseWindow(props, tl)!;
    const last = tl.words.at(-1)!.e;
    // D219: لا سكوت للقراءة — تنتهي البطاقة بعد آخر كلمة بـ ٠٫٨ ث على الأكثر
    expect(vw[1] - last).toBeLessThanOrEqual(0.8 + 1e-9);
    expect(vw[0]).toBeGreaterThan(tl.words.find((w) => w.w === "الله")!.e);
  });

  it("لكل جملة حدث يُرى: يتغير المشهد بعد «بالأمن» قبل آخر كلمة", () => {
    const w = tl.words.find((x) => x.w.startsWith("بالأمن"))!;
    expect(draw(w.s + 0.8)).not.toBe(draw(w.s - 0.1));
  });
});
