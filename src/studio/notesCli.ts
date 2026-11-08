/**
 * جانب Claude من صندوق الملاحظات (`docs/studio/notes-inbox.md`):
 *   bal notes [--channel x] [--open] [--json]   يجلب origin/studio-notes ويعرض الملاحظات مع ردودها
 *   bal notes resolve <id> --answer "…"          يكتب الرد في resolved.json على النسخة الحالية (main)
 *
 * مصدر الحقيقة: نص الملاحظة على الفرع studio-notes (يكتبه الاستوديو وحده، إضافة فقط)، والرد في
 * resolved.json على main (يكتبه Claude وحده). لا يكتب أحدهما ملف الآخر، فلا تعارض دمج.
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, realpath } from "node:fs/promises";
import {
  INBOX_PATH_RE, joinNotes, mergeInboxNotes, publicNote, readInboxFile, readResolvedFile, writeResolution,
  type JoinedNote, type NoteStatus, type StudioNote,
} from "./notesInbox";
import { listInboxFiles, NOTES_REF, NOTES_TRACKING_REF, runGit } from "./notesSync";

export type ListedNote = JoinedNote & { path: string };
export type NotesListing = { notes: ListedNote[]; fetched: "ok" | "missing" | "offline" | "skipped"; message?: string };

const repoTop = async (dir: string) => {
  const r = await runGit(dir, ["rev-parse", "--show-toplevel"]);
  if (!r.ok || !r.out) throw Error(`Not inside a Git repository: ${dir}`);
  return realpath(r.out);
};

/** يجلب الفرع إلى refs/studio-notes/origin (لا فرع محلي، ولا تبديل لشيء). */
export const fetchNotesBranch = async (top: string, remote = "origin"): Promise<NotesListing["fetched"]> => {
  const ls = await runGit(top, ["ls-remote", "--refs", remote, NOTES_REF], { timeout: 30_000 });
  if (!ls.ok) return "offline";
  if (!ls.out.trim()) return "missing";
  const f = await runGit(top, ["fetch", "--no-tags", "--no-write-fetch-head", "--no-recurse-submodules", remote,
    `+${NOTES_REF}:${NOTES_TRACKING_REF}`], { timeout: 60_000 });
  return f.ok ? "ok" : "offline";
};

export const listStudioNotes = async (opts: {
  repoDir: string; remote?: string; channel?: string; open?: boolean; fetch?: boolean;
}): Promise<NotesListing> => {
  const top = await repoTop(opts.repoDir);
  const fetched = opts.fetch === false ? "skipped" : await fetchNotesBranch(top, opts.remote);
  const byPath = new Map<string, StudioNote[]>();
  // 1) ما على الفرع (آخر جلب، حتى إن تعذّر الجلب الآن).
  const tip = await runGit(top, ["rev-parse", "--verify", "--quiet", `${NOTES_TRACKING_REF}^{commit}`]);
  if (tip.ok && tip.out) {
    const names = await runGit(top, ["ls-tree", "-r", "--name-only", tip.out]);
    for (const rel of names.out.split("\n").filter((n) => INBOX_PATH_RE.test(n))) {
      const shown = await runGit(top, ["show", `${tip.out}:${rel}`]);
      try {
        const data = JSON.parse(shown.out) as { notes?: StudioNote[] };
        if (Array.isArray(data.notes)) byPath.set(rel, data.notes);
      } catch { /* a malformed file on the branch is skipped */ }
    }
  }
  // 2) صناديق محلية في هذه النسخة (على جهاز المالك: ما لم يُرسل بعد).
  for (const file of listInboxFiles(path.join(top, "channels"))) {
    const rel = path.relative(top, file).split(path.sep).join("/");
    if (!INBOX_PATH_RE.test(rel)) continue;
    const local = (await readInboxFile(file).catch(() => ({ notes: [] }))).notes.map(publicNote);
    byPath.set(rel, mergeInboxNotes(byPath.get(rel) ?? [], local));
  }
  const out: ListedNote[] = [];
  for (const [rel, notes] of [...byPath].sort(([a], [b]) => a.localeCompare(b))) {
    const resolved = await readResolvedFile(path.join(top, path.dirname(rel), "resolved.json"))
      .catch(() => ({ schemaVersion: 1 as const, resolutions: {} }));
    for (const n of joinNotes(notes, resolved)) out.push({ ...n, path: rel });
  }
  const notes = out
    .filter((n) => !opts.channel || n.channel === opts.channel)
    .filter((n) => !opts.open || n.status === "open" || n.status === "in-progress")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return { notes, fetched, ...(fetched === "offline" ? { message: "تعذّر جلب studio-notes؛ المعروض من آخر جلب ومن الصناديق المحلية." } : {}) };
};

export const resolveStudioNote = async (opts: {
  repoDir: string; id: string; answer: string; status?: Exclude<NoteStatus, "open">; fixedBy?: string;
  remote?: string; fetch?: boolean;
}) => {
  const { notes } = await listStudioNotes({ repoDir: opts.repoDir, remote: opts.remote, fetch: opts.fetch });
  const note = notes.find((n) => n.id === opts.id);
  if (!note) throw Error(`No studio note with id ${opts.id} (run: bal notes).`);
  const top = await repoTop(opts.repoDir);
  const episodeDir = path.join(top, path.dirname(path.dirname(note.path)));
  if (!existsSync(episodeDir)) throw Error(`Episode folder is missing in this checkout: ${path.relative(top, episodeDir)}`);
  await mkdir(path.join(episodeDir, "notes"), { recursive: true });
  const fixedBy = opts.fixedBy?.trim() ||
    (await runGit(top, ["rev-parse", "--short", "HEAD"])).out || "claude";
  await writeResolution(episodeDir, note.id, {
    status: opts.status ?? "fixed", answer: opts.answer.trim(), fixedBy, at: new Date().toISOString(),
  });
  return { note, file: path.join(path.dirname(note.path), "resolved.json") };
};

const KIND_AR: Record<string, string> = { motion: "الحركة", tone: "النبرة", general: "تعديل" };
export const formatNote = (n: ListedNote): string => [
  `${n.id}  [${n.status}]  ${n.channel}/${n.episode}  ${n.sceneId}  ${KIND_AR[n.kind] ?? n.kind}${n.timecode ? ` @${n.timecode}` : ""}${n.tone ? `  نبرة: ${n.tone}` : ""}`,
  `   ${n.createdAt}  مدخلات المشهد ${n.sceneInputSha256.slice(0, 12)}  المعاينة ${n.previewSha256.slice(0, 12)}`,
  `   «${n.note}»`,
  ...(n.answer ? [`   الرد (${n.fixedBy ?? "?"}): ${n.answer}`] : []),
].join("\n");
