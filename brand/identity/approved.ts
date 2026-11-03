/**
 * الهويات المعتمدة من صاحب القنوات (٣ نوفمبر ٢٠٢٦، لوحة «هويات القنوات الثلاث»).
 * مصدر واحد يقرؤه تبويب «القناة» في الاستوديو (يعرض الهوية ويقفل الشعار والافتتاحية والمصغّرة)
 * واختبار tests/identity-approved.test.ts (يرفض أي تغيير أو تسرّب بصمة قناة إلى أخرى).
 * لا يُعدَّل إلا باعتماد جديد بعد ستوري بورد.
 */
export type ApprovedIdentity = {
  nameAr: string;
  approvedOn: string;
  /** وصف الهوية في سطر */
  summaryAr: string;
  emblem: string;
  intro: "mihrab" | "horizon" | "highlighter";
  thumbnail: "mihrab" | "horizon" | "highlighter";
  fonts: { heading: string; body: string; wordmark: string };
  /** ألوان الهوية الأساسية بأسمائها (للعرض) */
  palette: { hex: string; nameAr: string }[];
  /** بصمة القناة: ألوان لا تظهر في أي قناة أخرى */
  signature: string[];
  motifs: string[];
  /** درجات مشتقة من ألوان الهوية (أسطح وحبر ثانوي) وألوان البشرة: ما عدا الألوان والبصمة والمشتقات ممنوع في identity.json */
  derived: string[];
};

const SKIN = ["#E7C3A0", "#D2A782"];

export const APPROVED_IDENTITIES: Record<string, ApprovedIdentity> = {
  balislam: {
    nameAr: "محراب النور",
    approvedOn: "2026-11-03",
    summaryAr: "قوس محراب نحاسي يضيء بنور الفجر، باء بضربة فرشاة نقطتها شمس، ختم أحمر صغير، ونقش النجمة الثمانية.",
    emblem: "mihrab",
    intro: "mihrab",
    thumbnail: "mihrab",
    fonts: { heading: "Aref Ruqaa", body: "Tajawal", wordmark: "Aref Ruqaa" },
    palette: [
      { hex: "#0B1F1C", nameAr: "ليل زمردي" },
      { hex: "#C9A24A", nameAr: "نحاس" },
      { hex: "#F2B35B", nameAr: "فجر" },
      { hex: "#F4EEE2", nameAr: "ورق" },
      { hex: "#C2412D", nameAr: "ختم" },
    ],
    signature: ["#0B1F1C", "#C9A24A", "#F2B35B", "#C2412D"],
    motifs: ["arches", "girih"],
    derived: ["#0F2A26", "#12352F", "#174039", "#071512", "#A9C3B9", "#6F8F84", ...SKIN],
  },
  "dafatir-alzaman": {
    nameAr: "دفتر الأفق",
    approvedOn: "2026-11-03",
    summaryAr: "دفتر مفتوح كعبه ساعة رملية، غروب مرسوم على صفحتيه، وشريط تاريخ أحمر.",
    emblem: "horizon-book",
    intro: "horizon",
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
    derived: ["#1A1424", "#251C30", "#35284D", "#120C18", "#A399B4", "#BFB3C9", "#B4583A", "#2B1E14", "#5A4632", "#EADBC0", "#F4E9D4", "#F8EEDB", "#F3E9DA", "#7A7F4E", ...SKIN],
  },
  "zubdat-alkutub": {
    nameAr: "القلم المميِّز",
    approvedOn: "2026-11-03",
    summaryAr: "نظام كامل بالأبيض والأسود، والفسفوري للفكرة فقط: عدّاد الأفكار والورقة اللاصقة وبطاقة الكتاب.",
    emblem: "highlighter-z",
    intro: "highlighter",
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
    derived: ["#000000", "#1E1E1E", "#4A4A4A", "#6A6A6A", "#8A8172", "#BDBDBD", "#DCD6C8", "#F4F4F1", "#F1EDE4", "#EDE7DA", "#F8F4EC", ...SKIN],
  },
};

export const approvedIdentity = (channelId?: string): ApprovedIdentity | undefined => (channelId ? APPROVED_IDENTITIES[channelId] : undefined);

/** كل الشارات المحجوزة لقنوات معتمدة (لا تُعرض لغيرها) */
export const reservedEmblems = () => new Set(Object.values(APPROVED_IDENTITIES).map((a) => a.emblem));
