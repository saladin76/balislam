/**
 * «سرعة الإلقاء» — التطبيق (src/voice/pace.ts النموذج، src/voice/paceFile.ts الملفات):
 *
 * - `paceStatus`: الإعداد، وما يطلبه لكل مشهد وما طُبّق عليه، والمشاهد المتأثرة («تغيّرت السرعة — أعد إنتاجها»)،
 *   والمدة الآن والمدة التقديرية بعد إعادة الإنتاج. قراءة فقط.
 * - `setPace`: يكتب pace.json وحده (المالك). لا صوت ولا مشهد يتغير، ولا يُبطل اعتمادًا.
 * - `refreshPace`: يصنع النسخة المطبَّقة لكل مشهد يحتاجها من تسجيله الأصلي (مدّ يحفظ طبقة الصوت وتقصير الصمت)، بلا أي
 *   طلب صوت ولا رصيد. تغيّر الملف الذي يقرؤه السجل يعيد فتح المشهد وحده ويلغي التجميع وMaster والإذن بالقاعدة القائمة
 *   (الصوت الذي تغيّر بصمته، D50). الأصل لا يُمس.
 */
import path from "node:path";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import config from "../../config.json";
import { resolveScriptPath } from "../script/episodes";
import { readJson, readPlanFile } from "../plan/io";
import type { Plan, PlanScene } from "../plan/types";
import { encodeWav } from "../remotion/dafatir/audio/compose";
import { writeAtomic } from "./sentenceContext";
import { words as wordsOf } from "./sentences";
import { stretchPcm } from "./tempo";
import {
  DEFAULT_SPEED, PAUSES, SPEEDS, isPause, isSpeed, pauseOf, planPace, pacedTimes, sceneTailFor, scenePace, speedOf, sceneSpeedOf,
  type PaceDoc, type PacePlan, type PauseId, type ScenePace, type SpeedId,
} from "./pace";
import {
  PACED_PREFIX, loadPace, loadPacedIndex, pacedIndexFor, pacedValidFor, savePace, savePacedIndex,
  type PacedEntry, type PacedIndex, type RawClip,
} from "./paceFile";

const SR = 44100;
const voiceDir = (scriptPath: string) => path.join(path.dirname(scriptPath), "voice");
const flat = (plan: Plan) => plan.chapters.flatMap((c) => c.scenes);
const narrated = (s: PlanScene) => s.template !== "verse-card" && Boolean(s.narration?.trim());

/** جمل كل مشهد كما يراها «الجمل» (المحفوظة أو التقسيم الآلي): نصها ونوعها، لتطبيق سرعة كل جملة بحدودها */
const sentenceLists = async (episode: string) => {
  const { loadCtx, sceneSentences } = await import("./sentenceContext");
  const ctx = await loadCtx(episode);
  const lists: Record<string, { text: string; kind: "narration" | "verse" | "basmala" }[]> = {};
  for (const s of flat(ctx.plan)) if (narrated(s)) lists[s.id] = sceneSentences(ctx, s).list.map((x) => ({ text: x.text, kind: x.kind }));
  return { ctx, lists };
};

type SceneRow = {
  id: string;
  /** لماذا لا تمسه السرعة (آية، تمهيد آية، ذكر الله) */
  exempt: string | null;
  speed: { id: SpeedId; source: "scene" | "episode" | "default" };
  hasVoice: boolean;
  desired: string; applied: string;
  /** تغيّرت سرعته ولم يُعد إنتاجه بها بعد */
  affected: boolean;
  status: string | null;
};

const pacesFor = (doc: PaceDoc, plan: Plan, lists: Record<string, { text: string; kind: "narration" | "verse" | "basmala" }[]>) => {
  const scenes = flat(plan);
  const out: Record<string, ScenePace> = {};
  scenes.forEach((s, i) => { if (lists[s.id]) out[s.id] = scenePace(doc, s, scenes[i + 1], lists[s.id]!, (t) => wordsOf(t).length); });
  return out;
};

