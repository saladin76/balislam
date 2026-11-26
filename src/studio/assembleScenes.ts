/**
 * Studio V2: make a full-episode review cut from the exact human-approved
 * audio+video scene files. No new scene render, TTS, or external Quran lookup.
 * This is NOT Master authorization or permission to publish.
 */
import { scriptVersesAreCitations } from "../quran/citationChannel";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, rm, stat, rename, mkdir, readFile } from "node:fs/promises";
import config from "../../config.json";
import { loadPlan } from "../plan/io";
import { collectMedia } from "../plan/collect";
import { sceneFrames } from "../plan/duration";
import { seamAudio, seamPlan } from "../plan/seams";
import type { Plan, PlanScene } from "../plan/types";
import type { EpisodeMedia } from "../plan/media";
import { introFramesFor } from "../remotion/scenes/ChannelIntro";
import { channelInfo, loadChannel } from "../channel";
import { qualitySpec } from "../render/quality";
import { narrationLoudness } from "./narrationLoudness";
import { seamsRecordFile, type SeamsRecord } from "./seamsRecord";
export { readSeamsRecord } from "./seamsRecord";
import { resolveScriptPath } from "../script/episodes";
import { putEpisodePreview } from "../render/episodePreviews";
import { verifyVideoEvidence } from "./videoEvidence";
import { filterScriptArgs, localFilterScriptForm, otherForm, refusedOption } from "../render/ffmpegFilterScript";
import { approvedSceneCutsForAssembly, currentSceneCutsForPreFinal } from "./sceneService";
import { assertOneMachine, previewMachines } from "../render/worker/provenance";

const exec = promisify(execFile);
const safeId = (value: string) => /^[a-z0-9][a-z0-9-]{0,70}$/.test(value);

/**
 * One continuous narration (owner, 16 Nov: «فصلات في الكلام لأنها من تجميع المشاهد»). The exact approved cuts are joined, not
 * re-rendered: each next cut starts under the silent tail of the one before it (src/plan/seams.ts), so the silence between the
 * last word and the next first word is the chosen «الفاصل», the picture of the earlier cut dissolves under the next one, the
 * room tone crosses with an equal-power fade, and every narrated scene gets the episode's own median loudness
 * (src/studio/narrationLoudness.ts). Each cut's audio is cut to its own video length, so no AAC padding piles up into a drift.
 * The Master (src/remotion/scenes/Episode.tsx) uses the same seam plan and gains. Verse scenes, their lead-in, the basmala and
 * intended stillness keep their seams exactly as they are. Writes previews/episode.seams.json (the joins of this file).
 */
type Cut = { sceneId: string; file: string };
const probeSeconds = async (file: string) => {
  const { stdout } = await exec("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=nb_frames,duration,r_frame_rate", "-of", "json", file]);
  const st = JSON.parse(stdout).streams?.[0] ?? {};
  return Number(st.duration);
};

/** Seconds of air kept before the first word of an episode (KI-091). */
export const HEAD_AIR = 0.4;
/** Trim a joined head only when its silence is longer than this. */
export const HEAD_TRIM_FROM = 0.6;
/** How much of the head to trim, given the silence before the first word. */
export const headTrimFor = (silence: number) => (silence > HEAD_TRIM_FROM ? Math.round((silence - HEAD_AIR) * 1000) / 1000 : 0);
/** Silence at the very start of a file's sound (-45 dB, at least 0.3 s), in seconds; 0 when it starts speaking. */
export const leadingSilence = async (file: string): Promise<number> => {
  const r = await exec("ffmpeg", ["-hide_banner", "-nostats", "-t", "15", "-i", file, "-af", "silencedetect=n=-45dB:d=0.3", "-f", "null", "-"], { maxBuffer: 8 * 1024 * 1024 }).catch((e: { stderr?: string }) => ({ stderr: e.stderr ?? "" }));
  const m = /silence_start: (-?[\d.]+)[\s\S]*?silence_end: ([\d.]+)/.exec(String(r.stderr));
  return m && Number(m[1]) < 0.05 ? Number(m[2]) : 0;
};

