/**
 * KI-094: على الماك المجلد المؤقت /var/folders/… رابط إلى /private/var/folders/…، فـ git وlsof يعيدان المسار الحقيقي
 * والكود كان يقارنه بالمسار كما أُعطي. فشل اختباران على main نفسه في بوابة جهاز المالك (legacy-migration وstudio-content-sync)
 * فرُفض كل دفع. هنا يُصنع الرابط نفسه على أي نظام: مجلد حقيقي ومسار بديل له عبر رابط.
 */
import { execFileSync, spawn } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { migrateLegacyRecords } from "../src/studio/legacyMigration";
import { freePort, portFree } from "../scripts/studioInstance.mjs";

const base = mkdtempSync(path.join(os.tmpdir(), "ki-094-"));
const realDir = path.join(base, "private-var");
const alias = path.join(base, "var");
mkdirSync(realDir);
symlinkSync(realDir, alias, "dir");
afterAll(() => rmSync(base, { recursive: true, force: true }));
const hasLsof = (() => { try { execFileSync("lsof", ["-v"], { stdio: "ignore" }); return true; } catch { return false; } })();

describe("KI-094: مسار عبر رابط (كـ /var على الماك)", () => {
  it("سجل قديم متتبَّع في Git يُترك مكانه ولو وصلنا إليه عبر الرابط", async () => {
    const root = path.join(alias, "project");
    const other = path.join(root, "channels", "dafatir-alzaman", "episodes", "002-other");
    mkdirSync(other, { recursive: true });
    copyFileSync(path.join(import.meta.dirname, "fixtures", "legacy-records", "scene-review.json"), path.join(other, "scene-review.json"));
    execFileSync("git", ["init", "-q"], { cwd: root });
    execFileSync("git", ["add", path.join(other, "scene-review.json")], { cwd: root });
    const r = await migrateLegacyRecords({ channelsDir: path.join(root, "channels"), backupRoot: path.join(root, "backup") });
    expect(r.skipped).toEqual([{ channel: "dafatir-alzaman", episode: "002-other", name: "scene-review.json", reason: "tracked" }]);
    expect(r.moved).toEqual([]);
  });

  it.skipIf(!hasLsof)("استوديو أقدم من المجلد نفسه يُعرف ويُغلق ولو أُعطي المجلد عبر الرابط", async () => {
    const ours = path.join(alias, "studio");
    mkdirSync(ours);
    const port = 48000 + Math.floor(Math.random() * 1000);
    const old = await new Promise<ReturnType<typeof spawn>>((resolve) => {
      const child = spawn(process.execPath, ["-e", `require("net").createServer().listen(${port},"127.0.0.1",()=>console.log("up"))`], { cwd: ours, stdio: ["ignore", "pipe", "ignore"] });
      child.stdout!.once("data", () => resolve(child));
    });
    try {
      expect(await freePort(port, ours, { log: () => {}, error: () => {} })).toBe(true);
      expect(await portFree(port)).toBe(true);
    } finally { old.kill(); }
  });
});
