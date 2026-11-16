/**
 * KI-066: the line beside the scene's player when a sentence take is not in its video yet (the same in the three
 * channels). Pure: no React, no server call.
 */
import type { SceneProductionRead } from "../../api";

export type NewerTake = NonNullable<SceneProductionRead["scenes"][number]["newerTake"]>;
export const NEWER_TAKE_PRODUCE = "فيه تسجيل جديد لم يدخل الفيديو — اضغط «أنتج هذا المشهد»";
const ar = (n: number) => n.toLocaleString("ar-EG");
const which = (ns: number[]) => (ns.length === 1 ? `الجملة ${ar(ns[0]!)}` : `الجمل ${ns.map(ar).join("، ")}`);

export const newerTakeLine = (n: NewerTake): string =>
  n.state === "produce" ? NEWER_TAKE_PRODUCE
    : `فيه تسجيل جديد لم يدخل الفيديو — يدخله «أنتج هذا المشهد» حين يكون لكل جمل المشهد تسجيل حالي: ${which(n.missing)} بلا تسجيل حالي؛ ولّدها أولًا.`;
