import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { WORKFLOW_STAGES, STAGE_EVIDENCE, stageFingerprint, type WorkflowSnapshot, type WorkflowStage } from "../src/workflow/gates";
import { signServerEvidence } from "../src/workflow/trust";

process.env.BAL_WORKFLOW_HMAC_KEY = "LOCAL_TEST_ONLY__workflow_gates_256_bit_key_2026_testing";
import {
  approveWorkflowStage, readWorkflow, rejectWorkflowStage, reopenWorkflowStage,
  requireWorkflowGate, submitWorkflowStage, workflowFileFor,
  type StudioChannel, type WorkflowIdentity,
} from "../src/workflow/store";

const owner = { id: "project-owner", role: "owner" as const };
const reviewer = { id: "scene-reviewer", role: "reviewer" as const };
const approvedNote = "I explicitly reviewed this exact artifact at its current revision.";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const snapshot = (): WorkflowSnapshot => Object.fromEntries(WORKFLOW_STAGES.map((s) => [s, { version: `${s}-v1`, sha256: hash(s + "-v1") }]));
const attestation = (stage: WorkflowStage, current: WorkflowSnapshot, actor = owner, subset = STAGE_EVIDENCE[stage]) => signServerEvidence({
  stage, fingerprint: stageFingerprint(current, stage), actorId: actor.id, checkedAt: new Date().toISOString(),
  proofs: subset.map((key) => ({ key, file: "script.md", sha256: hash(stage + ":" + key), verifier: "test_checker" })),
});
const inputs = (scope: WorkflowIdentity, stage: WorkflowStage, current: WorkflowSnapshot) => ({
  stage, snapshot: current, expectedFingerprint: stageFingerprint(current, stage), actor: owner, note: approvedNote,
});
const roots: string[] = [];
const fixture = async (channel: StudioChannel = "balislam", episode = "001-sample") => {
  const channelsRoot = await mkdtemp(path.join(tmpdir(), "studio-workflow-gates-"));
  roots.push(channelsRoot);
  const dir = path.join(channelsRoot, channel, "episodes", episode);
  await mkdir(dir, { recursive: true });
  return { scope: { channelsRoot, channel, episode }, dir, current: snapshot() };
};
const approve = async (scope: WorkflowIdentity, stage: WorkflowStage, current: WorkflowSnapshot) => {
  const args = inputs(scope, stage, current);
  await submitWorkflowStage(scope, args);
  return approveWorkflowStage(scope, { ...args, attestation: attestation(stage, current) });
};
const approveAll = async (scope: WorkflowIdentity, current: WorkflowSnapshot) => {
  for (const stage of WORKFLOW_STAGES) await approve(scope, stage, current);
};
afterEach(async () => { await Promise.all(roots.splice(0).map((r) => rm(r, { recursive: true, force: true }))); });

