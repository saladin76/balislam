/**
 * `bal voice-timing` (D110): measurement only. For the recordings already on this computer, how far do their
 * word timings run past the decoded file? It reads voice/sentences.json (each sentence's current recording and,
 * with `takes`, its older takes) and voice/parts/index.json (Dafatir parts), decodes each file with ffmpeg at the
 * rate the stitcher uses, and classifies it with the stitcher's own rule (`alignmentVerdict`): ok, clamped (a bounded
 * overshoot the stitcher trims to the file, with a warning), or corrupt (refused). Nothing is written, generated,
 * sent or deleted; a missing file is listed, not an error. Its numbers are what ALIGNMENT_OVERSHOOT_MAX_SEC is
 * checked against.
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { ALIGNMENT_OVERSHOOT_MAX_SEC, alignmentVerdict } from "../remotion/dafatir/audio/trim";

export type TimingKind = "sentence" | "take" | "part";
export type TimingVerdict = "ok" | "clamped" | "corrupt" | "missing" | "unreadable" | "no-words";
export type TimingRow = {
  channel: string; episode: string; kind: TimingKind; scene?: string; id: string; file: string;
  verdict: TimingVerdict; duration?: number; words: number;
  overshootEndMs?: number; undershootStartMs?: number; disorder?: number; reason?: string;
};
export type TimingSummary = {
  limitMs: number; files: number;
  counts: Record<TimingVerdict, number>;
  /** overshoot past the end over every measured file (0 for those within it), in ms */
  overshootMs: { max: number; p50: number; p95: number; p99: number };
  /** the largest start before 0, in ms */
  undershootMaxMs: number;
};
/** Decoded length in seconds of one audio file (ffmpeg in the studio; injected in tests). */
export type DurationOf = (file: string, sampleRate: number) => Promise<number>;

const SENTENCE_RATE = 44100; // SENTENCE_SAMPLE_RATE in sentenceVoice.ts
const PARTS_RATE = 44100;    // PARTS_SAMPLE_RATE in dafatirParts.ts

export const ffmpegDuration: DurationOf = async (file, sampleRate) => {
  const { decodeAudio } = await import("./dafatirParts");
  return (await decodeAudio(file, sampleRate)).length / sampleRate;
};

type Timed = { start: number; end: number }[];
type Item = { kind: TimingKind; scene?: string; id: string; file: string; words: Timed; rate: number };

const itemsOf = async (episodeDir: string, takes: boolean): Promise<Item[]> => {
  const voice = path.join(episodeDir, "voice");
  const out: Item[] = [];
  const sentencesFile = path.join(voice, "sentences.json");
  if (existsSync(sentencesFile)) {
    const doc = JSON.parse(await readFile(sentencesFile, "utf8")) as { scenes?: Record<string, { sentences?: { id: string; audio?: { file: string; words?: Timed }; takes?: { file: string; words?: Timed }[] }[] }> };
    for (const [scene, sc] of Object.entries(doc.scenes ?? {})) for (const s of sc.sentences ?? []) {
      if (s.audio?.file) out.push({ kind: "sentence", scene, id: s.id, file: path.join(voice, "sentences", s.audio.file), words: s.audio.words ?? [], rate: SENTENCE_RATE });
      if (takes) for (const t of s.takes ?? []) if (t?.file) out.push({ kind: "take", scene, id: s.id, file: path.join(voice, "sentences", t.file), words: t.words ?? [], rate: SENTENCE_RATE });
    }
  }
  const partsFile = path.join(voice, "parts", "index.json");
  if (existsSync(partsFile)) {
    const idx = JSON.parse(await readFile(partsFile, "utf8")) as Record<string, { file: string; words?: Timed }>;
    for (const [id, r] of Object.entries(idx)) if (r?.file) out.push({ kind: "part", id, file: path.join(voice, "parts", r.file), words: r.words ?? [], rate: PARTS_RATE });
  }
  return out;
};

