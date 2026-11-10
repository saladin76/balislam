import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * This API intentionally has no user-login layer and is intended for the loopback-only Studio server
 * on the owner's own machine (owner decision 9 Nov, D54: the owner IS a loopback, same-origin Studio
 * request). One rule for every route (docs/studio/workflow-gates.md «حماية الخادم»):
 *
 *  - every /api request: Host names this machine (localhost / 127.0.0.1 / [::1], any port — the DNS
 *    rebinding guard) and Sec-Fetch-Site is never cross-site / same-site;
 *  - every write (any method other than GET / HEAD / OPTIONS) additionally: the socket's real remote
 *    address is loopback, and the browser proves the page itself sent it — an Origin equal to
 *    http://<Host>, or (without Origin) Sec-Fetch-Site: same-origin. A write with neither is refused:
 *    the `bal` CLI does not use HTTP, so only a forged or foreign client would send one.
 *
 * Every response of the Studio (HTML and API) also refuses to be framed (clickjacking): see
 * `applyStudioSecurityHeaders`.
 */

type Req = Pick<IncomingMessage, "method" | "headers"> & { socket?: { remoteAddress?: string } | null };

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
export const isWriteMethod = (method: string | undefined): boolean => !READ_METHODS.has((method ?? "GET").toUpperCase());

const LOOPBACK_NAMES = ["localhost", "127.0.0.1", "[::1]"];
export const isLoopbackSocket = (address: unknown): boolean =>
  typeof address === "string" && ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address);
export const isLoopbackHostHeader = (host: unknown): boolean => {
  if (typeof host !== "string" || !host || /[\s/@\\?#]/.test(host)) return false;
  try { return LOOPBACK_NAMES.includes(new URL(`http://${host}`).hostname); }
  catch { return false; }
};

const header = (req: Req, name: string): string | undefined => {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
};

/** Origin equal to this very server (http://<Host>) on a loopback name. */
const sameOriginHeader = (origin: string, host: string): boolean => {
  try {
    const o = new URL(origin);
    return o.protocol === "http:" && LOOPBACK_NAMES.includes(o.hostname) && o.host === host && origin.replace(/\/$/, "") === o.origin;
  } catch {
    return false;
  }
};

/** Why the request is refused (Arabic, for the 403 body), or null when it may proceed. */
export const studioRequestRefusal = (req: Req): string | null => {
  const host = header(req, "host");
  if (!isLoopbackHostHeader(host)) return "الاستوديو يُفتح من هذا الجهاز فقط (localhost / 127.0.0.1).";
  const site = header(req, "sec-fetch-site");
  if (site === "cross-site" || site === "same-site") return "طلب من موقع خارجي غير مسموح به في Studio المحلي.";
  if (!isWriteMethod(req.method)) return null;
  if (!isLoopbackSocket(req.socket?.remoteAddress)) return "التعديل مسموح من الاستوديو على جهاز المالك فقط.";
  const origin = header(req, "origin");
  if (origin !== undefined) {
    if (!sameOriginHeader(origin, host!)) return "طلب من موقع خارجي غير مسموح به في Studio المحلي.";
    return null;
  }
  if (site === "same-origin") return null;
  return "طلب تعديل بلا Origin ولا Sec-Fetch-Site مرفوض: يُرسل من صفحة الاستوديو نفسها فقط.";
};

/**
 * The same-origin part of the rule (kept for `ownerContext.runOwnerRequest`): no cross-site fetch, a
 * loopback Host, and on writes a same-origin Origin or Sec-Fetch-Site. (The loopback socket is checked
 * separately by the owner context, from the socket itself.)
 */
export const isTrustedLocalRequest = (req: Req): boolean =>
  studioRequestRefusal({ method: req.method, headers: req.headers, socket: { remoteAddress: "127.0.0.1" } }) === null;

/** Anti-framing on every Studio response (H1, clickjacking). */
export const STUDIO_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "frame-ancestors 'none'",
};
export const applyStudioSecurityHeaders = (res: Pick<ServerResponse, "setHeader">): void => {
  for (const [k, v] of Object.entries(STUDIO_SECURITY_HEADERS)) res.setHeader(k, v);
  // A later handler (Vite's own 404/error pages set «default-src 'none'») must not drop the anti-framing:
  // any CSP it sets keeps frame-ancestors 'none', and X-Frame-Options stays DENY.
  const r = res as ServerResponse & { __studioFrameGuard?: boolean };
  if (r.__studioFrameGuard) return;
  r.__studioFrameGuard = true;
  const set = r.setHeader.bind(r);
  r.setHeader = ((name: string, value: number | string | readonly string[]) => {
    const n = name.toLowerCase();
    if (n === "x-frame-options") return set(name, "DENY");
    if (n === "content-security-policy") {
      const v = (Array.isArray(value) ? value.join("; ") : String(value)).trim();
      return set(name, /frame-ancestors/i.test(v) ? v.replace(/frame-ancestors[^;]*/i, "frame-ancestors 'none'") : `${v.replace(/;\s*$/, "")}${v ? "; " : ""}frame-ancestors 'none'`);
    }
    return set(name, value as string);
  }) as ServerResponse["setHeader"];
};
