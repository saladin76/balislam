/**
 * Work ٨ (the large-file split): a panel that was one file is now its entry file plus a folder of parts (its hook
 * and one component per visible part). A test that reads the panel's source reads the whole family, the entry
 * first and then its parts in name order, so a rule checked on the source keeps covering the same code.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(__dirname, "..", "..");
/** Entry file (relative to the repo) → the folder its parts moved to. */
export const PANEL_PARTS: Record<string, string> = {
  "app/src/workspace/SceneProductionPanel.tsx": "app/src/workspace/sceneProduction",
  "app/src/workspace/SentencesPanel.tsx": "app/src/workspace/sentences",
};

const rel = (p: string) => path.relative(ROOT, path.resolve(ROOT, p)).split(path.sep).join("/");

/** The panel's source with its parts (any other file: itself). Accepts a repo-relative or absolute path. */
export const panelSource = (file: string): string => {
  const entry = rel(file);
  const text = readFileSync(path.join(ROOT, entry), "utf8");
  const dir = PANEL_PARTS[entry];
  if (!dir) return text;
  let parts: string[] = [];
  try { parts = readdirSync(path.join(ROOT, dir)).filter((n) => /\.tsx?$/.test(n)).sort(); } catch { /* not split yet */ }
  return [text, ...parts.map((n) => readFileSync(path.join(ROOT, dir, n), "utf8"))].join("\n");
};
