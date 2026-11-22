/**
 * «خط الأفق» — كاميرا حية (طلب المالك ٢٢ نوفمبر: التفاعلية ≥80٪ بدفع أوضح للكاميرا وطبقات بسرعات مختلفة):
 * دفع نحو الدفتر يبلغ ذروته وسط المشهد ويعود إلى إطاره الأول عند القطع (فيبقى الدفتر متصلًا بين المشاهد بلا قفزة)،
 * مع انزياح أفقي خفيف للدفتر، وانزياح معاكس أبطأ للخلفية (طبقتان بسرعتين: عمق).
 * السكون المقصود ثابت: الزمن «الفعّال» لا يتقدم داخل نوافذ ذكر الله والدعاء والآية وتمهيدها (القاعدة الثانية)،
 * فلا تتحرك الكاميرا فيها ولا تُضاف حركة قبلها أو بعدها لتعويضها؛ ومشهد التمهيد الساكن كله ساكن.
 */
import { SACRED_WORD, duaRanges } from "../../../render/stillnessSpans";
import { normalizeArabic } from "../../../script/quranMeta";
import type { Timeline } from "./timeline";

export type Win = [number, number];
/** نوافذ السكون داخل المشهد بزمن المشهد */
export const breathStill = (tl: Timeline, dur: number, still: boolean, verse?: Win | null): Win[] => {
  if (still) return [[0, dur]];
  const out: Win[] = [];
  for (const w of tl.words) if (SACRED_WORD.test(normalizeArabic(w.w))) out.push([w.s - 0.25, w.e + 0.25]);
  for (const [a, b] of duaRanges(tl.words.map((w) => w.w))) out.push([tl.words[a]!.s - 0.25, tl.words[b]!.e + 0.25]);
  if (verse && tl.words.length) out.push([tl.words[tl.words.length - 1]!.e, verse[1]]);
  return out.map(([a, b]) => [Math.max(0, a), Math.min(dur, b)] as Win).filter(([a, b]) => b > a);
};
/** الزمن الفعّال حتى t: الزمن ناقص ما مر منه داخل نوافذ السكون (النوافذ المتداخلة تُدمج) */
export const activeTime = (t: number, wins: Win[]) => {
  const merged = [...wins].sort((x, y) => x[0] - y[0]).reduce<Win[]>((m, w) => {
    const last = m[m.length - 1];
    if (last && w[0] <= last[1]) last[1] = Math.max(last[1], w[1]); else m.push([w[0], w[1]]);
    return m;
  }, []);
  let still = 0;
  for (const [a, b] of merged) still += Math.max(0, Math.min(t, b) - a) * (t > a ? 1 : 0);
  return Math.max(0, t - still);
};
/** إطارات الكاميرا بالتناوب: دفع وانزياح، ثم سحب قليل بانزياح معاكس… (أحجام صغيرة: الدفتر يبقى كله مقروءًا) */
export const FRAMES = [
  { s: 1.07, x: -34, y: -14 },
  { s: 1.02, x: 26, y: 8 },
  { s: 1.1, x: 12, y: -22 },
  { s: 1.04, x: -22, y: 10 },
] as const;
export const BEAT = { move: 1.4, gap: 1.6, longPhrase: 2.2 } as const;
type Pose = { s: number; x: number; y: number };
const ID: Pose = { s: 1, x: 0, y: 0 };
const inWin = (a: number, b: number, wins: Win[]) => wins.some(([x, y]) => a < y && b > x);
/**
 * لحظات الكاميرا: بداية كل جملة وكل فاصلة (الحركة لها سبب في الكلام)، وفي العبارة الطويلة لحظة عند حد كلمة،
 * بلا لحظة تتداخل حركتها مع نافذة سكون، وبفاصل لا يقل عن BEAT.gap؛ وآخرها رجوع إلى الإطار الأول قبل القطع.
 */
export const breathBeats = (tl: Timeline, dur: number, wins: Win[]): { at: number; to: Pose }[] => {
  const cands: number[] = [];
  tl.words.forEach((w, i) => {
    const prev = tl.words[i - 1];
    if (!prev || w.sent !== prev.sent || /[،,:؛]$/.test(prev.w)) cands.push(w.s - 0.15);
    else if (w.s - cands[cands.length - 1]! >= BEAT.longPhrase) cands.push(w.s - 0.1);
  });
  const end = dur - BEAT.move - 0.2;
  const beats: { at: number; to: Pose }[] = [];
  let k = 0;
  for (const c of cands) {
    const at = Math.max(0, c);
    if (at > end - BEAT.gap) break;
    if (beats.length && at - beats[beats.length - 1]!.at < BEAT.gap) continue;
    if (inWin(at, at + BEAT.move, wins)) continue;
    beats.push({ at, to: FRAMES[k++ % FRAMES.length]! });
  }
  if (beats.length) {
    // الرجوع: آخر لحظة ممكنة خارج السكون، فيُقطع على الإطار الأول (اتصال الدفتر بين المشاهد)
    let back = Math.max(beats[beats.length - 1]!.at + BEAT.gap, end);
    while (back > beats[beats.length - 1]!.at + BEAT.move && inWin(back, back + BEAT.move, wins)) back -= 0.1;
    if (!inWin(back, back + BEAT.move, wins)) beats.push({ at: back, to: ID });
  }
  return beats;
};
const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
/** وضع الكاميرا عند t، وانزياح الخلفية المعاكس الأبطأ (طبقة ثانية بسرعة أخرى) */
export const breathAt = (t: number, beats: { at: number; to: Pose }[]) => {
  let cur: Pose = ID;
  for (const b of beats) {
    if (t < b.at) break;
    const p = ease((t - b.at) / BEAT.move);
    cur = { s: cur.s + (b.to.s - cur.s) * p, x: cur.x + (b.to.x - cur.x) * p, y: cur.y + (b.to.y - cur.y) * p };
  }
  return { ...cur, bg: -cur.x * 0.6 };
};
