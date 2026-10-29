import type { Alignment } from "./elevenlabs";

/** توقيت كلمة بالثواني. */
export type TimedWord = { word: string; start: number; end: number };

type Dict = { entries?: { text: string; say: string }[] };

/**
 * يطبّق قاموس النطق كلمةً كلمة، ويحتفظ بخريطة: لكل كلمة منطوقة رقمُ الكلمة الأصلية.
 * هكذا تُعرض الترجمة بالكتابة الأصلية حتى لو تغيّر النطق المرسل.
 */
export const applyDictionary = (text: string, dict: Dict) => {
  const map = new Map((dict.entries ?? []).filter((e) => e.text && e.say).map((e) => [e.text, e.say]));
  const original = text.split(/\s+/).filter(Boolean);
  const spoken: string[] = [];
  const owner: number[] = [];
  original.forEach((w, i) => {
    const core = w.replace(/^[«"(]+|[»")،.؟!:؛…]+$/g, "");
    const say = map.get(core);
    const replaced = say ? w.replace(core, say) : w;
    for (const part of replaced.split(/\s+/).filter(Boolean)) {
      spoken.push(part);
      owner.push(i);
    }
  });
  return { original, spoken: spoken.join(" "), owner };
};

/** يحوّل توقيت الحروف إلى كلمات (الكلمات مفصولة بمسافات في النص المرسل). */
export const alignmentToWords = (a: Alignment): TimedWord[] => {
  const out: TimedWord[] = [];
  let cur: TimedWord | null = null;
  a.characters.forEach((ch, i) => {
    const start = a.character_start_times_seconds[i] ?? 0;
    const end = a.character_end_times_seconds[i] ?? start;
    if (/\s/.test(ch)) {
      if (cur) out.push(cur);
      cur = null;
      return;
    }
    if (!cur) cur = { word: ch, start, end };
    else {
      cur.word += ch;
      cur.end = end;
    }
  });
  if (cur) out.push(cur);
  return out;
};

/**
 * توقيت الكلمات الأصلية: يجمع الكلمات المنطوقة لكل كلمة أصلية.
 * إن اختلف العدد (حالة نادرة) يوزّع الكلمات الأصلية على المدة الكلية بالتناسب.
 */
export const wordsForCaptions = (original: string[], owner: number[], spokenWords: TimedWord[]): TimedWord[] => {
  if (spokenWords.length === owner.length) {
    const res: TimedWord[] = original.map((w) => ({ word: w, start: Infinity, end: 0 }));
    spokenWords.forEach((sw, i) => {
      const o = res[owner[i]!]!;
      o.start = Math.min(o.start, sw.start);
      o.end = Math.max(o.end, sw.end);
    });
    return res.map((r, i) => (Number.isFinite(r.start) ? r : { ...r, start: res[i - 1]?.end ?? 0, end: res[i - 1]?.end ?? 0 }));
  }
  const total = spokenWords.length ? spokenWords[spokenWords.length - 1]!.end : 0;
  const first = spokenWords[0]?.start ?? 0;
  const weights = original.map((w) => Math.max(2, w.length));
  const sum = weights.reduce((a, b) => a + b, 0);
  let t = first;
  return original.map((w, i) => {
    const d = ((total - first) * weights[i]!) / sum;
    const r = { word: w, start: t, end: t + d };
    t += d;
    return r;
  });
};
