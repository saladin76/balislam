import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { panelSource } from "./helpers/panelSource";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = (file: string) => panelSource(file);

describe("Studio V2 one-scene AV production HTTP/UI wiring", () => {
  it("exposes one current scene at a time with no browser-side approval authority", () => {
    const service = src("src/studio/sceneGates.ts");
    expect(service).toContain("assertCurrentSceneRenderAllowed");
    expect(service).toContain("assertSceneOwner();");
    expect(service).toContain("sceneFirstProgress(state).currentScene !== sceneId");
    expect(service).toContain("target.sourceSha256 !== expectedSha256");
    expect(service).toContain("!current.planReady");
  });

  it("rechecks source input after Remotion completes but before preview publication", () => {
    const server = src("app/server/api.ts");
    expect(server).toContain('parts[2] === "scene-av-render"');
    expect(server).toContain("await assertCurrentSceneRenderAllowed(ep, sceneId, expectedSha256)");
    expect(server).toContain("verifyBeforePublish: () => assertCurrentSceneRenderAllowed(");
    expect(server).toContain("await recordSceneRenderEvidence(ep, sceneId, expectedSha256)");
    const ledger = src("src/studio/sceneLedgerStore.ts") + src("src/studio/sceneDecisions.ts");
    expect(ledger).toContain("previewInputs?: Record<string");
    expect(ledger).toContain("proof.sourceSha256 !== scene.sourceSha256");
    expect(ledger).toContain("proof.videoSha256 !== resultSha256");
    const renderer = src("src/render/shotsPreview.ts");
    expect(renderer).toContain("await opts.verifyBeforePublish?.()");
    expect(renderer).toContain("requireApprovedQuran: true");
    expect(renderer).toContain("putEpisodePreview(episode, opts.slot, file");
    expect(renderer).toContain("scenePreview: /^scene-[a-z0-9-]+-av$/.test(opts.slot)");
    const renderEpisode = src("src/render/episode.ts");
    expect(renderEpisode).toContain('opts.scenePreview && opts.quality === "master"');
    expect(renderEpisode).toContain('"scene-preview" as const');
    const motion = src("src/remotion/scenes/Episode.tsx");
    expect(motion).toContain('"scene-preview" | "approved"');

  });

  it("builds the episode review cut from approved scene files without substituting a new render", () => {
    const assembly = src("src/studio/assembleScenes.ts");
    expect(assembly).toContain("await approvedSceneCutsForAssembly(episode)");
    expect(assembly).toContain('putEpisodePreview(episode, "episode", tempVideo');
    expect(assembly).toContain('"ffmpeg"');
    expect(assembly).not.toMatch(/quranClient|syncQuran|elevenLabs|renderEpisode/);
    const server = src("app/server/api.ts");
    expect(server).toContain('parts[2] === "scene-av-assemble"');
    const ui = src("app/src/workspace/SceneProductionPanel.tsx");
    expect(ui).toContain("api.assembleSceneAv(");
  });

  it("builds a combined video/audio review UI without auto-accepting a preview", () => {
    const ui = src("app/src/workspace/SceneProductionPanel.tsx");
    expect(ui).toContain("api.renderSceneAv(");
    expect(ui).toContain("api.sceneProduction(");
    expect(ui).toContain('act("approve-scene"');
    expect(ui).toContain('act("correct-scene"');
    expect(ui).toContain("confirmedWatched: true");
    expect(ui).not.toMatch(/localStorage|sessionStorage|setTimeout|autoApprove/i);
    // بلا كلمة مرور (قرار ٩ نوفمبر): لا جلسة ولا رمز ولا شيء من المالك في المتصفح (tests/studio-owner-no-passphrase.test.ts).
    expect(ui).not.toMatch(/useOwnerSession|x-studio-owner-token|passphrase/);
    const app = src("app/src/App.tsx");
    expect(app).toContain("<SceneProductionPanel");
    expect(app).toContain("<EpisodeSpine");
    expect(app).not.toContain("OwnerSession");
    expect(app).not.toContain("<EpisodeWorkspaceBar");
    const journey = src("app/src/shell/EpisodeSpine.tsx");
    for (const name of ["التجهيز", "المشاهد", "النسخة النهائية", "النشر"])
      expect(journey).toContain(name);
    expect(journey).toContain("api.sceneProduction(episodeId, channelId)");
    expect(journey).not.toMatch(/WorkflowOwnerControls|localStorage|autoApprove/);
  });
});
