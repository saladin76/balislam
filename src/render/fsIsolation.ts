import path from "node:path";
import { constants } from "node:fs";
import { lstat, mkdir, open, link, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";

/** macOS exposes /var and /tmp as trusted system aliases under /private. */
export const absoluteMediaPath = (input: string) => {
  const p = path.resolve(input);
  return process.platform === "darwin" && /^\/(var|tmp)(\/|$)/.test(p) ? `/private${p}` : p;
};

const pathSegments = (input: string) => {
  const full = absoluteMediaPath(input);
  const root = path.parse(full).root;
  return { root, parts: full.slice(root.length).split(path.sep).filter(Boolean) };
};

/** Reject nested symlinks, not only a symlink on the final file. */
export const assertNoLinkedPath = async (input: string, file = false): Promise<void> => {
  const { root, parts } = pathSegments(input);
  let current = root;
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]!);
    const stat = await lstat(current);
    if (stat.isSymbolicLink() || (i < parts.length - 1 || !file) && !stat.isDirectory() ||
        (i === parts.length - 1 && file && !stat.isFile()))
      throw new Error(`مسار وسيط غير آمن (رابط رمزي أو نوع غير متوقع): ${current}`);
  }
};

/** Create each directory without following pre-existing directory symlinks. */
export const ensureUnlinkedDirectory = async (input: string): Promise<void> => {
  const { root, parts } = pathSegments(input);
  let current = root;
  for (const part of parts) {
    current = path.join(current, part);
    try {
      await mkdir(current, { mode: 0o700 });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
    const st = await lstat(current);
    if (!st.isDirectory() || st.isSymbolicLink())
      throw new Error(`مجلد وسيط غير آمن (رابط رمزي): ${current}`);
  }
};

/** Source is opened with O_NOFOLLOW and copied by file descriptor, not by a
 * followable source pathname. Source parent symlinks are rejected as well. */
export const copyUnlinkedFile = async (source: string, destination: string): Promise<string> => {
  await assertNoLinkedPath(source, true);
  await assertNoLinkedPath(path.dirname(destination));
  const read = await open(absoluteMediaPath(source), constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    if (!(await read.stat()).isFile()) throw new Error("مصدر وسيط غير آمن.");
    const write = await open(absoluteMediaPath(destination), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    const { createHash } = await import("node:crypto");
    const hash = createHash("sha256");
    try {
      const buffer = Buffer.allocUnsafe(256 * 1024);
      while (true) {
        const { bytesRead } = await read.read(buffer, 0, buffer.length, null);
        if (!bytesRead) break;
        hash.update(buffer.subarray(0, bytesRead));
        let cursor = 0;
        while (cursor < bytesRead) {
          const { bytesWritten } = await write.write(buffer, cursor, bytesRead - cursor);
          if (!bytesWritten) throw new Error("فشل كتابة نسخة الوسيط.");
          cursor += bytesWritten;
        }
      }
    } finally {
      await write.close();
    }
    return hash.digest("hex");
  } finally {
    await read.close();
  }
};

/** Publish a fully written file atomically WITHOUT replacing an older output.
 * If the preferred name exists, choose a unique revision name and return it.
 * Hard links make existence testing and publication one atomic operation. */
export const publishOutputWithoutOverwrite = async (partial: string, preferred: string): Promise<string> => {
  // Validate the paths BEFORE comparing their directories. A linked output
  // parent is a security failure even when it is also a different directory.
  await assertNoLinkedPath(partial, true);
  await assertNoLinkedPath(path.dirname(preferred));
  if (absoluteMediaPath(path.dirname(partial)) !== absoluteMediaPath(path.dirname(preferred)))
    throw new Error("يجب أن يكون الملف المرحلي داخل المجلد نفسه المخصص للمخرج لضمان النشر الذري.");
  const ext = path.extname(preferred);
  for (let n = 0; n < 5; n++) {
    const candidate = n === 0 ? preferred : preferred.slice(0, -ext.length) + `-revision-${randomUUID()}${ext}`;
    try {
      await link(absoluteMediaPath(partial), absoluteMediaPath(candidate));
      await unlink(absoluteMediaPath(partial));
      return candidate;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
  }
  throw new Error("تعذّر إنشاء نسخة جديدة دون الكتابة فوق ملف سابق.");
};

/**
 * A caller-supplied episode output path has no authority to escape its episode.
 * Check it before staging audio or starting any Remotion/Chrome work.
 */
export const assertEpisodeOutputConfined = async (scriptPath: string, output: string): Promise<void> => {
  if (typeof output !== "string" || !/\.mp4$/i.test(output))
    throw new Error("ملف الرندر النهائي يجب أن يكون MP4.");
  const root = path.join(path.dirname(scriptPath), "out");
  const relative = path.relative(root, output);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
    throw new Error("يجب حفظ فيديو الحلقة داخل out/ للحلقة المختارة فقط.");
  // No parent symlink is accepted; do not follow links into another episode.
  await ensureUnlinkedDirectory(path.dirname(output));
};
