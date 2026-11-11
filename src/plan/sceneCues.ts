import { normalizeArabic } from "../script/quranMeta";

/**
 * إشارات المشاهد المصوَّرة (حكايات الحارة، الطريق، ظل ونور): أحداث بصرية تقع لحظة نطق كلمة بعينها.
 * القاعدة الثالثة: الحدث يخدم معنى الكلمة في جملتها، ويقع وقت نطقها فقط، والقائمة مراجَعة كلمةً كلمة.
 * - لا إشارة أبدًا في جملة فيها ذكر الله أو دعاء أو آية (توقير): المشهد يبقى هادئًا بلا رموز.
 * - «في حقك/حقه…» ليست «الحق»، فلا تُضيء شيئًا.
 * - البطاقة المكتوبة تحمل الكلمة المنطوقة نفسها، لا غيرها.
 */
export type CueKind = "truth" | "wrong" | "just" | "news" | "people" | "memory" | "door" | "think" | "walk" | "pain" | "decide" | "heart" | "witnesses" | "companion" | "harsh" | "proud" | "spread" | "apologize" | "listen" | "debate" | "money" | "work" | "success" | "evidence";

export const cueNamesAr: Record<CueKind, string> = {
  truth: "نور الحقيقة",
  wrong: "لون الخطأ (ختم)",
  just: "لون العدل (فجر)",
  news: "خبر يتوهج",
  people: "الناس حوله",
  memory: "بطاقة الكلمة",
  door: "باب يتسرب منه النور",
  think: "يتأمل",
  walk: "يمشي",
  pain: "ثِقل",
  decide: "يتمسك برأيه",
  heart: "نور في الصدر",
  witnesses: "شاهدان على موقف واحد",
  companion: "شخص أمامه",
  harsh: "كلمة جارحة: يتألم من أمامه",
  proud: "يتعالى برأسه",
  spread: "ينشر من هاتفه فتتسع الدوائر",
  apologize: "ينحني معتذرًا",
  listen: "يُصغي لمن أمامه",
  debate: "نقاش بين اثنين",
  money: "صُرّة مال في يده",
  work: "طاولة عمل",
  success: "عمل مكتمل يضيء على الطاولة",
  evidence: "كتاب مفتوح يزن به",
};

const LIST: [CueKind, string[]][] = [
  ["truth", ["الحقيقه", "حقيقتها", "حقيقته", "حقيقتهم", "الحقائق", "الصواب", "بصيره", "البصيره", "فالبصيره", "الهدايه"]],
  ["wrong", ["مخطئا", "مخطئين", "اخطات", "خطا", "الخطا", "خطؤه", "خطئه", "بخطئه", "بالخطا", "الباطل", "باطل", "باطلا", "والباطل", "ظلم", "ظلما", "الظلم"]],
  ["just", ["عدل", "عدلا", "بعدل", "العدل"]],
  ["news", ["خبر", "خبرا", "الخبر", "اخبار", "الاخبار", "المعلومه", "معلومه"]],
  ["people", ["الناس", "الاشخاص", "الاخرين", "كثيرين", "نحبهم"]],
  ["memory", ["تجاربنا", "تجاربه", "مخاوفنا", "مخاوفه", "عاداتنا", "الافكار", "ذكرياتنا"]],
  ["door", ["الاعتراف", "اعتراف", "فالاعتراف", "تعترف"]],
  ["think", ["تخيل", "فكرت", "تامل", "تاملوا", "اسال"]],
  ["walk", ["الطريق", "طريق", "تسير", "نسير", "للسير", "خطوه", "خطوات", "رحله"]],
  ["pain", ["مؤلم", "مولم", "مؤلما", "الالم", "صعبه", "صعب", "يصعب", "ثقيل", "مشقه"]],
  ["decide", ["قرار", "قرارا", "تدافع", "ندافع"]],
  ["heart", ["قلب", "القلب", "قلبك", "النيه", "نيتك", "نيتنا"]],
  ["witnesses", ["شخصان", "شخصين", "الاثنان", "منهما"]],
  ["companion", ["احد", "قريب", "معه", "غيره", "نصيحه"]],
  ["harsh", ["يجرح", "القسوه", "اهانه", "يؤذي", "نؤذي"]],
  ["proud", ["يتكبر", "تكبرا", "الكبر", "الغرور", "غرور", "للغرور", "احتقار"]],
  ["spread", ["ينشر", "تنشر", "نشر"]],
  ["apologize", ["تعتذر", "اعتذارا", "الاعتذار", "نعتذر"]],
  ["listen", ["تستمع", "نستمع", "استمع", "حجته"]],
  ["debate", ["النقاش", "نناقش", "اختلفت", "تختلف", "اختلف"]],
  ["money", ["المال", "مال", "مالك"]],
  ["work", ["باعمالنا", "اعمالنا", "مشروعاتنا", "جهد"]],
  ["success", ["النجاح"]],
  ["evidence", ["بالدليل", "الدليل"]],
];

