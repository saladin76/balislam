import path from "node:path";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { existsSync, readdirSync } from "node:fs";
import { cp, mkdir, rm } from "node:fs/promises";
import { projectRoot } from "../config/paths";
import { resolveScriptPath } from "../script/episodes";
import { loadVoiceIndex, voiceDirFor, audioDuration } from "../voice/generate";
import { availableSfx, sfxFile } from "../voice/sfx";
import { recitationFileFor, type EpisodeMedia, type Recitation } from "./media";
import type { Plan } from "./types";
import { readJson } from "./io";
import { recitationsDirFor, type RecitationIndex } from "../quran/sync";
import { loadChannel } from "../channel";
import { activeRecitation, isCloudRecitation, requireCloudPublicationRights } from "../quran/provider";

/** One predictable namespace per channel + actual episode folder, not a shared
 * temporary _render/001 folder that collides across the three channels.
 * scriptPath is the resolved source of truth; no TMPDIR or random identifier.
 */
export const studioMediaNamespace = (scriptPath: string) => {
  const episodeName = path.basename(path.dirname(scriptPath));
  const episodesFolder = path.basename(path.dirname(path.dirname(scriptPath)));
  const channelName = path.basename(path.dirname(path.dirname(path.dirname(scriptPath))));
  if (episodesFolder !== "episodes" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(channelName) ||
      !/^[0-9]{3}-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(episodeName))
    throw Error("مسار الحلقة غير قياسي؛ لا يمكن مشاركة وسائطها مع قناة أخرى.");
  return { channelName, episodeName, render: `_render/${channelName}/${episodeName}/` };
};

export const recitationsDir = path.join(projectRoot, "assets", "recitations");

/** صور اللوحات الوثائقية: مجلد images/ بجوار سكريبت الحلقة (لا تُرفع إلى Git لحجمها) */
export const imagesDirFor = (scriptPath: string) => path.join(path.dirname(scriptPath), "images");
export const MEDIA_EXT = /\.(jpe?g|png|webp|mp4|webm|mov)$/i;
/** مكتبة صور القناة (تُستعمل في كل الحلقات): channels/<القناة>/images */
export const libraryDirFor = (scriptPath: string) => path.join(path.dirname(scriptPath), "..", "..", "images");
/** مرجع صورة من المكتبة في الخطة: lib:<الملف>، واسمه عند النسخ للرندر وفي الروابط: lib__<الملف> */
export const LIB = "lib:";
export const imageKey = (ref: string) => (ref.startsWith(LIB) ? `lib__${ref.slice(LIB.length)}` : ref);
const listDir = (dir: string) => (existsSync(dir) ? new Set(readdirSync(dir).filter((f) => MEDIA_EXT.test(f))) : new Set<string>());
/** الصور المستعملة في مشاهد الخطة والموجودة فعلًا على القرص (من الحلقة أو من مكتبة القناة) */
export const usedImages = (plan: Plan, dir: string, libDir?: string) => {
  const onDisk = listDir(dir);
  const inLib = libDir ? listDir(libDir) : new Set<string>();
  const used = new Set(plan.chapters.flatMap((c) => c.scenes.flatMap((s) => [s.props?.image ?? "", s.props?.image2 ?? "", s.props?.image3 ?? ""])).filter(Boolean));
  // مرجع المكتبة قد يكون بلا امتداد (lib:walls-commander) فيُطابق أي ملف بنفس الاسم
  const out: string[] = [];
  for (const f of used) {
    if (!f.startsWith(LIB)) {
      if (onDisk.has(f)) out.push(f);
      continue;
    }
    const name = f.slice(LIB.length);
    const hit = inLib.has(name) ? name : [...inLib].find((x) => x.replace(MEDIA_EXT, "") === name);
    if (hit) out.push(`${LIB}${hit}`);
  }
  return out;
};
/** يطابق مرجع المشهد مع الملف الفعلي في قائمة الوسائط (يدعم مراجع المكتبة بلا امتداد) */
export const resolveImageRef = (ref: string, images: string[] = []) => images.find((x) => x === ref || x.replace(/\.[^.]+$/, "") === ref);

