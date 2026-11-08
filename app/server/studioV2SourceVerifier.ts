/**
 * Concrete source prerequisites for Studio V2. Runs ONLY within the shared
 * episode artifact lock; no browser "validated" flags, external URLs or
 * uploaded reviewer names are used as independent evidence.
 *
 * Semantic human review is read from the current source ledger. A reviewer
 * signature in a legacy file is NOT automatically promoted to V2 ownership.
 */
import path from "node:path";
import { readFile } from "node:fs/promises";
import type { WorkflowIdentity } from "../../src/workflow/index.ts";

type Loader = <T = any>(file: string) => Promise<T>;
export const verifyStudioV2Sources = async (
  scope: WorkflowIdentity, load: Loader, stage: "script" | "storyboard" = "storyboard",
) => {
  const dir = path.join(scope.channelsRoot, scope.channel, "episodes", scope.episode);
  const scriptPath = path.join(dir, "script.md");
  const text = await readFile(scriptPath, "utf8");
  const { parseScript } = await load("/src/script/parse.ts");
  const { checkForChannel } = await load("/src/script/checkChannel.ts");
  const { loadLedger, reviewItems, reviewSummary } = await load("/src/script/review.ts");
  const parsed = parseScript(text, scriptPath);
  const checked = checkForChannel(parsed);
  if (!checked?.ok)
    throw Error("Script validation failed; current episode text is not production-ready.");
  const references = reviewSummary(reviewItems(parsed, await loadLedger(scriptPath)));
  if (!references.ok)
    throw Error("Source/verse/hadith references require current human verification.");
  if (stage === "script") return;

  const { readPlannedSceneOrderV2 } = await load("/src/workflow/scenePlanV2.ts");
  await readPlannedSceneOrderV2(scope, async (work: () => Promise<unknown>) => work());
  const plan: unknown = JSON.parse(await readFile(path.join(dir, "plan.json"), "utf8"));
  const { planIssues } = await load("/src/plan/validate.ts");
  const { loadChannel } = await load("/src/channel/index.ts");
  if (planIssues(plan, loadChannel(scope.channel)).some((item: { level: string }) => item.level === "error"))
    throw Error("Storyboard plan has blocking scene/verse/design validation errors.");
  const { loadStoryboard, storyboardStatus } = await load("/src/plan/storyboard.ts");
  const { checkVisualStoryboardSignoff } = await load("/src/plan/storyboardVisualGate.ts");
  const record = await loadStoryboard(scriptPath);
  const status = storyboardStatus(plan, record);
  if (!status.ok || !status.approvedAt || !status.audit)
    throw Error("Every current Storyboard scene needs an explicit illustrated-board signoff.");
  const visual = checkVisualStoryboardSignoff(plan, status.audit.note);
  if (!visual.ok)
    throw Error("Storyboard owner visual-audit evidence is incomplete.");
};
