import path from "node:path";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, stat } from "node:fs/promises";
import { readJsonFile, writeFileAtomic, writeJsonAtomic } from "../io/atomicJson";
import { withLock } from "../io/processLock";
import { parseFile } from "music-metadata";
import config from "../../config.json";
import { channelPaths } from "../channel";
import { resolveScriptPath } from "../script/episodes";
import { loadPlan, readJson, regeneratePlan } from "../plan/io";
import type { Plan } from "../plan/types";
import { voiceIdFor, type ElevenLabsClient } from "./elevenlabs";
import { effectiveTone, isTone, layersOf, legacyTunes, TONE_PRESET_VERSION, voiceSettingsFor, type VoiceLayers } from "./tones";
import type { VoiceProfile } from "../channel/types";
import { loadChannel } from "../channel/index";
import { alignmentToWords, applyDictionary, wordsForCaptions, type TimedWord } from "./words";
import { applyLexicon, loadLexicon } from "./lexicon";
import { buildTashkeelIndex, vowelize, type TashkeelIndex } from "./tashkeel";
import { tashkeelBlockMessage, tashkeelReport, type TashkeelReport } from "./tashkeelReport";
import { parseScript } from "../script/parse";
import { loadLedger, reviewItems, reviewSummary, type ReviewSummary } from "../script/review";
import { loadStoryboard, storyboardBlockMessage, storyboardStatus, unapprovedScenes } from "../plan/storyboard";
import { capsFor, dropTagWords } from "./models";
import { assertNoQuranForTts, isQuranFreeForTts, isVerseScene, planVerseTexts, QuranTtsError } from "./quranGuard";
import { applyTempo, scaleTimes } from "./tempo";
import { planOrder, sceneNames } from "../i18n/sceneNames";
import { hasBasmala } from "./basmala";

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
  /**
   * الصوت جملةً جملة (D50، src/voice/sentenceVoice.ts): الملف مركّب من تسجيلات جمل المشهد ووقفاتها.
   * مشهد له جمل لا يولّده المسار العام ولا مسار الأجزاء، ولا يُحذف مقطعه في التنظيف.
   */
  sentences?: { hash: string; ids: string[] };
  /**
   * إصدار النبرات الذي وُلّد به المقطع (src/voice/tones.ts). غيابه = الإصدار ١ (قبل ١١ نوفمبر).
   * مقطع بإصدار أقدم صالح ولا يُعاد آليًا، ويظهر عليه «وُلّد بالنبرة السابقة».
   */
  presetVersion?: number;
  /**
   * The basmala in this scene (owner decision 10 Nov, src/voice/basmala.ts): the owner's own approved
   * recording (its sha256) is composed in, or, while it is not approved yet, a marked silent placeholder
   * (`pending`) — a draft only, approved «مشروطًا بالتلاوة», never assembled into a Master.
   */
  basmala?: { pending: boolean; sha256: string | null };
};
export type VoiceIndex = Record<string, VoiceClip>;

export const voiceDirFor = (scriptPath: string) => path.join(path.dirname(scriptPath), "voice");

export const loadVoiceIndex = async (episode: string): Promise<VoiceIndex> =>
  (await readJson<VoiceIndex>(path.join(voiceDirFor(await resolveScriptPath(episode)), "index.json"))) ?? {};

/** قاموس نطق القناة الحالية: channels/<القناة>/pronunciation.json */
const loadDictionary = async () => readJson<{ entries?: { text: string; say: string }[] }>(channelPaths().pronunciation).then((d) => d ?? {});

type Job = { id: string; /** المشهد (في مسار الأجزاء: مشهد الجزء) */ scene?: string; narration: string; spoken: string; original: string[]; owner: number[]; hash: string;
  /** النص المرسل فعلًا بعد قاموس النطق للقناة (pronunciations.json): خارج البصمة، فلا يُبطل مقطعًا قائمًا */
  send?: string; sendOwner?: number[]; prev?: string; next?: string; voiceId?: string; tune?: { stability: number; style: number; speed: number };
  /** بصمات المقطع نفسه بإعدادات إصدارات النبرات السابقة: تسجيل قديم بإحداها صالح ولا يُعاد آليًا */
  legacyHashes?: string[];
  /** the episode's verse texts, for the Quran guard (never sent) */
  verses?: string[] };

