import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readPlanFile, writePlanFile } from "../src/plan/io";
import type { Plan } from "../src/plan/types";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("episode plan storage resilience", () => {
  it("does not truncate an existing plan when a later JSON serialization fails", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "studio-core-plan-"));
    dirs.push(root);
    const file = path.join(root, "plan.json");
    const plan = {
      channel: "balislam", title: "حفظ خطة الاختبار",
      chapters: [{ number: 1, scenes: [{ id: "c1-s1", template: "noor-text", props: { text: "مرحبا" }, narration: "" }] }],
    } as unknown as Plan;
    await writePlanFile(file, plan);
    const before = readFileSync(file, "utf8");
    await expect(writePlanFile(file, { ...plan, unsafe: BigInt(1) } as never)).rejects.toThrow();
    expect(readFileSync(file, "utf8")).toBe(before);
    expect((await readPlanFile(path.join(root, "script.md")))?.title).toBe(plan.title);
    expect(readdirSync(root)).toEqual(["plan.json"]);
  });
});
