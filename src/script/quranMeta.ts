/**
 * أسماء السور وعدد آيات كل سورة (برواية حفص عن عاصم، العدّ الكوفي: 6236 آية).
 * يُستخدم فقط للتحقق من صحة مراجع الآيات في السكريبت؛ نص الآيات نفسه يُجلب من Quran Foundation.
 */
export const SURAH_NAMES: readonly string[] = [
  "الفاتحة", "البقرة", "آل عمران", "النساء", "المائدة", "الأنعام", "الأعراف", "الأنفال", "التوبة", "يونس",
  "هود", "يوسف", "الرعد", "إبراهيم", "الحجر", "النحل", "الإسراء", "الكهف", "مريم", "طه",
  "الأنبياء", "الحج", "المؤمنون", "النور", "الفرقان", "الشعراء", "النمل", "القصص", "العنكبوت", "الروم",
  "لقمان", "السجدة", "الأحزاب", "سبأ", "فاطر", "يس", "الصافات", "ص", "الزمر", "غافر",
  "فصلت", "الشورى", "الزخرف", "الدخان", "الجاثية", "الأحقاف", "محمد", "الفتح", "الحجرات", "ق",
  "الذاريات", "الطور", "النجم", "القمر", "الرحمن", "الواقعة", "الحديد", "المجادلة", "الحشر", "الممتحنة",
  "الصف", "الجمعة", "المنافقون", "التغابن", "الطلاق", "التحريم", "الملك", "القلم", "الحاقة", "المعارج",
  "نوح", "الجن", "المزمل", "المدثر", "القيامة", "الإنسان", "المرسلات", "النبأ", "النازعات", "عبس",
  "التكوير", "الانفطار", "المطففين", "الانشقاق", "البروج", "الطارق", "الأعلى", "الغاشية", "الفجر", "البلد",
  "الشمس", "الليل", "الضحى", "الشرح", "التين", "العلق", "القدر", "البينة", "الزلزلة", "العاديات",
  "القارعة", "التكاثر", "العصر", "الهمزة", "الفيل", "قريش", "الماعون", "الكوثر", "الكافرون", "النصر",
  "المسد", "الإخلاص", "الفلق", "الناس",
];

export const AYAH_COUNTS: readonly number[] = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109,
  123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
  112, 78, 118, 64, 77, 227, 93, 88, 69, 60,
  34, 30, 73, 54, 45, 83, 182, 88, 75, 85,
  54, 53, 89, 59, 37, 35, 38, 29, 18, 45,
  60, 49, 62, 55, 78, 96, 29, 22, 24, 13,
  14, 11, 11, 18, 12, 12, 30, 52, 52, 44,
  28, 28, 20, 56, 40, 31, 50, 40, 46, 42,
  29, 19, 36, 25, 22, 17, 19, 26, 30, 20,
  15, 21, 11, 8, 8, 19, 5, 8, 8, 11,
  11, 8, 3, 9, 5, 4, 7, 3, 6, 3,
  5, 4, 5, 6,
];

/** أسماء أخرى مشهورة لبعض السور. */
const ALIASES: Record<string, number> = {
  "براءة": 9,
  "بني إسرائيل": 17,
  "المؤمن": 40,
  "حم السجدة": 41,
  "الدهر": 76,
  "الانشراح": 94,
  "اللهب": 111,
  "التوحيد": 112,
};

const TASHKEEL = /[ً-ْٰـ]/g;

/** توحيد الكتابة للمقارنة: حذف التشكيل والتطويل، وتوحيد الألف والتاء المربوطة والياء. */
export const normalizeArabic = (s: string): string =>
  s
    .replace(TASHKEEL, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim();

const INDEX = new Map<string, number>();
SURAH_NAMES.forEach((name, i) => INDEX.set(normalizeArabic(name), i + 1));
Object.entries(ALIASES).forEach(([name, n]) => INDEX.set(normalizeArabic(name), n));

/** يحوّل الأرقام العربية الهندية (٠-٩) إلى أرقام لاتينية. */
export const toLatinDigits = (s: string): string => s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));

/** رقم السورة من اسمها (يقبل «سورة» قبل الاسم واختلاف الهمزات)، أو null. */
export const surahNumber = (name: string): number | null => {
  const clean = normalizeArabic(name.replace(/^\s*سورة\s+/, ""));
  const n = INDEX.get(clean);
  if (n) return n;
  if (/^\s*\d+\s*$/.test(name)) {
    const k = Number(name);
    return k >= 1 && k <= 114 ? k : null;
  }
  return latinIndex().get(normalizeLatin(name)) ?? null;
};