/** KI-123: at most this many scene cuts are decoded together in one picture pass of the join. */
export const JOIN_CHUNK_CUTS = 8;
/** Consecutive [from, to) ranges covering every cut exactly once, each of at most `max` cuts, as even as possible. */
export const planJoinChunks = (n: number, max = JOIN_CHUNK_CUTS): [number, number][] => {
  if (n <= 0) return [];
  const k = Math.ceil(n / Math.max(1, max));
  return Array.from({ length: k }, (_, i) => [Math.round((i * n) / k), Math.round(((i + 1) * n) / k)] as [number, number]);
};
/**
 * The picture chain of n inputs [v0]…[v{n-1}] → [vout]: a dissolve (xfade at the input's start) where the seam before it has
 * dissolve frames, else a hard cut. The same chain joins the cuts of a chunk and then the chunks, so a dissolve that falls
 * on a chunk boundary is made in the final pass with the same duration at the same offset on the episode clock.
 */
export const videoChain = (n: number, dissolveBefore: (i: number) => number, startOf: (i: number) => number, fps: number): string[] => {
  if (n === 1) return ["[v0]null[vout]"];
  const f6 = (x: number) => x.toFixed(6);
  const g: string[] = [];
  let cur = "v0";
  for (let i = 1; i < n; i++) {
    const out = i === n - 1 ? "vout" : `x${i}`;
    const d = dissolveBefore(i);
    g.push(d > 0 ? `[${cur}][v${i}]xfade=transition=fade:duration=${f6(d / fps)}:offset=${f6(startOf(i))}[${out}]`
      // concat outputs AV_TIME_BASE (1/1000000), but xfade needs both inputs on the scenes' 1/fps time base: a hard
      // cut followed by a dissolve failed with «First input link main timebase … do not match» (#154 e2e, KI-082).
      : `[${cur}][v${i}]concat=n=2:v=1:a=0,settb=1/${fps}[${out}]`);
    cur = out;
  }
  return g;
};
// KI-122: one encoder thread and a short look-ahead (the encoder's frame buffers grow with its threads)
const ONE_THREAD_X264 = ["-threads", "1", "-x264-params", "threads=1:lookahead-threads=1:rc-lookahead=10"];
/** One ffmpeg pass of the join, with the memory limits of KI-092/KI-122 on every input, on the graph and on the encoder. */
export const runJoinPass = async (script: string, graph: string[], inputs: string[], out: string[]) => {
  await writeFile(script, graph.join(";\n"), { flag: "wx", mode: 0o600 });
  // FFmpeg 8 removed -filter_complex_script (owner's Mac, 18 Nov): the form follows the local FFmpeg (ffmpegFilterScript.ts)
  const run = (form: Awaited<ReturnType<typeof localFilterScriptForm>>) => exec("ffmpeg", [
    "-nostdin", "-hide_banner", "-loglevel", "error",
    // KI-122: the filter graph single-threaded too (47 cuts were SIGKILLed at ~1.3 GB on 22 Nov; 933 MB on one thread).
    "-filter_complex_threads", "1",
    // KI-092: one decoder thread per input. With FFmpeg's default (a thread per core), 47 cuts at 1080p took ~6 GB and
    // macOS killed the join (SIGKILL, no message) on the owner's 8 GB Mac; measured on 24 cuts: 3.2 GB → 1.1 GB.
    ...inputs.flatMap((file) => ["-threads", "1", "-i", file]),
    ...filterScriptArgs(script, form), ...out,
  ], { timeout: 3_600_000, maxBuffer: 8 * 1024 * 1024 }).catch((error: Error & { signal?: string | null }) => {
    // A kill by the system (out of memory) leaves no ffmpeg message: say so, not a bare «Command failed»
    if (error.signal) error.message = `ffmpeg stopped by ${error.signal} (likely out of memory). ${error.message}`;
    throw error;
  });
  const form = await localFilterScriptForm();
  try { await run(form); }
  catch (error) { if (!refusedOption(error)) throw error; await run(otherForm(form)); }
};

