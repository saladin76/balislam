/**
 * جلسة المالك الدائمة على جهازه (قرار صاحب القناة، ٩ نوفمبر ٢٠٢٦، D49).
 *
 * The owner types the passphrase once; the server verifies it and issues a random 32-byte session
 * token. Only an HMAC of the token (keyed by the local machine key BAL_WORKFLOW_HMAC_KEY, never in Git)
 * is kept, in a git-ignored local file next to `.env` (`.studio/owner-sessions.json`, mode 0600). The
 * browser keeps the token in localStorage, so a refresh or a Studio restart does not ask again.
 *
 * Strictness kept on purpose:
 *  - a token is a credential only for HTTP requests that reached the Studio over loopback
 *    (127.0.0.1 / ::1). The API wraps each request in `runOwnerRequest(remoteAddress, …)`; outside that
 *    scope (CLI, scripts, tests calling services directly) a token is never accepted — the CLI keeps
 *    asking for the passphrase;
 *  - every record is bound to the current passphrase hash: changing the passphrase (or editing `.env`)
 *    revokes every token, even if the file were left behind;
 *  - a record written by hand into the file is worthless without the machine key (the id is an HMAC);
 *  - «أغلق الجلسة» revokes the token on the server; the ledger is still signed by the machine key
 *    exactly as before, and neither the token nor the passphrase is ever written into it.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { projectRoot } from "../config/paths";
import { workflowSigningKey } from "../workflow/trust";

const PREFIX = "bos_";
const TOKEN_RE = /^bos_[a-f0-9]{64}$/;
const MAX_SESSIONS = 20;

type SessionRecord = { id: string; bind: string; createdAt: string };
type SessionFile = { version: 1; sessions: SessionRecord[] };

/** The sessions file lives beside the local .env (git-ignored `.studio/`). */
export const ownerSessionsFile = (): string => {
  if (process.env.BAL_OWNER_SESSIONS_FILE) return process.env.BAL_OWNER_SESSIONS_FILE;
  const envFile = process.env.BAL_ENV_FILE ?? path.join(projectRoot, ".env");
  return path.join(path.dirname(envFile), ".studio", "owner-sessions.json");
};

const passHash = (): string | null => {
  const h = process.env.BAL_STUDIO_OWNER_PASSPHRASE_SHA256?.trim();
  return h && /^[a-f0-9]{64}$/.test(h) ? h : null;
};
const sha = (v: string) => createHash("sha256").update(v).digest("hex");
const tokenId = (token: string) =>
  createHmac("sha256", workflowSigningKey()).update(`studio-owner-session-v1\0${token}`).digest("hex");
const bindingFor = (hash: string) =>
  createHmac("sha256", workflowSigningKey()).update(`studio-owner-session-bind-v1\0${hash}`).digest("hex");
const same = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));

const read = (): SessionFile => {
  const file = ownerSessionsFile();
  if (!existsSync(file)) return { version: 1, sessions: [] };
  try {
    const doc = JSON.parse(readFileSync(file, "utf8"));
    const sessions = Array.isArray(doc?.sessions) ? doc.sessions.filter((s: any) =>
      s && /^[a-f0-9]{64}$/.test(s.id) && /^[a-f0-9]{64}$/.test(s.bind) && typeof s.createdAt === "string") : [];
    return { version: 1, sessions };
  } catch { return { version: 1, sessions: [] }; } // a damaged file fails closed: no session is valid
};
const write = (doc: SessionFile) => {
  const file = ownerSessionsFile();
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(doc, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  renameSync(tmp, file);
  try { chmodSync(file, 0o600); } catch { /* best effort on filesystems without modes */ }
};

/* ---------- request scope: loopback only ---------- */

type OwnerRequest = { loopback: boolean };
const requestScope = new AsyncLocalStorage<OwnerRequest>();
export const isLoopbackAddress = (address: unknown): boolean =>
  typeof address === "string" && ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address);
/** The Studio API runs every request inside this scope with the socket's real remote address (no headers). */
export const runOwnerRequest = <T>(remoteAddress: string | undefined, fn: () => T): T =>
  requestScope.run({ loopback: isLoopbackAddress(remoteAddress) }, fn);
export const inLoopbackOwnerRequest = (): boolean => requestScope.getStore()?.loopback === true;

/* ---------- issue / verify / revoke ---------- */

export const looksLikeOwnerSessionToken = (value: unknown): value is string =>
  typeof value === "string" && TOKEN_RE.test(value);

/**
 * Issue a token AFTER the caller verified the passphrase (sceneService.openOwnerSession does both).
 * Only an HMAC of the token is stored; the raw token is returned once, to the browser.
 */
export const issueOwnerSessionToken = (): string => {
  const hash = passHash();
  if (!hash) throw new Error("Set the owner passphrase in the Studio first.");
  if (!inLoopbackOwnerRequest()) throw new Error("The owner session opens only on this device (loopback).");
  const token = `${PREFIX}${randomBytes(32).toString("hex")}`;
  const bind = bindingFor(hash);
  const doc = read();
  // Drop sessions of an older passphrase; keep the most recent few (one per browser/device profile).
  const live = doc.sessions.filter((s) => same(s.bind, bind));
  live.push({ id: tokenId(token), bind, createdAt: new Date().toISOString() });
  write({ version: 1, sessions: live.slice(-MAX_SESSIONS) });
  return token;
};

/** True only for a current, unrevoked token of the current passphrase, inside a loopback request. */
export const verifyOwnerSessionToken = (token: unknown): boolean => {
  if (!looksLikeOwnerSessionToken(token)) return false;
  if (!inLoopbackOwnerRequest()) return false;
  const hash = passHash();
  if (!hash) return false;
  let id: string; let bind: string;
  try { id = tokenId(token); bind = bindingFor(hash); } catch { return false; }
  return read().sessions.some((s) => same(s.id, id) && same(s.bind, bind));
};

/** «أغلق الجلسة»: removes this token's record (no-op for an unknown token). */
export const revokeOwnerSessionToken = (token: unknown): void => {
  if (!looksLikeOwnerSessionToken(token)) return;
  let id: string;
  try { id = tokenId(token); } catch { return; }
  const doc = read();
  const rest = doc.sessions.filter((s) => !same(s.id, id));
  if (rest.length !== doc.sessions.length) write({ version: 1, sessions: rest });
};

/** Changing the passphrase revokes every session (the binding check would refuse them anyway). */
export const revokeAllOwnerSessions = (): void => {
  rmSync(ownerSessionsFile(), { force: true });
};

/** For tests/diagnostics: how many sessions are stored (never their contents). */
export const ownerSessionCount = (): number => read().sessions.length;
/** Exposed for tests: the stored id is not the token nor its plain hash. */
export const _plainSha = sha;
