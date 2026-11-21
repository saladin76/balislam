/**
 * جدول الشورتس اليومي (قرار المالك ٤ في الخطة المشتركة: ريلزان يوميًا لكل قناة؛ المرحلة ٢ البند ٣).
 *
 * دالة صافية بلا قرص: تأخذ شورتس القناة الجاهزة (من كل حلقة، ومن السلاسل اليومية المستقلة حين توجد) وما نُشر منها
 * وأيامًا مقفلة في التقويم، وتملأ كل يوم بـ`perDay` شورت:
 * - الأحدث أولًا: شورتس آخر حلقة طويلة نُشرت قبل اليوم، بترتيبها؛ ثم ما بقي من الحلقات الأقدم (محتوى دائم)؛
 * - لا يُكرَّر شورت أبدًا، ولا شورت قبل نشر حلقته (الرابط في وصفه يشير إليها)؛
 * - في اليوم الواحد مصدران مختلفان ما أمكن (حلقتان، أو حلقة وسلسلة مستقلة)؛
 * - يوم ينقصه شورت يُسمّى «فجوة» بعدده: إشارة إلى ما يلزم صنعه (شورتس أكثر من حلقة، أو حلقة من سلسلة مستقلة).
 * التقويم اليدوي في «غرفة العمليات» (`calendar.json`) يعلو عليه: يوم محدد يُحترم كما هو، ويوم إجازة بلا شورت.
 */
export type ShortItem = {
  /** الحلقة (رقمها) أو السلسلة المستقلة (`series:<المعرّف>`) */
  source: string;
  n: number;
  title?: string;
  /** حلقة طويلة: تاريخ نشرها (YYYY-MM-DD)؛ لا يُجدول شورت قبله. السلسلة المستقلة بلا تاريخ. */
  episodeDate?: string;
};
export type ManualDay = { off?: boolean; shorts?: { ep: string; n: number }[] };
export type PlannedDay = { date: string; shorts: ShortItem[]; gap: number; manual: boolean };

const key = (s: { source?: string; ep?: string; n: number }) => `${s.source ?? s.ep}#${s.n}`;
const addDays = (date: string, k: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + k);
  return d.toISOString().slice(0, 10);
};

export const planShorts = (o: {
  from: string;
  days: number;
  perDay: number;
  items: ShortItem[];
  /** ما نُشر قبل `from` (مفاتيح `source#n`) فلا يعود */
  published?: string[];
  calendar?: Record<string, ManualDay>;
}): PlannedDay[] => {
  const used = new Set(o.published ?? []);
  const out: PlannedDay[] = [];
  const pool = o.items.filter((s) => !used.has(key(s)));
  for (let i = 0; i < o.days; i++) {
    const date = addDays(o.from, i);
    const manual = o.calendar?.[date];
    if (manual?.off) { out.push({ date, shorts: [], gap: 0, manual: true }); continue; }
    if (manual?.shorts) {
      const shorts = manual.shorts.map((m) => pool.find((s) => s.source === m.ep && s.n === m.n) ?? { source: m.ep, n: m.n });
      for (const s of shorts) used.add(key(s));
      out.push({ date, shorts, gap: 0, manual: true });
      continue;
    }
    const ready = pool.filter((s) => !used.has(key(s)) && (!s.episodeDate || s.episodeDate <= date));
    // الأحدث أولًا: حلقة نُشرت مؤخرًا قبل الأقدم، والسلسلة المستقلة بعد شورتس الحلقة الجديدة وقبل الأقدم منها
    // «الأحدث» آخر حلقة نُشرت قبل اليوم ولو نفدت شورتسها، فلا تصير حلقة قديمة «أحدث» وتسبق السلسلة المستقلة
    const newest = o.items.reduce((m, s) => (s.episodeDate && s.episodeDate <= date && s.episodeDate > m ? s.episodeDate : m), "");
    const rank = (s: ShortItem) => (s.episodeDate === newest ? 0 : !s.episodeDate ? 1 : 2);
    const order = [...ready].sort((a, b) => rank(a) - rank(b) || (b.episodeDate ?? "").localeCompare(a.episodeDate ?? "") || a.source.localeCompare(b.source) || a.n - b.n);
    const picked: ShortItem[] = [];
    for (const s of order) {
      if (picked.length >= o.perDay) break;
      // مصدر مختلف في اليوم ما أمكن: يُؤجَّل الثاني من المصدر نفسه إن كان في الطابور مصدر آخر
      if (picked.some((p) => p.source === s.source) && order.some((x) => !picked.includes(x) && !picked.some((p) => p.source === x.source))) continue;
      picked.push(s);
    }
    for (const s of order) if (picked.length < o.perDay && !picked.includes(s)) picked.push(s);
    for (const s of picked) used.add(key(s));
    out.push({ date, shorts: picked, gap: o.perDay - picked.length, manual: false });
  }
  return out;
};

/** ملخص للمالك: عدد الأيام المكتملة، وأول فجوة، ومجموع الشورتس الناقصة. */
export const scheduleSummary = (plan: PlannedDay[], perDay: number) => {
  const gaps = plan.filter((d) => d.gap > 0);
  return {
    full: plan.filter((d) => !d.manual && d.gap === 0).length,
    firstGap: gaps[0]?.date,
    missing: gaps.reduce((n, d) => n + d.gap, 0),
    line: gaps.length
      ? `أيام ناقصة: ${gaps.length}، والشورتس الناقصة: ${gaps.reduce((n, d) => n + d.gap, 0)}، أولها ${gaps[0]!.date}. اصنع شورتس أكثر من الحلقة، أو حلقة من سلسلة يومية مستقلة.`
      : `كل يوم فيه ${perDay} شورت.`,
  };
};

/** الجدول نصًّا (للأمر `bal shorts-plan` ولملف النشر). */
export const scheduleMarkdown = (channelName: string, plan: PlannedDay[], perDay: number) =>
  [
    `# جدول الشورتس · ${channelName} · ${perDay} يوميًا`,
    "",
    scheduleSummary(plan, perDay).line,
    "",
    ...plan.map((d) => `- ${d.date}${d.manual ? " (من التقويم)" : ""}: ${d.shorts.length ? d.shorts.map((s) => `${s.source.startsWith("series:") ? s.source.slice(7) : `الحلقة ${s.source}`} · الشورت ${s.n}${s.title ? ` «${s.title}»` : ""}`).join(" ، ") : d.manual ? "بلا نشر" : "—"}${d.gap ? ` ⚠️ ينقص ${d.gap}` : ""}`),
    "",
  ].join("\n");