const rawUsable = (raw: RawClip | undefined, scene: PlanScene, dir: string): raw is RawClip =>
  Boolean(raw && raw.text === scene.narration.trim() && path.basename(raw.file) === raw.file && existsSync(path.join(dir, raw.file)));

/** المقطع المتوقع بعد التطبيق (للمدة التقديرية): بالخطة نفسها التي يُبنى بها الملف، بلا صوت */
export const predictedClip = (raw: RawClip, sp: ScenePace): RawClip & { paced?: { tailSeconds?: number } } => {
  if (!sp.key) return raw;
  const plan = planPace(raw, sp.sentences, sp.pause);
  const t = pacedTimes(plan, raw.words);
  return { ...raw, duration: t.duration, words: t.words, ...(raw.timing ? { timing: mapTiming(raw, t.duration, t.map) } : {}),
    paced: { tailSeconds: sceneTailFor(config.voice.tailSeconds, sp.pause) } };
};

const mapTiming = (raw: RawClip, duration: number, map: (t: number) => number): RawClip["timing"] => {
  const tm = raw.timing!;
  return { ...tm, seconds: Math.max(duration, tm.seconds - (raw.duration - duration)), speechStart: map(tm.speechStart), speechEnd: map(tm.speechEnd),
    parts: tm.parts.map((p) => ({ ...p, at: map(p.at) })) };
};

export type PaceStatus = {
  episode: { speed: SpeedId; pause: PauseId; speedSet: boolean; pauseSet: boolean };
  scenesSet: Record<string, SpeedId>;
  options: { speeds: { id: SpeedId; nameAr: string; factor: number; hintAr: string }[]; pauses: { id: PauseId; nameAr: string; factor: number }[] };
  scenes: SceneRow[];
  affected: string[];
  /** مشاهد معتمدة أو مُرسلة ستعود للمراجعة إن أُعيد إنتاجها */
  reopens: string[];
  seconds: { now: number; next: number };
};

export const paceStatus = async (episode: string): Promise<PaceStatus> => {
  const scriptPath = await resolveScriptPath(episode);
  const { ctx, lists } = await sentenceLists(episode);
  const plan = ctx.plan;
  const doc = await loadPace(scriptPath);
  const dir = voiceDir(scriptPath);
  const raw = (await readJson<Record<string, RawClip>>(path.join(dir, "index.json"))) ?? {};
  const paced = await loadPacedIndex(scriptPath);
  const paces = pacesFor(doc, plan, lists);
  let statuses: Record<string, string> = {};
  try {
    const { inspectSceneProduction } = await import("../studio/sceneService");
    statuses = Object.fromEntries((await inspectSceneProduction(episode)).scenes.map((x: { id: string; status: string }) => [x.id, x.status]));
  } catch { /* before the preparation: no ledger yet */ }
  const { collectMedia } = await import("../plan/collect");
  const { sceneSeconds } = await import("../plan/duration");
  const media = await collectMedia(episode, plan).catch(() => ({ voice: {}, recitations: {} } as unknown as Awaited<ReturnType<typeof collectMedia>>));
  const nextVoice: Record<string, unknown> = { ...media.voice };
  const rows: SceneRow[] = [];
  const scenes = flat(plan);
  scenes.forEach((s) => {
    const sp = paces[s.id];
    if (!sp) return;
    const r = raw[s.id];
    const hasVoice = rawUsable(r, s, dir);
    const entry = paced[s.id];
    const applied = hasVoice && pacedValidFor(entry, r, dir) ? entry.key : "";
    const affected = hasVoice && sp.key !== applied;
    if (affected) nextVoice[s.id] = predictedClip(r!, sp);
    rows.push({ id: s.id, exempt: sp.exempt, speed: sceneSpeedOf(doc, s.id), hasVoice, desired: sp.key, applied, affected, status: statuses[s.id] ?? null });
  });
  const total = (voice: Record<string, unknown>) => Math.round(scenes.reduce((a, s) => a + sceneSeconds(s, { voice, recitations: media.recitations } as never), 0) * 10) / 10;
  const affected = rows.filter((x) => x.affected).map((x) => x.id);
  return {
    episode: { speed: doc.episode?.speed ?? DEFAULT_SPEED, pause: pauseOf(doc), speedSet: isSpeed(doc.episode?.speed), pauseSet: isPause(doc.episode?.pause) },
    scenesSet: doc.scenes ?? {},
    options: {
      speeds: (Object.keys(SPEEDS) as SpeedId[]).map((id) => ({ id, ...SPEEDS[id] })),
      pauses: (Object.keys(PAUSES) as PauseId[]).map((id) => ({ id, ...PAUSES[id] })),
    },
    scenes: rows,
    affected,
    reopens: rows.filter((x) => x.affected && (x.status === "approved" || x.status === "in_review")).map((x) => x.id),
    seconds: { now: total(media.voice as Record<string, unknown>), next: total(nextVoice) },
  };
};

