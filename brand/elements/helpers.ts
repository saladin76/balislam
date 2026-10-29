import type { ElementPalette } from "./types";

/** خصائص الحد الخارجي لشكل مملوء: <path {...S(p)} fill={p.main} /> */
export const S = (p: ElementPalette) => ({
  stroke: p.stroke,
  strokeWidth: p.sw,
  strokeLinejoin: "round" as const,
  strokeLinecap: "round" as const,
});

/** خط تفصيل داخلي بلا تعبئة: <path {...L(p)} d="…" /> */
export const L = (p: ElementPalette, width?: number) => ({
  stroke: p.line,
  strokeWidth: width ?? p.lw,
  fill: "none",
  strokeLinejoin: "round" as const,
  strokeLinecap: "round" as const,
});

/** في الأسلوب الخطي ترجع لون الورق، وفي المسطح ترجع اللون المطلوب. */
export const tint = (p: ElementPalette, flatColor: string) => (p.style === "line" ? p.light : flatColor);
