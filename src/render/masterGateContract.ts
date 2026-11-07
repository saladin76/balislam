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
  if (!media.base.startsWith(`_render/${channelId}/${episodeFolder}/`))
    throw new Error("بصمة وسائط Master لا تخص القناة والحلقة المختارتين.");
  const scriptSha256 = createHash("sha256").update(await readFile(scriptPath)).digest("hex");
  const planSha256 = createHash("sha256").update(JSON.stringify(plan)).digest("hex");
  const base = { channelId, episodeFolder, orientation, chapter: chapter ?? null, quality: "master" as const, scriptSha256, planSha256, mediaBase: media.base };
  return { ...base, inputSha256: createHash("sha256").update(JSON.stringify(base)).digest("hex") };
};

/** Integration seam: replace only this fail-closed assertion in workflow PR.
 * Candidate render requires approved script, storyboard, full voice, motion,
 * and 1x audiovisual review for the exact source snapshot. The human owner
 * approves the resulting Master FILE only after this render; publication must
 * then require the separate publish gate over the exact final video bytes.
 * No caller override and no automatic Master approval. */
export const assertMasterStageAuthorized = async (_subject: MasterRenderSubject): Promise<void> => {
  throw new Error("رندر Master المرشّح محظور: لم يُربط بعد تحقق محرك المراحل من الاعتمادات حتى مراجعة AV لهذه البصمة. اعتماد ملف Master والنشر إجراءان منفصلان لاحقان.");
};
