/**
 * قراءة خطة مشاهد «خط الأفق» من scenes.md لحلقات «البدايات» (D214): صفوف الجدول التي لقطتها جديدة (bdNN-…)
 * بجملتها من السكريبت حرفيًا. نقي بلا ملفات: يستعمله الاختبار (tests/horizon-bidayat.test.tsx) وأداة الصور الثابتة للمراجعة.
 */
export type BdPlanRow = { id: string; shot: string; narration: string };

export const parseBidayatPlan = (md: string): BdPlanRow[] => {
  const start = md.indexOf("## خطة المشاهد بشكل");
  if (start < 0) return [];
  const rest = md.slice(start + 5);
  const stop = rest.search(/\n## /);
  const body = stop < 0 ? rest : rest.slice(0, stop);
  const rows: BdPlanRow[] = [];
  for (const line of body.split("\n")) {
    const m = line.match(/^\|\s*(c\d+-s\d+)\s*\|(.*?)\|(.*?)\|/);
    if (!m) continue;
    const shot = m[3]!.match(/`(bd\d\d-[a-z0-9-]+)`/)?.[1];
    const cell = m[2]!;
    const a = cell.indexOf("«"), b = cell.lastIndexOf("»");
    if (!shot || a < 0 || b <= a) continue;
    rows.push({ id: m[1]!, shot, narration: cell.slice(a + 1, b).trim() });
  }
  return rows;
};

/**
 * لقطات حذفتها المراجعة العلمية (الدفعات ٥–٧، وقرار المالك ٢٥ نوفمبر): لا رسم لها ولا موضع في أي خطة، ويُختبر ذلك.
 * 002: النار، والاسمان، ومكان القتل، والأبيات المنحولة، والدفن. 003: شيث، وموضع إدريس عليه السلام على الخيط، والقلم والخياطة.
 * 004: قصة «رجال صالحين» بخطواتها (البند ١١٩) والسهم إلى قبائل العرب. 008: مخطط الجزيرة، والغراب والحمامة والزيتون، والبيت والحرث.
 * 009: الأسماء، والجهات، والإسناد، و«الباقون»، و«بيت واحد»؛ وبعد إعادة بنائه حول «ماذا بقي من نوح؟» (قرار المالك ٢٥ نوفمبر):
 * الخانات الثلاث، والأفق الجديد، والهامش و«ثلاثة فروع».
 */
export const BD_REMOVED: string[] = [
  "bd02-side-note", "bd02-names-wash", "bd02-place-slip", "bd02-forged-verse", "bd02-mound",
  "bd03-name-slip", "bd03-placement", "bd03-reed-pen",
  "bd04-repeat-path", "bd04-three-steps", "bd04-majlis", "bd04-five-stelae", "bd04-open-book-path", "bd04-closed-book",
  "bd04-stele-erode", "bd04-unknown-form", "bd04-knowledge-guard", "bd04-far-arrow",
  "bd08-tafsir-sketch", "bd08-pale-margin", "bd08-symbol-copies", "bd08-no-foundation", "bd08-before-house",
  "bd09-names", "bd09-compass", "bd09-isnad", "bd09-baqiya", "bd09-one-house", "bd09-blanks", "bd09-new-start", "bd09-margin",
];

/** لقطات تسمّيها الخطط ولم تُبنَ عمدًا: مشهدها بالكلمات وحدها (M4) حتى تُصمَّم. (لا شيء الآن.) */
export const BD_WORDS_ONLY: string[] = [];
/** صفوف الخطة التي لها لقطة مبنية */
export const builtRows = (rows: BdPlanRow[]) => rows.filter((r) => !BD_WORDS_ONLY.includes(r.shot));
