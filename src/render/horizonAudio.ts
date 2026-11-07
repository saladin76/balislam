/**
 * دفاتر الزمن 001 — المعاينة المتكاملة للقطات الست (اتجاه «خط الأفق»): صوت الراوي المعتمد، ونص الآيتين من Quran Foundation
 * وتلاوة القارئ المختار للقناة، والمشاهد مضبوطة على توقيت الكلام الفعلي. تعمل على جهاز الإنتاج فقط (المفاتيح والتلاوات عليه).
 *
 * لا يُنتَج شيء ناقص: يتوقف قبل أي صرف أو رندر إن اختلف نص اللقطات عن السكريبت المعتمد، أو نقص مفتاح، أو قلّ التشكيل عن 98%،
 * أو لم يُجلب نص آية أو تلاوتها. الملف بخانة تنتهي بـ «-audio» فيبقى على الجهاز (شروط التلاوة)، ولا تُزال المعاينة الصامتة
 * السابقة من العرض إلا بعد التحقق من تشغيل الجديدة كاملة.
 */
import path from "node:path";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, stat } from "node:fs/promises";
import { RenderInternals, renderMedia, selectComposition } from "@remotion/renderer";
import { projectRoot } from "../config/paths";
import { resolveScriptPath } from "../script/episodes";
import { loadChannel } from "../channel/index";
import { readJson, quranPathFor } from "../plan/io";
import { elevenLabsFromEnv, type ElevenLabsClient } from "../voice/elevenlabs";
import { synthesizeLines, tashkeelBlockMessage, tashkeelForLines, voiceDirFor } from "../voice/generate";
import { quranClientFromEnv, type QuranClient } from "../quran/client";
import { recitationsDirFor, syncQuran, type RecitationIndex } from "../quran/sync";
import { activeRecitation, isCloudRecitation } from "../quran/provider";
import { browserExecutable, createIsolatedRenderBundle } from "./bundle";
import { stageRenderFiles, type RenderStageFile } from "../plan/renderStage";
import { studioMediaNamespace } from "../plan/collect";
import { QUALITY } from "./quality";
import { cleanMetadata } from "./episode";
import { putEpisodePreview, removePreview } from "./episodePreviews";
import { measureMotion } from "./motionMeter";
import { SHOT_SPECS, buildShots, type HorizonAudio } from "../remotion/dafatir/horizon/shots";
import { hzSchedule, hzTotal, HZ_FPS } from "../remotion/dafatir/horizon/HorizonTest";

export const HORIZON_SHOTS = ["1", "2", "3", "4", "5", "6"] as const;
export const HORIZON_VERSES = ["2:30", "7:23"] as const;

const spokenText = (id: string) => SHOT_SPECS[id]!.sentences.join(" ").replace(/\s*\|\s*/g, " ");
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

/** فحوص ما قبل التوليد: كل نقص يُذكر بعينه، ولا تُكشف قيم المفاتيح */
export const horizonPreflight = async (scriptPath: string, clients: { voice: ElevenLabsClient | null; quran: QuranClient | null }) => {
  const problems: string[] = [];
  const script = norm(await readFile(scriptPath, "utf8"));
  for (const id of HORIZON_SHOTS)
    for (const s of SHOT_SPECS[id]!.sentences) {
      const plain = norm(s.replace(/\s*\|\s*/g, " "));
      if (!script.includes(plain)) problems.push(`نص اللقطة ${id} لا يطابق السكريبت المعتمد: «${plain.slice(0, 60)}…»`);
    }
  if (!clients.voice) problems.push("مفتاح صوت الراوي أو معرّف الصوت غير موجود في .env (ElevenLabs).");
  if (!clients.quran) problems.push("مفاتيح Quran Foundation غير موجودة في .env.");
  const channel = loadChannel();
  if (!(await activeRecitation(scriptPath, channel.recitation))) problems.push("لم يُحدَّد قارئ للقناة أو للحلقة.");
  const tk = await tashkeelForLines(scriptPath, HORIZON_SHOTS.map((id) => ({ id: `horizon-${id}`, text: spokenText(id) })));
  if (!tk.ok) problems.push(tashkeelBlockMessage(tk));
  return problems;
};

export type HorizonAudioResult = {
  file: string;
  version: number;
  replaced: string | null;
  seconds: number;
  shots: { id: string; seconds: number; voice: number; recitation: number | null }[];
  verses: { key: string; words: number; parts: number; seconds: number; reciter: string }[];
  motion: { percent: number; still: { from: number; to: number }[]; exempt: number };
};

