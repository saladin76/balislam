/**
 * One pre-enqueue safety gate for FINAL motion only (not silent storyboard QA).
 * Script, storyboard, scene audio and full narration are separate human decisions.
 * The rendering team must also call this gate from every direct render entrypoint.
 */
import { readFile } from "node:fs/promises";
import { parseScript } from "../script/parse";
import { assertScriptApproved } from "../script/approval";
import { quranFromScript } from "../quran/scriptText";
import { ownAudioStatusForScript } from "../quran/manualAudio";
import { loadLedger, reviewItems, reviewSummary } from "../script/review";
import { loadStoryboard, storyboardBlockMessage, storyboardStatus, unapprovedScenes } from "../plan/storyboard";
import type { Plan } from "../plan/types";
import type { VoiceIndex } from "./generate";
import { assertVoiceApproved } from "./review";

export const assertMotionStartAuthorized = async (
  scriptPath: string, plan: Plan, voice: VoiceIndex,
): Promise<true> => {
  await assertScriptApproved(scriptPath);
  const parsed = parseScript(await readFile(scriptPath, "utf8"), scriptPath);
  const authored = quranFromScript(parsed);
  if (authored.problems.length)
    throw new Error("نصوص آيات السكريبت ناقصة أو متعارضة؛ لا تبدأ الحركة قبل المراجعة الشرعية.");
  // The render collector in the separate render workstream has not integrated
  // provider=manual. A reviewed manual recitation is NOT render eligibility.
  // Block final motion instead of silently omitting the verse recitation.
  if (Object.keys(authored.texts).length) {
    const manual = await ownAudioStatusForScript(scriptPath);
    const current = new Set(Object.keys(authored.texts));
    if ([...Object.keys(manual.reviewed), ...manual.stale].some((key) => current.has(key)))
      throw new Error("تسجيل القرآن اليدوي غير موصول بجامع الرندر أو تغيّر؛ لا تبدأ الحركة النهائية قبل تكامل التلاوة المعتمدة.");
  }
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
