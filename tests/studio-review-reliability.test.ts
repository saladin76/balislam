import { afterAll, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PlanSaveQueue } from "../app/src/planSaveQueue";
import { safeTrim } from "../src/remotion/dafatir/audio/trim";
import { browserPlanRevision } from "../src/plan/revision";
import { planRevision, savePlanFromStudio, readPlanFile } from "../src/plan/io";
import { runWithChannel } from "../src/channel";
import { gateFailureSummary } from "../app/server/contentSync";
import { videoFailureMessage } from "../app/src/workspace/FramePlayer";
import type { Plan } from "../src/plan/types";

describe("plan save recovery", () => {
  it("retains a failed edit, blocks navigation and retries exactly that edit", async () => {
    let offline = true;
    const save = vi.fn(async () => { if (offline) throw new Error("offline"); return "r1"; });
    const queue = new PlanSaveQueue<string>(save);
    queue.seed("a", "001", "r0");
    queue.enqueue("a", "001", "owner edit");
    let navigated = false;
    await queue.flush().then(() => { navigated = true; }, () => {});
    expect(navigated).toBe(false);
    expect(queue.hasPending).toBe(true);
    expect(queue.snapshot?.value).toBe("owner edit");
    // A reload result must not silently rebase a failed/conflicting edit.
    queue.seed("a", "001", "someone else's version");
    offline = false;
    await queue.flush();
    expect(save.mock.calls[1]).toEqual([{ channel: "a", episode: "001", value: "owner edit" }, "r0"]);
    expect(queue.hasPending).toBe(false);
  });
  it("serializes overlapping flushes and coalesces later edits against the acknowledged version", async () => {
    let release!: () => void;
    let started!: () => void;
    const beginning = new Promise<void>((resolve) => { started = resolve; });
    const waiting = new Promise<void>((resolve) => { release = resolve; });
    const calls: string[][] = [];
    const queue = new PlanSaveQueue<string>(async (item, version) => {
      calls.push([item.channel, item.value, version]);
      if (calls.length === 1) { started(); await waiting; }
      return "r" + calls.length;
    });
    queue.seed("original-channel", "001", "r0");
    queue.enqueue("original-channel", "001", "first");
    const first = queue.flush();
    await beginning;
    expect(queue.hasPending).toBe(true);
    queue.enqueue("original-channel", "001", "second");
    queue.enqueue("original-channel", "001", "latest");
    expect(queue.flush()).toBe(first);
    release();
    await first;
    expect(calls).toEqual([["original-channel", "first", "r0"], ["original-channel", "latest", "r1"]]);
    expect(queue.hasPending).toBe(false);
  });
  it("never overwrites an unsaved episode by enqueuing another channel's episode", () => {
    const queue = new PlanSaveQueue<string>(async () => "r1");
    queue.enqueue("a", "001", "first");
    expect(() => queue.enqueue("b", "001", "other")).toThrow(/احفظ/);
    expect(queue.snapshot?.channel).toBe("a");
  });
});

const originalChannels = process.env.BAL_CHANNELS_DIR;
let temp = "";
afterAll(async () => {
  if (originalChannels === undefined) delete process.env.BAL_CHANNELS_DIR; else process.env.BAL_CHANNELS_DIR = originalChannels;
  if (temp) await rm(temp, { recursive: true, force: true });
});
describe("plan compare-and-swap on disk", () => {
  it("allows exactly one of two concurrent saves of the same revision and keeps the winner", async () => {
    temp = await mkdtemp(path.join(os.tmpdir(), "studio-plan-cas-"));
    const dir = path.join(temp, "test-channel", "episodes", "991-test");
    await mkdir(dir, { recursive: true });
    process.env.BAL_CHANNELS_DIR = temp;
    await writeFile(path.join(dir, "script.md"), '---\ntitle: "اختبار"\ndomain: psychology\nepisode: "991"\n---\nنص تجريبي.\n');
    const plan = { channel: "test-channel", episode: "991", title: "base", chapters: [{ number: 1, title: "", scenes: [
      { id: "c1-s1", template: "big-question", narration: "نص تجريبي.", line: 7, props: {}, sfx: [] },
    ] }] } as unknown as Plan;
    await writeFile(path.join(dir, "plan.json"), JSON.stringify(plan));
    expect(await browserPlanRevision(plan)).toBe(planRevision(plan));
    await runWithChannel("test-channel", async () => {
      const current = (await readPlanFile(path.join(dir, "script.md")))!;
      const expectedRevision = planRevision(current);
      const results = await Promise.allSettled([
        savePlanFromStudio("991", { ...plan, title: "first" }, { expectedRevision }),
        savePlanFromStudio("991", { ...plan, title: "second" }, { expectedRevision }),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const refused = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
      expect(refused.reason.code).toBe("PLAN_CONFLICT");
      const saved = JSON.parse(await readFile(path.join(dir, "plan.json"), "utf8"));
      const winner = results[0].status === "fulfilled" ? "first" : "second";
      expect(saved.title).toBe(winner);
    });
  });
});

describe("alignment bounds", () => {
  const bounds = { duration: 1, start: 0.04, end: 1, speechStart: 0.1, speechEnd: 0.9, floorDb: -80, peakDb: -5 };
  it("normalizes one analysis frame of encoder drift without making impossible clip bounds", () => {
    const result = safeTrim(bounds, { start: [0.1], end: [1.01] });
    expect(result.speechEnd).toBe(1);
    expect(result.speechEnd).toBeLessThanOrEqual(result.end);
    expect(result.end).toBeLessThanOrEqual(result.duration);
  });
  it.each([
    { start: [0.1], end: [1.2] },
    { start: [-0.3], end: [0.9] },
    { start: [0.1], end: [NaN] },
    { start: [0.1], end: [] },
    { start: [0.8, 0.2], end: [0.9, 0.3] },
  ])("refuses invalid alignment with a recovery instruction", (alignment) => {
    expect(() => safeTrim(bounds, alignment)).toThrow(/دون توليد جديد/);
  });
  it("preserves already valid measured boundaries", () => {
    expect(safeTrim(bounds, { start: [0.2], end: [0.8] })).toEqual(bounds);
  });
});

it("keeps the failing test and expected/received values in sync diagnostics", () => {
  const diagnostic = gateFailureSummary("noise\n FAIL tests/example.test.ts > rule\nAssertionError: mismatch\nExpected: old\nReceived: new\n✗ gate failed");
  for (const text of ["tests/example.test.ts", "Expected: old", "Received: new"]) expect(diagnostic).toContain(text);
  expect(gateFailureSummary("x".repeat(10000) + "\n✗ refused").length).toBeLessThanOrEqual(7000);
});
it("distinguishes network, decoding and unavailable video failures", () => {
  expect(videoFailureMessage(2)).toContain("تحميل");
  expect(videoFailureMessage(3)).toContain("ترميز");
  expect(videoFailureMessage(4)).toContain("غير متاح");
});
