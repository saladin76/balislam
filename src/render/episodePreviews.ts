import path from "node:path";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";

/**
 * قاعدة القناة: كل فيديو يُصنع للحلقة (معاينة أو غيرها) يُرفع نسخة منه إلى الاستوديو مباشرة،
 * وأي تعديل يحذف الفيديو القديم من خانته ويضع الجديد مكانه.
 * المكان: previews/ داخل مجلد الحلقة (متتبَّع في Git، فيصل إلى جهاز صاحب القناة مع تحديث الاستوديو)،
 * والفهرس previews.json يحدد لكل «خانة» ملفًا واحدًا فقط.
 */
export type PreviewEntry = {
  /** خانة ثابتة للفيديو (عينة-أ، عينة-ب، الفصل-1…)؛ النسخة الجديدة تحل محل القديمة */
  slot: string;
  title: string;
  file: string;
  /** preview: معاينة لا تُنشر (1080p، قد تكون بلا صوت) */
  quality: "preview" | "master";
  voiced: boolean;
  scenes: string[];
  branch?: string;
  seconds: number;
  createdAt: string;
  version: number;
  motion?: { narrative: number; sacred: number | null; total: number };
  note?: string;
};

export const previewsDirFor = (scriptPath: string) => path.join(path.dirname(scriptPath), "previews");
const indexFile = (scriptPath: string) => path.join(previewsDirFor(scriptPath), "previews.json");

export const loadPreviews = async (scriptPath: string): Promise<PreviewEntry[]> => {
  const f = indexFile(scriptPath);
  if (!existsSync(f)) return [];
  try {
    const list = JSON.parse(await readFile(f, "utf8")) as PreviewEntry[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

export const safeSlot = (s: string) => s.trim().replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "") || "preview";

/** يضع الفيديو في خانته ويحذف ما كان فيها؛ يعيد الفهرس بعد التحديث */
export const publishPreview = async (scriptPath: string, src: string, entry: Omit<PreviewEntry, "file" | "createdAt" | "version" | "seconds"> & { seconds?: number }): Promise<PreviewEntry[]> => {
  const dir = previewsDirFor(scriptPath);
  await mkdir(dir, { recursive: true });
  const slot = safeSlot(entry.slot);
  const list = await loadPreviews(scriptPath);
  const old = list.find((e) => e.slot === slot);
  const version = (old?.version ?? 0) + 1;
  // اسم جديد لكل نسخة حتى لا يعرض المتصفح النسخة القديمة من ذاكرته
  const file = `${slot}-v${version}.mp4`;
  for (const f of await readdir(dir)) if (f.startsWith(`${slot}-v`) && f.endsWith(".mp4")) await rm(path.join(dir, f));
  await copyFile(src, path.join(dir, file));
  const size = (await stat(path.join(dir, file))).size;
  if (!size) throw new Error("ملف الفيديو فارغ؛ لم يُرفع.");
  const next: PreviewEntry = { ...entry, slot, file, version, seconds: entry.seconds ?? 0, createdAt: new Date().toISOString() };
  const updated = [next, ...list.filter((e) => e.slot !== slot)];
  await writeFile(indexFile(scriptPath), JSON.stringify(updated, null, 2) + "\n", "utf8");
  return updated;
};

/** يحذف خانة وملفها */
export const removePreview = async (scriptPath: string, slot: string) => {
  const list = await loadPreviews(scriptPath);
  const hit = list.find((e) => e.slot === slot);
  if (hit) await rm(path.join(previewsDirFor(scriptPath), hit.file), { force: true });
  await writeFile(indexFile(scriptPath), JSON.stringify(list.filter((e) => e.slot !== slot), null, 2) + "\n", "utf8");
};
