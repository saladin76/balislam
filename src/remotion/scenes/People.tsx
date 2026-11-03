import React from "react";
import type { Theme } from "../../../brand/themes";
import { Character, type CharacterPose } from "../../../characters/Character";

/** رسمات الأشخاص في اللقطات: person أو person:<وضعية> أو people (شخصان متقابلان). بلا ملامح وجه دائمًا. */
export const isPerson = (draw: string) => draw === "person" || draw === "people" || draw.startsWith("person:");

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
  const pose = (draw.split(":")[1] || "stand") as CharacterPose;
  return <Character theme={t} variant="narrator-m" pose={pose} height={height} />;
};