/** نبرة القناة الافتراضية (channel.json ← voice.tone)، إن وُجدت */
const channelToneOf = (): string | undefined => {
  try {
    return loadChannel().voice?.tone;
  } catch {
    return undefined;
  }
};

/** نسخة السكريبت المشكولة للنطق (اختيارية): tashkeel.md بجوار script.md */
export const tashkeelFileFor = (scriptPath: string) => path.join(path.dirname(scriptPath), "tashkeel.md");
const loadTashkeel = async (scriptPath?: string): Promise<TashkeelIndex | null> => {
  if (!scriptPath || !existsSync(tashkeelFileFor(scriptPath))) return null;
  return buildTashkeelIndex(await readFile(tashkeelFileFor(scriptPath), "utf8"));
};
/** قاموس النطق والتشكيل معًا (للصوت جملةً جملة، src/voice/sentenceVoice.ts): النطق نفسه الذي يرسله المسار العام */
export const speechContextFor = async (scriptPath: string) => ({ dict: await loadDictionary(), tk: await loadTashkeel(scriptPath) });

const sha16 = (o: unknown) => createHash("sha1").update(JSON.stringify(o)).digest("hex").slice(0, 16);

const jobsFor = async (plan: Plan, voiceKey: string, scriptPath?: string, quranRefused?: string[]) => {
  const dict = await loadDictionary();
  const tk = await loadTashkeel(scriptPath);
  const lex = (await loadLexicon()).entries;
  // Verse scenes never produce a TTS job (the recitation is the owner's human recording), and a verse
  // between two narrated scenes is not sent as their context either (src/voice/quranGuard.ts).
  const all = plan.chapters.flatMap((c) => c.scenes);
  const verses = planVerseTexts(plan);
  const neighbour = (k: number, step: -1 | 1): string | undefined => {
    const n = all[k + step];
    return !n || isVerseScene(n) ? undefined : n.narration?.trim() || undefined;
  };
  const scenes = all.map((s, k) => ({ s, k })).filter(({ s }) => s.narration.trim() && !isVerseScene(s));
  let channelTone: string | undefined;
  let profile: VoiceProfile | undefined;
  let layers: VoiceLayers = {};
  try {
    const v = loadChannel().voice;
    channelTone = v?.tone;
    profile = v?.profile;
    layers = layersOf(v);
  } catch {
    /* بلا قناة */
  }
  return scenes.filter(({ s }) => {
    if (isQuranFreeForTts(s.narration, s, { verses })) return true;
    quranRefused?.push(s.id);
    return false;
  }).map(({ s, k }): Job => {
    const words = s.narration.trim().split(/\s+/).filter(Boolean);
    const d = applyDictionary(s.narration.trim(), dict, tk ? vowelize(words, tk) : undefined);
    // النبرة: المشهد ← الحلقة ← القناة. والصوت: صوت شخصية للمشهد أو صوت القناة
    const toneId = effectiveTone(s.tone, plan.tone, channelTone);
    // طبقة القناة ثم النبرة فوقها (صوت صاحب القناة هو المرجع دائمًا)
    const tune = voiceSettingsFor(profile, toneId, { text: s.narration });
    // البصمة من كل ما يغيّر الصوت نفسه فقط (لا مدة الذيل ولا حساب التكلفة)؛ النبرة والصوت يدخلانها فقط إن حُددا
    const { tailSeconds: _t, creditsPerChar: _c, ...tts } = config.voice;
    const extraFor = (t: typeof tune) => ({ ...(t ? { tune: t } : {}), ...(s.voice ? { voice: s.voice } : {}) });
    const hash = sha16({ spoken: d.spoken, voiceKey, v: tts, ...extraFor(tune) });
    // إصدار النبرات ليس سببًا لإعادة التوليد: بصمة المقطع بإعدادات الإصدار السابق تبقى صالحة (قرار ١١ نوفمبر)
    const legacyHashes = legacyTunes(layers, toneId).map((l) => sha16({ spoken: d.spoken, voiceKey, v: tts, ...extraFor(l.tune) })).filter((h) => h !== hash);
    const l = applyLexicon(d.original, d.spoken.split(" ").filter(Boolean), d.owner, lex);
    return { id: s.id, scene: s.id, narration: s.narration.trim(), spoken: d.spoken, original: d.original, owner: d.owner, hash, send: l.spoken.join(" "), sendOwner: l.owner, prev: neighbour(k, -1), next: neighbour(k, 1), voiceId: s.voice || undefined, tune, legacyHashes, verses };
  });
};

