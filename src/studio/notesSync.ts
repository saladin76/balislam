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
 * الفشل (بلا اتصال، مصادقة، رفض) لا يرمي أبدًا: تبقى الملاحظات «بانتظار الإرسال» بسببها الحقيقي وتُعاد مع
 * الملاحظة التالية وعند تشغيل الاستوديو، ويقرؤه مؤشر «ملاحظات لم تُرسل: N» (studioNotesStatus).
 *
 * صندوق المالك وحده (KI-008، D107): يرسل إلى studio-notes استوديو المالك وحده — نسخة المستودع الرئيسية (لا
 * worktree) على فرع main، على ماك أو ويندوز، خارج الاختبارات وCI وجلسات Claude السحابية — كما يُطفأ الحفظ الآلي
 * (D101). أي نسخة أخرى لا تدفع أبدًا؛ واختبار يطلب الإرسال صراحة (BAL_NOTES_SYNC=on) لا يدفع إلا إلى مستودع
 * محلي على القرص، لا إلى GitHub.
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

/** كل صناديق الملاحظات تحت مجلد القنوات: الصندوق العام لكل قناة (D112) وصندوق كل حلقة. */
export const listInboxFiles = (channelsDir: string): string[] => {
  if (!existsSync(channelsDir)) return [];
  const out: string[] = [];
  for (const ch of readdirSync(channelsDir)) {
    const general = path.join(channelsDir, ch, "notes", "inbox.json");
    if (existsSync(general)) out.push(general);
    const eps = path.join(channelsDir, ch, "episodes");
    if (!existsSync(eps)) continue;
    for (const ep of readdirSync(eps)) {
      const file = path.join(eps, ep, "notes", "inbox.json");
      if (existsSync(file)) out.push(file);
    }
  }
  return out.sort();
};

export type SyncFailure = "no-repo" | "no-remote" | "offline" | "rejected" | "auth" | "not-owner" | "error";
export type SyncResult =
  | { ok: true; pushed: boolean; commit: string | null; notes: string[] }
  | { ok: false; reason: SyncFailure; message: string; notes: string[] };

/** A remote on this disk (a test's bare repository), never a network URL. */
export const isLocalRemote = (url: string) =>
  url.startsWith("/") || url.startsWith("file://") || /^[A-Za-z]:[\\/]/.test(url);

/**
 * Is this the owner's Studio (KI-008)? Deterministic, from this copy alone — no network:
 *   - the main checkout of the repository (not a linked worktree), on branch main;
 *   - macOS or Windows, outside Vitest, CI and Claude's cloud sessions (CLAUDE_CODE_REMOTE), as D101 auto-save;
 *   - BAL_NOTES_SYNC=off turns it off; BAL_NOTES_SYNC=on lifts only the platform/test/cloud condition, and then
 *     only for a remote on this disk (a test's temporary bare repository) — never GitHub.
 */
