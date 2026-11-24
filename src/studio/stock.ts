/**
 * «بناء المخزون» (D213، قرار المالك ٢٤ نوفمبر): ترتيب النشر لكل قناة (D168) ودفعات المراجعة الأسبوعية.
 *
 * - الملف `channels/<القناة>/stock.json` محتوى مالك (يحفظه الاستوديو في main وتفحصه بوابة المحتوى).
 * - **ترتيب لا مواعيد:** رقم الأسبوع ويوم القناة وحدهما؛ النشر يبدأ بعد اعتماد المالك للشكل و«دفاتر الزمن 001»
 *   ومراجعة المتخصص. لذلك لا تاريخ ميلادي في الملف.
 * - **الدفعة:** كل أسبوع دفعة في PR واحد؛ رقم الدفعة على كل خانة، وتُجمع بها الحلقات في صفحة «بانتظارك».
 * - **مسودة:** سكريبت ترويسته `status: "مسودة"` لا يدخل الإنتاج (لا صوت ولا رندر)، وكذلك القناة المجمّدة (`frozen`، D211).
 *
 * نقي بلا نظام ملفات: القراءة والحفظ في stockStore.ts.
 */

import { seriesIdIssue } from "../channel/series";

export const DRAFT_STATUS = "مسودة";
/** أيام النشر (D168): السبت بالإسلام، والاثنين دفاتر الزمن، والأربعاء زبدة الكتب */
export const CHANNEL_DAY: Record<string, string> = { balislam: "السبت", "dafatir-alzaman": "الاثنين", "zubdat-alkutub": "الأربعاء" };

export type StockSlot = {
  /** رقم الأسبوع في المرحلة (ترتيب لا موعد) */
  week: number;
  title: string;
  /** معرّف السلسلة المسجّل في الاستوديو وحده (D215)؛ اسمها العربي من سجل السلاسل */
  series?: string;
  /** رقم الحلقة (ثلاث خانات) حين يوجد مجلدها؛ وبدونه خانة مخططة */
  episode?: string;
  /** رقم الدفعة (PR المراجعة الأسبوعي) */
  batch: number;
  /** بنود المتخصص لهذه الحلقة (عناوين قصيرة)؛ فارغة = لا يحتاج */
  specialist?: string[];
  note?: string;
};
export type Stock = {
  version: 1;
  phase: number;
  /** D211: تجميد إنتاج الفيديو في القناة (لا رندر ولا صوت)؛ العمل المكتوب مستمر */
  frozen?: { decision: string; note?: string };
  slots: StockSlot[];
};

const EP = /^\d{3}$/;

/** D215: مع قائمة سلاسل القناة المسجّلة، سلسلة كل خانة معرّف منها وحده (لا اسم عرض ولا معرّف غير مسجّل) */
export const stockIssues = (s: Stock | null | undefined, series?: readonly { id: string; name: string }[]): string[] => {
  const out: string[] = [];
  if (!s || s.version !== 1 || !Array.isArray(s.slots)) return ["ترتيب النشر: الصيغة غير صالحة."];
  if (!Number.isInteger(s.phase) || s.phase < 1) out.push("ترتيب النشر: رقم المرحلة غير صالح.");
  if (s.frozen && (typeof s.frozen.decision !== "string" || !s.frozen.decision.trim())) out.push("التجميد: اذكر القرار.");
  const eps = new Set<string>();
  s.slots.forEach((x, i) => {
    const at = `الخانة ${i + 1}`;
    if (!Number.isInteger(x.week) || x.week < 1 || x.week > 52) out.push(`${at}: رقم الأسبوع غير صالح.`);
    if (typeof x.title !== "string" || !x.title.trim()) out.push(`${at}: العنوان فارغ.`);
    if (!Number.isInteger(x.batch) || x.batch < 0) out.push(`${at}: رقم الدفعة غير صالح.`);
    if (x.episode !== undefined) {
      if (!EP.test(x.episode)) out.push(`${at}: رقم الحلقة يجب أن يكون ثلاث خانات.`);
      else if (eps.has(x.episode)) out.push(`${at}: الحلقة ${x.episode} مكررة في الترتيب.`);
      else eps.add(x.episode);
    }
    if (x.specialist !== undefined && (!Array.isArray(x.specialist) || x.specialist.some((t) => typeof t !== "string" || !t.trim())))
      out.push(`${at}: بنود المتخصص يجب أن تكون نصوصًا.`);
    if (series && x.series !== undefined) {
      const problem = seriesIdIssue(x.series, series);
      if (problem) out.push(`${at}: ${problem}`);
    }
    for (const k of Object.keys(x)) if (/date|on$|At$/i.test(k)) out.push(`${at}: لا تواريخ في ترتيب النشر (ترتيب لا مواعيد): «${k}».`);
  });
  return out;
};

