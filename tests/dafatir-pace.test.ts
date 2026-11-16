import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { pacedVoice, PACE_EXIT_SECONDS } from "../src/plan/pace";
import { sceneSeconds } from "../src/plan/duration";
import type { Plan, PlanScene } from "../src/plan/types";
import type { VoiceClip } from "../src/voice/generate";

// طلب المالك (١٥ نوفمبر، «نفّذه الآن رغم التجميد»، B-004–B-006): الصوت أسرع ١٠٪ بلا توليد، ونحو نصف ثانية بين المشاهد،
// والحلقة تبدأ من أول الكلام (بلا غلاف ولا بسملة).
const scene = (id: string, narration: string, shot = "nations"): PlanScene =>
  ({ id, template: "horizon-shot", narration, props: { shot }, sfx: [] } as unknown as PlanScene);
const words = (text: string, from = 0.2, step = 0.4) =>
  text.split(/\s+/).map((w, i) => ({ word: w, start: from + i * step, end: from + i * step + 0.35 }));
const clip = (text: string, tail = 1.3): VoiceClip => {
  const ws = words(text);
  const speechEnd = ws.at(-1)!.end;
  return { file: "a.wav", hash: "h", text, duration: speechEnd + 0.2, words: ws,
    timing: { pre: 0, tail, seconds: speechEnd + tail, speechStart: 0.2, speechEnd, toneMap: "m", parts: [] } };
};
const plan = (scenes: PlanScene[], pace?: Plan["pace"]): Plan =>
  ({ chapters: [{ title: "x", scenes }], ...(pace ? { pace } : {}) } as unknown as Plan);

describe("إيقاع الحلقة (pace)", () => {
  const text = "عرفت الأرض أممًا كثيرة وتعاقبت عليها أجيال";
  it("بلا pace لا يتغير شيء", () => {
    const v = { a: clip(text) };
    expect(pacedVoice(v, plan([scene("a", text)]))).toEqual(v);
  });
  it("السرعة تقسم المدة وتوقيت كل كلمة، ويُحمل معدل التشغيل للرندر", () => {
    const v = pacedVoice({ a: clip(text) }, plan([scene("a", text)], { rate: 1.1, gap: 0.4 }));
    const a = v.a!;
    expect(a.rate).toBe(1.1); // owner-pin-ok: بيانات مصطنعة في الاختبار
    expect(a.words[3]!.start).toBeCloseTo(words(text)[3]!.start / 1.1, 6);
    expect(a.duration).toBeCloseTo(clip(text).duration / 1.1, 6);
  });
  it("الذيل بعد آخر كلمة يصير gap (لا 1.3 ث)", () => {
    const a = pacedVoice({ a: clip(text) }, plan([scene("a", text)], { rate: 1.1, gap: 0.4 })).a!;
    expect(a.timing!.seconds - a.timing!.speechEnd).toBeCloseTo(0.4, 6); // owner-pin-ok: بيانات مصطنعة في الاختبار
    expect(sceneSeconds(scene("a", text), { voice: { a }, recitations: {} })).toBeLessThan(sceneSeconds(scene("a", text), { voice: { a: clip(text) }, recitations: {} }));
  });
  it("مشهد ينتهي بلفظ الجلالة: الخروج لا يبدأ قبل نهاية سكونه", () => {
    const t2 = "لا يعلم عددها إلا الله";
    const a = pacedVoice({ a: clip(t2) }, plan([scene("a", t2, "basmala")], { rate: 1.1, gap: 0.4 })).a!;
    const lastEnd = a.words.at(-1)!.end;
    // البسملة خروجها قلب صفحة
    expect(a.timing!.seconds).toBeGreaterThanOrEqual(lastEnd + 0.25 + PACE_EXIT_SECONDS.turn - 1e-9);
  });
});

describe("دفاتر الزمن 001 بعد طلب المالك", () => {
  const p = JSON.parse(readFileSync("channels/dafatir-alzaman/episodes/001-adam-beginning/plan.json", "utf8")) as Plan;
  const ids = p.chapters.flatMap((c) => c.scenes).map((s) => s.id);
  it("تبدأ من أول الكلام: لا غلاف ولا بسملة", () => {
    expect(ids).not.toContain("c1-s0");
    expect(ids).not.toContain("c1-s1");
    expect(p.chapters[0]!.scenes[0]!.narration.trim().length).toBeGreaterThan(0);
  });
  it("الإيقاع مختوم في الخطة", () => {
    expect(p.pace?.rate).toBeGreaterThan(1);
    expect(p.pace?.gap).toBeLessThan(1);
  });
});
