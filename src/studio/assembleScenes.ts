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
import { writeFile, rm, stat, rename } from "node:fs/promises";
import config from "../../config.json";
import { loadPlan } from "../plan/io";
import { collectMedia } from "../plan/collect";
import { sceneFrames } from "../plan/duration";
import { seamAudio, seamPlan } from "../plan/seams";
import type { PlanScene } from "../plan/types";
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

export const joinSceneCuts = async (episode: string, cuts: Cut[], tempVideo: string, script: string) => {
  const evidence = await Promise.all(cuts.map(item => verifyVideoEvidence(item.file)));
  const base = evidence[0]!;
  if (evidence.some(item => item.width !== base.width ||
      item.height !== base.height || item.audioTracks !== base.audioTracks))
    throw Error("All AV scene cuts must use matching video dimensions and audio track structure.");
  const plan = await loadPlan(episode);
  if (!plan) throw Error("Prepare and save a storyboard plan first.");
  const fps = config.video.fps;
  const byId = new Map(plan.chapters.flatMap((c) => c.scenes).map((s) => [s.id, s]));
  const scenes = cuts.map((c) => byId.get(c.sceneId));
  if (scenes.some((s) => !s)) throw Error("A scene cut is not in the current plan.");
  const list = scenes as PlanScene[];
  const media = await collectMedia(episode, plan);
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
  const loud = await narrationLoudness(await resolveScriptPath(episode), plan, media);
  const starts: number[] = [0];
  for (let i = 0; i + 1 < cuts.length; i++) starts.push(starts[i]! + real[i]! - seams[i]!.overlapFrames / fps);
  const total = starts[cuts.length - 1]! + real[cuts.length - 1]!;
  const f6 = (x: number) => x.toFixed(6);
  const g: string[] = [];
  cuts.forEach((_, i) => {
    g.push(`[${i}:v:0]settb=AVTB,fps=${fps},format=yuv420p,setsar=1[v${i}]`);
    const lead = i === 0 ? intro : 0;
    const a = audio[i]!;
    const fx = [`aresample=48000`, `atrim=0:${f6(real[i]!)}`, `asetpts=PTS-STARTPTS`, `apad=whole_dur=${f6(real[i]!)}`];
    const gain = loud.gain[cuts[i]!.sceneId];
    if (gain && gain !== 1) fx.push(`volume=${gain}`);
    if (a.fadeInSec) fx.push(`afade=t=in:st=${f6(lead)}:d=${f6(a.fadeInSec)}:curve=qsin`);
    if (a.fadeOutStart !== undefined && a.fadeOutSec) fx.push(`afade=t=out:st=${f6(lead + a.fadeOutStart)}:d=${f6(a.fadeOutSec)}:curve=qsin`);
    if (starts[i]! > 0) fx.push(`adelay=${Math.round(starts[i]! * 1000)}:all=1`);
    g.push(`[${i}:a:0]${fx.join(",")}[a${i}]`);
  });
  let cur = "v0";
  for (let i = 1; i < cuts.length; i++) {
    const out = i === cuts.length - 1 ? "vout" : `x${i}`;
    const d = seams[i - 1]!.dissolveFrames;
    g.push(d > 0 ? `[${cur}][v${i}]xfade=transition=fade:duration=${f6(d / fps)}:offset=${f6(starts[i]!)}[${out}]`
      // concat outputs AV_TIME_BASE (1/1000000), but xfade needs both inputs on the scenes' 1/fps time base: a hard
      // cut followed by a dissolve failed with «First input link main timebase … do not match» (#154 e2e, KI-082).
      : `[${cur}][v${i}]concat=n=2:v=1:a=0,settb=1/${fps}[${out}]`);
    cur = out;
  }
  if (cuts.length === 1) g.push(`[v0]null[vout]`);
  g.push(`${cuts.map((_, i) => `[a${i}]`).join("")}amix=inputs=${cuts.length}:normalize=0:dropout_transition=0,atrim=0:${f6(total)}[aout]`);
  await writeFile(script, g.join(";\n"), { flag: "wx", mode: 0o600 });
  const q = qualitySpec("preview");
  // FFmpeg 8 removed -filter_complex_script (owner's Mac, 18 Nov): the form follows the local FFmpeg (ffmpegFilterScript.ts)
  const run = (form: Awaited<ReturnType<typeof localFilterScriptForm>>) => exec("ffmpeg", [
    "-nostdin", "-hide_banner", "-loglevel", "error",
    ...cuts.flatMap((c) => ["-i", c.file]),
    ...filterScriptArgs(script, form), "-map", "[vout]", "-map", "[aout]",
    "-c:v", "libx264", "-preset", q.x264Preset, "-crf", String(q.crf), "-pix_fmt", "yuv420p",
    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
    "-c:a", "aac", "-b:a", q.audioBitrate, "-ar", "48000",
    "-map_metadata", "-1", "-movflags", "+faststart", "-y", tempVideo,
  ], { timeout: 3_600_000, maxBuffer: 8 * 1024 * 1024 });
  const form = await localFilterScriptForm();
  try { await run(form); }
  catch (error) { if (!refusedOption(error)) throw error; await run(otherForm(form)); }
  await verifyVideoEvidence(tempVideo, base.width, base.height);
  const sceneSeconds = Object.fromEntries(cuts.map((c, i) => [c.sceneId, i + 1 < cuts.length ? starts[i + 1]! - starts[i]! : real[i]!]));
  return { fps, sceneSeconds, seams: seams.map((x, i) => ({ ...x, at: Math.round(starts[i + 1]! * 1000) / 1000 })),
    loudness: { target: loud.target, gain: loud.gain } };
};

const writeSeamsRecord = async (scriptPath: string, published: string, joined: Awaited<ReturnType<typeof joinSceneCuts>>, slot = "episode") => {
  const st = await stat(published);
  const rec: SeamsRecord = { version: 1, size: st.size, mtimeMs: st.mtimeMs, ...joined };
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
    await writeSeamsRecord(scriptPath, saved.file, joined, PRE_FINAL_SLOT).catch(() => undefined);
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
