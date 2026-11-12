import { existsSync, readFileSync } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { childEnv } from "../../scripts/git-env.mjs";

/**
 * D109: فيديوهات معاينة قديمة أُزيلت من تتبّع Git على main (قرار المالك ١٢ نوفمبر: «اذا كان ليس لها استخدم نعم»).
 * مساراتها متجاهَلة (`channels/*\/episodes/*\/previews/*.mp4`)، فمكانها على جهاز المالك محلي كبقية المعاينات.
 *
 * إن طبّق التحديثَ كودٌ أقدم من D109 فقد حذفها Git من جهازه بلا نسخة (safeFastForward القديم لا يحفظ إلا تعديلات
 * المالك). لذلك يعيدها أول تشغيل للاستوديو الجديد من كائنات Git المحلية نفسها، بايتًا ببايت:
 *   - مرة واحدة فقط (علامة في `.studio/`)، فما يحذفه المالك بعدها لا يعود؛
 *   - للملف الغائب وحده، وبعد التحقق من بصمة الكائن (Git blob)، وللمسار المتجاهَل وحده (فلا يظهر «ملفًا جديدًا»)؛
 *   - إن لم يوجد الكائن (نسخة ضحلة) يُتخطى بصمت. لا شبكة، ولا حذف، ولا commit.
 */
export type UntrackedPreview = { path: string; blob: string };

const listFile = path.join(import.meta.dirname, "untracked-previews.json");
export const UNTRACKED_PREVIEWS: UntrackedPreview[] = existsSync(listFile)
  ? (JSON.parse(readFileSync(listFile, "utf8")) as { files: UntrackedPreview[] }).files : [];

const MARKER = path.join(".studio", "untracked-previews-restored.json");

const gitBuf = (root: string, args: string[]) => new Promise<{ ok: boolean; out: Buffer }>((resolve) => {
  execFile("git", args, { cwd: root, timeout: 120_000, env: childEnv({ GIT_TERMINAL_PROMPT: "0" }), maxBuffer: 512 * 1024 * 1024, encoding: "buffer" },
    (err, stdout) => resolve({ ok: !err, out: stdout as unknown as Buffer }));
});
const blobSha = (b: Buffer) => createHash("sha1").update(`blob ${b.length}\0`).update(b).digest("hex");
const safeRel = (p: string) => !path.isAbsolute(p) && !p.split(/[\\/]/).includes("..") && /^channels\/[^/]+\/episodes\/[^/]+\/previews\/[^/]+$/.test(p);

export const restoreUntrackedPreviews = async (root: string, list: UntrackedPreview[] = UNTRACKED_PREVIEWS) => {
  const restored: string[] = [];
  const marker = path.join(root, MARKER);
  if (!list.length || existsSync(marker)) return { restored, skipped: true };
  for (const f of list) {
    if (!safeRel(f.path) || !/^[0-9a-f]{40}$/.test(f.blob)) continue;
    const dst = path.join(root, f.path);
    if (existsSync(dst)) continue;
    if (!(await gitBuf(root, ["check-ignore", "-q", "--", f.path])).ok) continue;
    const b = await gitBuf(root, ["cat-file", "blob", f.blob]);
    if (!b.ok || blobSha(b.out) !== f.blob) continue;
    await mkdir(path.dirname(dst), { recursive: true });
    const tmp = `${dst}.${process.pid}.restore.tmp`;
    try {
      await writeFile(tmp, b.out);
      await rename(tmp, dst);
      restored.push(f.path);
    } finally {
      await rm(tmp, { force: true });
    }
  }
  await mkdir(path.dirname(marker), { recursive: true });
  await writeFile(marker, JSON.stringify({ at: new Date().toISOString(), restored }, null, 2) + "\n");
  return { restored, skipped: false };
};
