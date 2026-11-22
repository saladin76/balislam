/**
 * الطابور الليلي (D191، قرار المالك ٢٢ نوفمبر): يرندر ما اعتمده المالك وحده، ويجهز حزم النشر، ويكتب ملخصًا صباحيًا؛
 * بلا صوت مدفوع ولا نشر.
 *
 * - **ما يعمله، ولا شيء غيره:** أمران فقط من أوامر الاستوديو نفسها (`NIGHTLY_ALLOWED`):
 *   - `bal package <الحلقة>`: Master وحزمة النشر، لحلقة اعتمد المالك تجميعها ولا Master حاليًا لها. الأمر نفسه يرفض
 *     بلا اعتماد التجميع (`requireScenesReadyForMaster`)، ولا يولّد صوتًا (D151).
 *   - `bal package <الحلقة> --shorts`: الشورتس بعد اعتماد Master نفسه (القاعدة الرابعة).
 *   لا «make»، ولا مؤثرات (`sfx` يصرف رصيدًا)، ولا توليد صوت، ولا Drive، ولا نشر (D53: النشر يدوي بالكامل).
 * - **اعتماد واحد لا يُتخطى:** المهمة تُختار من حالة سجل «إنتاج المشاهد» (`sceneFirstProgress`) وحده؛ ما لم يعتمده
 *   المالك يُذكر في الملخص «ينتظرك» ولا يُرندر.
 * - **الذاكرة والطابور:** مهمة واحدة في كل مرة، ولا تبدأ والاستوديو يرندر شيئًا آخر، ولا والذاكرة حرجة
 *   (`memory_pressure` تحت ١٥٪ حر): انتظار دقيقتين حتى ثلاث مرات، ثم تُترك المهمة لليلة التالية بسببها.
 * - **الملخص:** ملف على جهاز المالك (`.studio/nightly/`، لا يُرفع) ويُعرض في «غرفة العمليات ← الليل والأسبوع».
 */

export type NightFacts = {
  channel: string; channelName: string; episode: string; title: string;
  scenesTotal: number; unapproved: number; recitationPending: number;
  assemblyApproved: boolean; masterApproved: boolean; publishAllowed: boolean;
  /** ملف Master موجود وأحدث من التجميع المعتمد (فلا يُعاد رندره كل ليلة) */
  masterFileFresh: boolean;
  shortsSelected: number; shortsMade: number;
};
export type NightTask = { channel: string; episode: string; kind: "master" | "shorts"; args: string[]; why: string };
export type NightNote = { channel: string; episode: string; title: string; text: string };
export type NightPlan = { tasks: NightTask[]; owner: NightNote[]; ready: NightNote[] };

/** الأوامر الوحيدة التي يجوز للطابور الليلي تشغيلها (أي شيء غيرها يُرفض قبل أن يبدأ) */
export const NIGHTLY_ALLOWED: RegExp[] = [/^package \d{3}$/, /^package \d{3} --shorts$/];
export const assertNightlyArgs = (args: string[]) => {
  const line = args.join(" ");
  if (!NIGHTLY_ALLOWED.some((re) => re.test(line))) throw new Error(`الطابور الليلي لا يشغّل «${line}»: مسموح له Master والحزمة والشورتس للمعتمد فقط.`);
};

const n = (x: number) => x.toLocaleString("ar-EG");

