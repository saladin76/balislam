/**
 * D196 v6 (قرار المالك ٢٥ نوفمبر: «باب التوبة» من لقطة الباب نفسها في لحظة بلا ذكر): مشهد فيه ذكر لله يُقبل غلافه من لحظة
 * في عبارة لا ذكر فيها، خارج ±٠٫٢٥ ث حول كل ذكر؛ ومشاهد الآية والبسملة والدعاء والحديث مرفوضة دائمًا.
 * المدخلات مكتوبة هنا (نص c1-s35 من «دفاتر الزمن» 001 وتوقيت كلماته)، لا حلقة حية (KI-068).
 */
import { describe, expect, it } from "vitest";
import { coverStillWindows, thumbScenes, thumbnailIssues, type ThumbnailConcept } from "../src/package/thumbnails";
import { thumbCtx } from "../src/package/package";
import type { Plan } from "../src/plan/types";

const NARRATION = "وهنا يظهر الفرق بين موقفين. إبليس استكبر وأصر على مخالفته. أما آدم عليه السلام، فقد تاب وأناب. فوقوع الإنسان في الذنب ليس نهاية الطريق، ما دام يرجع إلى ربه تائبًا صادقًا.";
const T: [string, number, number][] = [
  ["وهنا", 0.06, 0.54], ["يظهر", 0.78, 1.18], ["الفرق", 1.26, 1.66], ["بين", 1.78, 1.9], ["موقفين.", 1.98, 2.7],
  ["إبليس", 3.18, 3.59], ["استكبر", 3.67, 4.31], ["وأصر", 4.47, 5.11], ["على", 5.19, 5.43], ["مخالفته.", 5.55, 6.39],
  ["أما", 7.11, 7.13], ["آدم", 7.29, 7.61], ["عليه", 7.69, 8.01], ["السلام،", 8.09, 8.85], ["فقد", 9.05, 9.45], ["تاب", 9.69, 9.93], ["وأناب.", 10.01, 10.89],
  ["فوقوع", 11.35, 11.91], ["الإنسان", 11.99, 12.55], ["في", 12.63, 12.71], ["الذنب", 12.79, 13.43], ["ليس", 13.51, 13.83], ["نهاية", 13.91, 14.31], ["الطريق،", 14.43, 15.19],
  ["ما", 15.43, 15.51], ["دام", 15.59, 15.83], ["يرجع", 15.91, 16.47], ["إلى", 16.55, 16.71], ["ربه", 16.79, 17.43], ["تائبًا", 17.51, 18.15], ["صادقًا.", 18.23, 18.87],
];
const words = T.map(([word, start, end]) => ({ word, start, end }));
const voice = { "c1-s35": { text: NARRATION, words } };
const scenes = thumbScenes([
  { id: "c1-s35", template: "horizon-shot", narration: NARRATION, props: { shot: "stances" } },
  { id: "c1-s40", template: "horizon-shot", narration: "﴿فَتَلَقَّىٰ آدَمُ مِن رَّبِّهِ كَلِمَاتٍ﴾", props: { shot: "x", verseKey: "2:37", verseText: "فتلقى آدم من ربه كلمات" } },
  { id: "c1-s41", template: "verse-card", narration: "", ayahKey: "2:37" },
  { id: "c1-s42", template: "dua-board", narration: "ربنا ظلمنا أنفسنا" },
  { id: "c1-s1", template: "horizon-shot", narration: "قصة بلا ذكر.", props: { shot: "y" } },
], voice);
const kit = (sceneId: string, atSeconds?: number): ThumbnailConcept[] => [
  { kind: "title", text: "أول إنسان" },
  { kind: "scene", text: "باب التوبة", sceneId, ...(atSeconds !== undefined ? { atSeconds } : {}) },
  { kind: "question", text: "نار أم طين؟" },
];
const errors = (sceneId: string, at?: number, sc = scenes) =>
  thumbnailIssues(kit(sceneId, at), { titles: ["خلق آدم عليه السلام"], scenes: sc }).filter((i) => i.level === "error").map((i) => i.message);

describe("D196 v6: غلاف المشهد من لحظة بلا ذكر", () => {
  it("نوافذ c1-s35: عبارة «ما دام يرجع إلى ربه تائبًا صادقًا» كلها و«ربه» ±٠٫٢٥ ث، لا «فوقوع الإنسان… الطريق»", () => {
    const w = coverStillWindows(NARRATION, words)!;
    expect(w[0]![0]).toBeCloseTo(15.18, 5);
    expect(w[0]![1]).toBeCloseTo(19.12, 5);
    expect(w.some(([a, b]) => a <= 17 && b >= 17)).toBe(true);
    expect(w.every(([a]) => a > 15.19 - 0.25)).toBe(true);
  });
  it("يُقبل عند لحظة الباب (١٤٫٩ ث، «الطريق»)", () => {
    expect(errors("c1-s35", 14.9)).toEqual([]);
  });
  it("يُرفض داخل عبارة «ربه» وقرب حدها، وبلا لحظة محددة", () => {
    for (const at of [15.3, 16.6, 17.0, 18.5]) expect(errors("c1-s35", at).some((m) => /ذكر الله/.test(m))).toBe(true);
    expect(errors("c1-s35").some((m) => /حدّد لحظة/.test(m))).toBe(true);
  });
  it("بلا توقيت صوت يطابق النص: المشهد كله مرفوض كما كان", () => {
    const stale = thumbScenes([{ id: "c1-s35", template: "horizon-shot", narration: NARRATION }], { "c1-s35": { text: "نص قديم", words } });
    expect(errors("c1-s35", 14.9, stale).some((m) => /لا توقيت/.test(m))).toBe(true);
    expect(errors("c1-s35", 14.9, thumbScenes([{ id: "c1-s35", template: "horizon-shot", narration: NARRATION }])).length).toBeGreaterThan(0);
  });
  it("مشاهد الآية والبسملة والدعاء مرفوضة في أي لحظة", () => {
    for (const id of ["c1-s40", "c1-s41", "c1-s42"]) expect(errors(id, 0.5).some((m) => /مشهد آية أو بسملة أو دعاء/.test(m))).toBe(true);
  });
  it("مشهد بلا ذكر كما كان، ومسار الحزمة (thumbCtx) بالقاعدة نفسها", () => {
    expect(errors("c1-s1")).toEqual([]);
    const plan = { title: "t", chapters: [{ scenes: [{ id: "c1-s35", template: "horizon-shot", narration: NARRATION, props: {} }] }] } as unknown as Plan;
    expect(thumbCtx(plan, voice).scenes).toEqual(thumbScenes([{ id: "c1-s35", template: "horizon-shot", narration: NARRATION, props: {} }], voice));
    expect(thumbCtx(plan).scenes[0]).toMatchObject({ dhikr: true, sacred: false });
    expect(thumbCtx(plan).scenes[0]!.still).toBeUndefined();
  });
});
