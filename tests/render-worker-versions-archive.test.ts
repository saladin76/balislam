/**
 * D226: أرشيف النسخ السابقة (versions/) محلي ولا يقرؤه الرندر، فلا يمنع worker-submit؛
 * أما أي ملف آخر في الحلقة مختلف عن آخر commit فيمنعه كما كان.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertCommitMatchesWorkingTree } from "../src/render/worker/macSide";

const sh = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, stdio: "pipe" }).toString();

describe("D226: worker-submit وأرشيف versions/", () => {
  it("يتجاهل versions/ غير المتتبَّع، ويرفض أي تعديل آخر في الحلقة", async () => {
    const remote = mkdtempSync(path.join(os.tmpdir(), "wv-remote-"));
    sh(remote, "init", "-q", "--bare");
    const repo = mkdtempSync(path.join(os.tmpdir(), "wv-"));
    sh(repo, "init", "-q", "-b", "main");
    sh(repo, "config", "user.email", "t@t"); sh(repo, "config", "user.name", "t");
    const ep = path.join(repo, "channels", "c1", "episodes", "001-x");
    mkdirSync(ep, { recursive: true });
    writeFileSync(path.join(ep, "plan.json"), "{}");
    sh(repo, "add", "."); sh(repo, "commit", "-qm", "init");
    sh(repo, "remote", "add", "origin", remote); sh(repo, "push", "-q", "origin", "main");
    mkdirSync(path.join(ep, "versions", "2d-v14"), { recursive: true });
    writeFileSync(path.join(ep, "versions", "2d-v14", "prefinal.mp4"), "x");
    await expect(assertCommitMatchesWorkingTree(repo, "c1", "001-x")).resolves.toMatch(/^[0-9a-f]{40}$/);
    writeFileSync(path.join(ep, "plan.json"), "{\"changed\":1}");
    await expect(assertCommitMatchesWorkingTree(repo, "c1", "001-x")).rejects.toThrow(/plan\.json/);
  });
});
