import { describe, expect, it, vi } from "vitest";
import React from "react";
import fs from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { framingClean, type EdgeContext } from "../src/remotion/illus/edgeSafety";

/**
 * الحلقة 001 كلها: في كل إطار (كل 3 إطارات) من كل مشهد «حكايات الحارة» بالكاميرا التلقائية، بالاتجاهين،
 * التأطير الفعلي لا يقص شخصًا عند حافة الإطار ولا يُظهر ما وراء طرف المكان (قرار صاحب المشروع، ٩ نوفمبر).
 */
let F = 0;
let ORI: "landscape" | "portrait" = "landscape";
let DUR = 150;
vi.mock("remotion", async (orig) => {
  const m = (await orig()) as Record<string, unknown>;
  return { ...m, useCurrentFrame: () => F, useVideoConfig: () => ({ fps: 30, width: ORI === "portrait" ? 1080 : 1920, height: ORI === "portrait" ? 1920 : 1080, durationInFrames: DUR, id: "t", defaultProps: {}, props: {}, defaultCodec: null }) };
});
const { AlleyTale } = await import("../src/remotion/scenes/AlleyTale");
const { sceneFrames } = await import("../src/plan/duration");

type Scene = { id: string; template: string; narration: string; props: Record<string, string> };
const plan = JSON.parse(fs.readFileSync("channels/balislam/episodes/001-know-the-truth/plan.json", "utf8"));
const scenes = (plan.chapters as { scenes: Scene[] }[]).flatMap((c) => c.scenes).filter((s) => s.template === "alley-tale" && !s.props.shot);

describe("حافة الإطار في الحلقة 001", () => {
  for (const o of ["landscape", "portrait"] as const)
    it(`كل مشاهد حكايات الحارة · ${o}`, () => {
      const bad: string[] = [];
      for (const s of scenes) {
        ORI = o;
        DUR = sceneFrames(s as never);
        for (F = 0; F < DUR; F += 3) {
          const probe: { frame: number; zoom: number; offX: number; ctx: EdgeContext }[] = [];
          (globalThis as { __BAL_EDGE_PROBE__?: unknown[] }).__BAL_EDGE_PROBE__ = probe;
          renderToStaticMarkup(React.createElement(AlleyTale as never, { themeId: "night", orientation: o, narration: s.narration, ...s.props } as never));
          const p = probe.at(-1);
          if (p && !framingClean({ z: p.zoom, dx: p.offX }, { ...p.ctx, margin: (p.ctx.margin ?? 36) - 12 })) bad.push(`${s.id}@${F}`);
        }
      }
      delete (globalThis as { __BAL_EDGE_PROBE__?: unknown[] }).__BAL_EDGE_PROBE__;
      expect(bad).toEqual([]);
    }, 240_000);
});
