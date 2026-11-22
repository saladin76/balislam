/**
 * أزمنة القوالب ثلاثية الأبعاد (مشتركة للقنوات الثلاث، بلا هوية): كلمات المشهد بالثواني، والكلمة المرسى، ونوافذ السكون.
 * القاعدة نفسها التي تقيس بها البطاقةُ السكونَ المقصود (src/render/stillnessSpans.ts) وتُوقَّت بها الترجمة (estimateTimings).
 */
import { estimateTimings, splitWords, type WordTiming } from "../scenes/timing";
import { SACRED_WORD, duaRanges } from "../../render/stillnessSpans";
import { normalizeArabic } from "../../script/quranMeta";
import { isSacredSentence } from "../../plan/sceneCues";
import type { Window } from "./time";

export type TimedWord = { w: string; s: number; e: number };
const clean = (w: string) => normalizeArabic(w).replace(/[،,.:؛؟!«»"()﴿﴾]/g, "");
/** كلمات المشهد بالثواني: من صوت الراوي (بالإطارات)، وإلا التقدير */
export const sceneWords = (narration: string, timings: WordTiming[] | undefined, fps: number, frames: number): TimedWord[] =>
  (timings?.length ? timings : estimateTimings(narration, 6, frames - 12)).map((x) => ({ w: x.word, s: x.start / fps, e: x.end / fps }));
/** بداية الكلمة المرسى («كلمة» أو «كلمة#2») بالبادئة بعد التطبيع؛ لا وجود = null (لا حدث، الفراغ أفضل من عنصر خاطئ) */
export const anchorAt = (words: TimedWord[], anchor?: string): number | null => {
  if (!anchor?.trim()) return null;
  const [raw, n] = anchor.trim().split("#");
  const p = clean(raw!), nth = Math.max(1, Number(n) || 1);
  if (!p) return null;
  return words.filter((x) => clean(x.w).startsWith(p))[nth - 1]?.s ?? null;
};
/** الجمل بحدود كلماتها (النقطة والسؤال والتعجب) */
export const sentencesOf = (narration: string, words: TimedWord[]): { from: number; to: number; text: string }[] => {
  const toks = splitWords(narration);
  const out: { from: number; to: number; text: string }[] = [];
  let a = 0;
  toks.forEach((tok, i) => {
    if (/[.؟!]$/.test(tok) || i === toks.length - 1) { out.push({ from: a, to: Math.min(i, words.length - 1), text: toks.slice(a, i + 1).join(" ") }); a = i + 1; }
  });
  return out.filter((x) => x.from <= x.to && words[x.from]);
};
/**
 * السكون المقصود: كل ذكر لله ±٠٫٢٥ ث والدعاء (كالبطاقة)، و(wholeSentence) الجملة كلها إن كانت فيها ذكر الله أو دعاء أو آية
 * — قاعدة «بالإسلام»: لا أحداث في جملة فيها ذكر الله أو دعاء أو آية.
 */
export const stillWindows = (narration: string, words: TimedWord[], wholeSentence = false): Window[] => {
  const out: Window[] = [];
  for (const x of words) if (SACRED_WORD.test(normalizeArabic(x.w))) out.push([x.s - 0.25, x.e + 0.25]);
  for (const [a, b] of duaRanges(words.map((x) => x.w))) out.push([words[a]!.s - 0.25, words[b]!.e + 0.25]);
  if (wholeSentence) for (const s of sentencesOf(narration, words)) if (isSacredSentence(s.text)) out.push([words[s.from]!.s - 0.25, words[s.to]!.e + 0.25]);
  return out;
};
/** زمن «فعّال» لا يتقدم داخل نوافذ السكون: الكاميرا تقف فيها ثم تكمل من حيث وقفت */
export const effectiveTime = (t: number, still: Window[]) => {
  const merged = [...still].sort((x, y) => x[0] - y[0]).reduce<Window[]>((m, w) => {
    const l = m[m.length - 1];
    if (l && w[0] <= l[1]) l[1] = Math.max(l[1], w[1]); else m.push([w[0], w[1]]);
    return m;
  }, []);
  let x = t;
  for (const [s, e] of merged) x -= Math.max(0, Math.min(t, e) - Math.max(0, s));
  return x;
};
/** سطر الترجمة الجاري (جملة جملة) وتلاشيه القصير */
export const captionLine = (narration: string, words: TimedWord[], t: number): { text: string; fade: number } | null => {
  for (const s of [...sentencesOf(narration, words)].reverse()) {
    const w0 = words[s.from]!;
    if (w0.s - 0.15 <= t) return { text: words.slice(s.from, s.to + 1).map((x) => x.w).join(" "), fade: Math.min(1, Math.max(0, (t - w0.s + 0.15) / 0.13)) };
  }
  return null;
};

/**
 * لون الترجمة حسب ما تحتها في كل لقطة (طلب المالك ٢٢ نوفمبر: «حبر داكن على الورق والخلفيات الفاتحة، وأبيض على الداكنة»):
 * كل لقطة تعلن نبرة شريط الترجمة فيها. ink = حبر داكن بهالة فاتحة (ورق وأرض فاتحة)، light = نص فاتح بحد داكن رفيع
 * من ثمانية ظلال (جدار أخضر أو ليل). بلا مستطيل خلف السطر (D192). لا يُستعمل مزج «الفرق» هنا: يقلب ألوان الحارة الأخضر والبرتقالي.
 */
export type CaptionTone = "ink" | "light";
const RING = [[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5], [1.1, 1.1], [-1.1, 1.1], [1.1, -1.1], [-1.1, -1.1]];
export const CAPTION_TONES: Record<CaptionTone, { textShadow: string }> = {
  light: { textShadow: RING.map(([x, y]) => `${x}px ${y}px 0 rgba(0,0,0,0.8)`).join(", ") + ", 0 2px 6px rgba(0,0,0,0.55), 0 0 14px rgba(0,0,0,0.35)" },
  ink: { textShadow: RING.map(([x, y]) => `${x}px ${y}px 0 rgba(255,250,240,0.85)`).join(", ") + ", 0 0 12px rgba(255,250,240,0.7)" },
};
/** نطاق الترجمة أسفل الكادر (نسبة من الارتفاع): لا بطاقة ولا عنصر مقروء يقع فيه */
export const CAPTION_BAND = 0.22;
