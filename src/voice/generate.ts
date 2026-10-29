import path from "node:path";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { parseFile } from "music-metadata";
import config from "../../config.json";
import { channelPaths } from "../channel";
import { resolveScriptPath } from "../script/episodes";
import { loadPlan, readJson, regeneratePlan } from "../plan/io";
import type { Plan } from "../plan/types";
import type { ElevenLabsClient } from "./elevenlabs";
import { alignmentToWords, applyDictionary, wordsForCaptions, type TimedWord } from "./words";

/** مقطع صوتي لمشهد: الملف ومدته وتوقيت كلماته الأصلية. */
export type VoiceClip = { file: string; hash: string; text: string; duration: number; words: TimedWord[] };
export type VoiceIndex = Record<string, VoiceClip>;

export const voiceDirFor = (scriptPath: string) => path.join(path.dirname(scriptPath), "voice");

export const loadVoiceIndex = async (episode: string): Promise<VoiceIndex> =>
  (await readJson<VoiceIndex>(path.join(voiceDirFor(await resolveScriptPath(episode)), "index.json"))) ?? {};

/** قاموس نطق القناة الحالية: channels/<القناة>/pronunciation.json */
const loadDictionary = async () => readJson<{ entries?: { text: string; say: string }[] }>(channelPaths().pronunciation).then((d) => d ?? {});

type Job = { id: string; narration: string; spoken: string; original: string[]; owner: number[]; hash: string; prev?: string; next?: string };

const jobsFor = async (plan: Plan, voiceKey: string) => {
  const dict = await loadDictionary();
  const scenes = plan.chapters.flatMap((c) => c.scenes).filter((s) => s.narration.trim());
  return scenes.map((s, i): Job => {
    const d = applyDictionary(s.narration.trim(), dict);
    const hash = createHash("sha1").update(JSON.stringify({ spoken: d.spoken, voiceKey, v: config.voice })).digest("hex").slice(0, 16);
    return { id: s.id, narration: s.narration.trim(), spoken: d.spoken, original: d.original, owner: d.owner, hash, prev: scenes[i - 1]?.narration, next: scenes[i + 1]?.narration };
  });
};

export type VoicePlanReport = { total: number; toGenerate: { id: string; chars: number }[]; cached: string[]; chars: number; credits: number };

export type GenerateVoiceOptions = {
  client?: ElevenLabsClient | null;
  /** يحسب التكلفة فقط بلا توليد */
  dryRun?: boolean;
  force?: boolean;
  /** مشاهد محددة فقط */
  only?: string[];
  onProgress?: (msg: string) => void;
};

/**
 * يولّد صوت كل مشهد له تعليق. لا يعيد توليد مشهد لم يتغير نصه ولا إعداداته (بصمة hash)،
 * فتعديل جملة واحدة لا يكلّف إلا تلك الجملة.
 */
export const generateVoice = async (episode: string, opts: GenerateVoiceOptions = {}): Promise<VoicePlanReport> => {
  const log = opts.onProgress ?? (() => {});
  const scriptPath = await resolveScriptPath(episode);
  const plan = (await loadPlan(episode)) ?? (await regeneratePlan(episode));
  const dir = voiceDirFor(scriptPath);
  await mkdir(dir, { recursive: true });
  const indexFile = path.join(dir, "index.json");
  const index: VoiceIndex = (await readJson<VoiceIndex>(indexFile)) ?? {};
  const voiceKey = `${process.env.ELEVENLABS_VOICE_ID ?? ""}|${process.env.ELEVENLABS_MODEL_ID || config.voice.modelId}`;
  const jobs = (await jobsFor(plan, voiceKey)).filter((j) => !opts.only || opts.only.includes(j.id));

  const isCached = (j: Job) => !opts.force && index[j.id]?.hash === j.hash && existsSync(path.join(dir, index[j.id]!.file));
  const todo = jobs.filter((j) => !isCached(j));
  const chars = todo.reduce((n, j) => n + j.spoken.length, 0);
  const report: VoicePlanReport = {
    total: jobs.length,
    toGenerate: todo.map((j) => ({ id: j.id, chars: j.spoken.length })),
    cached: jobs.filter(isCached).map((j) => j.id),
    chars,
    credits: Math.ceil(chars * config.voice.creditsPerChar),
  };
  if (opts.dryRun || todo.length === 0) return report;
  if (!opts.client) throw new Error("مفاتيح ElevenLabs غير موجودة. أضف ELEVENLABS_API_KEY وELEVENLABS_VOICE_ID إلى ملف .env.");

  for (const [k, j] of todo.entries()) {
    log(`(${k + 1}/${todo.length}) ${j.id}: ${j.spoken.length} حرفًا`);
    const r = await opts.client.tts(j.spoken, { previousText: j.prev, nextText: j.next });
    const file = `${j.id}.mp3`;
    await writeFile(path.join(dir, file), r.audio);
    const spokenWords = alignmentToWords(r.alignment);
    const words = wordsForCaptions(j.original, j.owner, spokenWords);
    let duration = spokenWords.length ? spokenWords[spokenWords.length - 1]!.end : 0;
    try {
      duration = (await parseFile(path.join(dir, file), { duration: true })).format.duration ?? duration;
    } catch {
      /* نكتفي بتوقيت النص */
    }
    index[j.id] = { file, hash: j.hash, text: j.narration, duration, words };
    await writeFile(indexFile, JSON.stringify(index, null, 2) + "\n");
  }

  // حذف مقاطع مشاهد لم تعد موجودة
  const live = new Set((await jobsFor(plan, voiceKey)).map((j) => j.id));
  for (const id of Object.keys(index)) {
    if (!live.has(id)) {
      await unlink(path.join(dir, index[id]!.file)).catch(() => {});
      delete index[id];
    }
  }
  await writeFile(indexFile, JSON.stringify(index, null, 2) + "\n");
  return report;
};

/** يقرأ ملف صوت ويعيد مدته بالثواني (للتلاوات والمؤثرات). */
export const audioDuration = async (file: string): Promise<number | null> => {
  try {
    return (await parseFile(file, { duration: true })).format.duration ?? null;
  } catch {
    return null;
  }
};

export const readText = (f: string) => readFile(f, "utf8");
