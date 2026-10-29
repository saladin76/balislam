export type ThemeId = "paper" | "family" | "night" | "warm";
/** معرّف المجال، تحدده كل قناة في channel.json (مثل psychology لقناة بالإسلام). */
export type Domain = string;

export type Theme = {
  id: ThemeId;
  nameAr: string;
  domain: Domain;
  domainAr: string;
  colors: {
    /** خلفية المشهد */
    bg: string;
    /** خلفية البطاقات فوق الخلفية */
    surface: string;
    /** لون النص الأساسي */
    ink: string;
    /** نص ثانوي */
    inkSoft: string;
    /** اللون الأساسي للثيم */
    primary: string;
    /** اللون الثانوي */
    secondary: string;
    /** خلفية الكلمة المميزة في الترجمة */
    highlight: string;
    /** لون النص فوق الكلمة المميزة */
    onHighlight: string;
    /** خلفية شريط الترجمة */
    captionBg: string;
    /** نص شريط الترجمة */
    captionInk: string;
  };
  logo: { tile: string; baa: string; play: string };
  character: {
    /** line = رسم خطي بحبر، flat = مسطح ملون */
    style: "line" | "flat";
    outline: string;
    skin: [string, string];
    /** ألوان الثياب بالترتيب: الراوي، الراوية، الطفل، الكبير، الكبيرة */
    garments: [string, string, string, string, string];
    cap: string;
  };
  motif: "ink-lines" | "house-circles" | "stars" | "arches";
};
