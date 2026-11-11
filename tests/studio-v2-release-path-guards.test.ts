import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const text = (file: string) => readFileSync(path.join(root, file), "utf8");

describe("Studio V2 release-path safety regressions", () => {
  it("rejects an unreviewed or stale storyboard when the new scene-first workflow is approved", () => {
    const service = text("src/studio/sceneService.ts");
    expect(service).toContain('import { loadStoryboard, recordBoardsAfterPreparation, storyboardStatus } from "../plan/storyboard"');
    expect(service).toContain("storyboardStatus(plan, boardRecord)");
    expect(service).toContain("boardStatus.ok && Boolean(boardStatus.audit?.note?.trim())");
    expect(service).toContain('if (!current.planReady)');
  });

  it("never guides the owner to fetch Quran verse text when approving a storyboard", () => {
    const board = text("src/plan/storyboard.ts");
    expect(board).not.toContain("اجلب نصوص الآيات");
    expect(board).toContain("أضف نص الآيات كاملًا داخل السكريبت");
  });

  it("only episode-owned reviewed Quran audio is selected or copied for a final render", () => {
    const collector = text("src/plan/collect.ts");
    expect(collector).toContain("verifiedOwnRecitations(scriptPath)");
    expect(collector).toContain("requireApprovedQuran");
    expect(collector).toContain('r.source !== "manual"');
    expect(collector).not.toMatch(/quran-foundation|alquran-cloud|recitationFileFor\(/i);
  });

  it("forbids release packaging of a changed Master and bypass of manual Quran review", () => {
    const packager = text("src/package/package.ts");
    expect(packager).toContain('await requireSceneMasterReady(ep)');
    expect(packager).toContain('requireApprovedQuran: quality === "master" || stage === "shorts"');
    // Unified engine: the six-stage ledger is no longer consulted; publishing asks the scene ledger.
    expect(packager).not.toContain('assertWorkflowForEpisode(ep, "publish")');
    expect(text("src/workflow/server.ts")).toContain("requirePublishAllowed(episode)");
    const production = text("src/render/episode.ts");
    expect(production).toContain("requireScenesReadyForMaster");
    expect(production).toContain("assertRenderedRecitationsMatchApprovals");
  });

  it("rejects third-party Quran API calls from live episode and configuration paths", () => {
    for (const file of ["app/server/api.ts", "app/server/extra.ts", "app/src/App.tsx"]) {
      expect(text(file)).not.toMatch(/quranClientFromEnv|syncQuran|QF_CLIENT_ID|QF_CLIENT_SECRET/);
    }
    expect(text("app/server/api.ts")).toContain("أُلغِي الجلب الخارجي");
  });
});
