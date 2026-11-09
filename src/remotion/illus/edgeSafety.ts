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

/** يرجع الإطار نفسه إن كان سليمًا، وإلا أقرب إطار سليم. */
export const cleanAutoFraming = (f: AutoFraming, c: EdgeContext): AutoFraming => {
  if (framingClean(f, c)) return f;
  const m = c.margin ?? 36;
  const maxShift = c.maxShift ?? 420;
  const [v0, v1] = c.view;
  // dx الذي يضع النقطة x على الموضع p من الشاشة
  const dxFor = (x: number, p: number, z: number) => (x - c.focusX) * z + c.focusX - p;
  const zMin = Math.min(1, f.z);
  for (let z = f.z; z >= zMin - 1e-9; z = Math.round((z - 0.08) * 100) / 100) {
    const cands: number[] = [f.dx];
    for (const s of [...c.required, ...c.optional]) {
      cands.push(dxFor(s.lo, v0 + m, z), dxFor(s.hi, v1 - m, z)); // داخل الإطار عند حافته
      cands.push(dxFor(s.hi, v0 - m - 1, z), dxFor(s.lo, v1 + m + 1, z)); // خارج الإطار كله
    }
    for (const l of c.layers ?? []) {
      const zd = 1 + (z - 1) * (0.55 + 0.45 * l.depth);
      const kd = 0.4 + 0.6 * l.depth;
      cands.push(((l.lo - c.focusX) * zd + c.focusX - (v0 - 9)) / kd, ((l.hi - c.focusX) * zd + c.focusX - (v1 + 9)) / kd);
    }
    const ok = cands
      .filter((dx) => Math.abs(dx - f.dx) <= maxShift)
      .filter((dx) => framingClean({ z, dx }, c))
      .sort((a, b) => Math.abs(a - f.dx) - Math.abs(b - f.dx));
    if (ok.length) return { z, dx: ok[0]! };
    if (z <= zMin) break;
  }
  // لقطة واسعة على الجميع: الحجم 1 ومركز الاتحاد في منتصف الإطار
  const all = [...c.required, ...c.optional];
  const lo = Math.min(...all.map((s) => s.lo));
  const hi = Math.max(...all.map((s) => s.hi));
  const wide = { z: 1, dx: (lo + hi) / 2 - (v0 + v1) / 2 };
  if (framingClean(wide, c)) return wide;
  // وإلا: البطل في المنتصف (لا تُترك لقطة بشخص مقصوص قدر الإمكان)
  const r = c.required[0];
  return r ? { z: 1, dx: (r.lo + r.hi) / 2 - (v0 + v1) / 2 } : f;
};
