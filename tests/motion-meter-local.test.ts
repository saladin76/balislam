import { describe, expect, it } from "vitest";
import { ACTIVE_PCT, frameActivity } from "../src/render/motionMeter";

// إطارات رمادية بدقة القياس (320×180)، ومساحة المشهد كما في measureMotion (بلا أعلى 12% وأسفل 24%).
const W = 320;
const H = 180;
const Y0 = Math.floor(H * 0.12);
const Y1 = Math.floor(H * 0.76);
const blank = (v = 255) => new Uint8Array(W * H).fill(v);
const set = (f: Uint8Array, x: number, y: number, v: number) => {
  if (x >= 0 && x < W && y >= 0 && y < H) f[y * W + x] = v;
};
const activity = (a: Uint8Array, b: Uint8Array) => frameActivity(a, b, W, Y0, Y1);
const areaPct = (a: Uint8Array, b: Uint8Array) => {
  let c = 0;
  for (let y = Y0; y < Y1; y++) for (let x = 0; x < W; x++) if (Math.abs(a[y * W + x]! - b[y * W + x]!) > 28) c++;
  return (c / ((Y1 - Y0) * W)) * 100;
};
/** شبه مشهد حبر: أشخاص خطيون وصناديق وأسطر، كما في لقطات زبدة الكتب */
const inkScene = (dx = 0, dy = 0) => {
  const f = blank();
  for (const [cx, cy] of [[40, 60], [110, 90], [200, 70], [270, 110]] as const) {
    for (let t = 0; t < 30; t++) set(f, cx + dx, cy + t + dy, 0); // جسد
    for (let t = -6; t <= 6; t++) set(f, cx + t + dx, cy + 8 + dy, 0); // ذراعان
    for (let t = 0; t < 360; t += 20) set(f, Math.round(cx + 4 * Math.cos((t * Math.PI) / 180)) + dx, Math.round(cy - 5 + 4 * Math.sin((t * Math.PI) / 180)) + dy, 0); // رأس
  }
  for (let x = 150; x < 240; x++) for (const y of [120, 124, 128]) set(f, x + dx, y + dy, 40); // أسطر
  return f;
};

describe("مقياس الحركة: الحدث الموضعي الرقيق يُحسب، والمحيط لا يُحسب", () => {
  it("كتابة بخط رفيع (بكسل واحد) تظهر في نصف ثانية: حدث، مع أن مساحتها أقل من حد المساحة", () => {
    const a = inkScene();
    const b = inkScene();
    // كلمة بخط اليد: منحنى رفيع طوله نحو 60 بكسلًا في موضع واحد
    for (let t = 0; t < 60; t++) set(b, 140 + Math.round(t / 2), 44 - Math.round(4 * Math.sin(t / 4)), 30);
    for (let t = 0; t < 20; t++) set(b, 145 + t, 50, 30);
    expect(areaPct(a, b)).toBeLessThan(ACTIVE_PCT);
    expect(activity(a, b)).toBeGreaterThanOrEqual(ACTIVE_PCT);
  });

  it("امتلاء مربع صغير بالفسفوري (فرق رمادي ≈ 34 فقط): حدث", () => {
    const a = inkScene();
    const b = inkScene();
    for (let y = 60; y < 67; y++) for (let x = 60; x < 67; x++) set(b, x, y, 221); // #E8F542 رماديًا ≈ 221
    expect(areaPct(a, b)).toBeLessThan(ACTIVE_PCT);
    expect(activity(a, b)).toBeGreaterThanOrEqual(ACTIVE_PCT);
  });

  it("انجراف المشهد كله بكسلًا أو بكسلين (كاميرا بطيئة، طفو): لا يضيف إليه الحدث الموضعي شيئًا", () => {
    const a = inkScene();
    for (const [dx, dy] of [[1, 0], [0, 1], [2, 1], [-2, -2]] as const) {
      const b = inkScene(dx, dy);
      // يبقى الحكم بنسبة المساحة وحدها كما كان قبل الحدث الموضعي
      expect([dx, dy, activity(a, b)]).toEqual([dx, dy, areaPct(a, b)]);
    }
    // والانجراف البطيء (بكسل واحد) تحت الحد
    expect(activity(a, inkScene(1, 0))).toBeLessThan(ACTIVE_PCT);
    expect(activity(a, inkScene(0, 1))).toBeLessThan(ACTIVE_PCT);
  });

  it("ضجيج الضغط والتدرج تحت حد البكسل: ليس حدثًا", () => {
    const a = inkScene();
    const b = inkScene();
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let k = 0; k < b.length; k++) b[k] = Math.max(0, Math.min(255, b[k]! + Math.round((rnd() - 0.5) * 40)));
    expect(activity(a, b)).toBeLessThan(ACTIVE_PCT);
  });

  it("تغيّر متفرق في أنحاء الإطار (ذرات صغيرة تظهر وتختفي): ليس حدثًا موضعيًا", () => {
    const a = inkScene();
    const b = inkScene();
    for (let k = 0; k < 60; k++) set(b, 8 + ((k * 53) % 300), Y0 + 4 + ((k * 31) % (Y1 - Y0 - 8)), 0);
    expect(areaPct(a, b)).toBeLessThan(ACTIVE_PCT);
    expect(activity(a, b)).toBeLessThan(ACTIVE_PCT);
  });

  it("خارج مساحة المشهد (شريط الترجمة) لا يُحسب", () => {
    const a = inkScene();
    const b = inkScene();
    for (let y = Y1 + 5; y < Y1 + 20; y++) for (let x = 100; x < 200; x++) set(b, x, y, 0);
    expect(activity(a, b)).toBe(0);
  });

  it("الأحداث الكبيرة تبقى بنسبة مساحتها كما كانت", () => {
    const a = blank();
    const b = blank();
    for (let y = Y0; y < Y0 + 40; y++) for (let x = 0; x < 160; x++) set(b, x, y, 0);
    expect(activity(a, b)).toBeCloseTo(areaPct(a, b), 5);
  });
});
