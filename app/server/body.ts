import type { IncomingMessage } from "node:http";
import { HttpError } from "./util.ts";

/** Preserve the largest existing Base64 media-upload path, but never buffer unbounded requests. */
export const MAX_BODY_BYTES = 180 * 1024 * 1024;

export const readBody = async (req: IncomingMessage, maxBytes = MAX_BODY_BYTES): Promise<any> => {
  const length = Number(req.headers["content-length"] ?? 0);
  if (!Number.isFinite(length) || length > maxBytes)
    throw new HttpError(413, "حجم الطلب أكبر من الحد المسموح.");
  const chunks: Buffer[] = [];
  let received = 0;
  for await (const chunk of req) {
    const piece = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    received += piece.length;
    if (received > maxBytes) throw new HttpError(413, "حجم الطلب أكبر من الحد المسموح.");
    chunks.push(piece);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, "بيانات الطلب غير صالحة.");
  }
};
