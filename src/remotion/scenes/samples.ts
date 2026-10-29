import type { BigQuestionProps, CharacterTalkProps, VerseCardProps } from "./types";

/** محتوى تجريبي من سكريبت الحلقة 001 لمعاينة القوالب. */
export const sampleBigQuestion: Omit<BigQuestionProps, "themeId" | "orientation"> = {
  eyebrow: "الفصل 1 · السؤال",
  question: "لماذا نؤجّل ما نعرف أنه مهم؟",
  highlight: "نعرف أنه مهم",
  element: "question-mark",
  narration: "تعرف ما يجب فعله، ومع ذلك تؤجله. لماذا يحدث هذا معنا جميعًا؟",
};

export const sampleCharacterTalk: Omit<CharacterTalkProps, "themeId" | "orientation"> = {
  eyebrow: "الفصل 2 · من أين يأتي التأجيل؟",
  variant: "narrator-m",
  pose: "think",
  line: "سأبدأ… بعد قليل فقط.",
  element: "phone-notifications",
  narration: "تفتح الهاتف لدقيقة فتمر ساعة، وتقول لنفسك: سأبدأ بعد قليل.",
};

export const sampleVerseCard: Omit<VerseCardProps, "themeId" | "orientation"> = {
  eyebrow: "الفصل 4 · بعين الإسلام",
  text: "وَأَنْ لَيْسَ لِلْإِنْسَانِ إِلَّا مَا سَعَىٰ",
  reference: "النجم · ٣٩",
  sourceNote: "معاينة: النص النهائي بالرسم العثماني من Quran Foundation",
};

export const sceneDurations = { bigQuestion: 150, characterTalk: 165, verseCard: 180 } as const;
