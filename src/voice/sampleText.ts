/** Curated non-Quran voice-profile samples. Do not accept arbitrary text for voice cloning. */
export const VOICE_SAMPLE_TEXT: Readonly<Record<string, string>> = {
  balislam: "أحيانًا نؤجّل ما نعرف أنه مهم، لا لأننا كسالى، بل لأننا نخاف من الشعور الذي ينتظرنا عند البداية. فماذا لو بدأنا بخطوةٍ واحدةٍ صغيرة؟",
  "dafatir-alzaman": "في صيف عام ألفٍ ومئتين وثمانيةٍ وخمسين، وقف رجلٌ على أسوار بغداد يراقب الأفق، ولم يكن يعلم أن الأيام القادمة ستغيّر وجه التاريخ.",
  "zubdat-alkutub": "الفكرة الأولى في هذا الكتاب بسيطة جدًا: العادات الصغيرة تصنع النتائج الكبيرة. تحسّنٌ بواحدٍ في المئة كل يوم، يجعلك بعد سنةٍ شخصًا مختلفًا تمامًا.",
};
export const voiceSampleTextFor = (channel: string): string =>
  VOICE_SAMPLE_TEXT[channel] ?? "هذه عينة صوتية قصيرة لاختبار وضوح مخارج الحروف وسرعة السرد ونبرة الكلام دون أي تلاوة قرآنية.";
export const assertCuratedVoiceSample = (channel: string, text: unknown) => {
  if (typeof text !== "string" || text !== voiceSampleTextFor(channel))
    throw new Error("منع إنشاء عينة صوت اصطناعي بنص حر. استخدم النص الاختباري الثابت غير القرآني لهذه القناة.");
  return text;
};
