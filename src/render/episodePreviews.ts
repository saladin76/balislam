/**
 * معاينات الحلقة في الاستوديو (previews/ بجوار السكريبت): كل فيديو يُصنع للحلقة يُرفع هنا مباشرة،
 * معاينة كان أو غيرها، لأن المراجعة كلها تجري في الاستوديو (قاعدة صاحب القناة، ٤ نوفمبر ٢٠٢٦).
 * لكل موضوع «خانة» ظاهرة واحدة، مع حفظ كل فيديو سابق في history بدلاً من إتلافه.
 */
import { existsSync } from "node:fs";
import { copyFile, link, mkdir, readFile, readdir, rename, rm, rmdir, stat, writeFile } from "node:fs/promises";
import { assertNoLinkedPath, copyUnlinkedFile, ensureUnlinkedDirectory } from "./fsIsolation";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { resolveEpisodeDir } from "../script/episodes";

/** `version` عدّاد مرات الرفع في الخانة («رفع رقم»)، وليس رقم إصدار المحتوى؛ إصدار المحتوى يُكتب في العنوان («نسخة المحتوى V7»). */
export type PreviewEntry = { title: string; note?: string; version: number; updatedAt: string };
export type PreviewIndex = Record<string, PreviewEntry>;

export const previewsDirFor = (scriptPath: string) => path.join(path.dirname(scriptPath), "previews");
const slotName = (slot: string) => {
  if (!/^[a-z0-9][a-z0-9_-]{0,80}$/i.test(slot))
    throw new Error("اسم خانة المعاينة غير آمن؛ استخدم أحرفًا لاتينية وأرقامًا وشرطات فقط.");
  return slot.toLowerCase();
};

/** One serialized writer per episode preview index. A crash keeps the lock
 * rather than allowing another worker to overwrite a version accidentally. */
const withPreviewIndexLock = async <T>(dir: string, work: () => Promise<T>): Promise<T> => {
  await ensureUnlinkedDirectory(dir);
  const lock = path.join(dir, ".preview-index.lock");
  await mkdir(lock, { mode: 0o700 });
  try {
    return await work();
  } finally {
    await rmdir(lock);
  }
};

const readIndex = async (dir: string): Promise<PreviewIndex> => {
  const f = path.join(dir, "index.json");
  if (!existsSync(f)) return {};
  await assertNoLinkedPath(f, true);
  try {
    const data = JSON.parse(await readFile(f, "utf8")) as PreviewIndex;
    if (!data || Array.isArray(data) || typeof data !== "object") throw new Error("Invalid preview index");
    return data;
  } catch (e) {
    throw new Error(`فهرس المعاينات غير صالح؛ لن يُستبدل أي إصدار سابق: ${(e as Error).message}`);
  }
};

/**
 * يحدّث اسم العرض فقط بعد أرشفة كل نسخة سابقة داخل history؛
 * ويمنع تجاوز صلاحية الخانة أو التخلص من النسخ التاريخية.
 */
