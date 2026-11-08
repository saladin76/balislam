/**
 * Scene names the owner reads (funnel audit item 11): «المشهد ٣» by its place in the episode, never the
 * technical id («c1-s3»), with Arabic digits. Ids stay in titles/tooltips and in the server only.
 */
export const arNum = (n: number) => n.toLocaleString("ar-EG");
export const sceneNo = (order: string[], id?: string | null): number | null => {
  const i = id ? order.indexOf(id) : -1;
  return i >= 0 ? i + 1 : null;
};
export const sceneName = (order: string[], id?: string | null): string => {
  const n = sceneNo(order, id);
  return n ? `المشهد ${arNum(n)}` : "المشهد";
};
/** «c1-s3>c1-s4» → «المشهد ٣ ← ٤» */
export const seamName = (order: string[], seam: string): string => {
  const [a, b] = seam.split(">");
  const nb = sceneNo(order, b);
  return `${sceneName(order, a)} ← ${nb ? arNum(nb) : "التالي"}`;
};
/** ٧٢٫٤ ← «١:١٢» */
export const clockAr = (sec: number) => {
  const t = Math.max(0, Math.floor(sec || 0));
  return `${arNum(Math.floor(t / 60))}:${String(t % 60).padStart(2, "0").replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]!)}`;
};
