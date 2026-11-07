import { describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const productionDirs = [
  "app/server", "src/cli", "src/voice", "src/render", "src/package",
  "src/quran", "src/plan", "src/script",
];

const allSourceFiles = async (base: string): Promise<string[]> => {
  const entries = await readdir(base, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (item) => {
    const file = path.join(base, item.name);
    if (item.isDirectory()) return allSourceFiles(file);
    return /\.(?:ts|tsx|mjs)$/.test(item.name) ? [file] : [];
  }));
  return nested.flat();
};

describe("production workflow API boundary", () => {
  it("never imports low-level state/evidence signers in external production modules", async () => {
    for (const dir of productionDirs) {
      const files = await allSourceFiles(path.join(root, dir));
      for (const file of files) {
        const source = await readFile(file, "utf8");
        const externalInternalImport = /(?:from\s*|import\s*\()\s*["'][^"']*\/workflow\/(?:store|trust|gates|artifacts)(?:\.ts)?["']/;
        expect(source, `Direct low-level workflow import forbidden: ${path.relative(root, file)}`)
          .not.toMatch(externalInternalImport);
      }
    }
  });

  it("exposes only authenticated service and protected ports as the public integration API", async () => {
    const source = await readFile(path.join(root, "src/workflow/index.ts"), "utf8");
    expect(source).toContain("createTrustedWorkflowService");
    expect(source).toContain("createWorkflowProtectedPorts");
    expect(source).not.toContain("approveWorkflowStage");
    expect(source).not.toContain("submitWorkflowStage");
    expect(source).not.toContain("requireWorkflowGate");
    expect(source).not.toContain("signServerEvidence");
  });
});
