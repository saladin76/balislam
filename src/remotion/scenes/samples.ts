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

/** نسخ إنجليزية من نفس المحتوى للحلقات الإنجليزية (en-scene-…). */
export const sampleBigQuestionEn: Omit<BigQuestionProps, "themeId" | "orientation"> = {
  eyebrow: "Chapter 1 · The question",
  question: "Why do we put off what matters?",
  highlight: "what matters?",
  element: "question-mark",
  narration: "You know what needs doing, and still you put it off. Why does this happen to all of us?",
};

export const sampleCharacterTalkEn: Omit<CharacterTalkProps, "themeId" | "orientation"> = {
  eyebrow: "Chapter 2 · Where does procrastination come from?",
  variant: "narrator-m",
  pose: "think",
  line: "I'll start… in just a minute.",
  element: "phone-notifications",
  narration: "You open your phone for a minute and an hour slips by, and you tell yourself: I'll start soon.",
};

/** الآية تبقى بالعربية كما هي؛ المرجع والملاحظة بلغة الحلقة. */
export const sampleVerseCardEn: Omit<VerseCardProps, "themeId" | "orientation"> = {
  eyebrow: "Chapter 4 · Through the lens of Islam",
  text: "وَأَنْ لَيْسَ لِلْإِنْسَانِ إِلَّا مَا سَعَىٰ",
  reference: "An-Najm · 53:39",
  meaning: "And that there is not for man except that for which he strives.",
  meaningSource: "Translation preview",
  sourceNote: "Preview: final Uthmani text from Quran Foundation",
};

export const sceneDurations = { bigQuestion: 150, characterTalk: 165, verseCard: 180 } as const;