export const putPreview = async (scriptPath: string, slot: string, file: string, meta: { title: string; note?: string }) => {
  const name = slotName(slot);
  if (!name) throw new Error("اسم الخانة فارغ.");
  if (!/\.mp4$/i.test(file) || !existsSync(file)) throw new Error(`الفيديو غير موجود أو ليس mp4: ${file}`);
  const dir = previewsDirFor(scriptPath);
  await assertNoLinkedPath(path.dirname(scriptPath));
  await assertNoLinkedPath(file, true);
  await ensureUnlinkedDirectory(dir);
  return withPreviewIndexLock(dir, async () => {
  const history = path.join(dir, "history", name);
  await ensureUnlinkedDirectory(history);
  const index = await readIndex(dir);
  const target = `${name}.mp4`;
  const stale = (await readdir(dir)).filter((n) => n !== target && /\.mp4$/i.test(n) && n.startsWith(`${name}-v`) && /^v\d+\.mp4$/i.test(n.slice(name.length + 1)));
  const prev = index[target];
  const output = path.join(dir, target);
  const pending = path.join(dir, `.${name}.${randomUUID()}.pending`);
  const pendingIndex = path.join(dir, `.index.${randomUUID()}.pending`);
  const backup = path.join(dir, `.${name}.${randomUUID()}.backup`);
  let replacedVideo = false;
  let committedIndex = false;
  // جهّز بديلًا صالح الحجم قبل لمس النسخة الحالية.
  try {
    const sourceSize = (await stat(file)).size;
    if (sourceSize === 0) throw new Error("ملف المعاينة فارغ؛ النسخة القديمة محفوظة.");
    await copyUnlinkedFile(file, pending);
    if ((await stat(pending)).size !== sourceSize) throw new Error("نسخ المعاينة غير مكتمل؛ النسخة القديمة محفوظة.");
    const nextIndex = { ...index };
    for (const n of stale) delete nextIndex[n];
    nextIndex[target] = { title: meta.title, note: meta.note, version: (prev?.version ?? stale.length) + 1, updatedAt: new Date().toISOString() };
    await writeFile(pendingIndex, JSON.stringify(nextIndex, null, 2) + "\n");
    if (existsSync(output)) {
      await assertNoLinkedPath(output, true);
      // Keep the previous byte-perfect file version before updating the slot
      // alias used by the UI. Hardlink is atomic and preserves the old inode.
      await link(output, path.join(history, `previous-${randomUUID()}.mp4`));
      await copyFile(output, backup);
    }
    await rename(pending, output);
    replacedVideo = true;
    await rename(pendingIndex, path.join(dir, "index.json"));
    committedIndex = true;
    // Archive old named versions too. Never destroy another revision's bytes.
    const removed: string[] = [];
    for (const n of stale) {
      const file = path.join(dir, n);
      if (!existsSync(file)) continue;
      await assertNoLinkedPath(file, true);
      await rename(file, path.join(history, `${randomUUID()}-${n}`));
      removed.push(n);
    }
    return { file: output, removed, version: nextIndex[target]!.version };
  } catch (error) {
    // إذا فشل تحديث الفهرس، أعد الفيديو السابق لتظل النسخة المعروضة والفهرس متوافقين.
    if (replacedVideo && !committedIndex) {
      if (existsSync(backup)) await rename(backup, output);
      else await rm(output, { force: true });
    }
    throw error;
  } finally {
    await Promise.allSettled([rm(pending, { force: true }), rm(pendingIndex, { force: true }), rm(backup, { force: true })]);
  }
  });
};

// المعاينات تخص مجلد الحلقة (ومنه مختبر المحرك الذي لا سكريبت له)
export const putEpisodePreview = async (episode: string, slot: string, file: string, meta: { title: string; note?: string }) => putPreview(path.join(await resolveEpisodeDir(episode), "script.md"), slot, file, meta);

/** حذف خانة من المعاينات */
export const removePreview = async (scriptPath: string, slot: string) => {
  const dir = previewsDirFor(scriptPath);
  const name = slotName(slot);
  const target = `${name}.mp4`;
  await withPreviewIndexLock(dir, async () => {
  const index = await readIndex(dir);
  const output = path.join(dir, target);
  if (existsSync(output)) {
    await assertNoLinkedPath(output, true);
    const history = path.join(dir, "history", name);
    await ensureUnlinkedDirectory(history);
    await link(output, path.join(history, `removed-${randomUUID()}.mp4`));
    await rm(output, { force: true });
  }
  delete index[target];
  const pending = path.join(dir, `.index.${randomUUID()}.pending`);
  try {
    await writeFile(pending, JSON.stringify(index, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    await rename(pending, path.join(dir, "index.json"));
  } finally {
    await rm(pending, { force: true });
  }
  });
};
