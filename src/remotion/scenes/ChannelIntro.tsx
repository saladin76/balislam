import React from "react";
import { clamp } from "./motion";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { ChannelInfo } from "../../channel/types";
import type { Plan } from "../../plan/types";
import type { Orientation } from "./types";
import { MihrabIntro, MIHRAB_FRAMES } from "./MihrabIntro";
import { HighlighterIntro, HIGHLIGHTER_FRAMES, HorizonIntro, HORIZON_FRAMES } from "./BrandIntros";
import { useTheme } from "../../../brand/identity/index";
import { H, PageSheet, W } from "../zubdat/inkKit";

/**
 * افتتاحية القناة (بصمتها الثابتة) في أول الحلقة الطويلة فقط، لا في الشورت. الافتتاحيات المعتمدة وحدها:
 * mihrab «محراب النور» (بالإسلام) · horizon «دفتر الأفق» (دفاتر الزمن) · highlighter «القلم المميِّز» (زبدة الكتب).
 * القناة الجديدة بلا افتتاحية حتى تُعتمد هويتها.
 */
export type IntroKind = "mihrab" | "horizon" | "highlighter";
/** مدة كل افتتاحية بالإطارات */
export const introFrames = (k: IntroKind) => (k === "mihrab" ? MIHRAB_FRAMES : k === "horizon" ? HORIZON_FRAMES : HIGHLIGHTER_FRAMES);

export const introKindFor = (channel?: ChannelInfo, plan?: Pick<Plan, "intro">, chapter?: number): IntroKind | null => {
  if (chapter || plan?.intro === false) return null;
  const k = channel?.brand?.intro;
  return k && k !== "none" ? k : null;
};
export const introFramesFor = (channel?: ChannelInfo, plan?: Pick<Plan, "intro">, chapter?: number) => {
  const k = introKindFor(channel, plan, chapter);
  return k ? introFrames(k) : 0;
};


export const ChannelIntro: React.FC<{ kind: IntroKind; orientation: Orientation }> = ({ kind, orientation }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const total = introFrames(kind);
  const out = interpolate(frame, [total - 10, total], [1, 0], clamp);
  const portrait = orientation === "portrait";
  const body = (
    <AbsoluteFill style={{ opacity: out }}>
      {kind === "mihrab" ? <MihrabIntro frame={frame} fps={fps} portrait={portrait} /> : kind === "horizon" ? <HorizonIntro frame={frame} fps={fps} portrait={portrait} /> : <HighlighterIntro frame={frame} fps={fps} portrait={portrait} />}
    </AbsoluteFill>
  );
  // «القلم المميِّز»: الشعار يتلاشى إلى ورقة الدفتر نفسها التي تُقلب في أول مشهد، لا إلى سواد (توجيه المالك، ٩ نوفمبر)
  return kind === "highlighter" ? (
    <AbsoluteFill>
      <HighlighterPage portrait={portrait} />
      {body}
    </AbsoluteFill>
  ) : body;
};

/** ورقة الدفتر تحت تلاشي افتتاحية «زبدة الكتب»، بتكوين مشهد الحبر نفسه (الأفقي والعمودي) */
export const HighlighterPage: React.FC<{ portrait: boolean }> = ({ portrait }) => {
  const t = useTheme("paper");
  const z = { ink: t.colors.ink, paper: t.colors.bg, hl: t.colors.highlight, alert: t.colors.secondary, faint: t.colors.inkSoft };
  const vb = portrait ? `${W / 2 - 304} 0 608 1080` : `0 0 ${W} ${H}`;
  return (
    <AbsoluteFill style={{ background: z.paper }}>
      <svg viewBox={vb} preserveAspectRatio="xMidYMid slice" width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
        <PageSheet z={z} shadow={false} />
      </svg>
    </AbsoluteFill>
  );
};

