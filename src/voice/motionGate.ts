/**
 * One pre-enqueue safety gate for FINAL motion only (not silent storyboard QA).
 * Script, storyboard, scene audio and full narration are separate human decisions.
 * The rendering team must also call this gate from every direct render entrypoint.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseScript } from "../script/parse";
import { assertScriptApproved } from "../script/approval";
import { quranFromScript } from "../quran/scriptText";
import { approvedRecitationsForRender } from "../quran/renderContract";
import { assertNoQuranInTts } from "../quran/ttsGuard";
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
  // A saved/forged plan may carry stale verse text even while the script itself
  // has an otherwise valid signoff. Never export that mismatched plan.
  const verseCards = plan.chapters.flatMap((c) => c.scenes).filter((s) => s.template === "verse-card");
  const displayed = new Set<string>();
  for (const card of verseCards) {
    const key = card.ayahKey ?? "";
    if (!key || !Object.prototype.hasOwnProperty.call(authored.texts, key) ||
        card.props?.text !== authored.texts[key])
      throw new Error("بطاقة آية في خطة الرندر لا تطابق النص والمرجع الحاليين في السكريبت؛ أعد توليد الخطة ومراجعتها.");
    displayed.add(key);
  }
  if (Object.keys(authored.texts).some((key) => !displayed.has(key)))
    throw new Error("توجد آية في السكريبت دون بطاقة معروضة في خطة الرندر؛ لا يُسمح بإسقاطها من نسخة الإنتاج.");
  // A cached or imported voice track must not contain the authored Quran as
  // narration; this check applies even when no TTS job is started today.
  assertNoQuranInTts(parsed, plan.chapters.flatMap((chapter) =>
    chapter.scenes.filter((scene) => scene.narration.trim()).map((scene) => scene.narration)));
  if (Object.keys(authored.texts).length) {
    const recordings = await approvedRecitationsForRender(scriptPath, undefined);
    for (const key of Object.keys(authored.texts)) {
      if (recordings[key]?.source !== "manual")
        throw new Error("لا تبدأ الحركة: يجب إرفاق واعتماد التلاوة البشرية الخاصة بكل آية.");
    }
    // This standalone branch is not yet connected to every direct/queued
    // renderer and final-Master commit boundary. Keep final motion fail-closed
    // until PR #78 verifies immutable staged bytes and workflow locks.
    throw new Error("المشاهد القرآنية تنتظر ربط بوابات الرندر والإنتاج النهائي بالتلاوة المرفوعة المعتمدة.");
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
