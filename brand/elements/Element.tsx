import React from "react";
import type { Theme } from "../themes";
import { elementPalettes } from "./palette";
import { elementById } from "./registry";

type Props = {
  id: string;
  theme: Theme;
  /** العرض بالبكسل (للعناصر: مربع) */
  size?: number;
  /** للخلفيات: مقاس المشهد */
  width?: number;
  height?: number;
  style?: React.CSSProperties;
};

/** يرسم عنصرًا من المكتبة بألوان الثيم: <Element id="book-open" theme={t} size={240} /> */
export const Element: React.FC<Props> = ({ id, theme, size = 120, width, height, style }) => {
  const def = elementById(id);
  const p = elementPalettes[theme.id];
  if (def.kind === "backdrop") {
    const w = width ?? 1920;
    const h = height ?? 1080;
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={style} aria-label={def.nameAr}>
        {def.draw(p, { w, h })}
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 120 120" style={{ overflow: "visible", ...style }} aria-label={def.nameAr}>
      {def.draw(p, { w: 120, h: 120 })}
    </svg>
  );
};
