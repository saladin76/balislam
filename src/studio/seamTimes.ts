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

/** One row of the seam report in step ٣ (owner, 16 Nov): the silence between the last word and the next first word. */
export type SeamReportRow = { seam: string; gap: number | null; target: number | null; kept?: string; over?: string };
export type SeamReport = {
  /** assembly: the joins of the assembled file itself; legacy: the file was assembled before the joins (re-assemble) */
  source: "assembly" | "legacy";
  pause: { id: string; nameAr: string };
  tolerance: number;
  rows: SeamReportRow[];
  loudness?: { target: number | null; adjusted: number };
};

/** Server-only: the report for the assembled file on disk (its record), or the plan's joins marked «legacy». */
export const assemblySeamReport = async (episode: string, scriptPath: string, plan: Plan, seams: string[]): Promise<SeamReport> => {
  const { readSeamsRecord } = await import("./seamsRecord");
  const { SEAM, seamPlan } = await import("../plan/seams");
  const { loadPace } = await import("../voice/paceFile");
  const { PAUSES, pauseOf } = await import("../voice/pace");
  const pid = pauseOf(await loadPace(scriptPath));
  const pause = { id: pid, nameAr: PAUSES[pid].nameAr };
  const rec = await readSeamsRecord(scriptPath);
  const row = (x: { from: string; to: string; gap: number | null; target: number | null; kept?: string; over?: string }): SeamReportRow =>
    ({ seam: `${x.from}>${x.to}`, gap: x.gap, target: x.target, ...(x.kept ? { kept: x.kept } : {}), ...(x.over ? { over: x.over } : {}) });
  if (rec) return { source: "assembly", pause, tolerance: SEAM.toleranceSec, rows: rec.seams.map(row).filter((r) => seams.includes(r.seam)),
    loudness: { target: rec.loudness.target, adjusted: Object.keys(rec.loudness.gain).length } };
  // Assembled before the joins: what the scenes put one after another sound like (each seam's stacked silence)
  const { collectMedia } = await import("../plan/collect");
  const media = await collectMedia(episode, plan);
  const list = plan.chapters.flatMap((c) => c.scenes);
  const rows = seamPlan(list, media, { channelId: plan.channel }).map((x) => row({ ...x, gap: x.stacked,
    over: !x.kept && x.stacked !== null && x.target !== null && x.stacked > x.target + SEAM.toleranceSec ? "جُمعت قبل وصل السرد: أعد الدمج" : x.over }));
  return { source: "legacy", pause, tolerance: SEAM.toleranceSec, rows: rows.filter((r) => seams.includes(r.seam)) };
};
