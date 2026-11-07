/**
 * One pre-enqueue safety gate for FINAL motion only (not silent storyboard QA).
 * Script, storyboard, scene audio and full narration are separate human decisions.
 * The rendering team must also call this gate from every direct render entrypoint.
 */
import { readFile } from "node:fs/promises";
import { parseScript } from "../script/parse";
import { quranFromScript } from "../quran/scriptText";
import { loadLedger, reviewItems, reviewSummary } from "../script/review";
import { loadStoryboard, storyboardBlockMessage, storyboardStatus, unapprovedScenes } from "../plan/storyboard";
import type { Plan } from "../plan/types";
import type { VoiceIndex } from "./generate";
import { assertVoiceApproved } from "./review";

export const assertMotionStartAuthorized = async (
  scriptPath: string, plan: Plan, voice: VoiceIndex,
): Promise<true> => {
  const parsed = parseScript(await readFile(scriptPath, "utf8"), scriptPath);
  const authored = quranFromScript(parsed);
  if (authored.problems.length)
    throw new Error("نصوص آيات السكريبت ناقصة أو متعارضة؛ لا تبدأ الحركة قبل المراجعة الشرعية.");
  const reviewed = reviewSummary(reviewItems(parsed, await loadLedger(scriptPath)));
  if (!reviewed.ok)
    throw new Error("السكريبت والاستشهادات غير معتمدين؛ لا تبدأ الحركة النهائية.");
  const board = storyboardStatus(plan, await loadStoryboard(scriptPath));
  const sceneIds = plan.chapters.flatMap((c) => c.scenes.map((scene) => scene.id));
  const blocked = unapprovedScenes(board, sceneIds);
  if (blocked.length) throw new Error(storyboardBlockMessage(blocked, board));
  // assertVoiceApproved recomputes MP3 bytes and decode metadata, scene signoffs
  // AND the episode-wide fingerprint. A partial recording cannot authorize motion.
  await assertVoiceApproved(scriptPath, plan, voice);
  return true;
};
