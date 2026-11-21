/**
 * كاميرا الكرة الأرضية: تنظر دائمًا إلى مركز الأرض من فوق نقطة (lon، lat) على بُعد dist (نصف القطر = 1).
 * تتحرك بمفاتيح مربوطة بكلمات الراوي {a، b بالثواني}، ولا حركة بلا كلمة تسببها.
 * السكون المقصود: أي مفتاح يتقاطع مع نافذة ذكر الله يتأخر كله إلى ما بعدها (كما في cues().safe لدفاتر الزمن).
 */
import { toV3, type LonLat, type V3 } from "./globeSphere";

export type GlobeCam = { lon: number; lat: number; dist: number };
export type GlobeCamKey = { a: number; b: number } & GlobeCam;
export type Window = [number, number];

/** تسارع وتباطؤ ناعم (مثل easeIO في دفتر الأفق) */
export const ease = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
/** خط الطول بأقصر طريق (لا تدور الكاميرا حول الأرض كلها لتعبر خط التاريخ) */
const lerpLon = (a: number, b: number, p: number) => {
  let d = ((((b - a) % 360) + 540) % 360) - 180;
  if (d === -180) d = 180;
  return a + d * p;
};

/** يؤخر كل مفتاح يتقاطع مع نافذة سكون إلى ما بعدها، محافظًا على مدته وترتيب المفاتيح */
export const safeKeys = (keys: GlobeCamKey[], windows: Window[]): GlobeCamKey[] => {
  const out: GlobeCamKey[] = [];
  let floor = -Infinity;
  for (const k of [...keys].sort((x, y) => x.a - y.a)) {
    let a = Math.max(k.a, floor);
    const len = k.b - k.a;
    for (let moved = true; moved; ) {
      moved = false;
      for (const [s, e] of windows)
        if (a < e && a + len > s) {
          a = e;
          moved = true;
        }
    }
    out.push({ ...k, a, b: a + len });
    floor = a + len;
  }
  return out;
};

/** حال الكاميرا عند الزمن t: تبدأ من start ثم تمر بالمفاتيح بترتيبها الزمني */
export const camAt = (t: number, start: GlobeCam, keys: GlobeCamKey[]): GlobeCam => {
  let c = start;
  for (const k of [...keys].sort((x, y) => x.a - y.a)) {
    if (t <= k.a) break;
    const p = ease((t - k.a) / Math.max(1e-6, k.b - k.a));
    c = { lon: lerpLon(c.lon, k.lon, p), lat: lerp(c.lat, k.lat, p), dist: lerp(c.dist, k.dist, p) };
    if (p < 1) break;
  }
  return c;
};

/** موضع الكاميرا في الفضاء */
export const camPosition = (c: GlobeCam): V3 => toV3([c.lon, c.lat] as LonLat, c.dist);

/** هل النقطة على الوجه المرئي من الكرة (لإظهار اسم المدينة أو إخفائه خلف الأفق) */
export const facing = (p: LonLat, c: GlobeCam): number => {
  const a = toV3(p);
  const cam = camPosition(c);
  const d = Math.hypot(...cam);
  // جيب تمام الزاوية بين النقطة والكاميرا، مطروحًا منه حد الأفق 1/dist: موجب = مرئي
  return (a[0] * cam[0] + a[1] * cam[1] + a[2] * cam[2]) / d - 1 / d;
};

/** نوافذ السكون من توقيت الكلمات: من قبل كلمة الذكر بربع ثانية إلى ما بعدها بربع ثانية */
export const sacredWindowsOf = (words: { w: string; s: number; e: number }[], sacred: RegExp): Window[] =>
  words.filter((w) => sacred.test(w.w)).map((w) => [w.s - 0.25, w.e + 0.25]);

/** زاوية رؤية الكاميرا (درجات): ضيقة فلا تتشوه الكرة عند الحافة */
export const GLOBE_FOV = 30;
