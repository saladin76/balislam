/** لقطات قالب «مكتب الرحّالة» وحقول كل لقطة (بلا React ولا three: يقرؤها مولّد الخطة والاستوديو). D194 */
export type RahhalaShotId = "astrolabe" | "map" | "city" | "document" | "desk";
export const RAHHALA_SHOTS: Record<RahhalaShotId, { nameAr: string; fields: string[] }> = {
  astrolabe: { nameAr: "الإسطرلاب: السنة", fields: ["year", "era", "yearWord"] },
  map: { nameAr: "الخريطة: الطريق من مكان إلى مكان", fields: ["mapTitle", "water", "fromPlace", "fromWord", "toPlace", "toWord"] },
  city: { nameAr: "المدينة المدوّرة ترتفع", fields: ["city", "cityWord"] },
  document: { nameAr: "الوثيقة والختم", fields: ["docTitle", "docLines", "docWrite", "docWord", "stamp", "stampWord"] },
  desk: { nameAr: "المكتب كله (ختام)", fields: [] },
};
/** القطع المخصوصة المتاحة (تُضاف قطعة لكل حلقة تحتاجها، بهوية القناة) */
export const RAHHALA_CITIES: Record<string, string> = { "round-city": "مدينة السلام المدوّرة (بغداد المنصور)" };

