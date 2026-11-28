/**
 * D248 (قرار المالك ٢٨ نوفمبر، «بالإسلام» وحدها): القناة تستمر **بشخصيات**، على ما رجّحته دار الإفتاء المصرية في رسم
 * عامة الناس بضوابط. اختيار مقصود للقناة وحدها، واستثناء من قاعدة «تجنّب المختلف فيه» **في الرسم وحده لا في المحتوى**.
 * حكم المراجعة العلمية كما لخّصه المالك: الشخصية **بلا ملامح أصلًا بالتصميم** (لا عينان ولا فم ولا أنف)، لا وجه
 * مرسوم يُخفى تحت ضوء أو توهّج (فرّق المدقق بين الاثنين).
 *
 * الضوابط الخمس، بوابة في الكود (فحص الخطة planIssues خطأ مبكر، وقبل كل رندر وكل مهمة لجهاز الرندر):
 *  ١. بلا ملامح من الأصل: `face: "featureless"`، ويُرفض كل حقل ملامح أو إخفاء للوجه (ضوء/توهج/ضباب/ظل).
 *  ٢. عامة الناس بلا أسماء: لا اسم ولا وسم للشخصية، ولا شخصية في مشهد يذكر كلامه نبيًا أو ملَكًا أو صحابيًا أو
 *     أحدًا من آل البيت أو أمهات المؤمنين (`sacredMentions`، بتطبيع فحص الآثار نفسه).
 *  ٣. لباس محتشم: `attire` من ثلاث قيم معلنة و`bodyEmphasis: false`.
 *  ٤. لا صوت ممثَّل: الراوي وحده (لا `voice` للمشهد ولا حوار ولا فقاعة كلام).
 *  ٥. لوحة نهارية فاتحة مبهجة (كريمي، ذهبي، أخضر هادئ، فيروزي)، ولا ليل ولا تدرّج قاتم في مشهد فيه شخصية.
 *
 * شكل الإعلان: `props.characters` نص JSON لمصفوفة CharacterSpec (حقول المشهد نصوص؛ src/plan/types.ts). مثال:
 *   [{"slot":"c1","kind":"ordinary-person","age":"adult","face":"featureless","attire":"modest-men",
 *     "bodyEmphasis":false,"palette":["cream","calm-green"]}]
 * المشاهد القائمة بقالب فيه شخص («الحارة» وأخواتها) تمر عليها الضابطتان ٢ و٤ دائمًا، وتنبيه بإعلان الشخصية؛
 * والقالب الجديد بالشخصيات (بعد ستوري بورد D228) يعلنها إلزامًا. لا محرك هنا بعد: هذا عقد البيانات والبوابة وحدهما.
 * القناتان الأخريان لا يمسهما شيء من هذا.
 */
import { normalizeForTraces } from "../package/traces";
import { parseBeats } from "./beats";
import type { Plan, PlanScene } from "./types";

export const CHARACTER_POLICY_CHANNELS: ReadonlySet<string> = new Set(["balislam"]);

/** لوحة الشخصيات النهارية (الضابطة ٥): الرموز وحدها تُكتب في الإعلان، والقيم مرجع للمحرك القادم */
export const CHARACTER_PALETTE = {
  cream: "#F4EAD5",
  gold: "#D9A441",
  "calm-green": "#7FAE8C",
  turquoise: "#3FA7A0",
} as const;
export type CharacterPaletteToken = keyof typeof CHARACTER_PALETTE;

export const CHARACTER_ATTIRE = ["modest-men", "modest-women-loose", "child-normal"] as const;
export type CharacterAttire = (typeof CHARACTER_ATTIRE)[number];
export const CHARACTER_AGES = ["adult", "elder", "child"] as const;

export type CharacterSpec = {
  /** خانة محايدة لا تحمل اسمًا (c1…c9) */
  slot: string;
  /** عامة الناس وحدهم */
  kind: "ordinary-person";
  age: (typeof CHARACTER_AGES)[number];
  /** بلا ملامح من الأصل، لا وجه مرسوم ثم مغطى */
  face: "featureless";
  attire: CharacterAttire;
  /** لا لقطة تُبرز تفاصيل الجسد */
  bodyEmphasis: false;
  palette: CharacterPaletteToken[];
};

/** القوالب القائمة التي ترسم شخصًا (تمر عليها الضابطتان ٢ و٤ ولو بلا إعلان) */
export const FIGURE_TEMPLATES: ReadonlySet<string> = new Set(["alley-tale", "road-journey", "light-stage", "character-talk"]);

