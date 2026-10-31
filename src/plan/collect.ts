import path from "node:path";
import { existsSync } from "node:fs";
import { cp, mkdir, rm } from "node:fs/promises";
import { projectRoot } from "../config/paths";
import { resolveScriptPath } from "../script/episodes";
import { loadVoiceIndex, voiceDirFor, audioDuration } from "../voice/generate";
import { availableSfx, sfxFile } from "../voice/sfx";
import { recitationFileFor, type EpisodeMedia, type Recitation } from "./media";
import type { Plan } from "./types";
import { readJson } from "./io";
import { recitationsDirFor, type RecitationIndex } from "../quran/sync";

export const recitationsDir = path.join(projectRoot, "assets", "recitations");

/** يجمع وسائط الحلقة الموجودة فعلًا على القرص (بلا نسخ). */
export const collectMedia = async (episode: string, plan: Plan): Promise<Omit<EpisodeMedia, "mode" | "base">> => {
  const voice = await loadVoiceIndex(episode);
  const used = new Set(plan.chapters.flatMap((c) => c.scenes.flatMap((s) => s.sfx.map((x) => x.id))));
  const sfx = availableSfx().filter((id) => used.has(id));
  const recitations: Record<string, Recitation> = {};
  const recDir = recitationsDirFor(await resolveScriptPath(episode));
  const qf = (await readJson<RecitationIndex>(path.join(recDir, "index.json"))) ?? {};
  for (const s of plan.chapters.flatMap((c) => c.scenes)) {
    if (s.template !== "verse-card" || !s.ayahKey) continue;
    // 1) تلاوة مرخّصة بإذن مكتوب (assets/recitations) لها الأولوية
    const file = recitationFileFor(s.ayahKey);
    const full = path.join(recitationsDir, file);
    if (existsSync(full)) {
      const duration = await audioDuration(full);
      if (duration) {
        recitations[s.ayahKey] = { file, duration, source: "licensed" };
        continue;
      }
    }
    // 2) تلاوة من Quran Foundation (إن اختارت القناة قارئًا وجُلبت)
    const q = qf[s.ayahKey];
    if (q && q.parts.length && q.parts.every((p) => p.duration > 0 && existsSync(path.join(recDir, p.file)))) {
      recitations[s.ayahKey] = { file: q.parts[0]!.file, duration: q.parts.reduce((n, p) => n + p.duration + 0.25, -0.25), parts: q.parts, reciter: q.reciter, source: "quran-foundation" };
    }
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
  const recDir = recitationsDirFor(await resolveScriptPath(episode));
  for (const r of Object.values(m.recitations)) {
    if (r.source === "quran-foundation") for (const p of r.parts ?? []) await cp(path.join(recDir, p.file), path.join(dest, "recitations", p.file));
    else await cp(path.join(recitationsDir, r.file), path.join(dest, "recitations", r.file));
  }
  return { ...m, mode: "static", base: rel };
};
