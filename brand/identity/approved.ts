/**
 * الهويات المعتمدة من صاحب القنوات (٣ نوفمبر ٢٠٢٦، لوحة «هويات القنوات الثلاث»)؛ «بالإسلام» أُعيدت إلى هويتها الأصلية
 * «باء التشغيل» يوم ١٨ نوفمبر، وبلا افتتاحية في القنوات الثلاث (قرارا المالك، D154 وD155).
 * مصدر واحد يقرؤه تبويب «القناة» في الاستوديو (يعرض الهوية ويقفل الشعار والافتتاحية والمصغّرة)
 * واختبار tests/identity-approved.test.ts (يرفض أي تغيير أو تسرّب بصمة قناة إلى أخرى).
 * لا يُعدَّل إلا باعتماد جديد بعد ستوري بورد.
 */
export type ApprovedIdentity = {
  nameAr: string;
  approvedOn: string;
  /** وصف الهوية في سطر */
  summaryAr: string;
  /** شعار «شارة» (emblem) باسمه، أو «baa» لشعار «باء التشغيل» (logo.type = "baa") */
  emblem: string;
  /** «none»: الفيديو يبدأ بالمضمون مباشرة بلا افتتاحية (قرار المالك ١٨ نوفمبر، القنوات الثلاث) */
  intro: "none" | "mihrab" | "horizon" | "highlighter";
  thumbnail: "circle" | "mihrab" | "horizon" | "highlighter";
  fonts: { heading: string; body: string; wordmark: string };
  /** ألوان الهوية الأساسية بأسمائها (للعرض) */
  palette: { hex: string; nameAr: string }[];
  /** بصمة القناة: ألوان لا تظهر في أي قناة أخرى */
  signature: string[];
  motifs: string[];
  /** درجات مشتقة من ألوان الهوية (أسطح وحبر ثانوي) وألوان البشرة: ما عدا الألوان والبصمة والمشتقات ممنوع في identity.json */
  derived: string[];
  /** «idea-only»: لون التمييز للكلمة أو الفكرة المحورية فقط، لا لتلوين العناصر ولا للزينة (يُطبَّق في القوالب) */
  highlight?: "idea-only";
  /** ألوان أضافها المالك لاستعمال واحد محدد (لا لـ identity.json العامة)، وهي في derived أيضًا */
  restricted?: { hex: string; nameAr: string; useAr: string }[];
};

const SKIN = ["#E7C3A0", "#D2A782"];

