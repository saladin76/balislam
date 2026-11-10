import type { LangPack } from "./types";

export const ar: LangPack = {
  code: "ar",
  nameAr: "العربية",
  nativeName: "العربية",
  dir: "rtl",
  ready: true,
  digits: "arab",
  speech: { wordsPerMinute: 130 },
  syntax: { chapter: "الفصل", citations: "الاستشهادات", step: "الخطوة العملية", scene: "مشهد", ayah: "آية", hadith: "حديث", sfx: "صوت" },
  strings: {
    chapter: "الفصل",
    summary: "الخلاصة",
    practicalStep: "الخطوة العملية",
    follow: "تابعنا",
    recitedBy: "بصوت القارئ",
    commentPrompt: "اكتب في التعليقات:",
    shareOpinion: "شاركنا رأيك في التعليقات",
    templateWip: "قيد البناء",
    quranAttribution: "نص الآيات: من السكريبت المعتمد",
    descChapters: "فصول الحلقة:",
    descSources: "المصادر:",
    descVerse: "سورة {name}، الآية {ayah}",
    descRecitation: "التلاوة: {name} بإذن مكتوب",
    descRecitationOwn: "التلاوة: بصوت {name}",
    fullEpisode: "الحلقة كاملة على القناة: ‹ضع رابط الحلقة هنا›",
    grades: { صحيح: "صحيح", حسن: "حسن" },
  },
};

export const tr: LangPack = {
  code: "tr",
  nameAr: "التركية",
  nativeName: "Türkçe",
  dir: "ltr",
  ready: true,
  digits: "latn",
  speech: { wordsPerMinute: 120 },
  syntax: { chapter: "Bölüm", citations: "Kaynaklar", step: "Pratik adım", scene: "sahne", ayah: "ayet", hadith: "hadis", sfx: "ses" },
  strings: {
    chapter: "Bölüm",
    summary: "Özet",
    practicalStep: "Pratik adım",
    follow: "Bizi takip edin",
    recitedBy: "Okuyan:",
    commentPrompt: "Yorumlara yaz:",
    shareOpinion: "Düşüncelerini yorumlarda paylaş",
    templateWip: "yapım aşamasında",
    quranAttribution: "Ayet metni: onaylı senaryodan",
    descChapters: "Bölümler:",
    descSources: "Kaynaklar:",
    descVerse: "{name} Suresi, {ayah}. ayet",
    descRecitation: "Okuyan: {name}, yazılı izinle",
    descRecitationOwn: "Okuyan: {name}",
    fullEpisode: "Tam bölüm kanalda: ‹bölüm bağlantısını buraya ekle›",
    grades: { صحيح: "Sahih", حسن: "Hasen" },
  },
};

export const en: LangPack = {
  code: "en",
  nameAr: "الإنجليزية",
  nativeName: "English",
  dir: "ltr",
  ready: true,
  digits: "latn",
  speech: { wordsPerMinute: 150 },
  syntax: { chapter: "Chapter", citations: "Sources", step: "Practical step", scene: "scene", ayah: "verse", hadith: "hadith", sfx: "sound" },
  strings: {
    chapter: "Chapter",
    summary: "Summary",
    practicalStep: "Practical step",
    follow: "Follow us",
    recitedBy: "Recited by",
    commentPrompt: "Tell us in the comments:",
    shareOpinion: "Share your thoughts in the comments",
    templateWip: "in progress",
    quranAttribution: "Verse text: reviewed script",
    descChapters: "Chapters:",
    descSources: "Sources:",
    descVerse: "Surah {name}, verse {ayah}",
    descRecitation: "Recitation: {name}, with written permission",
    descRecitationOwn: "Recitation: {name}",
    fullEpisode: "Full episode on the channel: ‹add the episode link here›",
    grades: { صحيح: "Sahih", حسن: "Hasan" },
  },
};

export const langPacks: Record<string, LangPack> = { ar, tr, en };

export const langPack = (code?: string): LangPack => langPacks[code ?? "ar"] ?? ar;

const EAST = "٠١٢٣٤٥٦٧٨٩";

/** أرقام عربية مشرقية (٠١٢…) بغض النظر عن اللغة. */
export const toEasternDigits = (s: string | number) => String(s).replace(/[0-9]/g, (d) => EAST[Number(d)] ?? d);

/** العكس: أرقام مشرقية إلى لاتينية. */
export const toWesternDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));

/** يحوّل الأرقام حسب أرقام اللغة. */
export const localDigits = (s: string | number, pack: LangPack) =>
  pack.digits === "arab"
    ? String(s).replace(/[0-9]/g, (d) => EAST[Number(d)] ?? d)
    : String(s)
        .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
        .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
        .replace(/٫/g, ".")
        .replace(/٬/g, ",")
        .replace(/٪/g, "%");
