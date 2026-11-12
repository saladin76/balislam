import path from "node:path";
import { checkEpisode, type CheckDeps, type SentenceCheck } from "./runner";
import { detectInstalled, localTranscriber, MODEL, readState, writeState, type Measurement, type Transcriber } from "./whisperTool";

/**
 * فحص النطق (العمل ٩): ما يجمع الأداة والفحص للاستوديو وسطر الأوامر.
 *   - `episodeView`: حالة الفحص لحلقة. مطفأ أو غير مثبّت ← لا شيء يُفحص ولا خطأ. مفعّل ← النتائج الحالية، وما لم
 *     يُفحص بعد يُضاف إلى طابور واحد في الخلفية (بعد توليد الجملة يُفحص تسجيلها الجديد هكذا، بلا لمس لمسار التوليد).
 *   - `measureFalseAlarms`: القياس قبل التفعيل (كما فُعل مع traces.ts، D58) على جمل القنوات الثلاث المولَّدة على
 *     هذا الجهاز. يعمل والفحص مطفأ، ولا يفعّله: التفعيل زر المالك بعد أن يرى المعدل.
 */

export type EpisodeView =
  | { state: "off" | "not-installed" }
  | { state: "on"; results: Record<string, Pick<SentenceCheck, "verdict" | "suspects" | "transcript">>; pending: number; checking: boolean };

type Key = `${string}/${string}`;
const queue: Key[] = [];
let working: Key | null = null;
let transcriberOverride: Transcriber | null = null;
/** Tests only: a transcriber in place of the local worker. */
export const setTranscriberForTests = (t: Transcriber | null) => { transcriberOverride = t; };

const transcriber = async (): Promise<Transcriber | null> => {
  if (transcriberOverride) return transcriberOverride;
  const inst = await detectInstalled();
  return inst.installed ? localTranscriber(inst) : null;
};

const drain = async () => {
  if (working) return;
  const { runWithChannel } = await import("../../channel");
  while (queue.length) {
    const key = queue.shift()!;
    working = key;
    const [ch, ep] = key.split("/") as [string, string];
    try {
      const t = await transcriber();
      if (!t || !(await readState()).enabled) { queue.length = 0; break; }
      // small batches, so a new recording elsewhere is not stuck behind a whole episode
      const r = await runWithChannel(ch, () => checkEpisode(ep, { transcribe: t, limit: 8 }));
      if (r.pending > 0 && r.checked > 0) queue.push(key);
    } catch (e) {
      console.error("[studio] pronunciation check:", (e as Error).message.split("\n")[0]);
    } finally {
      working = null;
    }
  }
};

export const isChecking = (channel: string, episode: string) => working === `${channel}/${episode}` || queue.includes(`${channel}/${episode}`);

/** The episode's checks for the studio; queues the unchecked sentences when the check is on. Never throws for «off». */
export const episodeView = async (channel: string, episode: string): Promise<EpisodeView> => {
  const state = await readState();
  if (!state.enabled) return { state: "off" };
  if (!transcriberOverride && !(await detectInstalled()).installed) return { state: "not-installed" };
  const { resolveScriptPath } = await import("../../script/episodes");
  const { readSentences } = await import("../sentenceVoice");
  const { loadPlan } = await import("../../plan/io");
  const { checkableRows, readResults, currentResults, pendingRows } = await import("./runner");
  const { planVerseTexts } = await import("../quranGuard");
  const scriptPath = await resolveScriptPath(episode);
  const [read, plan, doc] = await Promise.all([readSentences(episode), loadPlan(episode), readResults(scriptPath)]);
  const rows = checkableRows(read, planVerseTexts(plan));
  const pending = pendingRows(rows, doc).length;
  const key: Key = `${channel}/${episode}`;
  if (pending && working !== key && !queue.includes(key)) { queue.push(key); void drain(); }
  const results = Object.fromEntries(Object.entries(currentResults(rows, doc)).map(([id, r]) => [id, { verdict: r.verdict, suspects: r.suspects, transcript: r.transcript }]));
  return { state: "on", results, pending, checking: isChecking(channel, episode) };
};

// ── measurement ─────────────────────────────────────────────────────────────────────────────────────────────
export type MeasureJob = { status: "running" | "done" | "error"; done: number; total: number; label: string; startedAt: string; error?: string; result?: Measurement };
let measureJob: MeasureJob | null = null;
export const currentMeasure = () => measureJob;

