import { createHash } from "node:crypto";
import type { Plan } from "../plan/types";
import type { EpisodeMedia } from "../plan/media";

/** بصمة مدخلات المعاينة؛ إدخال إصدار الفاحص يجعل النتائج القديمة ظاهرة كقديمة بدل اعتبارها معتمدة. */
const AUDIT_VERSION = 4;
export const motionFingerprint = (
  plan: Plan,
  media: Pick<EpisodeMedia, "voice" | "recitations" | "images" | "sfx">,
  identity: unknown,
  channel: unknown,
  orientation: "landscape" | "portrait" = "landscape",
  assetState: readonly { file: string; size: number; mtime: number }[] = [],
  rendererHash = "",
): string => {
  const { updatedAt: _ignored, ...renderPlan } = plan;
  const voice = Object.fromEntries(Object.entries(media.voice).sort(([a], [b]) => a.localeCompare(b)).map(([id, clip]) =>
    [id, { hash: clip.hash, text: clip.text, duration: clip.duration, words: clip.words }]));
  return createHash("sha256").update(JSON.stringify({
    version: AUDIT_VERSION,
    plan: renderPlan,
    voice,
    recitations: media.recitations,
    images: media.images ?? [],
    sfx: media.sfx,
    assetState,
    rendererHash,
    identity,
    channel,
    orientation,
  })).digest("hex").slice(0, 24);
};

/** الحساب الحالي لا ينسخ وسائط ولا يرندر؛ صالح لاستدعاء واجهة الحالة. */
export const currentMotionFingerprint = async (
  episode: string,
  plan: Plan,
  orientation: "landscape" | "portrait" = "landscape",
): Promise<string> => {
  const { collectMedia } = await import("../plan/collect");
  const { loadChannel, loadChannelIdentity, channelInfo } = await import("../channel");
  const media = await collectMedia(episode, plan);
  const path = await import("node:path");
  const { stat } = await import("node:fs/promises");
  const { resolveScriptPath } = await import("../script/episodes");
  const { sfxFile } = await import("../voice/sfx");
  const { imagesDirFor, libraryDirFor, recitationsDir, LIB } = await import("../plan/collect");
  const { recitationsDirFor } = await import("../quran/sync");
  const script = await resolveScriptPath(episode);
  const sources: string[] = [
    ...Object.values(media.voice).map((v) => path.join(path.dirname(script), "voice", v.file)),
    ...media.sfx.map((id) => sfxFile(id)),
    ...(media.images ?? []).map((f) => f.startsWith(LIB) ? path.join(libraryDirFor(script), f.slice(LIB.length)) : path.join(imagesDirFor(script), f)),
    ...Object.values(media.recitations).flatMap((rec) =>
      rec.source === "quran-foundation" ? (rec.parts ?? []).map((p) => path.join(recitationsDirFor(script), p.file))
        : [path.join(recitationsDir, rec.file)]),
  ];
  const assets = await Promise.all([...new Set(sources)].sort().map(async (file) => {
    const data = await stat(file).catch(() => null);
    return { file, size: data?.size ?? -1, mtime: data ? Math.round(data.mtimeMs) : -1 };
  }));
  // Invalidate earlier reports whenever the rendering engine changes, even if a plan
  // and its media are unchanged. Preview and audit render the same episode composition.
  const fs = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join, relative } = path;
  const remotionRoot = fileURLToPath(new URL("../remotion/", import.meta.url));
  const projectRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
  const trackedRoots = [remotionRoot];
  const rendererFiles: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const name = join(dir, entry.name);
      if (entry.isDirectory()) await walk(name);
      else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) rendererFiles.push(name);
    }
  };
  for (const dir of trackedRoots) await walk(dir);
  // Timing, direction, fonts, config and drawing libraries also affect the pixels.
  rendererFiles.push(join(projectRoot, "src/plan/duration.ts"), join(projectRoot, "src/plan/sceneCues.ts"),
    join(projectRoot, "src/plan/director.ts"), join(projectRoot, "config.json"));
  const rendererDigest = createHash("sha256");
  for (const file of [...new Set(rendererFiles)].sort()) {
    rendererDigest.update(relative(projectRoot, file));
    try { rendererDigest.update(await fs.readFile(file)); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      rendererDigest.update("[missing]");
    }
  }
  return motionFingerprint(plan, media, loadChannelIdentity(), channelInfo(loadChannel()), orientation, assets, rendererDigest.digest("hex"));
};
