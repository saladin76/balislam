/**
 * Who is the owner (owner decision, 9 Nov 2026 — «اجعله بدون كلمة سر»; supersedes D49).
 *
 * The Studio runs only on the owner's own Mac. There is no passphrase, no session token and nothing kept
 * in the browser: a Studio HTTP request IS the owner when, and only when,
 *  - it reached the server over loopback — the socket's real remote address is 127.0.0.1 / ::1 (never a
 *    header such as X-Forwarded-For), and
 *  - it passed the same-origin checks (`isTrustedLocalRequest`: no cross-site sec-fetch-site, a
 *    loopback Origin equal to Host on writes) and its Host header names this machine (DNS-rebinding guard).
 * Any other request is refused (403) by `assertSceneOwner`, whatever it carries.
 *
 * Outside a Studio request (the `bal` CLI or a script the owner runs in his own terminal) the caller is
 * the local process itself, which is the owner. The ledger is still signed with the machine key
 * (BAL_WORKFLOW_HMAC_KEY) exactly as before, and every other gate (scene order, «راجعته بنفسي», board
 * notes, fingerprints, recitation gates, publish permission on exact bytes) is unchanged.
 */
import { AsyncLocalStorage } from "node:async_hooks";

type OwnerRequest = { owner: boolean };
const requestScope = new AsyncLocalStorage<OwnerRequest>();

export const isLoopbackAddress = (address: unknown): boolean =>
  typeof address === "string" && ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address);

/** Host header of this machine only: localhost / 127.0.0.1 / [::1], any port. */
export const isLoopbackHost = (host: unknown): boolean => {
  if (typeof host !== "string" || !host) return false;
  try { return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(`http://${host}`).hostname); }
  catch { return false; }
};

export type OwnerRequestFacts = {
  /** `req.socket.remoteAddress` — from the socket, never from a header. */
  remoteAddress: string | undefined;
  /** The result of the Studio's same-origin check for this request. */
  sameOrigin: boolean;
  host: unknown;
};

/** The Studio API runs every request inside this scope. */
export const runOwnerRequest = <T>(facts: OwnerRequestFacts, fn: () => T): T =>
  requestScope.run({ owner: facts.sameOrigin && isLoopbackAddress(facts.remoteAddress) && isLoopbackHost(facts.host) }, fn);

/** Inside a Studio HTTP request? (false for the CLI and the owner's own scripts) */
export const inStudioRequest = (): boolean => requestScope.getStore() !== undefined;

/** True for a loopback same-origin Studio request, or for the local process outside any request. */
export const isOwnerContext = (): boolean => {
  const scope = requestScope.getStore();
  return scope === undefined || scope.owner;
};
