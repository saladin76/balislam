import type { VoiceClip } from "../voice/generate";

/**
 * وسائط الحلقة التي يحتاجها التكوين: مقاطع الصوت، والمؤثرات المتاحة، والتلاوات المرخصة.
 * mode=static: الملفات منسوخة داخل public/_render (للرندر)، وmode=url: تُخدم من الاستوديو.
 */
/** تلاوة بطاقة آية: ملف واحد، أو عدة ملفات متتالية لمقطع من عدة آيات. */
export type Recitation = { file: string; duration: number; parts?: { file: string; duration: number; sha256?: string }[]; reciter?: string; source?: "licensed" | "manual" | "quran-foundation" | "alquran-cloud";
  /** The owner recorded it himself (his rights evidence says so): attributed without «بإذن مكتوب». */
  own?: boolean };
/** The rights evidence says the recording is the uploader's own voice (owner/channel), not a licensed reciter. */
export const isOwnRecordingEvidence = (evidence?: string | null): boolean =>
  /(بصوتي|تسجيلي|صوتي|سجّلته|سجلته|بنفسي|صاحب القناة|تسجيل المالك|own (?:voice|recording)|my (?:own )?(?:voice|recording))/i.test(evidence ?? "");
export type EpisodeMedia = {
  mode: "static" | "url";
  base: string;
  /** لاحقة تُضاف لروابط الاستوديو (مثل ?channel=balislam) */
  query?: string;
  voice: Record<string, VoiceClip>;
  sfx: string[];
  /** D158 الخطوة ٤: لاحقات النسخ البديلة الموجودة لكل مؤثر مستعمل (src/plan/sfxVariants.ts) */
  sfxVariants?: Record<string, string[]>;
  recitations: Record<string, Recitation>;
  /** صور اللوحات الوثائقية الموجودة في مجلد الحلقة images/ */
  images?: string[];
};

export const emptyMedia: EpisodeMedia = { mode: "url", base: "", voice: {}, sfx: [], recitations: {} };

/** اسم ملف التلاوة من مفتاح الآية: 53:39 → 53-39.mp3 */
export const recitationFileFor = (key: string) => `${key.replace(":", "-")}.mp3`; // 2:255-256 → 2-255-256.mp3
