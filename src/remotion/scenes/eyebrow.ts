import type { ChannelInfo } from "../../channel/types";

/**
 * السطر الصغير أعلى المشهد: «الفصل ٣ · العنوان»، أو العنوان وحده في القناة التي لا تُظهر رقمًا لا يُنطق
 * (channel.json → script.chapterNumbers = false).
 */
export const chapterEyebrow = (channel: Pick<ChannelInfo, "script"> | undefined, chapterWord: string, chapter: { number: number; title: string }) =>
  channel?.script?.chapterNumbers === false ? chapter.title : `${chapterWord} ${chapter.number} · ${chapter.title}`;
