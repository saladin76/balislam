/**
 * قوالب سلسلة «البدايات» ولقطاتها وحقول كل لقطة (بلا React ولا three: يقرؤها مولّد الخطة والاستوديو). D209.
 * قاعدة «لكل سلسلة قوالبها» (عمود السلاسل، D202): مجموعة قوالب من عالم «خطوط على الأرض» (D203)، لا قالب واحد.
 * التوقير (أشد في هذه السلسلة): لا تصوير لنبي ولا ملَك ولا لإبليس بأي هيئة (لا شخص ولا ظل ولا أثر قدم ولا ضوء يقوم مقامه)؛
 * القصة بالأرض والطين والماء والضوء والحجر والنص وحدها.
 */
export type BidTemplateId = "bidayat-shore" | "bidayat-line" | "bidayat-strata" | "bidayat-clay" | "bidayat-stone";
export type BidShotId =
  | "horizon" | "shore" | "aerial"
  | "line" | "fan" | "circles"
  | "strata"
  | "clay" | "clay-shore"
  | "verse" | "words" | "scale" | "paths";
/** حقول مشتركة في كل القوالب: الكلمة المكتوبة في الرمل وختم «درجة الثبوت» */
const MARK = ["mark", "markWord", "stamp", "stampWord"];
export const BID_TEMPLATES: Record<BidTemplateId, { nameAr: string; useAr: string; shots: Partial<Record<BidShotId, { nameAr: string; fields: string[] }>> }> = {
  "bidayat-shore": {
    nameAr: "البدايات: الشاطئ والأفق",
    useAr: "شاطئ بكر وماء بانعكاس وشمس تشرق على مدار الحلقة: الأفق الواسع، أو حافة الماء والموج، أو الشاطئ من علٍ؛ وكلمة تُكتب في الرمل المبلول عند نطقها، وختم «درجة الثبوت» عند كلمته",
    shots: {
      horizon: { nameAr: "الأفق: ماء وسماء وشمس (واسعة)", fields: MARK },
      shore: { nameAr: "حافة الماء: موج ورمل مبلول (متوسطة)", fields: MARK },
      aerial: { nameAr: "من علٍ: الحلزون في الماء (ختام)", fields: MARK },
    },
  },
  "bidayat-line": {
    nameAr: "البدايات: خط على الأرض",
    useAr: "الحجر يُوضع حجرًا حجرًا: خط يمتد نحو الأفق وعليه خيط الزمن الأحمر بعقدته، أو خطوط تتفرع من حجر واحد (النسل والأمم)، أو دوائر حجارة قرى ثم مدينة ببابها",
    shots: {
      line: { nameAr: "خط الحجارة وخيط الزمن والعقدة", fields: ["lineWord", "knotWord", ...MARK] },
      fan: { nameAr: "خطوط تتفرع من حجر واحد", fields: ["lineWord", "branchWords", ...MARK] },
      circles: { nameAr: "دوائر الحجارة: القرى ثم المدينة", fields: ["villageWord", "cityWord", ...MARK] },
    },
  },
  "bidayat-strata": {
    nameAr: "البدايات: تحت الرمل",
    useAr: "«ما ثبت وما لا نعلم»: الكاميرا تنزل تحت رمل المكان نفسه فتظهر طبقات الأرض، وبجوار كل طبقة ختم «درجة الثبوت» (ثابت، رواية، لا نعلم) عند كلمته",
    shots: { strata: { nameAr: "طبقات الأرض وأختامها", fields: ["descendWord", "provenWord", "reportWord", "unknownWord"] } },
  },
  "bidayat-clay": {
    nameAr: "البدايات: حفنة الطين",
    useAr: "القطعة المخصوصة: حفنة طين مبلل على حافة الماء بأثر الأنامل وشقوق الحافة ولمعة البلل وأثر الماء حولها؛ بسكون تام في جملة الذكر",
    shots: {
      clay: { nameAr: "الحفنة عن قرب (ساكنة)", fields: [] },
      "clay-shore": { nameAr: "الحفنة على حافة الماء والأفق خلفها", fields: [] },
    },
  },
  "bidayat-stone": {
    nameAr: "البدايات: لوح الحجر",
    useAr: "حجر مسطح على الرمل: نص الآية يُكتب عليه بالحبر في سكون (مشهد الآية)، أو كلمات على حصى تظهر عند نطقها، أو ميزان من خشب الشاطئ بكفتين (نار وطين) وختم، أو طريقان من حجر يفترقان (إصرار ورجوع)",
    shots: {
      verse: { nameAr: "الآية على لوح الحجر (ساكنة)", fields: ["verseText", "verseFrom", "ref"] },
      words: { nameAr: "كلمات على الحصى", fields: ["items"] },
      scale: { nameAr: "الميزان: كفتان وختم", fields: ["aText", "aWord", "bText", "bWord", "verdictText", "verdictWord"] },
      paths: { nameAr: "طريقان يفترقان", fields: ["aText", "aWord", "bText", "bWord"] },
    },
  },
};
/** أختام «درجة الثبوت» (العمود، رابعًا) */
export const BID_STAMPS = ["ثابت", "رواية", "تقدير", "لا نعلم"] as const;
export type BidStamp = (typeof BID_STAMPS)[number];
export const isBidTemplate = (id: string): id is BidTemplateId => id in BID_TEMPLATES;
/** نبرة الترجمة لكل لقطة: حبر داكن بهالة فاتحة على الرمل والحجر الفاتح، ونص فاتح بحد داكن تحت الرمل وعلى الماء */
export const BID_CAPTION_TONE: Record<BidShotId, "ink" | "light"> = {
  horizon: "light", shore: "ink", aerial: "ink", line: "ink", fan: "ink", circles: "ink", strata: "light",
  clay: "ink", "clay-shore": "ink", verse: "ink", words: "ink", scale: "ink", paths: "ink",
};
