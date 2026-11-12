import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { sceneSeconds } from "../src/plan/duration";
import { verseReadSeconds } from "../src/remotion/dafatir/horizon/meta";
import type { PlanScene } from "../src/plan/types";

// الأمر 032: مدة مشهد الاستشهاد البصري بالصوت الحقيقي = زمن قراءة الآية على كلمات الصوت نفسها + 0.9 ث
const plan = JSON.parse(readFileSync("channels/dafatir-alzaman/episodes/001-adam-beginning/plan.json", "utf8")) as { chapters: { scenes: PlanScene[] }[] };
const scene = plan.chapters.flatMap((c) => c.scenes).find((s) => s.id === "c1-s8")!;
const voiced = (rate: number) => {
  const toks = scene.narration.trim().split(/\s+/);
  const words = toks.map((w, i) => ({ word: w, start: 0.3 + i * rate, end: 0.3 + i * rate + rate * 0.8 }));
  const end = words.at(-1)!.end;
  return { voice: { [scene.id]: { file: "x.mp3", hash: "h", text: scene.narration.trim(), duration: end + 0.4, words, timing: { pre: 0.3, tail: 1.3, seconds: end + 1.3, speechStart: 0.3, speechEnd: end, toneMap: "t", parts: [] } } }, recitations: {}, end, words };
};

describe("مشهد البقرة 30 (c1-s8) بالصوت الحقيقي", () => {
  it("يمتد حتى نهاية زمن قراءة الآية من لحظة «يحدثنا» الفعلية، أيًّا كانت سرعة الراوي", () => {
    for (const rate of [0.32, 0.4, 0.5]) {
      const m = voiced(rate);
      const from = m.words.find((w) => w.word.startsWith("يحدثنا"))!.start;
      const read = verseReadSeconds(String(scene.props.verseText));
      expect(sceneSeconds(scene, m as never), `rate ${rate}`).toBeCloseTo(Math.max(m.end + 1.3, from + read + 0.9), 5);
    }
  });
  it("ولا يقصر عن نهاية الكلام وذيله إن كان الكلام أطول من زمن القراءة", () => {
    const m = voiced(1.2);
    expect(sceneSeconds(scene, m as never)).toBeCloseTo(m.end + 1.3, 5);
  });
});
