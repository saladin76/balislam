/**
 * What the owner reads after asking for a scene's voice (QA balislam 3, 12 Nov): a success line only for a real
 * result. Without a voice key the server makes a dry run (nothing generated, nothing paid) and says so; the studio
 * then says it plainly in Arabic instead of «وُلّد الصوت.».
 */
import { num } from "../ui/format";

export const NO_VOICE_KEY = "لم يُولَّد صوت: لا يوجد مفتاح صوت على هذا الجهاز. أضفه من «الاتصالات والمفاتيح» ثم اضغط «أعد توليد الصوت».";
export const NO_VOICE_KEY_AFTER_NOTE = "سُجّلت ملاحظتك والنبرة. لم يُولَّد صوت: لا يوجد مفتاح صوت على هذا الجهاز؛ أضفه من «الاتصالات والمفاتيح» ثم اضغط «أعد توليد الصوت».";

export type VoiceCallResult = {
  generated: boolean;
  noKey?: boolean;
  report?: { total?: number; toGenerate?: unknown[] } | null;
  sentences?: { generated: number; composed: { composed: boolean; reason?: string } | null };
};

export const voiceResultMessage = (r: VoiceCallResult): { ok: boolean; text: string } => {
  if (r.sentences) {
    const n = r.sentences.generated;
    if (!n) return { ok: false, text: r.sentences.composed?.reason ? `لم تُولَّد جملة جديدة. ${r.sentences.composed.reason}` : "لم تُولَّد جملة جديدة: كل جمل المشهد حالية." };
    return { ok: true, text: r.sentences.composed?.composed
      ? `أُعيد توليد جمل المشهد (${num(n)}) ورُكّب صوته منها؛ يُعرض لمراجعة جديدة.`
      : `أُعيد توليد جمل المشهد (${num(n)}).${r.sentences.composed?.reason ? ` ${r.sentences.composed.reason}` : ""}` };
  }
  if (!r.generated || r.noKey) return { ok: false, text: NO_VOICE_KEY };
  if (r.report && Array.isArray(r.report.toGenerate) && r.report.toGenerate.length === 0)
    return { ok: false, text: "لم يُولَّد صوت جديد: لا شيء في هذا المشهد يحتاج توليدًا الآن." };
  return { ok: true, text: "وُلّد الصوت." };
};
