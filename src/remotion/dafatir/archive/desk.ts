/**
 * «اللوح – خزانة الأرشيف» (D185): الحساب الخالص للقالب، بلا رسم.
 * طاولة وثائق في عالم بإحداثيات ثابتة، وكاميرا «دولي» تتنقل بين محطات مربوطة بكلمات الراوي،
 * وكل محطة تكوين مختلف (لقطة واسعة، قريبة، تفصيلية) فلا تتكرر لقطتان متتاليتان (قرار المالك ٣).
 * الضوء من نافذة واحدة ثابتة للقناة: ظل كل وثيقة يُحسب من ارتفاعها عن الطاولة واتجاه الضوء.
 */
export type Station = { id: string; x: number; y: number; z: number; shot: "wide" | "medium" | "close" | "detail" };
export type StationKey = Station & { a: number; b: number };

/** عالم الطاولة بالبكسل */
export const DESK = { w: 3800, h: 2400 };
/** اتجاه ضوء النافذة (من أعلى اليسار): الظل يقع أسفل اليمين، طوله بارتفاع الوثيقة */
export const LIGHT = { dx: 0.8, dy: 0.6 };
export const shadowOf = (height: number) => ({ x: LIGHT.dx * (6 + 10 * height), y: LIGHT.dy * (6 + 10 * height), blur: 4 + 5 * height, alpha: Math.max(0.14, 0.34 - 0.05 * height) });

const ease = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

/** انجراف الكاميرا وهي «واقفة» بين محطتين: دفع بطيء جدًا (٢٪ تكبير في الثانية) كيد المصوّر على الدولي،
 * فلا يتجمد الكادر (مقياس التفاعلية من A يعد الإطار الثابت سكونًا) ولا تبدو الحركة قفزة */
export const DRIFT_PER_SEC = 0.02;

/** حال الكاميرا عند t: من البداية عبر المفاتيح بترتيبها، والانتقال تسارع وتباطؤ كدولي حقيقي.
 * بين محطتين تنجرف الكاميرا ببطء (DRIFT_PER_SEC)، والانتقال التالي يبدأ من حيث انتهى الانجراف فلا قفزة. */
export const deskCamAt = (t: number, start: Station, keys: StationKey[]): Station => {
  let c: Station = start;
  let rest = 0; // متى وقفت الكاميرا آخر مرة
  for (const k of [...keys].sort((p, q) => p.a - q.a)) {
    if (t <= k.a) break;
    c = { ...c, z: c.z * (1 + DRIFT_PER_SEC * (k.a - rest)) };
    const p = ease((t - k.a) / Math.max(1e-6, k.b - k.a));
    // التكبير يُستوفى لوغاريتميًا فيبدو الاقتراب منتظمًا للعين
    const z = Math.exp(Math.log(c.z) + (Math.log(k.z) - Math.log(c.z)) * p);
    c = { id: p >= 1 ? k.id : c.id, shot: p >= 0.5 ? k.shot : c.shot, x: c.x + (k.x - c.x) * p, y: c.y + (k.y - c.y) * p, z };
    if (p < 1) return c;
    rest = k.b;
  }
  return { ...c, z: c.z * (1 + DRIFT_PER_SEC * Math.max(0, t - rest)) };
};

/** لا محطتان متتاليتان بالتكوين نفسه (اللقطة والموضع): يعيد أزواج المخالفة */
export const repeatedNeighbours = (stations: Station[]): [string, string][] => {
  const out: [string, string][] = [];
  for (let i = 1; i < stations.length; i++) {
    const a = stations[i - 1]!;
    const b = stations[i]!;
    if (a.shot === b.shot && Math.hypot(a.x - b.x, a.y - b.y) < 300) out.push([a.id, b.id]);
  }
  return out;
};

/** نسبة كتابة كلمة بالحبر: من بداية نطقها إلى نهايته، والحبر الطري يجف بعدها في ثانية */
export const inkAt = (t: number, s: number, e: number) => ({ write: Math.min(1, Math.max(0, (t - s) / Math.max(0.12, e - s))), wet: 1 - Math.min(1, Math.max(0, (t - e) / 1.0)) });

/** ختم يُضغط: ينزل ثم يرتفع، والحبر يتوزع على الورق بعدم انتظام ثابت (بذرة) */
export const stampAt = (t: number, at: number) => {
  const d = t - at;
  if (d < -0.25) return { lift: 1, ink: 0, press: 0 };
  if (d < 0) return { lift: -d / 0.25, ink: 0, press: 0 };
  if (d < 0.12) return { lift: 0, ink: d / 0.12, press: 1 };
  return { lift: Math.min(1, (d - 0.12) / 0.3), ink: 1, press: Math.max(0, 1 - (d - 0.12) / 0.3) };
};
