/**
 * رياضيات الكرة الأرضية لأداة الخرائط ثلاثية الأبعاد (مشتركة بين القنوات، بلا ألوان ولا هوية).
 * كل شيء دالة خالصة من مدخلاتها: نفس المدخل يعطي نفس الناتج في كل رندر (رندر حتمي).
 *
 * الإحداثيات على اصطلاح SphereGeometry في three.js، فتنطبق الخريطة المسطحة (equirectangular) على الكرة:
 *   x = cos(lat)·cos(lon) ، y = sin(lat) ، z = −cos(lat)·sin(lon)
 */
export type LonLat = [number, number];
export type V3 = [number, number, number];

const D = Math.PI / 180;

export const toV3 = ([lon, lat]: LonLat, r = 1): V3 => {
  const c = Math.cos(lat * D);
  return [r * c * Math.cos(lon * D), r * Math.sin(lat * D), -r * c * Math.sin(lon * D)];
};

export const toLonLat = ([x, y, z]: V3): LonLat => {
  const r = Math.hypot(x, y, z) || 1;
  return [Math.atan2(-z, x) / D, Math.asin(Math.max(-1, Math.min(1, y / r))) / D];
};

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** الزاوية بين نقطتين على الكرة (بالراديان) */
export const angle = (a: LonLat, b: LonLat) => Math.acos(Math.max(-1, Math.min(1, dot(toV3(a), toV3(b)))));

/** استيفاء كروي بين متجهين وحدة */
export const slerpV = (a: V3, b: V3, t: number): V3 => {
  const w = Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
  if (w < 1e-6) return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const s = Math.sin(w);
  const ka = Math.sin((1 - t) * w) / s;
  const kb = Math.sin(t * w) / s;
  return [a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb];
};

export const slerp = (a: LonLat, b: LonLat, t: number): LonLat => toLonLat(slerpV(toV3(a), toV3(b), t));

/** قوس الدائرة العظمى بين مكانين (مسار قافلة أو رحلة)، n+1 نقطة */
export const greatArc = (a: LonLat, b: LonLat, n = 48): LonLat[] => Array.from({ length: n + 1 }, (_, i) => slerp(a, b, i / n));

/** أطوال الأجزاء التراكمية لخط على الكرة */
const cumulative = (pts: LonLat[]) => {
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1]! + angle(pts[i - 1]!, pts[i]!));
  return acc;
};

/** الجزء المرسوم من خط بنسبة p من طوله (0..1)، وآخره نقطة مستوفاة: الخط «يُرسم» مع الكلام */
export const partialLine = (pts: LonLat[], p: number): LonLat[] => {
  if (pts.length < 2 || p <= 0) return [];
  if (p >= 1) return pts.slice();
  const acc = cumulative(pts);
  const target = acc[acc.length - 1]! * p;
  const out: LonLat[] = [pts[0]!];
  for (let i = 1; i < pts.length; i++) {
    if (acc[i]! <= target) {
      out.push(pts[i]!);
      continue;
    }
    const seg = acc[i]! - acc[i - 1]!;
    out.push(slerp(pts[i - 1]!, pts[i]!, seg > 0 ? (target - acc[i - 1]!) / seg : 0));
    break;
  }
  return out;
};

/** حلقة مغلقة (أول نقطة = آخر نقطة) أُعيد أخذ نقاطها بمسافات متساوية على محيطها، n نقطة بلا تكرار الأولى */
export const resampleRing = (ring: LonLat[], n: number): LonLat[] => {
  const closed = ring.length > 1 && (ring[0]![0] !== ring[ring.length - 1]![0] || ring[0]![1] !== ring[ring.length - 1]![1]) ? [...ring, ring[0]!] : ring;
  const acc = cumulative(closed);
  const total = acc[acc.length - 1]!;
  const out: LonLat[] = [];
  let j = 1;
  for (let k = 0; k < n; k++) {
    const target = (total * k) / n;
    while (j < closed.length - 1 && acc[j]! < target) j++;
    const seg = acc[j]! - acc[j - 1]!;
    out.push(slerp(closed[j - 1]!, closed[j]!, seg > 0 ? (target - acc[j - 1]!) / seg : 0));
  }
  return out;
};

/** اتجاه الحلقة: المساحة المسطحة الموقّعة (يكفي لحدود إقليمية لا تعبر خط التاريخ) */
const signedArea = (ring: LonLat[]) => ring.reduce((sum, p, i) => {
  const q = ring[(i + 1) % ring.length]!;
  return sum + (p[0] * q[1] - q[0] * p[1]);
}, 0);

/**
 * صورة قياسية للحد: n نقطة متساوية البعد، بعكس عقارب الساعة، تبدأ من أعلى نقطة فيه (شمالًا).
 * كل حالات الحد في كل السنين بالصورة نفسها، فالتحوّل متصل عبر السنين بلا قفزة عند سنة بينية.
 */
export const canonicalRing = (ring: LonLat[], n = 160): LonLat[] => {
  const r = resampleRing(signedArea(ring) < 0 ? [...ring].reverse() : ring, n);
  let top = 0;
  for (let i = 1; i < n; i++) if (r[i]![1] > r[top]![1] + 1e-12) top = i;
  return [...r.slice(top), ...r.slice(0, top)];
};

/**
 * تحوّل حد إلى حد (سنة إلى سنة): الحالتان بصورتهما القياسية (canonicalRing)، ثم استيفاء كروي نقطة بنقطة.
 * الناتج حلقة مغلقة (آخر نقطة = أولها)، وحتمي: نفس المدخل يعطي نفس الناتج.
 */
export const morphRing = (a: LonLat[], b: LonLat[], p: number, n = 160): LonLat[] => {
  const ra = canonicalRing(a, n);
  const rb = p > 0 ? canonicalRing(b, n) : ra;
  const out = ra.map((pa, i) => (p <= 0 ? pa : p >= 1 ? rb[i]! : slerp(pa, rb[i]!, p)));
  return [...out, out[0]!];
};