/** تطبيع الاسم اللاتيني: «Surah An-Najm» و«an najm» و«Najm» كلها «najm». */
const normalizeLatin = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^\s*(surah|sura|surat)\s+/, "")
    .replace(/\s+(suresi|sure)\s*$/, "")
    .replace(/['‘’ʿʾ`]/g, "")
    .replace(/^(al|an|at|ar|as|ash|ad|adh|az)[-\s]+/, "")
    .replace(/[-\s]+/g, "");

let LATIN: Map<string, number> | null = null;
const latinIndex = () => {
  if (!LATIN) {
    LATIN = new Map();
    SURAH_NAMES_LATIN.forEach((name, i) => LATIN!.set(normalizeLatin(name), i + 1));
  }
  return LATIN;
};

export type AyahRef = { surah: number; surahName: string; from: number; to: number; key: string };

export type AyahRefResult = { ok: true; ref: AyahRef } | { ok: false; reason: string };

/**
 * يقرأ مرجع آية مثل «النجم 39» أو «سورة البقرة ٢٥٥-٢٥٦».
 * المفتاح الناتج بصيغة Quran Foundation: «53:39» أو «2:255-256».
 */
export const parseAyahRef = (raw: string): AyahRefResult => {
  const text = toLatinDigits(raw.trim()).replace(/^(\d{1,3})\s*:\s*(\d)/, "$1 $2");
  const m = text.match(/^(.+?)\s+(\d+)(?:\s*[-–]\s*(\d+))?$/);
  if (!m) return { ok: false, reason: `صيغة المرجع «${raw}» غير صحيحة؛ الصيغة: اسم السورة ثم رقم الآية، مثل «النجم 39» أو «An-Najm 39» أو «53:39».` };
  const [, name = "", fromS = "", toS] = m;
  const surah = surahNumber(name);
  if (!surah) return { ok: false, reason: `لا توجد سورة باسم «${name.trim()}».` };
  const max = AYAH_COUNTS[surah - 1] ?? 0;
  const from = Number(fromS);
  const to = toS ? Number(toS) : from;
  const surahName = SURAH_NAMES[surah - 1] ?? name;
  if (from < 1 || to > max || to < from) {
    return { ok: false, reason: `سورة ${surahName} فيها ${max} آية؛ المرجع «${raw}» خارج هذا النطاق.` };
  }
  const key = from === to ? `${surah}:${from}` : `${surah}:${from}-${to}`;
  return { ok: true, ref: { surah, surahName, from, to, key } };
};

/** أسماء السور بالحروف اللاتينية (نقل صوتي شائع) لبطاقات الحلقات غير العربية. */
export const SURAH_NAMES_LATIN: readonly string[] = [
  "Al-Fatihah",
  "Al-Baqarah",
  "Ali 'Imran",
  "An-Nisa",
  "Al-Ma'idah",
  "Al-An'am",
  "Al-A'raf",
  "Al-Anfal",
  "At-Tawbah",
  "Yunus",
  "Hud",
  "Yusuf",
  "Ar-Ra'd",
  "Ibrahim",
  "Al-Hijr",
  "An-Nahl",
  "Al-Isra",
  "Al-Kahf",
  "Maryam",
  "Taha",
  "Al-Anbiya",
  "Al-Hajj",
  "Al-Mu'minun",
  "An-Nur",
  "Al-Furqan",
  "Ash-Shu'ara",
  "An-Naml",
  "Al-Qasas",
  "Al-'Ankabut",
  "Ar-Rum",
  "Luqman",
  "As-Sajdah",
  "Al-Ahzab",
  "Saba",
  "Fatir",
  "Ya-Sin",
  "As-Saffat",
  "Sad",
  "Az-Zumar",
  "Ghafir",
  "Fussilat",
  "Ash-Shura",
  "Az-Zukhruf",
  "Ad-Dukhan",
  "Al-Jathiyah",
  "Al-Ahqaf",
  "Muhammad",
  "Al-Fath",
  "Al-Hujurat",
  "Qaf",
  "Adh-Dhariyat",
  "At-Tur",
  "An-Najm",
  "Al-Qamar",
  "Ar-Rahman",
  "Al-Waqi'ah",
  "Al-Hadid",
  "Al-Mujadilah",
  "Al-Hashr",
  "Al-Mumtahanah",
  "As-Saff",
  "Al-Jumu'ah",
  "Al-Munafiqun",
  "At-Taghabun",
  "At-Talaq",
  "At-Tahrim",
  "Al-Mulk",
  "Al-Qalam",
  "Al-Haqqah",
  "Al-Ma'arij",
  "Nuh",
  "Al-Jinn",
  "Al-Muzzammil",
  "Al-Muddaththir",
  "Al-Qiyamah",
  "Al-Insan",
  "Al-Mursalat",
  "An-Naba",
  "An-Nazi'at",
  "'Abasa",
  "At-Takwir",
  "Al-Infitar",
  "Al-Mutaffifin",
  "Al-Inshiqaq",
  "Al-Buruj",
  "At-Tariq",
  "Al-A'la",
  "Al-Ghashiyah",
  "Al-Fajr",
  "Al-Balad",
  "Ash-Shams",
  "Al-Layl",
  "Ad-Duha",
  "Ash-Sharh",
  "At-Tin",
  "Al-'Alaq",
  "Al-Qadr",
  "Al-Bayyinah",
  "Az-Zalzalah",
  "Al-'Adiyat",
  "Al-Qari'ah",
  "At-Takathur",
  "Al-'Asr",
  "Al-Humazah",
  "Al-Fil",
  "Quraysh",
  "Al-Ma'un",
  "Al-Kawthar",
  "Al-Kafirun",
  "An-Nasr",
  "Al-Masad",
  "Al-Ikhlas",
  "Al-Falaq",
  "An-Nas",
];

/** اسم السورة بلغة الحلقة: عربي للعربية، ونقل صوتي لاتيني لغيرها. */
export const surahNameFor = (surah: number, lang: string) => (lang === "ar" ? SURAH_NAMES[surah - 1] : SURAH_NAMES_LATIN[surah - 1]) ?? "";
