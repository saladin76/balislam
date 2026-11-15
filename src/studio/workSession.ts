/**
 * «جلسة عمل» (D141، `docs/studio/notes-inbox.md`): زر في رأس الاستوديو يشغّله المالك وهو يعمل على فيديو، فتُعالَج
 * ملاحظاته آليًا خلالها بدل جدول دائم. الاستوديو على ماك المالك لا يستطيع إيقاظ جلسة Claude، فيكتب علمًا واحدًا على
 * الفرع studio-notes، ومهمة مجدولة في السحابة تقرؤه كل ساعة ولا تفعل شيئًا إلا والعلم شغّال.
 *
 * العقد (لا يتغير؛ تقرؤه المهمة المجدولة):
 *   studio-notes:notes/work-session.json =
 *     { "active": true|false, "until": "<ISO-8601 UTC>", "startedAt": "<ISO>", "channel": "<قناة>"|null }
 * يكتبه الاستوديو وحده (Claude لا يكتب على studio-notes)، بالمسار نفسه الذي ترسل به الملاحظات: استوديو المالك وحده
 * (notesSendPolicy)، أوامر سباكة في فهرس مؤقت، دفع بمرجع صريح بلا --force، والخطاف يقبل الشجرة لأنها صناديق ملاحظات
 * وهذا العلم فقط. والطلب نفسه من صفحة الاستوديو على 127.0.0.1 وحدها، وغيره 403 (D54).
 *
 * محليًا تُحفظ آخر جلسة وحالة دفعها في `.studio/work-session.json` (خارج Git)، فيعرض الرأس الحالة وسبب الفشل
 * بالعربية، ويُعاد الدفع وحده. وتنتهي الجلسة وحدها عند `until`: يُكتب active:false عند أول قراءة بعده.
 */
