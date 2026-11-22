/**
 * Server-only (D191): the facts the nightly queue plans from, and the local files of the nightly summary and the weekly
 * review. Every fact comes from the signed «إنتاج المشاهد» ledger (`inspectSceneProduction`) and the episode's own files;
 * nothing here renders, generates voice, uploads or publishes.
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { channelPaths, listChannels, loadChannel, runWithChannel } from "../channel";
import { listScriptEpisodeDirs, resolveScriptPath } from "../script/episodes";
import { loadPlan } from "../plan/io";
import { shortSegments } from "../plan/shorts";
import { assemblyFile, masterFile } from "./sceneLedgerStore";
import { cleanSettings, type NightFacts, type NightRun, type NightSettings } from "./nightly";
import type { ChannelWeek, EpisodeAnalytics } from "./weekly";

const run = promisify(execFile);
const projectRoot = path.resolve(import.meta.dirname, "..", "..");
/** Local only (.studio/ is never committed): settings, the last run day, and the summaries */
export const nightlyDir = () => path.join(projectRoot, ".studio", "nightly");
export const weeklyDir = () => path.join(projectRoot, ".studio", "weekly");
export const analyticsDir = () => path.join(projectRoot, ".studio", "analytics");

const readJson = async <T>(f: string): Promise<T | null> => { try { return JSON.parse(await readFile(f, "utf8")) as T; } catch { return null; } };
const writeJson = async (f: string, v: unknown) => { await mkdir(path.dirname(f), { recursive: true }); await writeFile(f, JSON.stringify(v, null, 2) + "\n"); };

export const readNightSettings = async (): Promise<NightSettings> => cleanSettings(await readJson<Partial<NightSettings>>(path.join(nightlyDir(), "settings.json")));
export const saveNightSettings = async (s: Partial<NightSettings>) => { const c = cleanSettings(s); await writeJson(path.join(nightlyDir(), "settings.json"), c); return c; };
export const readLastDay = async () => (await readJson<{ day?: string }>(path.join(nightlyDir(), "last.json")))?.day ?? null;
export const markLastDay = async (day: string) => writeJson(path.join(nightlyDir(), "last.json"), { day });

/** The summary: dated file + «latest» (both on this machine only) */
export const saveNightRun = async (r: NightRun, md: string) => {
  const day = r.at.slice(0, 10);
  await writeJson(path.join(nightlyDir(), "latest.json"), r);
  await mkdir(nightlyDir(), { recursive: true });
  await writeFile(path.join(nightlyDir(), `summary-${day}.md`), md);
  await writeFile(path.join(nightlyDir(), "latest.md"), md);
};
export const readLatestNight = async () => ({
  run: await readJson<NightRun>(path.join(nightlyDir(), "latest.json")),
  markdown: existsSync(path.join(nightlyDir(), "latest.md")) ? await readFile(path.join(nightlyDir(), "latest.md"), "utf8") : null,
});

/** macOS `memory_pressure`: «System-wide memory free percentage: NN%»; null if it cannot be read */
export const parseFreePct = (out: string): number | null => {
  const m = out.match(/free percentage:\s*(\d+)%/i);
  return m ? Number(m[1]) : null;
};
export const freeMemoryPct = async (): Promise<number | null> => {
  try { return parseFreePct((await run("memory_pressure", [], { timeout: 20_000 })).stdout); } catch { return null; }
};

const mtime = async (f: string) => { try { return (await stat(f)).mtimeMs; } catch { return 0; } };