export type PaceCommand =
  | { action: "episode"; speed?: SpeedId | null; pause?: PauseId | null }
  | { action: "scene"; sceneId: string; speed: SpeedId | null }
  | { action: "sentence"; sceneId: string; text: string; speed: SpeedId | null };

export class PaceInputError extends Error { status = 400; }

/** يكتب الإعداد وحده (المالك). لا يمس صوتًا ولا مشهدًا ولا السجل. */
export const setPace = async (episode: string, cmd: PaceCommand): Promise<PaceStatus> => {
  const { assertSceneOwner, serialized } = await import("../studio/sceneService");
  assertSceneOwner();
  const scriptPath = await resolveScriptPath(episode);
  const plan = await readPlanFile(scriptPath);
  if (!plan) throw new PaceInputError("خطة الحلقة غير موجودة.");
  const okSpeed = (x: unknown) => x === null || x === undefined || isSpeed(x);
  await serialized(pacedIndexFor(scriptPath), async () => {
    const doc = await loadPace(scriptPath);
    if (cmd?.action === "episode") {
      if (!okSpeed(cmd.speed) || !(cmd.pause === null || cmd.pause === undefined || isPause(cmd.pause))) throw new PaceInputError("قيمة السرعة أو الفاصل غير معروفة.");
      const ep = { ...(doc.episode ?? {}) };
      if (cmd.speed !== undefined) { if (cmd.speed === null) delete ep.speed; else ep.speed = cmd.speed; }
      if (cmd.pause !== undefined) { if (cmd.pause === null) delete ep.pause; else ep.pause = cmd.pause; }
      doc.episode = ep;
    } else if (cmd?.action === "scene") {
      const scene = flat(plan).find((s) => s.id === cmd.sceneId);
      if (!scene || !narrated(scene) || !okSpeed(cmd.speed)) throw new PaceInputError("المشهد أو السرعة غير صالحة.");
      const sc = { ...(doc.scenes ?? {}) };
      if (cmd.speed === null) delete sc[scene.id]; else sc[scene.id] = cmd.speed;
      doc.scenes = sc;
    } else if (cmd?.action === "sentence") {
      const scene = flat(plan).find((s) => s.id === cmd.sceneId);
      const text = typeof cmd.text === "string" ? cmd.text.trim().split(/\s+/).filter(Boolean).join(" ") : "";
      if (!scene || !narrated(scene) || !text || text.length > 4000 || !okSpeed(cmd.speed)) throw new PaceInputError("الجملة أو السرعة غير صالحة.");
      const rest = (doc.sentences ?? []).filter((e) => !(e.scene === scene.id && e.text === text));
      doc.sentences = cmd.speed === null ? rest : [...rest, { scene: scene.id, text, speed: cmd.speed, at: new Date().toISOString() }];
    } else throw new PaceInputError("أمر السرعة غير صالح.");
    await savePace(scriptPath, doc);
  });
  return paceStatus(episode);
};

