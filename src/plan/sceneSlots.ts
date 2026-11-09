/**
 * «إعدادات المشهد» كما يراها المالك (D56): ما يظهر من حقول القالب، ولحظات ظهور العناصر بالنقر على كلمات الجملة،
 * والعبارات المختارة من الجملة نفسها. كل ذلك من تصريحات القالب ومشهده (templates.ts وواجهة كل مشهد)، بلا فرع بالقناة.
 *
 * التخزين لم يتغير: المرسى يُكتب «كلمة» أو «كلمة#ن» بالصيغة التي يقرؤها الرسم نفسه، وأسطر «المفتاح | الكلمة»
 * تُعدَّل سطرًا سطرًا فلا يتغير ما لم يلمسه المالك (فتح مشهد وحفظه بلا تعديل يعطي الخطة نفسها بايتًا ببايت).
 * دوال صافية: بلا React ولا ملفات.
 */
import { normalizeArabic } from "../script/quranMeta";

export type Props = Record<string, string | undefined>;

/**
 * طريقة مطابقة الكلمة كما في الرسم نفسه:
 * - ink: مشاهد الحبر (makeAt في inkKit): تطابق تامّ بعد التطبيع، وتقبل السوابق و ف ب ل وب ول.
 * - prefix: دفتر الأفق (at في horizon/timeline): الكلمة التي تبدأ بالمرسى بعد حذف الحركات.
 * - first: أحداث المشاهد المصوَّرة (cueFrames): أول نطق للكلمة نفسها، بلا «#ن».
 */
export type MatchMode = "ink" | "prefix" | "first";

export type AnchorSlot = {
  /** المفتاح في سطر «المفتاح | الكلمة» أو اسم الحقل (يظهر في التلميح وحده) */
  key: string;
  /** الاسم للمالك */
  label: string;
  /** لا يقع الحدث بلا كلمته (ولا كلمة تلقائية له) */
  required?: boolean;
  /** الكلمة التي يقع عندها الحدث إن لم يُحدَّد له مرسى (أول كلمة من عبارته) */
  fallback?: string;
  /** للحدث نهاية تُحدَّد أيضًا («المفتاح.end»): نهاية الكتابة */
  end?: boolean;
  /** الكلمة التلقائية للنهاية */
  endFallback?: string;
};

export type PhraseSpec = { min: number; max: number; name: (i: number, n: number) => string };

/** ما يعلنه مشهد مصمَّم لمحرر المشهد */
export type ShotUi = {
  /** اسم قصير للبطاقة (وإلا يُشتق من اسم المشهد) */
  title?: string;
  /** سطر واحد بما يعرضه */
  line?: string;
  /** حقول القالب التي يقرؤها هذا المشهد (غير حقل المشهد نفسه والحقول العامة) */
  fields?: string[];
  /** لحظات الظهور التي يقرؤها من حقل «التوقيت» */
  slots?: (p: Props) => AnchorSlot[];
  /** العبارات المكتوبة على الشاشة (حقل العبارات) */
  phrases?: PhraseSpec;
  /** مشهد الخاتمة */
  closing?: boolean;
  /** من مكتبة القناة القابلة لإعادة الاستعمال (لا خاص بحلقة) */
  library?: boolean;
};

// ── الكلمات ──────────────────────────────────────────────────────────────

