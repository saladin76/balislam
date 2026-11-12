import type { ChannelConfig } from "../channel/types";

/**
 * الآية استشهاد مكتوب بلا تلاوة في هذه القناة (D68): بطاقة الآية تُعرض بنصها ومرجعها صامتة،
 * ولا تنتظر تسجيلًا بشريًا. لا يمس حارس الصوت: الصوت المستنسخ لا يتلو القرآن في أي قناة.
 * القرار من حقل القناة `verse.recitation` لا من معرّفها، فتأخذه أي قناة تختاره.
 */
export const versesAreCitations = (channel: Pick<ChannelConfig, "verse"> | null | undefined): boolean =>
  channel?.verse?.recitation === "none";

/**
 * هل تحتاج الحلقة مرحلة «التلاوات» في الاستوديو؟ في قناة التلاوة: نعم إن كان فيها مشهد آية.
 * في قناة الاستشهاد (D68): لا، إلا للبسملة إن وردت في التعليق (تسجيل المالك، قرار ١٠ نوفمبر).
 * نقي بلا ملفات، يُستعمل في الواجهة والخادم معًا.
 */
export const recitationStageNeeded = (
  channel: Pick<ChannelConfig, "verse"> | null | undefined,
  scenes: { template: string; ayahKey?: string }[],
  hasBasmalaScene: boolean,
): boolean => hasBasmalaScene || (!versesAreCitations(channel) && scenes.some((s) => s.template === "verse-card" && Boolean(s.ayahKey)));

/** وصف الآية بلا تعليق في اللوحة: حيث كان يُكتب «تُتلى بصوت القارئ». */
export const verseRoleAr = (channel: Pick<ChannelConfig, "verse"> | null | undefined): string =>
  versesAreCitations(channel)
    ? "آية مكتوبة صامتة: استشهاد بنصها ومرجعها، بلا تلاوة."
    : "آية بلا تعليق: تلاوتها تسجيل بشري ترفعه بنفسك.";
