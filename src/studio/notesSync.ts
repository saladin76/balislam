/**
 * إرسال صندوق ملاحظات المالك إلى GitHub على الفرع `studio-notes` وحده (`docs/studio/notes-inbox.md`).
 *
 * أمان المستودع على جهاز المالك (لا يُمس أبدًا):
 *   - لا checkout ولا تبديل فرع ولا stash ولا commit على الفرع الحالي، ولا لمس الفهرس الحقيقي أو ملفات العمل.
 *   - الشجرة تُبنى بأوامر السباكة (hash-object / update-index / write-tree / commit-tree) في فهرس مؤقت
 *     (GIT_INDEX_FILE في مجلد مؤقت)، وأبوها آخر `studio-notes` على GitHub، وفيها ملفات الصناديق وحدها.
 *   - الدفع بمرجع صريح واحد: `git push origin <sha>:refs/heads/studio-notes` بلا --force وبلا --no-verify؛
 *     خطاف pre-push يتخطى بوابة الاختبارات لهذا المرجع وحده وبشرط أن شجرته صناديق ملاحظات فقط.
 *   - المرجع المحلي الوحيد الذي يُكتب: refs/studio-notes/origin (نسخة آخر ما على GitHub)، لا فرع.
 * الفشل (بلا اتصال، مصادقة، رفض) لا يرمي أبدًا: تبقى الملاحظات «بانتظار الإرسال» وتُعاد مع الملاحظة
 * التالية وعند تشغيل الاستوديو.
 */
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { childEnv } from "../../scripts/git-env.mjs";
import {
  INBOX_PATH_RE, markNotesSync, mergeInboxNotes, publicNote, readInboxFile, type StudioNote,
} from "./notesInbox";

export const NOTES_BRANCH = "studio-notes";
export const NOTES_REF = `refs/heads/${NOTES_BRANCH}`;
/** نسخة محلية لآخر ما على GitHub من الفرع (ليست فرعًا، فلا تظهر في git branch). */
export const NOTES_TRACKING_REF = "refs/studio-notes/origin";

