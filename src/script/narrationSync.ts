/**
 * One text for the owner (QA balislam 2, 12 Nov 2026): when a scene's narration is changed from the studio after the
 * script was written («عدّل النص» on a sentence, a split/merge/delete, or the scene editor), the same change is
 * written into script.md, so the script the owner approved and the text the voice says stay the same text.
 *
 * Only an unambiguous change is written: the changed words are located by their own text plus as many neighbouring
 * words of the old narration as it takes to occur exactly ONCE in script.md, and only that span is replaced. If the
 * old text is not found once (the script says it differently, or the same words occur twice), nothing is written:
 * the divergence check (src/plan/scriptSync.ts) then names the scene, and producing it waits until the script and
 * the scene say the same thing. Verse text (﴿…﴾) is never touched: a narration change never reaches inside it.
 */
import { readFile } from "node:fs/promises";
import { writeFileAtomic } from "../io/atomicJson";

export type NarrationSync = "synced" | "unchanged" | "not-found";

const words = (t: string) => t.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
const letter = /[\p{L}\p{M}\p{N}]/u;
/** Where `needle` occurs as whole words (never «قديم» inside «قديمة»). */
const hitsOf = (hay: string, needle: string): number[] => {
  const out: number[] = [];
  if (!needle) return out;
  for (let at = hay.indexOf(needle); at >= 0; at = hay.indexOf(needle, at + 1)) {
    const before = at > 0 ? hay[at - 1]! : "";
    const after = hay[at + needle.length] ?? "";
    if ((!before || !letter.test(before) || !letter.test(needle[0]!)) && (!after || !letter.test(after) || !letter.test(needle[needle.length - 1]!))) out.push(at);
  }
  return out;
};
/** Inside a verse span ﴿…﴾ of the script? */
const inVerse = (text: string, at: number) => {
  const open = text.lastIndexOf("﴿", at);
  return open >= 0 && text.lastIndexOf("﴾", at) < open;
};

/** The new script text, or null when the change cannot be placed unambiguously (pure, for tests). */
export const syncNarrationText = (script: string, before: string, after: string): string | null => {
  const a = words(before), b = words(after);
  if (a.join(" ") === b.join(" ")) return script;
  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  let suf = 0;
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
  // Widen the old span word by word (left, then right) until it occurs exactly once in the script.
  for (let left = pre, right = a.length - suf; ; ) {
    const oldSpan = a.slice(left, right).join(" ");
    const found = hitsOf(script, oldSpan);
    const hits = found.length;
    if (oldSpan && hits === 1) {
      const at = found[0]!;
      if (inVerse(script, at)) return null;
      const newSpan = b.slice(left, b.length - (a.length - right)).join(" ");
      return script.slice(0, at) + newSpan + script.slice(at + oldSpan.length);
    }
    if (oldSpan && hits === 0) return null;
    if (left > 0) left--;
    else if (right < a.length) right++;
    else return null;
  }
};

/** Write a scene's narration change into script.md when it can be placed unambiguously. */
export const syncScriptNarration = async (scriptPath: string, before: string, after: string): Promise<NarrationSync> => {
  if (words(before).join(" ") === words(after).join(" ")) return "unchanged";
  const script = await readFile(scriptPath, "utf8");
  const next = syncNarrationText(script, before, after);
  if (next === null) return "not-found";
  if (next === script) return "unchanged";
  await writeFileAtomic(scriptPath, next);
  return "synced";
};
