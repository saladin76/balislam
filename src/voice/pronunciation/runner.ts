import path from "node:path";
import os from "node:os";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { readJsonFile, writeJsonAtomic } from "../../io/atomicJson";
import { isQuranFreeForTts, planVerseTexts } from "../quranGuard";
import { hasBasmala } from "../basmala";
import { compareTranscript, textKey, type RefWord, type Suspect } from "./compare";
import { MODEL, type Transcriber } from "./whisperTool";
import type { SentenceRow, SentencesRead } from "../sentenceVoice";

/**
 * فحص النطق (العمل ٩): لكل جملة راوٍ لها تسجيل حالي، تفريغ محلي ثم مقارنة بنصها، والنتيجة في
 * `voice/pronunciation-check.json` في مجلد الحلقة (مع الصوت: لا يُرفع أبدًا، NEVER_RES في scripts/contentPaths.mjs).
 * النتيجة مربوطة بملف التسجيل ونص الجملة: تسجيل جديد أو نص جديد = فحص جديد، وغير ذلك لا يُعاد.
 * لا يُفحص أبدًا: الآية، والبسملة، وأي جملة يرفضها حارس القرآن (﴿…﴾، [آية]، نص آية من آيات الحلقة).
 * لا يكتب هذا الملف شيئًا في السجل الموقَّع ولا في sentences.json: التنبيه لا يمنع اعتمادًا.
 */

export const RESULTS_FILE = "pronunciation-check.json";
export type SentenceCheck = {
  file: string; textKey: string; model: string; at: string;
  transcript: string; verdict: "ok" | "suspect" | "empty" | "error";
  suspects: Suspect[]; flaggable: number; matched: number; error?: string;
};
export type ResultsDoc = { version: 1; results: Record<string, SentenceCheck> };

export const resultsFileFor = (scriptPath: string) => path.join(path.dirname(scriptPath), "voice", RESULTS_FILE);
export const readResults = async (scriptPath: string): Promise<ResultsDoc> =>
  (await readJsonFile<ResultsDoc>(resultsFileFor(scriptPath)).catch(() => null)) ?? { version: 1, results: {} };

export type Checkable = { row: SentenceRow; sceneId: string; ref: RefWord[]; key: string };

/** The narration sentences with a current recording that may be checked — never a verse, never the basmala. */
export const checkableRows = (read: SentencesRead, verses: readonly string[]): Checkable[] => {
  const out: Checkable[] = [];
  for (const sc of read.scenes) {
    if (sc.verse) continue;
    for (const row of sc.rows) {
      if (row.kind !== "narration" || !row.audio || row.virtual) continue;
      if (row.status !== "generated" && row.status !== "heard" && row.status !== "stale") continue;
      if (hasBasmala(row.text) || !isQuranFreeForTts(row.text, { id: sc.id }, { verses })) continue;
      const ref: RefWord[] = row.words.length
        ? row.words.map((w) => ({ word: w.word, alt: [w.sent, w.say, w.correction ?? ""].filter(Boolean), skip: w.quran }))
        : row.text.split(/\s+/).filter(Boolean).map((w) => ({ word: w }));
      out.push({ row, sceneId: sc.id, ref, key: textKey(row.text) });
    }
  }
  return out;
};

const isFresh = (c: Checkable, r: SentenceCheck | undefined) =>
  Boolean(r && r.file === c.row.audio!.file && r.textKey === c.key && r.model === MODEL);
// an «error» result is kept too: a file that cannot be read is not retried until the recording or the text changes

export const pendingRows = (rows: Checkable[], doc: ResultsDoc) => rows.filter((c) => !isFresh(c, doc.results[c.row.id]));

/** Current results for the rows still checkable (results for other files or texts are not shown). */
export const currentResults = (rows: Checkable[], doc: ResultsDoc): Record<string, SentenceCheck> =>
  Object.fromEntries(rows.flatMap((c) => (isFresh(c, doc.results[c.row.id]) ? [[c.row.id, doc.results[c.row.id]!]] : [])));

export type ToWav = (src: string, out: string) => Promise<void>;
/** 16 kHz mono 16-bit wav (what the worker reads), with the studio's own ffmpeg. */
export const ffmpegToWav: ToWav = async (src, out) => {
  const { RenderInternals } = await import("@remotion/renderer");
  await RenderInternals.callFf({
    bin: "ffmpeg", args: ["-v", "error", "-y", "-i", src, "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", out],
    indent: false, logLevel: "error", binariesDirectory: null, cancelSignal: undefined,
  });
};

export type CheckDeps = { transcribe: Transcriber; toWav?: ToWav; limit?: number };

/**
 * Checks the pending sentences of one episode (in the current channel scope) and saves their results.
 * Returns how many were checked now and the results that are current after it.
 */
export const checkEpisode = async (episode: string, deps: CheckDeps) => {
  const { resolveScriptPath } = await import("../../script/episodes");
  const { readSentences, sentencesDirFor } = await import("../sentenceVoice");
  const { loadPlan } = await import("../../plan/io");
  const scriptPath = await resolveScriptPath(episode);
  const [read, plan] = await Promise.all([readSentences(episode), loadPlan(episode)]);
  const rows = checkableRows(read, planVerseTexts(plan));
  const doc = await readResults(scriptPath);
  const todo = pendingRows(rows, doc).slice(0, deps.limit ?? Number.POSITIVE_INFINITY);
  if (todo.length) {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "bal-pron-"));
    try {
      const items: { id: string; wav: string }[] = [];
      const failed = new Map<string, string>();
      for (const c of todo) {
        const src = path.join(sentencesDirFor(scriptPath), c.row.audio!.file);
        const wav = path.join(tmp, `${items.length}.wav`);
        if (!existsSync(src)) { failed.set(c.row.id, "ملف التسجيل غير موجود"); continue; }
        try { await (deps.toWav ?? ffmpegToWav)(src, wav); items.push({ id: c.row.id, wav }); }
        catch (e) { failed.set(c.row.id, (e as Error).message.slice(0, 200)); }
      }
      const heard = await deps.transcribe(items);
      const fresh = await readResults(scriptPath);
      const at = new Date().toISOString();
      for (const c of todo) {
        const t = heard.get(c.row.id);
        const error = failed.get(c.row.id) ?? t?.error ?? (t?.text === undefined ? "لم يعد التفريغ بنتيجة" : undefined);
        const base = { file: c.row.audio!.file, textKey: c.key, model: MODEL, at };
        if (error) { fresh.results[c.row.id] = { ...base, transcript: "", verdict: "error", suspects: [], flaggable: 0, matched: 0, error }; continue; }
        const cmp = compareTranscript(c.ref, t!.text!);
        fresh.results[c.row.id] = { ...base, transcript: t!.text!, verdict: cmp.verdict, suspects: cmp.suspects, flaggable: cmp.flaggable, matched: cmp.matched };
      }
      await writeJsonAtomic(resultsFileFor(scriptPath), fresh);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  }
  const after = await readResults(scriptPath);
  return { checked: todo.length, rows, results: currentResults(rows, after), pending: pendingRows(rows, after).length };
};
