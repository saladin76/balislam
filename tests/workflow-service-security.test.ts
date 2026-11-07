import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { link, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { WORKFLOW_STAGES, STAGE_EVIDENCE, stageFingerprint, type WorkflowStage } from "../src/workflow/gates";
import { collectActualArtifactDigests, sha256File, sha256FileAndEpoch, type ArtifactManifest } from "../src/workflow/artifacts";
import { createTrustedWorkflowService, type AuthenticatedWorkflowPrincipal } from "../src/workflow/service";
import { workflowFileFor, type WorkflowIdentity } from "../src/workflow/store";

process.env.BAL_WORKFLOW_HMAC_KEY = "LOCAL_TEST_ONLY__workflow_gates_256_bit_key_2026_testing";
const roots: string[] = [];
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const stageEvidenceFile = {
  script: "script-review.json", storyboard: "storyboard-review.json",
  voice: "voice-review.json", motion: "motion-review.json",
  av_review: "av-review.json", master: "master-review.json",
} as const;
const fileByStage = {
  script: ["script.md", stageEvidenceFile.script],
  storyboard: ["storyboard.json", "images/shot.png", stageEvidenceFile.storyboard],
  voice: ["voice/clip.mp3", stageEvidenceFile.voice],
  motion: ["motion.mp4", stageEvidenceFile.motion],
  av_review: ["av.mp4", stageEvidenceFile.av_review],
};
const make = async (channel: WorkflowIdentity["channel"] = "balislam", episode = "001-demo") => {
  const channelsRoot = await mkdtemp(path.join(os.tmpdir(), "workflow-contract-"));
  roots.push(channelsRoot);
  const scope: WorkflowIdentity = { channelsRoot, channel, episode };
  const dir = path.join(channelsRoot, channel, "episodes", episode);
  await mkdir(path.join(dir, "voice"), { recursive: true });
  await mkdir(path.join(dir, "images"), { recursive: true });
  for (const name of new Set([...Object.values(fileByStage).flat(), ...Object.values(stageEvidenceFile), "master.mp4"])) {
    await writeFile(path.join(dir, name), name + ":V1");
  }
  const manifest: ArtifactManifest = {
    stages: Object.fromEntries(Object.entries(fileByStage).map(([stage, files]) => [stage, { version: stage + "-V1", files }])),
    master: { version: "master-V1", file: "master.mp4" },
  };
  const user: { current: AuthenticatedWorkflowPrincipal } = {
    current: { id: "logged-in-reviewer", role: "reviewer", authenticated: true },
  };
  let checkFileChange: (() => Promise<void>) | undefined;
  let pending: Promise<void> = Promise.resolve();
  const sharedLock = async <T>(work: () => Promise<T>): Promise<T> => {
    const previous = pending;
    let release!: () => void;
    pending = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try { return await work(); } finally { release(); }
  };
  const service = createTrustedWorkflowService({
    scope,
    withArtifactLock: sharedLock,
    authenticate: async () => user.current,
    currentManifest: async () => manifest,
    verifiedEvidence: async (stage) => {
      const file = stageEvidenceFile[stage];
      const proof = await sha256FileAndEpoch(path.join(dir, file));
      if (checkFileChange) await checkFileChange();
      return STAGE_EVIDENCE[stage].map((key) =>
        ({ key, file, sha256: proof.sha256, epoch: proof.epoch, verifier: "server_review_ledger_validator" }));
    },
  });
  const owner = () => { user.current = { id: "actual-owner-session", role: "owner", authenticated: true }; };
  const approve = async (stage: WorkflowStage) => {
    const { snapshot } = await service.inspect();
    const cmd = {
      stage, expectedFingerprint: stageFingerprint(snapshot, stage),
      note: "Human inspected the current artifacts, with source receipts.",
    };
    await service.command({ action: "submit", ...cmd });
    await service.command({ action: "approve", ...cmd });
  };
  const allApproved = async () => { owner(); for (const stage of WORKFLOW_STAGES) await approve(stage); };
  return { scope, dir, manifest, user, owner, approve, allApproved, service,
    changeWhileChecking: (fn: () => Promise<void>) => { checkFileChange = fn; } };
};
afterEach(async () => {
  await Promise.all(roots.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("trusted workflow API, evidence and exact-master publication contract", () => {
  it("builds stage hashes from owned files; changes to bytes invalidate the digest, Master is exact file SHA", async () => {
    const x = await make();
    const a = await collectActualArtifactDigests(x.scope, x.manifest);
    expect(a.master?.sha256).toBe(await sha256File(path.join(x.dir, "master.mp4")));
    await writeFile(path.join(x.dir, "script-review.json"), "UPDATED SOURCE REVIEW");
    const b = await collectActualArtifactDigests(x.scope, x.manifest);
    expect(a.script?.sha256).not.toBe(b.script?.sha256);
    expect(a.master?.sha256).toBe(b.master?.sha256);
    expect(a.voice?.sha256).toBe(b.voice?.sha256);
  });

  it("never honors client-submitted role, identity, snapshot, evidence, or arbitrary source paths", async () => {
    const x = await make();
    const { snapshot } = await x.service.inspectInternal();
    const allowed = { action: "submit", stage: "script", expectedFingerprint: stageFingerprint(snapshot, "script"),
      note: "Sent for owner review" };
    await expect(x.service.command({ ...allowed, actor: { id: "hacker", role: "owner" } } as never))
      .rejects.toThrow(/Client cannot submit/);
    await expect(x.service.command({ ...allowed, evidence: { script_validated: true } } as never))
      .rejects.toThrow(/Client cannot submit/);
    await expect(x.service.command({ ...allowed, snapshot } as never)).rejects.toThrow(/Client cannot submit/);
    await x.service.command(allowed as never);
    await expect(x.service.command({ ...allowed, action: "approve", note: "Actual reviewer not owner" } as never))
      .rejects.toThrow(/owner/);
    x.owner();
    await x.service.command({ ...allowed, action: "approve", note: "Actual owner approved every verified source" } as never);
    const doc = (await x.service.inspectInternal()).ledger;
    expect(doc.stages.script.approval?.by.id).toBe("actual-owner-session");
    expect(doc.stages.script.approval?.evidenceProofs).toHaveLength(3);
  });

  it("blocks a stage when evidence changed during independent server verification", async () => {
    const x = await make(); x.owner();
    const { snapshot } = await x.service.inspectInternal();
    const cmd = { stage: "script" as const, expectedFingerprint: stageFingerprint(snapshot, "script"),
      note: "Reviewed all source citations and Qur'an matches" };
    await x.service.command({ action: "submit", ...cmd });
    x.changeWhileChecking(async () => {
      await writeFile(path.join(x.dir, "script-review.json"), "changed during verification");
    });
    await expect(x.service.command({ action: "approve", ...cmd })).rejects.toThrow(/evidence source changed/i);
    expect((await x.service.inspectInternal()).ledger.stages.script.status).toBe("draft");
  });

  it("exposes a sanitized role-sensitive inspect().view contract for Studio UI PR #74", async () => {
    const x = await make();
    const pending = await x.service.inspect();
    expect(pending.view.schemaVersion).toBe(1);
    expect(pending.uiSnapshot.schemaVersion).toBe(3);
    expect(pending.uiSnapshot.channel).toBe(x.scope.channel);
    expect(pending.uiSnapshot.episode).toBe(x.scope.episode);
    expect(Object.keys(pending.uiSnapshot.stages)).toEqual([...WORKFLOW_STAGES]);
    expect(pending.uiSnapshot.stages.script.status).toBe("draft");
    expect(pending.view.stages.map((stage) => stage.stage)).toEqual([...WORKFLOW_STAGES]);
    expect(pending.view.stages[0]?.canSubmit).toBe(true);
    expect(pending.view.stages[1]?.canSubmit).toBe(false);
    expect(pending.view.gates.generate_voice.allowed).toBe(false);
    expect(pending.view.gates.publish.allowed).toBe(false);
    expect("ledger" in pending).toBe(false);
    expect("snapshot" in pending).toBe(false);
    const serialized = JSON.stringify(pending.view);
    expect(serialized).not.toMatch(/BAL_WORKFLOW_HMAC_KEY|integrity|evidenceProofs|script\.md|mac/);
    expect(JSON.stringify(pending.uiSnapshot)).not.toMatch(/integrity|evidenceProofs|script\.md|mac/);
    await x.allApproved();
    const ownerView = (await x.service.inspect()).view;
    expect(ownerView.stages.every((stage) => stage.status === "approved")).toBe(true);
    expect(ownerView.gates.publish.allowed).toBe(true);
    expect(ownerView.stages[5]?.approved?.by).toBe("actual-owner-session");
    const ownerUi = (await x.service.inspect()).uiSnapshot;
    for (const stage of WORKFLOW_STAGES) {
      expect(ownerUi.stages[stage].currentApproval).toBe(true);
      expect(ownerUi.stages[stage].approval?.artifactEpoch).toMatch(/^[a-f0-9]{64}$/);
      expect(ownerUi.stages[stage].approval?.approvalEventSeq).toBeGreaterThan(0);
      expect((ownerUi.stages[stage].approval as any)?.evidenceProofs).toBeUndefined();
    }
    expect(ownerUi.history.filter((event) => event.action === "approve")).toHaveLength(6);
    x.user.current = { id: "authenticated-reviewer", role: "reviewer", authenticated: true };
    const reviewerView = (await x.service.inspect()).view;
    expect(reviewerView.gates.publish.allowed).toBe(false);
    expect(reviewerView.gates.publish.reason).toMatch(/owner/);
    expect(reviewerView.stages[5]?.approved?.by).toBe("actual-owner-session");
  });

  it("requires a valid human session and prevents skipped stage approval", async () => {
    const x = await make();
    x.user.current = { id: "fake", role: "owner", authenticated: false } as never;
    await expect(x.service.inspectInternal()).rejects.toThrow(/authenticated/);
    x.owner();
    const { snapshot } = await x.service.inspectInternal();
    await expect(x.service.command({ action: "submit", stage: "voice", expectedFingerprint: stageFingerprint(snapshot, "voice"),
      note: "Attempt to bypass storyboard" })).rejects.toThrow(/script/);
    await expect(x.service.gate("publish")).rejects.toThrow();
  });

  it("revokes all downstream approvals on source edit; restoring old bytes does not revive signoffs", async () => {
    const x = await make(); await x.allApproved();
    const original = await readFile(path.join(x.dir, "script.md"));
    await writeFile(path.join(x.dir, "script.md"), "changed script and Quran refs");
    await expect(x.service.gate("publish")).rejects.toThrow();
    let doc = (await x.service.inspectInternal()).ledger;
    expect(WORKFLOW_STAGES.map((stage) => doc.stages[stage].status)).toEqual(Array(6).fill("needs_reapproval"));
    await writeFile(path.join(x.dir, "script.md"), original);
    doc = (await x.service.inspectInternal()).ledger;
    expect(WORKFLOW_STAGES.map((stage) => doc.stages[stage].status)).toEqual(Array(6).fill("needs_reapproval"));
  });

  it.each([
    ["script", "script.md"], ["storyboard", "images/shot.png"],
    ["voice", "voice/clip.mp3"], ["motion", "motion.mp4"],
    ["av_review", "av.mp4"], ["master", "master.mp4"],
  ] as const)("changing actual %s bytes revokes only that and dependent decisions permanently", async (stage, file) => {
    const x = await make(); await x.allApproved();
    const original = await readFile(path.join(x.dir, file));
    await writeFile(path.join(x.dir, file), Buffer.concat([original, Buffer.from("changed-bytes")]));
    await expect(x.service.gate("publish")).rejects.toThrow();
    const invalid = (await x.service.inspectInternal()).ledger;
    const changedIndex = WORKFLOW_STAGES.indexOf(stage);
    expect(WORKFLOW_STAGES.map((k, i) => invalid.stages[k].status))
      .toEqual(WORKFLOW_STAGES.map((_k, i) => i < changedIndex ? "approved" : "needs_reapproval"));
    await writeFile(path.join(x.dir, file), original);
    const restored = (await x.service.inspectInternal()).ledger;
    expect(WORKFLOW_STAGES.map((k, i) => restored.stages[k].status))
      .toEqual(WORKFLOW_STAGES.map((_k, i) => i < changedIndex ? "approved" : "needs_reapproval"));
  });

  it("detects rewrite-then-restore without any intervening workflow read", async () => {
    const x = await make(); await x.allApproved();
    const original = await readFile(path.join(x.dir, "script.md"));
    const before = await collectActualArtifactDigests(x.scope, x.manifest);
    await writeFile(path.join(x.dir, "script.md"), "TEMPORARY DIFFERENT SCRIPT");
    await writeFile(path.join(x.dir, "script.md"), original);
    // Exact same SHA-256 content, but a new file generation invalidates old signoffs.
    const after = await collectActualArtifactDigests(x.scope, x.manifest);
    expect(after.script?.sha256).toBe(before.script?.sha256);
    expect(after.script?.epoch).not.toBe(before.script?.epoch);
    await expect(x.service.gate("publish")).rejects.toThrow(/script/);
    const doc = (await x.service.inspectInternal()).ledger;
    expect(WORKFLOW_STAGES.map((stage) => doc.stages[stage].status))
      .toEqual(Array(6).fill("needs_reapproval"));
  });

  it("revokes an independently verified review receipt even if its exact bytes were restored and it was omitted from manifest", async () => {
    const x = await make();
    // Deliberately leave this receipt out of the trusted stage artifact manifest.
    // Gate security must still be enforced by the separately signed proof epoch.
    x.manifest.stages.script = { version: "script-V1", files: ["script.md"] };
    await x.allApproved();
    const original = await readFile(path.join(x.dir, "script-review.json"));
    const before = await collectActualArtifactDigests(x.scope, x.manifest);
    await writeFile(path.join(x.dir, "script-review.json"), "ATTEMPTED REVIEW TAMPER");
    await writeFile(path.join(x.dir, "script-review.json"), original);
    const after = await collectActualArtifactDigests(x.scope, x.manifest);
    expect(after.script).toEqual(before.script);
    await expect(x.service.gate("publish")).rejects.toThrow(/evidence for script changed/i);
    const result = await x.service.inspectInternal();
    expect(result.ledger.stages.script.status).toBe("needs_reapproval");
    expect(result.view.gates.publish.allowed).toBe(false);
  });

  it("revokes signed master and later publish even if Master bytes were not edited but its review proof changed", async () => {
    const x = await make(); await x.allApproved();
    await x.service.gate("publish");
    await writeFile(path.join(x.dir, "master-review.json"), "review was revoked");
    await expect(x.service.gate("publish")).rejects.toThrow(/evidence.*master changed/);
    const doc = (await x.service.inspectInternal()).ledger;
    expect(doc.stages.master.status).toBe("needs_reapproval");
  });

  it("an authenticated reviewer cannot publish, even if every stage was previously approved by the owner", async () => {
    const x = await make(); await x.allApproved();
    x.user.current = { id: "reviewer-session", role: "reviewer", authenticated: true };
    await expect(x.service.gate("publish")).rejects.toThrow(/owner/);
    let dispatched = false;
    await expect(x.service.withVerifiedMasterPublication(async () => { dispatched = true; }))
      .rejects.toThrow(/owner/);
    expect(dispatched).toBe(false);
  });

  it("publication receives only a frozen exact-byte Master and cleans the private copy even when callback fails", async () => {
    const x = await make(); await x.allApproved();
    const old = await readFile(path.join(x.dir, "master.mp4"), "utf8");
    let received = "";
    const result = await x.service.withVerifiedMasterPublication(async (approved) => {
      received = approved.file;
      expect(approved.file).not.toBe(path.join(x.dir, "master.mp4"));
      expect(approved.sha256).toBe(sha(old));
      await writeFile(path.join(x.dir, "master.mp4"), "an unapproved replacement");
      expect(await readFile(approved.file, "utf8")).toBe(old);
      return "DISPATCHED_ONLY_TEST_FAKE";
    });
    expect(result).toBe("DISPATCHED_ONLY_TEST_FAKE");
    expect(existsSync(received)).toBe(false);
    await expect(x.service.gate("publish")).rejects.toThrow(/master/);
  });

  it("rejects a Master rewritten with identical bytes before publication, even without a status read", async () => {
    const x = await make(); await x.allApproved();
    const masterFile = path.join(x.dir, "master.mp4");
    const exact = await readFile(masterFile);
    // Content SHA remains identical. The OS generation epoch must not.
    const before = await collectActualArtifactDigests(x.scope, x.manifest);
    await writeFile(masterFile, exact);
    const after = await collectActualArtifactDigests(x.scope, x.manifest);
    expect(after.master?.sha256).toBe(before.master?.sha256);
    expect(after.master?.epoch).not.toBe(before.master?.epoch);
    let published = false;
    await expect(x.service.withVerifiedMasterPublication(async () => { published = true; }))
      .rejects.toThrow(/master|changed/i);
    expect(published).toBe(false);
  });

  it("rejects changed exact Master bytes before invoking publisher callback", async () => {
    const x = await make(); await x.allApproved();
    await writeFile(path.join(x.dir, "master.mp4"), "unapproved bytes");
    let called = false;
    await expect(x.service.withVerifiedMasterPublication(async () => { called = true; }))
      .rejects.toThrow();
    expect(called).toBe(false);
  });

  it("rejects self-referential approval ledgers and Master files outside the episode", async () => {
    const x = await make();
    await expect(collectActualArtifactDigests(x.scope, {
      ...x.manifest,
      stages: { ...x.manifest.stages,
        script: { version: "bad", files: ["script.md", "workflow-approvals.json"] } },
    })).rejects.toThrow(/self-referential/);
    await expect(collectActualArtifactDigests(x.scope, {
      ...x.manifest, master: { version: "v2", file: "channel-images/master.mp4" },
    })).rejects.toThrow(/episode-owned/);
    const root = await mkdtemp(path.join(os.tmpdir(), "workflow-symlink-channel-")); roots.push(root);
    const real = path.join(root, "original");
    await mkdir(path.join(real, "episodes", "001-test"), { recursive: true });
    await symlink(real, path.join(root, "balislam"));
    await expect(workflowFileFor({ channelsRoot: root, channel: "balislam", episode: "001-test" }))
      .rejects.toThrow(/Channel must be a real directory/);
  });

  it("refuses symlink evidence, another episode path, corrupted signed ledger or missing signing secret", async () => {
    const x = await make(); await x.allApproved();
    const ledger = await workflowFileFor(x.scope);
    const saved = await readFile(ledger, "utf8");
    const tampered = JSON.parse(saved);
    tampered.stages.master.approval.artifactSha256 = sha("forged");
    await writeFile(ledger, JSON.stringify(tampered));
    await expect(x.service.inspectInternal()).rejects.toThrow(/Invalid workflow ledger/);
    await writeFile(ledger, saved);
    const changedHistory = JSON.parse(saved);
    changedHistory.history[0].by = "forged-owner";
    await writeFile(ledger, JSON.stringify(changedHistory));
    await expect(x.service.inspectInternal()).rejects.toThrow(/Invalid workflow ledger/);
    await writeFile(ledger, saved);
    const originalKey = process.env.BAL_WORKFLOW_HMAC_KEY;
    try {
      process.env.BAL_WORKFLOW_HMAC_KEY = "WRONG_TEST_KEY_SAME_LENGTH_SIGNING_SECRET_123456";
      await expect(x.service.inspectInternal()).rejects.toThrow(/Invalid workflow ledger/);
    } finally { process.env.BAL_WORKFLOW_HMAC_KEY = originalKey; }
    const outside = await mkdtemp(path.join(os.tmpdir(), "foreign-artifact-")); roots.push(outside);
    await writeFile(path.join(outside, "other.mp4"), "outside");
    await symlink(path.join(outside, "other.mp4"), path.join(x.dir, "borrowed.mp4"));
    const forgedManifest: ArtifactManifest = { stages: { ...x.manifest.stages,
      motion: { version: "M2", files: ["borrowed.mp4"] } }, master: x.manifest.master };
    await expect(collectActualArtifactDigests(x.scope, forgedManifest)).rejects.toThrow(/Symlink/);
    await link(path.join(outside, "other.mp4"), path.join(x.dir, "borrowed-hardlink.mp4"));
    const hardlinkManifest: ArtifactManifest = { ...x.manifest,
      stages: { ...x.manifest.stages, motion: { version: "M3", files: ["borrowed-hardlink.mp4"] } } };
    await expect(collectActualArtifactDigests(x.scope, hardlinkManifest)).rejects.toThrow(/hardlinks|linked/);
    // A signed ledger is not allowed to share an inode with another episode.
    const alias = path.join(x.dir, "ledger-hardlink.json");
    await link(ledger, alias);
    await expect(x.service.inspectInternal()).rejects.toThrow(/isolated regular file/);
    await rm(alias);
    const oldKey = process.env.BAL_WORKFLOW_HMAC_KEY;
    try {
      delete process.env.BAL_WORKFLOW_HMAC_KEY;
      await expect(x.service.inspectInternal()).rejects.toThrow(/signing key/);
    } finally { process.env.BAL_WORKFLOW_HMAC_KEY = oldKey; }
  });
});
