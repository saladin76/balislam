import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { HZ_SCENES } from "../src/remotion/dafatir/horizon/episode001";
import { HZ_LEAD, HZ_META, hzEstimateSeconds, hzSentences } from "../src/remotion/dafatir/horizon/meta";
import { buildTimeline } from "../src/remotion/dafatir/horizon/timeline";
import { sceneSeconds } from "../src/plan/duration";
import type { Plan } from "../src/plan/types";

const EP = "channels/dafatir-alzaman/episodes/001-adam-beginning";
const plan = JSON.parse(readFileSync(`${EP}/plan.json`, "utf8")) as Plan;
const script = readFileSync(`${EP}/script.md`, "utf8");
const scenes = plan.chapters.flatMap((c) => c.scenes);

describe("دفاتر الزمن 001 — خطة «خط الأفق»", () => {
  it("كل جمل السكريبت المعتمد في الخطة بترتيبها وحرفها، والآيات استشهاد فقط (V8)", () => {
    const body = script.split("## الاستشهادات")[0]!.split("\n").slice(9);
    const sentences = body.map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && !l.startsWith("[آية"));
    expect(scenes.map((s) => s.narration).filter(Boolean).join(" ")).toBe(sentences.join(" "));
    // V8 (قرار صاحب المشروع، ١١ نوفمبر): لا علامة آية في مجرى السكريبت ولا بطاقة آية في الخطة؛ المراجع الـ23 في «الاستشهادات»
    expect([...script.matchAll(/^\[آية: /gm)]).toHaveLength(0);
    expect(scenes.filter((s) => s.template === "verse-card")).toEqual([]);
    expect([...script.split("## الاستشهادات")[1]!.matchAll(/^- آية \| /gm)]).toHaveLength(23);
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
      expect(dur, s.id).toBeCloseTo(hzEstimateSeconds(s.narration, shot), 5);
      expect(dur - tl.end, `${s.id}: ذيل يتسع لخروجه`).toBeGreaterThanOrEqual(s.narration ? HZ_META[shot]!.tail - 0.06 : 0);
      const Comp = HZ_SCENES[shot]!;
      for (let t = 0; t <= dur; t += 0.25) {
        expect(() => renderToStaticMarkup(<Comp t={t} tl={tl} dur={dur} exit={HZ_META[shot]!.exit} p={s.props as Record<string, string>} />), `${s.id} @${t}`).not.toThrow();
      }
    }
  }, 120_000);
});
