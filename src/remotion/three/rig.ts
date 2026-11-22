/**
 * عدّة الثري دي — الكاميرا والإضاءة بيانات خالصة، لكل عالم قيمه في مجلد قناته (لا قيم هوية هنا).
 * الكاميرا تدور حول هدف (yaw، pitch، dist) بعدسة fov، وتنتقل بمفاتيح الكلام، ويُضاف إليها اهتزاز اليد إن طلبه العالم.
 * الإضاءة: مفتاح وملء وخلفي وضوء عملي (سراج، مصباح)، بحرارة لون كلفن لا بألوان حرة، وارتعاش اختياري.
 */
import { flicker, handheld, NO_SHAKE, type Flicker, type Shake } from "./imperfection";
import { lerp, safeKeys, valueAt, type Key, type Window } from "./time";

export type V3 = [number, number, number];
export type Cam = { target: V3; yaw: number; pitch: number; dist: number; fov: number };
export type CamKey = Key<Cam>;
export type CamState = { position: V3; target: V3; fov: number };

const mixV = (a: V3, b: V3, p: number): V3 => [lerp(a[0], b[0], p), lerp(a[1], b[1], p), lerp(a[2], b[2], p)];
/** الزاوية بأقصر طريق (لا تلف الكاميرا دورة كاملة) */
const mixAngle = (a: number, b: number, p: number) => a + ((((b - a) % 360) + 540) % 360 - 180) * p;
export const mixCam = (a: Cam, b: Cam, p: number): Cam =>
  ({ target: mixV(a.target, b.target, p), yaw: mixAngle(a.yaw, b.yaw, p), pitch: lerp(a.pitch, b.pitch, p), dist: lerp(a.dist, b.dist, p), fov: lerp(a.fov, b.fov, p) });

const rad = (d: number) => (d * Math.PI) / 180;
/** موضع الكاميرا من زواياها: yaw حول المحور الرأسي (٠ = أمام الهدف على +z)، وpitch فوقه */
export const orbit = (c: Cam): V3 => [
  c.target[0] + c.dist * Math.cos(rad(c.pitch)) * Math.sin(rad(c.yaw)),
  c.target[1] + c.dist * Math.sin(rad(c.pitch)),
  c.target[2] + c.dist * Math.cos(rad(c.pitch)) * Math.cos(rad(c.yaw)),
];

/** حال الكاميرا عند t: المفاتيح بعد تأخيرها عن نوافذ السكون، ثم اهتزاز اليد (يسكن فيها أيضًا) */
export const camAt = (t: number, start: Cam, keys: CamKey[], opts: { still?: Window[]; shake?: Shake } = {}): CamState => {
  const still = opts.still ?? [];
  const c = valueAt(t, start, safeKeys(keys, still), mixCam);
  const [dx, dy, dz] = handheld(t, opts.shake ?? NO_SHAKE, still);
  const p = orbit(c);
  return { position: [p[0] + dx, p[1] + dy, p[2] + dz], target: [c.target[0] + dx * 0.3, c.target[1] + dy * 0.3, c.target[2]], fov: c.fov };
};

export type LightKind = "key" | "fill" | "back" | "practical" | "ambient";
export type Light = { kind: LightKind; kelvin: number; intensity: number; position: V3; flicker?: Flicker };
export type LitLight = { kind: LightKind; color: string; intensity: number; position: V3 };

/** حرارة اللون (١٠٠٠–١٢٠٠٠ كلفن) إلى لون — تقريب Tanner Helland المعروف */
export const kelvin = (k: number): string => {
  const t = Math.min(12000, Math.max(1000, k)) / 100;
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, v)));
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return `#${[r, g, b].map((v) => c(v).toString(16).padStart(2, "0")).join("")}`;
};

/** الأضواء عند t: ألوانها من الكلفن، وشدتها بارتعاشها (يثبت في السكون المقصود) */
export const lightsAt = (t: number, lights: Light[], still: Window[] = []): LitLight[] =>
  lights.map((l) => ({ kind: l.kind, color: kelvin(l.kelvin), intensity: l.intensity * flicker(t, l.flicker, still), position: l.position }));
