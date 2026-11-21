import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// KI-093 (21 Nov): D158 step 2 made the scene audio import src/render/stillness.ts, whose server-only part holds
// `await import("../channel/index")`; webpack bundles dynamic imports too, reached node:async_hooks, and every scene
// render failed («Module build failed: UnhandledSchemeError: Reading from "node:async_hooks"»).
const root = path.join(import.meta.dirname, "..");
const resolve = (from: string, spec: string) => {
  const p = path.normalize(path.join(path.dirname(from), spec));
  for (const c of [p, `${p}.ts`, `${p}.tsx`, path.join(p, "index.ts")]) if (existsSync(c) && statSync(c).isFile()) return c;
  return null;
};
const reach = (entry: string) => {
  const seen = new Set<string>([entry]);
  const queue = [entry];
  while (queue.length) {
    const f = queue.pop()!;
    const s = readFileSync(f, "utf8");
    // value imports, re-exports and dynamic import("..."); `import type` never reaches the bundle
    const specs = [...s.matchAll(/(?:import\s+(?!type\b)[\s\S]*?from|export\s+(?!type\b)[\s\S]*?from|import\()\s*"(\.{1,2}\/[^"]+)"/g)].map((m) => m[1]!);
    for (const spec of specs) { const d = resolve(f, spec); if (d && !seen.has(d)) { seen.add(d); queue.push(d); } }
  }
  return [...seen];
};

describe("KI-093: nothing in the Remotion bundle imports the server", () => {
  it("no module reachable from src/remotion/index.ts imports node:* or the server-only channel context", () => {
    const files = reach(path.join(root, "src/remotion/index.ts"));
    expect(files.length).toBeGreaterThan(50);
    const bad = files.filter((f) => /from\s+"node:|import\("node:|require\("node:/.test(readFileSync(f, "utf8")))
      .concat(files.filter((f) => /src[\\/](channel[\\/]index|studio[\\/]ownerContext)\.ts$/.test(f)))
      .map((f) => path.relative(root, f));
    expect(bad).toEqual([]);
  });
});
