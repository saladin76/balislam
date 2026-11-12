/**
 * «حذف الحلقة» from the studio is local and reversible (QA balislam 7, 12 Nov 2026).
 *
 * It used to `git rm`, commit on whatever branch was checked out, `git pull --rebase`, `git push`, delete the episode
 * folder (paid takes included) and every copy in ~/balislam-archive. Now:
 *   - the whole episode folder is MOVED (never deleted) into the local trash
 *     `~/balislam-backup/trash/<channel>/<stamp>--<folder>/` (BAL_TRASH_DIR overrides the root), with `trash.json`
 *     saying where it came from, when, and what it holds;
 *   - nothing is committed or pushed, and ~/balislam-archive is never touched;
 *   - «تراجع» moves it back to the same path, if that path and its episode number are still free.
 * Paid recordings (voice/, takes, voice/superseded/) move with the folder like every other file: nothing is lost.
 * A tracked episode leaves its tracked files deleted in the working tree; whether main should drop them is a reviewed
 * change through the push gate, not a studio button.
 */
import os from "node:os";
import path from "node:path";
import { existsSync } from "node:fs";
import { cp, lstat, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";

export const trashRoot = () => process.env.BAL_TRASH_DIR?.trim() || path.join(os.homedir(), "balislam-backup", "trash");

export type EpisodeContents = {
  files: number;
  bytes: number;
  /** Files under voice/ (narration, sentence takes, superseded takes): paid recordings. */
  voiceFiles: number;
  /** Video files (previews, final files). */
  videoFiles: number;
  /** Files tracked by Git in this folder (they show as deleted in the working tree after the move). */
  tracked: number;
};
export type TrashEntry = { id: string; channel: string; from: string; at: string; title?: string; contents: EpisodeContents };

const walk = async (dir: string, rel = ""): Promise<{ rel: string; size: number }[]> => {
  const out: { rel: string; size: number }[] = [];
  for (const name of await readdir(path.join(dir, rel)).catch(() => [] as string[])) {
    const r = rel ? path.join(rel, name) : name;
    const st = await lstat(path.join(dir, r));
    if (st.isDirectory()) out.push(...await walk(dir, r));
    else out.push({ rel: r, size: st.size });
  }
  return out;
};

/** What a move would take, without touching anything (shown in the confirmation). */
export const episodeContents = async (dir: string, trackedFiles: string[] = []): Promise<EpisodeContents> => {
  const files = await walk(dir);
  return {
    files: files.length,
    bytes: files.reduce((n, f) => n + f.size, 0),
    voiceFiles: files.filter((f) => f.rel.split(path.sep)[0] === "voice").length,
    videoFiles: files.filter((f) => /\.(mp4|mov|webm|mkv)$/i.test(f.rel)).length,
    tracked: trackedFiles.length,
  };
};

const stampOf = (d: Date) => d.toISOString().replace(/[:.]/g, "-");
const SLUG = String.raw`\d{3}-[A-Za-z0-9][A-Za-z0-9._-]*`;
const SAFE_ID = new RegExp(String.raw`^[0-9TZ-]+--${SLUG}$`);
const EPISODE_REL = new RegExp(String.raw`^channels\/[a-z0-9-]+\/episodes\/${SLUG}$`);

/** Move across volumes too (rename, else copy then remove the source only after the copy is complete). */
const move = async (from: string, to: string) => {
  try { await rename(from, to); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EXDEV") throw error;
    await cp(from, to, { recursive: true, errorOnExist: true, force: false, preserveTimestamps: true });
    const a = await walk(from), b = await walk(to);
    if (a.length !== b.length || a.reduce((n, f) => n + f.size, 0) !== b.reduce((n, f) => n + f.size, 0))
      throw new Error("لم يكتمل نسخ الحلقة إلى سلة المحذوفات؛ لم يُحذف شيء من مكانها.");
    await rm(from, { recursive: true, force: true });
  }
};

/**
 * Move one episode folder into the trash. `root` is the repository; `rel` its path there
 * (channels/<channel>/episodes/<NNN-slug>). Returns the trash entry (its id is what «تراجع» takes).
 */
export const trashEpisode = async (root: string, rel: string, o: { channel: string; title?: string; trackedFiles?: string[]; now?: Date }): Promise<TrashEntry> => {
  const norm = rel.split(path.sep).join("/");
  if (!EPISODE_REL.test(norm) || norm.includes("..")) throw new Error("مسار الحلقة غير متوقع؛ لم يُنقل شيء.");
  const dir = path.join(root, rel);
  const contents = await episodeContents(dir, o.trackedFiles);
  const id = `${stampOf(o.now ?? new Date())}--${path.basename(dir)}`;
  const dest = path.join(trashRoot(), o.channel, id);
  if (existsSync(dest)) throw new Error("يوجد في سلة المحذوفات مجلد بالاسم نفسه؛ أعد المحاولة بعد لحظة.");
  await mkdir(path.dirname(dest), { recursive: true });
  const entry: TrashEntry = { id, channel: o.channel, from: norm, at: (o.now ?? new Date()).toISOString(), ...(o.title ? { title: o.title } : {}), contents };
  await move(dir, dest);
  await writeFile(path.join(dest, "..", `${id}.trash.json`), JSON.stringify(entry, null, 2) + "\n", "utf8");
  return entry;
};

/** The channel's trash, newest first. */
export const listTrash = async (channel: string): Promise<TrashEntry[]> => {
  const dir = path.join(trashRoot(), channel);
  const out: TrashEntry[] = [];
  for (const f of await readdir(dir).catch(() => [] as string[])) {
    if (!f.endsWith(".trash.json")) continue;
    try {
      const e = JSON.parse(await readFile(path.join(dir, f), "utf8")) as TrashEntry;
      if (SAFE_ID.test(e.id) && existsSync(path.join(dir, e.id))) out.push(e);
    } catch { /* an unreadable note is skipped, its folder stays */ }
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
};

/** «تراجع»: move the episode back to where it was, if that place and its number are still free. */
export const restoreEpisode = async (root: string, channel: string, id: string): Promise<TrashEntry> => {
  if (!SAFE_ID.test(id) || !/^[a-z0-9-]+$/.test(channel)) throw new Error("عنصر سلة المحذوفات غير صالح.");
  const base = path.join(trashRoot(), channel);
  const note = path.join(base, `${id}.trash.json`);
  const entry = JSON.parse(await readFile(note, "utf8").catch(() => { throw new Error("لم يعد هذا العنصر في سلة المحذوفات."); })) as TrashEntry;
  if (entry.id !== id || !EPISODE_REL.test(entry.from) || entry.from.includes("..") || !entry.from.startsWith(`channels/${channel}/`))
    throw new Error("عنصر سلة المحذوفات غير صالح.");
  const to = path.join(root, entry.from);
  if (existsSync(to)) throw new Error("مكان الحلقة مشغول بمجلد آخر؛ لم يُسترجع شيء.");
  const episodes = path.dirname(to);
  const number = path.basename(to).slice(0, 3);
  if ((await readdir(episodes).catch(() => [] as string[])).some((d) => d.startsWith(`${number}-`)))
    throw new Error(`رقم الحلقة ${number} صار لحلقة أخرى؛ لم يُسترجع شيء.`);
  await mkdir(episodes, { recursive: true });
  await move(path.join(base, id), to);
  await rm(note, { force: true });
  return entry;
};