/** مهام مسار الأجزاء (دفاتر الزمن): جزء لكل مهمة، بنبرته من خريطة النبرة ونصه المشكول منها */
const partsJobsFor = async (ctx: import("./dafatirParts").PartsContext, voiceKey: string): Promise<Job[]> => {
  const dict = await loadDictionary();
  const lex = (await loadLexicon()).entries;
  let profile: VoiceProfile | undefined;
  let layers: VoiceLayers = {};
  try {
    profile = loadChannel().voice?.profile;
    layers = layersOf(loadChannel().voice);
  } catch {
    /* بلا قناة */
  }
  const { tailSeconds: _t, creditsPerChar: _c, ...tts } = config.voice;
  // The basmala is the owner's own recording (owner decision 10 Nov): its part is never a TTS job; its scene is
  // voiced sentence by sentence and composed with the recording (src/voice/basmala.ts).
  const parts = ctx.jobs.filter((p) => !hasBasmala(p.text));
  return parts.map((p, i): Job => {
    assertNoQuranForTts(p.text, { id: p.partId });
    const d = applyDictionary(p.text, dict);
    const tone = isTone(p.tone) ? p.tone : undefined;
    const tune = voiceSettingsFor(profile, tone, { text: p.text });
    const hash = sha16({ part: p.partId, spoken: d.spoken, voiceKey, v: tts, ...(tune ? { tune } : {}) });
    const legacyHashes = legacyTunes(layers, tone).map((l) => sha16({ part: p.partId, spoken: d.spoken, voiceKey, v: tts, ...(l.tune ? { tune: l.tune } : {}) })).filter((h) => h !== hash);
    // الأجزاء تُعدّ كلماتها عند التركيب: نطق القاموس من كلمة واحدة فقط هنا
    const l = applyLexicon(d.original, d.spoken.split(" ").filter(Boolean), d.owner, lex, { singleToken: true });
    return { id: p.partId, scene: p.scene, narration: p.text, spoken: d.spoken, original: d.original, owner: d.owner, hash, send: l.spoken.join(" "), sendOwner: l.owner, prev: parts[i - 1]?.text, next: parts[i + 1]?.text, tune, legacyHashes };
  });
};

export type VoicePlanReport = { total: number; toGenerate: { id: string; chars: number }[]; cached: string[]; chars: number; credits: number; missingTones: string[]; /** مدقق التشكيل للمشاهد المطلوبة */ tashkeel: TashkeelReport; /** سجل التوثيق */ review: ReviewSummary;
  /** مشاهد نصها فيه قرآن فلا تُرسل إلى الصوت المستنسخ (quranGuard.ts) */ quranRefused?: string[];
  /** مقاطع صالحة مولَّدة بإعدادات إصدار نبرات سابق (لا تُعاد إلا بـ upgradeTone)، ومشاهدها */
  olderTone: { ids: string[]; scenes: string[]; chars: number } };

