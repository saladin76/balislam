import type { PoseName } from "./Figure";

/**
 * تأطير يحتوي الشخصيات والعناصر (الأمر 013): حدود كل شخصية بحسب وضعياتها واتجاهها، وتأطير يحتوي
 * ما يلزم لفهم الحدث (المطلوب) ولا يقص ما سواه نصف قصّ (الاختياري: يظهر كاملًا أو يخرج كاملًا).
 * دوال خالصة، تُختبر بلا رندر.
 */

/**
 * امتداد الجسد أفقيًا حول موضع الشخصية بمقياس 1.75، وهي متجهة يمينًا: [خلف، أمام].
 * مقيس بـ getBBox لكل وضعية بلا الظل (الأمر 013)، ويُقلب للمتجهة يسارًا.
 */
const EXTENT_175: Record<string, [number, number]> = {
  stand: [-59, 59], think: [-59, 98], sit: [-62, 219], "sit-low": [-62, 219], "head-down": [-60, 224], hold: [-60, 174],
  cross: [-67, 116], point: [-61, 212], "look-up": [-114, 63], nod: [-61, 92], "turn-away": [-65, 63], proud: [-122, 69],
  apologize: [-60, 159], listen: [-59, 106], talk: [-59, 200], flinch: [-125, 84], sincere: [-59, 101], halt: [-62, 170],
  wave: [-93, 105], lean: [-60, 266],
};
/** المشي: الساقان في أوسع خطوة والذراعان في أوسع تأرجح */
const WALK_175: [number, number] = [-95, 95];

export type Span = { lo: number; hi: number; name?: string };
export type Facing = "left" | "right" | "both";

/** حدود شخصية في العالم عبر كل وضعياتها في اللقطة (غلاف ثابت، فلا ترتجف الكاميرا مع تبدل الوضعية) */
export const figureSpan = (x: number, poses: readonly (PoseName | "walk")[], facing: Facing, scale: number, name?: string): Span => {
  const k = scale / 1.75;
  let back = 59;
  let front = 59;
  for (const p of poses.length ? poses : ["stand"]) {
    const [b, f] = p === "walk" ? WALK_175 : EXTENT_175[p] ?? [-125, 125];
    back = Math.max(back, -b);
    front = Math.max(front, f);
  }
  back *= k;
  front *= k;
  const lo = facing === "right" ? x - back : facing === "left" ? x - front : x - Math.max(back, front);
  const hi = facing === "right" ? x + front : facing === "left" ? x + back : x + Math.max(back, front);
  return { lo, hi, ...(name ? { name } : {}) };
};

export const unionSpan = (spans: Span[]): Span | null =>
  spans.length ? { lo: Math.min(...spans.map((s) => s.lo)), hi: Math.max(...spans.map((s) => s.hi)) } : null;

export type FitResult = {
  x: number;
  z: number;
  /** احتوى كل المطلوب */
  fits: boolean;
  /** اختياري بقي مقصوصًا جزئيًا (لم يمكن إظهاره كاملًا ولا إخراجه كاملًا) */
  partial: string[];
};

/**
 * تأطير على الهدف بالحجم المطلوب ما أمكن:
 * - يصغّر الحجم (لا تحت 1) حتى يتسع المطلوب كله بهامش؛ فإن لم يتسع حتى عند 1 يُحتوى أولها (الأهم) وحده.
 * - يزيح الكاميرا داخل ما يحفظ المطلوب ليظهر كل اختياري كاملًا أو يخرج كاملًا، بأقل إزاحة.
 * - لا يُرى ما وراء حدود العالم.
 */
export const fitFrame = (o: { x: number; z: number; required: Span[]; optional?: Span[]; portrait: boolean; worldW: number; margin?: number }): FitResult => {
  const r = fitOnce(o);
  if (!r.partial.length || !o.required.length) return r;
  // اختياري لا تحله الإزاحة: يُضم إلى المطلوب إن اتسع الاثنان بحجم لا يقل عن 1 (لقطة أوسع قليلًا أفضل من قص نصفي)
  const stuck = (o.optional ?? []).filter((x) => r.partial.includes(x.name ?? "?"));
  const widened = fitOnce({ ...o, required: [...o.required, ...stuck], optional: (o.optional ?? []).filter((x) => !stuck.includes(x)) });
  return widened.fits && !widened.partial.length ? { ...widened, partial: [] } : r;
};

const fitOnce = (o: { x: number; z: number; required: Span[]; optional?: Span[]; portrait: boolean; worldW: number; margin?: number }): FitResult => {
  const base = o.portrait ? 304 : 960;
  const m = o.margin ?? 28;
  let req = unionSpan(o.required);
  let z = o.z;
  let fits = true;
  if (req) {
    const need = req.hi - req.lo + 2 * m;
    const maxZ = (2 * base) / need;
    if (maxZ < z) z = Math.max(1, maxZ);
    if (maxZ < 1) {
      fits = false;
      req = o.required[0] ?? req;
    }
  }
  const half = base / z;
  // المواضع التي تحفظ المطلوب داخل الإطار، ثم حدود العالم
  let lo = half;
  let hi = o.worldW - half;
  if (req) {
    const a = req.hi - half + m;
    const b = req.lo + half - m;
    if (a <= b) {
      lo = Math.max(lo, a);
      hi = Math.min(hi, b);
    } else {
      const mid = (req.lo + req.hi) / 2;
      lo = Math.max(lo, mid);
      hi = Math.min(hi, mid);
    }
  }
  if (lo > hi) lo = hi = Math.max(half, Math.min(o.worldW - half, (lo + hi) / 2));
  const clamp = (v: number) => Math.max(lo, Math.min(hi, v));
  let x = clamp(o.x);
  const partial: string[] = [];
  const isPartial = (s: Span, cx: number) => s.hi > cx - half && s.lo < cx + half && (s.lo < cx - half || s.hi > cx + half);
  for (const s of o.optional ?? []) {
    if (!isPartial(s, x)) continue;
    // أقرب موضع يُظهره كاملًا أو يخرجه كاملًا، داخل ما يحفظ المطلوب
    const options = [s.hi - half + m, s.lo + half - m, s.hi + half + 1, s.lo - half - 1].map(clamp).filter((c) => !isPartial(s, c) && !(o.optional ?? []).some((t) => t !== s && !isPartial(t, x) && isPartial(t, c)));
    if (options.length) x = options.sort((a, b) => Math.abs(a - x) - Math.abs(b - x))[0]!;
    else partial.push(s.name ?? "?");
  }
  return { x, z, fits, partial };
};
