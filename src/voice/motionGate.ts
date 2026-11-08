/**
 * Pre-render safety gate for FINAL motion (not silent storyboard QA).
 * Unified engine (2026-11-08): human approvals come ONLY from the scene-first ledger
 * (src/studio/sceneService.ts): script and storyboard here, each scene's AV approval later.
 * The legacy script-signoff, citation ledger and episode voice approval are not authorities.
 * What stays here is technical: the Quran text in the script is complete, and every verse has
 * the owner's uploaded human recording.
 */
import { readFile } from "node:fs/promises";
import { parseScript } from "../script/parse";
import { quranFromScript } from "../quran/scriptText";
import { approvedRecitationsForRender } from "../quran/renderContract";
import type { Plan } from "../plan/types";
import type { VoiceIndex } from "./generate";

export const assertMotionStartAuthorized = async (
  episode: string, scriptPath: string, _plan?: Plan, _voice?: VoiceIndex,
): Promise<true> => {
  const { requireScriptAndStoryboardApproved } = await import("../studio/sceneService");
  await requireScriptAndStoryboardApproved(episode);
  const parsed = parseScript(await readFile(scriptPath, "utf8"), scriptPath);
  const authored = quranFromScript(parsed);
  if (authored.problems.length)
    throw new Error("نصوص آيات السكريبت ناقصة أو متعارضة؛ لا تبدأ الحركة قبل مراجعتها.");
  if (Object.keys(authored.texts).length) {
    const approved = await approvedRecitationsForRender(scriptPath, undefined);
    for (const key of Object.keys(authored.texts))
      if (approved[key]?.source !== "manual")
        throw Error("تعذّر بدء الحركة: التلاوة البشرية المرفوعة غير معتمدة للآية " + key);
  }
  return true;
};
