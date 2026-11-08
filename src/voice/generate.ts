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
export type VoiceClip = {
  file: string;
  hash: string;
  text: string;
  duration: number;
  words: TimedWord[];
  /**
   * دفاتر الزمن (أجزاء خريطة النبرة، src/voice/dafatirParts.ts): المشهد مركّب من أجزائه المقصوصة،
   * ومدته المقررة بسياسة الصمت (رأس بعد الآية + آخر كلام + ذيل الحد). بلا هذا الحقل يبقى الحساب العام كما هو.
   */
  timing?: { pre: number; tail: number; seconds: number; speechStart: number; speechEnd: number; toneMap: string; parts: { partId: string; at: number; trimStart: number; trimEnd: number }[] };
};
export type VoiceIndex = Record<string, VoiceClip>;

export const voiceDirFor = (scriptPath: string) => path.join(path.dirname(scriptPath), "voice");

export const loadVoiceIndex = async (episode: string): Promise<VoiceIndex> =>
  (await readJson<VoiceIndex>(path.join(voiceDirFor(await resolveScriptPath(episode)), "index.json"))) ?? {};

/** قاموس نطق القناة الحالية: channels/<القناة>/pronunciation.json */
const loadDictionary = async () => readJson<{ entries?: { text: string; say: string }[] }>(channelPaths().pronunciation).then((d) => d ?? {});

type Job = { id: string; /** المشهد (في مسار الأجزاء: مشهد الجزء) */ scene?: string; narration: string; spoken: string; original: string[]; owner: number[]; hash: string; prev?: string; next?: string; voiceId?: string; tune?: { stability: number; style: number; speed: number } };

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

/** مهام مسار الأجزاء (دفاتر الزمن): جزء لكل مهمة، بنبرته من خريطة النبرة ونصه المشكول منها */
const partsJobsFor = async (ctx: import("./dafatirParts").PartsContext, voiceKey: string): Promise<Job[]> => {
  const dict = await loadDictionary();
  let profile: VoiceProfile | undefined;
  try {
    profile = loadChannel().voice?.profile;
  } catch {
    /* بلا قناة */
  }
  const { tailSeconds: _t, creditsPerChar: _c, ...tts } = config.voice;
  return ctx.jobs.map((p, i): Job => {
    const d = applyDictionary(p.text, dict);
    const tune = voiceSettingsFor(profile, isTone(p.tone) ? p.tone : undefined);
    const hash = createHash("sha1").update(JSON.stringify({ part: p.partId, spoken: d.spoken, voiceKey, v: tts, ...(tune ? { tune } : {}) })).digest("hex").slice(0, 16);
    return { id: p.partId, scene: p.scene, narration: p.text, spoken: d.spoken, original: d.original, owner: d.owner, hash, prev: ctx.jobs[i - 1]?.text, next: ctx.jobs[i + 1]?.text, tune };
  });
};

export type VoicePlanReport = { total: number; toGenerate: { id: string; chars: number }[]; cached: string[]; chars: number; credits: number; missingTones: string[]; /** مدقق التشكيل للمشاهد المطلوبة */ tashkeel: TashkeelReport; /** سجل التوثيق */ review: ReviewSummary };

