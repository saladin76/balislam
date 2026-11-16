import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { HZ_SCENES } from "../src/remotion/dafatir/horizon/episode001";
import { HZ_LEAD, HZ_META, hzSentences } from "../src/remotion/dafatir/horizon/meta";
import { buildTimeline } from "../src/remotion/dafatir/horizon/timeline";
import { sceneSeconds } from "../src/plan/duration";
import type { Plan } from "../src/plan/types";

// طلب المالك (١٥ نوفمبر، «نفّذه الآن رغم التجميد»، D143): «تزود رسومات في الصفحات الفارغة التي تأخذ وقت ولا تخلي جملة
// بدون رسوم وحركة». عقد: في المشاهد التي أُضيفت لها رسوم، لا تبقى الصفحة بلا تغيير مرئي (غير حركة الكاميرا) ثانيتين داخل
// جملة، إلا سكون لفظ الجلالة (±0.25 ث) والآية (القاعدة الثانية).
const EP = "channels/dafatir-alzaman/episodes/001-adam-beginning";
const plan = JSON.parse(readFileSync(`${EP}/plan.json`, "utf8")) as Plan;
const SAC = /الله|لله|ربنا|ربه|ربك|سبحانه|تعالى|تعالي/;
const noCam = (h: string) => h.replace(/transform:translate\([^)]*px\) scale\([^)]*\)/g, "");
const ENRICHED = ["c1-s12", "c1-s17", "c1-s18", "c1-s19", "c1-s26", "c1-s27", "c1-s29", "c1-s31", "c1-s32", "c1-s36", "c1-s43", "c1-s48"];

const longestStill = (id: string) => {
  const s = plan.chapters.flatMap((c) => c.scenes).find((x) => x.id === id)!;
  const shot = String(s.props.shot);
  const sents = hzSentences(s.narration);
  const tl = buildTimeline(sents, HZ_LEAD);
  const dur = sceneSeconds(s);
  const Comp = HZ_SCENES[shot]!;
  const dt = 0.1;
  const fr: string[] = [];
  for (let t = 0; t <= dur; t += dt) fr.push(noCam(renderToStaticMarkup(<Comp t={t} tl={tl} dur={dur} exit={HZ_META[shot]!.exit} p={s.props as Record<string, string>} />)));
  const sac = tl.words.filter((w) => SAC.test(w.w)).map((w) => [w.s - 0.25, w.e + 0.25] as const);
  let worst = 0;
  let wi = 0;
  for (const st of sents) {
    const n = st.split(/\s+/).filter(Boolean).length;
    const ws = tl.words.slice(wi, wi + n);
    wi += n;
    let run = 0;
    for (let i = Math.floor(ws[0]!.s / dt); i < Math.min(fr.length - 1, Math.ceil(ws.at(-1)!.e / dt)); i++) {
      if (fr[i] !== fr[i + 1] || sac.some(([a, b]) => i * dt >= a && i * dt <= b)) run = 0;
      else worst = Math.max(worst, (run += dt));
    }
  }
  return worst;
};

describe("دفاتر الزمن 001 — لا جملة بلا رسم وحركة (D143)", () => {
  for (const id of ENRICHED)
    it(`${id}: أطول سكون داخل جملة أقل من ثانيتين (قبل التسريع ١٠٪)`, () => {
      expect(longestStill(id)).toBeLessThan(2.05);
    });
});