/** حالة سكريبت الحلقة من ترويسته */
export const isDraftStatus = (status: unknown): boolean => typeof status === "string" && status.trim() === DRAFT_STATUS;

/**
 * لماذا يُمنع الإنتاج (صوت أو رندر) لهذه الحلقة الآن؛ null = لا مانع من هذه الجهة.
 * المسودة أولًا (لكل القنوات)، ثم تجميد القناة.
 */
export const productionRefusal = (o: { status?: unknown; frozen?: Stock["frozen"] }): string | null => {
  if (isDraftStatus(o.status))
    return "هذه الحلقة «مسودة» (بناء المخزون): لا صوت ولا رندر قبل اعتماد المالك للسكريبت ومراجعة المتخصص وتغيير حالتها.";
  if (o.frozen) return `إنتاج الفيديو في هذه القناة مجمّد بقرار المالك (${o.frozen.decision}): لا رندر ولا صوت، والعمل المكتوب مستمر.`;
  return null;
};

export type StockEpisodeView = {
  channel: string;
  week: number | null;
  day: string;
  title: string;
  series?: string;
  /** اسم السلسلة العربي من سجل القناة للعرض (D215)؛ يُضاف عند القراءة */
  seriesName?: string;
  episode?: string;
  dir?: string;
  batch: number | null;
  draft: boolean;
  exists: boolean;
  files: { script: boolean; research: boolean; scenes: boolean; publish: boolean };
  specialist: string[];
  approval: { approved: boolean; at?: string; stale?: boolean };
  note?: string;
};

export type EpisodeFacts = {
  number: string;
  dir: string;
  title: string;
  status?: unknown;
  series?: string;
  files: StockEpisodeView["files"];
  approval: StockEpisodeView["approval"];
};

/**
 * يدمج ترتيب النشر مع الحلقات الموجودة: كل خانة بحلقتها إن وُجدت، وكل مسودة ليست في الترتيب تظهر بلا أسبوع
 * (حتى لا تختفي عن المالك).
 */
export const stockViews = (channel: string, stock: Stock, episodes: EpisodeFacts[]): StockEpisodeView[] => {
  const byNum = new Map(episodes.map((e) => [e.number, e]));
  const day = CHANNEL_DAY[channel] ?? "";
  const seen = new Set<string>();
  const views: StockEpisodeView[] = stock.slots
    .slice()
    .sort((a, b) => a.week - b.week)
    .map((s) => {
      const e = s.episode ? byNum.get(s.episode) : undefined;
      if (e) seen.add(e.number);
      return {
        channel, week: s.week, day, title: e?.title || s.title, ...(s.series || e?.series ? { series: s.series ?? e?.series } : {}),
        ...(s.episode ? { episode: s.episode } : {}), ...(e ? { dir: e.dir } : {}), batch: s.batch,
        draft: e ? isDraftStatus(e.status) : true, exists: Boolean(e),
        files: e?.files ?? { script: false, research: false, scenes: false, publish: false },
        specialist: s.specialist ?? [], approval: e?.approval ?? { approved: false }, ...(s.note ? { note: s.note } : {}),
      };
    });
  for (const e of episodes)
    if (!seen.has(e.number) && isDraftStatus(e.status))
      views.push({ channel, week: null, day, title: e.title, ...(e.series ? { series: e.series } : {}), episode: e.number, dir: e.dir,
        batch: null, draft: true, exists: true, files: e.files, specialist: [], approval: e.approval, note: "مسودة خارج ترتيب النشر" });
  return views;
};

/** ما ينتظر المالك: المسودات الموجودة فعلًا وغير المعتمدة (أو تغيّر سكريبتها بعد اعتماده) */
export const awaitingOwner = (v: StockEpisodeView): boolean => v.exists && v.draft && (!v.approval.approved || Boolean(v.approval.stale));