const SPEC_KEYS = new Set(["slot", "kind", "age", "face", "attire", "bodyEmphasis", "palette"]);
const NAME_KEYS = /^(name|label|title|caption|nameAr|displayName|who|identity)$/i;
const VOICE_KEYS = /^(voice|voiceId|dialogue|dialog|line|lines|speech|bubble|says|talk|audio)$/i;
const FACE_KEYS = /^(eyes?|mouth|nose|lips|brows?|eyebrows?|features|facial\w*|faceCover|faceHidden\w*|faceLight|faceGlow|faceBlur|faceShadow|glow|halo|veilOfLight)$/i;

const D = "D248";
const err = (m: string) => `${D}: ${m}`;

/** فحص إعلان شخصية واحدة؛ رسائل عربية، ومصفوفة فارغة إن سلم */
export const characterSpecIssues = (spec: unknown, i: number, o: { palette?: boolean; decision?: string } = {}): string[] => {
  const usePalette = o.palette ?? true;
  const err = (m: string) => `${o.decision ?? D}: ${m}`;
  const at = `الشخصية ${i + 1}`;
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) return [err(`${at}: الإعلان ليس كائنًا.`)];
  const s = spec as Record<string, unknown>;
  const out: string[] = [];
  for (const k of Object.keys(s)) {
    if (NAME_KEYS.test(k)) out.push(err(`${at}: لا تُسمّى الشخصية ولا توسم («${k}»)؛ عامة الناس بلا أسماء.`));
    else if (VOICE_KEYS.test(k)) out.push(err(`${at}: لا صوت ولا حوار في إعلان الشخصية («${k}»)؛ قول الشخصية سطر [قول: …] في السكريبت بصوت مكتبة معتمد يمر بالمحرر والمراجعة (D249/D250).`));
    else if (FACE_KEYS.test(k) || /^face/i.test(k) && k !== "face")
      out.push(err(`${at}: حقل ملامح أو إخفاء للوجه («${k}») مرفوض؛ الشخصية بلا ملامح من الأصل، ووجه مرسوم ثم مغطى بضوء أو توهج أو ضباب أو ظل مرفوض.`));
    else if (!SPEC_KEYS.has(k) || (!usePalette && k === "palette")) out.push(err(`${at}: حقل غير معروف «${k}»؛ الحقول: ${[...SPEC_KEYS].join("، ")}.`));
  }
  if (typeof s.slot !== "string" || !/^c[1-9]$/.test(s.slot)) out.push(err(`${at}: slot خانة محايدة من c1 إلى c9 (لا اسم).`));
  if (s.kind !== "ordinary-person") out.push(err(`${at}: kind يجب أن يكون ordinary-person؛ لا نبي ولا ملك ولا صحابي ولا أحد من آل البيت أو أمهات المؤمنين بأي صورة.`));
  if (!CHARACTER_AGES.includes(s.age as never)) out.push(err(`${at}: age من ${CHARACTER_AGES.join(" أو ")}.`));
  if (s.face !== "featureless") out.push(err(`${at}: face يجب أن يكون featureless: بلا عينين ولا فم ولا أنف من الأصل (لا وجه مرسوم تحت ضوء).`));
  if (!CHARACTER_ATTIRE.includes(s.attire as never)) out.push(err(`${at}: attire إلزامي من ${CHARACTER_ATTIRE.join(" أو ")} (رجال بلباس ساتر عادي، نساء بلباس واسع ساتر غير شفاف، أطفال بلباس عادي).`));
  else if ((s.age === "child") !== (s.attire === "child-normal")) out.push(err(`${at}: child-normal للطفل وحده، والكبير بلباس modest-men أو modest-women-loose.`));
  if (s.bodyEmphasis !== false) out.push(err(`${at}: bodyEmphasis يجب أن يكون false صراحة؛ لا لقطة تُبرز شكل الجسد.`));
  const pal = s.palette;
  if (!usePalette) return out;
  if (!Array.isArray(pal) || !pal.length) out.push(err(`${at}: palette إلزامي من رموز اللوحة النهارية: ${Object.keys(CHARACTER_PALETTE).join("، ")}.`));
  else for (const t of pal) if (typeof t !== "string" || !(t in CHARACTER_PALETTE))
    out.push(err(`${at}: اللون «${String(t)}» خارج اللوحة النهارية (${Object.keys(CHARACTER_PALETTE).join("، ")}).`));
  return out;
};