/**
 * D232: the Windows worker joins the cuts it rendered with the plan, media snapshot and narration gains the Mac computed
 * (it has no voice folder): `given` replaces the three reads below; the join itself is the same code.
 */
export type JoinInputs = { plan: Plan; media: EpisodeMedia; loudness: { target: number | null; gain: Record<string, number> } };
export const joinSceneCuts = async (episode: string, cuts: Cut[], tempVideo: string, script: string, given?: JoinInputs) => {
  const evidence = await Promise.all(cuts.map(item => verifyVideoEvidence(item.file)));
  const base = evidence[0]!;
  if (evidence.some(item => item.width !== base.width ||
      item.height !== base.height || item.audioTracks !== base.audioTracks))
    throw Error("All AV scene cuts must use matching video dimensions and audio track structure.");
  const plan = given?.plan ?? await loadPlan(episode);
  if (!plan) throw Error("Prepare and save a storyboard plan first.");
  const fps = config.video.fps;
  const byId = new Map(plan.chapters.flatMap((c) => c.scenes).map((s) => [s.id, s]));
  const scenes = cuts.map((c) => byId.get(c.sceneId));
  if (scenes.some((s) => !s)) throw Error("A scene cut is not in the current plan.");
  const list = scenes as PlanScene[];
  const media = given?.media ?? await collectMedia(episode, plan);
  const intro = introFramesFor(channelInfo(loadChannel()), plan) / fps;
  const real = await Promise.all(cuts.map((c) => probeSeconds(c.file)));
  // A cut whose length is not the plan's (a frame and a half of slack) is never joined: its seams stay as they are.
  const off = list.map((s, i) => !(Math.abs(real[i]! - (sceneFrames(s, media, fps) / fps + (i === 0 ? intro : 0))) <= 1.5 / fps));
  const planned = seamPlan(list, media, { fps, channelId: plan.channel });
  const seams = planned.map((x, i) => off[i] || off[i + 1]
    ? { ...x, gap: x.stacked, overlapFrames: 0, dissolveFrames: 0, kept: "ملف المشهد لا يطابق مدته في الخطة" }
    : x);
  const audio = seamAudio(list, media, { fps, channelId: plan.channel }).map((a, i) => ({
    ...(seams[i - 1]?.overlapFrames ? { fadeInSec: a.fadeInSec } : {}),
    ...(seams[i]?.overlapFrames ? { fadeOutStart: a.fadeOutStart, fadeOutSec: a.fadeOutSec } : {}),
  }));
  const loud = given?.loudness ?? await narrationLoudness(await resolveScriptPath(episode), plan, media);
  const starts: number[] = [0];
  for (let i = 0; i + 1 < cuts.length; i++) starts.push(starts[i]! + real[i]! - seams[i]!.overlapFrames / fps);
  const total = starts[cuts.length - 1]! + real[cuts.length - 1]!;
  const f6 = (x: number) => x.toFixed(6);
  // KI-091 (D155): the episode starts speaking. «دفاتر الزمن 001» opened on 3.5 s of silence inside its first scene;
  // whatever its cause, the joined head is trimmed (picture and sound together) to HEAD_AIR before the first word.
  const head = list[0]?.narration?.trim() ? headTrimFor(await leadingSilence(cuts[0]!.file)) : 0;
  const q = qualitySpec("preview");
  // KI-123: the join runs in bounded passes — the picture in chunks of at most JOIN_CHUNK_CUTS cuts, the sound in one pass
  // that never decodes a picture, and a light final pass over the chunks — never one graph over every scene: that graph
  // grew to ~0.9 GB on 47 cuts and macOS killed it with no message on the owner's 8 GB Mac (22 Nov).
  const work = `${script}.d`;
  await mkdir(work, { mode: 0o700 });
  try {
    const chunks = planJoinChunks(cuts.length);
    const parts: string[] = [];
    for (const [k, [a, b]] of chunks.entries()) {
      // The picture of cuts a..b-1 with their own dissolves and hard cuts, on the chunk's clock (starts relative to a)
      const gv: string[] = [];
      for (let i = a; i < b; i++) gv.push(`[${i - a}:v:0]settb=AVTB,fps=${fps},format=yuv420p,setsar=1[v${i - a}]`);
      gv.push(...videoChain(b - a, (j) => seams[a + j - 1]!.dissolveFrames, (j) => starts[a + j]! - starts[a]!, fps));
      const part = path.join(work, `part-${k}.mkv`);
      await runJoinPass(path.join(work, `part-${k}.filter`), gv, cuts.slice(a, b).map((c) => c.file), [
        // a near-lossless intermediate: it is encoded once more in the final pass
        "-map", "[vout]", "-c:v", "libx264", "-preset", "superfast", "-crf", "10", "-pix_fmt", "yuv420p", ...ONE_THREAD_X264, "-an", "-y", part,
      ]);
      parts.push(part);
    }
    const ga: string[] = [];
    cuts.forEach((_, i) => {
      const lead = i === 0 ? intro : 0;
    const a = audio[i]!;
    const fx = [`aresample=48000`, `atrim=0:${f6(real[i]!)}`, `asetpts=PTS-STARTPTS`, `apad=whole_dur=${f6(real[i]!)}`];
    const gain = loud.gain[cuts[i]!.sceneId];
    if (gain && gain !== 1) fx.push(`volume=${gain}`);
    if (a.fadeInSec) fx.push(`afade=t=in:st=${f6(lead)}:d=${f6(a.fadeInSec)}:curve=qsin`);
    if (a.fadeOutStart !== undefined && a.fadeOutSec) fx.push(`afade=t=out:st=${f6(lead + a.fadeOutStart)}:d=${f6(a.fadeOutSec)}:curve=qsin`);
      if (starts[i]! > 0) fx.push(`adelay=${Math.round(starts[i]! * 1000)}:all=1`);
      ga.push(`[${i}:a:0]${fx.join(",")}[a${i}]`);
    });
    ga.push(`${cuts.map((_, i) => `[a${i}]`).join("")}amix=inputs=${cuts.length}:normalize=0:dropout_transition=0,atrim=0:${f6(total)}[aout]`);
    // The sound of every cut mixed on the episode clock, in PCM (no AAC priming at a boundary). The pictures are not used,
    // so they are never decoded here (measured on the 47 cuts of «دفاتر الزمن 001»: ~90 MB, 4 s).
    const sound = path.join(work, "sound.wav");
    await runJoinPass(path.join(work, "sound.filter"), ga, cuts.map((c) => c.file), ["-map", "[aout]", "-c:a", "pcm_s24le", "-y", sound]);
    // The final pass: the chunks joined at the seam before each chunk's first cut (same dissolve, same offset on the
    // episode clock as in one graph), the sound, and the head trim
    const g: string[] = parts.map((_, k) => `[${k}:v:0]settb=AVTB,fps=${fps},format=yuv420p,setsar=1[v${k}]`);
    g.push(...videoChain(parts.length, (k) => seams[chunks[k]![0] - 1]!.dissolveFrames, (k) => starts[chunks[k]![0]]!, fps));
    g.push(`[${parts.length}:a:0]anull[aout]`);
    if (head > 0) {
      for (let k = 0; k < g.length; k++) g[k] = g[k]!.replace("[vout]", "[vjoin]").replace("[aout]", "[ajoin]");
      g.push(`[vjoin]trim=start=${f6(head)},setpts=PTS-STARTPTS[vout]`, `[ajoin]atrim=start=${f6(head)},asetpts=PTS-STARTPTS[aout]`);
    }
    await runJoinPass(script, g, [...parts, sound], [
      "-map", "[vout]", "-map", "[aout]",
      "-c:v", "libx264", "-preset", q.x264Preset, "-crf", String(q.crf), "-pix_fmt", "yuv420p", ...ONE_THREAD_X264,
      "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
      "-c:a", "aac", "-b:a", q.audioBitrate, "-ar", "48000",
      "-map_metadata", "-1", "-movflags", "+faststart", "-y", tempVideo,
    ]);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
  await verifyVideoEvidence(tempVideo, base.width, base.height);
  // المرحلة A (المهمة ٣): الحلقة كلها بعلو −14 LUFS بقياسين وكسب خطي واحد (src/studio/quality/normalize.ts)
  const { normalizeProgramLoudness } = await import("./quality/normalize");
  const program = await normalizeProgramLoudness(tempVideo, q.audioBitrate);
  await verifyVideoEvidence(tempVideo, base.width, base.height);
  const sceneSeconds = Object.fromEntries(cuts.map((c, i) => [c.sceneId, (i + 1 < cuts.length ? starts[i + 1]! - starts[i]! : real[i]!) - (i === 0 ? head : 0)]));
  return { fps, sceneSeconds, headTrimmed: head, seams: seams.map((x, i) => ({ ...x, at: Math.round((starts[i + 1]! - head) * 1000) / 1000 })),
    loudness: { target: loud.target, gain: loud.gain }, program };
};

const writeSeamsRecord = async (scriptPath: string, published: string, joined: Awaited<ReturnType<typeof joinSceneCuts>>, slot = "episode",
  extra: Pick<SeamsRecord, "sceneSha256" | "fileSha256"> = {}) => {
  const st = await stat(published);
  const rec: SeamsRecord = { version: 1, size: st.size, mtimeMs: st.mtimeMs, ...joined, ...extra };
  const file = seamsRecordFile(scriptPath, slot);
  const tmp = `${file}.${randomUUID()}.tmp`;
  await writeFile(tmp, JSON.stringify(rec, null, 1) + "\n", { mode: 0o600 });
  await rename(tmp, file);
};

/** The pre-final preview's own slot: never "episode" (the assembly the owner approves) and never a Master. */
export const PRE_FINAL_SLOT = "prefinal-no-recitation";

/**
 * «معاينة قبل النهائية» (owner decision, 8 Nov: recitations come last): every scene's current cut in
 * order (approved or not; verse scenes without a recitation are silent, marked drafts) joined into ONE
 * 1080p preview with narration, to watch the whole episode before recording the verses.
 * It is NOT an approval and cannot become one: it lives in its own preview slot, the assembly decision
 * reads only previews/episode.mp4, and assembly/Master/publish still need every scene approved
 * unconditionally (with its recitation), the assembly approved after a full 1× viewing, then Master.
 */
export const assemblePreFinalPreview = async (
  episode: string,
): Promise<{ file: string; version: number; scenes: number; recitationPending: string[] }> => {
  const cuts = await currentSceneCutsForPreFinal(episode);
  if (!cuts.length || cuts.some(item => !safeId(item.sceneId)))
    throw Error("No safe scene cuts are ready for the pre-final preview.");
  const scriptPath = await resolveScriptPath(episode);
  const previews = path.join(path.dirname(scriptPath), "previews");
  // D233: every cut of the episode from one machine (the Windows and Mac Chrome draw Arabic text a few pixels apart)
  assertOneMachine(await previewMachines(previews, cuts), "نسخة قبل النهائية");
  const id = randomUUID();
  const manifest = path.join(previews, `.scene-prefinal-${id}.filter`);
  const tempVideo = path.join(previews, `.scene-prefinal-${id}.mp4`);
  try {
    const joined = await joinSceneCuts(episode, cuts, tempVideo, manifest);
    const after = await currentSceneCutsForPreFinal(episode);
    if (after.length !== cuts.length || after.some((item, i) => item.sceneId !== cuts[i]!.sceneId || item.sha256 !== cuts[i]!.sha256))
      throw Error("A scene changed while the pre-final preview was assembling; try again.");
    const pending = cuts.filter(c => c.recitationPending).map(c => c.sceneId);
    const saved = await putEpisodePreview(episode, PRE_FINAL_SLOT, tempVideo, {
      // D68: a written-citation channel has no recitations to wait for, so the title does not mention them.
      title: scriptVersesAreCitations(scriptPath) ? "نسخة قبل النهائية (للمشاهدة فقط)" : "نسخة قبل النهائية — بلا تلاوات (للمشاهدة فقط)",
      note: `كل المشاهد الحالية بالترتيب، معتمدة أو مسودات${pending.length ? `؛ ${pending.length} آية صامتة «التلاوة تُضاف لاحقًا»` : ""}. ليست اعتمادًا ولا تجميعًا ولا Master.`,
    });
    // D199: which cut of each scene is inside this file, and the file's fingerprint (the watch record is keyed by it)
    const { createHash } = await import("node:crypto");
    const fileSha256 = createHash("sha256").update(await readFile(saved.file)).digest("hex");
    await writeSeamsRecord(scriptPath, saved.file, joined, PRE_FINAL_SLOT,
      { sceneSha256: Object.fromEntries(cuts.map((c) => [c.sceneId, c.sha256])), fileSha256 }).catch(() => undefined);
    return { file: saved.file, version: saved.version, scenes: cuts.length, recitationPending: pending };
  } finally {
    await Promise.allSettled([rm(manifest, { force: true }), rm(tempVideo, { force: true })]);
  }
};

export const assembleApprovedSceneAv = async (
  episode: string,
): Promise<{ file: string; version: number; scenes: number }> => {
  const cuts = await approvedSceneCutsForAssembly(episode);
  if (!cuts.length || cuts.some(item => !safeId(item.sceneId)))
    throw Error("No safe, signed scene cuts are ready for assembly.");

  const scriptPath = await resolveScriptPath(episode);
  const previews = path.join(path.dirname(scriptPath), "previews");
  // D233: every cut of the episode from one machine
  assertOneMachine(await previewMachines(previews, cuts), "تجميع");
  const id = randomUUID();
  const manifest = path.join(previews, `.scene-assembly-${id}.filter`);
  const tempVideo = path.join(previews, `.scene-assembly-${id}.mp4`);

  try {
    // Every file path is a fixed relative name from an audited scene id.
    // The ffconcat manifest never contains a client-controlled filesystem path.
    const joined = await joinSceneCuts(episode, cuts, tempVideo, manifest);
    // Revalidate scene bytes, source signatures and approvals before publishing.
    const after = await approvedSceneCutsForAssembly(episode);
    if (after.length !== cuts.length ||
        after.some((item, i) => item.sceneId !== cuts[i]!.sceneId ||
          item.sha256 !== cuts[i]!.sha256))
      throw Error("One or more approved AV scenes changed while the episode was assembling.");

    const saved = await putEpisodePreview(episode, "episode", tempVideo, {
      title: "الحلقة المجمّعة — مراجعة صوت وصورة",
      note: "تجميع المشاهد المعتمدة للمشاهدة الكاملة بسرعة 1×، والسرد متصل عند الوصلات؛ ليست Master معتمدة للنشر.",
    });
    await writeSeamsRecord(scriptPath, saved.file, joined);
    return { file: saved.file, version: saved.version, scenes: cuts.length };
  } finally {
    await Promise.allSettled([
      rm(manifest, { force: true }), rm(tempVideo, { force: true }),
    ]);
  }
};
