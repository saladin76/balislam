import path from "node:path";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile, unlink } from "node:fs/promises";
import { parseFile } from "music-metadata";
import config from "../../config.json";
import { channelPaths } from "../channel";
import { resolveScriptPath } from "../script/episodes";
import { loadPlan, readJson, regeneratePlan } from "../plan/io";
import type { Plan } from "../plan/types";
import { voiceIdFor, type ElevenLabsClient } from "./elevenlabs";
import { isTone, voiceSettingsFor } from "./tones";
import type { VoiceProfile } from "../channel/types";
import { loadChannel } from "../channel/index";
import { alignmentToWords, applyDictionary, wordsForCaptions, type TimedWord } from "./words";
import { buildTashkeelIndex, vowelize, type TashkeelIndex } from "./tashkeel";
import { tashkeelBlockMessage, tashkeelReport, type TashkeelReport } from "./tashkeelReport";
import { parseScript } from "../script/parse";
import { loadLedger, reviewItems, reviewSummary, type ReviewSummary } from "../script/review";
import { loadStoryboard, storyboardBlockMessage, storyboardStatus, unapprovedScenes } from "../plan/storyboard";
import { capsFor, dropTagWords } from "./models";
import { applyTempo, scaleTimes } from "./tempo";

/** مقطع صوتي لمشهد: الملف ومدته وتوقيت كلماته الأصلية. */
export type VoiceClip = { file: string; hash: string; text: string; duration: number; words: TimedWord[] };
export type VoiceIndex = Record<string, VoiceClip>;

export const voiceDirFor = (scriptPath: string) => path.join(path.dirname(scriptPath), "voice");

export const loadVoiceIndex = async (episode: string): Promise<VoiceIndex> =>
  (await readJson<VoiceIndex>(path.join(voiceDirFor(await resolveScriptPath(episode)), "index.json"))) ?? {};

/** قاموس نطق القناة الحالية: channels/<القناة>/pronunciation.json */
const loadDictionary = async () => readJson<{ entries?: { text: string; say: string }[] }>(channelPaths().pronunciation).then((d) => d ?? {});

type Job = { id: string; narration: string; spoken: string; original: string[]; owner: number[]; hash: string; prev?: string; next?: string; voiceId?: string; tune?: { stability: number; style: number; speed: number } };

/** نسخة السكريبت المشكولة للنطق (اختيارية): tashkeel.md بجوار script.md */
export const tashkeelFileFor = (scriptPath: string) => path.join(path.dirname(scriptPath), "tashkeel.md");
const loadTashkeel = async (scriptPath?: string): Promise<TashkeelIndex | null> => {
  if (!scriptPath || !existsSync(tashkeelFileFor(scriptPath))) return null;
  return buildTashkeelIndex(await readFile(tashkeelFileFor(scriptPath), "utf8"));
};

const jobsFor = async (plan: Plan, voiceKey: string, scriptPath?: string) => {
  const dict = await loadDictionary();
  const tk = await loadTashkeel(scriptPath);
  const scenes = plan.chapters.flatMap((c) => c.scenes).filter((s) => s.narration.trim());
  let channelTone: string | undefined;
  let profile: VoiceProfile | undefined;
  try {
    const v = loadChannel().voice;
    channelTone = v?.tone;
    profile = v?.profile;
  } catch {
    /* بلا قناة */
  }
  return scenes.map((s, i): Job => {
    const words = s.narration.trim().split(/\s+/).filter(Boolean);
    const d = applyDictionary(s.narration.trim(), dict, tk ? vowelize(words, tk) : undefined);
    // النبرة: المشهد ← الحلقة ← القناة. والصوت: صوت شخصية للمشهد أو صوت القناة
    const toneId = [s.tone, plan.tone, channelTone].find(isTone);
    // طبقة القناة ثم النبرة فوقها (صوت صاحب القناة هو المرجع دائمًا)
    const tune = voiceSettingsFor(profile, toneId);
    // البصمة من كل ما يغيّر الصوت نفسه فقط (لا مدة الذيل ولا حساب التكلفة)؛ النبرة والصوت يدخلانها فقط إن حُددا
    const { tailSeconds: _t, creditsPerChar: _c, ...tts } = config.voice;
    const extra = { ...(tune ? { tune } : {}), ...(s.voice ? { voice: s.voice } : {}) };
    const hash = createHash("sha1").update(JSON.stringify({ spoken: d.spoken, voiceKey, v: tts, ...extra })).digest("hex").slice(0, 16);
    return { id: s.id, narration: s.narration.trim(), spoken: d.spoken, original: d.original, owner: d.owner, hash, prev: scenes[i - 1]?.narration, next: scenes[i + 1]?.narration, voiceId: s.voice || undefined, tune };
  });
};

