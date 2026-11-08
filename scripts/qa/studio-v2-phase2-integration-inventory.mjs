#!/usr/bin/env node
/**
 * QA-08 read-only integration inventory, not a runtime acceptance test.
 * A matched source file never becomes PASS: live HTTP/Chrome/Remotion required.
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const paths = {
  "Backend HTTP/session": ["app/server/studioV2Api.ts", "app/server/studioV2Session.ts", "app/server/api.ts"],
  "Backend source/manifest/lock": ["src/workflow/sceneSourcesV2.ts", "src/workflow/sceneManifestRegistryV2.ts", "src/workflow/sceneLockV2.ts"],
  "Backend render bridge/spec": ["src/workflow/sceneRenderBridgeV2.ts", "src/workflow/sceneRenderSpecV2.ts", "src/workflow/sceneProductionLeaseV2.ts"],
  "Render actual engine": ["src/render/sceneV2.ts", "src/render/sceneV2Probe.ts", "src/remotion/SceneV2.tsx"],
  "UI actual review": ["app/src/review/adapter.ts", "app/src/review/SceneReviewWorkspace.tsx"],
  "QA live HTTP/Remotion": ["scripts/qa/studio-v2-phase2-live-http.mjs", "scripts/qa/studio-v2-phase2-real-render.mjs"],
};
const groups = Object.entries(paths).map(([name, files]) => {
  const missing = files.filter((p) => !existsSync(path.join(root, p)));
  return { name, status: missing.length ? "BLOCKED" : "NOT TESTED", missing };
});
let routeMismatch = "NOT TESTED";
let reason = "Requires actual composite HTTP+React request traces";
const api = path.join(root, "app/server/studioV2Api.ts");
const ui = path.join(root, "app/src/review/adapter.ts");
if (existsSync(api) && existsSync(ui)) {
  const b = await readFile(api, "utf8"), u = await readFile(ui, "utf8");
  const staleUiTree = u.includes('"/api/studio-v2/channels/"');
  const backendEpisodeTree = b.includes('exact(parts, "studio-v2", "episodes"');
  if (staleUiTree && backendEpisodeTree) {
    routeMismatch = "BLOCKED";
    reason = "UI adapter still calls /channels/:ch/episodes/:ep/scene-review, Backend serves /episodes/:NNN/scenes?channel=...";
  } else {
    reason = "No known old-tree mismatch found; real UI->Backend integration still NOT TESTED";
  }
}
const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const report = {
  task: "Studio V2 QA-08 read-only composite inventory",
  sha, method: "file presence + known route-string check ONLY",
  groups, uiBackendRouteContract: { status: routeMismatch, reason },
  runtimeChecks: {
    realHttpSessionCsrf: "NOT TESTED", currentVideoRenderAndManifest: "NOT TESTED",
    chromeOwnerOneX: "NOT TESTED", workerRecoveryAndCli: "NOT TESTED",
    threeSceneApproval: "NOT TESTED", masterAndPublish: "BLOCKED",
  },
  overall: groups.some((x) => x.status === "BLOCKED") || routeMismatch === "BLOCKED" ? "BLOCKED" : "NOT TESTED",
  note: "Never treat this source inventory as a PASS gate",
};
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.overall === "BLOCKED" ? 2 : 3;
