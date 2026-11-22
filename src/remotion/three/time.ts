/**
 * عدّة الثري دي المشتركة — الزمن (قرار المالك ٢٢ نوفمبر: الثري دي لكل شيء في القنوات).
 * كل حركة مفتاح مربوط بكلمة الراوي {a، b بالثواني}، ولا حركة بلا كلمة تسببها.
 * السكون المقصود (ذكر الله والآية والدعاء، src/render/stillnessSpans.ts): المفتاح الذي يتقاطع مع نافذة سكون
 * يتأخر كله إلى ما بعدها (كما في globeCamera.safeKeys)، والاهتزاز والارتعاش يصيران صفرًا داخلها.
 * خالص: لا ملفات ولا ساعة؛ الرندر حتمي من رقم الإطار.
 */
export type Window = [number, number];
export type Key<T> = { a: number; b: number; to: T };

/** تسارع وتباطؤ ناعم (كما في globeCamera.ease) */
export const ease = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** يؤخر كل مفتاح يتقاطع مع نافذة سكون إلى ما بعدها، محافظًا على مدته وترتيب المفاتيح (لا تداخل بينها) */
export const safeKeys = <T>(keys: Key<T>[], windows: Window[]): Key<T>[] => {
  const out: Key<T>[] = [];
  let floor = -Infinity;
  for (const k of [...keys].sort((x, y) => x.a - y.a)) {
    let a = Math.max(k.a, floor);
    const len = Math.max(0, k.b - k.a);
    for (let moved = true; moved; ) {
      moved = false;
      for (const [s, e] of windows) if (a < e && a + len > s) { a = e; moved = true; }
    }
    out.push({ ...k, a, b: a + len });
    floor = a + len;
  }
  return out;
};

/** القيمة عند الزمن t: تبدأ من start ثم تمر بالمفاتيح بترتيبها، بدالة مزج تناسب نوعها */
export const valueAt = <T>(t: number, start: T, keys: Key<T>[], mix: (from: T, to: T, p: number) => T): T => {
  let v = start;
  for (const k of [...keys].sort((x, y) => x.a - y.a)) {
    if (t <= k.a) break;
    const p = ease((t - k.a) / Math.max(1e-6, k.b - k.a));
    v = mix(v, k.to, p);
    if (p < 1) break;
  }
  return v;
};

/**
 * معامل السكون: ٠ داخل النافذة، ١ بعيدًا عنها بقدر ramp، وخطي بينهما (كـ sfxGainAt)؛
 * يُضرب فيه كل ما ليس مفتاحًا (الاهتزاز وارتعاش الضوء) فيسكن عند الذكر بلا قفزة.
 */
export const calmAt = (t: number, windows: Window[], ramp = 0.3) => {
  let g = 1;
  for (const [s, e] of windows) g = Math.min(g, t >= s && t <= e ? 0 : Math.min(1, Math.min(Math.abs(t - s), Math.abs(t - e)) / ramp));
  return g;
};
