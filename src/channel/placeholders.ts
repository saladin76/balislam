/**
 * أمثلة الحقول الفارغة في نوافذ «حلقة جديدة» و«سلسلة جديدة» لكل قناة بمحتواها هي، فلا يرى صاحب قناة
 * مثالًا من قناة أخرى («لماذا نؤجّل…» أو «ليالي رمضان» في دفاتر الزمن). قناة بلا أمثلة تأخذ أمثلة محايدة.
 */
export type ChannelPlaceholders = { episodeTitle: string; episodeSlug: string; seriesName: string; categoryName: string; seriesSlug: string };

const NEUTRAL: ChannelPlaceholders = { episodeTitle: "ما السؤال الذي تجيب عنه الحلقة؟", episodeSlug: "episode-topic", seriesName: "اسم السلسلة", categoryName: "اسم التصنيف", seriesSlug: "series-name" };

export const CHANNEL_PLACEHOLDERS: Record<string, ChannelPlaceholders> = {
  balislam: { episodeTitle: "لماذا نؤجّل ما نعرف أنه مهم؟", episodeSlug: "procrastination", seriesName: "ليالي رمضان", categoryName: "الأسرة", seriesSlug: "ramadan-nights" },
  "dafatir-alzaman": { episodeTitle: "كيف صارت بغداد مقصد العلماء؟", episodeSlug: "baghdad-scholars", seriesName: "مدن العلم", categoryName: "الأندلس", seriesSlug: "cities-of-knowledge" },
  "zubdat-alkutub": { episodeTitle: "لماذا نقرأ كثيرًا ولا يبقى إلا القليل؟", episodeSlug: "reading-that-stays", seriesName: "كتب العادات", categoryName: "تطوير الذات", seriesSlug: "habit-books" },
};

export const channelPlaceholders = (channelId: string | undefined): ChannelPlaceholders =>
  (channelId && CHANNEL_PLACEHOLDERS[channelId]) || NEUTRAL;
