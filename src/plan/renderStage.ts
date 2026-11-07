import path from "node:path";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, mkdtemp, open, readFile, readdir, rename, rm, rmdir, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { assertNoLinkedPath, copyUnlinkedFile, ensureUnlinkedDirectory } from "../render/fsIsolation";

export type RenderStageFile = { kind: "voice" | "sfx" | "recitations" | "images"; name: string; source: string };
export type RenderStageOptions = { publicRoot: string; signal?: AbortSignal };
type FileDigest = { kind: RenderStageFile["kind"]; name: string; sha256: string };
type Manifest = { version: 1; digest: string; files: FileDigest[]; salt?: string };
const kinds = ["voice", "sfx", "recitations", "images"] as const;
const renderPattern = /^_render\/([a-z0-9]+(?:-[a-z0-9]+)*)\/([0-9]{3}-[a-z0-9]+(?:-[a-z0-9]+)*)\/$/;

const assertLive = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new Error("أُلغيت تهيئة وسائط الرندر؛ لم تُمس ملفات أي مهمة أخرى.");
};
const sha256File = async (file: string) => {
  await assertNoLinkedPath(file, true);
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const hash = createHash("sha256");
    const buffer = Buffer.allocUnsafe(256 * 1024);
    while (true) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (!bytesRead) break;
      hash.update(buffer.subarray(0, bytesRead));
    }
    return hash.digest("hex");
  } finally {
    await handle.close();
  }
};
const safeName = (name: string) =>
  name !== "." && name !== ".." && name.length > 0 && name.length <= 240 &&
  path.basename(name) === name && !name.includes("\\") && !name.includes("\0") &&
  !name.includes("/") && !name.startsWith(".");

const verifyExisting = async (target: string, manifest: Manifest): Promise<void> => {
  await assertNoLinkedPath(target);
  const ready = path.join(target, ".ready.json");
  await assertNoLinkedPath(ready, true);
  const existing = JSON.parse(await readFile(ready, "utf8")) as Manifest;
  if (!existing || existing.version !== 1 || !Array.isArray(existing.files) ||
      !/^[a-f0-9]{16}$|^[a-f0-9]{24}$/.test(existing.digest) ||
      (existing.salt !== undefined && !/^[a-f0-9]{64}$/.test(existing.salt)))
    throw new Error("بيان لقطة الوسائط غير صالح.");
  const expectedDigest = createHash("sha256").update(JSON.stringify({
    files: existing.files, salt: existing.salt ?? null,
  })).digest("hex").slice(0, existing.digest.length);
  if (expectedDigest !== existing.digest)
    throw new Error("بصمة بيان اللقطة غير صحيحة.");
  const identities = new Set<string>();
  for (const file of existing.files) {
    if (!file || !kinds.includes(file.kind) || !safeName(file.name) ||
        !/^[a-f0-9]{64}$/.test(file.sha256) ||
        identities.has(`${file.kind}/${file.name}`))
      throw new Error("بيان لقطة الوسائط يحوي عنصرًا غير آمن أو مكررًا.");
    identities.add(`${file.kind}/${file.name}`);
  }
  const rootItems = (await readdir(target)).sort();
  if (JSON.stringify(rootItems) !== JSON.stringify([".ready.json", ...kinds].sort()))
    throw new Error("تغيّرت محتويات جذر لقطة الوسائط؛ يوجد ملف غير مدرج.");
  if (JSON.stringify(existing) !== JSON.stringify(manifest))
    throw new Error("ملفات رندر موجودة لا تطابق البصمة؛ لن تُستبدل.");
  for (const kind of kinds) {
    const dir = path.join(target, kind);
    await assertNoLinkedPath(dir);
    const actual = (await readdir(dir)).sort();
    const expected = manifest.files.filter((f) => f.kind === kind).map((f) => f.name).sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected))
      throw new Error("تغيّرت محتويات لقطة وسائط سابقة؛ لن تُستبدل.");
  }
  for (const f of manifest.files) {
    const existingFile = path.join(target, f.kind, f.name);
    await assertNoLinkedPath(existingFile, true);
    if (await sha256File(existingFile) !== f.sha256)
      throw new Error("تغيّر وسيط سابق؛ لن تُستبدل ملفات رندر أخرى.");
  }
};

/**
 * Snapshots are immutable and content-addressed. Each producer owns its own
 * .stage directory. A same-digest publish guard serializes concurrent writers;
 * the guard is only removed by its creator. A crashed guard is intentionally
 * fail-closed, NEVER reclaimed by another render (manual recovery required).
 */
