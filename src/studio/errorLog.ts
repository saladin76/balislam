/**
 * سجل الأخطاء المحلي على جهاز المالك (العمل ٣ من مرحلة الاستقرار، D112): `.studio/errors.jsonl`.
 *
 * سطر JSON لكل خطأ غير متوقع: من الخادم (استثناء في مسار) أو من الواجهة (حاجز الأخطاء، `window.onerror`،
 * `unhandledrejection`). الملف في `.studio/` (في .gitignore، وخارج ملفات المحتوى في D101) فلا يدخل Git أبدًا؛
 * وما يخرج منه إلى صندوق الملاحظات («أرسل المشكلة») يُنقَّح مرة ثانية قبل الخروج.
 *
 * لا سر في أي سطر: كل قيمة في .env (ومنها مفتاح الجهاز BAL_WORKFLOW_HMAC_KEY ومفتاح الصوت) تُحجب حرفًا، ومعها أنماط
 * الصلاحيات المعروفة (رموز GitHub، `sk_…`، Bearer وAuthorization، `NAME=value` لاسم سري) والصلاحية المضمّنة في رابط
 * git، والمسارات المطلقة لجهاز المالك (اسم المستخدم).
 */
import path from "node:path";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { childEnv } from "../../scripts/git-env.mjs";
import { redactSecrets, SECRET_NAME } from "./redact";
export { redactSecrets };

export type ErrorSource = "server" | "ui";
export type ErrorKind = "route" | "render" | "window" | "rejection";
export type ErrorRecord = {
  id: string;
  at: string;
  source: ErrorSource;
  kind: ErrorKind;
  /** The API path (server) or the Studio address (UI, the hash). */
  route: string;
  method?: string;
  message: string;
  stack: string;
  channel: string | null;
  episode: string | null;
  sceneId: string | null;
  /** UI: which screen («شاشة المشاهد»…). */
  label?: string | null;
  /** The commit the Studio runs (short), or "unknown". */
  commit: string;
};

const MAX_MESSAGE = 2_000;
const MAX_STACK = 6_000;
const MAX_STACK_LINES = 30;
/** The file is trimmed to its last KEEP_LINES lines once it passes MAX_FILE_BYTES. */
const MAX_FILE_BYTES = 1_000_000;
const KEEP_LINES = 500;

export const errorsFileFor = (root: string, env: NodeJS.ProcessEnv = process.env) =>
  env.BAL_ERRORS_FILE || path.join(root, ".studio", "errors.jsonl");