export const measureItem = async (channel: string, episode: string, it: Item, durationOf: DurationOf): Promise<TimingRow> => {
  const row: TimingRow = { channel, episode, kind: it.kind, ...(it.scene ? { scene: it.scene } : {}), id: it.id, file: path.basename(it.file), verdict: "ok", words: it.words.length };
  if (!existsSync(it.file)) return { ...row, verdict: "missing" };
  if (!it.words.length) return { ...row, verdict: "no-words" };
  let duration: number;
  try { duration = await durationOf(it.file, it.rate); }
  catch (e) { return { ...row, verdict: "unreadable", reason: (e as Error).message.slice(0, 200) }; }
  const start = it.words.map((w) => w.start), end = it.words.map((w) => w.end);
  const finite = (xs: number[]) => xs.filter(Number.isFinite);
  const over = finite(end).length ? Math.max(0, Math.max(...finite(end)) - duration) : 0;
  const under = finite(start).length ? Math.max(0, -Math.min(...finite(start))) : 0;
  const v = alignmentVerdict(duration, { start, end });
  const ms = (x: number) => Math.round(x * 1000);
  return {
    ...row, duration: Math.round(duration * 1000) / 1000, verdict: v.kind,
    overshootEndMs: ms(over), undershootStartMs: ms(under),
    ...(v.kind === "clamped" ? { disorder: v.clamp.disorder } : {}),
    ...(v.kind === "corrupt" ? { reason: String(v.detail.reason) } : {}),
  };
};

const pct = (sorted: number[], p: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)]! : 0);
export const summarize = (rows: TimingRow[]): TimingSummary => {
  const counts = { ok: 0, clamped: 0, corrupt: 0, missing: 0, unreadable: 0, "no-words": 0 } as Record<TimingVerdict, number>;
  for (const r of rows) counts[r.verdict]++;
  const measured = rows.filter((r) => r.overshootEndMs !== undefined);
  const over = measured.map((r) => r.overshootEndMs!).sort((a, b) => a - b);
  return {
    limitMs: Math.round(ALIGNMENT_OVERSHOOT_MAX_SEC * 1000), files: rows.length, counts,
    overshootMs: { max: over.at(-1) ?? 0, p50: pct(over, 0.5), p95: pct(over, 0.95), p99: pct(over, 0.99) },
    undershootMaxMs: Math.max(0, ...measured.map((r) => r.undershootStartMs!)),
  };
};

/** Every episode folder (NNN-…) with a script of the given channels folder, or the one named. */
export const checkVoiceTimings = async (o: {
  channelsDir: string; channels: string[]; episode?: string; takes?: boolean; durationOf?: DurationOf;
}): Promise<{ rows: TimingRow[]; summary: TimingSummary }> => {
  const { listScriptEpisodeDirs } = await import("../script/episodes");
  const rows: TimingRow[] = [];
  for (const ch of o.channels) {
    const eps = path.join(o.channelsDir, ch, "episodes");
    for (const d of await listScriptEpisodeDirs(eps)) {
      if (o.episode && d.slice(0, 3) !== o.episode) continue;
      for (const it of await itemsOf(path.join(eps, d), o.takes === true))
        rows.push(await measureItem(ch, d.slice(0, 3), it, o.durationOf ?? ffmpegDuration));
    }
  }
  return { rows, summary: summarize(rows) };
};

const VERDICT_AR: Record<TimingVerdict, string> = {
  ok: "سليم", clamped: "حُصر (تنبيه)", corrupt: "تالف (يُرفض)", missing: "الملف غير موجود", unreadable: "تعذّر فكّه", "no-words": "بلا توقيت كلمات",
};
export const formatTimingReport = (r: { rows: TimingRow[]; summary: TimingSummary }, all = false): string => {
  const s = r.summary;
  const lines = [
    `قياس توقيت التسجيلات المحلية (لا توليد ولا كتابة). الحد الحالي: ${s.limitMs} م.ث.`,
    `الملفات: ${s.files} — ` + (Object.keys(VERDICT_AR) as TimingVerdict[]).map((k) => `${VERDICT_AR[k]} ${s.counts[k]}`).join("، "),
    `تجاوز النهاية: الأكبر ${s.overshootMs.max} م.ث، الوسيط ${s.overshootMs.p50}، ٩٥٪ ${s.overshootMs.p95}، ٩٩٪ ${s.overshootMs.p99}. أكبر بداية قبل الصفر: ${s.undershootMaxMs} م.ث.`,
  ];
  const shown = r.rows.filter((x) => all || (x.verdict !== "ok" && x.verdict !== "no-words"));
  for (const x of shown)
    lines.push(`  ${x.channel} ${x.episode} ${x.kind} ${x.scene ? x.scene + "/" : ""}${x.id} (${x.file}): ${VERDICT_AR[x.verdict]}` +
      (x.overshootEndMs !== undefined ? ` — نهاية +${x.overshootEndMs} م.ث، بداية −${x.undershootStartMs} م.ث` : "") + (x.reason ? ` — ${x.reason}` : ""));
  return lines.join("\n");
};
