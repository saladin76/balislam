/**
 * نبرات الصوت: الصوت المستنسخ نفسه بإعدادات مختلفة حسب روح الحلقة أو المشهد.
 * تُطبَّق فوق إعدادات config.voice. (القيم من مدى ElevenLabs: stability وstyle من 0 إلى 1، والسرعة 0.7–1.2)
 */
export type Tone = "calm" | "warm" | "documentary" | "dramatic" | "energetic" | "intimate";
export const tones: Record<Tone, { nameAr: string; useAr: string; stability: number; style: number; speed: number }> = {
  calm: { nameAr: "هادئ تأملي", useAr: "الحلقات الإيمانية والتأمل", stability: 0.65, style: 0.05, speed: 0.95 },
  warm: { nameAr: "حكّاء دافئ", useAr: "القصص والحياة اليومية", stability: 0.45, style: 0.25, speed: 1.0 },
  documentary: { nameAr: "وثائقي رصين", useAr: "التاريخ والمعلومات", stability: 0.6, style: 0.15, speed: 0.98 },
  dramatic: { nameAr: "درامي", useAr: "لحظات الذروة والمعارك والقرارات", stability: 0.3, style: 0.5, speed: 0.96 },
  energetic: { nameAr: "حماسي", useAr: "الخطافات والشورتس والدعوة للاشتراك", stability: 0.35, style: 0.4, speed: 1.08 },
  intimate: { nameAr: "قريب وهامس", useAr: "الأسئلة الشخصية والمواقف المؤثرة", stability: 0.55, style: 0.3, speed: 0.92 },
};
export const toneIds = Object.keys(tones) as Tone[];
export const isTone = (t: unknown): t is Tone => typeof t === "string" && t in tones;
