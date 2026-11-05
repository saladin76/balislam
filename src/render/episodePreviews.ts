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
    await copyFile(file, pending);
    if ((await stat(pending)).size !== sourceSize) throw new Error("نسخ المعاينة غير مكتمل؛ النسخة القديمة محفوظة.");
    const nextIndex = { ...index };
    for (const n of stale) delete nextIndex[n];
    nextIndex[target] = { title: meta.title, note: meta.note, version: (prev?.version ?? stale.length) + 1, updatedAt: new Date().toISOString() };
    await writeFile(pendingIndex, JSON.stringify(nextIndex, null, 2) + "\n");
    if (existsSync(output)) await copyFile(output, backup);
    await rename(pending, output);
    replacedVideo = true;
    await rename(pendingIndex, path.join(dir, "index.json"));
    committedIndex = true;
    // لا تجعل فشل تنظيف نسخة قديمة يُخفي نجاح الاستبدال.
    await Promise.allSettled(stale.map((n) => rm(path.join(dir, n), { force: true })));
    return { file: output, removed: stale.filter((n) => !existsSync(path.join(dir, n))), version: nextIndex[target]!.version };
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