/** Every channel's episodes with sentence recordings: transcribe (up to `perChannel` sentences each) and count the flags. */
export const measureFalseAlarms = async (o: {
  channels?: string[]; perChannel?: number; deps?: Partial<CheckDeps>; onProgress?: (done: number, total: number, label: string) => void;
} = {}): Promise<Measurement> => {
  const ch = await import("../../channel");
  const { listScriptEpisodeDirs } = await import("../../script/episodes");
  const t = o.deps?.transcribe ?? (await transcriber());
  if (!t) throw new Error("فحص النطق غير مثبّت.");
  const channels = o.channels ?? ch.listChannels();
  const perChannel = o.perChannel ?? 60;
  const m: Measurement = {
    at: new Date().toISOString(), model: MODEL, sentences: 0, flagged: 0, heard: 0, heardFlagged: 0, rate: 0, basis: "all",
    words: 0, flaggedWords: 0, channels: {}, examples: [], failed: 0,
  };
  for (const c of channels) {
    const stat = { sentences: 0, flagged: 0, heard: 0, heardFlagged: 0 };
    m.channels[c] = stat;
    const eps = (await listScriptEpisodeDirs(path.join(ch.channelsDir(), c, "episodes"))).map((d) => d.slice(0, 3));
    let budget = perChannel;
    for (const ep of eps) {
      if (budget <= 0) break;
      o.onProgress?.(stat.sentences, perChannel, `${c} ${ep}`);
      const r = await ch.runWithChannel(c, () => checkEpisode(ep, { transcribe: t, toWav: o.deps?.toWav, limit: budget })).catch(() => null);
      if (!r) continue;
      for (const row of r.rows) {
        if (budget <= 0) break;
        const res = r.results[row.row.id];
        if (!res) continue;
        budget--;
        if (res.verdict === "error") { m.failed++; continue; }
        const flagged = res.verdict !== "ok";
        const heard = row.row.status === "heard";
        stat.sentences++; m.sentences++;
        m.words += res.flaggable; m.flaggedWords += res.suspects.length;
        if (heard) { stat.heard++; m.heard++; }
        if (flagged) {
          stat.flagged++; m.flagged++;
          if (heard) { stat.heardFlagged++; m.heardFlagged++; }
          for (const s of res.suspects.slice(0, 2)) if (m.examples.length < 40) m.examples.push({ channel: c, episode: ep, sentenceId: row.row.id, word: s.word, heard: s.heard });
          if (res.verdict === "empty" && m.examples.length < 40) m.examples.push({ channel: c, episode: ep, sentenceId: row.row.id, word: "(لم يُسمع كلام)", heard: null });
        }
      }
    }
  }
  m.basis = m.heard >= 10 ? "heard" : "all";
  m.rate = m.basis === "heard" ? m.heardFlagged / m.heard : m.sentences ? m.flagged / m.sentences : 0;
  return m;
};

/** Starts the measurement in the background (the studio action) and saves it in the tool's state. */
export const startMeasure = (o: { perChannel?: number } = {}): MeasureJob => {
  if (measureJob?.status === "running") return measureJob;
  const job: MeasureJob = { status: "running", done: 0, total: 0, label: "يبدأ القياس…", startedAt: new Date().toISOString() };
  measureJob = job;
  void measureFalseAlarms({ perChannel: o.perChannel, onProgress: (d, n, l) => Object.assign(job, { done: d, total: n, label: l }) })
    .then(async (result) => {
      const s = await readState();
      await writeState({ ...s, measurement: result });
      Object.assign(job, { status: "done", result, label: "انتهى القياس." });
    })
    .catch((e) => Object.assign(job, { status: "error", error: (e as Error).message.slice(0, 300), label: "تعذّر القياس." }));
  return job;
};

/** On only after a measurement the owner sees; off any time. */
export const setEnabled = async (enabled: boolean) => {
  const s = await readState();
  if (enabled && !s.measurement) throw Object.assign(new Error("قِس معدل الإنذار الكاذب أولًا، ثم فعّل الفحص."), { code: "NOT_MEASURED" });
  if (enabled && !transcriberOverride && !(await detectInstalled()).installed) throw Object.assign(new Error("فحص النطق غير مثبّت."), { code: "NOT_INSTALLED" });
  const next = enabled ? { ...s, enabled: true, enabledAt: new Date().toISOString(), acceptedRate: s.measurement!.rate } : { ...s, enabled: false };
  await writeState(next);
  return next;
};

let pythonSeen: { at: number; ok: boolean } | null = null;
export const toolStatus = async () => {
  const { currentInstall, findSystemPython, freeMb, SIZES, REQUIRED_FREE_MB, FASTER_WHISPER_VERSION } = await import("./whisperTool");
  const [inst, state, free] = await Promise.all([detectInstalled(), readState(), freeMb()]);
  if (!inst.installed && (!pythonSeen || Date.now() - pythonSeen.at > 60_000)) pythonSeen = { at: Date.now(), ok: Boolean(findSystemPython()) };
  return {
    installed: inst.installed, enabled: state.enabled, acceptedRate: state.acceptedRate ?? null,
    measurement: state.measurement ?? null, install: currentInstall(), measure: currentMeasure(),
    python: inst.installed ? true : Boolean(pythonSeen?.ok), sizes: SIZES, requiredFreeMb: REQUIRED_FREE_MB, freeMb: free,
    model: MODEL, version: FASTER_WHISPER_VERSION,
  };
};
