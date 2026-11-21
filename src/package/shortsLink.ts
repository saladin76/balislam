/**
 * الشورتس (خطة «احترافية بلا مثيل»، المرحلة ٢ البند ٣): كل شورت بعنوان سؤال، ورابط للحلقة الكاملة في وصفه.
 *
 * الرابط لا يُعرف قبل نشر الحلقة: يكتبه المالك مرة واحدة في الحزمة (`long.episodeUrl`) بعد رفع الحلقة، فيدخل وصف كل
 * شورت (يوتيوب وفيسبوك) مكان «{{رابط_الحلقة}}»، أو سطرًا بعد الخطاف في حزمة قديمة بلا الرمز. قبله يبقى السطر
 * «الحلقة كاملة على القناة.» كما كان، وينبّه الفحص. إنستجرام لا يفتح رابطًا في الكابشن، فلا يُضاف إليه.
 */
import { normalizeArabic } from "../script/quranMeta";

export const EPISODE_LINK_TOKEN = "{{رابط_الحلقة}}";
const NO_LINK_LINE = "الحلقة كاملة على القناة.";

/** رابط فيديو يوتيوب حقيقي (watch أو youtu.be أو shorts)، بمعرّف ١١ محرفًا. */
export const isEpisodeUrl = (u: string | undefined): u is string =>
  Boolean(u && /^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/watch\?(?:\S*&)?v=|youtu\.be\/|youtube\.com\/shorts\/)[\w-]{11}(?:[?&#]\S*)?$/.test(u.trim()));

/** الوصف كما يُنشر: الرمز يصير «الحلقة كاملة: <الرابط>»، والحزمة القديمة بلا الرمز يُستبدل سطرها العام بالسطر ذي الرابط. */
export const resolveEpisodeLink = (text: string, url: string | undefined): string => {
  const link = isEpisodeUrl(url) ? `الحلقة كاملة: ${url.trim()}` : NO_LINK_LINE;
  if (text.includes(EPISODE_LINK_TOKEN)) return text.split(EPISODE_LINK_TOKEN).join(link);
  if (!isEpisodeUrl(url) || text.includes(url.trim())) return text;
  if (text.includes(NO_LINK_LINE)) return text.replace(NO_LINK_LINE, link);
  // لا سطر عام ولا رمز: بعد الفقرة الأولى (الخطاف يبقى أول ما يُقرأ)
  return text.replace(/^([\s\S]*?)(\n\n|$)/, (_, first: string, sep: string) => `${first}\n\n${link}${sep}`);
};

/** عنوان شورت سؤال: ينتهي بـ«؟» (أو بعلامة سؤال قبل فاصل «| اسم القناة»). */
export const isQuestionTitle = (t: string) => /[؟?]\s*(?:\|[^|]*)?$/.test(t.trim());

/** دعاء أو ذكر لا يُحوَّل إلى سؤال (توقير): يُقترح للمالك عنوان آخر لا تعديل الدعاء. */
export const isDuaTitle = (t: string) => /^(?:اللهم|ربنا|رب\s|يا\s*رب|سبحان|الحمد\s*لله|لا\s*اله)/.test(normalizeArabic(t.trim()));

/** سؤال من نص الشورت نفسه يصلح عنوانًا (≤ ٦٠ حرفًا)، الأقصر أولًا؛ أو undefined. */
export const questionFrom = (text: string, max = 60): string | undefined =>
  text.split(/(?<=[؟?])\s+|(?<=[.!…])\s+|\n+/).map((s) => s.trim())
    .filter((s) => /[؟?]$/.test(s) && Array.from(s).length <= max && s.split(/\s+/).length >= 3)
    .map((s) => s.replace(/^(?:ولكن|لكن|ثم|فـ?)\s+/, ""))
    .sort((a, b) => Array.from(a).length - Array.from(b).length)[0];
