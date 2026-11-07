import path from "node:path";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { existsSync, readdirSync } from "node:fs";
import { mkdir, cp } from "node:fs/promises";
import { stageRenderFiles, type RenderStageFile } from "./renderStage";
import { projectRoot } from "../config/paths";
import { resolveScriptPath } from "../script/episodes";
import { loadVoiceIndex, voiceDirFor } from "../voice/generate";
import { availableSfx, sfxFile } from "../voice/sfx";
import { type EpisodeMedia, type Recitation } from "./media";
import type { Plan } from "./types";
import { recitationsDirFor } from "../quran/sync";
import { verifiedOwnRecitations } from "../quran/manualAudio";

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
export const collectMedia = async (
  episode: string, plan: Plan, opts: { requireApprovedQuran?: boolean } = {},
): Promise<Omit<EpisodeMedia, "mode" | "base">> => {
  const voice = await loadVoiceIndex(episode);
  const used = new Set(plan.chapters.flatMap((c) => c.scenes.flatMap((s) => s.sfx.map((x) => x.id))));
  const sfx = availableSfx().filter((id) => used.has(id));
  const recitations: Record<string, Recitation> = {};
  const scriptPath = await resolveScriptPath(episode);
  // Reviewing/editing a pending episode is allowed even when no recording
  // exists; no fallback audio from a provider or a shared library is allowed.
  const approvedManual = await verifiedOwnRecitations(scriptPath);
  for (const scene of plan.chapters.flatMap((chapter) => chapter.scenes)) {
    if (scene.template !== "verse-card") continue;
    const recording = scene.ayahKey ? approvedManual[scene.ayahKey] : undefined;
    if (!recording) {
      if (opts.requireApprovedQuran)
        throw new Error(`تلاوة المشهد ${scene.id} مفقودة أو غير معتمدة: أرفق الملف واستمع إليه وراجع حقوقه.`);
      continue;
    }
    const part = recording.parts[0]!;
    recitations[scene.ayahKey!] = {
      file: part.file, duration: part.duration, parts: [{
        file: part.file, duration: part.duration, sha256: recording.sha256,
      }],
      reciter: recording.reciter, source: "manual",
    };
  }
  const sp = await resolveScriptPath(episode);
  const images = usedImages(plan, imagesDirFor(sp), libraryDirFor(sp));
  return { voice, sfx, recitations, images };
};

/** ينسخ وسائط الحلقة إلى لقطة ثابتة ببصمة محتوى ونطاق خاص بالقناة والحلقة؛ لا تُحذف النتائج السابقة. */
export const prepareRenderMedia = async (
  episode: string,
  plan: Plan,
  opts: { publicRoot?: string; signal?: AbortSignal; requireApprovedQuran?: boolean } = {},
): Promise<EpisodeMedia> => {
  const m = await collectMedia(episode, plan, { requireApprovedQuran: opts.requireApprovedQuran });
  const scriptPath = await resolveScriptPath(episode);
  const files: RenderStageFile[] = [];
  const vdir = voiceDirFor(scriptPath);
  for (const clip of Object.values(m.voice)) {
    // Preserve existing behavior: an absent voice clip is not invented.
    // The filename itself is validated before any copy by stageRenderFiles.
    if (path.basename(clip.file) !== clip.file || clip.file.includes("\\") || clip.file.startsWith("."))
      throw new Error("اسم ملف تعليق صوتي غير آمن.");
    const source = path.join(vdir, clip.file);
    if (existsSync(source)) files.push({ kind: "voice", name: clip.file, source });
  }
  for (const id of m.sfx) files.push({ kind: "sfx", name: `${id}.mp3`, source: sfxFile(id) });
  const recDir = recitationsDirFor(scriptPath);
  for (const r of Object.values(m.recitations)) {
    if (r.source !== "manual" || !r.parts?.length)
      throw new Error("رندر الآيات يقبل التسجيلات البشرية المرفوعة للحلقة والمراجعة فقط.");
    for (const part of r.parts)
      files.push({ kind: "recitations", name: part.file, source: path.join(recDir, part.file) });
  }
  for (const f of m.images ?? []) files.push({
    kind: "images",
    name: imageKey(f),
    source: f.startsWith(LIB) ? path.join(libraryDirFor(scriptPath), f.slice(LIB.length)) : path.join(imagesDirFor(scriptPath), f),
  });
  const rel = await stageRenderFiles(studioMediaNamespace(scriptPath).render, files, {
    publicRoot: opts.publicRoot ?? path.join(projectRoot, "public"),
    signal: opts.signal,
  });
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