/** قراءة props.characters: الإعلانات السليمة الشكل ورسائل ما يُرفض */
export const parseCharacters = (raw: string | undefined, o: { palette?: boolean; decision?: string } = {}): { specs: unknown[]; issues: string[] } => {
  const err = (m: string) => `${o.decision ?? D}: ${m}`;
  if (raw === undefined || !raw.trim()) return { specs: [], issues: [] };
  let v: unknown;
  try { v = JSON.parse(raw); } catch { return { specs: [], issues: [err("props.characters ليس JSON صالحًا (مصفوفة إعلانات CharacterSpec).")] }; }
  if (!Array.isArray(v)) return { specs: [], issues: [err("props.characters يجب أن يكون مصفوفة إعلانات CharacterSpec.")] };
  if (!v.length) return { specs: [], issues: [err("props.characters مصفوفة فارغة؛ احذف الحقل إن لم يكن في المشهد شخصية.")] };
  const issues = v.flatMap((s, i) => characterSpecIssues(s, i, o));
  const slots = v.map((s) => (s && typeof s === "object" ? (s as { slot?: unknown }).slot : undefined)).filter((x) => typeof x === "string");
  if (new Set(slots).size !== slots.length) issues.push(err("خانتان بالرمز نفسه في props.characters."));
  return { specs: v, issues };
};

// ───────────── الضابطة ٢: من لا تجوز معه شخصية في المشهد ─────────────

/** تطبيع فحص الآثار نفسه (NFKC، المحارف الخفية، التشكيل، الألفات، الياء)، ثم التاء المربوطة والهمزات على كرسي */
export const normalizeForSacred = (text: string): string =>
  normalizeForTraces(String(text ?? "").replace(/ﷺ/g, " صلى الله عليه وسلم ")).replace(/ة/g, "ه").replace(/ئ/g, "ي").replace(/ؤ/g, "و");

const tok = (s: string): string[] => normalizeForSacred(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean).map(canonTok);
/** «ابن/بن» و«أبو/أبي/أبا» شكل واحد داخل العبارة */
function canonTok(t: string): string {
  if (t === "ابن" || t === "بن") return "بن";
  if (t === "ابو" || t === "ابي" || t === "ابا") return "ابو";
  return t;
}
/** صور الكلمة بعد نزع السوابق (و/ف ثم ب/ل/ك، و«لل» = ل + ال) */
const variants = (t: string): string[] => {
  const out = new Set([t]);
  const strip1 = (x: string) => (/^[وف]../.test(x) ? [x.slice(1)] : []);
  const strip2 = (x: string) => (/^[بلك]../.test(x) ? [x.slice(1), ...(x.startsWith("لل") && x.length > 3 ? ["ال" + x.slice(2)] : [])] : []);
  for (const a of [t, ...strip1(t)]) { out.add(a); for (const b of strip2(a)) out.add(b); }
  return [...out].map(canonTok);
};

export type SacredGroup = "نبي" | "ملك" | "صحابي" | "آل البيت" | "أمهات المؤمنين";
type Entry = { phrase: string; group: SacredGroup; /** لا يُعدّ بعد هذه الكلمات (مثل «ابن آدم» = الإنسان) */ notAfter?: string[]; /** ولا قبل هذه (هارون الرشيد، المسيح الدجال) */ notBefore?: string[] };

/**
 * القائمة: كلمة واحدة أو عبارة. الأسماء التي لها معنى عام شائع لا تُطابق إلا في عبارة لا تحتمل غيرها:
 * «علي» (= على بعد التطبيع)، «عمر» (العُمْر)، «الحسن» (الحَسَن، والحديث الحسن)، «صالح» (الصالح)، «يحيى» (يُحيي)،
 * «ملك» (المَلِك، المُلك)، «الصديق» (الصاحب)، «أحمد» (أحمدُ الله)، «أهل البيت» (أهل كل بيت). والأسماء الشائعة
 * بلا معنى آخر (محمد، موسى، يوسف، إبراهيم، فاطمة، زينب…) تُطابق كلمةً: الشخصية بلا اسم أصلًا، فذكرها مع شخصية
 * على الشاشة يُرفض احتياطًا.
 */
