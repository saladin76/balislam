/**
 * Studio V2 Phase D: server-side scene order and sound requirements derived
 * from the owning episode's real plan.json. Read under the SAME shared writer
 * lock as every plan edit and render. No browser JSON, no legacy migration.
 *
 * This module is read-only. It does not approve content or infer that an MP4
 * contains an audio track. Silent visual scenes remain valid production units.
 */
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { resolveArtifact } from "./artifacts.ts";
import type { WorkflowIdentity } from "./store.ts";
import type { SceneArtifactLockV2 } from "./sceneArtifactsV2.ts";

export type PlannedSceneV2 = {
  id: string;
  chapter: number;
  /** Narrator audio is needed only when there is spoken scene text. */
  narratorRequired: boolean;
  /** Human recitation is needed when a real Quran verse is specified. */
  recitationRequired: boolean;
};
export type PlannedSceneOrderV2 = {
  sceneOrder: string[];
  scenes: PlannedSceneV2[];
};

const sceneIdPattern = /^c([1-9][0-9]*)-(?:s|v)[0-9]+$/;

const inspect = (value: unknown, scope: WorkflowIdentity): PlannedSceneOrderV2 => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Studio V2 requires a valid episode plan.");
  const plan = value as Record<string, unknown>;
  const number = scope.episode.slice(0, 3);
  if (plan.version !== 1 || plan.episode !== number ||
      (plan.channel !== undefined && plan.channel !== scope.channel) ||
      !Array.isArray(plan.chapters) || plan.chapters.length === 0)
    throw Error("Studio V2 plan is not the locked channel/episode source.");

  const scenes: PlannedSceneV2[] = [];
  const ids = new Set<string>();
  const chapters = new Set<number>();
  for (const block of plan.chapters) {
    if (!block || typeof block !== "object" || Array.isArray(block))
      throw Error("Malformed Storyboard chapter.");
    const chapter = block as Record<string, unknown>;
    const n = chapter.number;
    if (!Number.isSafeInteger(n) || (n as number) < 1 || chapters.has(n as number) ||
        !Array.isArray(chapter.scenes) || chapter.scenes.length === 0)
      throw Error("Invalid or duplicate chapter in the scene order.");
    chapters.add(n as number);
    for (const item of chapter.scenes) {
      if (!item || typeof item !== "object" || Array.isArray(item))
        throw Error("Malformed scene in Studio plan.");
      const scene = item as Record<string, unknown>;
      if (typeof scene.id !== "string" || !sceneIdPattern.test(scene.id) ||
          Number(scene.id.match(sceneIdPattern)?.[1]) !== n ||
          ids.has(scene.id) || typeof scene.narration !== "string" ||
          (scene.ayahKey !== undefined && (
            typeof scene.ayahKey !== "string" ||
            !/^[1-9][0-9]{0,2}:[1-9][0-9]{0,2}$/.test(scene.ayahKey)
          )))
        throw Error("Malformed, duplicate or chapter-mismatched scene.");
      ids.add(scene.id);
      scenes.push({
        id: scene.id, chapter: n as number,
        narratorRequired: Boolean(scene.narration.trim()),
        recitationRequired: typeof scene.ayahKey === "string",
      });
      if (scenes.length > 1000) throw Error("Too many scenes in one episode.");
    }
  }
  return { sceneOrder: scenes.map((scene) => scene.id), scenes };
};

export const readPlannedSceneOrderV2 = async (
  scope: WorkflowIdentity, withArtifactLock: SceneArtifactLockV2,
): Promise<PlannedSceneOrderV2> => {
  if (typeof withArtifactLock !== "function")
    throw Error("Studio V2 plan reader requires the shared artifact writer lock.");
  return withArtifactLock(async () => {
    const file = await resolveArtifact(scope, "plan.json");
    const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    let contents: string;
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.nlink !== 1 || stat.size > 20_000_000)
        throw Error("Studio V2 plan must be a regular, episode-owned file under 20 MB.");
      contents = await handle.readFile("utf8");
    } finally {
      await handle.close();
    }
    let parsed: unknown;
    try { parsed = JSON.parse(contents); }
    catch { throw Error("Malformed Studio V2 plan JSON."); }
    return inspect(parsed, scope);
  });
};
