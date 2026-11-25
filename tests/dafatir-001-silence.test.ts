/**
 * تصحيح D217 (مراجعة «دفاتر الزمن 001» قبل النهائية v17، ٢٤ نوفمبر): بند «لا سكوت أطول من ثانية» (silenceReport) فشل في أربعة
 * مواضع: 0:50.3–0:52.1 (c1-s7 ← c1-s8)، 1:04.4–1:05.6 (c1-s8 ← c1-s9، البقرة ٣٠)، 6:49.9–6:51.4 (c1-s37 ← c1-s38، البقرة ٣٨)،
 * و8:58.8–9:01.9 (ذيل الختام c1-s47). قرار المالك: لا سكوت فوق نحو ثانية (الهدف نصف ثانية)، والبطاقة تُعرض والراوي يكمل.
 *
 * الحساب من الخطة وتوقيت كلمات الراوي كما يقرؤه الرندر (tests/fixtures/dafatir-001-voice-timing.json)، بالدوال نفسها التي
 * يبني بها التجميع الحلقة (seamPlan/sceneFrames): داخل كل مشهد (بين كلمتين)، وعند كل وصلة (ذيل السابق بعد آخر كلمة + رأس التالي
 * قبل أول كلمة، بعد ما يمر منه تحت التالي)، وذيل آخر الحلقة. الحد ٠٫٨ ث (والذيل الأخير ١ ث): هامش لأن آخر كلمة في المحاذاة
 * تنتهي بعد آخر صوت مسموع بنحو ٠٫١–٠٫٦ ث.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { seamPlan } from "../src/plan/seams";
import { sceneFrames, sceneHoldFloor } from "../src/plan/duration";
import { VERSE_AFTER_SPEECH, hzSentences, verseWindow } from "../src/remotion/dafatir/horizon/meta";
import { timelineFromWords } from "../src/remotion/dafatir/horizon/timeline";
import type { EpisodeMedia } from "../src/plan/media";
import type { Plan, PlanScene } from "../src/plan/types";

const EP = "channels/dafatir-alzaman/episodes/001-adam-beginning";
const plan = JSON.parse(readFileSync(`${EP}/plan.json`, "utf8")) as Plan;
const voice = (JSON.parse(readFileSync("tests/fixtures/dafatir-001-voice-timing.json", "utf8")) as { voice: EpisodeMedia["voice"] }).voice;
// نص مشهد تغيّر قبل توليد صوته (مثل c1-s40، البند ١٠٣): يُستعمل توقيته التقديري «<id>@pending» حين يطابق نص الخطة
for (const [k, c] of Object.entries(voice)) {
  const id = k.endsWith("@pending") ? k.slice(0, -8) : "";
  const sc = id ? plan.chapters.flatMap((x) => x.scenes).find((x) => x.id === id) : undefined;
  if (sc && c?.text === sc.narration.trim()) voice[id] = c;
}
const media: EpisodeMedia = { mode: "url", base: "", voice, sfx: [], recitations: {} };
const scenes: PlanScene[] = plan.chapters.flatMap((c) => c.scenes);
const FPS = 30;
const MAX_GAP = 0.8;
const MAX_END_TAIL = 1;

const voiced = (s: PlanScene) => {
  const c = voice[s.id];
  return c && c.text === s.narration.trim() && c.words?.length ? c : undefined;
};
const lastEnd = (s: PlanScene) => Math.max(...voiced(s)!.words.map((w) => w.end));
const seams = seamPlan(scenes, media, { fps: FPS, channelId: plan.channel });

describe("دفاتر الزمن 001 — لا سكوت فوق ٠٫٨ ث في الكلام ولا عند الوصلات (تصحيح D217، v17)", () => {
  it("كل مشاهد الخطة منطوقة بصوت يطابق نصها (المثبَّت يطابق الخطة)", () => {
    expect(scenes.length).toBeGreaterThanOrEqual(40);
    expect(scenes.filter((s) => !voiced(s)).map((s) => s.id)).toEqual([]);
  });

  it("داخل كل مشهد: لا فجوة بين كلمتين أطول من ٠٫٨ ث", () => {
    const bad: string[] = [];
    for (const s of scenes) {
      const w = voiced(s)!.words;
      for (let i = 1; i < w.length; i++) if (w[i]!.start - w[i - 1]!.end > MAX_GAP) bad.push(`${s.id} قبل «${w[i]!.word}»: ${(w[i]!.start - w[i - 1]!.end).toFixed(2)} ث`);
    }
    expect(bad).toEqual([]);
  });

  it("كل وصلة: ذيل السابق بعد آخر كلمة + رأس التالي قبل أول كلمة ≤ ٠٫٨ ث، ولا وصلة تُبقي سكوتًا «مقصودًا»", () => {
    const bad = seams.filter((x) => x.gap === null || x.gap > MAX_GAP || x.kept).map((x) => `${x.from}←${x.to}: ${x.gap} ث${x.kept ? ` (${x.kept})` : ""}`);
    expect(bad).toEqual([]);
  });

  it("المواضع الأربعة في v17 تحت الحد (كانت 1.51 و1.10 و0.89 و3.09 ث بالكلمات؛ 1.8 و1.2 و1.5 و3.1 ث مقيسة)", () => {
    // عقد على المحتوى: الوصلة بعد مشهد بعينه إن بقي في الخطة (يحرّر المالك الخطة؛ الحد العام أعلاه يبقى)
    const gap = (from: string) => seams.find((x) => x.from === from)?.gap ?? 0;
    expect(gap("c1-s7")).toBeLessThanOrEqual(0.45);
    expect(gap("c1-s8")).toBeLessThanOrEqual(0.5);
    expect(gap("c1-s37")).toBeLessThanOrEqual(0.3);
    const end = scenes.at(-1)!;
    expect(sceneFrames(end, media, FPS) / FPS - lastEnd(end)).toBeLessThanOrEqual(0.75);
  });

  it("ذيل آخر الحلقة بعد آخر كلمة ≤ ١ ث", () => {
    const end = scenes.at(-1)!;
    expect(sceneFrames(end, media, FPS) / FPS - lastEnd(end)).toBeLessThanOrEqual(MAX_END_TAIL);
  });

  it("بطاقة الآية: لا تبقى بعد آخر كلمة أكثر من VERSE_AFTER_SPEECH، ولا يبدأ المشهد التالي قبل اختفائها (لا آية مقطوعة، D217)", () => {
    const verses = scenes.filter((s) => s.template === "horizon-shot" && s.props.verseText && s.props.verseKey);
    expect(verses.length).toBeGreaterThanOrEqual(5);
    for (const s of verses) {
      const c = voiced(s)!;
      const vw = verseWindow(s.props as Record<string, string>, timelineFromWords(hzSentences(s.narration), c.words, 0))!;
      expect(vw[1] - lastEnd(s), s.id).toBeLessThanOrEqual(VERSE_AFTER_SPEECH + 1e-9);
      const i = scenes.indexOf(s);
      const seam = seams[i];
      if (!seam) continue;
      const nextStart = (sceneFrames(s, media, FPS) - seam.overlapFrames) / FPS;
      expect(nextStart, s.id).toBeGreaterThanOrEqual(vw[1] - 1e-9);
      expect(sceneHoldFloor(s, media), s.id).toBeGreaterThanOrEqual(vw[1] - 1e-9);
    }
  });
});