/** الحركات والتطويل كما يحذفها normalizeArabic، فالمرسى المخزَّن يطابق الكلمة في الرسم حرفًا بحرف */
const TASHKEEL = /[\u064B-\u0652\u0670\u0640]/g;
const PUNCT_INK = /[«»"“”'؟?!.,،:؛…ـ()]/g;
const PUNCT_HZ = /[،,.:؛«»"()]/g;

export type Token = { i: number; raw: string };
/** كلمات الجملة كما تُنطق (علامة الوقفة «|» ليست كلمة) */
export const sentenceTokens = (narration: string): Token[] =>
  narration
    .split(/\s+/)
    .filter((w) => w && w !== "|")
    .map((raw, i) => ({ i, raw }));

/** الكلمة للعرض: بحركاتها، بلا علامات ترقيم على طرفيها */
export const displayWord = (raw: string) => raw.replace(/^[«»"“”'(]+|[«»"“”'؟?!.,،:؛…)]+$/g, "");

/** الكلمة كما تُخزَّن مرسى: بلا حركات ولا علامات ترقيم */
export const plainWord = (raw: string) => raw.replace(PUNCT_INK, "").replace(TASHKEEL, "").trim();

const inkKey = (w: string) => normalizeArabic(w.replace(PUNCT_INK, ""));
const hzKey = (w: string) => w.replace(PUNCT_HZ, "").replace(/[ً-ْٰ]/g, "");
const INK_PRE_AT = ["", "و", "ف", "ب", "ل", "وب", "ول"];
const INK_PRE_END = ["", "و", "ف", "ب", "ل"];

/** هل تطابق كلمةُ الجملة raw المرسى word بطريقة الرسم نفسها؟ */
export const wordMatches = (mode: MatchMode, word: string, raw: string, end = false): boolean => {
  if (mode === "prefix") {
    const p = hzKey(word);
    return p.length > 0 && hzKey(raw).startsWith(p);
  }
  const k = inkKey(word);
  if (!k) return false;
  const w = inkKey(raw);
  if (mode === "first") return w === k;
  return (end ? INK_PRE_END : INK_PRE_AT).some((pre) => w === pre + k);
};

/** «كلمة#٢» ← [كلمة، ٢] */
export const parseAnchor = (value: string): [string, number] => {
  const [w, n] = value.split("#");
  return [(w ?? "").trim(), n ? Math.max(1, Number(n) || 1) : 1];
};

/** موضع الكلمة في الجملة التي يقع عندها المرسى، أو -1 إن لم تكن فيها */
export const resolveAnchor = (tokens: Token[], value: string, mode: MatchMode, end = false, allowNth = true): number => {
  const [w, nth0] = parseAnchor(value);
  const nth = allowNth ? nth0 : 1;
  if (!w) return -1;
  let n = 0;
  for (const t of tokens) {
    if (!wordMatches(mode, w, t.raw, end)) continue;
    n++;
    if (n === (mode === "first" ? 1 : nth)) return t.i;
  }
  return -1;
};

/**
 * المرسى الذي يقع عند الكلمة رقم i بالضبط (الكلمة المكررة تأخذ «#ن» تلقائيًا).
 * يُبنى بحيث يعيده resolveAnchor إلى الكلمة نفسها؛ وفي «first» لا «#ن»: الحدث يقع عند أول نطق للكلمة.
 */
export const anchorFor = (tokens: Token[], i: number, mode: MatchMode, end = false, nth = true): string => {
  const t = tokens[i];
  if (!t) return "";
  const word = mode === "first" ? t.raw.replace(/[«»"“”'؟?!.,،:؛…]/g, "") : mode === "prefix" ? hzKey(t.raw).replace(/[؟?!…]+$/, "") : plainWord(t.raw);
  if (mode === "first" || !nth) return word;
  let n = 0;
  for (const x of tokens.slice(0, i + 1)) if (wordMatches(mode, word, x.raw, end)) n++;
  return n > 1 ? `${word}#${n}` : word;
};

// ── أسطر «المفتاح | الكلمة» ───────────────────────────────────────────────

export type Line = { key: string; value: string };
/** الأسطر كما هي (السطر الذي لا مفتاح فيه يبقى في مكانه ولا يُعرض) */
export const parseLines = (text: string | undefined): Line[] =>
  (text ?? "")
    .split("\n")
    .map((l) => l.split("|").map((s) => s.trim()))
    .filter((p) => p.length >= 2 && p[0] && p[1])
    .map((p) => ({ key: p[0]!, value: p[1]! }));

/** قيمة المفتاح في الأسطر (آخر سطر يغلب، كما في parseInkArgs) */
export const lineValue = (text: string | undefined, key: string): string => {
  let v = "";
  for (const l of parseLines(text)) if (l.key === key) v = l.value;
  return v;
};

/**
 * يضع قيمة مفتاح واحد ويترك كل سطر آخر حرفيًا كما هو (بترتيبه ومسافاته).
 * value فارغة تحذف سطر المفتاح.
 */
export const setLine = (text: string | undefined, key: string, value: string): string => {
  const src = text ?? "";
  const lines = src === "" ? [] : src.split("\n");
  const isKey = (l: string) => l.split("|")[0]?.trim() === key && (l.split("|")[1] ?? "").trim() !== "";
  const at = lines.map((l, i) => (isKey(l) ? i : -1)).filter((i) => i >= 0);
  const line = `${key} | ${value}`;
  if (!value) return lines.filter((_, i) => !at.includes(i)).join("\n");
  if (!at.length) return [...lines, line].join("\n");
  // السطر الأخير للمفتاح هو الفاعل (parseInkArgs): يُستبدل وحده، وما قبله لا أثر له فيبقى كما هو
  const last = at[at.length - 1]!;
  return lines.map((l, i) => (i === last ? line : l)).join("\n");
};

/** أسطر الأحداث (يجوز تكرار المعنى): تعديل سطر برقمه وحده */
export const eventLines = (text: string | undefined): { idx: number; key: string; value: string }[] =>
  (text ?? "").split("\n").flatMap((l, idx) => {
    const p = l.split("|").map((s) => s.trim());
    return p.length >= 2 && p[0] && p[1] ? [{ idx, key: p[0], value: p[1] }] : [];
  });
export const setEventLine = (text: string | undefined, idx: number | null, key: string, value: string): string => {
  const lines = (text ?? "") === "" ? [] : (text ?? "").split("\n");
  if (idx === null) return [...lines, `${key} | ${value}`].join("\n");
  if (!value) return lines.filter((_, i) => i !== idx).join("\n");
  return lines.map((l, i) => (i === idx ? `${key} | ${value}` : l)).join("\n");
};

// ── العبارات ──────────────────────────────────────────────────────────────

export const parsePhrases = (text: string | undefined) => (text ?? "").split("|").map((s) => s.trim()).filter(Boolean);
export const joinPhrases = (list: string[]) => list.join(" | ");
/** عبارة من الكلمات a..b كما تُكتب على الشاشة (بلا حركات ولا علامات ترقيم على طرفيها) */
export const phraseFrom = (tokens: Token[], a: number, b: number): string => {
  const [x, y] = a <= b ? [a, b] : [b, a];
  return tokens
    .slice(x, y + 1)
    .map((t) => plainWord(t.raw))
    .filter(Boolean)
    .join(" ");
};
/** هل العبارة منطوقة حرفيًا (كلمات متتالية) في جملة المشهد؟ */
export const phraseSpoken = (narration: string, phrase: string): boolean => {
  const words = phrase.split(/\s+/).map(inkKey).filter(Boolean);
  if (!words.length) return false;
  const toks = sentenceTokens(narration).map((t) => inkKey(t.raw));
  for (let i = 0; i + words.length <= toks.length; i++) if (words.every((w, k) => toks[i + k] === w || INK_PRE_AT.some((p) => toks[i + k] === p + w))) return true;
  return false;
};

export const firstWord = (s: string) => s.trim().split(/\s+/)[0] ?? "";
export const lastWord = (s: string) => s.trim().split(/\s+/).at(-1) ?? "";

// ── ما يظهر من الحقول ─────────────────────────────────────────────────────

/** ما يحتاجه المحرر من تعريف القالب (من templates.ts) */
export type SlotField = {
  key: string;
  label: string;
  type: string;
  options?: { value: string; label: string }[];
  ui?: "shot" | "anchor-lines" | "anchor" | "phrases" | "events";
  match?: MatchMode;
  slot?: string;
  fallbackFrom?: string;
  common?: boolean;
  closing?: boolean;
  keepIfSet?: boolean;
  /** الرسم لا يقرأ «#ن» في هذا الحقل: يقع الحدث عند أول نطق للكلمة */
  firstOnly?: boolean;
};
export type SlotTemplate = { fields: SlotField[]; shots?: Record<string, ShotUi>; shotFields?: string[] };

export const shotField = <F extends SlotField>(def: { fields: F[] }): F | undefined => def.fields.find((f) => f.ui === "shot");
export const shotUiOf = (def: SlotTemplate, shot: string | undefined): ShotUi => (shot && def.shots?.[shot]) || {};

/**
 * الحقول الظاهرة والحقول التي لا يستعملها المشهد المختار (تبقى في «المزيد» فلا يضيع شيء).
 * قالب بلا «مشهد» يعرض حقوله كلها كما كان. وحقل الخاتمة لا يظهر إلا في مشهد الخاتمة.
 */
export const visibleFields = <F extends SlotField>(def: { fields: F[]; shots?: Record<string, ShotUi>; shotFields?: string[] }, props: Props, ctx: { closing: boolean }) => {
  const picker = shotField(def);
  const shot = picker ? String(props[picker.key] ?? "") : "";
  const ui = shotUiOf(def, shot);
  const closing = ctx.closing || Boolean(ui.closing);
  const declared = new Set(ui.fields ?? (picker && shot ? def.shotFields ?? [] : def.fields.map((f) => f.key)));
  const shown: F[] = [];
  const other: F[] = [];
  for (const f of def.fields) {
    const set = Boolean(String(props[f.key] ?? "").trim());
    let ok: boolean;
    if (f === picker) ok = true;
    else if (f.closing) ok = closing || declared.has(f.key);
    else ok = Boolean(f.common) || declared.has(f.key) || (Boolean(f.keepIfSet) && set);
    (ok ? shown : other).push(f);
  }
  return { shown, other };
};

/** صف لحظة ظهور واحد في المحرر */
export type SlotRow = AnchorSlot & {
  /** الحقل الذي يُخزَّن فيه */
  field: string;
  /** سطر في حقل أسطر، أو الحقل نفسه */
  store: "line" | "field";
  match: MatchMode;
  /** يقبل «كلمة#ن» (الكلمة المكررة) */
  nth: boolean;
  /** القيمة المخزنة الآن ("" بلا مرسى) */
  value: string;
};

/** لحظات الظهور التي يعلنها المشهد المختار وحقوله الظاهرة، بقيمها الحالية */
export const slotRows = (def: SlotTemplate, props: Props, shown: SlotField[]): SlotRow[] => {
  const picker = shotField(def);
  const ui = shotUiOf(def, picker ? props[picker.key] : undefined);
  const rows: SlotRow[] = [];
  const lines = shown.find((f) => f.ui === "anchor-lines");
  if (lines && ui.slots) {
    const text = props[lines.key];
    for (const s of ui.slots(props)) {
      const base = { field: lines.key, store: "line" as const, match: lines.match ?? "ink", nth: !lines.firstOnly && lines.match !== "first" };
      rows.push({ ...s, ...base, value: lineValue(text, s.key) });
      if (s.end) rows.push({ key: `${s.key}.end`, label: `نهاية ${s.label}`, fallback: s.endFallback, ...base, value: lineValue(text, `${s.key}.end`) });
    }
  }
  for (const f of shown)
    if (f.ui === "anchor") {
      const src = f.fallbackFrom ? String(props[f.fallbackFrom] ?? "") : "";
      rows.push({ key: f.key, label: f.slot ?? f.label, fallback: src ? firstWord(src) : undefined, field: f.key, store: "field", match: f.match ?? "prefix", nth: !f.firstOnly && f.match !== "first", value: String(props[f.key] ?? "") });
    }
  return rows;
};

/** يكتب مرسى صف واحد في الحقول (ولا يلمس غيره) */
export const writeSlot = (props: Props, row: Pick<SlotRow, "key" | "field" | "store">, value: string): Props =>
  row.store === "field" ? { ...props, [row.field]: value } : { ...props, [row.field]: setLine(props[row.field], row.key, value) };

/** حال الصف للمالك */
export type SlotState = { at: number; auto: boolean; missing: boolean; stray: boolean };
export const slotState = (tokens: Token[], row: SlotRow): SlotState => {
  const end = row.key.endsWith(".end");
  if (row.value) {
    const at = resolveAnchor(tokens, row.value, row.match, end && row.match === "ink", row.nth);
    return { at, auto: false, missing: false, stray: at < 0 };
  }
  const at = row.fallback ? resolveAnchor(tokens, row.fallback, row.match, end && row.match === "ink", row.nth) : -1;
  return { at, auto: at >= 0, missing: Boolean(row.required) && at < 0, stray: false };
};

/** اسم مختصر للبطاقة وسطرها من اسم المشهد إن لم يعلنهما */
export const shotCardText = (nameAr: string, ui: ShotUi): { title: string; line: string } => {
  if (ui.title) return { title: ui.title, line: ui.line ?? "" };
  let s = nameAr.replace(/^(مكتبة|أداة)\s*[·:]\s*/, "").trim();
  const paren = /\s*\(([^)]*)\)\s*$/.exec(s);
  let note = "";
  if (paren) {
    s = s.slice(0, paren.index).trim();
    note = /[A-Za-z|]/.test(paren[1]!) ? "" : paren[1]!;
  }
  const cut = s.search(/[:：]/);
  if (cut > 0) return { title: s.slice(0, cut).trim(), line: ui.line ?? s.slice(cut + 1).trim() };
  return { title: s, line: ui.line ?? note };
};