/** One episode's facts, from the signed ledger and its files (inside runWithChannel) */
const episodeFacts = async (channel: string, channelName: string, ep: string): Promise<NightFacts | null> => {
  const { inspectSceneProduction } = await import("./sceneService");
  let read: Awaited<ReturnType<typeof inspectSceneProduction>>;
  try { read = await inspectSceneProduction(ep); } catch { return null; }
  const p = read.progress;
  const scriptPath = await resolveScriptPath(ep);
  const plan = await loadPlan(ep).catch(() => null);
  const master = masterFile(scriptPath);
  const masterAt = await mtime(master), assemblyAt = await mtime(assemblyFile(scriptPath));
  const pkg = path.dirname(master);
  const shortsMade = existsSync(pkg) ? (await readdir(pkg)).filter((f) => /-short-\d+\.mp4$/.test(f)).length : 0;
  return {
    channel, channelName, episode: ep, title: plan?.title ?? ep,
    scenesTotal: p.totalScenes, unapproved: p.unapprovedScenes.length, recitationPending: p.recitationPending.length,
    assemblyApproved: p.assemblyApproved, masterApproved: p.masterApproved, publishAllowed: p.publishAllowed,
    masterFileFresh: masterAt > 0 && masterAt >= assemblyAt,
    shortsSelected: plan ? shortSegments(plan).segments.length : 0, shortsMade,
  };
};

/** Every episode of every channel on this machine */
export const gatherNightFacts = async (): Promise<NightFacts[]> => {
  const out: NightFacts[] = [];
  for (const id of listChannels()) {
    const name = loadChannel(id).name;
    for (const dir of await listScriptEpisodeDirs(channelPaths(id).episodes)) {
      const f = await runWithChannel(id, () => episodeFacts(id, name, dir.slice(0, 3)));
      if (f) out.push(f);
    }
  }
  return out;
};

/** Imported analytics: .studio/analytics/<channel>/<episode>.json (+ retention.csv beside it) */
export const analyticsFile = (channel: string, episode: string) => path.join(analyticsDir(), channel, `${episode}.json`);
export const retentionFile = (channel: string, episode: string) => path.join(analyticsDir(), channel, `${episode}-retention.csv`);
export const saveAnalytics = (a: EpisodeAnalytics) => writeJson(analyticsFile(a.channel, a.episode), a);

/** The week's data per channel: imported table data, and the retention export read by the D165 reader */
export const gatherWeek = async (): Promise<ChannelWeek[]> => {
  const { analyseRetention, parseRetention } = await import("../analytics/retention");
  const { sceneStartsFor } = await import("../package/chapters");
  const { channelInfo } = await import("../channel");
  const out: ChannelWeek[] = [];
  for (const id of listChannels()) {
    const c = loadChannel(id);
    const episodes: ChannelWeek["episodes"] = [];
    for (const dir of await listScriptEpisodeDirs(channelPaths(id).episodes)) {
      const ep = dir.slice(0, 3);
      const analytics = (await readJson<EpisodeAnalytics>(analyticsFile(id, ep))) ?? undefined;
      let retention;
      if (existsSync(retentionFile(id, ep))) {
        retention = await runWithChannel(id, async () => {
          const plan = await loadPlan(ep);
          if (!plan) return undefined;
          const at = sceneStartsFor(plan, undefined, channelInfo(c));
          const pts = parseRetention(await readFile(retentionFile(id, ep), "utf8"), at.total);
          const scenes = plan.chapters.flatMap((ch) => ch.scenes).map((s) => ({ id: s.id, start: at.starts[s.id] ?? 0, narration: s.narration }));
          return analyseRetention(pts, { duration: at.total, scenes, estimated: at.estimated });
        }).catch(() => undefined);
      }
      if (analytics || retention) episodes.push({ episode: ep, title: (await runWithChannel(id, () => loadPlan(ep)).catch(() => null))?.title ?? ep, analytics, retention });
    }
    out.push({ id, name: c.name, episodes });
  }
  return out;
};

export const saveWeekly = async (week: string, md: string) => {
  await mkdir(weeklyDir(), { recursive: true });
  await writeFile(path.join(weeklyDir(), `${week}.md`), md);
  await writeFile(path.join(weeklyDir(), "latest.md"), md);
};
