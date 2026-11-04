/**
 * توقيت تقديري للكلمات (قبل وجود صوت الراوي): كل كلمة 0.30 ث + 0.032 ث لكل حرف،
 * وفاصلة 0.25 ث، ونقطة 0.55 ث، ونقطتان 0.4 ث، و«|» وقفة مقصودة 0.4 ث. ≈ 120 كلمة/د.
 * المشاهد تربط حركتها بالكلمة نفسها (at/end)، فيُستبدل هذا الجدول لاحقًا بتوقيت الصوت الفعلي دون تغيير المشاهد.
 */
export type Word = { w: string; s: number; e: number; sent: number };
export type Timeline = { words: Word[]; sentences: { text: string; s: number; e: number }[]; end: number };

const clean = (w: string) => w.replace(/[،,.:؛«»"()]/g, "").replace(/[ً-ْٰ]/g, "");

export const buildTimeline = (sentences: string[], lead: number): Timeline => {
  let t = lead;
  const words: Word[] = [];
  const out: Timeline["sentences"] = [];
  sentences.forEach((sentence, si) => {
    const start = t;
    for (const raw of sentence.split(/\s+/).filter(Boolean)) {
      if (raw === "|") {
        t += 0.4;
        continue;
      }
      const letters = clean(raw).length;
      const d = 0.3 + 0.032 * letters;
      words.push({ w: clean(raw), s: t, e: t + d, sent: si });
      t += d;
      if (/[،,]$/.test(raw)) t += 0.25;
      else if (/[.؟]$/.test(raw)) t += 0.55;
      else if (/:$/.test(raw)) t += 0.4;
    }
    out.push({ text: sentence.replace(/\s*\|\s*/g, " "), s: start, e: t });
  });
  return { words, sentences: out, end: t };
};

/** بداية الكلمة رقم nth التي تبدأ بـ prefix (بعد حذف الحركات وعلامات الترقيم). */
export const at = (tl: Timeline, prefix: string, nth = 1): number => {
  const p = clean(prefix);
  const hits = tl.words.filter((x) => x.w.startsWith(p));
  const hit = hits[nth - 1];
  if (!hit) throw new Error(`كلمة غير موجودة في التوقيت: ${prefix} (${nth})`);
  return hit.s;
};

/** نهاية الكلمة رقم nth التي تبدأ بـ prefix. */
export const end = (tl: Timeline, prefix: string, nth = 1): number => {
  const p = clean(prefix);
  const hit = tl.words.filter((x) => x.w.startsWith(p))[nth - 1];
  if (!hit) throw new Error(`كلمة غير موجودة في التوقيت: ${prefix} (${nth})`);
  return hit.e;
};