/** ما يُعمل الليلة، وما ينتظر المالك، وما هو جاهز للنشر اليدوي، من حقائق كل حلقة */
export const planNightly = (facts: NightFacts[]): NightPlan => {
  const tasks: NightTask[] = [], owner: NightNote[] = [], ready: NightNote[] = [];
  for (const f of facts) {
    if (!f.scenesTotal) continue;
    const note = (text: string) => ({ channel: f.channelName, episode: f.episode, title: f.title, text });
    if (f.unapproved) { owner.push(note(`${n(f.unapproved)} مشهد ينتظر اعتمادك في «٢ المشاهد»`)); continue; }
    if (f.recitationPending) { owner.push(note(`${n(f.recitationPending)} آية تنتظر تلاوتك البشرية`)); continue; }
    if (!f.assemblyApproved) { owner.push(note("التجميع ينتظر مشاهدتك كاملة واعتمادك")); continue; }
    if (!f.masterApproved) {
      if (f.masterFileFresh) owner.push(note("النسخة النهائية (Master) جاهزة وتنتظر مشاهدتك واعتمادك"));
      else tasks.push({ channel: f.channel, episode: f.episode, kind: "master", args: ["package", f.episode], why: "اعتمدت التجميع ولا Master حاليًا" });
      continue;
    }
    if (f.shortsSelected > f.shortsMade)
      tasks.push({ channel: f.channel, episode: f.episode, kind: "shorts", args: ["package", f.episode, "--shorts"], why: `اعتمدت Master، و${n(f.shortsSelected - f.shortsMade)} شورت لم يُصنع` });
    if (!f.publishAllowed) owner.push(note("Master معتمد، وإذن النشر ينتظرك"));
    else ready.push(note("جاهزة للنشر اليدوي (D53): الملفات المعتمدة تُنسخ إلى Drive بعد التحقق"));
  }
  for (const t of tasks) assertNightlyArgs(t.args);
  return { tasks, owner, ready };
};

export type TaskOutcome = { task: NightTask; status: "done" | "failed" | "skipped"; message: string; seconds: number };
export type NightRun = { at: string; finished: string; plan: NightPlan; outcomes: TaskOutcome[]; note?: string };

export const MEMORY_MIN_FREE = 15;
export type NightDeps = {
  facts: () => Promise<NightFacts[]>;
  /** نسبة الذاكرة الحرة (memory_pressure)، أو null إن تعذرت القراءة (تُعامل كحرجة) */
  freeMemoryPct: () => Promise<number | null>;
  /** الاستوديو يرندر أو يصنع شيئًا الآن */
  renderBusy: () => boolean;
  runTask: (t: NightTask) => Promise<{ ok: boolean; message: string }>;
  sleep: (ms: number) => Promise<void>;
  now: () => Date;
  log?: (m: string) => void;
};

/** انتظار شرط بمحاولات محدودة؛ true إن تحقق */
const waitFor = async (ok: () => Promise<boolean>, d: NightDeps, tries: number, ms: number) => {
  for (let i = 0; i <= tries; i++) {
    if (await ok()) return true;
    if (i < tries) await d.sleep(ms);
  }
  return false;
};

let inFlight: Promise<NightRun> | null = null;
/** تشغيل واحد في كل مرة: الاستدعاء أثناء تشغيل جارٍ يعيد التشغيل نفسه ولا يبدأ آخر */
export const runNightly = (d: NightDeps): Promise<NightRun> => {
  if (inFlight) return inFlight;
  inFlight = (async (): Promise<NightRun> => {
    const at = d.now().toISOString();
    const plan = planNightly(await d.facts());
    const outcomes: TaskOutcome[] = [];
    for (const task of plan.tasks) {
      assertNightlyArgs(task.args);
      const t0 = d.now().getTime();
      const idle = await waitFor(async () => !d.renderBusy(), d, 30, 60_000);
      if (!idle) { outcomes.push({ task, status: "skipped", message: "الاستوديو كان يرندر شيئًا آخر طوال نصف ساعة؛ تُعاد الليلة التالية", seconds: 0 }); continue; }
      const mem = await waitFor(async () => ((await d.freeMemoryPct()) ?? 0) >= MEMORY_MIN_FREE, d, 3, 120_000);
      if (!mem) { outcomes.push({ task, status: "skipped", message: "الذاكرة حرجة (أقل من ١٥٪ حر بعد ثلاث محاولات)؛ تُعاد الليلة التالية", seconds: 0 }); continue; }
      d.log?.(`nightly: ${task.args.join(" ")} (${task.channel})`);
      const r = await d.runTask(task).catch((e: Error) => ({ ok: false, message: e.message }));
      outcomes.push({ task, status: r.ok ? "done" : "failed", message: r.message, seconds: Math.round((d.now().getTime() - t0) / 1000) });
    }
    return { at, finished: d.now().toISOString(), plan, outcomes };
  })().finally(() => { inFlight = null; });
  return inFlight;
};
export const nightlyRunning = () => inFlight !== null;

