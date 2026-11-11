import type { ChannelInfo } from "../../channel/types";
import { divisionEyebrow } from "../../script/divisions";

/**
 * السطر الصغير أعلى المشهد من القسم الإنتاجي. افتراضيًا لا شيء: عنوان القسم بيانات إنتاج لا تظهر على الشاشة
 * (src/script/divisions.ts). القناة التي تطلبها صراحة (script.divisionTitlesOnScreen = true): «الفصل ٣ · العنوان»،
 * أو العنوان وحده حين لا تُظهر رقمًا لا يُنطق (script.chapterNumbers = false). القسم بلا عنوان لا شارة له أبدًا.
 */
export const chapterEyebrow = (channel: Pick<ChannelInfo, "script"> | undefined, chapterWord: string, chapter: { number: number; title: string; implicit?: boolean }) =>
  divisionEyebrow(channel, chapterWord, chapter);