export type VoicePlanReport = { total: number; toGenerate: { id: string; chars: number }[]; cached: string[]; chars: number; credits: number; /** مدقق التشكيل للمشاهد المطلوبة */ tashkeel: TashkeelReport; /** سجل التوثيق */ review: ReviewSummary };

export type GenerateVoiceOptions = {
  client?: ElevenLabsClient | null;
  /** يحسب التكلفة فقط بلا توليد */
  dryRun?: boolean;
  force?: boolean;
  /** مشاهد محددة فقط */
  only?: string[];
  onProgress?: (msg: string) => void;
  /** توليد رغم نقص التشكيل (من سطر الأوامر فقط، بقرار صاحب القناة) */
  ignoreTashkeel?: boolean;
  /** خيار قديم للتوافق مع أوامر سابقة؛ لم يعد التوثيق يمنع توليد الصوت. */
  ignoreReview?: boolean;
  /** توليد قبل اعتماد الستوري بورد (من سطر الأوامر فقط، بقرار صاحب القناة) */
  ignoreStoryboard?: boolean;
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
  const model = process.env.ELEVENLABS_MODEL_ID || config.voice.modelId;
  const caps = capsFor(model);
  const voiceKey = `${voiceIdFor() ?? ""}|${model}`;
  const jobs = (await jobsFor(plan, voiceKey, scriptPath)).filter((j) => !opts.only || opts.only.includes(j.id));

  // مقطع بنفس البصمة موجود لمشهد آخر (انزاح رقمه بعد إضافة فقرة): يُعاد استخدامه بلا تكلفة
  const byHash = new Map<string, VoiceClip>();
  for (const c of Object.values(index)) if (existsSync(path.join(dir, c.file))) byHash.set(c.hash, c);
  const isCached = (j: Job) => !opts.force && byHash.has(j.hash);
  const todo = jobs.filter((j) => !isCached(j));
  const chars = todo.reduce((n, j) => n + j.spoken.length, 0);
  const report: VoicePlanReport = {
    total: jobs.length,
    toGenerate: todo.map((j) => ({ id: j.id, chars: j.spoken.length })),
    cached: jobs.filter(isCached).map((j) => j.id),
    chars,
    credits: Math.ceil(chars * config.voice.creditsPerChar),
    tashkeel: tashkeelReport(
      plan.chapters.flatMap((c) => c.scenes).filter((s) => s.narration.trim() && (!opts.only || opts.only.includes(s.id))),
      await loadTashkeel(scriptPath),
      await loadDictionary(),
    ),
    review: reviewSummary(reviewItems(parseScript(await readFile(scriptPath, "utf8"), scriptPath), await loadLedger(scriptPath))),
  };
  if (opts.dryRun) return report;
  // لا يُصرف رصيد على كلمات سيخمّن النموذج نطقها
  if (todo.length && !report.tashkeel.ok && !opts.ignoreTashkeel) throw new Error(tashkeelBlockMessage(report.tashkeel));
  // ولا على مشهد لم يُعتمد في الستوري بورد (المبدأ الثالث: لا صوت قبل اعتماد ستوري بورد الفيديو)
  if (todo.length && !opts.ignoreStoryboard) {
    const sb = storyboardStatus(plan, await loadStoryboard(scriptPath));
    const blocked = unapprovedScenes(sb, todo.map((j) => j.id));
    if (blocked.length) throw new Error(storyboardBlockMessage(blocked, sb));
  }
  if (todo.length && !opts.client) throw new Error("مفاتيح ElevenLabs غير موجودة. أضف المفتاح واختر الصوت من تبويب «الإعدادات» في الاستوديو.");
  // الصوت الاحترافي يجب أن يكون مدرَّبًا على النموذج قبل صرف أي رصيد (لا رجوع صامت لنموذج آخر: صوت الحلقة واحد)
  if (todo.length && opts.client?.voiceInfo) {
    const info = await opts.client.voiceInfo().catch(() => null);
    const state = info?.category === "professional" ? info.training[model] : undefined;
    if (info?.category === "professional" && state !== "fine_tuned")
      throw new Error(`صوتك «${info.name}» غير مدرَّب بعد على ${model}${state ? ` (الحالة: ${state})` : ""}. في ElevenLabs: My Voices ← مرّر على صوتك ← زر + بجانب النموذج، وانتظر انتهاء التدريب؛ أو اختر نموذجًا آخر من «الإعدادات».`);
  }

  // ربط المشاهد بمقاطعها المحفوظة (حتى لو تغيّر رقم المشهد)
  for (const j of jobs) {
    const c = isCached(j) ? byHash.get(j.hash) : undefined;
    if (c) index[j.id] = { ...c, text: j.narration };
  }

  for (const [k, j] of todo.entries()) {
    log(`(${k + 1}/${todo.length}) ${j.id}: ${j.spoken.length} حرفًا`);
    const r = await opts.client!.tts(j.spoken, { previousText: j.prev, nextText: j.next, voiceId: j.voiceId, tune: j.tune });
    // السرعة بعد التوليد للنماذج التي لا تقبلها (v4): تمديد زمني يحفظ طبقة الصوت، ومعه توقيت الكلمات
    const speed = caps.speed === "post" ? (j.tune?.speed ?? config.voice.speed) : 1;
    const audio = await applyTempo(r.audio, speed);
    // اسم الملف من البصمة: مشهدان بنفس النص يتشاركان الملف، والانزياح لا يكتب فوق مقطع آخر
    const file = `${j.hash}.mp3`;
    await writeFile(path.join(dir, file), audio);
    let duration = 0;
    try {
      duration = (await parseFile(path.join(dir, file), { duration: true })).format.duration ?? 0;
    } catch {
      /* يُقدَّر من التوقيت */
    }
    // أوامر الأداء لا تظهر في الترجمة أبدًا؛ وبلا توقيت من النموذج تُوزَّع الكلمات على المدة بطولها
    const spokenWords = r.alignment ? scaleTimes(dropTagWords(alignmentToWords(r.alignment)), speed) : estimateWords(j.spoken, duration);
    const words = wordsForCaptions(j.original, j.owner, spokenWords);
    if (!duration) duration = spokenWords.length ? spokenWords[spokenWords.length - 1]!.end : 0;
    index[j.id] = { file, hash: j.hash, text: j.narration, duration, words };
    byHash.set(j.hash, index[j.id]!);
    await writeFile(indexFile, JSON.stringify(index, null, 2) + "\n");
  }

  // تنظيف: مشاهد لم تعد موجودة، وملفات لم يعد يشير إليها أي مشهد
  const live = new Set((await jobsFor(plan, voiceKey, scriptPath)).map((j) => j.id));
  for (const id of Object.keys(index)) if (!live.has(id)) delete index[id];
  const used = new Set(Object.values(index).map((c) => c.file));
  for (const f of await readdir(dir)) if (f.endsWith(".mp3") && !used.has(f)) await unlink(path.join(dir, f)).catch(() => {});
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


/** توقيت تقديري للكلمات بطول حروفها (حين لا يُرجع النموذج توقيتًا) */
export const estimateWords = (spoken: string, duration: number): TimedWord[] => {
  const ws = spoken.split(/\s+/).filter(Boolean);
  const total = ws.reduce((n, w) => n + w.length + 1, 0) || 1;
  let t = 0;
  return ws.map((w) => {
    const d = (duration * (w.length + 1)) / total;
    const out = { word: w, start: t, end: t + d * 0.92 };
    t += d;
    return out;
  });
};
