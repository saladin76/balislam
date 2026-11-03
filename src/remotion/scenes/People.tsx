import React from "react";
import type { Theme } from "../../../brand/themes";
import { Character, type CharacterPose } from "../../../characters/Character";

/** رسمات الأشخاص في اللقطات: person أو person:<وضعية> أو people (شخصان متقابلان). بلا ملامح وجه دائمًا. */
const VARIANTS = { person: "narrator-m", woman: "narrator-f", child: "child", elder: "elder-m" } as const;
/** person / woman / child / elder، مع وضعية اختيارية (person:sit)، أو people */
export const isPerson = (draw: string) => draw === "people" || Object.keys(VARIANTS).some((v) => draw === v || draw.startsWith(`${v}:`));

export const People: React.FC<{ draw: string; t: Theme; height: number; gap?: number }> = ({ draw, t, height, gap = height * 0.07 }) => {
  if (draw === "people")
    return (
      <div style={{ display: "flex", alignItems: "flex-end", gap }}>
        <Character theme={t} variant="narrator-m" pose="stand" height={height * 0.92} />
        <div style={{ transform: "scaleX(-1)" }}>
          <Character theme={t} variant="narrator-f" pose="stand" height={height * 0.92} />
        </div>
      </div>
    );
  const [who = "person", poseId] = draw.split(":");
  const pose = (poseId || "stand") as CharacterPose;
  return <Character theme={t} variant={VARIANTS[who as keyof typeof VARIANTS] ?? "narrator-m"} pose={pose} height={height} />;
};
