/**
 * الخطوط المعتمدة (كلها برخصة SIL Open Font License، من Google Fonts).
 * - العناوين: El Messiri
 * - النص والترجمة: IBM Plex Sans Arabic (ومعه IBM Plex Sans للحروف اللاتينية الموسّعة)
 * - الآيات والأحاديث: Amiri
 * - اسم القناة بجوار الشعار فقط: Readex Pro
 */
export const fontFamilies = {
  heading: "var(--bal-heading, 'El Messiri'), 'El Messiri', serif",
  /** IBM Plex Sans (اللاتيني) احتياطي من نفس العائلة للحروف التركية التي لا تغطيها النسخة العربية: Ğ İ Ş */
  body: "var(--bal-body, 'IBM Plex Sans Arabic'), 'IBM Plex Sans Arabic', 'IBM Plex Sans', sans-serif",
  scripture: "'Amiri', serif",
  /** D221: نص الآيات (الرسم العثماني من Tanzil، D220) بخط «Amiri Quran» (OFL 1.1، public/fonts/AmiriQuran-OFL.txt): علامات الوقف في مواضعها */
  quran: "'Amiri Quran', 'Amiri', serif",
  wordmark: "var(--bal-wordmark, 'Readex Pro'), 'Readex Pro', sans-serif",
  /** خط اليد لقوالب السبورة: رقعة للعربية، وCaveat للاتينية */
  hand: "'Aref Ruqaa', 'Caveat', cursive",
  /** هويات القنوات */
  ruqaa: "'Aref Ruqaa', serif",
  bold: "'Lalezar', 'Tajawal', sans-serif",
  clean: "'Tajawal', 'IBM Plex Sans Arabic', sans-serif",
  mono: "'IBM Plex Mono', monospace",
} as const;

export type FontFile = {
  family: string;
  file: string;
  weight: string;
  /** لخطوط مقسومة إلى ملف عربي وملف لاتيني بنفس الاسم */
  unicodeRange?: string;
};

const AR = "U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0897-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC";
const LAT = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";

/** الملفات داخل public/fonts، تُحمّل في Remotion عبر staticFile. */
export const fontFiles: FontFile[] = [
  { family: "El Messiri", file: "fonts/ElMessiri.ttf", weight: "400 700" },
  { family: "IBM Plex Sans Arabic", file: "fonts/IBMPlexSansArabic-Medium.ttf", weight: "500" },
  { family: "IBM Plex Sans Arabic", file: "fonts/IBMPlexSansArabic-SemiBold.ttf", weight: "600" },
  { family: "IBM Plex Sans Arabic", file: "fonts/IBMPlexSansArabic-Bold.ttf", weight: "700" },
  { family: "IBM Plex Sans", file: "fonts/IBMPlexSans.ttf", weight: "100 700" },
  { family: "Amiri", file: "fonts/Amiri-Regular.ttf", weight: "400" },
  { family: "Amiri", file: "fonts/Amiri-Bold.ttf", weight: "700" },
  { family: "Amiri Quran", file: "fonts/AmiriQuran.ttf", weight: "400 700" },
  { family: "Readex Pro", file: "fonts/ReadexPro.ttf", weight: "200 700" },
  { family: "Aref Ruqaa", file: "fonts/ArefRuqaa-Regular.ttf", weight: "400" },
  { family: "Aref Ruqaa", file: "fonts/ArefRuqaa-Bold.ttf", weight: "700" },
  { family: "Caveat", file: "fonts/Caveat-VF.ttf", weight: "400 700" },
  // زبدة الكتب: لاله زار للعناوين، وتجوال للنصوص
  { family: "Lalezar", file: "fonts/Lalezar-arabic.woff2", weight: "400", unicodeRange: AR },
  { family: "Lalezar", file: "fonts/Lalezar-latin.woff2", weight: "400", unicodeRange: LAT },
  ...(["400", "500", "700"] as const).flatMap((w) => [
    { family: "Tajawal", file: `fonts/Tajawal-arabic-${w}.woff2`, weight: w, unicodeRange: AR },
    { family: "Tajawal", file: `fonts/Tajawal-latin-${w}.woff2`, weight: w, unicodeRange: LAT },
  ]),
  // دفاتر الزمن: خط الآلة الكاتبة للسنوات والأماكن
  { family: "IBM Plex Mono", file: "fonts/IBMPlexMono-500.woff2", weight: "500" },
];
