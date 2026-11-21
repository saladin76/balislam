/**
 * خامات المادة (ألياف الورق وحبيباته وخشب الطاولة) تُرسم مرة واحدة على Canvas وتُعاد صورةً مكررة،
 * بدل مرشحات SVG التي يعيد المتصفح حسابها في كل إطار (بطيئة جدًا بـ4K على ماك ٨ جيجا).
 * الضجيج من مولد ببذرة ثابتة، فالخامة نفسها في كل رندر وعلى كل جهاز (رندر حتمي).
 */
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** ضجيج قيمي ناعم يتكرر بلا حواف ظاهرة */
const valueNoise = (w: number, h: number, cellsX: number, cellsY: number, seed: number) => {
  const r = rng(seed);
  const g = Array.from({ length: cellsY }, () => Array.from({ length: cellsX }, () => r()));
  const s = (x: number) => x * x * (3 - 2 * x);
  return (x: number, y: number) => {
    const fx = (x / w) * cellsX;
    const fy = (y / h) * cellsY;
    const x0 = Math.floor(fx) % cellsX;
    const y0 = Math.floor(fy) % cellsY;
    const x1 = (x0 + 1) % cellsX;
    const y1 = (y0 + 1) % cellsY;
    const tx = s(fx - Math.floor(fx));
    const ty = s(fy - Math.floor(fy));
    const a = g[y0]![x0]! + (g[y0]![x1]! - g[y0]![x0]!) * tx;
    const b = g[y1]![x0]! + (g[y1]![x1]! - g[y1]![x0]!) * tx;
    return a + (b - a) * ty;
  };
};

export type TextureKind = "paper" | "wood";

/** قيم الخامة (0..1 لكل بكسل)، دالة خالصة تُختبر بلا متصفح */
export const textureField = (kind: TextureKind, w: number, h: number, seed: number): Float32Array => {
  const out = new Float32Array(w * h);
  const oct =
    kind === "paper"
      ? [valueNoise(w, h, 128, 128, seed), valueNoise(w, h, 16, 64, seed + 1), valueNoise(w, h, 6, 6, seed + 2)]
      : [valueNoise(w, h, 4, 96, seed), valueNoise(w, h, 2, 24, seed + 1), valueNoise(w, h, 64, 256, seed + 2)];
  const wt = kind === "paper" ? [0.6, 0.3, 0.1] : [0.5, 0.3, 0.2];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = oct[0]!(x, y) * wt[0]! + oct[1]!(x, y) * wt[1]! + oct[2]!(x, y) * wt[2]!;
  return out;
};

const cache = new Map<string, string>();

/** صورة الخامة (data URL)، تُحسب مرة لكل نوع وبذرة ولون */
export const textureUrl = (kind: TextureKind, rgb: [number, number, number], alpha: number, seed: number): string => {
  const key = `${kind}:${rgb.join(",")}:${alpha}:${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [w, h] = kind === "paper" ? [512, 512] : [1024, 512];
  const f = textureField(kind, w, h, seed);
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < f.length; i++) {
    img.data[i * 4] = rgb[0];
    img.data[i * 4 + 1] = rgb[1];
    img.data[i * 4 + 2] = rgb[2];
    img.data[i * 4 + 3] = Math.round(255 * alpha * Math.max(0, Math.min(1, (f[i]! - 0.3) * 2.2)));
  }
  ctx.putImageData(img, 0, 0);
  const url = cv.toDataURL("image/png");
  cache.set(key, url);
  return url;
};
