import path from "node:path";
import { createHash } from "node:crypto";
import { constants, createReadStream } from "node:fs";
import { copyFile, lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";

export type RenderStageFile = { kind: "voice" | "sfx" | "recitations" | "images"; name: string; source: string };
export type RenderStageOptions = { publicRoot: string; signal?: AbortSignal };
type FileDigest = { kind: RenderStageFile["kind"]; name: string; sha256: string };
type Manifest = { version: 1; digest: string; files: FileDigest[] };
const kinds = ["voice", "sfx", "recitations", "images"] as const;

const assertLive = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new Error("أُلغيت تهيئة وسائط الرندر؛ لم تُمس ملفات أي مهمة أخرى.");
};
const sha256File = async (file: string) => {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
};
const safeName = (name: string) =>
  name !== "." && name !== ".." && name.length > 0 && name.length <= 240 &&
  path.basename(name) === name && !name.includes("\\") && !name.includes("\0") &&
  !name.includes("/") && !name.startsWith(".");

/**
 * A content-addressed, immutable Remotion snapshot owned by ONE channel/episode.
 * Work is copied into a unique private staging directory and published by rename.
 * In particular, never rm() an existing _render namespace: an older render or a
 * parallel bundler may still be reading it. Only our own .stage-* is removed.
 */
export const stageRenderFiles = async (
  renderNamespace: string,
  files: RenderStageFile[],
  options: RenderStageOptions,
): Promise<string> => {
  if (!/^_render\/[a-z0-9]+(?:-[a-z0-9]+)*\/[0-9]{3}-[a-z0-9]+(?:-[a-z0-9]+)*\/$/.test(renderNamespace))
    throw new Error("نطاق رندر غير آمن؛ يجب تحديد القناة ومجلد الحلقة.");
  assertLive(options.signal);
  const parent = path.join(options.publicRoot, renderNamespace);
  await mkdir(parent, { recursive: true });
  const staging = await mkdtemp(path.join(parent, ".stage-"));
  try {
    for (const kind of kinds) await mkdir(path.join(staging, kind));
    const seen = new Set<string>();
    const digests: FileDigest[] = [];
    for (const f of [...files].sort((a, b) => `${a.kind}/${a.name}`.localeCompare(`${b.kind}/${b.name}`, "en"))) {
      assertLive(options.signal);
      if (!kinds.includes(f.kind) || !safeName(f.name)) throw new Error("اسم وسيط غير آمن للرندر.");
      const key = `${f.kind}/${f.name}`;
      if (seen.has(key)) throw new Error(`وسيط مكرر في لقطة الرندر: ${key}`);
      seen.add(key);
      const source = await lstat(f.source);
      if (!source.isFile() || source.isSymbolicLink()) throw new Error(`مصدر وسيط غير آمن: ${key}`);
      const destination = path.join(staging, f.kind, f.name);
      await copyFile(f.source, destination, constants.COPYFILE_EXCL);
      digests.push({ kind: f.kind, name: f.name, sha256: await sha256File(destination) });
      assertLive(options.signal);
    }
    const digest = createHash("sha256").update(JSON.stringify(digests)).digest("hex").slice(0, 24);
    const manifest: Manifest = { version: 1, digest, files: digests };
    await writeFile(path.join(staging, ".ready.json"), JSON.stringify(manifest) + "\n", { flag: "wx" });
    assertLive(options.signal);
    const rel = `${renderNamespace}${digest}/`;
    const target = path.join(options.publicRoot, rel);
    try {
      await rename(staging, target);
      return rel;
    } catch (e) {
      // A concurrent job may have already committed the identical snapshot.
      if (!["EEXIST", "ENOTEMPTY"].includes((e as NodeJS.ErrnoException).code ?? "")) throw e;
      const targetStat = await lstat(target);
      if (!targetStat.isDirectory() || targetStat.isSymbolicLink())
        throw new Error("تعارض مع مجلد وسائط الرندر الموجود.");
      const existing = JSON.parse(await readFile(path.join(target, ".ready.json"), "utf8")) as Manifest;
      if (JSON.stringify(existing) !== JSON.stringify(manifest))
        throw new Error("ملفات رندر موجودة لا تطابق البصمة؛ لن تُستبدل.");
      for (const f of digests) {
        const existingFile = path.join(target, f.kind, f.name);
        const st = await lstat(existingFile);
        if (!st.isFile() || st.isSymbolicLink() || await sha256File(existingFile) !== f.sha256)
          throw new Error("تغيّر وسيط سابق؛ لن تُستبدل ملفات رندر أخرى.");
      }
      return rel;
    }
  } finally {
    // Never walk into another render's content-addressed directory.
    await rm(staging, { recursive: true, force: true });
  }
};
