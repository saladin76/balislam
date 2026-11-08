/**
 * Studio V2: make a full-episode review cut from the exact human-approved
 * audio+video scene files. No new scene render, TTS, or external Quran lookup.
 * This is NOT Master authorization or permission to publish.
 */
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, rm } from "node:fs/promises";
import { resolveScriptPath } from "../script/episodes";
import { putEpisodePreview } from "../render/episodePreviews";
import { verifyVideoEvidence } from "../workflow/videoEvidence";
import { approvedSceneCutsForAssembly } from "./sceneService";

const exec = promisify(execFile);
const safeId = (value: string) => /^[a-z0-9][a-z0-9-]{0,70}$/.test(value);

export const assembleApprovedSceneAv = async (
  episode: string, ownerToken: unknown,
): Promise<{ file: string; version: number; scenes: number }> => {
  const cuts = await approvedSceneCutsForAssembly(episode, ownerToken);
  if (!cuts.length || cuts.some(item => !safeId(item.sceneId)))
    throw Error("No safe, signed scene cuts are ready for assembly.");

  const scriptPath = await resolveScriptPath(episode);
  const previews = path.join(path.dirname(scriptPath), "previews");
  const id = randomUUID();
  const manifest = path.join(previews, `.scene-assembly-${id}.ffconcat`);
  const tempVideo = path.join(previews, `.scene-assembly-${id}.mp4`);

  try {
    const evidence = await Promise.all(cuts.map(item => verifyVideoEvidence(item.file)));
    const base = evidence[0]!;
    if (evidence.some(item => item.width !== base.width ||
        item.height !== base.height || item.audioTracks !== base.audioTracks))
      throw Error("All approved AV scenes must use matching video dimensions and audio track structure.");

    // Every file path is a fixed relative name from an audited scene id.
    // The ffconcat manifest never contains a client-controlled filesystem path.
    const manifestText = "ffconcat version 1.0\n" +
      cuts.map(item => `file scene-${item.sceneId}-av.mp4\n`).join("");
    await writeFile(manifest, manifestText, { flag: "wx", mode: 0o600 });
    await exec("ffmpeg", [
      "-nostdin", "-hide_banner", "-loglevel", "error",
      "-f", "concat", "-safe", "1", "-i", manifest,
      "-map", "0:v:0", "-map", "0:a:0",
      "-c", "copy", "-movflags", "+faststart", tempVideo,
    ], { timeout: 120000, maxBuffer: 2 * 1024 * 1024 });

    await verifyVideoEvidence(tempVideo, base.width, base.height);
    // Revalidate scene bytes, source signatures and approvals before publishing.
    const after = await approvedSceneCutsForAssembly(episode, ownerToken);
    if (after.length !== cuts.length ||
        after.some((item, i) => item.sceneId !== cuts[i]!.sceneId ||
          item.sha256 !== cuts[i]!.sha256))
      throw Error("One or more approved AV scenes changed while the episode was assembling.");

    const saved = await putEpisodePreview(episode, "episode", tempVideo, {
      title: "الحلقة المجمّعة — مراجعة صوت وصورة",
      note: "تجميع المشاهد المعتمدة للمشاهدة الكاملة بسرعة 1×؛ ليست Master معتمدة للنشر.",
    });
    return { file: saved.file, version: saved.version, scenes: cuts.length };
  } finally {
    await Promise.allSettled([
      rm(manifest, { force: true }), rm(tempVideo, { force: true }),
    ]);
  }
};
