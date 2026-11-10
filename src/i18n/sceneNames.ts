/**
 * Scene names the owner reads (funnel audit item 11), shared by the Studio page AND the server: «المشهد ٣»
 * by its place in the episode (every scene of the plan, verse cards included, in order), never the technical
 * id («c1-s3»), with Arabic digits. The app's `app/src/workspace/sceneNames.ts` re-exports these, so a server
 * message and the screen always give a scene the same number (funnel QA, 10 Nov: dafatir said «c1-s2» where
 * the UI said «المشهد ٣»).
 */
import type { Plan } from "../plan/types";

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
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
export const arDigits = (s: string) => s.replace(/\d/g, (d) => AR_DIGITS[Number(d)]!);
/** ٧٢٫٤ ← «١:١٢» */
export const clockAr = (sec: number) => {
  const t = Math.max(0, Math.floor(sec || 0));
  return `${arNum(Math.floor(t / 60))}:${arDigits(String(t % 60).padStart(2, "0"))}`;
};
/** Every scene id of the plan in episode order (the numbering the Studio shows). */
export const planOrder = (plan: Pick<Plan, "chapters"> | null | undefined): string[] =>
  plan?.chapters.flatMap((c) => c.scenes.map((s) => s.id)) ?? [];
/** «المشهد ٣، المشهد ٥» (first `max`, then «…»). */
export const sceneNames = (order: string[], ids: string[], max = 12): string =>
  ids.slice(0, max).map((id) => sceneName(order, id)).join("، ") + (ids.length > max ? "…" : "");
/**
 * A server message as the owner reads it: every known scene id («c1-s3», «c1-s3>c1-s4») becomes its name.
 * Unknown ids are left as they are (never a wrong number).
 */
export const nameSceneIds = (message: string, order: string[]): string =>
  message
    .replace(/\b(c\d+-s\d+[a-z0-9-]*)>(c\d+-s\d+[a-z0-9-]*)\b/g, (m, a: string, b: string) => (order.includes(a) && order.includes(b) ? seamName(order, `${a}>${b}`) : m))
    .replace(/(?<![\w-])(c\d+-s\d+(?:-[a-z0-9]+)*)(?![\w-])/g, (m, id: string) => (order.includes(id) ? sceneName(order, id) : m));