const stageSnapshot = async (
  namespace: string,
  prefix: string,
  length: 16 | 24,
  files: RenderStageFile[],
  options: RenderStageOptions,
  salt?: string,
): Promise<string> => {
  assertLive(options.signal);
  const parent = path.join(options.publicRoot, namespace);
  await ensureUnlinkedDirectory(parent);
  const staging = await mkdtemp(path.join(parent, ".stage-"));
  try {
    for (const kind of kinds) await ensureUnlinkedDirectory(path.join(staging, kind));
    const seen = new Set<string>();
    const digests: FileDigest[] = [];
    for (const f of [...files].sort((a, b) => `${a.kind}/${a.name}`.localeCompare(`${b.kind}/${b.name}`, "en"))) {
      assertLive(options.signal);
      if (!kinds.includes(f.kind) || !safeName(f.name)) throw new Error("اسم وسيط غير آمن للرندر.");
      const key = `${f.kind}/${f.name}`;
      if (seen.has(key)) throw new Error(`وسيط مكرر في لقطة الرندر: ${key}`);
      seen.add(key);
      const sha256 = await copyUnlinkedFile(f.source, path.join(staging, f.kind, f.name));
      digests.push({ kind: f.kind, name: f.name, sha256 });
      assertLive(options.signal);
    }
    const digest = createHash("sha256").update(JSON.stringify({ files: digests, salt: salt ?? null })).digest("hex").slice(0, length);
    const manifest: Manifest = { version: 1, digest, files: digests, ...(salt ? { salt } : {}) };
    await writeFile(path.join(staging, ".ready.json"), JSON.stringify(manifest) + "\n", { flag: "wx" });
    assertLive(options.signal);
    const rel = `${namespace}${prefix}${digest}/`;
    const target = path.join(options.publicRoot, rel);
    const guard = path.join(parent, `.publish-${prefix}${digest}`);
    let acquired = false;
    for (let attempt = 0; attempt < 200; attempt++) {
      assertLive(options.signal);
      try {
        await mkdir(guard, { mode: 0o700 });
        acquired = true;
        break;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
        await delay(25);
      }
    }
    if (!acquired) throw new Error("قفل نشر لقطة الوسائط مشغول أو متروك بعد انقطاع؛ يتطلب فحصًا يدويًا آمنًا.");
    try {
      await assertNoLinkedPath(parent);
      let existing = false;
      try {
        await lstat(target);
        existing = true;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      }
      if (existing) {
        await verifyExisting(target, manifest);
        return rel;
      }
      assertLive(options.signal);
      // One writer at a time for this digest; rename publishes a complete tree.
      await rename(staging, target);
      return rel;
    } finally {
      // rmdir refuses a replaced or nonempty guard. Never recursively remove
      // another process's files even on an unexpected filesystem mutation.
      await rmdir(guard);
    }
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
};

/** Fail closed before Remotion copies any snapshot. An old or unverified
 * directory is NOT promoted to a trusted static asset merely by naming it. */
export const verifyStagedMedia = async (publicRoot: string, base: string): Promise<void> => {
  const render = /^_render\/[a-z0-9]+(?:-[a-z0-9]+)*\/[0-9]{3}-[a-z0-9]+(?:-[a-z0-9]+)*\/[a-f0-9]{24}\/$/;
  const storyboard = /^_storyboard_media\/[a-z0-9]+(?:-[a-z0-9]+)*\/[0-9]{3}-[a-z0-9]+(?:-[a-z0-9]+)*-[a-f0-9]{16}\/$/;
  if (!render.test(base) && !storyboard.test(base))
    throw new Error("اسم لقطة وسائط غير موثوق.");
  const expectedDigest = base.slice(0, -1).split("/").at(-1)!.slice(render.test(base) ? -24 : -16);
  const target = path.join(publicRoot, base);
  await assertNoLinkedPath(target);
  const ready = path.join(target, ".ready.json");
  await assertNoLinkedPath(ready, true);
  const manifest = JSON.parse(await readFile(ready, "utf8")) as Manifest;
  if (manifest?.digest !== expectedDigest || (Boolean(manifest.salt) !== storyboard.test(base)))
    throw new Error("بيان الوسائط لا يطابق اسم المجلد أو نوع اللقطة.");
  await verifyExisting(target, manifest);
};

/** A content-addressed Remotion snapshot owned by ONE channel and episode. */
export const stageRenderFiles = async (
  renderNamespace: string,
  files: RenderStageFile[],
  options: RenderStageOptions,
): Promise<string> => {
  if (!renderPattern.test(renderNamespace))
    throw new Error("نطاق رندر غير آمن؛ يجب تحديد القناة ومجلد الحلقة.");
  return stageSnapshot(renderNamespace, "", 24, files, options);
};

/** Storyboard owns imagery only, never narration or recitation.
 * Keep the existing public URL layout while making publication atomic. */
export const stageStoryboardFiles = async (
  renderNamespace: string,
  files: RenderStageFile[],
  planFingerprint: string,
  options: RenderStageOptions,
): Promise<string> => {
  const match = renderPattern.exec(renderNamespace);
  if (!match || !/^[a-f0-9]{64}$/.test(planFingerprint) || files.some((f) => f.kind !== "images"))
    throw new Error("مدخلات لقطة Storyboard غير آمنة.");
  return stageSnapshot(`_storyboard_media/${match[1]}/`, `${match[2]}-`, 16, files, options, planFingerprint);
};
