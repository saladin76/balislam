/**
 * معاينات الحلقة في الاستوديو (previews/ بجوار السكريبت): كل فيديو يُصنع للحلقة يُرفع هنا مباشرة،
 * معاينة كان أو غيرها، لأن المراجعة كلها تجري في الاستوديو (قاعدة صاحب القناة، ٤ نوفمبر ٢٠٢٦).
 * لكل موضوع «خانة» ظاهرة واحدة، مع حفظ كل فيديو سابق في history بدلاً من إتلافه.
 */
import { existsSync } from "node:fs";
import { copyFile, link, mkdir, readFile, readdir, rename, rm, rmdir, stat, writeFile } from "node:fs/promises";
import { assertNoLinkedPath, copyUnlinkedFile, ensureUnlinkedDirectory } from "./fsIsolation";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import path from "node:path";
import { resolveEpisodeDir } from "../script/episodes";

/**
 * `version` عدّاد مرات الرفع في الخانة («رفع رقم»)، وليس رقم إصدار المحتوى؛ إصدار المحتوى يُكتب في العنوان («نسخة المحتوى V7»).
 * `sha256` و`size` بصمة الفيديو نفسه: الفهرس وحده يُحفظ في Git، والفيديو على Google Drive (قرار صاحب المشروع، ٨ نوفمبر).
 * `drive` رابط الملف على Drive حين يُرفع من خارج جهاز المالك.
 */
export type PreviewDrive = { id: string; url: string };
export type PreviewEntry = { title: string; note?: string; version: number; updatedAt: string; sha256?: string; size?: number; drive?: PreviewDrive };
export type PreviewIndex = Record<string, PreviewEntry>;

export const previewsDirFor = (scriptPath: string) => path.join(path.dirname(scriptPath), "previews");

/**
 * مجلد Google Drive المتزامن على جهاز المالك (Google Drive for desktop)، مثل
 * ~/Library/CloudStorage/GoogleDrive-…/My Drive/balislam-previews. فيه <القناة>/<مجلد الحلقة>/<الخانة>.mp4.
 * غير مضبوط = لا نسخ إلى Drive، والمعاينة تبقى محلية فقط.
 */
export const driveMirrorRoot = (): string | null => {
  const v = process.env.BAL_DRIVE_PREVIEWS_DIR?.trim();
  return v ? path.resolve(v.replace(/^~(?=\/)/, process.env.HOME ?? "~")) : null;
};
/** مكان نسخة Drive لمعاينة في مجلد الحلقة (episodeDir = channels/<ch>/episodes/<dir>) */
export const driveMirrorFile = (episodeDir: string, name: string): string | null => {
  const root = driveMirrorRoot();
  if (!root) return null;
  const channel = path.basename(path.dirname(path.dirname(episodeDir)));
  return path.join(root, channel, path.basename(episodeDir), name);
};
export const fileSha256 = (file: string) => new Promise<string>((resolve, reject) => {
  const h = createHash("sha256");
  createReadStream(file).on("data", (c) => h.update(c)).on("error", reject).on("end", () => resolve(h.digest("hex")));
});
const verified = new Map<string, string>();
/** بصمة ملف مع ذاكرة بحسب (المسار، الحجم، وقت التعديل) حتى لا يُعاد حساب فيديو كبير في كل طلب */
const cachedSha = async (file: string) => {
  const st = await stat(file);
  const key = `${file}\0${st.size}\0${st.mtimeMs}`;
  const hit = verified.get(key);
  if (hit) return hit;
  const sha = await fileSha256(file);
  verified.set(key, sha);
  return sha;
};

export type PreviewLocation =
  | { kind: "local"; file: string }
  | { kind: "drive-mirror"; file: string }
  | { kind: "drive-link"; url: string }
  | { kind: "missing" };
/**
 * أين يُشغَّل الفيديو: نسخة محلية في previews/، أو نسخة Drive المتزامنة إن طابقت بصمتها الفهرس،
 * أو رابط Drive. لا تُعرض نسخة Drive تخالف البصمة المسجلة (قد تكون نسخة قديمة لم تتزامن بعد).
 */
export const locatePreview = async (episodeDir: string, name: string, entry?: PreviewEntry): Promise<PreviewLocation> => {
  const local = path.join(episodeDir, "previews", name);
  if (existsSync(local)) return { kind: "local", file: local };
  const mirror = driveMirrorFile(episodeDir, name);
  if (mirror && existsSync(mirror) && (!entry?.sha256 || await cachedSha(mirror) === entry.sha256))
    return { kind: "drive-mirror", file: mirror };
  if (entry?.drive?.url) return { kind: "drive-link", url: entry.drive.url };
  return { kind: "missing" };
};

