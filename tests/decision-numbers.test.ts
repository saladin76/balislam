import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  GRANDFATHERED_DUPLICATES, appendDecision, definitionsIn, duplicateDefinitions, nextDecisionId, readLogs,
} from "../scripts/decisions.mjs";
import { cleanGitEnv } from "../scripts/git-env.mjs";

const repo = path.resolve(import.meta.dirname, "..");
const gitEnv = cleanGitEnv();
const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
const put = (root: string, rel: string, text: string) => {
  mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  writeFileSync(path.join(root, rel), text);
};
const fixture = () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "decisions-"));
  dirs.push(root);
  put(root, "docs/zubdat-alkutub/06-decisions.md", "# سجل\n\n### D46 — مشترك\n\n### D47 — زبدة\n");
  put(root, "docs/dafatir-alzaman/07-decisions.md", "# سجل\n\n## ٩ نوفمبر — مشترك (D46)\n\n## ٩ نوفمبر — دفاتر (D48)\n- يذكر D1–D9 ولا يُحسب\n");
  put(root, "docs/balislam/06-decisions.md", "# سجل\n\n## ٩ نوفمبر — مشترك (D46، المحرك المشترك)\n");
  return root;
};

describe("global decision numbers (D…)", () => {
  it("the repository has no duplicate definition outside the grandfathered list", () => {
    expect(duplicateDefinitions(readLogs(repo))).toEqual([]);
    // the allowlist is exactly the historic duplicates: it may only shrink, never grow
    const all = duplicateDefinitions(readLogs(repo), []).map((d) => d.id).sort();
    expect(all).toEqual([...GRANDFATHERED_DUPLICATES].sort());
  });

  it("allocates after every log and the commit history, so a number used only in one log is never reused", () => {
    const root = fixture();
    // D48 exists only in the dafatir log: a per-log counter on zubdat would wrongly give D48
    expect(nextDecisionId(root, "")).toBe("D49");
    expect(nextDecisionId(root, "commit: a fix (D52)\nD1–D9 tone map")).toBe("D53");
  });

  it("counts history on main of a real repository", () => {
    const root = fixture();
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: root, env: gitEnv });
    execFileSync("git", ["add", "-A"], { cwd: root, env: gitEnv });
    execFileSync("git", ["-c", "user.email=t@example.invalid", "-c", "user.name=T", "commit", "-qm", "Studio: something (D61)"], { cwd: root, env: gitEnv });
    expect(nextDecisionId(root)).toBe("D62");
  });

  it("a new duplicate fails; a cross-reference with the defining log's path does not", () => {
    const root = fixture();
    const logs = readLogs(root);
    expect(duplicateDefinitions(logs, ["D46"])).toEqual([]);
    const clash = { ...logs, "docs/balislam/06-decisions.md": logs["docs/balislam/06-decisions.md"] + "\n## ١٠ نوفمبر — قرار آخر (D48)\n" };
    expect(duplicateDefinitions(clash, ["D46"]).map((d) => d.id)).toEqual(["D48"]);
    const mirror = { ...logs, "docs/balislam/06-decisions.md": logs["docs/balislam/06-decisions.md"] + "\n## ١٠ نوفمبر — دفاتر (D48، التعريف: docs/dafatir-alzaman/07-decisions.md)\n" };
    expect(duplicateDefinitions(mirror, ["D46"])).toEqual([]);
    expect(definitionsIn("### D07 — x").map((d) => d.id)).toEqual(["D7"]);
  });

  it("appendDecision defines once and cross-references elsewhere; the check script passes on the result", () => {
    const root = fixture();
    const id = nextDecisionId(root, "");
    const out = appendDecision(root, id, "قرار جديد", ["docs/zubdat-alkutub/06-decisions.md", "docs/balislam/06-decisions.md"]);
    expect(out[0]!.heading).toBe(`### ${id} — قرار جديد`);
    expect(out[1]!.heading).toContain(`(${id}، التعريف: docs/zubdat-alkutub/06-decisions.md)`);
    expect(readFileSync(path.join(root, "docs/balislam/06-decisions.md"), "utf8")).toContain(out[1]!.heading);
    expect(duplicateDefinitions(readLogs(root), ["D46"])).toEqual([]);
    // the gate runs the CLI in its checkout (cwd): duplicates there exit 1 with the offending lines
    const check = () => spawnSync("node", [path.join(repo, "scripts", "decisions.mjs"), "check"], { cwd: root, encoding: "utf8", env: gitEnv });
    const ok = check();
    expect(ok.status, ok.stderr).toBe(0);
    put(root, "docs/dafatir-alzaman/07-decisions.md", readFileSync(path.join(root, "docs/dafatir-alzaman/07-decisions.md"), "utf8") + `\n## ١٠ نوفمبر — آخر (${id})\n`);
    const bad = check();
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain(`${id} معرَّف أكثر من مرة`);
    expect(bad.stderr).toContain("docs/dafatir-alzaman/07-decisions.md");
  });
});
