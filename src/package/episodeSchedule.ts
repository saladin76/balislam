/**
 * جدول الحلقات الطويلة بقاعدة السلاسل (قرار المالك ٤ في الخطة المشتركة، ٢١ نوفمبر): حلقة طويلة أسبوعيًا لكل قناة في
 * يومها (`schedule.longDay`)، وتزيد إلى ٢ أو ٣ أسبوعيًا عند الحاجة **بشرط أن تكون كل حلقة من سلسلة مختلفة في الأسبوع
 * نفسه** (التكرار الضار وسياسة يوتيوب للمحتوى المتكرر).
 *
 * دالة صافية بلا قرص. الأسبوع يبدأ بيوم القناة؛ والحلقة الثانية بعده بيومين والثالثة بعده بأربعة. لا يُجدول إلا ما
 * أذن المالك بنشره (`ready`)، بترتيب الإنتاج ولا تسبق حلقةٌ ما قبلها في سلسلتها؛ وما نُشر أو حُدد في الأسبوع يدخل في
 * حساب السلاسل. «عام» (بلا سلسلة) يُعدّ سلسلة واحدة احتياطًا: حلقتان «عام» لا تجتمعان في أسبوع.
 * الخانة التي لا تجد حلقة جاهزة من سلسلة مختلفة «فجوة» تقول ما يلزمها.
 */
export type EpisodeItem = { id: string; series: string; number?: number; title?: string; ready: boolean };
/** حلقة نُشرت أو حُدد يومها (status.json) */
export type DatedEpisode = { id: string; series: string; date: string };
export type Slot = { date: string; episode?: EpisodeItem; gap?: string };
export type PlannedWeek = { start: string; slots: Slot[]; fixed: DatedEpisode[] };

export const MAX_PER_WEEK = 3;
const OFFSETS = [0, 2, 4];

const addDays = (date: string, k: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + k);
  return d.toISOString().slice(0, 10);
};
/** أول يوم للقناة في تاريخ from أو بعده (longDay: ٠ الأحد … ٦ السبت) */
export const firstLongDay = (from: string, longDay: number) => {
  const d = new Date(`${from}T00:00:00Z`).getUTCDay();
  return addDays(from, (longDay - d + 7) % 7);
};

export const planEpisodes = (o: { from: string; weeks: number; perWeek: number; longDay: number; items: EpisodeItem[]; dated?: DatedEpisode[] }): PlannedWeek[] => {
  const perWeek = Math.max(1, Math.min(MAX_PER_WEEK, Math.floor(o.perWeek)));
  const dated = o.dated ?? [];
  const taken = new Set(dated.map((d) => d.id));
  // ترتيب الإنتاج (رقم الحلقة في القناة)، وداخل السلسلة الواحدة بترتيبها فيها (الشرط في find أدناه)
  const queue = o.items.filter((e) => !taken.has(e.id)).sort((a, b) => a.id.localeCompare(b.id));
  const used = new Set<string>();
  const out: PlannedWeek[] = [];
  let start = firstLongDay(o.from, o.longDay);
  for (let w = 0; w < o.weeks; w++, start = addDays(start, 7)) {
    const end = addDays(start, 7);
    const fixed = dated.filter((d) => d.date >= start && d.date < end);
    const series = new Set(fixed.map((d) => d.series));
    const slots: Slot[] = [];
    for (const off of OFFSETS.slice(0, Math.max(0, perWeek - fixed.length))) {
      const date = addDays(start, off);
      // أول حلقة جاهزة من سلسلة لم تُنشر في هذا الأسبوع؛ وفي السلسلة الواحدة بترتيبها (لا تُقدَّم حلقة على ما قبلها)
      const next = queue.find((e) => !used.has(e.id) && !series.has(e.series) &&
        !queue.some((x) => !used.has(x.id) && x.series === e.series && x !== e && (x.number ?? 1e9) < (e.number ?? 1e9)));
      if (next?.ready) { used.add(next.id); series.add(next.series); slots.push({ date, episode: next }); continue; }
      const waiting = next ? `الحلقة ${next.id} (${next.series}) لم يُؤذن بنشرها بعد` : series.size
        ? `لا حلقة من سلسلة غير ${[...series].join("، ")}`
        : "لا حلقة جاهزة";
      slots.push({ date, gap: waiting });
    }
    out.push({ start, slots, fixed });
  }
  return out;
};

/** يرفض جدولًا يدويًا يجمع سلسلة واحدة مرتين في أسبوع (للتقويم وللفحص) */
export const sameSeriesWeeks = (dated: DatedEpisode[], longDay: number) => {
  const byWeek = new Map<string, DatedEpisode[]>();
  for (const d of dated) {
    const start = addDays(firstLongDay(d.date, longDay), firstLongDay(d.date, longDay) === d.date ? 0 : -7);
    byWeek.set(start, [...(byWeek.get(start) ?? []), d]);
  }
  return [...byWeek.entries()].flatMap(([start, list]) => {
    const seen = new Map<string, string[]>();
    for (const d of list) seen.set(d.series, [...(seen.get(d.series) ?? []), d.id]);
    return [...seen.entries()].filter(([, ids]) => ids.length > 1).map(([series, ids]) => ({ week: start, series, episodes: ids }));
  });
};

export const episodesMarkdown = (channelName: string, weeks: PlannedWeek[], perWeek: number) => {
  const gaps = weeks.flatMap((w) => w.slots.filter((s) => s.gap));
  return [
    `# جدول الحلقات · ${channelName} · ${perWeek} أسبوعيًا، كل حلقة من سلسلة مختلفة`,
    "",
    gaps.length ? `خانات ناقصة: ${gaps.length}، أولها ${gaps[0]!.date} (${gaps[0]!.gap}).` : "كل الخانات فيها حلقة جاهزة.",
    "",
    ...weeks.map((w) => `- أسبوع ${w.start}: ${[
      ...w.fixed.map((d) => `${d.date} الحلقة ${d.id} (${d.series}، محددة)`),
      ...w.slots.map((s) => (s.episode ? `${s.date} الحلقة ${s.episode.id} (${s.episode.series})${s.episode.title ? ` «${s.episode.title}»` : ""}` : `${s.date} ⚠️ ${s.gap}`)),
    ].join(" ، ") || "—"}`),
    "",
  ].join("\n");
};
