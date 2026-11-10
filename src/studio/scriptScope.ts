/**
 * One scene's edit after «اعتمد التجهيز» (D66, owner report 10 Nov: editing «أَوَّلُ» → «أَوَّلَ» in scene ٣ locked
 * the whole of step ٢). The script decision is bound to the script file's generation, so any edit re-opens it,
 * and with it the storyboard decision. When the ONLY difference from the script as it was approved is the
 * narration of one scene, the owner may re-record both decisions for that one scene from step ٢
 * («اعتمد تعديل هذا المشهد»); the other scenes keep their approvals (their inputs did not change).
 *
 * «As it was approved» is a copy of script.md taken when the script approval is recorded
 * (`script-approved.v1.json`, next to the ledger, local like it), signed with the same machine key as the
 * ledger and bound to the exact generation the ledger approved. No copy, a broken signature, or another
 * generation → nothing is inferred: the edit is re-approved from step ١ as before (fail closed).
 */
import path from "node:path";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { lstat, open, readFile, rename, rm } from "node:fs/promises";
import { workflowSigningKey } from "../workflow/trust";

type Snapshot = { version: 1; generation: string; sha256: string; text: string; at: string; mac: string };

export const approvedScriptFileFor = (scriptPath: string) => path.join(path.dirname(scriptPath), "script-approved.v1.json");
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const macOf = (s: Omit<Snapshot, "mac">) =>
  createHmac("sha256", workflowSigningKey()).update(JSON.stringify(["studio-approved-script-v1", s.version, s.generation, s.sha256, s.text, s.at])).digest("hex");

/** Called right after the ledger recorded «approve-script» for `generation`, still under the ledger lock. */
export const recordApprovedScript = async (scriptPath: string, generation: string, generationNow: () => Promise<string>): Promise<boolean> => {
  const text = await readFile(scriptPath, "utf8");
  // The file must still be the generation that was approved (read after, so a write in between is caught).
  if (await generationNow() !== generation) return false;
  const body = { version: 1 as const, generation, sha256: sha(text), text, at: new Date().toISOString() };
  const file = approvedScriptFileFor(scriptPath);
  const temp = `${file}.${randomUUID()}.tmp`;
  const fd = await open(temp, "wx", 0o600);
  try {
    try { await fd.writeFile(JSON.stringify({ ...body, mac: macOf(body) }, null, 2) + "\n"); await fd.sync(); } finally { await fd.close(); }
    await rename(temp, file);
  } finally { await rm(temp, { force: true }); }
  return true;
};

/** The script text exactly as approved at `generation`, or null (no copy, another generation, or not signed by this machine). */
export const loadApprovedScript = async (scriptPath: string, generation: string | undefined): Promise<string | null> => {
  if (!generation) return null;
  const file = approvedScriptFileFor(scriptPath);
  try {
    const st = await lstat(file);
    if (!st.isFile() || st.isSymbolicLink()) return null;
    const s = JSON.parse(await readFile(file, "utf8")) as Snapshot;
    if (!s || s.version !== 1 || s.generation !== generation || typeof s.text !== "string" || sha(s.text) !== s.sha256 || typeof s.mac !== "string") return null;
    const { mac, ...body } = s;
    const want = macOf(body);
    if (mac.length !== want.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(want))) return null;
    return s.text;
  } catch { return null; }
};

const norm = (s: string) => s.trim().split(/\s+/).filter(Boolean).join(" ");
/** A line that is not narration: scene/verse/hadith markers, headings, front matter, lists, tables, quotes. */
const STRUCT = /^\s*(\[|#|---|- |\* |>|\||[a-z_]+:\s)/u;
const isStruct = (l: string) => STRUCT.test(l);

export type ScriptScope = { ok: true; sceneId: string | null } | { ok: false; reason: string };

/**
 * Which scene a script edit belongs to. Lines are compared as text: the changed region is what lies between the
 * common beginning and the common end of the two versions. It must contain narration lines only, inside one run
 * of narration between two structural lines (a scene marker, a heading…), and that run — or its paragraph —
 * must be the narration of exactly one plan scene, before or after the edit. Anything else is «other parts».
 */
export const scriptEditScope = (approved: string, now: string, scenes: { id: string; narration: string }[]): ScriptScope => {
  const a = approved.split(/\r?\n/), b = now.split(/\r?\n/);
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  if (p === a.length && p === b.length) return { ok: true, sceneId: null };
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  const midA = a.slice(p, a.length - s), midB = b.slice(p, b.length - s);
  const bad = [...midA, ...midB].find(isStruct);
  if (bad !== undefined) return { ok: false, reason: `تغيّر في السكريبت سطر ليس من نص مشهد: «${bad.trim().slice(0, 60)}».` };
  const around = (lines: string[], from: number, to: number) => {
    let i = from; while (i > 0 && !isStruct(lines[i - 1]!)) i--;
    let j = to; while (j < lines.length && !isStruct(lines[j]!)) j++;
    let pi = from; while (pi > i && lines[pi - 1]!.trim()) pi--;
    let pj = to; while (pj < j && lines[pj]!.trim()) pj++;
    const structBefore = i > 0 ? lines[i - 1]! : "";
    return { run: norm(lines.slice(i, j).join(" ")), para: norm(lines.slice(pi, Math.max(pj, pi)).join(" ")), anchored: /^\s*(\[مشهد|#)/u.test(structBefore) };
  };
  const ra = around(a, p, a.length - s), rb = around(b, p, b.length - s);
  if (!ra.anchored || !rb.anchored) return { ok: false, reason: "تغيّر في السكريبت نص خارج المشاهد (قبل أول مشهد أو في المصادر)." };
  // The scene's narration is the whole run, its paragraph, or exactly the changed lines (before or after).
  const texts = new Set([ra.run, ra.para, rb.run, rb.para, norm(midA.join(" ")), norm(midB.join(" "))].filter(Boolean));
  const hits = [...new Set(scenes.filter((x) => texts.has(norm(x.narration))).map((x) => x.id))];
  if (hits.length === 1) return { ok: true, sceneId: hits[0]! };
  if (!hits.length) return { ok: false, reason: "لا يُعرف المشهد الذي يخصه تعديل السكريبت (نصه لا يطابق نص أي مشهد قبل التعديل ولا بعده)." };
  return { ok: false, reason: `تعديل السكريبت يطابق نص أكثر من مشهد (${hits.join("، ")}).` };
};
