/**
 * Word-fix leftovers after a crash (QA, 10 Nov 2026). «أصلح الكلمة» writes a paid fragment
 * (`<sentence>-frag-<stamp>.mp3`) and, on success, a spliced take (`<sentence>-fix-<stamp>.wav`) into
 * voice/sentences/ before voice/sentences.json records them. A crash in between leaves files no record
 * points to. At Studio start they are MOVED to voice/superseded/sentences/ (never deleted: paid audio).
 * Files younger than FRAGMENT_GRACE_MS (a fix may be running) and every file sentences.json mentions stay.
 */
import path from "node:path";
import { existsSync, readdirSync } from "node:fs";
import { mkdir, readFile, rename, stat } from "node:fs/promises";

export const FRAGMENT_GRACE_MS = 10 * 60_000;
const FRAGMENT_RE = /^[a-z0-9][a-z0-9-]*-(?:frag|fix)-[0-9a-z]+\.(?:mp3|wav)$/i;

/** One episode's voice/ folder; returns the names moved. Unreadable sentences.json: nothing is touched. */
export const sweepOrphanWordFixFragments = async (voiceDir: string, now = Date.now()): Promise<string[]> => {
  const dir = path.join(voiceDir, "sentences");
  const docFile = path.join(voiceDir, "sentences.json");
  if (!existsSync(dir) || !existsSync(docFile)) return [];
  let doc: string;
  try { doc = await readFile(docFile, "utf8"); JSON.parse(doc); }
  catch { return []; }
  const moved: string[] = [];
  for (const name of readdirSync(dir)) {
    if (!FRAGMENT_RE.test(name) || doc.includes(JSON.stringify(name))) continue;
    const st = await stat(path.join(dir, name)).catch(() => null);
    if (!st?.isFile() || now - st.mtimeMs < FRAGMENT_GRACE_MS) continue;
    const target = path.join(voiceDir, "superseded", "sentences");
    await mkdir(target, { recursive: true });
    const to = existsSync(path.join(target, name)) ? `${now.toString(36)}-${name}` : name;
    await rename(path.join(dir, name), path.join(target, to));
    moved.push(name);
  }
  return moved;
};

/** Every episode under the channels folder (Studio start). Never throws. */
export const sweepAllOrphanWordFixFragments = async (channelsDir: string): Promise<number> => {
  let total = 0;
  if (!existsSync(channelsDir)) return 0;
  for (const ch of readdirSync(channelsDir)) {
    const eps = path.join(channelsDir, ch, "episodes");
    if (!existsSync(eps)) continue;
    for (const ep of readdirSync(eps)) {
      try { total += (await sweepOrphanWordFixFragments(path.join(eps, ep, "voice"))).length; }
      catch { /* one episode never blocks the others */ }
    }
  }
  return total;
};
