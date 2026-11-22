/**
 * عدّة الثري دي — «النقص البشري المقصود» (C-مراجع-الاتجاهات: مواد حقيقية ونقص مقصود، لا لمعة الذكاء الاصطناعي المتناظرة):
 * ضجيج حتمي ببذرة (لا Math.random: الإطار نفسه يخرج نفسه في كل رندر)، واهتزاز يد خفيف للكاميرا، وارتعاش ضوء،
 * وحبيبات خامة. كلها تسكن في نوافذ السكون المقصود (calmAt).
 */
import { calmAt, type Window } from "./time";

/** عدد صحيح شبه عشوائي من (بذرة، عدد) — mulberry32 مختصر */
const hash = (seed: number, n: number) => {
  let x = (seed * 0x9e3779b1) ^ (n * 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 15), x | 1);
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
};

/** ضجيج قيمي ناعم في بعد واحد، بين −1 و1 */
export const noise1 = (seed: number, x: number) => {
  const i = Math.floor(x), f = x - i;
  const s = f * f * (3 - 2 * f);
  return (hash(seed, i) * (1 - s) + hash(seed, i + 1) * s) * 2 - 1;
};

export type Shake = { amp: number; rate: number; seed: number };
/** لا اهتزاز (الافتراضي): الاهتزاز اختيار الاتجاه، لا العدّة */
export const NO_SHAKE: Shake = { amp: 0, rate: 0, seed: 0 };

/** إزاحة يد الكاميرا [x، y، z] عند الزمن t، وتسكن في السكون المقصود */
export const handheld = (t: number, s: Shake, still: Window[] = []): [number, number, number] => {
  const g = s.amp * calmAt(t, still);
  if (!g) return [0, 0, 0];
  const x = t * s.rate;
  return [noise1(s.seed, x) * g, noise1(s.seed + 1, x) * g, noise1(s.seed + 2, x) * g * 0.5];
};

export type Flicker = { depth: number; rate: number; seed: number };
/** معامل شدة الضوء (حوله ١) لضوء حي كالسراج أو المصباح خلف الستارة؛ يثبت على ١ في السكون المقصود */
export const flicker = (t: number, f: Flicker | undefined, still: Window[] = []) =>
  !f ? 1 : 1 + f.depth * calmAt(t, still) * (0.65 * noise1(f.seed, t * f.rate) + 0.35 * noise1(f.seed + 7, t * f.rate * 2.3));

/**
 * حبيبات خامة رمادية (ورق، جلد، معدن مطروق) بحجم size×size: قيم ٠–٢٥٥ حول ١٢٨ بقوة strength (٠–١)،
 * بطبقتين (حبيبات ناعمة وألياف أعرض). تُستعمل خريطةَ خشونة أو تُضرب في لون الخامة.
 */
export const grain = (size: number, seed: number, strength: number): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const fine = hash(seed, y * size + x) * 2 - 1;
    const fibre = noise1(seed + 3, x / 9 + noise1(seed + 4, y / 23) * 2);
    out[y * size + x] = 128 + 127 * strength * (0.6 * fine + 0.4 * fibre);
  }
  return out;
};