const P = (group: SacredGroup, ...phrases: string[]): Entry[] => phrases.map((phrase) => ({ phrase, group }));
/** اسم علم من كلمة واحدة: لا يُعدّ بعد «ابن/بن» (عبد الله بن يوسف، ابن إسحاق: اسم أب لغيره) ولا بعد «سورة» (سورة هود) */
const NAME_NOT_AFTER = ["بن", "سوره"];
const N = (group: SacredGroup, ...names: string[]): Entry[] => names.map((phrase) => ({ phrase, group, notAfter: NAME_NOT_AFTER }));
const ENTRIES: Entry[] = [
  // الأنبياء والرسل
  ...P("نبي", "نبي", "النبي", "نبيا", "نبينا", "نبيكم", "نبيهم", "انبياء", "الانبياء", "النبيين", "نبيين", "النبيون", "الرسول", "رسولنا",
    "رسوله", "رسول الله", "رسل الله", "الرسل", "المرسلين", "المرسلون", "صلى الله عليه وسلم", "عليه السلام", "عليهم السلام", "عليه الصلاة والسلام",
    "المصطفى", "خاتم النبيين", "ذو النون", "ذو الكفل", "قوم هود", "قوم لوط", "قوم نوح", "ابن مريم", "عليها السلام",
    "صالح عليه السلام", "النبي صالح", "قوم صالح", "ناقه صالح", "سيدنا صالح", "يحيى عليه السلام", "يحيى بن زكريا", "سيدنا يحيى"),
  ...N("نبي", "محمد", "موسى", "عيسى", "ابراهيم", "نوح", "اسماعيل", "اسحاق", "يعقوب", "يوسف", "يونس", "داود", "سليمان", "هود",
    "شعيب", "لوط", "الياس", "اليسع", "ايوب", "زكريا", "ادريس", "مريم"),
  { phrase: "هارون", group: "نبي", notAfter: NAME_NOT_AFTER, notBefore: ["الرشيد"] },
  { phrase: "المسيح", group: "نبي", notAfter: NAME_NOT_AFTER, notBefore: ["الدجال"] },
  { phrase: "ادم", group: "نبي", notAfter: [...NAME_NOT_AFTER, "بني", "بنو", "ابناء", "ابنا", "بنات", "اولاد", "ذريه"] },
  // الملائكة
  ...P("ملك", "ملائكه", "الملائكه", "ملاك", "الملاك", "الملكين", "ملك الموت", "ملك من الملائكه", "منكر ونكير", "هاروت وماروت",
    "الروح الامين", "حمله العرش", "الكرام الكاتبين", "كراما كاتبين"),
  ...N("ملك", "جبريل", "جبرائيل", "جبرييل", "ميكائيل", "ميكال", "اسرافيل", "عزرائيل"),
  // الصحابة
  ...P("صحابي", "صحابي", "صحابيا", "الصحابي", "صحابه", "الصحابه", "صحابيه", "الصحابيه", "الصحابيات", "اصحاب النبي", "اصحاب رسول الله",
    "رضي الله عنه", "رضي الله عنها", "رضي الله عنهم", "رضي الله عنهما", "رضوان الله عليهم", "الخلفاء الراشدين", "الخلفاء الراشدون",
    "ابو بكر", "الصديق رضي", "عمر بن الخطاب", "سيدنا عمر", "الفاروق", "ذو النورين", "علي بن ابو طالب", "سيدنا علي", "الامام علي",
    "علي رضي", "علي كرم الله وجهه", "ابو هريره", "بن عمر", "بن عباس", "بن مسعود", "معاذ بن جبل", "بلال بن رباح",
    "خالد بن الوليد", "سعد بن ابو وقاص", "الزبير بن العوام", "طلحه بن عبيد الله", "حمزه بن عبد المطلب", "عبد الرحمن بن عوف", "ابو ذر",
    "سلمان الفارسي", "عمار بن ياسر", "مصعب بن عمير", "ابو عبيده", "جعفر بن ابو طالب", "ابو موسى الاشعري", "ابو سعيد الخدري",
    "جابر بن عبد الله", "عبد الله بن عمرو", "ابو الدرداء", "ابو ايوب الانصاري", "اسامه بن زيد", "زيد بن حارثه", "بن ام مكتوم"),
  ...N("صحابي", "عثمان"),
  // «مالك بن أنس بن مالك» نسب الإمام مالك، لا الصحابي
  { phrase: "انس بن مالك", group: "صحابي", notAfter: ["بن"] },
  // آل البيت
  ...P("آل البيت", "ال البيت", "اهل بيت النبي", "ال بيت النبي", "الحسن والحسين", "الحسن بن علي", "سيدنا الحسن", "الامام الحسن", "علي والحسن"),
  ...N("آل البيت", "فاطمه", "الزهراء", "الحسين"),
  // أمهات المؤمنين
  ...P("أمهات المؤمنين", "امهات المؤمنين", "ام المؤمنين", "ام سلمه", "ام حبيبه", "ريحانه بنت زيد", "زوجات النبي", "ازواج النبي"),
  ...N("أمهات المؤمنين", "خديجه", "عائشه", "حفصه", "سوده", "زينب", "جويريه", "صفيه", "ميمونه"),
];
/** مطابِق عبارات بالتطبيع نفسه (السوابق، ابن/بن، أبو/أبي): للقائمة هنا، ولعلامات الحديث والفتوى في أقوال الشخصيات */
export type PhraseEntry<G extends string> = { phrase: string; group: G; notAfter?: string[]; notBefore?: string[] };
export const phraseMatcher = <G extends string>(entries: readonly PhraseEntry<G>[], o: { singleNotAfterSurah?: boolean } = {}) => {
  /** كل كلمة مفردة لا تُعدّ بعد «سورة» (سورة الأنبياء، سورة مريم، سورة محمد) */
  const compiled = entries.map((e) => {
    const toks = tok(e.phrase);
    const notAfter = [...(e.notAfter ?? []), ...(o.singleNotAfterSurah && toks.length === 1 ? ["سوره"] : [])].map(canonTok);
    return { ...e, toks, notAfter: notAfter.length ? notAfter : undefined, notBefore: e.notBefore?.map(canonTok) };
  });
  return (text: string): { phrase: string; group: G }[] => {
    const ts = tok(text);
    const vs = ts.map(variants);
    const hits = new Map<string, G>();
    for (const e of compiled) {
      const n = e.toks.length;
      for (let i = 0; i + n <= ts.length; i++) {
        if (!vs[i]!.includes(e.toks[0]!)) continue;
        let ok = true;
        for (let j = 1; j < n; j++) if (ts[i + j] !== e.toks[j] && !vs[i + j]!.includes(e.toks[j]!)) { ok = false; break; }
        if (!ok) continue;
        if (e.notAfter && i > 0 && vs[i - 1]!.some((x) => e.notAfter!.includes(x))) continue;
        if (e.notBefore && i + n < ts.length && vs[i + n]!.some((x) => e.notBefore!.includes(x))) continue;
        hits.set(e.phrase, e.group);
      }
    }
    return [...hits].map(([phrase, group]) => ({ phrase, group }));
  };
};

