/**
 * أقوال الشخصيات بأصوات ممثَّلة (قرارا المالك ٢٨ نوفمبر): D250 في «بالإسلام» (يعدّل الضابطة ٤ من D248)، وD249 في «دفاتر الزمن».
 * القناة الثالثة («زبدة الكتب») بلا أقوال شخصيات أصلًا.
 *
 * الصيغة في script.md (سطر واحد داخل الفصل، src/script/parse.ts ← Block من نوع "speech"):
 *   [قول: <مفتاح الصوت> | <النص>]                                  شخص عادي بلا اسم
 *   [قول: <مفتاح الصوت> | <النص> | اسم: <الاسم> | مصدر: <المرجع>]  شخصية مسمّاة («دفاتر الزمن» وحدها، والمصدر إلزامي ويظهر على الشاشة)
 * السطر وحدة من وحدات المحرر (`scriptSentences`) فيمر بالمحرر والمراجعة العلمية بطبقتيها كالسرد تمامًا، ولا يصير سردًا ولا
 * يقرؤه صوت الراوي المستنسخ أبدًا: يُوجَّه إلى صوت المكتبة المعتمد لمفتاحه في `channels/<القناة>/character-voices.json`
 * (`src/voice/characterVoice.ts`). القائمة فارغة حتى يختار المالك من العينات، فكل قول مرفوض في الإنتاج إلى ذلك الحين.
 *
 * ما يُرفض (خطأ في فحص السكريبت `checkForChannel`، فيمنع التجهيز وMaster):
 * - صوت غير معتمد، أو صوت المكتبة هو صوت الراوي المستنسخ نفسه، أو صوت امرأة بلا `delivery: "normal"` (لا خضوع بالقول).
 * - آية في القول (﴿﴾ أو [آية…] أو خمس كلمات متتالية من آية في الحلقة)، أو علامة رواية حديث، أو ذكر نبي أو ملك أو صحابي أو
 *   أحد من آل البيت أو أمهات المؤمنين (لا صوت لهم ولا لمن ينوب عنهم)، أو علامة فتوى أو حكم شرعي.
 * - «بالإسلام»: اسم للشخصية (عامة الناس في مثال افتراضي بلا اسم حقيقي).
 * - «دفاتر الزمن»: كل قول في حلقة تذكر من لا يُصوَّر؛ وشخصية مسمّاة بلا مصدر؛ وإمام أو عالم معروف شخصيةً؛ وقول لشخص عادي
 *   أطول من ١٢ كلمة أو فيه رقم (لا معلومة تاريخية جديدة على لسانه).
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { channelsDir } from "../channel";
import { episodeSacredMentions, phraseMatcher, sacredMentions } from "../plan/characterPolicy";
import { assertNoQuranForTts } from "../voice/quranGuard";
import type { Block, Issue, ParsedScript } from "./types";

export const CHARACTER_SPEECH_CHANNELS: Readonly<Record<string, "D249" | "D250">> = Object.freeze({ "dafatir-alzaman": "D249", balislam: "D250" });

export type CharacterVoiceRole = "older-man" | "young-man" | "woman" | "child";
/** أدوار الأصوات لكل قناة كما قالها المالك */
export const VOICE_ROLES: Readonly<Record<string, readonly CharacterVoiceRole[]>> = Object.freeze({
  balislam: ["older-man", "young-man", "woman", "child"],
  "dafatir-alzaman": ["older-man", "young-man", "woman"],
});

/** صوت من مكتبة ElevenLabs اعتمده المالك من العينات (لا صوته المستنسخ أبدًا) */
export type CharacterVoice = {
  /** المفتاح كما يُكتب في السكريبت: «رجل كبير»، «شاب»، «امرأة»، «طفل» */
  key: string;
  role: CharacterVoiceRole;
  libraryVoiceId: string;
  /** توجيه الأداء: «normal» كلام عادي؛ إلزامي للمرأة (لا خضوع بالقول، D250) */
  delivery?: "normal";
  approvedBy: string;
  approvedAt: string;
};
export type CharacterVoicesFile = { version: 1; voices: CharacterVoice[] };

export const characterVoicesPath = (channel: string, dir = channelsDir()) => path.join(dir, channel, "character-voices.json");

/** أصوات الشخصيات المعتمدة للقناة؛ ملف غائب = لا صوت معتمد */
export const loadCharacterVoices = (channel: string, dir = channelsDir()): CharacterVoicesFile => {
  const f = characterVoicesPath(channel, dir);
  if (!existsSync(f)) return { version: 1, voices: [] };
  const raw = JSON.parse(readFileSync(f, "utf8")) as CharacterVoicesFile;
  if (raw.version !== 1 || !Array.isArray(raw.voices)) throw new Error(`${f} تالف.`);
  return raw;
};