export const APPROVED_IDENTITIES: Record<string, ApprovedIdentity> = {
  balislam: {
    nameAr: "باء التشغيل",
    approvedOn: "2026-11-18",
    summaryAr: "حرف الباء ونقطته زر تشغيل على مربع بلون المجال: نحاس «أقواس دافئة» (الافتراضي)، وزمرد «حبر وورق»، وورد «دفء البيت»، وليل «ليلٌ هادئ». الهوية الأصلية قبل «محراب النور»، أُعيدت بقرار المالك.",
    emblem: "baa",
    intro: "none",
    thumbnail: "circle",
    fonts: { heading: "El Messiri", body: "IBM Plex Sans Arabic", wordmark: "Readex Pro" },
    palette: [
      { hex: "#B4532F", nameAr: "نحاس" },
      { hex: "#1E6B5C", nameAr: "زمرد" },
      { hex: "#C2566B", nameAr: "ورد" },
      { hex: "#0E1A2B", nameAr: "ليل" },
      { hex: "#D9A441", nameAr: "ذهب" },
      { hex: "#EFE4D3", nameAr: "ورق" },
    ],
    signature: ["#B4532F", "#1E6B5C", "#C2566B", "#0E1A2B"],
    motifs: ["arches", "house-circles", "ink-lines", "stars"],
    derived: ["#16263D", "#1B1B1B", "#2E3A2A", "#33476A", "#3A2E39", "#4A5546", "#4F7A60", "#55524B", "#5A6F94", "#5E4E5C", "#5FB8AE", "#6E8A5A", "#7A5A44", "#7FA3A8", "#7FA88E", "#8A6A55", "#8FB8C9", "#9FDCCB", "#A9B4C6", "#B07A5B", "#C9D3E3", "#D98C6E", "#D9B08C", "#DDB58F", "#E0A458", "#E2B24C", "#E58E6B", "#E9C6A8", "#F2C7A5", "#F2D2B0", "#F3EEE3", "#F4F1EA", "#F7EEE8", "#FBF6EE", "#FFFDF8", ...SKIN],
  },

  "dafatir-alzaman": {
    nameAr: "دفتر الأفق",
    approvedOn: "2026-11-03",
    summaryAr: "دفتر مفتوح كعبه ساعة رملية، غروب مرسوم على صفحتيه، وشريط تاريخ أحمر.",
    emblem: "horizon-book",
    intro: "none",
    thumbnail: "horizon",
    fonts: { heading: "Amiri", body: "Tajawal", wordmark: "Amiri" },
    palette: [
      { hex: "#2A1E3F", nameAr: "غسق" },
      { hex: "#E07A3F", nameAr: "شمس الغروب" },
      { hex: "#F1E4CB", nameAr: "رَقّ" },
      { hex: "#4A2E1F", nameAr: "حبر بني" },
      { hex: "#D7372B", nameAr: "شريط التاريخ" },
      { hex: "#C8A15A", nameAr: "رمل الساعة" },
    ],
    signature: ["#2A1E3F", "#E07A3F", "#F1E4CB", "#4A2E1F", "#D7372B", "#F3C98B"],
    motifs: ["stars", "horizon", "ink-lines"],
    derived: ["#1A1424", "#251C30", "#35284D", "#120C18", "#A399B4", "#BFB3C9", "#B4583A", "#2B1E14", "#5A4632", "#EADBC0", "#F4E9D4", "#F8EEDB", "#F3E9DA", "#7A7F4E", "#26619C", ...SKIN],
    // قرار المالك ٢٢ نوفمبر: اللازورد للماء والخرائط وحدها (بحار وأنهار «مكتب الرحّالة»)
    restricted: [{ hex: "#26619C", nameAr: "لازورد", useAr: "الماء والخرائط فقط" }],
  },
  "zubdat-alkutub": {
    nameAr: "القلم المميِّز",
    approvedOn: "2026-11-03",
    summaryAr: "نظام كامل بالأبيض والأسود، والفسفوري للفكرة فقط: عدّاد الأفكار والورقة اللاصقة وبطاقة الكتاب.",
    emblem: "highlighter-z",
    intro: "none",
    thumbnail: "highlighter",
    fonts: { heading: "Lalezar", body: "Tajawal", wordmark: "Lalezar" },
    palette: [
      { hex: "#FFFFFF", nameAr: "ورقة" },
      { hex: "#111111", nameAr: "حبر" },
      { hex: "#E8F542", nameAr: "فسفوري (للفكرة فقط)" },
      { hex: "#FF6B4A", nameAr: "تنبيه" },
    ],
    signature: ["#E8F542", "#FF6B4A"],
    motifs: ["ruled"],
    highlight: "idea-only",
    derived: ["#000000", "#1E1E1E", "#4A4A4A", "#6A6A6A", "#8A8172", "#BDBDBD", "#DCD6C8", "#F4F4F1", "#F1EDE4", "#EDE7DA", "#F8F4EC", "#A8322A", "#2F6B4F", "#C9A24A", "#7A5230", ...SKIN],
    // قرار المالك ٢٢ نوفمبر: عالم «الأفكار آلات» بألوان مخطوطة الجزري (بلا فسفوري فيه)
    restricted: [
      { hex: "#A8322A", nameAr: "أحمر المخطوطة", useAr: "عالم «الأفكار آلات»: أسماء الأجزاء بالحبر الأحمر" },
      { hex: "#2F6B4F", nameAr: "أخضر المخطوطة", useAr: "عالم «الأفكار آلات»" },
      { hex: "#C9A24A", nameAr: "ذهب المخطوطة", useAr: "عالم «الأفكار آلات»" },
      { hex: "#7A5230", nameAr: "خشب الآلة", useAr: "عالم «الأفكار آلات»" },
    ],
  },
};

export const approvedIdentity = (channelId?: string): ApprovedIdentity | undefined => (channelId ? APPROVED_IDENTITIES[channelId] : undefined);

/** هل لون التمييز في هذه القناة للفكرة فقط (زبدة الكتب: «ولا شيء آخر يأخذ اللون الفسفوري») */
export const highlightIdeaOnly = (channelId?: string) => approvedIdentity(channelId)?.highlight === "idea-only";

/** كل الشارات المحجوزة لقنوات معتمدة (لا تُعرض لغيرها) */
export const reservedEmblems = () => new Set(Object.values(APPROVED_IDENTITIES).map((a) => a.emblem));
