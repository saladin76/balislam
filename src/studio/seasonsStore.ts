/** Server-only: قراءة جدول المواسم وحفظ موسم واحد بعد فحص الجدول كله (src/studio/seasons.ts). */
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { channelPaths } from "../channel";
import { seasonsIssues, type Season, type Seasons } from "./seasons";

export const SEASONS_FILE = "seasons.json";
export const seasonsPath = (ch: string) => path.join(channelPaths(ch).dir, SEASONS_FILE);

export const readSeasons = (ch: string): Seasons => {
  const f = seasonsPath(ch);
  return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as Seasons) : { version: 1, seasons: [] };
};

export class SeasonsError extends Error {
  constructor(public issues: string[]) { super(issues.join(" ")); }
}

/** يحفظ موسمًا (جديدًا أو معدّلًا) بعد فحص الجدول كله؛ الترتيب بتاريخ البداية */
export const saveSeason = async (ch: string, s: Season): Promise<Season> => {
  const cur = readSeasons(ch);
  const next: Seasons = { version: 1, seasons: [...cur.seasons.filter((x) => x.id !== s.id), s].sort((a, b) => a.gregorian.from.localeCompare(b.gregorian.from)) };
  const issues = seasonsIssues(next);
  if (issues.length) throw new SeasonsError(issues);
  const f = seasonsPath(ch);
  await mkdir(path.dirname(f), { recursive: true });
  const tmp = `${f}.${randomUUID()}.tmp`;
  await writeFile(tmp, JSON.stringify(next, null, 2) + "\n");
  await rename(tmp, f);
  return s;
};