/**
 * يبني النسخة المطبَّقة لمشهد من تسجيله الأصلي: الرأس كما هو، وكلام كل جملة ممدود بمعاملها (atempo يحفظ طبقة الصوت،
 * WAV إلى WAV)، والصمت بين الجمل وبعد آخر كلمة مقصَّر من وسطه. التوقيت يُحسب بأطوال القطع الفعلية فيبقى كل عنصر على كلمته.
 */
export const derivePaced = async (scriptPath: string, raw: RawClip, sp: ScenePace): Promise<PacedEntry> => {
  const { decodeAudio } = await import("./dafatirParts");
  const dir = voiceDir(scriptPath);
  const pcm = await decodeAudio(path.join(dir, raw.file), SR);
  const D = pcm.length / SR || raw.duration;
  const plan: PacePlan = planPace({ duration: D, words: raw.words }, sp.sentences, sp.pause);
  const chunks: Float32Array[] = [];
  for (const p of plan.pieces) {
    const a = Math.max(0, Math.floor(p.from * SR)), z = Math.min(pcm.length, Math.ceil(p.to * SR));
    const seg = pcm.subarray(a, Math.max(a, z));
    if (p.kind === "head") chunks.push(seg);
    else if (p.kind === "speech") chunks.push(await stretchPcm(seg, SR, p.factor));
    else if (p.kind === "tail") chunks.push(seg.subarray(0, Math.min(seg.length, Math.round(p.keep * SR))));
    else {
      // الصمت بين جملتين: نصفه الأول من بدايته ونصفه الثاني من نهايته، بوصل ٥ م.ث (لا نقرة)
      const keep = Math.min(seg.length, Math.round(p.keep * SR));
      const h = Math.floor(keep / 2);
      const out = new Float32Array(keep);
      out.set(seg.subarray(0, h), 0);
      out.set(seg.subarray(seg.length - (keep - h)), h);
      const x = Math.min(Math.round(0.005 * SR), h, keep - h);
      for (let i = 0; i < x; i++) {
        const k = h - x + i, w = i / x;
        out[k] = seg[k]! * (1 - w) + seg[seg.length - (keep - h) - x + i]! * w;
      }
      chunks.push(out);
    }
  }
  const lengths = chunks.map((c) => c.length / SR);
  const n = chunks.reduce((a, c) => a + c.length, 0);
  const all = new Float32Array(n);
  let o = 0;
  for (const c of chunks) { all.set(c, o); o += c.length; }
  const times = pacedTimes(plan, raw.words, lengths);
  const hash = createHash("sha1").update(JSON.stringify([raw.file, raw.hash, sp.key])).digest("hex").slice(0, 16);
  const file = `${PACED_PREFIX}${hash}.wav`;
  if (!existsSync(path.join(dir, file))) await writeAtomic(path.join(dir, file), encodeWav(all, SR));
  const speechWords = sp.sentences.reduce((a, s) => a + s.words, 0) || 1;
  const info = {
    key: sp.key, from: { file: raw.file, hash: raw.hash, duration: raw.duration },
    speed: Math.round((sp.sentences.reduce((a, s) => a + s.factor * s.words, 0) / speechWords) * 1000) / 1000, pause: sp.pause,
    ...(sp.pause < 1 ? { tailSeconds: sceneTailFor(config.voice.tailSeconds, sp.pause) } : {}),
  };
  const clip = { ...raw, file, duration: times.duration, words: times.words, ...(raw.timing ? { timing: mapTiming(raw, times.duration, times.map) } : {}), paced: info };
  return { key: sp.key, from: info.from, clip };
};

export type RefreshScope = { all?: boolean; open?: boolean; scenes?: string[] };
export type RefreshResult = { applied: string[]; cleared: string[]; failed: { id: string; error: string }[] };