import path from "node:path";
import os from "node:os";
import { existsSync, readdirSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { NOTES_BRANCH_PATH_RE, readResolvedFile, WORK_SESSION_PATH } from "./notesInbox";
import {
  classifyGitFailure, enqueueNotesPush, NOTES_REF, NOTES_TRACKING_REF, notesIdentityEnv, notesRepoTop, notesSendPolicy,
  runGit, scrubGitText, type SyncFailure,
} from "./notesSync";

export type WorkSession = { active: boolean; until: string; startedAt: string; channel: string | null };
/** المدد التي يختار منها المالك (ساعة / ساعتان / ٣ ساعات)، والافتراضية ساعتان. */
export const WORK_SESSION_HOURS = [1, 2, 3] as const;
export const DEFAULT_WORK_SESSION_HOURS = 2;
/** بعد فشل دفع (غير «ليست نسخة المالك») يُعاد عند القراءة التالية بعد هذه المدة. */
export const WORK_SESSION_RETRY_MS = 2 * 60_000;

export type WorkSessionPush =
  | { state: "sent"; at: string; commit: string | null }
  | { state: "failed"; at: string; reason: SyncFailure; message: string };
type LocalState = { session: WorkSession; push: WorkSessionPush | null };
export type WorkSessionStatus = {
  /** آخر جلسة كتبها الاستوديو (active=false بعد «أوقف» أو بعد انتهاء وقتها)، أو null إن لم تبدأ جلسة قط. */
  session: WorkSession | null;
  /** شغّالة الآن: active ولم يأتِ `until`. */
  live: boolean;
  push: WorkSessionPush | null;
  /** آخر ملاحظة عالجها Claude (notes/resolved.json على main بعد السحب)، وكم ملاحظة عولجت منذ بدء الجلسة. */
  lastResolved: { at: string; count: number; sinceStart: number } | null;
  hours: readonly number[];
};

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
export const isWorkSession = (x: unknown): x is WorkSession => {
  const w = x as WorkSession;
  return Boolean(w && typeof w.active === "boolean" && typeof w.until === "string" && ISO_RE.test(w.until)
    && typeof w.startedAt === "string" && ISO_RE.test(w.startedAt)
    && (w.channel === null || (typeof w.channel === "string" && /^[a-z0-9-]+$/.test(w.channel))));
};

/** جلسة جديدة: من الآن إلى الآن + المدة، بتوقيت UTC. */
export const buildWorkSession = (hours: number, now: Date = new Date(), channel: string | null = null): WorkSession => {
  if (!WORK_SESSION_HOURS.includes(hours as 1 | 2 | 3)) throw Error(`مدة جلسة العمل ساعة أو ساعتان أو ٣ ساعات، لا ${hours}.`);
  return { active: true, until: new Date(now.getTime() + hours * 3_600_000).toISOString(), startedAt: now.toISOString(), channel };
};
export const workSessionLive = (w: WorkSession | null | undefined, now: number = Date.now()) =>
  Boolean(w?.active && Date.parse(w.until) > now);
/** الملف كما يُكتب على الفرع: الحقول الأربعة بترتيبها، لا غيرها. */
export const workSessionJson = (w: WorkSession) =>
  JSON.stringify({ active: w.active, until: w.until, startedAt: w.startedAt, channel: w.channel }, null, 2) + "\n";

/** جذر المستودع الذي فيه مجلد القنوات (ولو لم يُنشأ المجلد بعد: أقرب أب موجود). */
const topFor = async (channelsDir: string): Promise<string | null> => {
  let dir = path.resolve(channelsDir);
  while (!existsSync(dir) && path.dirname(dir) !== dir) dir = path.dirname(dir);
  return notesRepoTop(dir).catch(() => null);
};
/** الحالة المحلية بجوار المستودع الذي فيه مجلد القنوات (على جهاز المالك: جذر المستودع). */
const localFileFor = async (channelsDir: string) =>
  path.join((await topFor(channelsDir)) ?? path.dirname(channelsDir), ".studio", "work-session.json");
const readLocal = async (file: string): Promise<LocalState | null> => {
  try {
    const data = JSON.parse(await readFile(file, "utf8")) as LocalState;
    return isWorkSession(data?.session) ? { session: data.session, push: data.push ?? null } : null;
  } catch { return null; }
};
const writeLocal = async (file: string, state: LocalState) => {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${randomUUID()}.tmp`;
  try { await writeFile(tmp, JSON.stringify(state, null, 2) + "\n"); await rename(tmp, file); }
  finally { await rm(tmp, { force: true }); }
};

export type WorkSessionPushResult =
  | { ok: true; pushed: boolean; commit: string | null }
  | { ok: false; reason: SyncFailure; message: string };
type PushOpts = { channelsDir: string; remote?: string; env?: NodeJS.ProcessEnv; platform?: NodeJS.Platform };

const pushOnce = async (session: WorkSession, opts: PushOpts): Promise<WorkSessionPushResult> => {
  const remote = opts.remote ?? "origin";
  const fail = (reason: SyncFailure, message: string): WorkSessionPushResult => ({ ok: false, reason, message: scrubGitText(message).slice(-400) });
  const top = await topFor(opts.channelsDir);
  if (!top) return fail("no-repo", "The channels folder is not inside a Git repository.");
  const remoteUrl = await runGit(top, ["remote", "get-url", remote]);
  if (!remoteUrl.ok) return fail("no-remote", `No Git remote named ${remote}.`);
  // KI-008: only the owner's Studio writes to his box; decided before any network call.
  const policy = await notesSendPolicy(top, remoteUrl.out, opts.env ?? process.env, opts.platform ?? process.platform);
  if (!policy.ok) return fail("not-owner", policy.why);
  const ls = await runGit(top, ["ls-remote", "--refs", remote, NOTES_REF], { timeout: 30_000 });
  if (!ls.ok) return fail(classifyGitFailure(ls.err), ls.err || "Cannot reach the remote.");
  const tip = ls.out.split(/\s+/)[0] || "";
  if (tip) {
    const fetched = await runGit(top, ["fetch", "--no-tags", "--no-write-fetch-head", "--no-recurse-submodules", remote,
      `+${NOTES_REF}:${NOTES_TRACKING_REF}`], { timeout: 60_000 });
    if (!fetched.ok) return fail(classifyGitFailure(fetched.err), fetched.err || "Cannot fetch the notes branch.");
  }
  const body = workSessionJson(session);
  if (tip) {
    const current = await runGit(top, ["show", `${tip}:${WORK_SESSION_PATH}`]);
    if (current.ok && current.out + "\n" === body) return { ok: true, pushed: false, commit: tip };
  }
  const tmp = await mkdtemp(path.join(os.tmpdir(), "bal-work-session-index-"));
  try {
    const idx = { GIT_INDEX_FILE: path.join(tmp, "index") };
    const where = await runGit(top, ["rev-parse", "--git-path", "index"], { env: idx });
    if (!where.ok || path.resolve(top, where.out) !== path.resolve(idx.GIT_INDEX_FILE))
      return fail("error", "Refusing to build the work-session commit outside a temporary index.");
    const read = tip ? await runGit(top, ["read-tree", tip], { env: idx }) : await runGit(top, ["read-tree", "--empty"], { env: idx });
    if (!read.ok) return fail("error", read.err);
    const blob = await runGit(top, ["hash-object", "-w", "--stdin"], { input: body });
    if (!blob.ok) return fail("error", blob.err);
    const add = await runGit(top, ["update-index", "--add", "--cacheinfo", `100644,${blob.out},${WORK_SESSION_PATH}`], { env: idx });
    if (!add.ok) return fail("error", add.err);
    const tree = await runGit(top, ["write-tree"], { env: idx });
    if (!tree.ok) return fail("error", tree.err);
    const names = await runGit(top, ["ls-tree", "-r", "--name-only", tree.out]);
    if (!names.ok || names.out.split("\n").filter(Boolean).some((n) => !NOTES_BRANCH_PATH_RE.test(n)))
      return fail("error", "The notes tree contains a non-notes path.");
    const made = await runGit(top, ["commit-tree", tree.out, ...(tip ? ["-p", tip] : []), "-m",
      `studio work session: ${session.active ? `on until ${session.until}` : "off"}\n\n${WORK_SESSION_PATH}`], { env: await notesIdentityEnv(top) });
    if (!made.ok) return fail("error", made.err);
    const push = await runGit(top, ["push", "--porcelain", "--no-follow-tags", "--recurse-submodules=no", remote,
      `${made.out}:${NOTES_REF}`], { timeout: 120_000 });
    if (!push.ok) {
      const text = `${push.out}\n${push.err}`.trim();
      return fail(/non-fast-forward|fetch first|stale info|\[rejected\]/i.test(text) && !/pre-push hook|hook declined|رُفض الدفع/.test(text)
        ? "rejected" : classifyGitFailure(text), text);
    }
    await runGit(top, ["update-ref", NOTES_TRACKING_REF, made.out]);
    return { ok: true, pushed: true, commit: made.out };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
};

/** دفع العلم في طابور الملاحظات نفسه، مع إعادة واحدة إن سبقنا دفع آخر. لا يرمي أبدًا. */
export const pushWorkSession = (session: WorkSession, opts: PushOpts): Promise<WorkSessionPushResult> =>
  enqueueNotesPush(async () => {
    try {
      const first = await pushOnce(session, opts);
      return !first.ok && first.reason === "rejected" ? await pushOnce(session, opts) : first;
    } catch (error) {
      return { ok: false as const, reason: "error" as const, message: scrubGitText((error as Error).message) };
    }
  });

const toPush = (r: WorkSessionPushResult): WorkSessionPush => r.ok
  ? { state: "sent", at: new Date().toISOString(), commit: r.commit }
  : { state: "failed", at: new Date().toISOString(), reason: r.reason, message: r.message };

const save = async (channelsDir: string, session: WorkSession, opts: Omit<PushOpts, "channelsDir">) => {
  const file = await localFileFor(channelsDir);
  // النية تُحفظ أولًا، فلا تضيع إن فشل الدفع: يُعاد وحده.
  await writeLocal(file, { session, push: null });
  const r = await pushWorkSession(session, { channelsDir, ...opts });
  await writeLocal(file, { session, push: toPush(r) });
  return r;
};

/** «ابدأ جلسة عمل» */
export const startWorkSession = async (opts: PushOpts & { hours?: number; channel?: string | null; now?: Date }) => {
  const session = buildWorkSession(opts.hours ?? DEFAULT_WORK_SESSION_HOURS, opts.now ?? new Date(), opts.channel ?? null);
  const result = await save(opts.channelsDir, session, opts);
  return { session, result };
};

/** «أوقف»: active=false، ويبقى until وstartedAt كما كانا. */
export const stopWorkSession = async (opts: PushOpts & { now?: Date }) => {
  const prev = (await readLocal(await localFileFor(opts.channelsDir)))?.session;
  const now = (opts.now ?? new Date()).toISOString();
  const session: WorkSession = prev ? { ...prev, active: false } : { active: false, until: now, startedAt: now, channel: null };
  const result = await save(opts.channelsDir, session, opts);
  return { session, result };
};

/** كل ردود Claude تحت مجلد القنوات (الصندوق العام لكل قناة وصندوق كل حلقة). */
export const lastResolvedNotes = async (channelsDir: string, since?: string | null) => {
  const files: string[] = [];
  if (existsSync(channelsDir)) for (const ch of readdirSync(channelsDir)) {
    files.push(path.join(channelsDir, ch, "notes", "resolved.json"));
    const eps = path.join(channelsDir, ch, "episodes");
    if (existsSync(eps)) for (const ep of readdirSync(eps)) files.push(path.join(eps, ep, "notes", "resolved.json"));
  }
  let at = "", count = 0, sinceStart = 0;
  for (const file of files) {
    if (!existsSync(file)) continue;
    const r = await readResolvedFile(file).catch(() => null);
    for (const res of Object.values(r?.resolutions ?? {})) {
      if (typeof res?.at !== "string") continue;
      count++;
      if (since && res.at >= since) sinceStart++;
      if (res.at > at) at = res.at;
    }
  }
  return at ? { at, count, sinceStart } : null;
};

/**
 * ما يعرضه الرأس. يُنهي الجلسة عند `until` (يُكتب active:false)، ويعيد دفعًا فشل (غير «ليست نسخة المالك») بعد
 * WORK_SESSION_RETRY_MS. الدفع هنا لا يُنتظر إلا حين يُطلب (`wait`)، فلا يبطئ القراءة.
 */
export const workSessionStatus = async (opts: PushOpts & { now?: number; wait?: boolean }): Promise<WorkSessionStatus> => {
  const now = opts.now ?? Date.now();
  const file = await localFileFor(opts.channelsDir);
  let state = await readLocal(file);
  if (state) {
    const expired = state.session.active && Date.parse(state.session.until) <= now;
    const retry = state.push?.state === "failed" && state.push.reason !== "not-owner" && now - Date.parse(state.push.at) >= WORK_SESSION_RETRY_MS;
    if (expired || retry) {
      const session = expired ? { ...state.session, active: false } : state.session;
      state = { session, push: state.push };
      const work = save(opts.channelsDir, session, opts).catch(() => undefined);
      if (opts.wait) { await work; state = (await readLocal(file)) ?? state; }
    }
  }
  return {
    session: state?.session ?? null,
    live: workSessionLive(state?.session, now),
    push: state?.push ?? null,
    lastResolved: await lastResolvedNotes(opts.channelsDir, state?.session.startedAt),
    hours: WORK_SESSION_HOURS,
  };
};
