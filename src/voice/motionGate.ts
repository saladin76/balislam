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
