/**
 * العمل ٧ (D120): `bal migrate legacy` — نسخة احتياطية قبل أي تغيير، ثم أرشيف محلي، idempotent، ولا يصير قرار قديم
 * اعتمادًا. والقبول: لا مسار قراءة أو كتابة للسجلات القديمة خارج وحدة الترحيل.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LEGACY_RECORDS, findLegacyRecords, legacyMigrationSummary, migrateLegacyRecords } from "../src/studio/legacyMigration";

const FIXTURES = path.join(import.meta.dirname, "fixtures", "legacy-records");
const OLD = readdirSync(FIXTURES).sort();
const sha = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");
const owned: string[] = [];
afterEach(async () => { await Promise.all(owned.splice(0).map((d) => rm(d, { recursive: true, force: true }))); });

/** مشروع مؤقت: channels/<قناة>/episodes/<حلقة> بملفات المالك الحالية، وسجلات قديمة من الفكسترات. */
const project = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "legacy-migration-"));
  owned.push(root);
  const channelsDir = path.join(root, "channels");
  const ep = path.join(channelsDir, "balislam", "episodes", "001-old");
  const other = path.join(channelsDir, "dafatir-alzaman", "episodes", "002-other");
  await mkdir(ep, { recursive: true });
  await mkdir(path.join(ep, "voice"), { recursive: true });
  await mkdir(other, { recursive: true });
  // ما ليس قديمًا يبقى بايتًا ببايت: السكريبت والخطة والتوثيق والسجل الموحد ولوحاته والصوت
  const keep: Record<string, string> = {
    "script.md": "---\ntitle: \"حلقة\"\n---\n", "plan.json": "{\"chapters\":[]}\n", "review.json": "{\"items\":{}}\n",
    "scene-production.v1.json": "{\"signed\":\"opaque\"}\n", "storyboard.json": "{\"boards\":{}}\n", "voice/index.json": "{}\n",
    "status.json": "{}\n",
  };
  for (const [rel, text] of Object.entries(keep)) await writeFile(path.join(ep, rel), text);
  for (const f of OLD) await copyFile(path.join(FIXTURES, f), path.join(ep, f));
  await writeFile(path.join(ep, "workflow-approvals.json.lock"), "token");
  await writeFile(path.join(ep, "voice-review.json.123.abc.tmp"), "{}");
  await copyFile(path.join(FIXTURES, "scene-review.json"), path.join(other, "scene-review.json"));
  return { root, channelsDir, ep, other, keep, backupRoot: path.join(root, "home", "balislam-backup"), archiveDir: path.join(root, ".studio", "legacy-archive") };
};
const tree = (dir: string): Record<string, string> => {
  if (!existsSync(dir)) return {};
  const out: Record<string, string> = {};
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else out[path.relative(dir, p)] = `${statSync(p).size}:${sha(p)}`;
    }
  };
  walk(dir);
  return out;
};

