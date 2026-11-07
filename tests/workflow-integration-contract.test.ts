import { describe, expect, it, vi } from "vitest";
import { createWorkflowProtectedPorts, type WorkflowArtifactLock, type WorkflowGateService } from "../src/workflow/ports";
import type { WorkflowSnapshot } from "../src/workflow/gates";

describe("mandatory Studio production ports — integration acceptance contract", () => {
  const snapshot: WorkflowSnapshot = {
    script: { version: "s1", sha256: "a".repeat(64) },
    storyboard: { version: "b1", sha256: "b".repeat(64) },
    voice: { version: "v1", sha256: "c".repeat(64) },
    motion: { version: "m1", sha256: "d".repeat(64) },
    av_review: { version: "av1", sha256: "e".repeat(64) },
    master: { version: "f1", sha256: "f".repeat(64) },
  };
  it("never starts protected side effects when the server gate denies the operation", async () => {
    const gate = vi.fn(async () => { throw new Error("Stage has no owner approval"); });
    const publisherGate = vi.fn(async () => { throw new Error("Master bytes not approved"); });
    const lock = vi.fn(async <T>(work: () => Promise<T>) => work()) as WorkflowArtifactLock;
    const ports = createWorkflowProtectedPorts({ gate, withVerifiedMasterPublication: publisherGate } as never, lock);
    const runner = vi.fn(async () => "ran");
    await expect(ports.generateVoice(runner)).rejects.toThrow(/approval/);
    await expect(ports.renderFinalMotion(runner)).rejects.toThrow(/approval/);
    await expect(ports.renderMasterCandidate(runner)).rejects.toThrow(/approval/);
    await expect(ports.publishExactMaster(runner as never)).rejects.toThrow(/Master/);
    expect(runner).not.toHaveBeenCalled();
    expect(gate.mock.calls).toHaveLength(3);
    expect(gate.mock.calls.map((call) => call[0])).toEqual([
      "generate_voice", "final_motion_render", "master_render",
    ]);
  });

  it("passes the server-verified snapshot into the exact guarded operation under the shared edit lock", async () => {
    let locked = false;
    const order: string[] = [];
    const lock: WorkflowArtifactLock = async (work) => {
      if (locked) throw Error("Concurrent source write lock breach");
      locked = true; order.push("lock");
      try { return await work(); }
      finally { order.push("unlock"); locked = false; }
    };
    const gate = vi.fn(async (action: string) => {
      expect(locked).toBe(true);
      order.push("gate:" + action);
      return { snapshot, manifest: { stages: {} } };
    });
    const publish = vi.fn(async (fn: (v: { file: string; sha256: string; snapshot: WorkflowSnapshot }) => Promise<string>) => {
      expect(locked).toBe(true);
      return fn({ file: "/private/frozen-approved-master.mp4", sha256: snapshot.master!.sha256, snapshot });
    });
    const ports = createWorkflowProtectedPorts({ gate, withVerifiedMasterPublication: publish } as never, lock);
    const received = await ports.renderFinalMotion(async (verified) => {
      expect(locked).toBe(true);
      expect(verified.snapshot).toEqual(snapshot);
      order.push("motion");
      return "candidate-only";
    });
    expect(received).toBe("candidate-only");
    expect(order).toEqual(["lock", "gate:final_motion_render", "motion", "unlock"]);
    const p = await ports.publishExactMaster(async (v) => {
      expect(locked).toBe(true);
      expect(v.file).toContain("frozen-approved");
      expect(v.sha256).toBe(snapshot.master!.sha256);
      return "test-publisher";
    });
    expect(p).toBe("test-publisher");
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it("requires a real shared artifact edit lock; cannot silently run without it", () => {
    const fake = { gate: vi.fn(), withVerifiedMasterPublication: vi.fn() } as unknown as WorkflowGateService;
    expect(() => createWorkflowProtectedPorts(fake, undefined as never)).toThrow(/lock/);
  });
});