const decodes = async (file: string) => {
  await RenderInternals.callFf({ bin: "ffmpeg", args: ["-v", "error", "-i", file, "-f", "null", "-"], indent: false, logLevel: "error", binariesDirectory: null, cancelSignal: undefined });
  return (await stat(file)).size > 0;
};

export const renderHorizonAudio = async (
  episode: string,
  opts: { slot?: string; replaces?: string; voiceClient?: ElevenLabsClient | null; quranClient?: QuranClient | null; onProgress?: (m: string) => void } = {},
): Promise<HorizonAudioResult> => {
  const log = opts.onProgress ?? (() => {});
  const slot = opts.slot ?? "six-shots-audio";
  if (!slot.endsWith("-audio")) throw new Error("خانة المعاينة الصوتية يجب أن تنتهي بـ -audio (تبقى على الجهاز ولا تُرفع، لأن فيها تلاوة).");
  const scriptPath = await resolveScriptPath(episode);
  const voice = opts.voiceClient === undefined ? elevenLabsFromEnv() : opts.voiceClient;
  const quran = opts.quranClient === undefined ? quranClientFromEnv() : opts.quranClient;

  log("فحص النص والمفاتيح والتشكيل…");
  const problems = await horizonPreflight(scriptPath, { voice, quran });
  if (problems.length) throw new Error(`لم تُصنع المعاينة الصوتية:\n${problems.map((p) => `- ${p}`).join("\n")}`);

  log("جلب نصوص الآيات وتلاوة القارئ المحدد للحلقة…");
  const sync = await syncQuran(episode, quran!);
  const store = (await readJson<Record<string, string>>(quranPathFor(scriptPath))) ?? {};
  const recDir = recitationsDirFor(scriptPath);
  const recIndex = (await readJson<RecitationIndex>(path.join(recDir, "index.json"))) ?? {};
  const channel = loadChannel();
  const chosenReciter = await activeRecitation(scriptPath, channel.recitation);
  const missing: string[] = [];
  for (const key of HORIZON_VERSES) {
    const failed = sync.failed.filter((f) => f.ref.includes(key.split(":")[1]!)).map((f) => f.reason);
    if (!store[key]?.trim()) missing.push(`نص الآية ${key} لم يُجلب${failed.length ? `: ${failed.join("؛ ")}` : ""}`);
    const rec = recIndex[key];
    const matches = rec && chosenReciter && (isCloudRecitation(chosenReciter)
      ? rec.provider === "alquran-cloud" && rec.edition === chosenReciter.edition
      : rec.provider !== "alquran-cloud" && rec.recitationId === chosenReciter.id);
    if (!matches) missing.push(`تلاوة ${key} للقارئ المختار غير موجودة`);
    else if (!rec.parts.length || rec.parts.some((p) => !p.duration || !existsSync(path.join(recDir, p.file)))) missing.push(`ملف تلاوة ${key} ناقص أو بلا مدة`);
  }
  if (missing.length) throw new Error(`لم تُصنع المعاينة الصوتية:\n${missing.map((p) => `- ${p}`).join("\n")}`);

  log("توليد صوت الراوي للقطات الست…");
  const voiceDir = path.join(voiceDirFor(scriptPath), "horizon");
  const clips = await synthesizeLines(scriptPath, HORIZON_SHOTS.map((id) => ({ id, text: spokenText(id) })), { client: voice!, dir: voiceDir, onProgress: log });

  // Preserve every prior render's media; this legacy six-shot preview uses
  // the same immutable channel/episode staging as the main Remotion pipeline.
  const files: RenderStageFile[] = Object.values(clips).map((c) => ({
    kind: "voice", name: c.file, source: path.join(voiceDir, c.file),
  }));
  const verses: HorizonAudio["verses"] = {};
  for (const key of HORIZON_VERSES) {
    const rec = recIndex[key]!;
    for (const p of rec.parts) files.push({
      kind: "recitations", name: p.file, source: path.join(recDir, p.file),
    });
    verses[key] = { text: store[key]!, reciter: `الشيخ ${rec.reciter}`, parts: rec.parts };
  }
  const rel = await stageRenderFiles(studioMediaNamespace(scriptPath).render, files, {
    publicRoot: path.join(projectRoot, "public"),
  });
  const audio: HorizonAudio = { base: rel, voice: Object.fromEntries(Object.entries(clips).map(([id, c]) => [id, { file: c.file, duration: c.duration, words: c.words }])), verses };
  const shots = buildShots(audio); // يرمي خطأ إن لم يطابق عدد كلمات الصوت نص اللقطة

  log("رندر المعاينة…");
  const outDir = path.join(path.dirname(scriptPath), "out");
  await mkdir(outDir, { recursive: true });
  const output = path.join(outDir, `${slot}-preview.mp4`);
  const temp = output.replace(/\.mp4$/i, "") + `.${randomUUID()}.rendering.mp4`;
  const sandbox = await createIsolatedRenderBundle({
    mode: "static", base: rel, voice: {}, recitations: {}, sfx: [],
  });
  try {
    const serveUrl = sandbox.serveUrl;
    const composition = await selectComposition({ serveUrl, id: "dafatir-001-horizon-audio", inputProps: { audio }, browserExecutable: browserExecutable() });
    const q = QUALITY.preview;
    await renderMedia({ serveUrl, composition, inputProps: { audio }, codec: "h264", scale: q.scale, crf: q.crf, x264Preset: q.x264Preset, audioCodec: "aac", audioBitrate: q.audioBitrate, colorSpace: "bt709", outputLocation: temp, browserExecutable: browserExecutable(), onProgress: ({ progress }) => log(`رندر ${Math.round(progress * 100)}%`) });
    await cleanMetadata(temp, { title: "دفاتر الزمن 001 — اللقطات الست", artist: channel.name });
    if (!(await decodes(temp))) throw new Error("الملف المرندر لا يعمل كاملًا؛ لم يُرفع شيء.");
    await rename(temp, output);
  } finally {
    await rm(temp, { force: true });
    await sandbox.cleanup();
  }

  log("الرفع إلى الاستوديو والتحقق…");
  const up = await putEpisodePreview(episode, slot, output, {
    title: "اللقطات الست بالصوت والتلاوة — معاينة متكاملة (جاهزة للمراجعة)",
    note: `اتجاه «خط الأفق». صوت الراوي المعتمد، ونص البقرة 30 والأعراف 23 من Quran Foundation بتلاوة ${chosenReciter?.name ?? "القارئ المختار"}. توقيت المشاهد من الكلام الفعلي. لا موسيقى ولا مؤثرات. لا تُنشر.`,
  });
  if (!(await decodes(up.file))) throw new Error("النسخة المرفوعة إلى الاستوديو لا تعمل كاملًا؛ أُبقيت المعاينة السابقة.");
  const replaced = opts.replaces && opts.replaces !== slot ? opts.replaces : null;
  if (replaced) await removePreview(scriptPath, replaced);

  // قياس الحركة بعد استثناء اللوحة والفواصل وذكر الله وتمهيد الآية والتلاوة (القاعدة الثانية)
  const sch = hzSchedule(shots);
  const total = hzTotal(shots) / HZ_FPS;
  const exempt = new Set<number>();
  const add = (a: number, b: number) => {
    for (let s = Math.floor(a); s < Math.ceil(b); s++) exempt.add(s);
  };
  add(0, sch[0]!.from / HZ_FPS);
  sch.forEach(({ shot, from, frames }, i) => {
    const t0 = from / HZ_FPS;
    const next = i + 1 < sch.length ? sch[i + 1]!.from / HZ_FPS : total;
    add(t0 + frames / HZ_FPS, next);
    for (const s of shot.tl.sentences) if (/الله/.test(s.text)) add(t0 + s.s, t0 + s.e);
    const rabbih = shot.tl.words.find((w) => w.w === "ربه");
    if (rabbih) add(t0 + rabbih.s - 0.6, t0 + rabbih.e);
    if (shot.q && shot.q.dur > 0) add(t0 + shot.q.start - 1.0, t0 + frames / HZ_FPS);
  });
  const m = await measureMotion(up.file, "landscape", exempt);

  return {
    file: up.file,
    version: up.version,
    replaced,
    seconds: Math.round(total * 10) / 10,
    shots: sch.map(({ shot, frames }) => ({ id: shot.id, seconds: Math.round((frames / HZ_FPS) * 10) / 10, voice: Math.round((audio.voice[shot.id]?.duration ?? 0) * 10) / 10, recitation: shot.q?.dur ? Math.round(shot.q.dur * 10) / 10 : null })),
    verses: HORIZON_VERSES.map((key) => ({ key, words: verses[key]!.text.split(/\s+/).length, parts: verses[key]!.parts.length, seconds: Math.round(verses[key]!.parts.reduce((n, p) => n + p.duration, 0) * 10) / 10, reciter: verses[key]!.reciter })),
    motion: { percent: m.percent, still: m.still, exempt: exempt.size },
  };
};
