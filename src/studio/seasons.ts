/**
 * مواسم السنة الهجرية (عمود «بالإسلام»، عاشرًا/٦؛ قرار المالك ٢٣ نوفمبر): جدول لكل قناة في `channels/<القناة>/seasons.json`
 * (محتوى مالك يحفظه الاستوديو في main، D101). كل القنوات تقرؤه، و«بالإسلام» أولها.
 *
 * - **المواسم المتفق عليها وحدها:** رمضان، والعشر من ذي الحجة، ويوم عرفة، والحج، ورأس السنة الهجرية، وعاشوراء.
 *   لا تُضاف مناسبة مختلف في مشروعيتها (الفحص يرفض أي نوع آخر).
 * - **التاريخ:** الهجري هو الأصل، والميلادي حسابه بتقويم أم القرى (`islamic-umalqura`) للتخطيط؛ وبداية الشهر الفعلية
 *   برؤية الهلال، فيُسمح بفرق يومين.
 * - **«جاهز قبل»:** ستة أسابيع على الأقل قبل الموسم (السكريبت والمراجعة والصوت والرندر). تاريخ أبعد منها قرار مالك
 *   يُكتب سببه في `readyByNote`.
 * - **حلقات الموسم:** خانات بعناوينها (تُكتب بعد اعتماد المالك) وموعد نشرها ورقم الحلقة حين تُنشأ؛ وسلاسل الشورتس اليومية.
 * - النصوص التي قد تُنشر (العناوين) تمر على فحص الآثار (القاعدة الأولى).
 */
import { findTraces } from "../package/traces";

export const SEASON_KINDS = ["ramadan", "dhul-hijja-ten", "arafah", "hajj", "hijri-new-year", "ashura"] as const;
export type SeasonKind = (typeof SEASON_KINDS)[number];
export const SEASON_NAMES: Record<SeasonKind, string> = {
  ramadan: "رمضان",
  "dhul-hijja-ten": "العشر من ذي الحجة",
  arafah: "يوم عرفة",
  hajj: "الحج",
  "hijri-new-year": "رأس السنة الهجرية",
  ashura: "عاشوراء",
};
/** حدود كل موسم بالشهر واليوم الهجري: [شهر البداية، يومها، شهر النهاية، يومها] (النهاية null = آخر الشهر) */
export const SEASON_SPAN: Record<SeasonKind, [number, number, number, number | null]> = {
  ramadan: [9, 1, 9, null],
  "dhul-hijja-ten": [12, 1, 12, 10],
  arafah: [12, 9, 12, 9],
  hajj: [12, 8, 12, 13],
  "hijri-new-year": [1, 1, 1, 1],
  ashura: [1, 10, 1, 10],
};
/** أقل مدة تجهيز قبل الموسم (العمود: ستة أسابيع على الأقل) */
export const PREP_WEEKS = 6;
/** فرق رؤية الهلال المسموح بين الحساب والتاريخ المكتوب (أيام) */
export const SIGHTING_DAYS = 2;

export type SeasonSlot = {
  slot: number;
  /** عنوان الحلقة بعد اعتماد المالك (فارغ حتى يُعتمد) */
  title: string;
  /** موعد النشر المخطط (YYYY-MM-DD) */
  publishOn?: string;
  /** رقم الحلقة حين تُنشأ في الاستوديو */
  episode?: string;
};
export type SeasonShorts = { name: string; count: number; status?: string };
export type Season = {
  id: string;
  kind: SeasonKind;
  hijriYear: number;
  /** بالصيغة YYYY-MM-DD هجريًا */
  hijri: { from: string; to: string };
  /** بالصيغة YYYY-MM-DD ميلاديًا (حساب أم القرى) */
  gregorian: { from: string; to: string };
  /** التجهيز جاهز قبل هذا التاريخ */
  readyBy: string;
  /** سبب «جاهز قبل» إن كان بقرار المالك لا بقاعدة الأسابيع الستة */
  readyByNote?: string;
  episodes: SeasonSlot[];
  shorts?: SeasonShorts[];
  note?: string;
};
export type Seasons = { version: 1; seasons: Season[] };

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ID_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;
const DAY = 86_400_000;
const utc = (s: string) => Date.parse(`${s}T00:00:00Z`);
export const isDate = (s: unknown): s is string => typeof s === "string" && DATE_RE.test(s) && !Number.isNaN(utc(s)) && new Date(utc(s)).toISOString().slice(0, 10) === s;
export const addDays = (s: string, n: number) => new Date(utc(s) + n * DAY).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) => Math.round((utc(b) - utc(a)) / DAY);
const pad = (n: number) => String(n).padStart(2, "0");

