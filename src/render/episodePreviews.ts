/**
 * معاينات الحلقة في الاستوديو (previews/ بجوار السكريبت): كل فيديو يُصنع للحلقة يُرفع هنا مباشرة،
 * معاينة كان أو غيرها، لأن المراجعة كلها تجري في الاستوديو (قاعدة صاحب القناة، ٤ نوفمبر ٢٠٢٦).
 * لكل موضوع «خانة» واحدة: أي تعديل يحذف الفيديو القديم ويضع الجديد مكانه، فلا تتراكم نسخ قديمة.
 */
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { resolveScriptPath } from "../script/episodes";

export type PreviewEntry = { title: string; note?: string; version: number; updatedAt: string };
export type PreviewIndex = Record<string, PreviewEntry>;

export const previewsDirFor = (scriptPath: string) => path.join(path.dirname(scriptPath), "previews");
const slotName = (slot: string) => slot.trim().replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();

const readIndex = async (dir: string): Promise<PreviewIndex> => {
  const f = path.join(dir, "index.json");
  if (!existsSync(f)) return {};
  try {
    return JSON.parse(await readFile(f, "utf8")) as PreviewIndex;
  } catch {
    return {};
  }
};

/**
 * يضع الفيديو في خانته: يحذف كل نسخة قديمة للخانة نفسها (ومنها الأسماء القديمة <الخانة>-v2.mp4…)
 * ثم ينسخ الجديد باسم <الخانة>.mp4 ويحدّث index.json برقم النسخة وتاريخها.
 */
export const putPreview = async (scriptPath: string, slot: string, file: string, meta: { title: string; note?: string }) => {
  const name = slotName(slot);
  if (!name) throw new Error("اسم الخانة فارغ.");
  if (!/\.mp4$/i.test(file) || !existsSync(file)) throw new Error(`الفيديو غير موجود أو ليس mp4: ${file}`);
  const dir = previewsDirFor(scriptPath);
  await mkdir(dir, { recursive: true });
  const index = await readIndex(dir);
  const target = `${name}.mp4`;
  const stale = (await readdir(dir)).filter((n) => n !== target && /\.mp4$/i.test(n) && n.startsWith(`${name}-v`));
  const prev = index[target];
  const output = path.join(dir, target);
  const pending = path.join(dir, `.${name}.${randomUUID()}.pending`);
  const pendingIndex = path.join(dir, `.index.${randomUUID()}.pending`);
  // انسخ الملف كاملًا إلى مسار مؤقت، ثم استبدله؛ لا تحذف النسخة الفعّالة مسبقًا.
  try {
    const sourceSize = (await stat(file)).size;
    if (sourceSize === 0) throw new Error("ملف المعاينة فارغ؛ النسخة القديمة محفوظة.");
    await copyFile(file, pending);
    if ((await stat(pending)).size !== sourceSize) throw new Error("نسخ المعاينة غير مكتمل؛ النسخة القديمة محفوظة.");
    const nextIndex = { ...index };
    for (const n of stale) delete nextIndex[n];
    nextIndex[target] = { title: meta.title, note: meta.note, version: (prev?.version ?? stale.length) + 1, updatedAt: new Date().toISOString() };
    await writeFile(pendingIndex, JSON.stringify(nextIndex, null, 2) + "\n");
    await rename(pending, output);
    await rename(pendingIndex, path.join(dir, "index.json"));
    // احذف نسخ الخانة القديمة فقط بعد نجاح استبدال الفيديو والفهرس.
    for (const n of stale) await rm(path.join(dir, n), { force: true });
    return { file: output, removed: stale, version: nextIndex[target]!.version };
  } finally {
    await rm(pending, { force: true });
    await rm(pendingIndex, { force: true });
  }
};

export const putEpisodePreview = async (episode: string, slot: string, file: string, meta: { title: string; note?: string }) => putPreview(await resolveScriptPath(episode), slot, file, meta);

/** حذف خانة من المعاينات */
export const removePreview = async (scriptPath: string, slot: string) => {
  const dir = previewsDirFor(scriptPath);
  const target = `${slotName(slot)}.mp4`;
  const index = await readIndex(dir);
  await rm(path.join(dir, target), { force: true });
  delete index[target];
  if (existsSync(dir)) await writeFile(path.join(dir, "index.json"), JSON.stringify(index, null, 2) + "\n");
};
