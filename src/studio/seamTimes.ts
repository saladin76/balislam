/**
 * Where each scene-to-scene seam falls in the assembled episode (funnel audit item 11). The assembly is
 * the approved scene cuts concatenated in order (assembleScenes.ts), so a seam "a>b" sits at the sum of
 * the real durations of every cut up to and including "a". Read-only: used by the Studio to jump the
 * player to a seam the owner is checking; it never marks a seam checked and never touches the ledger.
 */
import type { Plan } from "../plan/types";

/** {seam: seconds} — empty when any duration before a seam is unknown (no guessed times). */
export const seamTimesFrom = (seams: string[], sceneSeconds?: Record<string, number>): Record<string, number> => {
  if (!sceneSeconds) return {};
  const out: Record<string, number> = {};
  let t = 0;
  for (const seam of seams) {
    const [a] = seam.split(">");
    const d = a ? sceneSeconds[a] : undefined;
    if (!d || !Number.isFinite(d) || d <= 0) return {};
    t += d;
    out[seam] = Math.round(t * 100) / 100;
  }
  return out;
};

/** Server-only: real cut durations from disk (only while the assembled file exists). */
export const assemblySeamTimes = async (scriptPath: string, plan: Plan, seams: string[]) => {
  const { realEpisodeTimings } = await import("../package/realTimings");
  return seamTimesFrom(seams, (await realEpisodeTimings(scriptPath, plan)).sceneSeconds);
};