const KIND_AR: Record<NightTask["kind"], string> = { master: "النسخة النهائية (Master) وحزمة النشر", shorts: "الشورتس" };
const STATUS_AR: Record<TaskOutcome["status"], string> = { done: "تم", failed: "فشل", skipped: "تأجل" };

/** الملخص الصباحي بالترتيب: ما تم، وما تعثر وسببه، وما ينتظر المالك، وما هو جاهز للنشر اليدوي */
export const nightlySummaryMarkdown = (r: NightRun) => {
  const when = new Date(r.at);
  const line = (x: NightNote) => `- ${x.channel} · ${x.episode} «${x.title}»: ${x.text}`;
  const out = [
    `# ملخص الليلة — ${when.toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" })}`,
    "",
    "لا صوت مدفوع ولا نشر: الطابور الليلي يرندر ما اعتمدته وحده (D191).",
    "",
    "## ما تم",
    ...(r.outcomes.filter((o) => o.status === "done").map((o) => `- ${o.task.channel} · ${o.task.episode}: ${KIND_AR[o.task.kind]} (${n(Math.round(o.seconds / 60))} دقيقة)`) || []),
  ];
  if (!r.outcomes.some((o) => o.status === "done")) out.push("- لا شيء الليلة: لا عمل معتمد ينتظر الرندر.");
  const bad = r.outcomes.filter((o) => o.status !== "done");
  out.push("", "## ما تعثر", ...(bad.length ? bad.map((o) => `- ${STATUS_AR[o.status]}: ${o.task.channel} · ${o.task.episode} ${KIND_AR[o.task.kind]} — ${o.message}`) : ["- لا شيء."]));
  out.push("", "## ينتظرك", ...(r.plan.owner.length ? r.plan.owner.map(line) : ["- لا شيء."]));
  out.push("", "## جاهز للنشر اليدوي", ...(r.plan.ready.length ? r.plan.ready.map(line) : ["- لا شيء بعد."]));
  if (r.note) out.push("", r.note);
  return out.join("\n") + "\n";
};

export type NightSettings = { enabled: boolean; hour: number };
export const DEFAULT_NIGHT_SETTINGS: NightSettings = { enabled: true, hour: 2 };
export const cleanSettings = (s: Partial<NightSettings> | null | undefined): NightSettings => ({
  enabled: typeof s?.enabled === "boolean" ? s.enabled : DEFAULT_NIGHT_SETTINGS.enabled,
  hour: Number.isInteger(s?.hour) && s!.hour! >= 0 && s!.hour! <= 23 ? s!.hour! : DEFAULT_NIGHT_SETTINGS.hour,
});
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * الجدولة: تعمل ما دام الاستوديو يعمل على جهاز المالك، وتفحص كل دقيقة؛ تبدأ مرة واحدة في اليوم عند الساعة المضبوطة
 * (بالتوقيت المحلي). آخر يوم بدأت فيه يُحفظ، فإعادة تشغيل الاستوديو في الساعة نفسها لا تعيدها.
 */
export const createNightlyScheduler = (o: {
  settings: () => Promise<NightSettings>;
  lastDay: () => Promise<string | null>;
  markDay: (day: string) => Promise<void>;
  run: () => Promise<unknown>;
  now?: () => Date;
  tickMs?: number;
}) => {
  const now = o.now ?? (() => new Date());
  let timer: ReturnType<typeof setInterval> | null = null;
  let ticking = false;
  const tick = async () => {
    if (ticking || nightlyRunning()) return false;
    ticking = true;
    try {
      const s = await o.settings();
      const d = now();
      if (!s.enabled || d.getHours() !== s.hour) return false;
      const day = dayKey(d);
      if ((await o.lastDay()) === day) return false;
      await o.markDay(day);
      await o.run();
      return true;
    } finally { ticking = false; }
  };
  return {
    tick,
    start: () => { if (!timer) timer = setInterval(() => void tick(), o.tickMs ?? 60_000); },
    stop: () => { if (timer) clearInterval(timer); timer = null; },
  };
};
