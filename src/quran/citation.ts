import type { ChannelConfig } from "../channel/types";

/**
 * الآية استشهاد مكتوب بلا تلاوة في هذه القناة (D68): بطاقة الآية تُعرض بنصها ومرجعها صامتة،
 * ولا تنتظر تسجيلًا بشريًا. لا يمس حارس الصوت: الصوت المستنسخ لا يتلو القرآن في أي قناة.
 */
export const versesAreCitations = (channel: Pick<ChannelConfig, "verse"> | null | undefined): boolean =>
  channel?.verse?.recitation === "none";
