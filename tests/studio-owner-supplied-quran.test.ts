import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = (file: string) => readFileSync(path.join(root, file), "utf8");

describe("Studio owner-supplied Quran media, no external provider UI or dispatch", () => {
  it("has no managed external Quran API keys or connection setup", () => {
    for (const file of [".env.example", "src/settings/env.ts", "app/src/tabs/SettingsTab.tsx"]) {
      expect(source(file)).not.toMatch(/QF_CLIENT_ID|QF_CLIENT_SECRET|QF_ENV|quran\.foundation/i);
    }
  });

  it("never invokes a Quran provider on episode open or package production", () => {
    for (const file of ["app/src/App.tsx", "src/package/make.ts"]) {
      expect(source(file)).not.toMatch(/quranClientFromEnv|syncQuran|QF_CLIENT_ID|api\.quran\(/);
    }
  });

  it("does not show provider catalog, account setup or reciter browsing in active screens", () => {
    for (const file of [
      "app/src/tabs/ChannelTab.tsx", "app/src/tabs/EpisodeTab.tsx",
      "app/src/workspace/VoiceWorkspaceTab.tsx",
    ]) {
      expect(source(file)).not.toMatch(/Quran Foundation|QF_CLIENT|AlQuranCloudBrowser|api\.quran\(/i);
    }
  });

  it("does not access provider APIs from live server handlers", () => {
    for (const file of ["app/server/api.ts", "app/server/extra.ts"]) {
      expect(source(file)).not.toMatch(/quranClientFromEnv|syncQuran|QF_CLIENT/);
    }
    expect(source("app/server/api.ts")).toMatch(/الجلب الخارجي/);
  });

  it("collects only manually reviewed episode-owned recordings with no global fallback", () => {
    const collector = source("src/plan/collect.ts");
    expect(collector).toContain("verifiedOwnRecitations(scriptPath)");
    expect(collector).toContain("requireApprovedQuran");
    expect(collector).toContain('r.source !== "manual"');
    expect(collector).not.toMatch(/quran-foundation|alquran-cloud|recitationFileFor\(/i);
    const gate = source("src/voice/motionGate.ts");
    expect(gate).toContain("approvedRecitationsForRender(scriptPath, undefined)");
    expect(gate).not.toMatch(/activeRecitation|isCloudRecitation|QF_MAX_AGE/);
  });

  it("contains separate owner-upload and human listening commands", () => {
    const cli = source("src/cli/index.ts");
    expect(cli).toContain('.command("recitation-attach")');
    expect(cli).toContain('.command("recitation-review")');
    expect(cli).toContain("prepareOwnRecitation");
    expect(cli).toContain("approveOwnRecitation");
    expect(cli).not.toContain(".command(\"quran\")");
  });

  it("never puts an external Quran attribution in newly generated video descriptions", () => {
    const youtube = source("src/package/youtube.ts");
    expect(youtube).not.toMatch(/Quran\.Foundation|QF_ATTRIBUTION|quran-foundation/i);
  });
});