/** القائمة كما هي (للاستوديو والمراجعة) */
export const CUE_WORDS: readonly [CueKind, readonly string[]][] = LIST;

const strip = (w: string) => normalizeArabic(w.replace(/[«»"“”'؟?!.,،:؛…ـ()]/g, ""));
const INDEX = new Map<string, CueKind>();
for (const [kind, words] of LIST) for (const w of words) INDEX.set(strip(w), kind);

/** يجد معنى الكلمة (بحروف العطف والجر الملتصقة: و، ف، ب، ل) */
export const cueKindOf = (word: string): CueKind | null => {
  const w = strip(word);
  if (!w) return null;
  if (INDEX.has(w)) return INDEX.get(w)!;
  if (/^[وفبل]/.test(w) && INDEX.has(w.slice(1))) return INDEX.get(w.slice(1))!;
  return null;
};

const SACRED = /(^|\s)(ال?له|لله|بالله|فالله|والله|تعالي|سبحانه|اللهم|ربنا|ربي|ربك|القران|ايه|الايه|الايات|الايتين|الوحي|الادعيه|الدعاء|دعاء)(\s|$)/;
/** جملة فيها ذكر الله أو دعاء أو آية: لا إشارات ولا رموز فيها */
export const isSacredSentence = (s: string) => /[«﴿]/.test(s) || SACRED.test(` ${strip(s).replace(/\s+/g, " ")} `);

/** «في حقك» وأمثالها: ليست الحق */
const senseException = (prev: string, word: string) => /^(ف|و)?في$/.test(strip(prev)) && /^حق/.test(strip(word));

export type Cue = { kind: CueKind; word: string };

const sentences = (text: string) => text.split(/(?<=[.؟?!؛:…])\s+/).map((s) => s.trim()).filter(Boolean);

/** إشارات المشهد من التعليق: كلمة واحدة لكل معنى في المشهد، وأقصى max إشارة */
export const cuesFor = (narration: string, max = 5): Cue[] => {
  const out: Cue[] = [];
  const seen = new Set<CueKind>();
  for (const s of sentences(narration)) {
    if (isSacredSentence(s)) continue;
    const words = s.split(/\s+/);
    words.forEach((w, i) => {
      const k = cueKindOf(w);
      if (!k || seen.has(k) || out.length >= max) return;
      if (senseException(words[i - 1] ?? "", w)) return;
      seen.add(k);
      out.push({ kind: k, word: w.replace(/[«»"“”'؟?!.,،:؛…]/g, "") });
    });
  }
  return out;
};

export const cuesToText = (cues: Cue[]) => cues.map((c) => `${c.kind} | ${c.word}`).join("\n");
export const parseCues = (text: string | undefined): Cue[] =>
  (text ?? "")
    .split("\n")
    .map((l) => l.split("|").map((x) => x.trim()))
    .filter(([k, w]) => k && w && (cueNamesAr as Record<string, string>)[k])
    .map(([k, w]) => ({ kind: k as CueKind, word: w! }));

/** لحظة كل إشارة: أول نطق لكلمتها في المشهد (وإن لم تُنطق لا تقع) */
export const cueFrames = (cues: Cue[], timings: { word: string; start: number }[]) =>
  cues
    .map((c) => {
      const t = timings.find((w) => strip(w.word) === strip(c.word));
      return t ? { ...c, at: t.start } : null;
    })
    .filter((x): x is Cue & { at: number } => x !== null);
