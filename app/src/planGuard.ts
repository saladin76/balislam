import { designedScenes } from "../../src/plan/designed";
import type { Plan } from "../../src/plan/types";

/** رد الخادم على حفظ السكريبت (PUT /script). */
export type ScriptSaveReply = {
  planUnchanged?: boolean;
  designedScenes?: number;
  divergence?: { scenes: { id: string }[]; unplaced: { line: number }[] };
};

export const DESIGNED_PLAN_KEPT = "حُفظ السكريبت. الخطة لم تتغير لأن مشاهدها مصمَّمة؛ أي تغيير في نص مشهد يُطبَّق عليه من محرر المشهد.";

/**
 * رسالة واحدة قصيرة بعد حفظ السكريبت. على خطة مصمَّمة تُذكر المشاهد التي اختلف نصها عن السكريبت
 * (وأسطر السكريبت التي لا مشهد لها) حتى لا يفترق النص عن الخطة بصمت.
 */
export const scriptSaveMessage = (r: ScriptSaveReply): { msg: string; warn: boolean } => {
  if (!r.planUnchanged) return { msg: "حُفظ السكريبت وتحدّثت المشاهد مع إبقاء تعديلاتك", warn: false };
  const ids = r.divergence?.scenes.map((s) => s.id) ?? [];
  const lines = r.divergence?.unplaced.map((u) => u.line) ?? [];
  const parts = [DESIGNED_PLAN_KEPT];
  if (ids.length) parts.push(`مشاهد نصها في السكريبت يختلف عن الخطة: ${ids.slice(0, 8).join("، ")}${ids.length > 8 ? ` و${ids.length - 8} غيرها` : ""}.`);
  if (lines.length) parts.push(`نص في السكريبت بلا مشهد (السطر ${lines.slice(0, 6).join("، ")}${lines.length > 6 ? "…" : ""}).`);
  return { msg: parts.join(" "), warn: ids.length + lines.length > 0 };
};

/**
 * تأكيد إعادة توليد الخطة. على خطة عادية لا يُسأل المالك. على خطة مصمَّمة يجب أن يكتب رقم الحلقة
 * بعد أن يُقال له كم مشهدًا مصمَّمًا سيُمحى؛ وإلا تُلغى العملية (null). الخادم يتحقق من الرقم نفسه مرة أخرى.
 */
export const confirmRegenerate = (episode: string, plan: Plan | null, ask: (message: string) => string | null):
  { overwriteDesigned?: true; confirmEpisode?: string } | null => {
  const n = designedScenes(plan).length;
  if (!n) return {};
  const typed = ask(`ستُمحى ${n} مشهدًا مصمَّمًا في الحلقة ${episode} وتُستبدل بمشاهد عامة من القالب. تُحفظ نسخة احتياطية من الخطة أولًا.\nللمتابعة اكتب رقم الحلقة (${episode}):`);
  return typed?.trim() === episode ? { overwriteDesigned: true, confirmEpisode: episode } : null;
};
