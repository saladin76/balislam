import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { QUALITY } from "../src/render/quality";

// 25 Nov: the 4K Master of «دفاتر الزمن» 001 stalled twice on the owner's 8 GB Mac (several 4K tabs → swap full →
// «Timeout (30000ms) exceeded rendering the component initially»). Master renders one tab at a time with a long timeout.
describe("Master render resources", () => {
  it("Master is one tab at a time with a timeout well above Remotion's 30 s default", () => {
    expect(QUALITY.master.concurrency).toBe(1);
    expect(QUALITY.master.timeoutMs).toBeGreaterThanOrEqual(120_000);
  });
  it("preview keeps Remotion's defaults", () => {
    expect(QUALITY.preview.concurrency).toBeUndefined();
    expect(QUALITY.preview.timeoutMs).toBeUndefined();
  });
  it("the episode render passes both to renderMedia", () => {
    const src = readFileSync(new URL("../src/render/episode.ts", import.meta.url), "utf8");
    expect(src).toMatch(/concurrency: q\.concurrency/);
    expect(src).toMatch(/timeoutInMilliseconds: q\.timeoutMs/);
  });
});
