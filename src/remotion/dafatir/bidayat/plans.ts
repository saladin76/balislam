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
 * مشاهد حذفتها مراجعة المتخصص (الدفعة ٥، ٢٤ نوفمبر) من سكريبتات 002–004 ولم تُحدَّث خططها بعد: لا تُبنى لها لقطة ولا تُبقى.
 * 002: رواية النار، والاسمان، والحجر، و«لم يكن على الأرض قبر بعد»، والمكان، وأبيات الرثاء المنحولة.
 * 003: شيث كله، وموضع إدريس على الخيط («تقدير»)، و«أول من خطّ بالقلم وخاط».
 * 004: «هذا الطريق تكرر في أمم كثيرة».
 */
export const BD_WITHDRAWN: Record<string, { scenes: string[]; shots: string[] }> = {
  "002": { scenes: ["c1-s13", "c1-s14", "c1-s15", "c1-s16", "c1-s29", "c1-s36", "c1-s43", "c1-s44", "c1-s45"], shots: ["bd02-side-note", "bd02-names-wash", "bd02-place-slip", "bd02-forged-verse"] },
  "003": { scenes: ["c1-s22", "c1-s23", "c1-s33", "c1-s34", "c1-s35"], shots: ["bd03-name-slip", "bd03-placement", "bd03-reed-pen"] },
  "004": { scenes: ["c1-s32"], shots: ["bd04-repeat-path"] },
};
/** صفوف الخطة الباقية بعد مراجعة المتخصص */
export const activeRows = (ep: string, rows: BdPlanRow[]) => rows.filter((r) => !BD_WITHDRAWN[ep]?.scenes.includes(r.id));