/** التاريخ الهجري لتاريخ ميلادي بتقويم أم القرى: [سنة، شهر، يوم] */
export const hijriOf = (gregorian: string): [number, number, number] => {
  const f = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", { year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC" });
  const p = Object.fromEntries(f.formatToParts(new Date(utc(gregorian))).map((x) => [x.type, x.value]));
  return [parseInt(p.year!, 10), parseInt(p.month!, 10), parseInt(p.day!, 10)];
};
/** الميلادي ليوم هجري بتقويم أم القرى (بحث في نطاق السنة؛ null إن لم يوجد اليوم، كيوم ٣٠ في شهر من ٢٩) */
export const gregorianOf = (y: number, m: number, d: number): string | null => {
  // تقريب: السنة الهجرية ٣٥٤٫٣٧ يومًا، وأول محرم ١ هـ = ١٦ يوليو ٦٢٢م
  const approx = Date.UTC(622, 6, 16) + ((y - 1) * 354.367 + (m - 1) * 29.53 + (d - 1)) * DAY;
  for (let k = -20; k <= 20; k++) {
    const g = new Date(approx + k * DAY).toISOString().slice(0, 10);
    const [hy, hm, hd] = hijriOf(g);
    if (hy === y && hm === m && hd === d) return g;
  }
  return null;
};
/** حدود موسم في سنة هجرية بحساب أم القرى */
export const seasonDates = (kind: SeasonKind, year: number) => {
  const [m1, d1, m2, d2] = SEASON_SPAN[kind];
  const lastDay = d2 ?? (gregorianOf(year, m2, 30) ? 30 : 29);
  const from = gregorianOf(year, m1, d1)!;
  const to = gregorianOf(year, m2, lastDay)!;
  return { hijri: { from: `${year}-${pad(m1)}-${pad(d1)}`, to: `${year}-${pad(m2)}-${pad(lastDay)}` }, gregorian: { from, to } };
};
/** «جاهز قبل» بقاعدة الأسابيع الستة */
export const ruleReadyBy = (gregorianFrom: string) => addDays(gregorianFrom, -7 * PREP_WEEKS);

const traceIssues = (where: string, ...texts: (string | undefined)[]) =>
  texts.flatMap((t) => (t ? findTraces(t).map((h) => `${where}: أثر لأدوات الإنتاج «${h}» (القاعدة الأولى).`) : []));