/**
 * يطبّق الإعداد الحالي (مجانًا، بلا طلب صوت):
 * - دائمًا: كل مشهد تغيّر تسجيله الأصلي بعد آخر تطبيق (صوته الجديد يتبع السرعة المختارة)؛
 * - `scenes`: المشاهد المذكورة؛ `open`: كل مشهد لم يُعتمد ولم يُرسل؛ `all`: كل مشهد متأثر («أعد إنتاج المشاهد المتأثرة»).
 * مشهد عاد إعداده إلى «متوسط/عادي» تُحذف نسخته المطبَّقة (مجانية) فيعود الأصل كما هو.
 */
export const refreshPace = async (episode: string, scope: RefreshScope = {}): Promise<RefreshResult> => {
  const { serialized } = await import("../studio/sceneService");
  const scriptPath = await resolveScriptPath(episode);
  const result: RefreshResult = { applied: [], cleared: [], failed: [] };
  let statuses: Record<string, string> = {};
  if (scope.open && !scope.all) {
    try {
      const { inspectSceneProduction } = await import("../studio/sceneService");
      statuses = Object.fromEntries((await inspectSceneProduction(episode)).scenes.map((x: { id: string; status: string }) => [x.id, x.status]));
    } catch { /* no ledger yet: every scene is open */ }
  }
  await serialized(pacedIndexFor(scriptPath), async () => {
    const { ctx, lists } = await sentenceLists(episode);
    const doc = await loadPace(scriptPath);
    const dir = voiceDir(scriptPath);
    const raw = (await readJson<Record<string, RawClip>>(path.join(dir, "index.json"))) ?? {};
    const paced: PacedIndex = await loadPacedIndex(scriptPath);
    const paces = pacesFor(doc, ctx.plan, lists);
    let changed = false;
    const unusedLater: string[] = [];
    for (const s of flat(ctx.plan)) {
      const sp = paces[s.id];
      if (!sp) continue;
      const r = raw[s.id];
      const entry = paced[s.id];
      const hasVoice = rawUsable(r, s, dir);
      const valid = hasVoice && pacedValidFor(entry, r, dir);
      const applied = valid ? entry!.key : "";
      if (sp.key === applied && (valid || !entry)) continue;
      const stale = Boolean(entry) && !valid;
      const wanted = scope.all || stale || scope.scenes?.includes(s.id) ||
        (scope.open && !["approved", "in_review"].includes(statuses[s.id] ?? "queued"));
      if (!wanted) continue;
      if (entry) { unusedLater.push(entry.clip.file); delete paced[s.id]; changed = true; }
      if (!hasVoice || !sp.key) { if (entry) result.cleared.push(s.id); continue; }
      try {
        paced[s.id] = await derivePaced(scriptPath, r!, sp);
        changed = true;
        result.applied.push(s.id);
      } catch (e) {
        result.failed.push({ id: s.id, error: (e as Error).message });
      }
    }
    if (changed) await savePacedIndex(scriptPath, paced);
    // النسخ المطبَّقة القديمة مجانية (تُعاد من الأصل): تُحذف إن لم يعد يشير إليها مشهد. الأصل لا يُمس أبدًا.
    const used = new Set(Object.values(paced).map((e) => e.clip.file));
    for (const f of unusedLater) if (f.startsWith(PACED_PREFIX) && path.basename(f) === f && !used.has(f)) await unlink(path.join(dir, f)).catch(() => {});
  });
  return result;
};

/** سرعة الجملة كما تُعرض في «الجمل» (صريحة أو موروثة) */
export const sentenceSpeedRow = (doc: PaceDoc, sceneId: string, text: string) => {
  const r = speedOf(doc, sceneId, text);
  return { speed: r.source === "sentence" ? r.id : "", inheritedSpeed: sceneSpeedOf(doc, sceneId).id };
};