describe("bal migrate legacy", () => {
  it("backs up every old record byte for byte, then archives it; the owner's current files stay untouched", async () => {
    const x = await project();
    const before = tree(x.ep);
    const r = await migrateLegacyRecords({ channelsDir: x.channelsDir, backupRoot: x.backupRoot });
    // الأرشيف الافتراضي: .studio/legacy-archive بجوار مجلد القنوات (جذر المشروع)
    expect(r.archive).toBe(x.archiveDir);
    expect(r.moved.map((m) => `${m.channel}/${m.episode}/${m.name}`).sort()).toEqual([
      "balislam/001-old/scene-review.json", "balislam/001-old/scene-workflow.v2.json", "balislam/001-old/script-approved.v1.json",
      "balislam/001-old/script-signoff.json", "balislam/001-old/voice-review.json", "balislam/001-old/voice-review.json.123.abc.tmp",
      "balislam/001-old/workflow-approvals.json", "balislam/001-old/workflow-approvals.json.lock", "dafatir-alzaman/002-other/scene-review.json",
    ]);
    // لا سجل قديم بقي في الحلقات، وما عداه كما كان
    const after = tree(x.ep);
    for (const name of Object.keys(after)) expect(LEGACY_RECORDS.some((l) => name.startsWith(l.name)), name).toBe(false);
    for (const rel of Object.keys(x.keep)) expect(after[rel], rel).toBe(before[rel]);
    expect(existsSync(path.join(x.other, "scene-review.json"))).toBe(false);
    // النسخة الاحتياطية: كل ملف بمساره وبصمته، ومعها manifest.json
    expect(r.backup).toMatch(/balislam-backup[\\/]legacy-migration-/);
    const manifest = JSON.parse(await readFile(path.join(r.backup!, "manifest.json"), "utf8"));
    expect(manifest.files).toHaveLength(9);
    for (const f of OLD) {
      const original = sha(path.join(FIXTURES, f));
      expect(sha(path.join(r.backup!, "balislam", "episodes", "001-old", f)), f).toBe(original);
      expect(sha(path.join(x.archiveDir, "balislam", "001-old", f)), f).toBe(original);
      expect(manifest.files.find((m: { name: string; episode: string }) => m.name === f && m.episode === "001-old").sha256).toBe(original);
    }
    const log = JSON.parse(await readFile(path.join(x.archiveDir, "migration-log.json"), "utf8"));
    expect(log.runs).toHaveLength(1);
    expect(legacyMigrationSummary(r)).toContain("لم يُعتمد بها شيء");
  });

  it("is idempotent: a second run changes nothing and makes no new backup", async () => {
    const x = await project();
    await migrateLegacyRecords({ channelsDir: x.channelsDir, backupRoot: x.backupRoot });
    const state = { ep: tree(x.ep), archive: tree(x.archiveDir), backups: readdirSync(x.backupRoot) };
    const again = await migrateLegacyRecords({ channelsDir: x.channelsDir, backupRoot: x.backupRoot });
    expect(again.found).toEqual([]);
    expect(again.backup).toBeNull();
    expect({ ep: tree(x.ep), archive: tree(x.archiveDir), backups: readdirSync(x.backupRoot) }).toEqual(state);
    expect(legacyMigrationSummary(again)).toBe("لا سجلات قديمة للترحيل.");
  });

  it("with nothing to migrate writes nothing at all (no backup, no archive)", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "legacy-none-"));
    owned.push(root);
    const ep = path.join(root, "channels", "balislam", "episodes", "001-new");
    await mkdir(ep, { recursive: true });
    await writeFile(path.join(ep, "script.md"), "x");
    const r = await migrateLegacyRecords({ channelsDir: path.join(root, "channels"), backupRoot: path.join(root, "backup") });
    expect(r.moved).toEqual([]);
    expect(existsSync(path.join(root, "backup"))).toBe(false);
    expect(existsSync(path.join(root, ".studio"))).toBe(false);
  });

  it("--dry-run reports and changes nothing", async () => {
    const x = await project();
    const before = tree(x.root);
    const r = await migrateLegacyRecords({ channelsDir: x.channelsDir, backupRoot: x.backupRoot, dryRun: true });
    expect(r.found).toHaveLength(9);
    expect(r.moved).toEqual([]);
    expect(tree(x.root)).toEqual(before);
    expect(legacyMigrationSummary(r)).toContain("تجربة فقط");
  });

  it("a failed backup stops before any file moves", async () => {
    const x = await project();
    await mkdir(path.dirname(x.backupRoot), { recursive: true });
    await writeFile(x.backupRoot, "not a directory");
    const before = tree(x.ep);
    await expect(migrateLegacyRecords({ channelsDir: x.channelsDir, backupRoot: x.backupRoot })).rejects.toThrow();
    expect(tree(x.ep)).toEqual(before);
    expect(existsSync(x.archiveDir)).toBe(false);
  });

  it("never overwrites the archive: different bytes keep both, identical bytes are not stored twice", async () => {
    const x = await project();
    await migrateLegacyRecords({ channelsDir: x.channelsDir, backupRoot: x.backupRoot });
    // the same record reappears (e.g. restored from an old copy): once changed, once identical
    await writeFile(path.join(x.ep, "script-signoff.json"), "{\"version\":1,\"note\":\"نسخة أخرى\"}\n");
    await copyFile(path.join(FIXTURES, "voice-review.json"), path.join(x.ep, "voice-review.json"));
    const r = await migrateLegacyRecords({ channelsDir: x.channelsDir, backupRoot: x.backupRoot });
    expect(r.backup).not.toBeNull();
    const signoff = r.moved.find((m) => m.name === "script-signoff.json")!;
    expect(signoff.duplicate).toBe(false);
    expect(path.basename(signoff.archivedTo)).toBe(`script-signoff.json.${signoff.sha256.slice(0, 12)}`);
    expect(sha(path.join(x.archiveDir, "balislam", "001-old", "script-signoff.json"))).toBe(sha(path.join(FIXTURES, "script-signoff.json")));
    expect(r.moved.find((m) => m.name === "voice-review.json")!.duplicate).toBe(true);
    expect(existsSync(path.join(x.ep, "voice-review.json"))).toBe(false);
    expect(readdirSync(x.backupRoot)).toHaveLength(2);
  });

  it("leaves a symlink or a Git-tracked record in place and says so", async () => {
    const x = await project();
    execFileSync("git", ["init", "-q"], { cwd: x.root });
    execFileSync("git", ["add", path.join(x.other, "scene-review.json")], { cwd: x.root });
    await rm(path.join(x.ep, "script-signoff.json"));
    await symlink(path.join(FIXTURES, "script-signoff.json"), path.join(x.ep, "script-signoff.json"));
    const r = await migrateLegacyRecords({ channelsDir: x.channelsDir, backupRoot: x.backupRoot });
    expect(r.skipped).toEqual(expect.arrayContaining([
      { channel: "dafatir-alzaman", episode: "002-other", name: "scene-review.json", reason: "tracked" },
      { channel: "balislam", episode: "001-old", name: "script-signoff.json", reason: "not-a-file" },
    ]));
    expect(existsSync(path.join(x.other, "scene-review.json"))).toBe(true);
    expect(legacyMigrationSummary(r)).toContain("متتبَّع في Git");
  });

  it("an old decision never becomes an approval: the unified ledger is not created or touched", async () => {
    const x = await project();
    const ledger = path.join(x.ep, "scene-production.v1.json");
    const before = sha(ledger);
    await rm(path.join(x.other, "scene-review.json"));
    await copyFile(path.join(FIXTURES, "workflow-approvals.json"), path.join(x.other, "workflow-approvals.json"));
    await migrateLegacyRecords({ channelsDir: x.channelsDir, backupRoot: x.backupRoot });
    expect(sha(ledger)).toBe(before);
    expect(existsSync(path.join(x.other, "scene-production.v1.json"))).toBe(false);
    expect(await readdir(x.other)).toEqual([]);
    // the module cannot reach the ledger: it imports nothing from the scene engine
    const code = readFileSync(path.join(import.meta.dirname, "..", "src", "studio", "legacyMigration.ts"), "utf8");
    expect(code).not.toMatch(/from "\.\/(scene|preparation|sceneProduction|sceneService)/);
  });

  it("findLegacyRecords reads only fingerprints and sizes", async () => {
    const x = await project();
    const { found } = await findLegacyRecords(x.channelsDir);
    const w = found.find((f) => f.name === "workflow-approvals.json")!;
    expect(w).toMatchObject({ channel: "balislam", episode: "001-old", bytes: statSync(path.join(FIXTURES, w.name)).size, sha256: sha(path.join(FIXTURES, w.name)) });
  });
});

