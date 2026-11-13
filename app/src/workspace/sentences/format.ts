/**
 * «الجمل» (D50): the words, labels and small rules of the sentences panel, with no React state. Shared by its
 * hook (useSentences) and its visible parts.
 */
import type { SentenceRow, SentencesRead, WordFixOutcome } from "../../api";
import { tones, isTone } from "../../../../src/voice/tones";

export const ar = (n: number) => n.toLocaleString("ar-EG");
export const secAr = (ms: number) => `${(ms / 1000).toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ث`;
export const countAr = (n: number) => (n === 1 ? "جملة واحدة" : n === 2 ? "جملتان" : n <= 10 ? `${ar(n)} جمل` : `${ar(n)} جملة`);
export const PAUSES = [0, 150, 250, 350, 450, 600, 800, 1000, 1500, 2000];

export const STATUS: Record<SentenceRow["status"] | "scene" | "verse-missing" | "verse-pending" | "verse-approved", string> = {
  missing: "بلا صوت",
  generated: "بصوت",
  stale: "تحتاج توليدًا",
  old: "قديم — سُجّل على نص سابق",
  heard: "سمعتها",
  scene: "ضمن صوت المشهد",
  "verse-missing": "لم تُرفع التلاوة",
  "verse-pending": "بانتظار استماعك",
  "verse-approved": "تلاوة معتمدة",
};

export const toneName = (t: string) => (isTone(t) ? tones[t].nameAr : "");
export const inheritLabel = (r: SentenceRow) => {
  const n = toneName(r.inheritedTone);
  if (r.toneSource === "map") return n ? `نبرة الخريطة (${n})` : "نبرة الخريطة";
  if (!n) return "مثل الحلقة — لم تُختر نبرة بعد";
  return r.toneSource === "scene" ? `مثل المشهد (${n})` : r.toneSource === "episode" ? `مثل الحلقة (${n})` : `مثل القناة (${n})`;
};

/** «أعد نطق الكلمة»: the open word, its written pronunciation, and how much of the sentence is re-said with it. */
export type WordFixDraft = { row: string; index: number; say: string; save: boolean; wide: boolean };
/** The neighbours re-said with the word (one each side by default; two under «المزيد»), clipped to the sentence. */
export const fixNeighbours = (count: number, index: number, wide: boolean): number[] => {
  const n = wide ? 2 : 1;
  const out: number[] = [];
  for (let k = index - n; k <= index + n; k++) if (k !== index && k >= 0 && k < count) out.push(k);
  return out;
};
/** The hint under the field: which neighbours are re-said with the word. */
export const neighbourHint = (words: string[], index: number, wide: boolean): string => {
  const nb = fixNeighbours(words.length, index, wide);
  const before = nb.filter((k) => k < index).map((k) => words[k]).join(" ");
  const after = nb.filter((k) => k > index).map((k) => words[k]).join(" ");
  const parts = [before, after].filter(Boolean).map((x) => `«${x}»`);
  if (!parts.length) return "تُعاد هذه الكلمة وحدها، وبقية الجملة كما هي.";
  const who = wide ? (parts.length > 1 ? `مع كلمتين من كل جانب ${parts.join(" و")}` : `مع ما يجاورها ${parts[0]}`)
    : parts.length > 1 ? `مع جارتيها ${parts.join(" و")}` : `مع جارتها ${parts[0]}`;
  return `تُعاد هذه الكلمة ${who} حتى يبقى الوصل طبيعيًا، وبقية الجملة كما هي.`;
};

/**
 * What pressing a word does (D63): «fix» opens the word popover now (the take has real word timings); «adopt» first
 * cuts the scene's single file into its sentences on the server (no paid call), then opens it; «why» opens the
 * popover that says why in one line and offers «ولّد هذه الجملة ثم صحّح الكلمة». Quranic words do nothing.
 */
export const wordClick = (r: Pick<SentenceRow, "kind" | "wordFix" | "words">, i: number): "fix" | "adopt" | "why" | null =>
  !r.words[i] || r.words[i]!.quran || r.kind !== "narration" ? null : r.wordFix.ok ? "fix" : r.wordFix.adopt ? "adopt" : "why";
/** After a server round (adopt / generate): the same word of the same sentence, by scene and position (a virtual id becomes real). */
export const reopenTarget = (next: SentencesRead, sceneId: string, k: number, i: number):
  { kind: "fix"; draft: WordFixDraft } | { kind: "why"; row: string; index: number } | null => {
  const row = next.scenes.find((x) => x.id === sceneId)?.rows[k];
  if (!row || !row.words[i]) return null;
  return row.wordFix.ok ? { kind: "fix", draft: { row: row.id, index: i, say: row.words[i]!.say, save: false, wide: false } } : { kind: "why", row: row.id, index: i };
};

export const OLDER_TONE = "وُلّدت بنبرة سابقة";
export const UPGRADE_ALL = "أعد توليد ما وُلّد بنبرة سابقة";
/** نص التأكيد: كم جملة وكم مشهد، وأنه يصرف رصيدًا */
export const toneUpgradeConfirm = (p: { sentences: unknown[]; sceneJobs: { ids: unknown[] }; scenes: unknown[]; chars: number; credits: number }) =>
  `${UPGRADE_ALL}؟\nالجمل: ${ar(p.sentences.length)}، ومقاطع المشاهد: ${ar(p.sceneJobs.ids.length)}، في المشاهد: ${ar(p.scenes.length)}.\n` +
  `يصرف نحو ${ar(p.credits)} من رصيد الصوت (${ar(p.chars)} حرفًا). التسجيلات السابقة تبقى محفوظة، والمشاهد المتأثرة تعود لمراجعتك.`;

export type WordFixResult = { index: number; word: string; before: string; say: string; save: boolean; result: WordFixOutcome };

/** Exactly what is sent for the word (D66): the field, with the written word's punctuation around it. */
export const sendPreview = (written: string, say: string) => {
  const lead = written.match(/^[\p{P}\p{S}]+/u)?.[0] ?? "";
  const trail = written.match(/[\p{P}\p{S}]+$/u)?.[0] ?? "";
  return `${lead}${say.trim().replace(/\s+/g, " ")}${trail}`;
};
