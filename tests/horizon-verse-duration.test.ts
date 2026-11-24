import { HZ_META } from "../src/remotion/dafatir/horizon/meta";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { sceneSeconds } from "../src/plan/duration";
import type { PlanScene } from "../src/plan/types";

// D219 (يحل محل الأمر 032): البطاقة قدر قراءتها داخل كلام الراوي، فلا يطول المشهد بسكوت للقراءة
const plan = JSON.parse(readFileSync("channels/dafatir-alzaman/episodes/001-adam-beginning/plan.json", "utf8")) as { chapters: { scenes: PlanScene[] }[] };
// المدة المحفوظة في الخطة (durationSec) أرضية قديمة من حساب القراءة الصامتة؛ تُزال في الخطة مع D219، فيُختبر الحساب وحده
const scene = { ...plan.chapters.flatMap((c) => c.scenes).find((s) => s.id === "c1-s8")!, durationSec: undefined } as PlanScene;
const voiced = (rate: number) => {
  const toks = scene.narration.trim().split(/\s+/);
  const words = toks.map((w, i) => ({ word: w, start: 0.3 + i * rate, end: 0.3 + i * rate + rate * 0.8 }));
  const end = words.at(-1)!.end;
  return { voice: { [scene.id]: { file: "x.mp3", hash: "h", text: scene.narration.trim(), duration: end + 0.4, words, timing: { pre: 0.3, tail: 1.3, seconds: end + 1.3, speechStart: 0.3, speechEnd: end, toneMap: "t", parts: [] } } }, recitations: {}, end, words };
};

// تصحيح D217 (v17): ذيل التوقيت المسجَّل (١٫٣ هنا) لا يزيد على ذيل تصميم اللقطة (verse-tag: ١٫٠)
const TAIL = Math.min(1.3, HZ_META["verse-tag"]!.tail);
describe("مشهد البقرة 30 (c1-s8) بالصوت الحقيقي", () => {
  it("لا يمتد بسكوت للقراءة: مدته مدة الكلام وذيله، أو آخر البطاقة بعد آخر كلمة بقليل حين يقصر الكلام عن زمن القراءة", () => {
    for (const rate of [0.32, 0.4, 0.5]) {
      const m = voiced(rate);
      // البطاقة لا تمد المشهد أكثر من VERSE_AFTER_SPEECH بعد آخر كلمة (وذيله يغطيها)
      expect(sceneSeconds(scene, m as never), `rate ${rate}`).toBeLessThanOrEqual(m.end + TAIL + 1e-6);
      expect(sceneSeconds(scene, m as never)).toBeGreaterThanOrEqual(m.end + TAIL - 1e-6);
    }
  });
  it("ولا يقصر عن نهاية الكلام وذيله إن كان الكلام أطول من زمن القراءة", () => {
    const m = voiced(1.2);
    expect(sceneSeconds(scene, m as never)).toBeCloseTo(m.end + TAIL, 5);
  });
});
