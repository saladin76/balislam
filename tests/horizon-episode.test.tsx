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
  it("كل جمل السكريبت المعتمد في الخطة بترتيبها وحرفها، وكل مواضع الآيات", () => {
    const body = script.split("## الاستشهادات")[0]!.split("\n").slice(9);
    const sentences = body.map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && !l.startsWith("[آية"));
    expect(scenes.map((s) => s.narration).filter(Boolean).join(" ")).toBe(sentences.join(" "));
    const keys = [...script.matchAll(/^\[آية: (\S+) (\d+)\]/gm)].length;
    expect(scenes.filter((s) => s.template === "verse-card").length).toBe(keys);
    for (const s of scenes.filter((s) => s.template === "verse-card")) {
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
  });
});
