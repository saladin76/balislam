import { describe, expect, it } from "vitest";
import { publishCardState } from "../app/src/tabs/PublishTab";

const validPublishedMaster = (p: Parameters<typeof publishCardState>[0], isMaster: boolean) => publishCardState(p, isMaster).approved;

const h = (c: string) => c.repeat(64);
const read = (over: { masterApproved?: boolean; master?: { sha256: string; approved: true; publishAllowed: boolean } | null; candidate?: string | null }) => ({
  progress: { currentScene: null, approvedScenes: 1, totalScenes: 1, canAssemble: true, assemblyApproved: true,
    masterApproved: over.masterApproved ?? true, publishAllowed: false },
  master: over.master === undefined ? { sha256: h("a"), approved: true as const, publishAllowed: false } : over.master,
  candidates: { scenes: {}, assemblySha256: h("b"), masterSha256: over.candidate === undefined ? h("a") : over.candidate },
});

describe("PublishTab trusts only the scene-first Master approval of the exact current file", () => {
  it("no ledger or no Master approval is never an approved Master", () => {
    expect(validPublishedMaster(null, true)).toBe(false);
    expect(validPublishedMaster(read({ masterApproved: false }), true)).toBe(false);
    expect(validPublishedMaster(read({ master: null }), true)).toBe(false);
    // The ledger approved these exact bytes (the server checked 4K + audio then): a missing or stale
    // render.json label never contradicts it (funnel audit 8 Nov, D36).
    expect(validPublishedMaster(read({}), false)).toBe(true);
    expect(publishCardState(read({ masterApproved: false }), false).pill).toBe("معاينة لا تُنشر");
  });

  it("requires the approved hash to equal the current Master file", () => {
    expect(validPublishedMaster(read({}), true)).toBe(true);
    expect(validPublishedMaster(read({ candidate: h("c") }), true)).toBe(false);
    expect(validPublishedMaster(read({ candidate: null }), true)).toBe(false);
  });
});
