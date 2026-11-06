/**
 * ستوري بورد المختبرات (ملحق الأمر 015، استوديو «بالإسلام»): حفظ صور الستوري بورد في مجلد المختبر
 * (`storyboards/` بجوار lab.json) بكل نسخها، وعرضها في «مختبرات الإنتاج».
 * - الرفع لا يحذف شيئًا ولا يمس `previews/`: كل نسخة صورة مستقلة ‎<الخانة>-v<الرقم>.<الامتداد>‎، والفهرس `storyboards/index.json`.
 * - كل رفع «جاهز للمراجعة». «معتمد فنيًا» و«يحتاج تعديلًا» لا تُسجَّل إلا بقرار صريح فيه اسم صاحبه ونصه (`decideLabStoryboard`).
 * - معزول: القنوات في LAB_STORYBOARD_CHANNELS وحدها.
 */
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  IMAGE_EXT,
  STORYBOARD_STATUSES,
  labStoryboardsEnabled,
  slotName,
  toEntries,
  type StoryboardEntry,
  type StoryboardIndex,
  type StoryboardStatus,
  type StoryboardVersion,
} from "./labStoryboardsShared";
import { listLabDirs } from "./labs";

export * from "./labStoryboardsShared";

export const storyboardsDirFor = (labDir: string) => path.join(labDir, "storyboards");

const readIndex = async (dir: string): Promise<StoryboardIndex> => {
  const f = path.join(dir, "index.json");
  if (!existsSync(f)) return {};
  try {
    return JSON.parse(await readFile(f, "utf8")) as StoryboardIndex;
  } catch {
    throw new Error(`فهرس الستوري بورد تالف: ${f}؛ لم يُغيَّر شيء.`);
  }
};
/** كتابة ذرية للفهرس: ملف مؤقت ثم إعادة تسمية */
const writeIndex = async (dir: string, index: StoryboardIndex) => {
  const tmp = path.join(dir, `.index-${randomUUID()}.json`);
  await writeFile(tmp, JSON.stringify(index, null, 2) + "\n");
  await rename(tmp, path.join(dir, "index.json"));
};

/** مجلد مختبر القناة من رقمه (900) أو اسم مجلده، داخل مجلد حلقاتها */
export const resolveLabDir = async (episodesDir: string, arg: string): Promise<string> => {
  const dirs = await listLabDirs(episodesDir);
  const hit = dirs.filter((d) => d === arg || d.startsWith(`${arg}-`));
  if (hit.length !== 1) throw new Error(hit.length ? `أكثر من مختبر يطابق ${arg}: ${hit.join("، ")}` : `لا مختبر بالرقم ${arg} في هذه القناة`);
  return path.join(episodesDir, hit[0]!);
};

/**
 * يضيف نسخة جديدة لخانة: ينسخ الصورة باسم مستقل ولا يحذف أي نسخة سابقة، والحالة «جاهز للمراجعة».
 */