export const seasonIssues = (s: Season): string[] => {
  if (!s || typeof s !== "object") return ["موسم غير صالح."];
  const w = `الموسم ${s.id ?? "؟"}`;
  const out: string[] = [];
  if (!ID_RE.test(s.id ?? "")) out.push(`${w}: المعرّف غير صالح.`);
  if (!SEASON_KINDS.includes(s.kind)) return [...out, `${w}: ليس من المواسم المتفق عليها (${Object.values(SEASON_NAMES).join("، ")}).`];
  if (!Number.isInteger(s.hijriYear) || s.hijriYear < 1440 || s.hijriYear > 1500) out.push(`${w}: السنة الهجرية غير صالحة.`);
  const hy = (x: string | undefined) => /^(\d{4})-(\d{2})-(\d{2})$/.exec(x ?? "");
  const [m1, d1, m2, d2] = SEASON_SPAN[s.kind];
  const a = hy(s.hijri?.from), b = hy(s.hijri?.to);
  if (!a || +a[1]! !== s.hijriYear || +a[2]! !== m1 || +a[3]! !== d1) out.push(`${w}: بداية ${SEASON_NAMES[s.kind]} الهجرية ${s.hijriYear}-${pad(m1)}-${pad(d1)}.`);
  if (!b || +b[1]! !== s.hijriYear || +b[2]! !== m2 || (d2 === null ? !(+b[3]! === 29 || +b[3]! === 30) : +b[3]! !== d2))
    out.push(`${w}: نهاية ${SEASON_NAMES[s.kind]} الهجرية غير صحيحة.`);
  if (!isDate(s.gregorian?.from) || !isDate(s.gregorian?.to)) out.push(`${w}: التاريخ الميلادي (من، إلى) مطلوب.`);
  else {
    if (s.gregorian.to < s.gregorian.from) out.push(`${w}: النهاية قبل البداية.`);
    const calc = gregorianOf(s.hijriYear, m1, d1);
    if (calc && Math.abs(daysBetween(calc, s.gregorian.from)) > SIGHTING_DAYS) out.push(`${w}: البداية الميلادية بعيدة عن حساب أم القرى (${calc}).`);
    if (!isDate(s.readyBy)) out.push(`${w}: «جاهز قبل» مطلوب.`);
    else {
      if (s.readyBy >= s.gregorian.from) out.push(`${w}: «جاهز قبل» يجب أن يسبق بداية الموسم.`);
      if (s.readyBy > ruleReadyBy(s.gregorian.from) && !s.readyByNote?.trim())
        out.push(`${w}: «جاهز قبل» أقل من ${PREP_WEEKS} أسابيع قبل الموسم؛ اكتب قرار المالك في «سبب الموعد».`);
    }
  }
  if (!Array.isArray(s.episodes)) out.push(`${w}: خانات الحلقات قائمة.`);
  for (const e of Array.isArray(s.episodes) ? s.episodes : []) {
    const we = `${w}، الحلقة ${e?.slot ?? "؟"}`;
    if (!Number.isInteger(e?.slot) || e.slot < 1) out.push(`${we}: رقم الخانة غير صالح.`);
    if (typeof e?.title !== "string") out.push(`${we}: العنوان نص (فارغ حتى يُعتمد).`);
    if (e?.publishOn !== undefined && !isDate(e.publishOn)) out.push(`${we}: موعد النشر غير صالح.`);
    if (e?.episode !== undefined && !/^\d{3}$/.test(e.episode)) out.push(`${we}: رقم الحلقة ثلاث خانات.`);
    out.push(...traceIssues(we, e?.title));
  }
  const slots = (s.episodes ?? []).map((e) => e?.slot);
  if (new Set(slots).size !== slots.length) out.push(`${w}: رقم خانة مكرر.`);
  for (const sh of s.shorts ?? []) {
    if (!sh?.name?.trim() || !Number.isInteger(sh.count) || sh.count < 1 || sh.count > 60) out.push(`${w}: سلسلة شورتس تحتاج اسمًا وعددًا بين ١ و٦٠.`);
    out.push(...traceIssues(w, sh?.name));
  }
  return [...out, ...traceIssues(w, s.note, s.readyByNote)];
};

export const seasonsIssues = (doc: Seasons | null): string[] => {
  if (!doc) return [];
  if (doc.version !== 1 || !Array.isArray(doc.seasons)) return ["جدول المواسم: الصيغة غير صالحة."];
  const ids = doc.seasons.map((s) => s?.id);
  const out = ids.filter((x, i) => ids.indexOf(x) !== i).map((x) => `جدول المواسم: المعرّف «${x}» مكرر.`);
  for (const s of doc.seasons) out.push(...seasonIssues(s));
  return out;
};

export type SeasonView = Season & {
  name: string;
  /** أيام حتى بداية الموسم (سالب = بدأ أو انتهى) */
  daysToStart: number;
  /** أيام حتى «جاهز قبل» */
  daysToReady: number;
  ruleReadyBy: string;
  state: "upcoming" | "running" | "past";
};
/** ما تعرضه الشاشة: الاسم والعدّ التنازلي وحالة الموسم، مرتبة بالأقرب */
export const seasonViews = (doc: Seasons, today: string): SeasonView[] =>
  doc.seasons.map((s) => ({
    ...s,
    name: SEASON_NAMES[s.kind] ?? s.kind,
    daysToStart: daysBetween(today, s.gregorian.from),
    daysToReady: daysBetween(today, s.readyBy),
    ruleReadyBy: ruleReadyBy(s.gregorian.from),
    state: (today < s.gregorian.from ? "upcoming" : today <= s.gregorian.to ? "running" : "past") as SeasonView["state"],
  })).sort((a, b) => a.gregorian.from.localeCompare(b.gregorian.from));
