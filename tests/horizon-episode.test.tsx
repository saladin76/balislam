import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { HZ_SCENES } from "../src/remotion/dafatir/horizon/episode001";
import { HZ_LEAD, HZ_META, hzEstimateSeconds, hzSentences } from "../src/remotion/dafatir/horizon/meta";
import { buildTimeline } from "../src/remotion/dafatir/horizon/timeline";
import { sceneSeconds } from "../src/plan/duration";
import type { Plan, PlanScene } from "../src/plan/types";
import { surahNumber } from "../src/script/quranMeta";

const EP = "channels/dafatir-alzaman/episodes/001-adam-beginning";
const plan = JSON.parse(readFileSync(`${EP}/plan.json`, "utf8")) as Plan;
const script = readFileSync(`${EP}/script.md`, "utf8");
const scenes = plan.chapters.flatMap((c) => c.scenes);

describe("دفاتر الزمن 001 — خطة «خط الأفق»", () => {
  it("كل جمل السكريبت المعتمد في الخطة بترتيبها وحرفها، والآيات استشهاد فقط (V8/V9)", () => {
    // V9: ترويسة المالك تنتهي بسطر «---» الثاني، وسطور [استشهاد بصري صامت: …] علامات لا تُنطق
    const lines = script.split("## الاستشهادات")[0]!.split("\n");
    const fm = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
    const body = lines.slice(fm + 1);
    const sentences = body.map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && !l.startsWith("["));
    expect(scenes.map((s) => s.narration).filter(Boolean).join(" ")).toBe(sentences.join(" "));
    // V9 (المالك ١١ نوفمبر): استشهادات بصرية صامتة، كلٌّ نص آيته ومرجعه على الصفحة والراوي مستمر، بلا تلاوة.
    // عقد على المحتوى لا تثبيت له (KI-068، D137): السكريبت والخطة يحرّرهما المالك؛ يُفحص التطابق بينهما لا عددهما ولا آياتهما.
    const cites = [...script.matchAll(/^\[استشهاد بصري صامت: (\S+) (\d+) —/gm)].map((m) => `${surahNumber(m[1]!)}:${m[2]}`);
    const shown = scenes.filter((s) => s.props.verseKey && s.props.verseText);
    expect(shown.map((s) => s.props.verseKey)).toEqual(cites);
    for (const s of shown) expect(s.narration.includes(String(s.props.verseFrom)), s.id).toBe(true);
    // V8 (قرار صاحب المشروع، ١١ نوفمبر): لا علامة آية في مجرى السكريبت ولا بطاقة آية في الخطة؛ المراجع في «الاستشهادات»
    expect([...script.matchAll(/^\[آية: /gm)]).toHaveLength(0);
    expect(scenes.filter((s) => s.template === "verse-card")).toEqual([]);
    const listed = new Set([...script.split("## الاستشهادات")[1]!.matchAll(/^- آية \| (\S+) (\d+)/gm)].map((m) => `${surahNumber(m[1]!)}:${m[2]}`));
    for (const c of cites) expect(listed.has(c), `${c}: الاستشهاد الصامت مذكور في «الاستشهادات»`).toBe(true);
    // V7 محفوظة كما كانت: 23 موضع آية بقالب البطاقة بلا نص
    const v7 = JSON.parse(readFileSync(`${EP}/plan.v7.json`, "utf8")) as Plan;
    const v7Verses = v7.chapters.flatMap((c) => c.scenes).filter((s) => s.template === "verse-card");
    expect(v7Verses).toHaveLength(23);
    for (const s of v7Verses) {
      expect(s.props.text).toBe("");
      expect(s.props.look).toBe("horizon");
    }
  });

  it("كل مشهد مصمم يُرسم بلا خطأ في كل لحظة (كل كلمة يرتبط بها حدث موجودة في جملته)", () => {
    for (const s of scenes.filter((x) => x.template === "horizon-shot")) {
      const shot = String(s.props.shot);
      expect(HZ_SCENES[shot], s.id).toBeTruthy();
      const tl = buildTimeline(hzSentences(s.narration), HZ_LEAD);
      const dur = sceneSeconds(s);
      // مدة يحددها المالك في الاستوديو محتواه (KI-068): تُحترم كما هي، ولا يُثبَّت الاختبار على التقدير الآلي
      if (s.durationSec && s.durationSec > 0) expect(dur, `${s.id}: مدة المالك`).toBe(s.durationSec);
      else {
        expect(dur, s.id).toBeCloseTo(hzEstimateSeconds(s.narration, shot, s.props as Record<string, string>), 5);
        expect(dur - tl.end, `${s.id}: ذيل يتسع لخروجه`).toBeGreaterThanOrEqual(s.narration ? HZ_META[shot]!.tail - 0.06 : 0);
      }
      const Comp = HZ_SCENES[shot]!;
      for (let t = 0; t <= dur; t += 0.25) {
        expect(() => renderToStaticMarkup(<Comp t={t} tl={tl} dur={dur} exit={HZ_META[shot]!.exit} p={s.props as Record<string, string>} />), `${s.id} @${t}`).not.toThrow();
      }
    }
  }, 120_000);

  it("المدة: التقدير الآلي بلا قيمة من المالك، وقيمة المالك تُحترم ولا تقطع صوت الراوي (KI-068)", () => {
    const cover = scenes.find((x) => x.template === "horizon-shot")!;
    const auto: PlanScene = { ...cover, durationSec: undefined };
    const est = hzEstimateSeconds(auto.narration, String(auto.props.shot), auto.props as Record<string, string>);
    expect(sceneSeconds(auto)).toBeCloseTo(Math.max(2.5, est), 5);
    for (const owner of [est + 0.4, est + 7, 2.5]) expect(sceneSeconds({ ...auto, durationSec: owner })).toBe(owner);
    const clip = { text: "كلام الراوي.", duration: 6 } as never;
    const voiced: PlanScene = { ...auto, narration: "كلام الراوي.", durationSec: 3 };
    expect(sceneSeconds(voiced, { voice: { [voiced.id]: clip }, recitations: {} } as never)).toBeCloseTo(6.2, 5);
  });
});
