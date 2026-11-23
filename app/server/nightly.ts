import { busy, longJobs, renderJobs, startJob } from "./jobQueue.ts";

/**
 * الطابور الليلي في الاستوديو (D191): يعمل ما دام الاستوديو يعمل على جهاز المالك. المهمة تمر بطابور الرندر الواحد
 * نفسه (startJob ← studioPool) وبمفتاح «مشغول» للحلقة، فلا رندران معًا ولا مهمة فوق مهمة المالك.
 * التخطيط والحراسة في src/studio/nightly.ts؛ الحقائق والملفات المحلية في src/studio/nightlyFacts.ts.
 */
type Load = (p: string) => Promise<any>;

/** الاستوديو يرندر أو يصنع شيئًا (بأي قناة) */
export const studioRendering = () => busy.size > 0 || [...renderJobs.values(), ...longJobs.values()].some((j) => j.status === "running");

/** يشغّل مهمة ليلية عبر طابور الاستوديو وينتظر نهايتها */
export const runNightTask = async (root: string, t: { channel: string; episode: string; kind: "master" | "shorts"; args: string[] }, sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))) => {
  const key = `${t.channel}/${t.episode}`;
  if (busy.has(key)) return { ok: false, message: "الحلقة مشغولة بمهمة أخرى" };
  const title = t.kind === "master" ? `الطابور الليلي: النسخة النهائية وحزمة النشر للحلقة ${t.episode}` : `الطابور الليلي: الشورتس للحلقة ${t.episode}`;
  const job = startJob({ root }, { kind: t.kind === "master" ? "package" : "shorts", channel: t.channel, episode: t.episode, title }, t.args);
  while (job.status === "running") await sleep(15_000);
  return job.status === "done" ? { ok: true, message: "تم" } : { ok: false, message: job.error ?? job.failure ?? "فشلت المهمة" };
};

let scheduler: { start: () => void; stop: () => void; tick: () => Promise<boolean> } | null = null;

export const nightlyDeps = async (root: string, load: Load) => {
  const facts = await load("/src/studio/nightlyFacts.ts");
  return {
    facts: () => facts.gatherNightFacts(),
    freeMemoryPct: () => facts.freeMemoryPct(),
    renderBusy: studioRendering,
    runTask: (t: Parameters<typeof runNightTask>[1]) => runNightTask(root, t),
    sleep: (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
    now: () => new Date(),
    log: (m: string) => console.log(`[studio] ${m}`),
  };
};

/** تشغيل الآن (ضغطة المالك أو الجدولة): يكتب الملخص على الجهاز ويعيده */
export const runNightlyNow = async (root: string, load: Load) => {
  const N = await load("/src/studio/nightly.ts");
  const facts = await load("/src/studio/nightlyFacts.ts");
  const r = await N.runNightly(await nightlyDeps(root, load));
  const md = N.nightlySummaryMarkdown(r);
  await facts.saveNightRun(r, md);
  return { run: r, markdown: md };
};

/** المراجعة الأسبوعية الآن (من البيانات المستوردة على هذا الجهاز) */
export const buildWeeklyNow = async (load: Load) => {
  const W = await load("/src/studio/weekly.ts");
  const facts = await load("/src/studio/nightlyFacts.ts");
  const week = W.isoWeek(new Date());
  const reviews = (await facts.gatherWeek()).map(W.reviewChannel);
  const md = W.weeklyMarkdown(week, reviews);
  await facts.saveWeekly(week, md);
  return { week, reviews, markdown: md };
};

/** يبدأ الجدولة مرة واحدة عند تشغيل الاستوديو (ليس في الاختبارات) */
export const startNightlyScheduler = async (root: string, load: Load) => {
  if (scheduler || process.env.VITEST || process.env.BAL_NIGHTLY === "0") return;
  const N = await load("/src/studio/nightly.ts");
  const facts = await load("/src/studio/nightlyFacts.ts");
  scheduler = N.createNightlyScheduler({
    settings: () => facts.readNightSettings(),
    lastDay: () => facts.readLastDay(),
    markDay: (d: string) => facts.markLastDay(d),
    run: async () => {
      await runNightlyNow(root, load);
      // المراجعة الأسبوعية صباح الاثنين مع ملخص الليلة
      if (new Date().getDay() === 1) await buildWeeklyNow(load).catch((e: Error) => console.error("[studio] weekly review:", e.message));
    },
  });
  scheduler!.start();
};