/** فحص ملف الأصوات نفسه: أدوار القناة، وتوجيه المرأة، ولا صوت الراوي المستنسخ، وسجل الاعتماد */
export const characterVoicesConfigIssues = (channel: string, file: CharacterVoicesFile, narratorVoiceId?: string): string[] => {
  const out: string[] = [];
  const roles = VOICE_ROLES[channel] ?? [];
  const keys = new Set<string>();
  for (const v of file.voices) {
    const at = `الصوت «${v.key}»`;
    if (!v.key?.trim()) out.push("صوت بلا مفتاح.");
    else if (keys.has(v.key)) out.push(`${at} مكرر.`);
    keys.add(v.key);
    if (!roles.includes(v.role)) out.push(`${at}: الدور «${v.role}» ليس من أدوار القناة (${roles.join("، ") || "لا أقوال شخصيات في هذه القناة"}).`);
    if (!v.libraryVoiceId?.trim()) out.push(`${at}: معرّف صوت المكتبة ناقص.`);
    else if (narratorVoiceId && v.libraryVoiceId === narratorVoiceId) out.push(`${at}: هو صوت الراوي المستنسخ نفسه؛ الصوت المستنسخ للراوي وحده، ولا يُستعمل بنبرة أخرى لشخصية.`);
    if (v.role === "woman" && v.delivery !== "normal") out.push(`${at}: صوت المرأة يلزمه delivery: "normal" (كلام عادي بلا خضوع بالقول).`);
    if (v.delivery !== undefined && v.delivery !== "normal") out.push(`${at}: delivery «${String(v.delivery)}» غير معروف؛ normal وحده.`);
    if (!v.approvedBy?.trim() || !v.approvedAt?.trim()) out.push(`${at}: بلا سجل اعتماد المالك (approvedBy وapprovedAt).`);
  }
  return out;
};

type Hit = { phrase: string; group: string };
/**
 * علامات رواية الحديث: لا شخصية تروي حديثًا؛ الحديث يقوله الراوي وحده («قال النبي ﷺ…»). لا «أخبرنا» (أخبرنا الله، أخبرني
 * صاحبي) ولا «في الحديث» (في الكلام) لأنهما عامّتان في كلام القنوات الثلاث.
 */
export const hadithMarkers: (text: string) => Hit[] = phraseMatcher([
  "قال رسول الله", "قال النبي", "قال الرسول", "يقول النبي", "يقول رسول الله", "عن النبي", "عن رسول الله", "صلى الله عليه وسلم",
  "رواه", "روى", "اخرجه", "حدثنا", "في الصحيح", "رضي الله عنه", "رضي الله عنها", "رضي الله عنهما",
].map((phrase) => ({ phrase, group: "حديث" })));
/**
 * علامات الفتوى والحكم الشرعي: لا شخصية تفتي ولا تقرر حكمًا؛ الراوي يقرره بدليله بعد المراجعة العلمية. محافظة عمدًا:
 * «يجب» و«واجب» و«حرام» العامية تُرفض على لسان الشخصية (الفراغ أفضل من حكم على لسان شخصية)؛ و«الحكم» و«سنة» و«حكمة»
 * لا تُطابق وحدها (الحكم العثماني، سنة ميلادية، الحكمة) بل «الحكم الشرعي» و«سنة مؤكدة»؛ ولا «يحرم» (يُحرَم: يُمنع) ولا «محرم»
 * (الشهر، والمُحرِم) ولا «شرعا» (فشرعا: فبدآ) لأن الرسم بلا تشكيل لا يفرّقها (فحص الإنذار الكاذب على سكريبتات القنوات الثلاث).
 */
export const rulingMarkers: (text: string) => Hit[] = phraseMatcher([
  "حرام", "حلال", "يجب", "واجب", "واجبه", "لا يجوز", "يجوز", "لا يحل", "فرض", "فريضه", "سنه مؤكده",
  "مكروه", "مكروهه", "مستحب", "مستحبه", "مباح", "الحكم الشرعي", "حكم الشرع", "ما حكم", "فتوى", "فتوي", "افتى", "افتي",
].map((phrase) => ({ phrase, group: "حكم" })));
/** أئمة وعلماء معروفون: لا يظهرون شخصيات ولا يُمثَّل كلامهم (D249)؛ اسمهم بالخط وكتبهم وأماكنهم فقط */
export const imamNames: (text: string) => Hit[] = phraseMatcher([
  "مالك بن انس", "الامام مالك", "الشافعي", "احمد بن حنبل", "ابن حنبل", "ابو حنيفه", "البخاري", "مسلم بن الحجاج", "الامام مسلم", "الترمذي",
  "ابو داود", "النسائي", "ابن ماجه", "الطبري", "ابن كثير", "ابن تيميه", "ابن القيم", "الغزالي", "النووي", "ابن حجر", "القرطبي", "السيوطي",
  "الاوزاعي", "سفيان الثوري", "الليث بن سعد", "الحسن البصري", "ابن سيرين",
].map((phrase) => ({ phrase, group: "إمام" })));

const words = (t: string) => t.split(/\s+/).filter(Boolean).length;
type Speech = Extract<Block, { kind: "speech" }>;

