import path from "node:path";
import { existsSync } from "node:fs";
import { cp, mkdir, rm } from "node:fs/promises";
import { projectRoot } from "../config/paths";
import { resolveScriptPath } from "../script/episodes";
import { loadVoiceIndex, voiceDirFor, audioDuration } from "../voice/generate";
import { availableSfx, sfxFile } from "../voice/sfx";
import { recitationFileFor, type EpisodeMedia, type Recitation } from "./media";
import type { Plan } from "./types";

export const recitationsDir = path.join(projectRoot, "assets", "recitations");

/** يجمع وسائط الحلقة الموجودة فعلًا على القرص (بلا نسخ). */
export const collectMedia = async (episode: string, plan: Plan): Promise<Omit<EpisodeMedia, "mode" | "base">> => {
  const voice = await loadVoiceIndex(episode);
  const used = new Set(plan.chapters.flatMap((c) => c.scenes.flatMap((s) => s.sfx.map((x) => x.id))));
  const sfx = availableSfx().filter((id) => used.has(id));
  const recitations: Record<string, Recitation> = {};
  for (const s of plan.chapters.flatMap((c) => c.scenes)) {
    if (s.template !== "verse-card" || !s.ayahKey) continue;
    const file = recitationFileFor(s.ayahKey);
    const full = path.join(recitationsDir, file);
    if (!existsSync(full)) continue;
    const duration = await audioDuration(full);
    if (duration) recitations[s.ayahKey] = { file, duration };
  }
  return { voice, sfx, recitations };
};

/** ينسخ الوسائط إلى public/_render/<الحلقة> ليضمّها Remotion في الرندر. */
export const prepareRenderMedia = async (episode: string, plan: Plan): Promise<EpisodeMedia> => {
  const m = await collectMedia(episode, plan);
  // اسم مجلد آمن حتى لو مُرّر مسار كامل للحلقة
  const rel = `_render/${path.basename(String(episode)).replace(/[^\w.-]/g, "_")}/`;
  const dest = path.join(projectRoot, "public", rel);
  await rm(dest, { recursive: true, force: true });
  for (const d of ["voice", "sfx", "recitations"]) await mkdir(path.join(dest, d), { recursive: true });
  const vdir = voiceDirFor(await resolveScriptPath(episode));
  for (const clip of Object.values(m.voice)) {
    const src = path.join(vdir, clip.file);
    if (existsSync(src)) await cp(src, path.join(dest, "voice", clip.file));
  }
  for (const id of m.sfx) await cp(sfxFile(id), path.join(dest, "sfx", `${id}.mp3`));
  for (const r of Object.values(m.recitations)) await cp(path.join(recitationsDir, r.file), path.join(dest, "recitations", r.file));
  return { ...m, mode: "static", base: rel };
};
