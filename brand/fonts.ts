/**
 * الخطوط المعتمدة (كلها برخصة SIL Open Font License، من Google Fonts).
 * - العناوين: El Messiri
 * - النص والترجمة: IBM Plex Sans Arabic (ومعه IBM Plex Sans للحروف اللاتينية الموسّعة)
 * - الآيات والأحاديث: Amiri
 * - اسم القناة بجوار الشعار فقط: Readex Pro
 */
export const fontFamilies = {
  heading: "'El Messiri', serif",
  /** IBM Plex Sans (اللاتيني) احتياطي من نفس العائلة للحروف التركية التي لا تغطيها النسخة العربية: Ğ İ Ş */
  body: "'IBM Plex Sans Arabic', 'IBM Plex Sans', sans-serif",
  scripture: "'Amiri', serif",
  wordmark: "'Readex Pro', sans-serif",
} as const;

export type FontFile = {
  family: string;
  file: string;
  weight: string;
};

/** الملفات داخل public/fonts، تُحمّل في Remotion عبر staticFile. */
export const fontFiles: FontFile[] = [
  { family: "El Messiri", file: "fonts/ElMessiri.ttf", weight: "400 700" },
  { family: "IBM Plex Sans Arabic", file: "fonts/IBMPlexSansArabic-Medium.ttf", weight: "500" },
  { family: "IBM Plex Sans Arabic", file: "fonts/IBMPlexSansArabic-SemiBold.ttf", weight: "600" },
  { family: "IBM Plex Sans Arabic", file: "fonts/IBMPlexSansArabic-Bold.ttf", weight: "700" },
  { family: "IBM Plex Sans", file: "fonts/IBMPlexSans.ttf", weight: "100 700" },
  { family: "Amiri", file: "fonts/Amiri-Regular.ttf", weight: "400" },
  { family: "Amiri", file: "fonts/Amiri-Bold.ttf", weight: "700" },
  { family: "Readex Pro", file: "fonts/ReadexPro.ttf", weight: "200 700" },
];