/** أقوال الشخصيات في السكريبت */
export const speechLines = (script: ParsedScript): Speech[] =>
  script.chapters.flatMap((c) => c.blocks).filter((b): b is Speech => b.kind === "speech");

/** محتوى القول الذي لا يجوز على لسان أي شخصية في أي قناة (آية، حديث، من لا يُصوَّر، فتوى) */
export const speechContentIssues = (text: string, verses: readonly string[] = []): string[] => {
  const out: string[] = [];
  try { assertNoQuranForTts(text, null, { verses, source: "character-line" }); }
  catch { out.push("لا شخصية تتلو آية؛ الآية تُعرض مكتوبة."); }
  const h = hadithMarkers(text);
  if (h.length) out.push(`لا شخصية تروي حديثًا (${h.map((x) => `«${x.phrase}»`).join("، ")})؛ الحديث يقوله الراوي وحده.`);
  const s = sacredMentions(text);
  if (s.length) out.push(`لا صوت لنبي ولا ملك ولا صحابي ولا أحد من آل البيت أو أمهات المؤمنين ولا لمن ينوب عنهم، ولا ذكر لهم على لسان شخصية (${s.map((x) => `«${x.phrase}»`).join("، ")}).`);
  const r = rulingMarkers(text);
  if (r.length) out.push(`لا شخصية تفتي أو تقرر حكمًا شرعيًا (${r.map((x) => `«${x.phrase}»`).join("، ")})؛ الراوي يقرره بدليله بعد المراجعة العلمية، والشخصية تعيش الموقف فقط.`);
  return out;
};

/** فحص أقوال الشخصيات في سكريبت قناة (يُضاف إلى checkForChannel) */
export const characterLineIssues = (script: ParsedScript, channel: string, voices: CharacterVoicesFile, o: { narratorVoiceId?: string } = {}): Issue[] => {
  const lines = speechLines(script);
  if (!lines.length) return [];
  const decision = CHARACTER_SPEECH_CHANNELS[channel];
  const out: Issue[] = [];
  const err = (message: string, line?: number) => out.push({ level: "error", code: "character-line", message: `${decision ?? "D250"}: ${message}`, line });
  if (!decision) {
    for (const l of lines) err("لا أقوال شخصيات بأصوات ممثَّلة في هذه القناة.", l.line);
    return out;
  }
  for (const m of characterVoicesConfigIssues(channel, voices, o.narratorVoiceId)) err(`ملف أصوات الشخصيات: ${m}`);
  const blocks = script.chapters.flatMap((c) => c.blocks);
  const verses = blocks.flatMap((b) => (b.kind === "ayah" && b.text ? [b.text] : []));
  const sacredEpisode = decision === "D249"
    ? episodeSacredMentions([String(script.frontmatter?.title ?? ""), ...blocks.flatMap((b) => (b.kind === "narration" || b.kind === "bridge" || b.kind === "speech" ? [b.text] : []))])
    : [];
  for (const l of lines) {
    const v = voices.voices.find((x) => x.key === l.voice);
    if (!v) err(`الصوت «${l.voice}» ليس من أصوات المكتبة المعتمدة للقناة (${voices.voices.map((x) => x.key).join("، ") || "لم يُعتمد صوت بعد"})؛ لا يقرأ القولَ صوتُ الراوي المستنسخ أبدًا.`, l.line);
    for (const m of speechContentIssues(l.text, verses)) err(m, l.line);
    if (decision === "D250") {
      if (l.name) err(`لا اسم للشخصية («${l.name}»)؛ عامة الناس بلا اسم حقيقي في مثال افتراضي واضح.`, l.line);
    } else {
      if (sacredEpisode.length)
        err(`الحلقة تذكر ${sacredEpisode.slice(0, 3).map((x) => `«${x.phrase}»`).join("، ")}: لا شخصيات ولا أصوات ممثَّلة فيها.`, l.line);
      if (l.name) {
        if (!l.source?.trim()) err(`الشخصية المسمّاة «${l.name}» لا تقول إلا كلامًا ثابتًا في المصادر، والمصدر إلزامي ويظهر على الشاشة (| مصدر: …)؛ وإلا يقوله الراوي أو لا يُقال.`, l.line);
        if (imamNames(l.name).length || sacredMentions(l.name).length) err(`«${l.name}» لا يظهر شخصيةً ولا يُمثَّل كلامه؛ اسمه بالخط وكتبه وأماكنه فقط.`, l.line);
      } else {
        if (words(l.text) > 12) err(`قول الشخص العادي قصير عام يخدم جو المشهد (١٢ كلمة على الأكثر، هنا ${words(l.text)})، بلا معلومة تاريخية جديدة.`, l.line);
        if (/[0-9٠-٩]/.test(l.text)) err("لا رقم ولا تاريخ على لسان شخص عادي؛ المعلومة التاريخية للراوي.", l.line);
        if (imamNames(l.text).length) err("قول الشخص العادي لا يحمل كلام إمام أو عالم معروف.", l.line);
      }
    }
  }
  return out;
};
