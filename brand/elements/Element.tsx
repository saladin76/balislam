import React from "react";
import type { Theme } from "../themes";
import { usePalette } from "../identity/index";
import { elementById } from "./registry";
import type { ElementPalette } from "./types";

type Props = {
  id: string;
  theme: Theme;
  /** العرض بالبكسل (للعناصر: مربع) */
  size?: number;
  /** للخلفيات: مقاس المشهد */
  width?: number;
  height?: number;
  style?: React.CSSProperties;
  /** لوحة بديلة (مثل أسلوب الخطوط المضيئة في قالب «القصة المضيئة») */
  palette?: ElementPalette;
};

/** يرسم عنصرًا من المكتبة بألوان الثيم: <Element id="book-open" theme={t} size={240} /> */
export const Element: React.FC<Props> = ({ id, theme, size = 120, width, height, style, palette }) => {
  const def = elementById(id);
  const themed = usePalette(theme.id);
  const p = palette ?? themed;
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