export type GenerateVoiceOptions = {
  client?: ElevenLabsClient | null;
  /** يحسب التكلفة فقط بلا توليد */
  dryRun?: boolean;
  force?: boolean;
  /** مشاهد محددة فقط */
  only?: string[];
  onProgress?: (msg: string) => void;
  /** «أوقف» في «جهّز كل المشاهد»: يُفحص بين المقاطع؛ ما وُلّد قبله محفوظ ولا يبدأ مقطع جديد. */
  shouldStop?: () => boolean;
  /**
   * للاختبارات المعزولة فقط (لا يصل إليها سطر الأوامر ولا الاستوديو ولا مهام الخلفية):
   * تشغيل التخزين المؤقت للصوت على حلقة اختبار بلا تشكيل ولا اعتمادات.
   */
  testOnlySkipGates?: boolean;
  /**
   * «أعد توليد الكل بالنبرة الجديدة» (أمر المالك الصريح وحده): المقاطع المولَّدة بإعدادات إصدار نبرات سابق تُعاد
   * بالإعدادات الحالية. بدونه لا يُعاد مقطع لأن النبرات تغيّرت أبدًا (لا «جهّز كل المشاهد» ولا «ولّد الصوت»).
   */
  upgradeTone?: boolean;
};

/**
 * يولّد صوت كل مشهد له تعليق. لا يعيد توليد مشهد لم يتغير نصه ولا إعداداته (بصمة hash)،
 * فتعديل جملة واحدة لا يكلّف إلا تلك الجملة.
 */
/** قفل صوت الحلقة (QA H4): تشغيلان لتوليد صوت الحلقة نفسها لا يجتمعان أبدًا، ولو من عمليتين مختلفتين. */
export const voiceLockFileFor = (scriptPath: string) => path.join(voiceDirFor(scriptPath), ".voice.lock");
export const VOICE_BUSY_MESSAGE = "يُولَّد صوت هذه الحلقة الآن في مهمة أخرى (مثل «جهّز كل المشاهد» أو «ولّد الصوت» أو سطر الأوامر). انتظر انتهاءها ثم أعد المحاولة؛ لم يُصرف شيء.";

/**
 * ملفات الصوت التي لم يعد يشير إليها أي مشهد لا تُحذف أبدًا (تسجيل مدفوع): تُنقل إلى voice/superseded/.
 * ولا يُمس ملف لم يصنعه هذا التشغيل وكُتب بعد بدئه (تركيب جملة جارٍ في الوقت نفسه مثلًا).
 */
const supersedeUnused = async (dir: string, used: Set<string>, pattern: RegExp, run: { startedAt: number; created: Set<string> }, superseded: string) => {
  for (const f of await readdir(dir).catch(() => [] as string[])) {
    if (!pattern.test(f) || used.has(f)) continue;
    const full = path.join(dir, f);
    const st = await stat(full).catch(() => null);
    if (!st?.isFile()) continue;
    if (!run.created.has(full) && st.mtimeMs >= run.startedAt) continue;
    await mkdir(superseded, { recursive: true });
    const target = existsSync(path.join(superseded, f)) ? `${Date.now().toString(36)}-${f}` : f;
    await rename(full, path.join(superseded, target)).catch(() => {});
  }
};

export const generateVoice = async (episode: string, opts: GenerateVoiceOptions = {}): Promise<VoicePlanReport> => {
  const scriptPath = await resolveScriptPath(episode);
  if (opts.dryRun) return generateVoiceLocked(episode, scriptPath, opts);
  await mkdir(voiceDirFor(scriptPath), { recursive: true });
  return withLock(voiceLockFileFor(scriptPath), { purpose: `voice ${episode}`, waitMs: 2000, busyMessage: VOICE_BUSY_MESSAGE },
    () => generateVoiceLocked(episode, scriptPath, opts));
};

