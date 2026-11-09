import path from "node:path";
import { lstatSync } from "node:fs";

/** خطأ برسالة عربية ورمز HTTP محدد (بدل 500 برسالة إنجليزية). */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Accept one filename only; never silently turn a traversal URL into a different file. */
export const safeName = (s: string) => {
  let decoded: string;
  try {
    decoded = decodeURIComponent(s);
  } catch {
    throw new HttpError(400, "اسم الملف غير صالح.");
  }
  if (!decoded || decoded === "." || decoded === ".." ||
      decoded !== path.basename(decoded) || decoded.includes("/") || decoded.includes("\\") || decoded.includes("\0"))
    throw new HttpError(400, "اسم الملف غير صالح.");
  return decoded;
};

/**
 * Media endpoints must not follow a symlink anywhere below the Studio root.
 * Rejecting the whole path prevents cross-channel links in out/, previews/,
 * package/ and shared assets from exposing files outside the requested scope.
 */
export const assertSafeMediaFile = (file: string, root: string): void => {
  const relative = path.relative(root, file);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
    throw new HttpError(404, "ملف الوسائط خارج نطاق Studio.");
  let part = root;
  for (const segment of relative.split(path.sep)) {
    part = path.join(part, segment);
    try {
      if (lstatSync(part).isSymbolicLink())
        throw new HttpError(404, "ملف الوسائط غير متاح عبر رابط رمزي.");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        throw new HttpError(404, "ملف الوسائط غير موجود.");
      throw error;
    }
  }
};

/**
 * Error text sent to the browser never carries an absolute path of the owner's machine
 * (user name, folder layout). Paths under the Studio root become relative; any other absolute
 * path keeps only its last segment. The full error stays in the server log.
 */
export const redactPaths = (message: string, root: string): string => {
  let out = message;
  for (const r of new Set([root, root.replace(/\\/g, "/")])) if (r.length > 1) out = out.split(r + path.sep).join("").split(r + "/").join("").split(r).join(".");
  out = out.replace(/(?:file:\/\/)?\/(?:Users|home|private|var|tmp|Volumes|root|opt|mnt|srv|etc)(?:\/[^\s'"`«»،؛)\]]+)+/g, (m) => `…/${path.posix.basename(m)}`);
  out = out.replace(/\b[A-Za-z]:\\(?:[^\\\s'"`«»،؛)\]]+\\)*[^\\\s'"`«»،؛)\]]*/g, (m) => `…\\${m.split("\\").pop()}`);
  return out;
};

/** A file the request named does not exist: answer 404, not 500. */
export const isMissingFileError = (error: unknown): boolean =>
  (error as NodeJS.ErrnoException)?.code === "ENOENT";
