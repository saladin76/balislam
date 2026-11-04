/**
 * معاينات الحلقة في الاستوديو (previews/ بجوار السكريبت): كل فيديو يُصنع للحلقة يُرفع هنا مباشرة،
 * معاينة كان أو غيرها، لأن المراجعة كلها تجري في الاستوديو (قاعدة صاحب القناة، ٤ نوفمبر ٢٠٢٦).
 * لكل موضوع «خانة» واحدة: أي تعديل يحذف الفيديو القديم ويضع الجديد مكانه، فلا تتراكم نسخ قديمة.
 */
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
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
  const stale = (await readdir(dir)).filter((n) => n !== target && /\.mp4$/i.test(n) && (n === `${name}.mp4` || n.startsWith(`${name}-v`)));
  for (const n of stale) {
    await rm(path.join(dir, n), { force: true });
    delete index[n];
  }
  const prev = index[target];
  await copyFile(file, path.join(dir, target));
  index[target] = { title: meta.title, note: meta.note, version: (prev?.version ?? stale.length) + 1, updatedAt: new Date().toISOString() };
  await writeFile(path.join(dir, "index.json"), JSON.stringify(index, null, 2) + "\n");
  return { file: path.join(dir, target), removed: stale, version: index[target]!.version };
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
