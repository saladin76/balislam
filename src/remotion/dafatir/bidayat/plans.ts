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
