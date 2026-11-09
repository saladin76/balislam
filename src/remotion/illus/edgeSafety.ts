/**
 * لا شخص مقصوص عند حافة الإطار في الكاميرا التلقائية (قرار صاحب المشروع، ٩ نوفمبر: «لا أريد أي أخطاء أو خلل في التنفيذ»).
 *
 * كل لقطة في الكاميرا التلقائية تكبير z وإزاحة dx حول البطل. قد تقع الإزاحة فتُظهر ذراع الرفيق أو نصف طيف عند حافة الإطار.
 * هنا تُصحَّح الإزاحة بأقل قدر ممكن حتى يكون كل شخص إما كاملًا داخل الإطار أو خارجه كله، والبطل داخله دائمًا.
 * فإن تعذّر ذلك بهذا التكبير يُخفَّف التكبير خطوة خطوة حتى يتسع (ثم لقطة الاثنين على حجم 1).
 *
 * الخريطة كما في `camRaw` لطبقة الشخوص (العمق 1): الشاشة = (x − focusX)·z + focusX − dx.
 */
export type Span = { lo: number; hi: number };
export type AutoFraming = { z: number; dx: number };

export type EdgeContext = {
  focusX: number;
  /** حدود الإطار الظاهر بإحداثيات العالم قبل التكبير (الأفقي 0..1920، والعمودي نافذة الـ608) */
  view: [number, number];
  /** يجب أن يكون كاملًا داخل الإطار (البطل) */
  required: Span[];
  /** كامل داخله أو خارجه كله، لا نصفًا (الرفيق، الأطياف) */
  optional: Span[];
  /** هامش أمان لحركة الكاميرا الخفيفة (drift/track) */
  margin?: number;
  /** أقصى إزاحة إضافية مقبولة قبل تخفيف التكبير */
  maxShift?: number;
  /** أدنى تكبير يُسمح بالنزول إليه ليتسع الإطار (الافتراضي 1، أو تكبير اللقطة إن كان أقل) */
  zMin?: number;
  /** طبقات المكان (بعمقها وامتدادها في العالم) التي يجب أن تغطي الإطار كله: لا يظهر طرف العالم الفارغ */
  layers?: { depth: number; lo: number; hi: number }[];
};

const screen = (x: number, f: AutoFraming, focusX: number) => (x - focusX) * f.z + focusX - f.dx;

export const framingClean = (f: AutoFraming, c: EdgeContext): boolean => {
  const m = c.margin ?? 36;
  const [v0, v1] = c.view;
  const inside = (s: Span) => screen(s.lo, f, c.focusX) >= v0 + m && screen(s.hi, f, c.focusX) <= v1 - m;
  const outside = (s: Span) => screen(s.hi, f, c.focusX) <= v0 - m || screen(s.lo, f, c.focusX) >= v1 + m;
  // طبقة بعمق d كما في camRaw: تكبير 1 + (z − 1)·(0.55 + 0.45d)، وإزاحة dx·(0.4 + 0.6d)
  const covered = (l: { depth: number; lo: number; hi: number }) => {
    const zd = 1 + (f.z - 1) * (0.55 + 0.45 * l.depth);
    const sd = f.dx * (0.4 + 0.6 * l.depth);
    return (l.lo - c.focusX) * zd + c.focusX - sd <= v0 - 8 && (l.hi - c.focusX) * zd + c.focusX - sd >= v1 + 8;
  };
  return c.required.every(inside) && c.optional.every((s) => inside(s) || outside(s)) && (c.layers ?? []).every(covered);
};

/** سليم في كل سياقات اللقطة (مواضع البطل ووضعياته عبر نافذتها) */
export const framingCleanAll = (f: AutoFraming, cs: EdgeContext | EdgeContext[]): boolean => (Array.isArray(cs) ? cs : [cs]).every((c) => framingClean(f, c));

/**
 * يرجع الإطار نفسه إن كان سليمًا، وإلا أقرب إطار سليم في كل السياقات (نافذة اللقطة كلها).
 * المرشحات: محاذاة كل شخص وطبقة على حافتي الإطار، ثم بحث شبكي في التكبير والإزاحة إن لزم.
 */
export const cleanAutoFraming = (f: AutoFraming, cs0: EdgeContext | EdgeContext[]): AutoFraming => {
  const cs = Array.isArray(cs0) ? cs0 : [cs0];
  if (!cs.length || framingCleanAll(f, cs)) return f;
  const maxShift = Math.max(...cs.map((c) => c.maxShift ?? 420));
  const zMin = Math.min(Math.min(...cs.map((c) => c.zMin ?? 1)), f.z);
  const best = (z: number, cands: number[]) =>
    cands
      .filter((dx) => Math.abs(dx - f.dx) <= maxShift)
      .filter((dx) => framingCleanAll({ z, dx }, cs))
      .sort((a, b) => Math.abs(a - f.dx) - Math.abs(b - f.dx))[0];
  // خطوات 0.08 نزولًا، وآخرها zMin نفسه بالضبط (لا تُتخطى أدنى درجة مسموحة)
  for (let z = f.z; z >= zMin - 1e-9; z = z - 0.08 < zMin && z > zMin + 1e-9 ? zMin : Math.round((z - 0.08) * 100) / 100) {
    const cands: number[] = [f.dx];
    for (const c of cs) {
      const m = c.margin ?? 36;
      const [v0, v1] = c.view;
      const dxFor = (x: number, p: number) => (x - c.focusX) * z + c.focusX - p;
      for (const sp of [...c.required, ...c.optional]) {
        cands.push(dxFor(sp.lo, v0 + m), dxFor(sp.hi, v1 - m)); // داخل الإطار عند حافته
        cands.push(dxFor(sp.hi, v0 - m - 1), dxFor(sp.lo, v1 + m + 1)); // خارج الإطار كله
      }
      for (const l of c.layers ?? []) {
        const zd = 1 + (z - 1) * (0.55 + 0.45 * l.depth);
        const kd = 0.4 + 0.6 * l.depth;
        cands.push(((l.lo - c.focusX) * zd + c.focusX - (v0 - 9)) / kd, ((l.hi - c.focusX) * zd + c.focusX - (v1 + 9)) / kd);
      }
    }
    const dx = best(z, cands);
    if (dx !== undefined) return { z, dx };
    if (z <= zMin) break;
  }
  // بحث شبكي: أقرب إطار سليم في التكبير من zMin إلى تكبير اللقطة، والإزاحة كل 4
  for (let z = zMin; z <= Math.max(1, f.z) + 1e-9; z = Math.round((z + 0.02) * 100) / 100) {
    const grid: number[] = [];
    for (let d = -maxShift; d <= maxShift; d += 4) grid.push(f.dx + d);
    const dx = best(z, grid);
    if (dx !== undefined) return { z, dx };
  }
  // لا إطار سليم ممكن (لا يحدث في الحلقات المفحوصة): البطل في منتصف الإطار
  const c = cs[0]!;
  const r = c.required[0];
  return r ? { z: 1, dx: (r.lo + r.hi) / 2 - (c.view[0] + c.view[1]) / 2 } : f;
};