/** Every value in the .env file (all of them: nothing from .env leaves the machine), plus secret-named env values. */
export const secretValues = (root: string, env: NodeJS.ProcessEnv = process.env): string[] => {
  const out = new Set<string>();
  const file = env.BAL_ENV_FILE || path.join(root, ".env");
  try {
    if (existsSync(file)) for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = /^\s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=\s*(.*)$/.exec(line);
      const v = m?.[1]?.trim().replace(/^(["'])(.*)\1$/, "$2").trim();
      if (v && v.length >= 6) out.add(v);
    }
  } catch { /* unreadable .env: the patterns below still apply */ }
  const nameRe = new RegExp(`^${SECRET_NAME}$`, "i");
  for (const [k, v] of Object.entries(env)) if (v && v.length >= 8 && nameRe.test(k)) out.add(v);
  // longest first, so a value that contains another is masked whole
  return [...out].sort((a, b) => b.length - a.length);
};

let commitCache: { root: string; at: number; value: string } | null = null;
/** The short commit the Studio runs (cached a minute: D101 restarts the server on a code update anyway). */
export const studioCommit = (root: string): string => {
  if (commitCache && commitCache.root === root && Date.now() - commitCache.at < 60_000) return commitCache.value;
  const r = spawnSync("git", ["rev-parse", "--short=12", "HEAD"], { cwd: root, encoding: "utf8", env: childEnv({ GIT_OPTIONAL_LOCKS: "0" }), timeout: 5_000 });
  const value = r.status === 0 && /^[0-9a-f]{7,40}$/.test(r.stdout.trim()) ? r.stdout.trim() : "unknown";
  commitCache = { root, at: Date.now(), value };
  return value;
};

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);
const cleanStack = (s: string) => clip(s.split("\n").slice(0, MAX_STACK_LINES).join("\n"), MAX_STACK);

const EPISODE_RE = /^\d{3}$/;
const SCENE_RE = /^c\d{1,3}-s\d{1,3}[a-z0-9-]*$/;
const CHANNEL_RE = /^[a-z0-9][a-z0-9-]{0,40}$/;
/** channel / episode / scene from an API path (`/api/episodes/001/…/c1-s2`). */
export const routeContext = (pathname: string): { episode: string | null; sceneId: string | null } => {
  const parts = pathname.split("/").filter(Boolean);
  const i = parts.indexOf("episodes");
  const episode = i >= 0 && EPISODE_RE.test(parts[i + 1] ?? "") ? parts[i + 1]! : null;
  const sceneId = parts.find((p) => SCENE_RE.test(p)) ?? null;
  return { episode, sceneId };
};

export type ErrorInput = Omit<ErrorRecord, "id" | "at" | "commit" | "channel" | "episode" | "sceneId" | "stack"> & {
  stack?: string | null; channel?: string | null; episode?: string | null; sceneId?: string | null;
};

/** One redacted record, ready to append. */
export const makeErrorRecord = (root: string, input: ErrorInput, env: NodeJS.ProcessEnv = process.env): ErrorRecord => {
  const values = secretValues(root, env);
  const r = (s: string | null | undefined) => redactSecrets(String(s ?? ""), { values, root });
  const pick = (v: string | null | undefined, re: RegExp) => (v && re.test(v) ? v : null);
  return {
    id: `e${randomBytes(5).toString("hex")}`,
    at: new Date().toISOString(),
    source: input.source === "ui" ? "ui" : "server",
    kind: (["route", "render", "window", "rejection"] as const).includes(input.kind) ? input.kind : "route",
    route: clip(r(input.route), 500),
    ...(input.method ? { method: clip(r(input.method), 10) } : {}),
    message: clip(r(input.message).trim() || "Error", MAX_MESSAGE),
    stack: cleanStack(r(input.stack)),
    channel: pick(input.channel, CHANNEL_RE),
    episode: pick(input.episode, EPISODE_RE),
    sceneId: pick(input.sceneId, SCENE_RE),
    ...(input.label !== undefined ? { label: input.label ? clip(r(input.label), 120) : null } : {}),
    commit: studioCommit(root),
  };
};

const chains = new Map<string, Promise<unknown>>();
const serialized = <T>(file: string, work: () => Promise<T>): Promise<T> => {
  const run = (chains.get(file) ?? Promise.resolve()).then(work, work);
  chains.set(file, run.catch(() => undefined));
  return run;
};

/** Appends one record made by makeErrorRecord (never throws: a failing log must not fail the request that crashed). */
export const writeErrorRecord = async (root: string, record: ErrorRecord, env: NodeJS.ProcessEnv = process.env): Promise<ErrorRecord | null> => {
  try {
    const file = errorsFileFor(root, env);
    await serialized(file, async () => {
      await mkdir(path.dirname(file), { recursive: true });
      await appendFile(file, JSON.stringify(record) + "\n", { encoding: "utf8", mode: 0o600 });
      const text = await readFile(file, "utf8");
      if (Buffer.byteLength(text) > MAX_FILE_BYTES) await writeFile(file, text.split("\n").filter(Boolean).slice(-KEEP_LINES).join("\n") + "\n", "utf8");
    });
    return record;
  } catch (error) {
    console.error("[studio] error log:", (error as Error).message);
    return null;
  }
};
export const appendErrorRecord = (root: string, input: ErrorInput, env: NodeJS.ProcessEnv = process.env): Promise<ErrorRecord | null> =>
  writeErrorRecord(root, makeErrorRecord(root, input, env), env);

/** The records in the file, oldest first (a damaged line is skipped). */
export const readErrorRecords = async (file: string): Promise<ErrorRecord[]> => {
  let text = "";
  try { text = await readFile(file, "utf8"); } catch { return []; }
  const out: ErrorRecord[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line) as ErrorRecord;
      if (r && typeof r.id === "string" && typeof r.message === "string") out.push(r);
    } catch { /* a torn line */ }
  }
  return out;
};

/** The last `n` lines of the log, each one short and redacted again («آخر ٢٠ سطرًا من السجل» in an error note). */
export const lastLogLines = (records: readonly ErrorRecord[], n = 20, opts: { values?: readonly string[]; root?: string } = {}): string[] =>
  records.slice(-n).map((r) => redactSecrets(
    `${r.at} ${r.source}/${r.kind} ${r.method ? `${r.method} ` : ""}${r.route}${r.episode ? ` ep ${r.episode}` : ""}${r.sceneId ? ` ${r.sceneId}` : ""} [${r.id}] ${r.message.split("\n")[0]!.slice(0, 200)}`,
    opts));

export type ErrorGroup = { message: string; count: number; firstAt: string; lastAt: string; lastId: string; sources: string[]; routes: string[] };
/** `bal errors`: grouped by the first line of the message, newest group first. */
export const groupErrors = (records: readonly ErrorRecord[]): ErrorGroup[] => {
  const map = new Map<string, ErrorGroup>();
  for (const r of records) {
    const key = r.message.split("\n")[0]!.trim();
    const g = map.get(key) ?? { message: key, count: 0, firstAt: r.at, lastAt: r.at, lastId: r.id, sources: [], routes: [] };
    g.count++;
    if (r.at >= g.lastAt) { g.lastAt = r.at; g.lastId = r.id; }
    if (r.at < g.firstAt) g.firstAt = r.at;
    const src = `${r.source}/${r.kind}`;
    if (!g.sources.includes(src)) g.sources.push(src);
    if (r.route && !g.routes.includes(r.route) && g.routes.length < 3) g.routes.push(r.route);
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
};

export const formatErrorGroups = (groups: readonly ErrorGroup[], limit = 20): string =>
  groups.slice(0, limit).map((g) => [
    `(${g.count}) × ${g.message}`,
    `   آخر مرة ${g.lastAt}  [${g.lastId}]  ${g.sources.join("، ")}${g.count > 1 ? `  أول مرة ${g.firstAt}` : ""}`,
    ...(g.routes.length ? [`   ${g.routes.join("  ")}`] : []),
  ].join("\n")).join("\n\n");
