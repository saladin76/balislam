/**
 * D246 «أ»: «أول فكرة مرسومة» في لقطة «خط الأفق» — أول عنصر يُرسم على كلمته (من مراسي اللقطة نفسها عبر cueTrace)، بلا React
 * ولا رندر. يستعمله المحوّل (src/plan/quotePlacement.ts) لتنزل البطاقة بعدها، ويستعمله HorizonShot في المشهد الذي تستمر إليه
 * بطاقة من قبله (تصحيح D246، ٢٨ نوفمبر): الرسم يقف على حال اكتمال فكرته الأولى طوال البطاقة، فلا تبقى الصفحة فارغة (D218).
 */
import type { Timeline } from "./timeline";
import { traceCues, type CueEvent } from "./cueTrace";

export type FirstIdea = { idx: number; len: number; word: string; s: number; done: number };
type ShotFn = (q: { t: number; tl: Timeline; dur: number; exit: string; p: Record<string, string | undefined> }) => unknown;

/** حقول الاقتباس لا تدخل رسم اللقطة عند التتبع */
export const bareProps = (p: Record<string, string | undefined>) => Object.fromEntries(Object.entries(p).filter(([k]) => !/^(verse|hadith|carry|quote)/.test(k)));

/** أول عنصر مرسوم على كلمته (null: لا حدث على كلمة، كتمهيد الآية الساكن أو مشهد بالكلمات وحدها) */
export const firstIdeaOf = (fn: ShotFn | undefined, tl: Timeline, props: Record<string, string | undefined>, still = false): FirstIdea | null => {
  if (!fn || !tl.words.length || still) return null;
  const dur = tl.end + 1.2;
  const p = bareProps(props);
  const ev: CueEvent[] = [];
  for (const t of [0.05, tl.end / 2, tl.end]) ev.push(...traceCues(() => fn({ t, tl, dur, exit: "none", p })));
  const ok = ev.filter((e) => e.idx >= 0 && e.idx < tl.words.length);
  if (!ok.length) return null;
  const idx = Math.min(...ok.map((e) => e.idx));
  const len = Math.max(...ok.filter((e) => e.idx === idx).map((e) => e.len));
  const w = tl.words[idx]!;
  return { idx, len, word: w.w, s: w.s, done: w.s + len };
};

/** لقطات تُستدعى دالتها مباشرة بلا خطافات (البدايات bdNN-… والمكتبة lib-…)؛ لقطات 001 مكوّنات قد تستعمل خطافات فلا تُتتبع أثناء الرسم */
export const traceableShot = (shot: string) => /^(bd\d|lib-)/.test(shot);