const generateVoiceLocked = async (episode: string, scriptPath: string, opts: GenerateVoiceOptions): Promise<VoicePlanReport> => {
  const log = opts.onProgress ?? (() => {});
  const run = { startedAt: Date.now() - 1000, created: new Set<string>() };
  const plan = (await loadPlan(episode)) ?? (await regeneratePlan(episode));
  const dir = voiceDirFor(scriptPath);
  await mkdir(dir, { recursive: true });
  const indexFile = path.join(dir, "index.json");
  const index: VoiceIndex = (await readJsonFile<VoiceIndex>(indexFile)) ?? {};
  // الكتابة دمجٌ مع الفهرس على القرص (يُقرأ من جديد قبل كل كتابة ذرية): لا يُمحى ما كتبه مسار الجمل في أثناء التشغيل.
  const touched = new Set<string>();
  const removed = new Set<string>();
  const saveIndex = async () => {
    const disk = (await readJsonFile<VoiceIndex>(indexFile)) ?? {};
    for (const id of removed) delete disk[id];
    for (const id of touched) if (index[id]) disk[id] = index[id]!;
    for (const [id, clip] of Object.entries(disk)) if (!touched.has(id)) index[id] = clip;
    for (const id of removed) delete index[id];
    await writeJsonAtomic(indexFile, disk);
  };
  const model = process.env.ELEVENLABS_MODEL_ID || config.voice.modelId;
  const caps = capsFor(model);
  const voiceKey = `${voiceIdFor() ?? ""}|${model}`;
  // دفاتر الزمن مع خريطة نبرة: التوليد بأجزاء الخريطة (s001–s088)، لا بمشهد كامل. غير ذلك: المسار العام كما هو
  // مشاهد صوتها جملةً جملة (D50): المالك يولّد جملها من «الجمل»؛ لا يُعاد توليدها كاملة ولا يُمس مقطعها هنا
  const managed = await (await import("./sentenceVoice")).sentenceManagedScenes(scriptPath);
  const parts = await (await import("./dafatirParts")).loadPartsContext(scriptPath, plan, managed);
  const sceneOf = (j: Job) => j.scene ?? j.id;
  // A narration carrying Quran (﴿…﴾, [آية], or five words of a verse of the episode) is never voiced; the
  // dry run lists it and a real run refuses (src/voice/quranGuard.ts).
  const quranRefused: string[] = [];
  const allJobs = parts ? await partsJobsFor(parts, voiceKey) : await jobsFor(plan, voiceKey, scriptPath, quranRefused);
  const jobs = allJobs.filter((j) => (!opts.only || opts.only.includes(sceneOf(j))) && !managed.has(sceneOf(j)));
  // «أعد توليد الصوت» لمشهد صوته جمل: لا يُعاد كاملًا بصمت؛ يُقال للمالك أين يولّده
  if (!opts.dryRun && opts.only?.length && opts.only.every((id) => managed.has(id)))
    throw new Error("صوت هذا المشهد يُولَّد جملةً جملة: ولّد الجملة المقصودة من «الجمل» تحت معاينة المشهد.");
  const partsDir = path.join(dir, "parts");
  const partsIndexFile = path.join(partsDir, "index.json");
  type PartClipRecord = { file: string; hash: string; text: string; duration: number; words: TimedWord[]; presetVersion?: number };
  const partsIndex: Record<string, PartClipRecord> = parts ? ((await readJson<Record<string, PartClipRecord>>(partsIndexFile)) ?? {}) : {};

  // مقطع بنفس البصمة موجود لمشهد آخر (انزاح رقمه بعد إضافة فقرة): يُعاد استخدامه بلا تكلفة
  const byHash = new Map<string, VoiceClip>();
  if (parts) {
    for (const c of Object.values(partsIndex)) if (existsSync(path.join(partsDir, c.file))) byHash.set(c.hash, c);
  } else for (const c of Object.values(index)) if (existsSync(path.join(dir, c.file))) byHash.set(c.hash, c);
  const legacyHit = (j: Job) => (byHash.has(j.hash) ? undefined : j.legacyHashes?.find((h) => byHash.has(h)));
  const isCached = (j: Job) => !opts.force && (byHash.has(j.hash) || (!opts.upgradeTone && Boolean(legacyHit(j))));
  const cachedClip = (j: Job) => byHash.get(j.hash) ?? byHash.get(legacyHit(j) ?? "");
  const older = jobs.filter((j) => !opts.force && legacyHit(j));
  const todo = jobs.filter((j) => !isCached(j));
  const chars = todo.reduce((n, j) => n + j.spoken.length, 0);
  const report: VoicePlanReport = {
    total: jobs.length,
    toGenerate: todo.map((j) => ({ id: j.id, chars: j.spoken.length })),
    cached: jobs.filter(isCached).map((j) => j.id),
    olderTone: { ids: older.map((j) => j.id), scenes: [...new Set(older.map(sceneOf))], chars: older.reduce((n, j) => n + j.spoken.length, 0) },
    chars,
    credits: Math.ceil(chars * config.voice.creditsPerChar),
    missingTones: parts
      ? [...new Set(parts.jobs.filter((p) => (!opts.only || opts.only.includes(p.scene)) && !managed.has(p.scene) && !isTone(p.tone)).map((p) => p.scene))]
      : plan.chapters.flatMap((c) => c.scenes).filter((scene) => scene.narration.trim() && !managed.has(scene.id) && (!opts.only || opts.only.includes(scene.id)) && !effectiveTone(scene.tone, plan.tone, channelToneOf())).map((scene) => scene.id),
    tashkeel: tashkeelReport(
      plan.chapters.flatMap((c) => c.scenes).filter((s) => s.narration.trim() && !managed.has(s.id) && (!opts.only || opts.only.includes(s.id))),
      await loadTashkeel(scriptPath),
      await loadDictionary(),
    ),
    review: reviewSummary(reviewItems(parseScript(await readFile(scriptPath, "utf8"), scriptPath), await loadLedger(scriptPath))),
  };
  const refusedHere = quranRefused.filter((id) => !managed.has(id) && (!opts.only || opts.only.includes(id)));
  if (refusedHere.length) report.quranRefused = refusedHere;
  if (opts.dryRun) return report;
  if (refusedHere.length)
    throw new QuranTtsError(`الصوت المستنسخ لا يتلو القرآن: نص هذه المشاهد فيه آية (${refusedHere.slice(0, 12).join("، ")}). انقل الآية إلى مشهد آية مستقل ([آية: السورة رقم]) ثم ولّد الصوت.`);
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
    throw new Error(parts
      ? `حدّد نبرة كل مقطع منطوق واعتمدها قبل توليد الصوت: ${report.missingTones.slice(0, 12).join("، ")}.`
      : `لا نبرة للحلقة: اخترها في «١ التجهيز» («لا نبرة للحلقة — اخترها هنا») أو في تحرير المشهد ← «نبرة الصوت في الحلقة»، فتسري على كل مشهد بلا نبرة خاصة؛ أو حدّد نبرة هذه المشاهد: ${sceneNames(planOrder(plan), report.missingTones, 12)}.`);
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
    const c = isCached(j) ? cachedClip(j) : undefined;
    if (c && parts) partsIndex[j.id] = { file: c.file, hash: c.hash, text: j.narration, duration: c.duration, words: c.words, ...(c.presetVersion ? { presetVersion: c.presetVersion } : {}) };
    else if (c) { index[j.id] = { ...c, text: j.narration }; touched.add(j.id); }
  }
  if (parts) await mkdir(partsDir, { recursive: true });

  let stoppedEarly = false;
  for (const [k, j] of todo.entries()) {
    if (opts.shouldStop?.()) { stoppedEarly = true; break; }
    log(`(${k + 1}/${todo.length}) ${j.id}: ${j.spoken.length} حرفًا`);
    const r = await opts.client!.tts(j.send ?? j.spoken, { previousText: j.prev, nextText: j.next, voiceId: j.voiceId, tune: j.tune, scene: { id: j.id }, verses: j.verses });
    // السرعة بعد التوليد للنماذج التي لا تقبلها (v4): تمديد زمني يحفظ طبقة الصوت، ومعه توقيت الكلمات
    const speed = caps.speed === "post" ? (j.tune?.speed ?? config.voice.speed) : 1;
    const audio = await applyTempo(r.audio, speed);
    // اسم الملف من البصمة: مشهدان بنفس النص يتشاركان الملف، والانزياح لا يكتب فوق مقطع آخر
    const file = `${j.hash}.mp3`;
    const fileDir = parts ? partsDir : dir;
    await writeFileAtomic(path.join(fileDir, file), audio);
    run.created.add(path.join(fileDir, file));
    let duration = 0;
    try {
      duration = (await parseFile(path.join(fileDir, file), { duration: true })).format.duration ?? 0;
    } catch {
      /* يُقدَّر من التوقيت */
    }
    // أوامر الأداء لا تظهر في الترجمة أبدًا؛ وبلا توقيت من النموذج تُوزَّع الكلمات على المدة بطولها
    const spokenWords = r.alignment ? scaleTimes(dropTagWords(alignmentToWords(r.alignment)), speed) : estimateWords(j.send ?? j.spoken, duration);
    if (!duration) duration = spokenWords.length ? spokenWords[spokenWords.length - 1]!.end : 0;
    if (parts) {
      // الجزء يحفظ كلماته المنطوقة بزمن ملفه؛ تُحوَّل إلى زمن المشهد عند التركيب
      partsIndex[j.id] = { file, hash: j.hash, text: j.narration, duration, words: spokenWords, presetVersion: TONE_PRESET_VERSION };
      byHash.set(j.hash, partsIndex[j.id]!);
      await writeJsonAtomic(partsIndexFile, partsIndex);
      continue;
    }
    const words = wordsForCaptions(j.original, j.sendOwner ?? j.owner, spokenWords);
    index[j.id] = { file, hash: j.hash, text: j.narration, duration, words, presetVersion: TONE_PRESET_VERSION };
    touched.add(j.id);
    byHash.set(j.hash, index[j.id]!);
    await saveIndex();
  }

  // Stopped mid-way on the parts path (dafatir tone map): finished parts are saved in parts/index.json and
  // reused next time; scenes are never composed from an incomplete set of parts.
  if (parts && stoppedEarly) return report;
  if (parts) {
    const before = JSON.stringify(index);
    await (await import("./dafatirParts")).composePartsIntoScenes({ plan, parts: { ...parts, jobs: parts.jobs.filter((j) => !managed.has(j.scene)) }, partsIndex, partsDir, dir, index, allJobs, log });
    // مشاهد ركّبها التركيب الآن: تُكتب بالدمج كغيرها
    if (JSON.stringify(index) !== before) for (const j of allJobs) if (!managed.has(sceneOf(j)) && index[sceneOf(j)]) touched.add(sceneOf(j));
    // تنظيف: أجزاء لم تعد في الخريطة، وملفات لا يشير إليها جزء ولا مشهد (تُنقل إلى superseded ولا تُحذف)
    const liveParts = new Set(allJobs.map((j) => j.id));
    for (const id of Object.keys(partsIndex)) if (!liveParts.has(id)) delete partsIndex[id];
    await writeJsonAtomic(partsIndexFile, partsIndex);
    const usedParts = new Set(Object.values(partsIndex).map((c) => c.file));
    await supersedeUnused(partsDir, usedParts, /\.mp3$/, run, path.join(dir, "superseded", "parts"));
    const liveScenes = new Set(allJobs.map(sceneOf));
    for (const id of Object.keys(index)) if (!liveScenes.has(id) && !managed.has(id)) removed.add(id);
    await saveIndex();
    const used = new Set(Object.values(index).map((c) => c.file));
    await supersedeUnused(dir, used, /\.(mp3|wav)$/, run, path.join(dir, "superseded"));
    return report;
  }

  // تنظيف: مشاهد لم تعد موجودة تخرج من الفهرس، وملفات لم يعد يشير إليها أي مشهد تُنقل إلى superseded (لا تُحذف)
  const live = new Set((await jobsFor(plan, voiceKey, scriptPath)).map((j) => j.id));
  for (const id of Object.keys(index)) if (!live.has(id)) removed.add(id);
  await saveIndex();
  const used = new Set(Object.values(index).map((c) => c.file));
  await supersedeUnused(dir, used, /\.mp3$/, run, path.join(dir, "superseded"));
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
  const index: Record<string, LineClip> = (await readJsonFile<Record<string, LineClip>>(indexFile)) ?? {};
  const model = process.env.ELEVENLABS_MODEL_ID || config.voice.modelId;
  const caps = capsFor(model);
  const voiceKey = `${voiceIdFor() ?? ""}|${model}`;
  const dict = await loadDictionary();
  const tk = await loadTashkeel(scriptPath);
  const lex = (await loadLexicon()).entries;
  let channelTone: string | undefined;
  let profile: VoiceProfile | undefined;
  let layers: VoiceLayers = {};
  try {
    const v = loadChannel().voice;
    channelTone = v?.tone;
    profile = v?.profile;
    layers = layersOf(v);
  } catch {
    /* بلا قناة */
  }
  const toneId = [channelTone].find(isTone);
  const { tailSeconds: _t, creditsPerChar: _c, ...tts } = config.voice;
  const out: Record<string, LineClip> = {};
  for (const [k, line] of lines.entries()) {
    const text = line.text.trim();
    assertNoQuranForTts(text, { id: line.id });
    const words = text.split(/\s+/).filter(Boolean);
    const d = applyDictionary(text, dict, tk ? vowelize(words, tk) : undefined);
    const tune = voiceSettingsFor(profile, toneId, { text });
    const hash = sha16({ spoken: d.spoken, voiceKey, v: tts, ...(tune ? { tune } : {}) });
    const legacy = legacyTunes(layers, toneId).map((l) => sha16({ spoken: d.spoken, voiceKey, v: tts, ...(l.tune ? { tune: l.tune } : {}) }));
    const have = index[line.id];
    if (!opts.force && have && (have.hash === hash || legacy.includes(have.hash)) && existsSync(path.join(opts.dir, have.file))) {
      out[line.id] = have;
      continue;
    }
    log(`(${k + 1}/${lines.length}) ${line.id}: ${d.spoken.length} حرفًا`);
    const l = applyLexicon(d.original, d.spoken.split(" ").filter(Boolean), d.owner, lex);
    const r = await opts.client.tts(l.spoken.join(" "), { previousText: lines[k - 1]?.text, nextText: lines[k + 1]?.text, tune });
    const speed = caps.speed === "post" ? (tune?.speed ?? config.voice.speed) : 1;
    const audio = await applyTempo(r.audio, speed);
    const file = `${hash}.mp3`;
    await writeFileAtomic(path.join(opts.dir, file), audio);
    let duration = (await audioDuration(path.join(opts.dir, file))) ?? 0;
    const spokenWords = r.alignment ? scaleTimes(dropTagWords(alignmentToWords(r.alignment)), speed) : estimateWords(l.spoken.join(" "), duration);
    const timed = wordsForCaptions(d.original, l.owner, spokenWords);
    if (!duration) duration = spokenWords.length ? spokenWords[spokenWords.length - 1]!.end : 0;
    out[line.id] = index[line.id] = { file, hash, text, duration, words: timed };
    await writeJsonAtomic(indexFile, index);
  }
  return out;
};

/** فحص التشكيل (حد 98%) لجمل مستقلة قبل صرف أي رصيد على توليد صوتها */
export const tashkeelForLines = async (scriptPath: string, lines: { id: string; text: string }[]) =>
  tashkeelReport(lines.map((l) => ({ id: l.id, narration: l.text })), await loadTashkeel(scriptPath), await loadDictionary());
export { tashkeelBlockMessage };