/** ينسخ المعاينة إلى مجلد Drive المتزامن (إن ضُبط)؛ فشل النسخ لا يُفشل الرفع المحلي بل يُعاد في النتيجة. */
const mirrorToDrive = async (episodeDir: string, name: string, file: string): Promise<string | null> => {
  const target = driveMirrorFile(episodeDir, name);
  if (!target) return null;
  await mkdir(path.dirname(target), { recursive: true });
  const tmp = `${target}.${randomUUID()}.part`;
  try {
    await copyFile(file, tmp);
    await rename(tmp, target);
    return target;
  } finally {
    await rm(tmp, { force: true });
  }
};
const slotName = (slot: string) => {
  if (!/^[a-z0-9][a-z0-9_-]{0,80}$/i.test(slot))
    throw new Error("اسم خانة المعاينة غير آمن؛ استخدم أحرفًا لاتينية وأرقامًا وشرطات فقط.");
  return slot.toLowerCase();
};

/** نسخة سابقة واحدة فقط لكل خانة في history (احتياطًا للرجوع)، حتى لا تكبر المساحة على جهاز المالك. */
export const PREVIEW_HISTORY_KEEP = 1;
const pruneHistory = async (history: string) => {
  if (!existsSync(history)) return;
  const files = await Promise.all((await readdir(history)).filter((n) => /\.mp4$/i.test(n))
    .map(async (n) => ({ n, t: (await stat(path.join(history, n))).mtimeMs })));
  files.sort((a, b) => b.t - a.t);
  for (const f of files.slice(PREVIEW_HISTORY_KEEP)) await rm(path.join(history, f.n), { force: true });
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
    const sha256 = await fileSha256(pending);
    nextIndex[target] = { title: meta.title, note: meta.note, version: (prev?.version ?? stale.length) + 1, updatedAt: new Date().toISOString(), sha256, size: sourceSize };
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
    await pruneHistory(history);
    let drive: string | null = null;
    let driveError: string | undefined;
    try { drive = await mirrorToDrive(path.dirname(scriptPath), target, output); }
    catch (e) { driveError = (e as Error).message; }
    return { file: output, removed, version: nextIndex[target]!.version, sha256, drive, driveError };
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
    await pruneHistory(history);
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

/**
 * يسجّل رابط Google Drive لمعاينة رُفعت إلى Drive من خارج جهاز المالك، مع بصمتها.
 * الفيديو نفسه لا يدخل Git؛ يكفي الفهرس ليعرف الاستوديو ما يجب أن يجده ويتحقق منه.
 */
export const linkDrivePreview = async (episode: string, slot: string, info: { id: string; sha256: string; size: number; title: string; note?: string }) => {
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(info.id)) throw new Error("معرّف ملف Drive غير صالح.");
  if (!/^[a-f0-9]{64}$/.test(info.sha256)) throw new Error("بصمة sha256 غير صالحة.");
  if (!Number.isInteger(info.size) || info.size <= 0) throw new Error("حجم الملف غير صالح.");
  const dir = previewsDirFor(path.join(await resolveEpisodeDir(episode), "script.md"));
  const target = `${slotName(slot)}.mp4`;
  return withPreviewIndexLock(dir, async () => {
    const index = await readIndex(dir);
    const prev = index[target];
    const local = path.join(dir, target);
    // نسخة محلية مختلفة لا تبقى معروضة بجوار رابط أحدث منها
    if (existsSync(local) && await fileSha256(local) !== info.sha256) {
      const history = path.join(dir, "history", slotName(slot));
      await ensureUnlinkedDirectory(history);
      await rename(local, path.join(history, `previous-${randomUUID()}.mp4`));
      await pruneHistory(history);
    }
    index[target] = { title: info.title, note: info.note, version: (prev?.version ?? 0) + 1, updatedAt: new Date().toISOString(),
      sha256: info.sha256, size: info.size, drive: { id: info.id, url: `https://drive.google.com/file/d/${info.id}/view` } };
    const pending = path.join(dir, `.index.${randomUUID()}.pending`);
    try {
      await writeFile(pending, JSON.stringify(index, null, 2) + "\n", { flag: "wx", mode: 0o600 });
      await rename(pending, path.join(dir, "index.json"));
    } finally {
      await rm(pending, { force: true });
    }
    return index[target]!;
  });
};

/** قائمة المعاينات للاستوديو: من الفهرس والملفات المحلية معًا، مع مكان تشغيل كل منها */
export const listEpisodePreviews = async (episodeDir: string) => {
  const dir = path.join(episodeDir, "previews");
  const index = existsSync(dir) ? await readIndex(dir) : {};
  const names = new Set([...Object.keys(index).filter((n) => /\.mp4$/i.test(n)),
    ...(existsSync(dir) ? (await readdir(dir)).filter((n) => /\.mp4$/i.test(n)) : [])]);
  const out = [];
  for (const name of names) {
    const entry = index[name];
    const where = await locatePreview(episodeDir, name, entry);
    const st = where.kind === "local" || where.kind === "drive-mirror" ? await stat(where.file) : null;
    out.push({ name, title: entry?.title ?? name, note: entry?.note ?? "", version: entry?.version ?? 1,
      updatedAt: entry?.updatedAt ?? null, size: st?.size ?? entry?.size ?? 0,
      mtime: st?.mtimeMs ?? (entry?.updatedAt ? Date.parse(entry.updatedAt) : 0),
      source: where.kind, driveUrl: entry?.drive?.url ?? null });
  }
  return out.sort((a, b) => b.mtime - a.mtime);
};
