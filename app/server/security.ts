import type { IncomingMessage } from "node:http";

/**
 * This API intentionally has no user-login layer and is intended for the
 * loopback-only Studio development server. Block cross-site browser requests
 * from other websites (including simple POSTs that do not require CORS
 * preflight) without breaking command-line requests without an Origin header.
 */
export const isTrustedLocalRequest = (req: Pick<IncomingMessage, "method" | "headers">): boolean => {
  const site = req.headers["sec-fetch-site"];
  if (site === "cross-site") return false;
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method ?? "")) return true;
  const origin = req.headers.origin;
  if (!origin) return true;
  if (typeof origin !== "string" || typeof req.headers.host !== "string") return false;
  try {
    const parsed = new URL(origin);
    return parsed.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) &&
      parsed.host === req.headers.host;
  } catch {
    return false;
  }
};
