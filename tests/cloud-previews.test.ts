/**
 * معاينات الجلسات السحابية عبر فروع previews/* (D75، src/render/cloudPreviews.ts)، في مستودعات مؤقتة
 * (origin مستودع bare محلي؛ لا شبكة ولا GitHub):
 * - الدفع يبني commit يتيمًا (manifest.json وأجزاء) في فهرس مؤقت، ولا يمس الفرع ولا الفهرس ولا ملفات العمل
 *   غير previews/index.json، ولا يدفع main؛ والرفع التالي يستبدل الفرع.
 * - الخطاف يعفي refs/heads/previews/* وحدها وبشرط أن الـcommit يتيم وشجرته manifest وأجزاء فقط.
 * - جهاز المالك: refspec سالب يُضاف مرة واحدة فلا يجلب git fetch فروع المعاينات؛ «حمّل المعاينة» يجمع الأجزاء
 *   ويتحقق من البصمة ويحفظ نسخة سابقة واحدة، ويرفض البصمة الخاطئة؛ والتنظيف تجربة ثم حذف.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { childEnv } from "../scripts/git-env.mjs";
import {
  downloadCloudPreview, ensurePreviewFetchExclusion, PREVIEW_FETCH_EXCLUDE, previewBranchRef, pruneCloudPreviews, pushCloudPreview,
} from "../src/render/cloudPreviews";
import { arabicMegabytes, listEpisodePreviews } from "../src/render/episodePreviews";

const repo = path.resolve(import.meta.dirname, "..");
const SHA = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8", env: childEnv({ GIT_TERMINAL_PROMPT: "0" }), stdio: ["ignore", "pipe", "pipe"] }).trim();
const tryGit = (cwd: string, ...args: string[]) => {
  try { return { ok: true, out: git(cwd, ...args) }; }
  catch (e) { return { ok: false, out: `${(e as { stdout?: string }).stdout ?? ""}${(e as { stderr?: string }).stderr ?? e}` }; }
};
const EP = "channels/dafatir-alzaman/episodes/001-test";
const video = (n: number, seed: string) => Buffer.from(Array.from({ length: n }, (_, i) => (i * 31 + seed.charCodeAt(i % seed.length)) & 255));

describe("معاينات الجلسات السحابية عبر فروع previews/*", () => {
  let base = "", origin = "", cloud = "", owner = "", cloudEp = "", ownerEp = "", originMain = "";
  const V1 = video(2500, "v1"), V2 = video(3100, "v2");
  const ref = previewBranchRef("dafatir-alzaman", "001-test", "episode");

  beforeAll(() => {
    base = mkdtempSync(path.join(os.tmpdir(), "cloud-previews-"));
    origin = path.join(base, "origin.git");
    cloud = path.join(base, "cloud");
    owner = path.join(base, "owner");
    git(base, "init", "-q", "--bare", "-b", "main", origin);
    git(base, "init", "-q", "-b", "main", cloud);
    for (const [k, v] of [["user.name", "Cloud"], ["user.email", "cloud@example.invalid"]]) git(cloud, "config", k!, v!);
    // خطاف المشروع الحقيقي (لا gate.mjs هنا: أي مرجع غير معفى يفشل ويُرفض)
    mkdirSync(path.join(cloud, ".githooks"));
    copyFileSync(path.join(repo, ".githooks", "pre-push"), path.join(cloud, ".githooks", "pre-push"));
    git(cloud, "config", "core.hooksPath", ".githooks");
    cloudEp = path.join(cloud, EP);
    mkdirSync(path.join(cloudEp, "previews"), { recursive: true });
    writeFileSync(path.join(cloud, ".gitignore"), "channels/*/episodes/*/previews/*.mp4\nchannels/*/episodes/*/previews/history/\nrender.mp4\n");
    writeFileSync(path.join(cloudEp, "script.md"), "# test\n");
    writeFileSync(path.join(cloudEp, "previews", "index.json"), "{}\n");
    writeFileSync(path.join(cloud, "README.md"), "v1\n");
    git(cloud, "add", "-A");
    git(cloud, "commit", "-q", "-m", "init");
    git(cloud, "remote", "add", "origin", origin);
    git(origin, "fetch", "-q", cloud, "+refs/heads/main:refs/heads/main"); // main على origin بالجلب، لا بالدفع
    originMain = git(origin, "rev-parse", "refs/heads/main");
    // عمل غير محفوظ في الجلسة: تعديل غير مرحَّل، وتغيير مرحَّل، وملف غير متتبَّع
    writeFileSync(path.join(cloud, "README.md"), "v1\nlocal edit\n");
    writeFileSync(path.join(cloud, "staged.txt"), "staged\n");
    git(cloud, "add", "staged.txt");
    writeFileSync(path.join(cloud, "scratch.txt"), "untracked\n");
    writeFileSync(path.join(cloud, "render.mp4"), V1);
  });
  afterAll(() => { if (base) rmSync(base, { recursive: true, force: true }); });

  const snapshot = () => ({
    head: git(cloud, "symbolic-ref", "HEAD"), headSha: git(cloud, "rev-parse", "HEAD"),
    staged: git(cloud, "diff", "--cached"), readme: readFileSync(path.join(cloud, "README.md"), "utf8"),
    branches: git(cloud, "for-each-ref", "--format=%(refname)", "refs/heads"),
    status: git(cloud, "status", "--porcelain", "--untracked-files=all").split("\n").filter((l) => !l.includes("previews/index.json")).join("\n"),
  });

  it("الدفع: commit يتيم بالأجزاء وmanifest، دون لمس الفرع أو الفهرس أو الملفات، ولا main", async () => {
    const before = snapshot();
    const r = await pushCloudPreview({ episodeDir: cloudEp, slot: "episode", file: path.join(cloud, "render.mp4"),
      title: "V8 صامتة (جاهز للمراجعة)", note: "اختبار", partBytes: 1000, session: "test-session" });
    expect(snapshot()).toEqual(before);
    expect(git(origin, "rev-parse", "refs/heads/main")).toBe(originMain);
    const tip = git(origin, "rev-parse", ref);
    expect(r.commit).toBe(tip);
    expect(git(origin, "rev-list", "--count", tip)).toBe("1");
    expect(git(origin, "ls-tree", "--name-only", tip).split("\n")).toEqual(["manifest.json", "part-000", "part-001", "part-002"]);
    const manifest = JSON.parse(git(origin, "show", `${tip}:manifest.json`));
    expect(manifest).toMatchObject({ channel: "dafatir-alzaman", episode: "001-test", slot: "episode", status: "جاهز للمراجعة",
      sha256: SHA(V1), size: 2500, partBytes: 1000, source: { session: "test-session" } });
    expect(manifest.parts.map((p: { size: number }) => p.size)).toEqual([1000, 1000, 500]);
    expect(manifest.parts[2].sha256).toBe(SHA(V1.subarray(2000)));
    const index = JSON.parse(readFileSync(path.join(cloudEp, "previews", "index.json"), "utf8"));
    expect(index["episode.mp4"]).toMatchObject({ title: "V8 صامتة (جاهز للمراجعة)", version: 1, sha256: SHA(V1), size: 2500,
      source: { type: "git-branch", ref, commit: tip, sha256: SHA(V1), size: 2500 } });
    expect(index["episode.mp4"].source.parts).toHaveLength(3);
    expect(r.indexCommitted).toBeNull();
  });

  it("الرفع التالي يستبدل الفرع (commit يتيم واحد)، ويحفظ الفهرس وحده مع --commit-index", async () => {
    writeFileSync(path.join(cloud, "render.mp4"), V2);
    const stagedBefore = git(cloud, "diff", "--cached", "--name-only");
    const r = await pushCloudPreview({ episodeDir: cloudEp, slot: "episode", file: path.join(cloud, "render.mp4"),
      title: "V9 (جاهز للمراجعة)", partBytes: 1000, commitIndex: true });
    const tip = git(origin, "rev-parse", ref);
    expect(tip).toBe(r.commit);
    expect(git(origin, "rev-list", "--count", tip)).toBe("1");
    expect(git(origin, "ls-tree", "--name-only", tip).split("\n")).toHaveLength(5);
    expect(r.entry.version).toBe(2);
    expect(git(cloud, "show", "--name-only", "--format=", "HEAD")).toBe(`${EP}/previews/index.json`);
    expect(git(cloud, "diff", "--cached", "--name-only")).toBe(stagedBefore); // staged.txt still staged, not committed
    expect(git(origin, "rev-parse", "refs/heads/main")).toBe(originMain);
  });

  it("الخطاف: الإعفاء لـ previews/* اليتيم بالـmanifest والأجزاء فقط", () => {
    const tip = git(origin, "rev-parse", ref);
    git(cloud, "fetch", "-q", "origin", `+${ref}:refs/test/tip`);
    const blob = git(cloud, "rev-parse", "refs/test/tip:part-000");
    const mk = (lines: string) => execFileSync("git", ["mktree"], { cwd: cloud, input: lines, encoding: "utf8", env: childEnv() }).trim();
    const manifestBlob = git(cloud, "rev-parse", "refs/test/tip:manifest.json");
    // ملف إضافي في الشجرة
    const extra = git(cloud, "commit-tree", mk(`100644 blob ${manifestBlob}\tmanifest.json\n100644 blob ${blob}\tpart-000\n100644 blob ${blob}\tsrc.ts\n`), "-m", "x");
    expect(tryGit(cloud, "push", "--force", "origin", `${extra}:${ref}`)).toMatchObject({ ok: false });
    // commit له أب (كود مخفي في التاريخ)
    const withParent = git(cloud, "commit-tree", `${tip}^{tree}`, "-p", git(cloud, "rev-parse", "HEAD"), "-m", "x");
    const r2 = tryGit(cloud, "push", "--force", "origin", `${withParent}:${ref}`);
    expect(r2.ok).toBe(false);
    expect(r2.out).toMatch(/رُفض الدفع/);
    // جزء في مجلد فرعي
    const sub = mk(`100644 blob ${blob}\tpart-000\n`);
    const nested = git(cloud, "commit-tree", mk(`100644 blob ${manifestBlob}\tmanifest.json\n040000 tree ${sub}\tdir\n`), "-m", "x");
    expect(tryGit(cloud, "push", "--force", "origin", `${nested}:${ref}`).ok).toBe(false);
    // شجرة المعاينة نفسها إلى main: البوابة كاملة (لا إعفاء)
    const toMain = tryGit(cloud, "push", "origin", `${tip}:refs/heads/main`);
    expect(toMain.ok).toBe(false);
    expect(git(origin, "rev-parse", ref)).toBe(tip);
    expect(git(origin, "rev-parse", "refs/heads/main")).toBe(originMain);
    git(cloud, "update-ref", "-d", "refs/test/tip");
  });

  it("جهاز المالك: refspec سالب مرة واحدة، فلا يجلب git fetch فروع المعاينات", async () => {
    git(base, "clone", "-q", origin, owner);
    expect(git(owner, "for-each-ref", "refs/remotes/origin/previews")).not.toBe(""); // clone brought it
    const logs: string[] = [];
    expect(await ensurePreviewFetchExclusion(owner, (m) => logs.push(m))).toMatchObject({ changed: true, mode: "negative", removed: 1 });
    expect(await ensurePreviewFetchExclusion(owner, (m) => logs.push(m))).toMatchObject({ changed: false, removed: 0 });
    expect(git(owner, "config", "--get-all", "remote.origin.fetch").split("\n").filter((l) => l === PREVIEW_FETCH_EXCLUDE)).toHaveLength(1);
    expect(logs.join("\n")).toMatch(/previews/);
    expect(git(owner, "for-each-ref", "refs/remotes/origin/previews")).toBe("");
    // دفع جديد لخانة أخرى، ثم جلب المالك
    writeFileSync(path.join(cloud, "other.mp4"), V1);
    const other = await pushCloudPreview({ episodeDir: cloudEp, slot: "scene-1", file: path.join(cloud, "other.mp4"), title: "مشهد", partBytes: 1000 });
    git(owner, "fetch", "-q", "origin");
    expect(git(owner, "for-each-ref", "refs/remotes/origin/previews")).toBe("");
    expect(tryGit(owner, "cat-file", "-e", `${other.commit}^{commit}`).ok).toBe(false);
  });

  it("Git أقدم من 2.29: refspec صريح لـ main وstudio-notes، ويقال في السجل", async () => {
    const old = path.join(base, "old");
    git(base, "clone", "-q", origin, old);
    const logs: string[] = [];
    expect(await ensurePreviewFetchExclusion(old, (m) => logs.push(m), "origin", { gitVersion: [2, 25] })).toMatchObject({ changed: true, mode: "explicit" });
    expect(git(old, "config", "--get-all", "remote.origin.fetch").split("\n"))
      .toEqual(["+refs/heads/main:refs/remotes/origin/main", "+refs/heads/studio-notes:refs/remotes/origin/studio-notes"]);
    expect(logs.join("\n")).toMatch(/older than 2\.29/);
  });

  it("«حمّل المعاينة»: يجمع الأجزاء ويتحقق من البصمة، ويحفظ نسخة سابقة واحدة، ويحذف المرجع المؤقت", async () => {
    git(origin, "fetch", "-q", cloud, "+refs/heads/main:refs/heads/main"); // الفهرس على main (مسار الدمج المعتاد)
    git(owner, "pull", "-q", "--ff-only");
    ownerEp = path.join(owner, EP);
    writeFileSync(path.join(ownerEp, "previews", "episode.mp4"), "OLD LOCAL");
    const list = await listEpisodePreviews(ownerEp);
    const item = list.find((f) => f.name === "episode.mp4")!;
    expect(item.source).toBe("git-branch");
    expect(item.cloud).toMatchObject({ ref, size: 3100, sizeLabel: arabicMegabytes(3100) });
    const phases = new Set<string>();
    const r = await downloadCloudPreview({ episodeDir: ownerEp, name: "episode.mp4", onProgress: (p) => phases.add(p.phase) });
    expect(readFileSync(r.file).equals(V2)).toBe(true);
    expect([...phases]).toEqual(expect.arrayContaining(["fetch", "assemble", "install"]));
    const history = path.join(ownerEp, "previews", "history", "episode");
    expect(readdirSync(history).map((n) => readFileSync(path.join(history, n), "utf8"))).toEqual(["OLD LOCAL"]);
    expect(git(owner, "for-each-ref", "refs/previews-cache")).toBe("");
    expect(git(owner, "rev-parse", "--is-shallow-repository")).toBe("false");
    expect(readdirSync(path.join(ownerEp, "previews")).filter((n) => n.startsWith("."))).toEqual([]);
    expect((await listEpisodePreviews(ownerEp)).find((f) => f.name === "episode.mp4")!.source).toBe("local");
    expect(git(owner, "status", "--porcelain")).toBe("");
    // تحميل ثانٍ: نسخة سابقة واحدة فقط تبقى
    await downloadCloudPreview({ episodeDir: ownerEp, name: "episode" });
    expect(readdirSync(history)).toHaveLength(1);
  });

  it("بصمة خاطئة: يُرفض بالعربية ولا يُستبدل شيء", async () => {
    const indexFile = path.join(ownerEp, "previews", "index.json");
    const original = readFileSync(indexFile, "utf8");
    const index = JSON.parse(original);
    writeFileSync(path.join(ownerEp, "previews", "episode.mp4"), "KEEP ME");
    index["episode.mp4"].source.sha256 = SHA("something else");
    index["episode.mp4"].sha256 = SHA("something else");
    writeFileSync(indexFile, JSON.stringify(index));
    try {
      await expect(downloadCloudPreview({ episodeDir: ownerEp, name: "episode.mp4" })).rejects.toThrow(/ليست المسجلة في الفهرس|لا تطابق/);
      expect(readFileSync(path.join(ownerEp, "previews", "episode.mp4"), "utf8")).toBe("KEEP ME");
      expect(git(owner, "for-each-ref", "refs/previews-cache")).toBe("");
      expect(readdirSync(path.join(ownerEp, "previews")).filter((n) => n.endsWith(".download"))).toEqual([]);
      // الفهرس يطابق manifest لكن الملف المجمَّع يخالف: مرفوض أيضًا
      index["episode.mp4"].source.sha256 = SHA(V2);
      index["episode.mp4"].sha256 = SHA(V2);
      index["episode.mp4"].source.ref = previewBranchRef("dafatir-alzaman", "001-test", "scene-1");
      writeFileSync(indexFile, JSON.stringify(index));
      await expect(downloadCloudPreview({ episodeDir: ownerEp, name: "episode.mp4" })).rejects.toThrow(/لا يطابق الحلقة والخانة/);
    } finally {
      writeFileSync(indexFile, original);
    }
  });

  it("التنظيف: تجربة افتراضيًا، والحذف يزيل الفروع التي لم تعد الخانة تشير إليها فقط", async () => {
    // خانة scene-1 حُذفت من الفهرس (الفرع باقٍ على origin)
    const indexFile = path.join(cloudEp, "previews", "index.json");
    const index = JSON.parse(readFileSync(indexFile, "utf8"));
    delete index["scene-1.mp4"];
    writeFileSync(indexFile, JSON.stringify(index, null, 2));
    const stale = previewBranchRef("dafatir-alzaman", "001-test", "scene-1");
    const dry = await pruneCloudPreviews({ repoDir: cloud });
    expect(dry).toMatchObject({ dryRun: true, keep: [ref], remove: [stale], deleted: [] });
    expect(git(origin, "for-each-ref", "--format=%(refname)", "refs/heads/previews")).toContain(stale);
    const real = await pruneCloudPreviews({ repoDir: cloud, apply: true });
    expect(real.deleted).toEqual([stale]);
    expect(git(origin, "for-each-ref", "--format=%(refname)", "refs/heads/previews")).toBe(ref);
    expect(git(origin, "rev-parse", "refs/heads/main")).not.toBe("");
  });

  it("الحجم بالعربية لزر التحميل", () => {
    expect(arabicMegabytes(68 * 1024 * 1024)).toBe("٦٨ م.ب");
    expect(arabicMegabytes(6.5 * 1024 * 1024)).toBe("٦٫٥ م.ب");
    expect(existsSync(path.join(repo, ".githooks", "pre-push"))).toBe(true);
  });
});
