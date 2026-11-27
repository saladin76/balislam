/**
 * D241 على المسودات: حلقة «بانتظارك» بلا خطة بعد، وشورتسها في `publish.draft.json` نص حر يصف القص
 * (««أول جملة…» … «آخر جملة…»»، أو «… حتى …»، و«ثم» بين أجزاء غير متتالية). هنا:
 *  - جمل السكريبت بالترتيب من `script.md` (الفقرة وحدة؛ الآية والحديث جملة كل منهما)،
 *  - وقراءة وصف القص إلى أجزاء على هذه الجمل: بداية الجزء الجملة التي يبدأ فيها الاقتباس، ونهايته آخر جملة في فقرة
 *    الاقتباس المبتور بـ«…» (المحرر يبتر الفقرة لا الجملة)، أو الجملة التي ينتهي فيها الاقتباس التام.
 * وصف لا يُقرأ منه مدى (مرجع آية أو حديث وحده، أو «فكرة من الحلقة») لا يُحكم عليه آليًا: يُرد ليُحدَّد بجمله.
 * للتقرير وحده (`bal shorts-check`)؛ البوابة على الرندر في src/package/shortIdeaPlan.ts.
 */
import type { ParsedScript } from "../script/types";
import { checkShortIdea, ideaSentencesOf, normalizeIdea, type IdeaPart, type IdeaSentence, type ShortIdeaResult } from "./shortIdea";

/** جمل السكريبت بالترتيب، ووحدة كل جملة رقم فقرتها */
export const scriptIdeaSentences = (parsed: Pick<ParsedScript, "chapters">): IdeaSentence[] => {
  const out: IdeaSentence[] = [];
  let unit = 0;
  for (const c of parsed.chapters) for (const b of c.blocks) {
    unit++;
    if (b.kind === "narration" || b.kind === "bridge") {
      const text = b.text.replace(/<!--[\s\S]*?-->/g, " ").replace(/\s+/g, " ").trim();
      if (!text) continue;
      for (const t of ideaSentencesOf(text)) out.push({ text: t, kind: /﴿|﴾/.test(t) ? "verse" : "narration", unit: String(unit) });
    } else if (b.kind === "ayah") out.push({ text: `آية: ${b.ref}`, kind: "verse", unit: String(unit) });
    else if (b.kind === "hadith") out.push({ text: `حديث: ${b.ref}`, kind: "hadith", unit: String(unit) });
  }
  return out;
};

const flat = (t: string) => normalizeIdea(t).replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();

type Located = { start: number; end: number };
/** مواضع الجمل في النص المسطح الموصول */
const indexOf = (sentences: readonly IdeaSentence[]) => {
  let text = "";
  const at: Located[] = [];
  for (const s of sentences) {
    const f = flat(s.text);
    const start = text ? text.length + 1 : 0;
    text = text ? `${text} ${f}` : f;
    at.push({ start, end: text.length });
  }
  return { text, at };
};
const sentenceAt = (at: Located[], pos: number) => at.findIndex((x) => pos >= x.start && pos <= x.end);

const quotesIn = (s: string): string[] => [...s.matchAll(/«((?:[^«»]|«[^«»]*»)+)»/g)].map((m) => m[1]!.trim());

export type DraftCut = { parts: IdeaPart[] } | { error: string };

/**
 * يقرأ وصف القص إلى أجزاء على جمل السكريبت. الأجزاء يفصلها « ثم »، وبداية الجزء ونهايته يفصلهما « … » أو « حتى ».
 * في كل طرف أول اقتباس «» (أو النص كله إن لم يكن فيه اقتباس).
 */
export const resolveDraftCut = (sentences: readonly IdeaSentence[], from: string): DraftCut => {
  const idx = indexOf(sentences);
  const raw = String(from ?? "").trim();
  if (!raw) return { error: "لا وصف للقص." };
  // الفواصل (« ثم »، « … »، « حتى ») خارج الاقتباس وحده: يُخبّأ ما بين «» ثم يُعاد
  const held: string[] = [];
  const masked = raw.replace(/«(?:[^«»]|«[^«»]*»)+»/g, (m) => `\u0000${held.push(m) - 1}\u0000`);
  const unmask = (t: string) => t.replace(/\u0000(\d+)\u0000/g, (_, k: string) => held[Number(k)]!);
  // « ثم » فاصل أجزاء حين يصل بين اقتباسين (««أ» ثم «ب» حتى «ج»»)، لا «ثم» داخل وصف بلا اقتباس
  const pieces = masked.split(/\s+ثم\s+/u);
  const segs = pieces.length > 1 && pieces.every((x) => /\u0000\d+\u0000/.test(x)) ? pieces : [masked];
  const parts: IdeaPart[] = [];
  let cursor = 0;
  for (const seg of segs) {
    const sides = seg.split(/\s+(?:…|\.\.\.|حتى)\s+/u).map(unmask);
    if (sides.length < 2 && segs.length === 1) return { error: "القص غير محدد بجملة بداية وجملة نهاية (وصف أو مرجع فقط)." };
    const pick = (side: string, last: boolean) => {
      const q = quotesIn(side);
      return (q.length ? (last ? q.at(-1)! : q[0]!) : side).trim();
    };
    const a = pick(sides[0]!, false);
    const b = pick(sides.at(-1)!, true);
    const find = (q: string, after: number) => {
      const f = flat(q.replace(/…\s*$/u, ""));
      if (f.split(" ").length < 2) return -1;
      return idx.text.indexOf(f, after);
    };
    const pa = find(a, cursor);
    if (pa < 0) return { error: `جملة البداية «${a}» ليست في السكريبت الحالي.` };
    const ia = sentenceAt(idx.at, pa);
    const pb = sides.length < 2 ? pa : find(b, pa);
    if (pb < 0) return { error: `جملة النهاية «${b}» ليست في السكريبت الحالي بعد البداية.` };
    const truncated = /…\s*$/u.test(b);
    let ib = sentenceAt(idx.at, pb + flat(b.replace(/…\s*$/u, "")).length - 1);
    // الاقتباس المبتور: الفقرة كلها (المحرر يقتبس أول الفقرة)
    if (truncated) {
      const unit = sentences[ib]!.unit;
      while (ib + 1 < sentences.length && sentences[ib + 1]!.unit === unit) ib++;
    }
    parts.push([ia, ib]);
    cursor = idx.at[ib]!.end;
  }
  return { parts };
};

export type DraftShortVerdict = { title: string; from: string; result: ShortIdeaResult | null; unresolved?: string };
/** يفحص شورت مسودة: يقرأ قصه ثم يحكم عليه، أو يرده لأن قصه غير محدد بجمل. */
export const checkDraftShort = (sentences: readonly IdeaSentence[], s: { title?: string; from?: string; hook?: string; closingQuestion?: string }): DraftShortVerdict => {
  const cut = resolveDraftCut(sentences, s.from ?? "");
  const title = String(s.title ?? "").trim();
  if ("error" in cut) return { title, from: s.from ?? "", result: null, unresolved: cut.error };
  return { title, from: s.from ?? "", result: checkShortIdea(sentences, { parts: cut.parts, hook: s.hook === "line", commentClose: s.closingQuestion === "comment" }) };
};
