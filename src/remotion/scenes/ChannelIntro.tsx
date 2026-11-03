import React from "react";
import { clamp } from "./motion";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { ChannelInfo } from "../../channel/types";
import type { Plan } from "../../plan/types";
import type { Orientation } from "./types";
import { MihrabIntro, MIHRAB_FRAMES } from "./MihrabIntro";
import { HighlighterIntro, HIGHLIGHTER_FRAMES, HorizonIntro, HORIZON_FRAMES } from "./BrandIntros";

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
  return (
    <AbsoluteFill style={{ opacity: out }}>
      {kind === "mihrab" ? <MihrabIntro frame={frame} fps={fps} portrait={portrait} /> : kind === "horizon" ? <HorizonIntro frame={frame} fps={fps} portrait={portrait} /> : <HighlighterIntro frame={frame} fps={fps} portrait={portrait} />}
    </AbsoluteFill>
  );
};

