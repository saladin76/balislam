import { createHash } from "node:crypto";
import type { Plan } from "../plan/types";
import type { EpisodeMedia } from "../plan/media";

/** بصمة مدخلات المعاينة؛ إدخال إصدار الفاحص يجعل النتائج القديمة ظاهرة كقديمة بدل اعتبارها معتمدة. */
const AUDIT_VERSION = 3;
export const motionFingerprint = (
  plan: Plan,
  media: Pick<EpisodeMedia, "voice" | "recitations" | "images" | "sfx">,
  identity: unknown,
  channel: unknown,
  orientation: "landscape" | "portrait" = "landscape",
  assetState: readonly { file: string; size: number; mtime: number }[] = [],
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
  return motionFingerprint(plan, media, loadChannelIdentity(), channelInfo(loadChannel()), orientation, assets);
};
