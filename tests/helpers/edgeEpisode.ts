/**
 * Shared body of the episode-001 edge-safety check (tests/edge-safety-episode*.test.tsx). The check was
 * split by orientation into two files so the two halves run in parallel workers (QA, 10 Nov 2026: one file
 * took 71–251 s); every scene, every 3rd frame and the same margin are still checked in both orientations.
 */
import React from "react";
import fs from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { framingClean, type EdgeContext } from "../../src/remotion/illus/edgeSafety";

export const edgeState = { F: 0, ORI: "landscape" as "landscape" | "portrait", DUR: 150 };
export const mockedVideoConfig = () => ({ fps: 30, width: edgeState.ORI === "portrait" ? 1080 : 1920, height: edgeState.ORI === "portrait" ? 1920 : 1080,
  durationInFrames: edgeState.DUR, id: "t", defaultProps: {}, props: {}, defaultCodec: null });

type Scene = { id: string; template: string; narration: string; props: Record<string, string> };
export const episodeScenes = (): Scene[] => {
  const plan = JSON.parse(fs.readFileSync("channels/balislam/episodes/001-know-the-truth/plan.json", "utf8"));
  return (plan.chapters as { scenes: Scene[] }[]).flatMap((c) => c.scenes).filter((s) => s.template === "alley-tale" && !s.props.shot);
};

export const badFrames = async (o: "landscape" | "portrait"): Promise<string[]> => {
  const { AlleyTale } = await import("../../src/remotion/scenes/AlleyTale");
  const { sceneFrames } = await import("../../src/plan/duration");
  const bad: string[] = [];
  let probed = 0;
  for (const s of episodeScenes()) {
    edgeState.ORI = o;
    edgeState.DUR = sceneFrames(s as never);
    for (edgeState.F = 0; edgeState.F < edgeState.DUR; edgeState.F += 3) {
      const probe: { frame: number; zoom: number; offX: number; ctx: EdgeContext }[] = [];
      (globalThis as { __BAL_EDGE_PROBE__?: unknown[] }).__BAL_EDGE_PROBE__ = probe;
      renderToStaticMarkup(React.createElement(AlleyTale as never, { themeId: "night", orientation: o, narration: s.narration, ...s.props } as never));
      const p = probe.at(-1);
      if (p) probed++;
      if (p && !framingClean({ z: p.zoom, dx: p.offX }, { ...p.ctx, margin: (p.ctx.margin ?? 36) - 12 })) bad.push(`${s.id}@${edgeState.F}`);
    }
  }
  delete (globalThis as { __BAL_EDGE_PROBE__?: unknown[] }).__BAL_EDGE_PROBE__;
  // The mocked frame/config must really reach the camera: a check that probed nothing would pass vacuously.
  if (!probed) throw new Error("edge probe never fired: the remotion mock is not applied");
  return bad;
};
