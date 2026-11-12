import path from "node:path";
import { loadChannel } from "../channel";
import { versesAreCitations } from "./citation";

/**
 * D68 من مسار السكريبت (`channels/<القناة>/episodes/<الحلقة>/script.md`): هل آيات قناة هذه الحلقة استشهاد مكتوب؟
 * يقرأ حقل القناة `verse.recitation` لا معرّفها. عند تعذّر قراءة القناة: قناة تلاوة (الأحوط: البوابات كما هي).
 */
export const scriptVersesAreCitations = (scriptPath: string): boolean => {
  try { return versesAreCitations(loadChannel(path.basename(path.dirname(path.dirname(path.dirname(scriptPath)))))); } catch { return false; }
};