describe("durable Studio workflow — six explicit stages", () => {
  it("blocks final motion before full voice approval and publication before exact Master signoff", async () => {
    const { scope, current } = await fixture();
    await expect(requireWorkflowGate(scope, current, "final_motion_render")).rejects.toThrow(/script/);
    await approve(scope, "script", current);
    await approve(scope, "storyboard", current);
    await expect(requireWorkflowGate(scope, current, "generate_voice")).resolves.toBeUndefined();
    await submitWorkflowStage(scope, inputs(scope, "voice", current));
    await expect(approveWorkflowStage(scope, { ...inputs(scope, "voice", current), attestation: attestation("voice", current, owner, ["every_clip_reviewed"]) }))
      .rejects.toThrow(/full_audio_listened/);
    await expect(requireWorkflowGate(scope, current, "final_motion_render")).rejects.toThrow(/voice/);
    await approveWorkflowStage(scope, { ...inputs(scope, "voice", current), attestation: attestation("voice", current) });
    await expect(requireWorkflowGate(scope, current, "final_motion_render")).resolves.toBeUndefined();
    await expect(requireWorkflowGate(scope, current, "publish")).rejects.toThrow(/motion/);
    await approve(scope, "motion", current);
    await approve(scope, "av_review", current);
    await expect(requireWorkflowGate(scope, current, "master_render")).resolves.toBeUndefined();
    await expect(requireWorkflowGate(scope, current, "publish")).rejects.toThrow(/master/);
    await approve(scope, "master", current);
    await expect(requireWorkflowGate(scope, current, "publish")).resolves.toBeUndefined();
    const saved = JSON.parse(await readFile(await workflowFileFor(scope), "utf8"));
    expect(saved.stages.master.approval).toMatchObject({ by: owner, contentVersion: "master-v1", artifactSha256: current.master?.sha256 });
    expect(saved.stages.master.approval.at).toMatch(/^\d{4}-\d\d-/);
    expect(saved.history.filter((e: { action: string }) => e.action === "approve")).toHaveLength(6);
  });

  it("refuses bypass, forged owner role, stale UI fingerprint and skipped evidence", async () => {
    const { scope, current } = await fixture();
    await expect(submitWorkflowStage(scope, inputs(scope, "voice", current))).rejects.toThrow(/script/);
    await expect(approveWorkflowStage(scope, { ...inputs(scope, "script", current), attestation: attestation("script", current) })).rejects.toThrow(/submitted/);
    await expect(approveWorkflowStage(scope, { ...inputs(scope, "script", current) })).rejects.toThrow(/submitted/);
    await submitWorkflowStage(scope, inputs(scope, "script", current));
    await expect(approveWorkflowStage(scope, { ...inputs(scope, "script", current), actor: reviewer, attestation: attestation("script", current) })).rejects.toThrow(/owner/);
    await expect(approveWorkflowStage(scope, { ...inputs(scope, "script", current), expectedFingerprint: hash("old"), attestation: attestation("script", current) })).rejects.toThrow(/changed/);
    await expect(approveWorkflowStage(scope, { ...inputs(scope, "script", current), attestation: attestation("script", current, owner, ["script_validated"]) })).rejects.toThrow(/sources_reviewed/);
    await approveWorkflowStage(scope, { ...inputs(scope, "script", current), attestation: attestation("script", current) });
  });

  it("rejects missing, forged or mismatched signed evidence even if every client boolean is true", async () => {
    const { scope, current } = await fixture();
    const args = inputs(scope, "script", current);
    await submitWorkflowStage(scope, args);
    await expect(approveWorkflowStage(scope, { ...args, evidence: Object.fromEntries(STAGE_EVIDENCE.script.map((key) => [key, true])) } as never))
      .rejects.toThrow(/attestation/);
    const signed = attestation("script", current);
    await expect(approveWorkflowStage(scope, { ...args,
      attestation: { ...signed, mac: hash("forged-signature") },
    })).rejects.toThrow(/forged|altered/);
    await expect(approveWorkflowStage(scope, { ...args,
      attestation: { ...signed, actorId: "fake-owner" },
    })).rejects.toThrow(/attestation/);
    await expect(approveWorkflowStage(scope, { ...args,
      attestation: { ...signed, checkedAt: new Date(Date.now() - 600_000).toISOString() },
    })).rejects.toThrow(/expired/);
    expect((await readWorkflow(scope, current)).stages.script.status).toBe("in_review");
  });

  it("invalidates all dependent stages durably when script changes and never resurrects an old approval", async () => {
    const { scope, current } = await fixture();
    await approveAll(scope, current);
    const changed = structuredClone(current);
    changed.script = { version: "script-v2", sha256: hash("new-script-and-sources") };
    await expect(requireWorkflowGate(scope, changed, "publish")).rejects.toThrow();
    const state = await readWorkflow(scope, changed);
    expect(WORKFLOW_STAGES.map((s) => state.stages[s].status)).toEqual(Array(6).fill("needs_reapproval"));
    expect(state.history.filter((e) => e.action === "invalidate")).toHaveLength(6);
    expect((await readWorkflow(scope, current)).stages.script.status).toBe("needs_reapproval");
    // Re-sign the old exact bytes with a new owner event. Older downstream signoffs
    // must stay invalid even though their cumulative content hashes match again.
    await approve(scope, "script", current);
    const afterNewApproval = await readWorkflow(scope, current);
    expect(afterNewApproval.stages.script.status).toBe("approved");
    expect(afterNewApproval.stages.storyboard.status).toBe("needs_reapproval");
    await expect(requireWorkflowGate(scope, current, "publish")).rejects.toThrow();
    const second = await readWorkflow(scope, current);
    expect(second.history.filter((e) => e.action === "invalidate")).toHaveLength(6);
  });

  it.each(["storyboard", "voice", "motion", "av_review", "master"] as const)(
    "changes to %s invalidate exactly that gate and later approvals", async (stage) => {
      const { scope, current } = await fixture();
      await approveAll(scope, current);
      const changed = structuredClone(current);
      changed[stage] = { version: "v2", sha256: hash(`changed-${stage}`) };
      const state = await readWorkflow(scope, changed);
      const idx = WORKFLOW_STAGES.indexOf(stage);
      expect(WORKFLOW_STAGES.map((s, i) => state.stages[s].status)).toEqual(WORKFLOW_STAGES.map((_, i) => i < idx ? "approved" : "needs_reapproval"));
      await expect(requireWorkflowGate(scope, changed, "publish")).rejects.toThrow();
    },
  );

  it("rejection, resubmission and renewed approval need a new explicit decision", async () => {
    const { scope, current } = await fixture();
    await submitWorkflowStage(scope, inputs(scope, "script", current));
    await rejectWorkflowStage(scope, { ...inputs(scope, "script", current), actor: reviewer, note: "Source citation not checked" });
    expect((await readWorkflow(scope, current)).stages.script.status).toBe("rejected");
    await expect(requireWorkflowGate(scope, current, "generate_voice")).rejects.toThrow();
    await reopenWorkflowStage(scope, { ...inputs(scope, "script", current), actor: reviewer });
    expect((await readWorkflow(scope, current)).stages.script.status).toBe("draft");
    await approve(scope, "script", current);
    expect((await readWorkflow(scope, current)).stages.script.status).toBe("approved");
  });

  it("resets an in-review stage after any source change", async () => {
    const { scope, current } = await fixture();
    await submitWorkflowStage(scope, inputs(scope, "script", current));
    const changed = structuredClone(current);
    changed.script = { version: "v2", sha256: hash("update") };
    expect((await readWorkflow(scope, changed)).stages.script.status).toBe("draft");
    await expect(approveWorkflowStage(scope, { ...inputs(scope, "script", changed), attestation: attestation("script", changed) })).rejects.toThrow(/submitted/);
  });

  it("serializes concurrent writers and keeps a valid audit ledger", async () => {
    const { scope, current, dir } = await fixture();
    await submitWorkflowStage(scope, inputs(scope, "script", current));
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => approveWorkflowStage(scope, { ...inputs(scope, "script", current), attestation: attestation("script", current) })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(7);
    const doc = await readWorkflow(scope, current);
    expect(doc.history).toHaveLength(2);
    expect(doc.revision).toBe(2);
    expect((await readdir(dir)).filter((name) => name.endsWith(".lock") || name.endsWith(".tmp"))).toEqual([]);
  });

  it("keeps all three channels and identical episode names completely isolated under concurrent mutations", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "workflow-channel-isolation-"));
    roots.push(root);
    const scopes = (["balislam", "dafatir-alzaman", "zubdat-alkutub"] as const).map((channel) => ({ channelsRoot: root, channel, episode: "001-same-name" }));
    await Promise.all(scopes.map((scope) => mkdir(path.join(root, scope.channel, "episodes", scope.episode), { recursive: true })));
    const s = snapshot();
    await Promise.all(scopes.map((scope) => approve(scope, "script", s)));
    await Promise.all(scopes.map((scope) => approve(scope, "storyboard", s)));
    const other = structuredClone(s); other.script = { version: "v2", sha256: hash("balislam-only") };
    await readWorkflow(scopes[0]!, other);
    expect((await readWorkflow(scopes[0]!, other)).stages.storyboard.status).toBe("needs_reapproval");
    for (const scope of scopes.slice(1)) {
      const doc = await readWorkflow(scope, s);
      expect(doc.stages.storyboard.status).toBe("approved");
      expect(doc.history.filter((e) => e.action === "invalidate")).toHaveLength(0);
    }
    expect(new Set(await Promise.all(scopes.map(workflowFileFor))).size).toBe(3);
  });

  it("fails closed for corrupt ledger, invalid episode path and symlink escape without touching other files", async () => {
    const { scope, current, dir } = await fixture();
    await writeFile(path.join(dir, "keep.txt"), "untouched");
    const ledger = await workflowFileFor(scope);
    await writeFile(ledger, "NOT JSON");
    await expect(requireWorkflowGate(scope, current, "publish")).rejects.toThrow();
    expect(await readFile(ledger, "utf8")).toBe("NOT JSON");
    expect(await readFile(path.join(dir, "keep.txt"), "utf8")).toBe("untouched");
    await expect(workflowFileFor({ ...scope, episode: "../../another" })).rejects.toThrow(/Invalid episode/);
    const outside = await mkdtemp(path.join(tmpdir(), "workflow-outside-")); roots.push(outside);
    await symlink(outside, path.join(scope.channelsRoot, scope.channel, "episodes", "002-escape"));
    await expect(workflowFileFor({ ...scope, episode: "002-escape" })).rejects.toThrow(/real directory/);
    expect((await readdir(dir)).some((name) => name.endsWith(".lock"))).toBe(false);
  });
});