/** ذكر من لا تجوز معه شخصية في نص (للضابطة ٢)؛ كل ذكر بكلمته كما في النص المطبَّع ومجموعته */
export const sacredMentions = phraseMatcher(ENTRIES, { singleNotAfterSurah: true });

// ───────────── المشهد ─────────────

type SceneLike = Pick<PlanScene, "id" | "template" | "narration" | "props"> & Partial<Pick<PlanScene, "voice">>;

/** هل يرسم المشهد شخصًا: إعلان صريح، أو قالب فيه شخص، أو لقطة person/people، أو حقل شخصية */
export const sceneHasCharacterFigure = (s: SceneLike): boolean => {
  const p = s.props ?? {};
  if ((p.characters ?? "").trim()) return true;
  if (FIGURE_TEMPLATES.has(s.template)) return true;
  if (p.figure || p.figure2) return true;
  return parseBeats(p.beats ?? "").some((b) => b.draw.startsWith("person") || b.draw === "people");
};

const NIGHT = /(^|[^a-z])(night|dark|gloom|noir|midnight)|ليل|مظلم|قاتم|كئيب/i;
const SPEECH_PROP = /^(bubble|speech|dialogue|dialog|characterVoice|characterLine)s?$/i;

/** رسائل الضوابط الخمس لمشهد واحد في قناة تطبّقها */
export const characterSceneIssues = (s: SceneLike, plan?: Pick<Plan, "themeId">): { level: "error" | "warning"; message: string }[] => {
  if (!sceneHasCharacterFigure(s)) return [];
  const out: { level: "error" | "warning"; message: string }[] = [];
  const p = s.props ?? {};
  const { specs, issues } = parseCharacters(p.characters);
  for (const m of issues) out.push({ level: "error", message: m });
  // ٢: لا شخصية في مشهد يذكر كلامه أحدًا ممن لا يُصوَّر بأي صورة
  const named = sacredMentions(s.narration ?? "");
  if (named.length)
    out.push({ level: "error", message: err(`مشهد فيه شخصية وكلامه يذكر ${named.map((x) => `«${x.phrase}» (${x.group})`).join("، ")}: ` +
      "لا نبي ولا ملك ولا صحابي ولا أحد من آل البيت أو أمهات المؤمنين بأي صورة؛ احذف الشخصية من هذا المشهد (الكلمة أو المشهد بلا شخص).") });
  // ٤ (عدّلها D250): كلام المشهد للراوي وحده؛ قول الشخصية سطر [قول: …] في السكريبت بصوت مكتبة معتمد، لا صوت للمشهد ولا فقاعة
  if (s.voice?.trim()) out.push({ level: "error", message: err("صوت آخر لكلام هذا المشهد مرفوض؛ كلام المشهد للراوي وحده، وقول الشخصية سطر [قول: …] بصوت مكتبة معتمد (D250).") });
  if (s.template === "character-talk") out.push({ level: "error", message: err("قالب فقاعة الكلام مرفوض لشخصيات «بالإسلام»؛ قول الشخصية سطر [قول: …] يمر ببوابته (D250).") });
  for (const k of Object.keys(p)) if (SPEECH_PROP.test(k) && (p[k] ?? "").trim())
    out.push({ level: "error", message: err(`حقل «${k}» حوار أو فقاعة كلام في المشهد؛ مرفوض، قول الشخصية سطر [قول: …] في السكريبت (D250).`) });
  // ٥: نهار فاتح مبهج
  if (specs.length || !FIGURE_TEMPLATES.has(s.template)) {
    if (/(^|\s)night-lamp(\s|$)/m.test(p.lighting ?? "")) out.push({ level: "error", message: err("إضاءة الليل (night-lamp) مرفوضة في مشهد فيه شخصية؛ نهار فاتح (day-sun أو dawn-sun أو إضاءة البيت).") });
    for (const k of ["grade", "palette", "timeOfDay", "mood", "colorGrade"]) if (p[k] && NIGHT.test(p[k]!))
      out.push({ level: "error", message: err(`«${k}: ${p[k]}» تدرّج ليلي أو قاتم مرفوض في مشهد فيه شخصية؛ اللوحة النهارية: ${Object.keys(CHARACTER_PALETTE).join("، ")}.`) });
    if (plan?.themeId === "night") out.push({ level: "error", message: err("ثيم الليل مرفوض لحلقة فيها مشهد بشخصية؛ اختر ثيمًا نهاريًا فاتحًا.") });
  }
  if (!specs.length && !issues.length)
    out.push({ level: "warning", message: err("مشهد بشخصية بلا إعلان props.characters (CharacterSpec)؛ القالب القائم مسموح، والقالب الجديد بالشخصيات يعلنها إلزامًا.") });
  return out;
};