export type GenerateVoiceOptions = {
  client?: ElevenLabsClient | null;
  /** يحسب التكلفة فقط بلا توليد */
  dryRun?: boolean;
  force?: boolean;
  /** مشاهد محددة فقط */
  only?: string[];
  onProgress?: (msg: string) => void;
  /**
   * للاختبارات المعزولة فقط (لا يصل إليها سطر الأوامر ولا الاستوديو ولا مهام الخلفية):
   * تشغيل التخزين المؤقت للصوت على حلقة اختبار بلا تشكيل ولا اعتمادات.
   */
  testOnlySkipGates?: boolean;
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
  // دفاتر الزمن مع خريطة نبرة: التوليد بأجزاء الخريطة (s001–s088)، لا بمشهد كامل. غير ذلك: المسار العام كما هو
  const parts = await (await import("./dafatirParts")).loadPartsContext(scriptPath, plan);
  const sceneOf = (j: Job) => j.scene ?? j.id;
  const allJobs = parts ? await partsJobsFor(parts, voiceKey) : await jobsFor(plan, voiceKey, scriptPath);
  const jobs = allJobs.filter((j) => !opts.only || opts.only.includes(sceneOf(j)));
  const partsDir = path.join(dir, "parts");
  const partsIndexFile = path.join(partsDir, "index.json");
  type PartClipRecord = { file: string; hash: string; text: string; duration: number; words: TimedWord[] };
  const partsIndex: Record<string, PartClipRecord> = parts ? ((await readJson<Record<string, PartClipRecord>>(partsIndexFile)) ?? {}) : {};

  // مقطع بنفس البصمة موجود لمشهد آخر (انزاح رقمه بعد إضافة فقرة): يُعاد استخدامه بلا تكلفة
  const byHash = new Map<string, VoiceClip>();
  if (parts) {
    for (const c of Object.values(partsIndex)) if (existsSync(path.join(partsDir, c.file))) byHash.set(c.hash, c);
  } else for (const c of Object.values(index)) if (existsSync(path.join(dir, c.file))) byHash.set(c.hash, c);
  const isCached = (j: Job) => !opts.force && byHash.has(j.hash);
  const todo = jobs.filter((j) => !isCached(j));
  const chars = todo.reduce((n, j) => n + j.spoken.length, 0);
  const report: VoicePlanReport = {
    total: jobs.length,
    toGenerate: todo.map((j) => ({ id: j.id, chars: j.spoken.length })),
    cached: jobs.filter(isCached).map((j) => j.id),
    chars,
    credits: Math.ceil(chars * config.voice.creditsPerChar),
    missingTones: parts
      ? [...new Set(parts.jobs.filter((p) => (!opts.only || opts.only.includes(p.scene)) && !isTone(p.tone)).map((p) => p.scene))]
      : plan.chapters.flatMap((c) => c.scenes).filter((scene) => scene.narration.trim() && (!opts.only || opts.only.includes(scene.id)) && !isTone(scene.tone)).map((scene) => scene.id),
    tashkeel: tashkeelReport(
      plan.chapters.flatMap((c) => c.scenes).filter((s) => s.narration.trim() && (!opts.only || opts.only.includes(s.id))),
      await loadTashkeel(scriptPath),
      await loadDictionary(),
    ),
    review: reviewSummary(reviewItems(parseScript(await readFile(scriptPath, "utf8"), scriptPath), await loadLedger(scriptPath))),
  };
  if (opts.dryRun) return report;
  // لا يُصرف رصيد على كلمات سيخمّن النموذج نطقها
  if (todo.length && !report.tashkeel.ok && !opts.testOnlySkipGates) throw new Error(tashkeelBlockMessage(report.tashkeel));
  // ولا على مشهد لم يُعتمد في الستوري بورد (المبدأ الثالث: لا صوت قبل اعتماد ستوري بورد الفيديو)
  if (todo.length && !opts.testOnlySkipGates) {
    const sb = storyboardStatus(plan, await loadStoryboard(scriptPath));
    const blocked = unapprovedScenes(sb, [...new Set(todo.map(sceneOf))]);
    if (blocked.length) throw new Error(storyboardBlockMessage(blocked, sb));
  }
  // Script and storyboard approval: the scene-first ledger is the only authority (unified engine).
  if (todo.length && !opts.testOnlySkipGates) {
    const { requireScriptAndStoryboardApproved } = await import("../studio/sceneService");
    await requireScriptAndStoryboardApproved(episode);
  }
  // Order: storyboard signoff, then explicit tone decisions, then paid voice generation.
  if (todo.length && report.missingTones.length && !opts.testOnlySkipGates)
    throw new Error(`حدّد نبرة كل مقطع منطوق واعتمدها قبل توليد الصوت: ${report.missingTones.slice(0, 12).join("، ")}.`);
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
    if (c && parts) partsIndex[j.id] = { file: c.file, hash: c.hash, text: j.narration, duration: c.duration, words: c.words };
    else if (c) index[j.id] = { ...c, text: j.narration };
  }
  if (parts) await mkdir(partsDir, { recursive: true });

  for (const [k, j] of todo.entries()) {
    log(`(${k + 1}/${todo.length}) ${j.id}: ${j.spoken.length} حرفًا`);
    const r = await opts.client!.tts(j.spoken, { previousText: j.prev, nextText: j.next, voiceId: j.voiceId, tune: j.tune });
    // السرعة بعد التوليد للنماذج التي لا تقبلها (v4): تمديد زمني يحفظ طبقة الصوت، ومعه توقيت الكلمات
    const speed = caps.speed === "post" ? (j.tune?.speed ?? config.voice.speed) : 1;
    const audio = await applyTempo(r.audio, speed);
    // اسم الملف من البصمة: مشهدان بنفس النص يتشاركان الملف، والانزياح لا يكتب فوق مقطع آخر
    const file = `${j.hash}.mp3`;
    const fileDir = parts ? partsDir : dir;
    await writeFile(path.join(fileDir, file), audio);
    let duration = 0;
    try {
      duration = (await parseFile(path.join(fileDir, file), { duration: true })).format.duration ?? 0;
    } catch {
      /* يُقدَّر من التوقيت */
    }
    // أوامر الأداء لا تظهر في الترجمة أبدًا؛ وبلا توقيت من النموذج تُوزَّع الكلمات على المدة بطولها
    const spokenWords = r.alignment ? scaleTimes(dropTagWords(alignmentToWords(r.alignment)), speed) : estimateWords(j.spoken, duration);
    if (!duration) duration = spokenWords.length ? spokenWords[spokenWords.length - 1]!.end : 0;
    if (parts) {
      // الجزء يحفظ كلماته المنطوقة بزمن ملفه؛ تُحوَّل إلى زمن المشهد عند التركيب
      partsIndex[j.id] = { file, hash: j.hash, text: j.narration, duration, words: spokenWords };
      byHash.set(j.hash, partsIndex[j.id]!);
      await writeFile(partsIndexFile, JSON.stringify(partsIndex, null, 2) + "\n");
      continue;
    }
    const words = wordsForCaptions(j.original, j.owner, spokenWords);
    index[j.id] = { file, hash: j.hash, text: j.narration, duration, words };
    byHash.set(j.hash, index[j.id]!);
    await writeFile(indexFile, JSON.stringify(index, null, 2) + "\n");
  }

  if (parts) {
    await (await import("./dafatirParts")).composePartsIntoScenes({ plan, parts, partsIndex, partsDir, dir, index, allJobs, log });
    // تنظيف: أجزاء لم تعد في الخريطة، وملفات لا يشير إليها جزء ولا مشهد
    const liveParts = new Set(allJobs.map((j) => j.id));
    for (const id of Object.keys(partsIndex)) if (!liveParts.has(id)) delete partsIndex[id];
    await writeFile(partsIndexFile, JSON.stringify(partsIndex, null, 2) + "\n");
    const usedParts = new Set(Object.values(partsIndex).map((c) => c.file));
    for (const f of await readdir(partsDir)) if (f.endsWith(".mp3") && !usedParts.has(f)) await unlink(path.join(partsDir, f)).catch(() => {});
    const liveScenes = new Set(allJobs.map(sceneOf));
    for (const id of Object.keys(index)) if (!liveScenes.has(id)) delete index[id];
    const used = new Set(Object.values(index).map((c) => c.file));
    for (const f of await readdir(dir)) if (/\.(mp3|wav)$/.test(f) && !used.has(f)) await unlink(path.join(dir, f)).catch(() => {});
    await writeFile(indexFile, JSON.stringify(index, null, 2) + "\n");
    return report;
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

/**
 * صوت الراوي لجمل مستقلة عن خطة المشاهد (مثل معاينة لقطات مختارة): نفس التشكيل والقاموس ونبرة القناة والسرعة
 * التي يستعملها generateVoice، لكن في مجلد مستقل بفهرس خاص، فلا يحذف أحدهما ملفات الآخر.
 * يُعاد استعمال المقطع إن لم يتغير نصه ولا الصوت ولا إعداداته (البصمة).
 */
export type LineClip = { file: string; hash: string; text: string; duration: number; words: TimedWord[] };
export const synthesizeLines = async (
  scriptPath: string,
  lines: { id: string; text: string }[],
  opts: { client: ElevenLabsClient; dir: string; force?: boolean; onProgress?: (m: string) => void },
): Promise<Record<string, LineClip>> => {
  const log = opts.onProgress ?? (() => {});
  await mkdir(opts.dir, { recursive: true });
  const indexFile = path.join(opts.dir, "index.json");
  const index: Record<string, LineClip> = (await readJson<Record<string, LineClip>>(indexFile)) ?? {};
  const model = process.env.ELEVENLABS_MODEL_ID || config.voice.modelId;
  const caps = capsFor(model);
  const voiceKey = `${voiceIdFor() ?? ""}|${model}`;
  const dict = await loadDictionary();
  const tk = await loadTashkeel(scriptPath);
  let channelTone: string | undefined;
  let profile: VoiceProfile | undefined;
  try {
    const v = loadChannel().voice;
    channelTone = v?.tone;
    profile = v?.profile;
  } catch {
    /* بلا قناة */
  }
  const toneId = [channelTone].find(isTone);
  const tune = voiceSettingsFor(profile, toneId);
  const { tailSeconds: _t, creditsPerChar: _c, ...tts } = config.voice;
  const out: Record<string, LineClip> = {};
  for (const [k, line] of lines.entries()) {
    const text = line.text.trim();
    const words = text.split(/\s+/).filter(Boolean);
    const d = applyDictionary(text, dict, tk ? vowelize(words, tk) : undefined);
    const hash = createHash("sha1").update(JSON.stringify({ spoken: d.spoken, voiceKey, v: tts, ...(tune ? { tune } : {}) })).digest("hex").slice(0, 16);
    const have = index[line.id];
    if (!opts.force && have && have.hash === hash && existsSync(path.join(opts.dir, have.file))) {
      out[line.id] = have;
      continue;
    }
    log(`(${k + 1}/${lines.length}) ${line.id}: ${d.spoken.length} حرفًا`);
    const r = await opts.client.tts(d.spoken, { previousText: lines[k - 1]?.text, nextText: lines[k + 1]?.text, tune });
    const speed = caps.speed === "post" ? (tune?.speed ?? config.voice.speed) : 1;
    const audio = await applyTempo(r.audio, speed);
    const file = `${hash}.mp3`;
    await writeFile(path.join(opts.dir, file), audio);
    let duration = (await audioDuration(path.join(opts.dir, file))) ?? 0;
    const spokenWords = r.alignment ? scaleTimes(dropTagWords(alignmentToWords(r.alignment)), speed) : estimateWords(d.spoken, duration);
    const timed = wordsForCaptions(d.original, d.owner, spokenWords);
    if (!duration) duration = spokenWords.length ? spokenWords[spokenWords.length - 1]!.end : 0;
    out[line.id] = index[line.id] = { file, hash, text, duration, words: timed };
    await writeFile(indexFile, JSON.stringify(index, null, 2) + "\n");
  }
  return out;
};

/** فحص التشكيل (حد 98%) لجمل مستقلة قبل صرف أي رصيد على توليد صوتها */
export const tashkeelForLines = async (scriptPath: string, lines: { id: string; text: string }[]) =>
  tashkeelReport(lines.map((l) => ({ id: l.id, narration: l.text })), await loadTashkeel(scriptPath), await loadDictionary());
export { tashkeelBlockMessage };
