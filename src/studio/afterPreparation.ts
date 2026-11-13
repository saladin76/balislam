/**
 * «تحديث بعد التجهيز» (owner decision 11 Nov 2026, all channels; supersedes the re-approval parts of D60/D65/D66).
 *
 * «اعتمد التجهيز» happens once per episode. Afterwards a change to the script or the storyboard (a board, a scene's
 * text, a verse/citation format made by a chat…) never asks for the boards, the storyboard or the script to be approved
 * again and never locks step ٢. The signed scene ledger records it as a system event that carries the script and
 * storyboard approvals forward to the new fingerprints (sceneService · carryForwardAfterPreparation), and exactly the
 * scenes whose inputs changed re-open for the owner's ordinary scene review in step ٢.
 *
 * What still refuses is scoped to the scene it concerns (`productionBlocks`): a verse card without its text, or a script
 * error on the narration of a scene, blocks producing THAT scene. A script error that belongs to no single scene
 * (structure, front matter…) blocks producing every scene that is not yet approved, and is shown once in step ٢.
 * These blocks apply only while an approval stands on the system's carry-forward (the owner's own «اعتمد التجهيز»
 * already refused errors before it was given).
 */
import { readFile } from "node:fs/promises";
import { parseScript } from "../script/parse";
import { checkForChannel } from "../script/checkChannel";
import type { Plan } from "../plan/types";
import { versesMissingText } from "../plan/storyboard";
import { DIVERGED_SCENE, scriptTextDivergence, unplacedLine } from "../plan/scriptSync";

/**
 * QA balislam 2 (12 Nov): the script and a scene's narration say different text. Always applied (not only after a
 * carry-forward): what is produced must be what was approved. A differing scene is blocked alone; script text that
 * no scene says blocks every scene not yet approved (shown once).
 */
export const textBlocks = async (scriptPath: string, plan: Plan): Promise<ProductionBlocks> => {
  const scenes: Record<string, string[]> = {};
  const episode: string[] = [];
  try {
    const d = await scriptTextDivergence(scriptPath, plan);
    for (const id of d.scenes) scenes[id] = [DIVERGED_SCENE];
    if (d.unplaced.length) episode.push(unplacedLine(d.unplaced));
  } catch (error) {
    episode.push(`تعذّر مقارنة السكريبت باللوحات: ${(error as Error).message}`);
  }
  return { scenes, episode };
};
const mergeBlocks = (a: ProductionBlocks, b: ProductionBlocks): ProductionBlocks => {
  const scenes: Record<string, string[]> = { ...a.scenes };
  for (const [id, why] of Object.entries(b.scenes)) scenes[id] = [...(scenes[id] ?? []), ...why];
  return { scenes, episode: [...a.episode, ...b.episode] };
};

/** The ledger's history action of the system event. Never an owner command (not in SCENE_ACTIONS). */
export const AFTER_PREPARATION_ACTION = "update-after-preparation" as const;

/** What changed in a re-opened scene: its board (picture/sentence), its narration, a new scene, or other inputs. */
export type AfterPreparationWhat = "board" | "text" | "new" | "inputs";
export type AfterPreparationChange = {
  /** Which sources changed: the script file, the board record. */
  source: ("script" | "boards")[];
  script?: { from: string | null; to: string };
  storyboard?: { from: string | null; to: string };
  scenes: { id: string; what: AfterPreparationWhat[]; from: string | null; to: string }[];
};

export type ProductionBlocks = { scenes: Record<string, string[]>; episode: string[] };
export const NO_BLOCKS: ProductionBlocks = { scenes: {}, episode: [] };

const norm = (t: string) => t.replace(/[ً-ْٰـ]/g, "").replace(/\s+/g, " ").trim();

export const productionBlocks = async (scriptPath: string, plan: Plan): Promise<ProductionBlocks> =>
  mergeBlocks(await scriptBlocks(scriptPath, plan), await textBlocks(scriptPath, plan));

const scriptBlocks = async (scriptPath: string, plan: Plan): Promise<ProductionBlocks> => {
  const scenes: Record<string, string[]> = {};
  const add = (id: string, why: string) => { (scenes[id] ??= []).push(why); };
  for (const id of versesMissingText(plan)) add(id, "آية بلا نصها: اكتب نص الآية في سطرها في السكريبت.");
  const episode: string[] = [];
  try {
    const parsed = parseScript(await readFile(scriptPath, "utf8"), scriptPath);
    const errors = checkForChannel(parsed).issues.filter((i) => i.level === "error");
    if (!errors.length) return { scenes, episode };
    const blocks = parsed.chapters.flatMap((c) => c.blocks);
    const narrated = plan.chapters.flatMap((c) => c.scenes).filter((s) => s.narration?.trim());
    for (const issue of errors) {
      const block = issue.line === undefined ? undefined : blocks.find((b) => b.line === issue.line);
      const text = block && (block.kind === "narration" || block.kind === "bridge") ? norm(block.text) : "";
      const hit = text ? narrated.filter((s) => { const n = norm(s.narration); return n && (text.includes(n) || n.includes(text)); }) : [];
      if (hit.length) for (const s of hit) add(s.id, `خطأ في السكريبت (سطر ${issue.line}): ${issue.message}`);
      else episode.push(`خطأ في السكريبت${issue.line ? ` (سطر ${issue.line})` : ""}: ${issue.message}`);
    }
  } catch (error) {
    episode.push(`تعذّر فحص السكريبت: ${(error as Error).message}`);
  }
  return { scenes, episode };
};
