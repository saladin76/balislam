/**
 * Script and storyboard say the same text (QA balislam 2, 12 Nov 2026).
 *
 * A designed plan is never rewritten from the script (D46: a designed scene may split or join paragraphs, so the
 * mapping is not certain). The two can therefore drift: a script save that changes a designed scene's words does not
 * reach the board, and the old words would be voiced. This module says where they differ, in the same terms as the
 * script-save message (`scriptPlanDivergence`):
 *   - a scene whose narration no longer occurs in the script's text, and
 *   - script text that no scene says (by script line).
 * Before «اعتمد التجهيز» any difference refuses the approval (src/studio/preparation.ts). After it, a differing scene
 * cannot be produced (voice or render) until the script and the scene say the same thing (src/studio/afterPreparation.ts
 * · productionBlocks); script text that belongs to no scene blocks every scene not yet approved, like a script error
 * that belongs to no scene. Studio edits of a scene's text are written back to script.md (src/script/narrationSync.ts),
 * so the ordinary path never drifts.
 */
import type { Plan } from "./types";
import { scriptPlanDivergence } from "./designed";
import { planFromScriptOnly } from "./io";

export type TextDivergence = { scenes: string[]; unplaced: number[] };
export const NO_DIVERGENCE: TextDivergence = { scenes: [], unplaced: [] };

export const scriptTextDivergence = async (scriptPath: string, plan: Plan): Promise<TextDivergence> => {
  const fromScript = await planFromScriptOnly(scriptPath);
  const d = scriptPlanDivergence(plan, fromScript);
  return { scenes: d.scenes.map((s) => s.id), unplaced: d.unplaced.map((u) => u.line) };
};

const ar = (n: number) => n.toLocaleString("ar-EG");
const sceneNo = (plan: Plan | null, id: string) => {
  const i = plan ? plan.chapters.flatMap((c) => c.scenes).findIndex((s) => s.id === id) : -1;
  return i >= 0 ? `المشهد ${ar(i + 1)}` : "مشهد";
};

/** One scene's block line (step ٢ shows it on that scene). */
export const DIVERGED_SCENE = "نص هذا المشهد في اللوحات يختلف عن السكريبت: عدّل نصه في «الجمل» أو صحّح السكريبت حتى يقولا الشيء نفسه.";
/** Script text no scene says (blocks every scene not yet approved, shown once). */
export const unplacedLine = (lines: number[]) =>
  `نص في السكريبت لا يقوله أي مشهد (السطر ${lines.slice(0, 6).map(ar).join("، ")}${lines.length > 6 ? "…" : ""}): أضفه إلى مشهده أو احذفه من السكريبت.`;

export const textDivergenceRefusal = (d: TextDivergence, plan: Plan | null = null) => {
  const parts: string[] = [];
  if (d.scenes.length) parts.push(`نص ${d.scenes.length === 1 ? "مشهد" : `${ar(d.scenes.length)} مشاهد`} في اللوحات يختلف عن السكريبت (${d.scenes.slice(0, 6).map((id) => sceneNo(plan, id)).join("، ")}${d.scenes.length > 6 ? "…" : ""})`);
  if (d.unplaced.length) parts.push(`ونص في السكريبت لا يقوله أي مشهد (السطر ${d.unplaced.slice(0, 6).map(ar).join("، ")}${d.unplaced.length > 6 ? "…" : ""})`);
  return `لا يُعتمد التجهيز والسكريبت واللوحات مختلفان: ${parts.join(" ")}. ما يُعتمد يجب أن يكون ما يُنطق: عدّل نص المشهد أو السكريبت حتى يتطابقا، ثم اعتمد.`;
};
