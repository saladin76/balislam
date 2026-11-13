import { normalizeArabic, normalizedWords, wordSimilarity } from "./normalize";

/**
 * فحص النطق (العمل ٩): مقارنة تفريغ الجملة بنصها كلمةً كلمة بعد التطبيع العربي (normalize.ts).
 * محاذاة برمجة ديناميكية بين كلمات النص وكلمات التفريغ، تسمح بوصل كلمتين أو فصلهما (عبد الله / عبدالله)،
 * وبالأرقام المكتوبة أرقامًا في التفريغ مقابل كلماتها في النص. كلمة النص «مشكوك فيها» إن لم يقابلها شيء
 * أو قابلها ما يشبهها أقل من SUSPECT_BELOW. لا تُعلَّم كلمة من حرفين أو أقل (في، من، و…) ولا كلمة قرآنية.
 * النتيجة تنبيه وحده: لا تمنع اعتمادًا ولا توليدًا (المراجعة البشرية هي السلطة).
 */

export const SUSPECT_BELOW = 0.6;
/** Comparable words this short are never flagged (particles; the model confuses them most). */
export const MIN_FLAG_LETTERS = 3;

export type RefWord = {
  /** the word as the owner wrote it (shown in the warning) */
  word: string;
  /** other forms that count as right: what is actually sent (lexicon, correction, tashkeel file) */
  alt?: string[];
  /** never flagged (a Quranic word) */
  skip?: boolean;
};
export type Suspect = { index: number; word: string; heard: string | null };
export type Comparison = {
  verdict: "ok" | "suspect" | "empty";
  suspects: Suspect[];
  /** share of flaggable words that matched (for the measurement) */
  matched: number;
  flaggable: number;
};

const joined = (s: string) => normalizedWords(s).join("");
const isDigits = (s: string) => /^\d+$/.test(s);

type Step = { di: number; dj: number; sim: number | null };

export const compareTranscript = (ref: RefWord[], transcript: string): Comparison => {
  const forms = ref.map((r) => [...new Set([r.word, ...(r.alt ?? [])].map(joined).filter(Boolean))]);
  const hyp = normalizedWords(transcript);
  const flaggableAt = ref.map((r, i) => !r.skip && [...(forms[i]![0] ?? "")].length >= MIN_FLAG_LETTERS);
  const flaggable = flaggableAt.filter(Boolean).length;
  if (!hyp.length) {
    return { verdict: flaggable ? "empty" : "ok", suspects: [], matched: 0, flaggable };
  }
  const simRef = (i: number, h: string) => Math.max(0, ...forms[i]!.map((f) => wordSimilarity(f, h)));
  const simRef2 = (i: number, h: string) => {
    const a = forms[i]!, b = forms[i + 1]!;
    let best = 0;
    for (const x of a) for (const y of b) best = Math.max(best, wordSimilarity(x + y, h));
    return best;
  };
  const n = ref.length, m = hyp.length;
  const INF = Number.POSITIVE_INFINITY;
  const cost: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(INF));
  const back: (Step | null)[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(null));
  cost[0]![0] = 0;
  const relax = (i: number, j: number, di: number, dj: number, c: number, sim: number | null) => {
    const v = cost[i]![j]! + c;
    if (v < cost[i + di]![j + dj]!) { cost[i + di]![j + dj] = v; back[i + di]![j + dj] = { di, dj, sim }; }
  };
  for (let i = 0; i <= n; i++) for (let j = 0; j <= m; j++) {
    if (cost[i]![j] === INF) continue;
    if (i < n) relax(i, j, 1, 0, flaggableAt[i] ? 1 : 0.4, null);
    if (j < m) relax(i, j, 0, 1, 0.8, null);
    if (i < n && j < m) {
      const h = hyp[j]!;
      if (isDigits(h)) {
        // «ثلاثمئة وخمسين» ← 350: a number in the transcript stands for one to four written words, never flagged
        for (let k = 1; k <= 4 && i + k <= n; k++) relax(i, j, k, 1, 0.1 * k, 1);
      }
      const s = simRef(i, h);
      relax(i, j, 1, 1, 1 - s, s);
      if (j + 1 < m) { const s2 = Math.max(...forms[i]!.map((f) => wordSimilarity(f, h + hyp[j + 1]!)), 0); relax(i, j, 1, 2, 1 - s2 + 0.15, s2); }
      if (i + 1 < n) { const s3 = simRef2(i, h); relax(i, j, 2, 1, 2 * (1 - s3) + 0.15, s3); }
    }
  }
  // walk back: what each written word met
  const met: { sim: number | null; heard: string | null }[] = ref.map(() => ({ sim: null, heard: null }));
  let i = n, j = m;
  while (i > 0 || j > 0) {
    const st = back[i]![j]!;
    const heard = st.dj ? hyp.slice(j - st.dj, j).join(" ") : null;
    for (let k = 1; k <= st.di; k++) met[i - k] = { sim: st.sim, heard };
    i -= st.di; j -= st.dj;
  }
  const suspects: Suspect[] = [];
  let matched = 0;
  ref.forEach((r, k) => {
    if (!flaggableAt[k]) return;
    const x = met[k]!;
    if (x.sim !== null && x.sim >= SUSPECT_BELOW) { matched++; return; }
    suspects.push({ index: k, word: r.word, heard: x.heard });
  });
  return { verdict: suspects.length ? "suspect" : "ok", suspects, matched, flaggable };
};

/** «كلمة قد تكون نُطقت خطأ: …» — the owner-facing line (Arabic list, at most four words). */
export const suspectLine = (c: { verdict: Comparison["verdict"] | "error"; suspects: Suspect[] }): string | null => {
  if (c.verdict === "empty") return "لم يُسمع كلام واضح في تسجيل هذه الجملة — استمع إليها.";
  if (c.verdict !== "suspect" || !c.suspects.length) return null;
  const shown = c.suspects.slice(0, 4).map((s) => `«${s.word.replace(/[\p{P}]+$/u, "")}»`);
  const more = c.suspects.length - shown.length;
  const label = c.suspects.length === 1 ? "كلمة قد تكون نُطقت خطأ" : "كلمات قد تكون نُطقت خطأ";
  return `${label}: ${shown.join("، ")}${more > 0 ? ` و${more.toLocaleString("ar-EG")} غيرها` : ""}`;
};

/** Stable key of a sentence text for the cache (the comparable form). */
export const textKey = (s: string) => normalizeArabic(s);
