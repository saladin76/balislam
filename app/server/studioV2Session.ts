/**
 * Studio V2 local owner sessions. No caller-supplied actor, role, username,
 * media validation, localhost header or arbitrary cookie is an authority.
 *
 * STUDIO_V2_OWNER_SECRET: separately configured random >=32-byte secret.
 * STUDIO_V2_OWNER_ID: server-side identity, never accepted from the browser.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

export class StudioV2AuthError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
type Session = { id: string; userId: string; csrf: string; expiresAt: number };
const sessions = new Map<string, Session>();
const failures = new Map<string, { count: number; until: number }>();
const TTL_MS = 4 * 60 * 60 * 1000;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const matches = (a: string, b: string) =>
  timingSafeEqual(Buffer.from(hash(a), "hex"), Buffer.from(hash(b), "hex"));

const ownerConfiguration = () => {
  const secret = process.env.STUDIO_V2_OWNER_SECRET;
  const id = process.env.STUDIO_V2_OWNER_ID;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32 ||
      !id || !/^[\p{L}\p{N}_.@ -]{2,120}$/u.test(id.trim()))
    throw new StudioV2AuthError(503, "V2_OWNER_CONFIGURATION_REQUIRED");
  return { secret, id };
};
const isLoopback = (address: string) =>
  address === "127.0.0.1" || address === "::1" ||
  address === "::ffff:127.0.0.1";
export const assertLocalStudioV2 = (req: IncomingMessage) => {
  const addr = req.socket.remoteAddress ?? "";
  const host = req.headers.host ?? "";
  let parsed: URL;
  try { parsed = new URL("http://" + host); }
  catch { throw new StudioV2AuthError(403, "V2_LOOPBACK_REQUIRED"); }
  if (!isLoopback(addr) ||
      !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname))
    throw new StudioV2AuthError(403, "V2_LOOPBACK_REQUIRED");
};
export const assertStudioV2Origin = (req: IncomingMessage) => {
  assertLocalStudioV2(req);
  const origin = req.headers.origin;
  if (typeof origin !== "string" || origin === "null")
    throw new StudioV2AuthError(403, "V2_ORIGIN_REQUIRED");
  let parsed: URL;
  try { parsed = new URL(origin); }
  catch { throw new StudioV2AuthError(403, "V2_ORIGIN_INVALID"); }
  if (!["http:", "https:"].includes(parsed.protocol) ||
      parsed.host !== req.headers.host || parsed.username || parsed.password ||
      parsed.pathname !== "/" || parsed.search || parsed.hash)
    throw new StudioV2AuthError(403, "V2_CROSS_ORIGIN_REJECTED");
};
const cookieId = (req: IncomingMessage): string | undefined => {
  const pair = (req.headers.cookie ?? "").split(";").map((value) => value.trim())
    .find((value) => value.startsWith("studio_v2_sid="));
  const value = pair?.slice("studio_v2_sid=".length);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : undefined;
};
const setCookie = (req: IncomingMessage, res: ServerResponse, value: string, expires = false) => {
  const secure = (req.socket as { encrypted?: boolean }).encrypted === true;
  res.setHeader("set-cookie", [
    "studio_v2_sid=" + value,
    "Path=/api/studio-v2",
    "HttpOnly", "SameSite=Strict",
    ...(secure ? ["Secure"] : []),
    ...(expires ? ["Max-Age=0"] : []),
  ].join("; "));
};

export const loginStudioV2 = (req: IncomingMessage, res: ServerResponse, body: unknown) => {
  assertStudioV2Origin(req);
  const { secret, id } = ownerConfiguration();
  const addr = req.socket.remoteAddress!;
  const failed = failures.get(addr);
  if (failed && failed.until > Date.now() && failed.count >= 5)
    throw new StudioV2AuthError(429, "V2_LOGIN_RATE_LIMIT");
  const data = body as Record<string, unknown> | null;
  if (!data || typeof data !== "object" || Array.isArray(data) ||
      Object.keys(data).length !== 1 || typeof data.secret !== "string" ||
      !matches(data.secret, secret)) {
    const live = failed && failed.until > Date.now() ? failed.count : 0;
    failures.set(addr, { count: live + 1, until: Date.now() + 15 * 60 * 1000 });
    throw new StudioV2AuthError(401, "V2_BAD_CREDENTIALS");
  }
  failures.delete(addr);
  for (const [key, s] of sessions) if (s.expiresAt <= Date.now()) sessions.delete(key);
  if (sessions.size >= 8) throw new StudioV2AuthError(429, "V2_SESSION_LIMIT");
  const raw = randomBytes(32).toString("hex");
  const session: Session = {
    id: hash(raw), userId: id, csrf: randomBytes(32).toString("hex"),
    expiresAt: Date.now() + TTL_MS,
  };
  sessions.set(session.id, session);
  setCookie(req, res, raw);
  return { authenticated: true as const, role: "owner" as const,
    csrfToken: session.csrf, expiresAt: new Date(session.expiresAt).toISOString() };
};

export const requireStudioV2Session = (req: IncomingMessage): Session => {
  assertLocalStudioV2(req);
  const id = cookieId(req);
  const session = id && sessions.get(hash(id));
  if (!session || session.expiresAt <= Date.now()) {
    if (session) sessions.delete(session.id);
    throw new StudioV2AuthError(401, "V2_SESSION_REQUIRED");
  }
  if (session.userId !== ownerConfiguration().id)
    throw new StudioV2AuthError(401, "V2_SESSION_REVOKED");
  return session;
};
export const requireStudioV2Write = (req: IncomingMessage): Session => {
  assertStudioV2Origin(req);
  const session = requireStudioV2Session(req);
  const csrf = req.headers["x-studio-v2-csrf"];
  if (typeof csrf !== "string" || !matches(csrf, session.csrf))
    throw new StudioV2AuthError(403, "V2_CSRF_REJECTED");
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers["content-type"] ?? ""))
    throw new StudioV2AuthError(415, "V2_JSON_REQUIRED");
  return session;
};
export const logoutStudioV2 = (req: IncomingMessage, res: ServerResponse) => {
  const session = requireStudioV2Write(req);
  sessions.delete(session.id);
  setCookie(req, res, "", true);
};
export const sessionInfoStudioV2 = (req: IncomingMessage) => {
  const session = requireStudioV2Session(req);
  return { authenticated: true, role: "owner", csrfToken: session.csrf,
    expiresAt: new Date(session.expiresAt).toISOString() };
};