export const addLabStoryboard = async (
  channel: string,
  labDir: string,
  slot: string,
  source: string,
  meta: { title: string; note?: string; order?: string; uploadedAt?: string; /** عنوان الموضوع (الخانة) إن اختلف عن عنوان النسخة */ topic?: string },
): Promise<{ file: string; version: number }> => {
  if (!labStoryboardsEnabled(channel)) throw new Error(`ستوري بورد المختبرات غير مفعّل لقناة ${channel}`);
  if (!existsSync(path.join(labDir, "lab.json"))) throw new Error(`ليس مختبرًا: ${labDir}`);
  if (!IMAGE_EXT.test(source)) throw new Error("الستوري بورد صورة (png أو jpg أو webp)؛ الفيديو يُرفع بـ upload-preview");
  const size = existsSync(source) ? (await stat(source)).size : 0;
  if (!size) throw new Error(`الصورة غير موجودة أو فارغة: ${source}`);
  const s = slotName(slot);
  if (!s) throw new Error("اسم الخانة فارغ");
  if (!meta.title?.trim()) throw new Error("العنوان مطلوب");
  const dir = storyboardsDirFor(labDir);
  await mkdir(dir, { recursive: true });
  const index = await readIndex(dir);
  const cur = index[s] ?? { title: meta.topic ?? meta.title, versions: [] };
  const version = Math.max(0, ...cur.versions.map((v) => v.version)) + 1;
  const file = `${s}-v${version}${path.extname(source).toLowerCase()}`;
  const out = path.join(dir, file);
  if (existsSync(out)) throw new Error(`النسخة موجودة مسبقًا ولن تُستبدل: ${file}`);
  await copyFile(source, out);
  if ((await stat(out)).size !== size) {
    await rm(out, { force: true });
    throw new Error("نسخ الصورة غير مكتمل؛ لم يُغيَّر الفهرس.");
  }
  const entry: StoryboardVersion = { version, file, title: meta.title, ...(meta.note ? { note: meta.note } : {}), source: path.basename(source), uploadedAt: meta.uploadedAt ?? new Date().toISOString(), status: "review" };
  index[s] = { title: meta.topic ?? (cur.title || meta.title), ...(meta.order ?? cur.order ? { order: meta.order ?? cur.order } : {}), versions: [...cur.versions, entry] };
  try {
    await writeIndex(dir, index);
  } catch (e) {
    await rm(out, { force: true });
    throw e;
  }
  return { file: out, version };
};

/**
 * يسجل قرار صاحب القناة على نسخة. «معتمد فنيًا» و«يحتاج تعديلًا» تتطلبان اسم صاحب القرار ونصه؛
 * و«جاهز للمراجعة» يعيدها للمراجعة (ويُحفظ القرار السابق في نصه إن وُجد، فلا يضيع سجله).
 */
export const decideLabStoryboard = async (
  channel: string,
  labDir: string,
  slot: string,
  version: number,
  d: { status: StoryboardStatus; by: string; note: string; at?: string },
): Promise<StoryboardVersion> => {
  if (!labStoryboardsEnabled(channel)) throw new Error(`ستوري بورد المختبرات غير مفعّل لقناة ${channel}`);
  if (!STORYBOARD_STATUSES.includes(d.status)) throw new Error(`حالة غير معروفة: ${d.status}`);
  if (!d.by?.trim()) throw new Error("صاحب القرار مطلوب");
  if (!d.note?.trim()) throw new Error("نص القرار مطلوب (ما اعتُمد، أو ما يحتاج تعديلًا)");
  const dir = storyboardsDirFor(labDir);
  const index = await readIndex(dir);
  const s = index[slotName(slot)];
  const v = s?.versions.find((x) => x.version === version);
  if (!s || !v) throw new Error(`لا نسخة ${version} في الخانة ${slot}`);
  v.status = d.status;
  v.decision = { at: d.at ?? new Date().toISOString(), by: d.by.trim(), note: d.note.trim() };
  await writeIndex(dir, index);
  return v;
};

/** خانات الستوري بورد لمختبر، الأحدث أولًا (فارغة إن لم يوجد المجلد) */
export const listLabStoryboards = async (labDir: string): Promise<StoryboardEntry[]> => {
  const dir = storyboardsDirFor(labDir);
  if (!existsSync(dir)) return [];
  const entries = toEntries(await readIndex(dir));
  return entries.map((e) => {
    const missing = e.versions.filter((v) => !existsSync(path.join(dir, v.file))).map((v) => `${e.slot} v${v.version}: الصورة مفقودة ${v.file}`);
    return missing.length ? { ...e, problems: [...e.problems, ...missing] } : e;
  });
};

/** مسار صورة نسخة للخدمة: داخل storyboards/ فقط، وصورة فقط */
export const labStoryboardFile = (labDir: string, name: string): string | null => {
  const base = path.basename(name);
  if (base !== name || !IMAGE_EXT.test(base)) return null;
  const f = path.join(storyboardsDirFor(labDir), base);
  return existsSync(f) ? f : null;
};