describe("acceptance: no read or write path for the old records outside the migration module", () => {
  const repo = path.join(import.meta.dirname, "..");
  const names = LEGACY_RECORDS.map((r) => r.name);
  /** Not read/write paths: the never-upload list, the ignore file, fresh-start's protect list, and the migration itself. */
  const ALLOWED = new Set(["src/studio/legacyMigration.ts", "scripts/contentPaths.mjs", "fresh-start.command", ".gitignore"]);
  const walk = (rel: string): string[] => {
    const abs = path.join(repo, rel);
    if (!existsSync(abs)) return [];
    if (statSync(abs).isFile()) return [rel];
    return readdirSync(abs, { withFileTypes: true }).filter((e) => !["node_modules", ".git"].includes(e.name))
      .flatMap((e) => walk(path.posix.join(rel, e.name)));
  };
  const code = ["src", "app/server", "app/src", "app/scripts", "scripts", "bin", "tools", "brand", "fresh-start.command", "start-studio.command", ".gitignore"]
    .flatMap(walk).filter((f) => /\.(ts|tsx|mjs|js|cjs|command|sh)$|^\.gitignore$/.test(f));

  it("no code file outside the allow-list names an old record file", () => {
    const offenders = code.filter((f) => !ALLOWED.has(f)).flatMap((f) => {
      const text = readFileSync(path.join(repo, f), "utf8");
      return names.filter((n) => text.includes(n)).map((n) => `${f}: ${n}`);
    });
    expect(offenders).toEqual([]);
  });

  it("the removed modules are gone and nothing imports them", () => {
    for (const f of ["src/workflow", "src/script/approval.ts", "src/voice/review.ts", "src/plan/sceneReview.ts"])
      expect(existsSync(path.join(repo, f)), f).toBe(false);
    const tests = walk("tests").filter((f) => /\.(ts|tsx|mjs)$/.test(f));
    const offenders = [...code, ...tests].filter((f) => /from "[^"]*(\/workflow\/|script\/approval|voice\/review"|plan\/sceneReview)|load\("\/src\/(workflow\/|script\/approval|voice\/review\.ts|plan\/sceneReview)/.test(readFileSync(path.join(repo, f), "utf8")));
    expect(offenders).toEqual([]);
  });

  it("the Studio runs the migration at start, and the CLI command exists", () => {
    const api = readFileSync(path.join(repo, "app/server/api.ts"), "utf8");
    expect(api).toContain('load("/src/studio/legacyMigration.ts")');
    expect(api).toContain("m.migrateLegacyRecords({ channelsDir: ch.channelsDir() })");
    const cli = readFileSync(path.join(repo, "src/cli/index.ts"), "utf8");
    expect(cli).toContain('.command("migrate")');
    expect(cli).toContain("migrateLegacyRecords");
  });

  it("no old record is tracked in Git under channels/", () => {
    const tracked = execFileSync("git", ["ls-files", "channels"], { cwd: repo, encoding: "utf8" }).split("\n");
    expect(tracked.filter((f) => names.some((n) => path.posix.basename(f).startsWith(n)))).toEqual([]);
  });
});
