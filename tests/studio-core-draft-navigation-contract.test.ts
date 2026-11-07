import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const source = (file: string) => readFileSync(path.join(root, file), "utf8");

/**
 * Integration contract tests: ensure core draft protection is still connected
 * when the independent UI workspaces branch is merged later.
 */
describe("Studio unsaved-work and channel recovery wiring", () => {
  it("guards browser close, channel switching, sidebar navigation, and update banner", () => {
    const app = source("app/src/App.tsx");
    const channel = source("app/src/tabs/ChannelTab.tsx");
    expect(channel).toContain("onDirtyChange?.(dirty || saving)");
    expect(channel).toContain("onDirtyChange?.(false)");
    expect(app).toContain("onDirtyChange={setChannelConfigDirty}");
    expect(app).toContain("channelConfigDirty || identDirty");
    expect(app).toContain("channelConfigDirty && !window.confirm(");
    expect(app).toContain("identDirty && !window.confirm(");
    expect(app).toContain("scriptDirty || researchDirty || identDirty || channelConfigDirty");
    expect(app).toContain('window.addEventListener("beforeunload"');
    expect(app).toContain("if (!confirmLeaveScript()) return");
  });

  it("preserves healthy channel listings when another channel's JSON is invalid", () => {
    const api = source("app/server/api.ts");
    const extra = source("app/server/extra.ts");
    expect(api).toContain('const { inspectChannel } = await load("/src/channel/inspect.ts")');
    expect(api).toContain("const item = inspectChannel(id)");
    expect(extra).toContain('if (parts[0] === "ops" && req.method === "GET")');
    expect(extra).toContain("error instanceof Error ? error.message");
    expect(extra).toContain("episodes: [], ideas: [], calendar: {}");
  });
});
