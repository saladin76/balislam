/** Server-only: a channel's shorts for the daily planner (src/package/shortsSchedule.ts), read from disk. Writes nothing. */
import path from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { channelPaths, loadChannel } from "../channel";
import { listScriptEpisodeDirs } from "../script/episodes";
import type { ManualDay, ShortItem } from "./shortsSchedule";

const json = async <T>(file: string): Promise<T | null> => {
  try { return existsSync(file) ? (JSON.parse(await readFile(file, "utf8")) as T) : null; } catch { return null; }
};

/**
 * Every episode's shorts from its publish kit (`publish.json` → shorts, with their titles), dated by the episode's
 * publication (`status.json` published.date, else its scheduled day). An episode with no date is not scheduled yet,
 * so its shorts wait. The channel calendar (`calendar.json`) is returned as the manual days.
 */
export const channelShorts = async (channelId?: string): Promise<{ name: string; perDay: number; items: ShortItem[]; calendar: Record<string, ManualDay> }> => {
  const ch = loadChannel(channelId);
  const cp = channelPaths(channelId);
  const items: ShortItem[] = [];
  for (const name of await listScriptEpisodeDirs(cp.episodes)) {
    const dir = path.join(cp.episodes, name);
    const id = name.slice(0, 3);
    const status = (await json<{ published?: { date?: string }; scheduled?: string }>(path.join(dir, "status.json"))) ?? {};
    const date = status.published?.date ?? status.scheduled;
    if (!date) continue;
    const kit = await json<{ shorts?: { chapter: number; youtube?: { title?: string } }[] }>(path.join(dir, "publish.json"));
    for (const s of kit?.shorts ?? []) items.push({ source: id, n: s.chapter, title: s.youtube?.title, episodeDate: date });
  }
  return { name: ch.name, perDay: ch.schedule?.shortsPerDay ?? 2, items, calendar: (await json<Record<string, ManualDay>>(path.join(cp.dir, "calendar.json"))) ?? {} };
};
