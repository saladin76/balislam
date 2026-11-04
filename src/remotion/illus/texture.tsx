import React from "react";
import { staticFile } from "remotion";
import { useSvgId } from "./world";

/**
 * ملمس الرسوم: نقش «جص» منخفض التردد للجدران والأرض، وحبيبات دقيقة فوق الإطار كله،
 * فتبدو المشاهد مرسومة على سطح لا مسطحة رقميًا. البلاطة متكررة بلا حواف ظاهرة،
 * وتُرسم بإحداثيات المشهد فتبقى حادة في 4K.
 */
export const Texture: React.FC<{ kind?: "plaster" | "grain"; x?: number; y?: number; w: number; h: number; opacity?: number; tile?: number; blend?: "multiply" | "overlay" | "soft-light"; clip?: string }> = ({ kind = "plaster", x = 0, y = 0, w, h, opacity = 0.35, tile = 512, blend = "overlay", clip }) => {
  const id = useSvgId(`tx${kind}`);
  return (
    <g style={{ mixBlendMode: blend }} opacity={opacity} clipPath={clip}>
      <defs>
        <pattern id={id} patternUnits="userSpaceOnUse" width={tile} height={tile}>
          <image href={staticFile(`illus/${kind}.png`)} width={tile} height={tile} preserveAspectRatio="none" />
        </pattern>
      </defs>
      <rect x={x} y={y} width={w} height={h} fill={`url(#${id})`} />
    </g>
  );
};

/** تدرج لوني فوق المشهد كله (درجة الضوء العامة) وتعتيم الأطراف */
export const Grade: React.FC<{ w: number; h: number; tint?: string; tintOpacity?: number; vignette?: number }> = ({ w, h, tint, tintOpacity = 0.12, vignette = 0.55 }) => {
  const id = useSvgId("vig");
  return (
    <g pointerEvents="none">
      <defs>
        <radialGradient id={id} cx="50%" cy="48%" r="72%">
          <stop offset="0.55" stopColor="#000" stopOpacity={0} />
          <stop offset="1" stopColor="#000" stopOpacity={vignette} />
        </radialGradient>
      </defs>
      {tint ? <rect x={-400} y={-400} width={w + 800} height={h + 800} fill={tint} opacity={tintOpacity} style={{ mixBlendMode: "soft-light" }} /> : null}
      <rect x={-400} y={-400} width={w + 800} height={h + 800} fill={`url(#${id})`} />
    </g>
  );
};

/** بقعة ضوء على الأرض أو الجدار (ضوء ساقط من مصدر) */
export const LightPool: React.FC<{ cx: number; cy: number; rx: number; ry: number; color: string; opacity?: number }> = ({ cx, cy, rx, ry, color, opacity = 0.5 }) => {
  const id = useSvgId("pool");
  if (opacity <= 0.001) return null;
  return (
    <g style={{ mixBlendMode: "screen" }}>
      <defs>
        <radialGradient id={id}>
          <stop offset="0" stopColor={color} stopOpacity={0.9} />
          <stop offset="1" stopColor={color} stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${id})`} opacity={opacity} />
    </g>
  );
};

/** شعاع ضوء مائل (من نافذة أو باب) */
export const Beam: React.FC<{ d: string; color: string; opacity?: number }> = ({ d, color, opacity = 0.25 }) => {
  const id = useSvgId("beam");
  if (opacity <= 0.001) return null;
  return (
    <g style={{ mixBlendMode: "screen" }} opacity={opacity}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity={0.9} />
          <stop offset="1" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={d} fill={`url(#${id})`} />
    </g>
  );
};