type GitResult = { ok: boolean; out: string; err: string };
export const runGit = (cwd: string, args: string[], opts: { env?: Record<string, string>; input?: string; timeout?: number } = {}) =>
  new Promise<GitResult>((resolve) => {
    const child = execFile("git", args, {
      cwd, timeout: opts.timeout ?? 30_000, maxBuffer: 32 * 1024 * 1024,
      // childEnv drops every repo-locating variable (GIT_DIR, GIT_INDEX_FILE…) inherited from a hook; our own
      // temporary GIT_INDEX_FILE is added AFTER that cleaning, or plumbing would write the owner's real index.
      env: { ...childEnv({ GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" }), ...(opts.env ?? {}) },
    }, (error, stdout, stderr) => resolve({ ok: !error, out: String(stdout).trim(), err: String(stderr).trim() || (error?.message ?? "") }));
    if (opts.input !== undefined) child.stdin?.end(opts.input);
  });

/** هل الإرسال مفعَّل؟ مطفأ افتراضيًا داخل الاختبارات (لا دفع إلى GitHub من اختبار أبدًا). */
export const notesSyncEnabled = (env = process.env) =>
  env.BAL_NOTES_SYNC === "on" || (env.BAL_NOTES_SYNC !== "off" && !env.VITEST);

/** كل صناديق الملاحظات تحت مجلد القنوات. */
export const listInboxFiles = (channelsDir: string): string[] => {
  if (!existsSync(channelsDir)) return [];
  const out: string[] = [];
  for (const ch of readdirSync(channelsDir)) {
    const eps = path.join(channelsDir, ch, "episodes");
    if (!existsSync(eps)) continue;
    for (const ep of readdirSync(eps)) {
      const file = path.join(eps, ep, "notes", "inbox.json");
      if (existsSync(file)) out.push(file);
    }
  }
  return out.sort();
};

export type SyncResult =
  | { ok: true; pushed: boolean; commit: string | null; notes: string[] }
  | { ok: false; reason: "no-repo" | "no-remote" | "offline" | "rejected" | "error"; message: string; notes: string[] };

const repoTop = async (dir: string): Promise<string | null> => {
  const r = await runGit(dir, ["rev-parse", "--show-toplevel"]);
  return r.ok && r.out ? realpath(r.out) : null;
};

const identityEnv = async (top: string): Promise<Record<string, string>> => {
  const name = (await runGit(top, ["config", "user.name"])).out || "Studio notes";
  const email = (await runGit(top, ["config", "user.email"])).out || "studio-notes@localhost";
  return { GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: email, GIT_COMMITTER_NAME: name, GIT_COMMITTER_EMAIL: email };
};

const parseNotes = (text: string): StudioNote[] => {
  try {
    const data = JSON.parse(text) as { schemaVersion?: number; notes?: StudioNote[] };
    return data?.schemaVersion === 1 && Array.isArray(data.notes) ? data.notes : [];
  } catch { return []; }
};

/**
 * محاولة إرسال واحدة لكل الصناديق التي فيها ملاحظة «بانتظار الإرسال».
 * `inboxFiles` (اختياري) يحدّد الصناديق؛ وإلا تُجمع من `channelsDir`.
 */
const syncOnce = async (opts: { channelsDir: string; remote?: string; inboxFiles?: string[] }): Promise<SyncResult> => {
  const remote = opts.remote ?? "origin";
  const files = (opts.inboxFiles ?? listInboxFiles(opts.channelsDir)).filter((f) => existsSync(f));
  const pending: { file: string; ids: string[] }[] = [];
  for (const file of files) {
    const inbox = await readInboxFile(file).catch(() => null);
    const ids = inbox?.notes.filter((n) => n.sync?.state !== "sent").map((n) => n.id) ?? [];
    if (ids.length) pending.push({ file, ids });
  }
  const allIds = pending.flatMap((p) => p.ids);
  if (!pending.length) return { ok: true, pushed: false, commit: null, notes: [] };
  const fail = async (reason: Exclude<SyncResult, { ok: true }>["reason"], message: string): Promise<SyncResult> => {
    const at = new Date().toISOString();
    for (const p of pending) await markNotesSync(p.file, p.ids, { state: "pending", at, lastError: `${reason}: ${message}`.slice(0, 300) });
    return { ok: false, reason, message, notes: allIds };
  };

  const top = await repoTop(path.dirname(pending[0]!.file));
  if (!top) return fail("no-repo", "The channels folder is not inside a Git repository.");
  const entries: { file: string; ids: string[]; rel: string }[] = [];
  for (const p of pending) {
    const rel = path.relative(top, await realpath(p.file)).split(path.sep).join("/");
    if (!INBOX_PATH_RE.test(rel)) return fail("error", `Unexpected inbox path: ${rel}`);
    entries.push({ ...p, rel });
  }
  const remoteUrl = await runGit(top, ["remote", "get-url", remote]);
  if (!remoteUrl.ok) return fail("no-remote", `No Git remote named ${remote}.`);

  // آخر ما على GitHub من الفرع (أو لا شيء: أول ملاحظة تنشئ الفرع).
  const ls = await runGit(top, ["ls-remote", "--refs", remote, NOTES_REF], { timeout: 30_000 });
  if (!ls.ok) return fail("offline", ls.err || "Cannot reach the remote.");
  const tip = ls.out.split(/\s+/)[0] || "";
  if (tip) {
    const fetched = await runGit(top, ["fetch", "--no-tags", "--no-write-fetch-head", "--no-recurse-submodules", remote,
      `+${NOTES_REF}:${NOTES_TRACKING_REF}`], { timeout: 60_000 });
    if (!fetched.ok) return fail("offline", fetched.err || "Cannot fetch the notes branch.");
  }

  const tmp = await mkdtemp(path.join(os.tmpdir(), "bal-notes-index-"));
  try {
    const idx = { GIT_INDEX_FILE: path.join(tmp, "index") };
    // Defense in depth: prove the temporary index is the one git uses before any read-tree/update-index.
    const where = await runGit(top, ["rev-parse", "--git-path", "index"], { env: idx });
    if (!where.ok || path.resolve(top, where.out) !== path.resolve(idx.GIT_INDEX_FILE))
      return fail("error", "Refusing to build the notes commit outside a temporary index.");
    const read = tip ? await runGit(top, ["read-tree", tip], { env: idx }) : await runGit(top, ["read-tree", "--empty"], { env: idx });
    if (!read.ok) return fail("error", read.err);
    let changed = false;
    for (const e of entries) {
      const local = (await readInboxFile(e.file)).notes.map(publicNote);
      const onRemote = tip ? await runGit(top, ["show", `${tip}:${e.rel}`]) : { ok: false, out: "", err: "" };
      const before = onRemote.ok ? parseNotes(onRemote.out) : [];
      const merged = mergeInboxNotes(before, local);
      if (onRemote.ok && merged.length === before.length) continue;
      const blob = await runGit(top, ["hash-object", "-w", "--stdin"], { input: JSON.stringify({ schemaVersion: 1, notes: merged }, null, 2) + "\n" });
      if (!blob.ok) return fail("error", blob.err);
      const add = await runGit(top, ["update-index", "--add", "--cacheinfo", `100644,${blob.out},${e.rel}`], { env: idx });
      if (!add.ok) return fail("error", add.err);
      changed = true;
    }
    let commit = tip;
    if (changed) {
      const tree = await runGit(top, ["write-tree"], { env: idx });
      if (!tree.ok) return fail("error", tree.err);
      // الشجرة صناديق ملاحظات فقط، وإلا لا دفع (الخطاف يشترط ذلك أيضًا).
      const names = await runGit(top, ["ls-tree", "-r", "--name-only", tree.out]);
      if (!names.ok || names.out.split("\n").filter(Boolean).some((n) => !INBOX_PATH_RE.test(n)))
        return fail("error", "The notes tree contains a non-notes path.");
      const made = await runGit(top, ["commit-tree", tree.out, ...(tip ? ["-p", tip] : []), "-m",
        `studio notes: ${allIds.length} owner note(s)\n\n${entries.map((e) => e.rel).join("\n")}`], { env: await identityEnv(top) });
      if (!made.ok) return fail("error", made.err);
      commit = made.out;
      const push = await runGit(top, ["push", "--porcelain", "--no-follow-tags", "--recurse-submodules=no", remote,
        `${commit}:${NOTES_REF}`], { timeout: 120_000 });
      if (!push.ok) {
        const text = `${push.out}\n${push.err}`;
        return fail(/rejected|non-fast-forward|fetch first|stale info/i.test(text) ? "rejected" : "offline", text.trim().slice(-400));
      }
      await runGit(top, ["update-ref", NOTES_TRACKING_REF, commit]);
    }
    const at = new Date().toISOString();
    for (const e of entries) await markNotesSync(e.file, e.ids, { state: "sent", at, ...(commit ? { commit } : {}) });
    return { ok: true, pushed: changed, commit: commit || null, notes: allIds };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
};

let queue: Promise<unknown> = Promise.resolve();
/** إرسال متسلسل (لا محاولتان في الوقت نفسه)، مع إعادة واحدة إن سبقنا دفع آخر. لا يرمي أبدًا. */
export const syncStudioNotes = (opts: { channelsDir: string; remote?: string; inboxFiles?: string[] }): Promise<SyncResult> => {
  const run = queue.then(async () => {
    try {
      const first = await syncOnce(opts);
      return !first.ok && first.reason === "rejected" ? await syncOnce(opts) : first;
    } catch (error) {
      return { ok: false as const, reason: "error" as const, message: (error as Error).message, notes: [] };
    }
  });
  queue = run.catch(() => undefined);
  return run;
};

/** في الخلفية بعد كل ملاحظة وعند تشغيل الاستوديو: لا ينتظره أحد ولا يُفشل شيئًا. */
export const scheduleStudioNotesSync = (channelsDir: string, log: (m: string) => void = (m) => console.warn(m)): void => {
  if (!notesSyncEnabled()) return;
  void syncStudioNotes({ channelsDir }).then((r) => {
    if (!r.ok && r.notes.length) log(`[studio] owner notes kept for later (${r.reason}): ${r.message.split("\n")[0]}`);
  });
};