// ───────────── «دفاتر الزمن» (D249) ─────────────

/**
 * الشخصيات الثماني القائمة في «دفاتر الزمن» (`characters/HistoricFigure.tsx` ← `FigureId`): كلها مرسومة الآن بعينين
 * وحاجبين وفم يتكلم، فكلها تنتظر التحويل إلى نسخة بلا ملامح (تبقى اللحية والعمامة/القلنسوة والخوذة والثياب) أو تُعطَّل.
 * تُنقل من هنا إلى `DAFATIR_FEATURELESS_FIGURES` حين يُرسم ويُعتمد تحويلها؛ وحتى ذلك يُرفض كل مشهد يستعملها.
 */
export const DAFATIR_FIGURES = ["scholar", "commander", "merchant", "ruler", "woman", "youth", "elder", "traveler"] as const;
export const DAFATIR_FEATURELESS_FIGURES: ReadonlySet<string> = new Set<string>([]);
/** الشخصيات التي تحتاج تحويلًا قبل أي استعمال (D249) */
export const dafatirFiguresNeedingConversion = (): string[] => DAFATIR_FIGURES.filter((f) => !DAFATIR_FEATURELESS_FIGURES.has(f));

/** حلقة تذكر نبيًا أو ملَكًا أو صحابيًا أو أحدًا من آل البيت أو أمهات المؤمنين (D249: لا شخصيات ولا أصوات فيها) */
export const episodeSacredMentions = (texts: readonly string[]) => {
  const seen = new Map<string, SacredGroup>();
  for (const t of texts) for (const h of sacredMentions(t)) seen.set(h.phrase, h.group);
  return [...seen].map(([phrase, group]) => ({ phrase, group }));
};