export const notesSendPolicy = async (top: string, remoteUrl: string, env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform): Promise<{ ok: true } | { ok: false; why: string }> => {
  if (env.BAL_NOTES_SYNC === "off") return { ok: false, why: "الإرسال مطفأ في هذه النسخة (BAL_NOTES_SYNC=off)." };
  const dirs = await runGit(top, ["rev-parse", "--git-dir", "--git-common-dir"]);
  const [gitDir, commonDir] = dirs.ok ? dirs.out.split("\n").map((d) => path.resolve(top, d.trim())) : [];
  if (!gitDir || !commonDir || (await realpath(gitDir).catch(() => gitDir)) !== (await realpath(commonDir).catch(() => commonDir)))
    return { ok: false, why: "نسخة عمل منفصلة (worktree)، لا نسخة المالك." };
  const branch = await runGit(top, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
  if (!branch.ok || branch.out !== "main") return { ok: false, why: `هذه النسخة على ${branch.ok ? `الفرع ${branch.out}` : "commit منفصل"}، لا على main.` };
  const elsewhere = env.VITEST ? "اختبار" : env.CI ? "CI" : env.CLAUDE_CODE_REMOTE ? "جلسة سحابية" :
    platform === "darwin" || platform === "win32" ? null : `جهاز ${platform}، لا ماك المالك`;
  if (elsewhere && !(env.BAL_NOTES_SYNC === "on" && isLocalRemote(remoteUrl)))
    return { ok: false, why: `${elsewhere}: لا تُرسل ملاحظات هذه النسخة إلى صندوق المالك.` };
  return { ok: true };
};

/** GitHub refused this device's credentials (not the network): the owner's Mac needs its push sign-in. */
export const AUTH_FAILURE = /authentication failed|could not read (?:username|password)|terminal prompts disabled|invalid username or password|permission denied|repository not found|access denied|returned error: 40[13]|\b403\b/i;
/** Never keep a credential embedded in a remote URL in a message. */
const scrub = (text: string) => text.replace(/(\w+:\/\/)[^@/\s]+@/g, "$1***@");
const classify = (text: string, fallback: SyncFailure = "error"): SyncFailure =>
  !text ? "offline" : NETWORK_FAILURE.test(text) ? "offline" : AUTH_FAILURE.test(text) ? "auth" : fallback;

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
/** A failure that really is the network (QA 12 Nov): anything else (a bad remote, auth, a hook) is not «بلا اتصال». */
export const NETWORK_FAILURE = /could not resolve (?:host|proxy)|failed to connect|connection (?:timed out|refused|reset)|timed out|network is unreachable|temporary failure in name resolution|getaddrinfo|eai_again|enotfound/i;
type SyncOpts = { channelsDir: string; remote?: string; inboxFiles?: string[]; env?: NodeJS.ProcessEnv; platform?: NodeJS.Platform };
const syncOnce = async (opts: SyncOpts): Promise<SyncResult> => {
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
    const clean = scrub(message);
    for (const p of pending) await markNotesSync(p.file, p.ids, { state: "pending", at, lastError: `${reason}: ${clean}`.slice(0, 300) });
    return { ok: false, reason, message: clean, notes: allIds };
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
  // KI-008: only the owner's Studio sends to his box; decided before any network call.
  const policy = await notesSendPolicy(top, remoteUrl.out, opts.env ?? process.env, opts.platform ?? process.platform);
  if (!policy.ok) return fail("not-owner", policy.why);

  // آخر ما على GitHub من الفرع (أو لا شيء: أول ملاحظة تنشئ الفرع).
  const ls = await runGit(top, ["ls-remote", "--refs", remote, NOTES_REF], { timeout: 30_000 });
  if (!ls.ok) return fail(classify(ls.err), ls.err || "Cannot reach the remote.");
  const tip = ls.out.split(/\s+/)[0] || "";
  if (tip) {
    const fetched = await runGit(top, ["fetch", "--no-tags", "--no-write-fetch-head", "--no-recurse-submodules", remote,
      `+${NOTES_REF}:${NOTES_TRACKING_REF}`], { timeout: 60_000 });
    if (!fetched.ok) return fail(classify(fetched.err), fetched.err || "Cannot fetch the notes branch.");
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
        return fail(/non-fast-forward|fetch first|stale info|\[rejected\]/i.test(text) && !/pre-push hook|hook declined|رُفض الدفع/.test(text) ? "rejected"
          : classify(text.trim()), text.trim().slice(-400));
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
let lastAttempt: { at: string; result: SyncResult } | null = null;
let inFlight = 0;
/** إرسال متسلسل (لا محاولتان في الوقت نفسه)، مع إعادة واحدة إن سبقنا دفع آخر. لا يرمي أبدًا. */
export const syncStudioNotes = (opts: SyncOpts): Promise<SyncResult> => {
  const run = queue.then(async () => {
    try {
      const first = await syncOnce(opts);
      const r = !first.ok && first.reason === "rejected" ? await syncOnce(opts) : first;
      lastAttempt = { at: new Date().toISOString(), result: r };
      return r;
    } catch (error) {
      const r = { ok: false as const, reason: "error" as const, message: (error as Error).message, notes: [] };
      lastAttempt = { at: new Date().toISOString(), result: r };
      return r;
    }
  });
  queue = run.catch(() => undefined);
  return run;
};

/** While a note waits to be sent, another attempt is made every 10 minutes (QA, 10 Nov 2026). */
export const NOTES_RETRY_MS = 10 * 60_000;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
export const notesRetryPending = () => retryTimer !== null;

/**
 * في الخلفية بعد كل ملاحظة وعند تشغيل الاستوديو: لا ينتظره أحد ولا يُفشل شيئًا.
 * ما دام في الصناديق ما ينتظر الإرسال تُعاد المحاولة كل ١٠ دقائق (مؤقت واحد، لا يُبقي العملية حية)،
 * ويتوقف المؤقت عند أول إرسال ناجح.
 */
export const scheduleStudioNotesSync = (channelsDir: string, log: (m: string) => void = (m) => console.warn(m),
  opts: { retryMs?: number; enabled?: boolean; sync?: typeof syncStudioNotes } = {}): Promise<SyncResult | null> => {
  if (!(opts.enabled ?? notesSyncEnabled())) return Promise.resolve(null);
  inFlight++;
  return (opts.sync ?? syncStudioNotes)({ channelsDir }).finally(() => { inFlight--; }).then((r) => {
    if (!r.ok && r.notes.length) {
      log(`[studio] owner notes kept for later (${r.reason}): ${r.message.split("\n")[0]}`);
      // A copy that is not the owner's Studio never sends: retrying it would only repeat the refusal.
      if (!retryTimer && r.reason !== "not-owner") {
        retryTimer = setTimeout(() => { retryTimer = null; void scheduleStudioNotesSync(channelsDir, log, opts); }, opts.retryMs ?? NOTES_RETRY_MS);
        (retryTimer as { unref?: () => void }).unref?.();
      }
    } else if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    return r;
  });
};

/** What the fixed indicator «ملاحظات لم تُرسل: N» shows (D102/D107): the count and the real reason of the last failure. */
export type NotesStatus = {
  /** Notes kept on this device that have not reached studio-notes. */
  pending: number;
  /** Why the newest of them is still waiting (null while it has not been tried yet). */
  reason: SyncFailure | null;
  /** The last error as Git said it (credentials scrubbed), for «تفاصيل». */
  detail: string | null;
  lastAttemptAt: string | null;
  sending: boolean;
  /** Where they are (channel/episode), newest first. */
  where: { channel: string; episode: string; count: number }[];
};
const FAILURE_RE = /^(offline|rejected|auth|not-owner|no-repo|no-remote|error):\s*/;
export const studioNotesStatus = async (channelsDir: string): Promise<NotesStatus> => {
  let pending = 0, newest: { at: string; lastError?: string } | null = null;
  const where: NotesStatus["where"] = [];
  for (const file of listInboxFiles(channelsDir)) {
    const inbox = await readInboxFile(file).catch(() => null);
    const waiting = inbox?.notes.filter((n) => n.sync?.state !== "sent") ?? [];
    if (!waiting.length) continue;
    pending += waiting.length;
    where.push({ channel: waiting[0]!.channel, episode: waiting[0]!.episode, count: waiting.length });
    for (const n of waiting) {
      const at = n.sync?.at ?? n.createdAt;
      if (!newest || at > newest.at) newest = { at, ...(n.sync?.lastError ? { lastError: n.sync.lastError } : {}) };
    }
  }
  const m = FAILURE_RE.exec(newest?.lastError ?? "");
  return {
    pending,
    reason: pending && m ? (m[1] as SyncFailure) : null,
    detail: pending && m ? newest!.lastError!.slice(m[0].length) || null : null,
    lastAttemptAt: lastAttempt?.at ?? null,
    sending: inFlight > 0,
    where,
  };
};
