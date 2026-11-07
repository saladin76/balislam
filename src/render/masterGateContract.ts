import path from "node:path";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Plan } from "../plan/types";
import type { EpisodeMedia } from "../plan/media";
import type { Orientation } from "../remotion/scenes/types";

/**
 * Contract for the separate persistent workflow-gates branch.
 * This module NEVER creates or infers approval from render completion,
 * successful tests, existing files, or a local status flag.
 */
export type MasterRenderSubject = {
  channelId: string;
  episodeFolder: string;
  orientation: Orientation;
  chapter: number | null;
  quality: "master";
  scriptSha256: string;
  planSha256: string;
  /** Content-addressed immutable episode snapshot (voice/verses/images/SFX). */
  mediaBase: string;
  /** Hash of all of the above and the selected output format. */
  inputSha256: string;
};

export const masterRenderSubject = async (
  scriptPath: string,
  channelId: string,
  plan: Plan,
  media: EpisodeMedia,
  orientation: Orientation,
  chapter?: number,
): Promise<MasterRenderSubject> => {
  if (media.mode !== "static" ||
      !/^_render\/[a-z0-9]+(?:-[a-z0-9]+)*\/[0-9]{3}-[a-z0-9]+(?:-[a-z0-9]+)*\/[a-f0-9]{24}\/$/.test(media.base))
    throw new Error("لا يمكن تقييم اعتماد Master دون نسخة وسائط ثابتة تخص الحلقة.");
  const episodeFolder = path.basename(path.dirname(scriptPath));
  const scriptSha256 = createHash("sha256").update(await readFile(scriptPath)).digest("hex");
  const planSha256 = createHash("sha256").update(JSON.stringify(plan)).digest("hex");
  const base = { channelId, episodeFolder, orientation, chapter: chapter ?? null, quality: "master" as const, scriptSha256, planSha256, mediaBase: media.base };
  return { ...base, inputSha256: createHash("sha256").update(JSON.stringify(base)).digest("hex") };
};

/** Integration seam: replace only this fail-closed assertion in workflow PR.
 * Required evidence: signed off AV review AND human owner Master authorization
 * for this exact inputSha256, channel/episode/orientation, with approver identity,
 * timestamp, content version and durable evidence. No caller override allowed. */
export const assertMasterStageAuthorized = async (_subject: MasterRenderSubject): Promise<void> => {
  throw new Error("رندر Master محظور: لم يُربط بعد تحقق محرك المراحل من مراجعة AV واعتماد المالك لهذه البصمة. لا يُنشأ أي اعتماد تلقائي.");
};