const D249 = (m: string) => `D249: ${m}`;

/** ضوابط شخصيات «دفاتر الزمن» في الخطة: بلا ملامح، ولا شخصية أصلًا في حلقة فيها من لا يُصوَّر */
export const dafatirCharacterIssues = (plan: Pick<Plan, "chapters" | "title">): { level: "error" | "warning"; sceneId: string; message: string }[] => {
  const scenes = plan.chapters.flatMap((c) => c.scenes);
  const withFigure = scenes.filter(sceneHasCharacterFigure);
  if (!withFigure.length) return [];
  const sacred = episodeSacredMentions([plan.title ?? "", ...scenes.map((s) => s.narration ?? "")]);
  const out: { level: "error" | "warning"; sceneId: string; message: string }[] = [];
  for (const s of withFigure) {
    const p = s.props ?? {};
    if (sacred.length)
      out.push({ level: "error", sceneId: s.id, message: D249(`الحلقة تذكر ${sacred.slice(0, 4).map((x) => `«${x.phrase}» (${x.group})`).join("، ")}: ` +
        "لا شخصيات ولا أصوات ممثَّلة في حلقة فيها نبي أو ملك أو صحابي أو أحد من آل البيت أو أمهات المؤمنين؛ تبقى بأسلوب «الأفق» بلا شخصيات.") });
    for (const k of ["figure", "figure2"]) if (p[k] && !DAFATIR_FEATURELESS_FIGURES.has(p[k]!))
      out.push({ level: "error", sceneId: s.id, message: D249(`الشخصية «${p[k]}» مرسومة بملامح (عينان وحاجبان وفم)؛ تُحوَّل إلى نسخة بلا عينين ولا أنف ولا فم (تبقى اللحية والعمامة والخوذة والثياب) أو تُعطَّل قبل أي رندر.`) });
    if (s.voice?.trim()) out.push({ level: "error", sceneId: s.id, message: D249("صوت آخر لكلام هذا المشهد مرفوض؛ كلام المشهد للراوي وحده، وقول الشخصية سطر [قول: …] بصوت مكتبة معتمد.") });
    if (s.template === "character-talk") out.push({ level: "error", sceneId: s.id, message: D249("قالب فقاعة الكلام مرفوض؛ قول الشخصية سطر [قول: …] في السكريبت يمر ببوابته.") });
    for (const m of parseCharacters(p.characters, { palette: false, decision: "D249" }).issues) out.push({ level: "error", sceneId: s.id, message: m });
  }
  return out;
};

/** أخطاء ضوابط الشخصيات في خطة: «بالإسلام» (D248/D250) و«دفاتر الزمن» (D249)، مشهدًا مشهدًا */
export const characterPolicyIssues = (plan: Pick<Plan, "channel" | "chapters" | "themeId"> & Partial<Pick<Plan, "title">>, channelId?: string): { level: "error" | "warning"; sceneId: string; message: string }[] => {
  const ch = channelId ?? plan.channel;
  if (ch === "dafatir-alzaman") return dafatirCharacterIssues({ chapters: plan.chapters, title: plan.title ?? "" });
  if (!ch || !CHARACTER_POLICY_CHANNELS.has(ch)) return [];
  return plan.chapters.flatMap((c) => c.scenes).flatMap((s) => characterSceneIssues(s, plan).map((i) => ({ ...i, sceneId: s.id })));
};

/** يمنع الرندر والإرسال لجهاز الرندر إن خالف مشهد بشخصية ضوابط D248/D250 في «بالإسلام» أو D249 في «دفاتر الزمن» */
export const assertCharacterPolicy = (plan: Pick<Plan, "channel" | "chapters" | "themeId"> & Partial<Pick<Plan, "title">>, channelId?: string): void => {
  const bad = characterPolicyIssues(plan, channelId).filter((i) => i.level === "error");
  if (bad.length) throw new Error(bad.map((b) => `${b.sceneId}: ${b.message}`).join("\n"));
};
