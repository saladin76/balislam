/**
 * الترجمة حسب ما خلفها فعلًا (ملاحظة المالك ٢٣ نوفمبر على «آلات الجزري»: «حبر داكن على الورق البيج»، والقاعدة: حبر داكن على
 * الفاتح، وأبيض على الداكن). في اللقطات القريبة يقع السطر الواحد على الورق والخشب معًا، فلا تكفي نبرة ثابتة لكل لقطة، ومزج
 * «الفرق» يعطي حبرًا رماديًا مزرقًا ويضيع على النحاس والظل. فيُقرأ الإطار المرسوم نفسه:
 * - CaptionProbe (داخل المسرح، بعد رسم الإطار بالعدسة): متوسط إضاءة ما تحت كل سطر من سطور الترجمة، عمودًا عمودًا.
 * - wordTones: يضع كلمات السطر كما يضعها المتصفح (عرض كل كلمة، والالتفاف، والتوسيط، ومن اليمين) ويعطي كل كلمة نبرة ما خلفها:
 *   ink = حبر داكن بهالة فاتحة، light = نص فاتح بحد داكن رفيع. والحد/الهالة يبقيان الكلمة مقروءة على الدرجات المتوسطة.
 */
import React from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { CaptionTone } from "./anchors";

/** صف من القياس: [أعلى، أسفل] بكسلات التكوين من أعلى الكادر */
export type ProbeRow = [number, number];
export type ProbeGrid = { frame: number; bin: number; rows: ProbeRow[]; lum: number[][] };

/** هندسة سطر الترجمة: حجم الخط، وارتفاع السطر، والحشو الداخلي، وبُعد السطر من أسفل الكادر، والهامشان */
export const CAPTION_GEOMETRY = { fontSize: 52, lineHeight: 62, padX: 28, padY: 8, side: 40 } as const;

/** صفوف القياس لسطور الترجمة من الأسفل إلى الأعلى (السطر الأخير أولًا)، حتى `lines` سطور */
export const captionRows = (height: number, bottom: number, lines = 3): ProbeRow[] =>
  Array.from({ length: lines }, (_, i) => {
    const y1 = height - bottom - CAPTION_GEOMETRY.padY - i * CAPTION_GEOMETRY.lineHeight;
    return [y1 - CAPTION_GEOMETRY.lineHeight, y1] as ProbeRow;
  });

/** يقرأ الإطار بعد رسمه (أولوية بعد العدسة) ويعطي متوسط الإضاءة (٠–١) لكل عمود عرضه `bin` في كل صف */
export const CaptionProbe: React.FC<{ frame: number; rows: ProbeRow[]; bin?: number; onProbe: (g: ProbeGrid) => void }> = ({ frame, rows, bin = 16, onProbe }) => {
  const { gl, size } = useThree();
  useFrame(() => {
    gl.setRenderTarget(null);
    const ctx = gl.getContext();
    const W = ctx.drawingBufferWidth, sx = W / size.width, sy = ctx.drawingBufferHeight / size.height;
    const cols = Math.ceil(size.width / bin);
    const lum = rows.map(([y0, y1]) => {
      const top = Math.max(0, y0), bottom = Math.min(size.height, y1);
      const h = Math.max(1, Math.round((bottom - top) * sy));
      const buf = new Uint8Array(W * h * 4);
      ctx.readPixels(0, Math.round((size.height - bottom) * sy), W, h, ctx.RGBA, ctx.UNSIGNED_BYTE, buf);
      const sum = new Float64Array(cols), n = new Float64Array(cols);
      for (let y = 0; y < h; y += 2) for (let x = 0; x < W; x += 2) {
        const i = (y * W + x) * 4, c = Math.min(cols - 1, Math.floor(x / sx / bin));
        sum[c] = sum[c]! + (0.2126 * buf[i]! + 0.7152 * buf[i + 1]! + 0.0722 * buf[i + 2]!) / 255; n[c] = n[c]! + 1;
      }
      return Array.from(sum, (s, c) => (n[c] ? s / n[c]! : 0.5));
    });
    onProbe({ frame, bin, rows, lum });
  }, 2);
  return null;
};

/**
 * فوق هذه الإضاءة (٠–١، sRGB) ما خلف الكلمة فاتح: حبر داكن؛ وتحتها نص فاتح. كانت ٠٫٥، فوقع الورق البيج في ظل الآلة
 * والعمق المموّه (٠٫٣٩–٠٫٥٩ مقيسًا على إطارات «آلات الجزري») تحت الحد فكُتب أبيض على البيج (ملاحظة المالك على v3).
 * الخشب الداكن تحت الآلة ٠٫٠٦–٠٫٢٨، فالحد بينهما.
 */
export const INK_ABOVE = 0.33;

/**
 * نبرة كل كلمة من القياس: يلتف السطر كما يلتف في المتصفح (أطول ما يسعه العرض)، ويتوسط، والكلمة الأولى في يمينه.
 * measure: عرض النص بالبكسل بخط الترجمة (المسافة تُقاس وحدها). الصف ٠ في القياس هو السطر الأخير (الأسفل).
 */
export const wordTones = (text: string, grid: Pick<ProbeGrid, "bin" | "lum">, width: number, measure: (s: string) => number): CaptionTone[] => {
  const words = text.split(" ").filter(Boolean);
  const space = measure(" "), widths = words.map(measure);
  const avail = width - 2 * CAPTION_GEOMETRY.side - 2 * CAPTION_GEOMETRY.padX;
  const lines: number[][] = [];
  let cur: number[] = [], used = 0;
  words.forEach((_, i) => {
    const add = (cur.length ? space : 0) + widths[i]!;
    if (cur.length && used + add > avail) { lines.push(cur); cur = [i]; used = widths[i]!; } else { cur.push(i); used += add; }
  });
  if (cur.length) lines.push(cur);
  const tones: CaptionTone[] = new Array(words.length).fill("ink");
  lines.forEach((line, k) => {
    const row = grid.lum[Math.min(grid.lum.length - 1, lines.length - 1 - k)];
    if (!row) return;
    const lw = line.reduce((s, i, j) => s + widths[i]! + (j ? space : 0), 0);
    let right = width / 2 + lw / 2;
    for (const i of line) {
      const a = Math.max(0, Math.floor((right - widths[i]!) / grid.bin)), b = Math.min(row.length - 1, Math.floor(right / grid.bin));
      const cells = row.slice(a, b + 1);
      const mean = cells.length ? cells.reduce((s, v) => s + v, 0) / cells.length : 1;
      tones[i] = mean > INK_ABOVE ? "ink" : "light";
      right -= widths[i]! + space;
    }
  });
  return tones;
};

/** عرض النص بخط الترجمة في المتصفح (لوحة رسم مخفية؛ الخط محمّل قبلها بـuseBrandFonts) */
let measureCtx: CanvasRenderingContext2D | null = null;
export const measureCaption = (s: string) => {
  measureCtx ??= document.createElement("canvas").getContext("2d");
  if (!measureCtx) return s.length * CAPTION_GEOMETRY.fontSize * 0.5;
  measureCtx.font = `500 ${CAPTION_GEOMETRY.fontSize}px Tajawal`;
  measureCtx.direction = "rtl";
  return measureCtx.measureText(s).width;
};
