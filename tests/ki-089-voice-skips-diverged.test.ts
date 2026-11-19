import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// KI-089 (19 Nov): after the 5-minute script, «ولّد الصوت الآن» would have voiced 122 scenes the script dropped.
const src = (f: string) => readFileSync(path.join(import.meta.dirname, "..", f), "utf8");
describe("KI-089: the voice queue never pays for a scene the script no longer says", () => {
  it("scenesNeedingVoice drops every scene whose text differs from the script (the productionBlocks rule)", () => {
    const s = src("src/studio/prepareAll.ts");
    expect(s).toContain("scriptTextDivergence(scriptPath, plan)).scenes");
    expect(s).toContain("managed.has(s.id) || diverged.has(s.id)");
  });
});