/** يجمع وسائط الحلقة الموجودة فعلًا على القرص (بلا نسخ). */
export const collectMedia = async (episode: string, plan: Plan): Promise<Omit<EpisodeMedia, "mode" | "base">> => {
  const voice = await loadVoiceIndex(episode);
  const used = new Set(plan.chapters.flatMap((c) => c.scenes.flatMap((s) => s.sfx.map((x) => x.id))));
  const sfx = availableSfx().filter((id) => used.has(id));
  const recitations: Record<string, Recitation> = {};
  const recDir = recitationsDirFor(await resolveScriptPath(episode));
  const qf = (await readJson<RecitationIndex>(path.join(recDir, "index.json"))) ?? {};
  const chosen = await activeRecitation(await resolveScriptPath(episode), loadChannel().recitation);
  if (chosen && isCloudRecitation(chosen)) requireCloudPublicationRights(chosen);
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
    const matching = q && chosen && (isCloudRecitation(chosen)
      ? q.provider === "alquran-cloud" && q.edition === chosen.edition
      : q.provider !== "alquran-cloud" && q.recitationId === chosen.id);
    if (q && matching && q.parts.length && q.parts.every((p) => p.duration > 0 && existsSync(path.join(recDir, p.file)))) {
      recitations[s.ayahKey] = { file: q.parts[0]!.file, duration: q.parts.reduce((n, p) => n + p.duration, 0), parts: q.parts, reciter: q.reciter, source: q.provider === "alquran-cloud" ? "alquran-cloud" : "quran-foundation" };
    }
  }
  const sp = await resolveScriptPath(episode);
  const images = usedImages(plan, imagesDirFor(sp), libraryDirFor(sp));
  return { voice, sfx, recitations, images };
};

/** ينسخ الوسائط إلى public/_render/<الحلقة> ليضمّها Remotion في الرندر. */
export const prepareRenderMedia = async (episode: string, plan: Plan): Promise<EpisodeMedia> => {
  const m = await collectMedia(episode, plan);
  // Stage media in its owning channel + episode, never another channel's 001.
  const sourceScript = await resolveScriptPath(episode);
  const rel = studioMediaNamespace(sourceScript).render;
  const dest = path.join(projectRoot, "public", rel);
  await rm(dest, { recursive: true, force: true });
  for (const d of ["voice", "sfx", "recitations", "images"]) await mkdir(path.join(dest, d), { recursive: true });
  const vdir = voiceDirFor(await resolveScriptPath(episode));
  for (const clip of Object.values(m.voice)) {
    const src = path.join(vdir, clip.file);
    if (existsSync(src)) await cp(src, path.join(dest, "voice", clip.file));
  }
  for (const id of m.sfx) await cp(sfxFile(id), path.join(dest, "sfx", `${id}.mp3`));
  const recDir = recitationsDirFor(await resolveScriptPath(episode));
  for (const r of Object.values(m.recitations)) {
    if (r.source === "quran-foundation" || r.source === "alquran-cloud") for (const p of r.parts ?? []) await cp(path.join(recDir, p.file), path.join(dest, "recitations", p.file));
    else await cp(path.join(recitationsDir, r.file), path.join(dest, "recitations", r.file));
  }
  const sp2 = await resolveScriptPath(episode);
  for (const f of m.images ?? []) await cp(f.startsWith(LIB) ? path.join(libraryDirFor(sp2), f.slice(LIB.length)) : path.join(imagesDirFor(sp2), f), path.join(dest, "images", imageKey(f)));
  return { ...m, mode: "static", base: rel };
};

/**
 * Stage ONLY the illustrated storyboard's referenced image assets.
 * This deliberately never calls prepareRenderMedia(): it must not remove or
 * replace the currently served _render/<episode> files or copy paid/protected
 * voice recordings into a storyboard meant to be prepared BEFORE narration.
 * Content-hashed namespaces keep different source-asset revisions separate.
 */
export const prepareStoryboardMedia = async (
  episode: string, plan: Plan, opts: { scriptPath?: string; publicRoot?: string } = {},
): Promise<EpisodeMedia> => {
  const scriptPath = opts.scriptPath ?? await resolveScriptPath(episode);
  const images = usedImages(plan, imagesDirFor(scriptPath), libraryDirFor(scriptPath));
  const digest = createHash("sha256").update(JSON.stringify({
    version: 1, episode, theme: plan.themeId, chapters: plan.chapters, overlays: plan.overlays,
  }));
  const assets = images.map((f) => ({
    name: imageKey(f),
    file: f.startsWith(LIB) ? path.join(libraryDirFor(scriptPath), f.slice(LIB.length)) : path.join(imagesDirFor(scriptPath), f),
  }));
  for (const asset of assets) {
    if (!asset.name || asset.name === "." || asset.name === ".." || asset.name.length > 240 ||
      path.basename(asset.name) !== asset.name || asset.name.includes("\\") || asset.name.includes("\0"))
      throw new Error("اسم صورة غير آمن للـStoryboard.");
    digest.update(asset.name);
    for await (const part of createReadStream(asset.file)) digest.update(part);
  }
  const { channelName, episodeName } = studioMediaNamespace(scriptPath);
  const rel = `_storyboard_media/${channelName}/${episodeName}-${digest.digest("hex").slice(0, 16)}/`;
  const dest = path.join(opts.publicRoot ?? path.join(projectRoot, "public"), rel);
  await mkdir(path.join(dest, "images"), { recursive: true });
  for (const asset of assets) {
    const output = path.join(dest, "images", asset.name);
    if (!existsSync(output)) await cp(asset.file, output, { force: false, errorOnExist: true });
  }
  return { mode: "static", base: rel, voice: {}, sfx: [], recitations: {}, images };
};
