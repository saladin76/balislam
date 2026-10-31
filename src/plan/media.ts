import type { VoiceClip } from "../voice/generate";

/**
 * وسائط الحلقة التي يحتاجها التكوين: مقاطع الصوت، والمؤثرات المتاحة، والتلاوات المرخصة.
 * mode=static: الملفات منسوخة داخل public/_render (للرندر)، وmode=url: تُخدم من الاستوديو.
 */
/** تلاوة بطاقة آية: ملف واحد، أو عدة ملفات متتالية لمقطع من عدة آيات. */
export type Recitation = { file: string; duration: number; parts?: { file: string; duration: number }[]; reciter?: string; source?: "licensed" | "quran-foundation" };
export type EpisodeMedia = {
  mode: "static" | "url";
  base: string;
  /** لاحقة تُضاف لروابط الاستوديو (مثل ?channel=balislam) */
  query?: string;
  voice: Record<string, VoiceClip>;
  sfx: string[];
  recitations: Record<string, Recitation>;
};

export const emptyMedia: EpisodeMedia = { mode: "url", base: "", voice: {}, sfx: [], recitations: {} };

/** اسم ملف التلاوة من مفتاح الآية: 53:39 → 53-39.mp3 */
export const recitationFileFor = (key: string) => `${key.replace(":", "-")}.mp3`; // 2:255-256 → 2-255-256.mp3
