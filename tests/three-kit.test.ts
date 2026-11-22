/**
 * عدّة الثري دي المشتركة (قرار المالك ٢٢ نوفمبر): الحركة بمفاتيح الكلام، والسكون المقصود (المفتاح يتأخر، والاهتزاز
 * والارتعاش يسكنان)، والحتمية (الإطار نفسه في كل رندر)، والخامات CC0 من مصادر مسمّاة وحدها، ولا توهج ولا جسيمات.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ASSETS, assetProblems, calmAt, camAt, flicker, grain, handheld, kelvin, lightsAt, noise1, orbit, safeKeys, valueAt, type Asset, type Cam } from "../src/remotion/three";
import { KIT_LAB_KEYS, KIT_LAB_STILL } from "../src/remotion/three/KitLab";

const cam: Cam = { target: [0, 0, 0], yaw: 0, pitch: 0, dist: 5, fov: 30 };
const num = (a: number, b: number, p: number) => a + (b - a) * p;

describe("عدّة الثري دي: الزمن والسكون المقصود", () => {
  it("القيمة تبدأ من البداية وتصل المفتاح بتسارع ناعم، ولا حركة قبل كلمتها", () => {
    const keys = [{ a: 1, b: 3, to: 10 }];
    expect([valueAt(0.5, 0, keys, num), valueAt(2, 0, keys, num), valueAt(4, 0, keys, num)]).toEqual([0, 5, 10]);
  });
  it("المفتاح الذي يقع على نافذة سكون يتأخر كله إلى ما بعدها، ولا يتداخل مع ما بعده", () => {
    expect(safeKeys([{ a: 2.5, b: 3.5, to: 1 }, { a: 4.2, b: 5, to: 2 }], [[3, 4]])).toEqual([{ a: 4, b: 5, to: 1 }, { a: 5, b: 5.8, to: 2 }]);
    expect(safeKeys(KIT_LAB_KEYS, KIT_LAB_STILL)[1]!.a).toBe(4);
  });
  it("الكاميرا ساكنة تمامًا داخل نافذة السكون (لا مفتاح ولا اهتزاز)", () => {
    const shake = { amp: 0.05, rate: 1, seed: 2 };
    const at = (t: number) => camAt(t, cam, [{ a: 3.2, b: 5, to: { ...cam, yaw: 40 } }], { still: [[3, 4]], shake });
    expect(at(3.1)).toEqual(at(3.9));
    expect(handheld(3.5, shake, [[3, 4]])).toEqual([0, 0, 0]);
    expect(calmAt(4.15, [[3, 4]])).toBeCloseTo(0.5, 5);
  });
  it("ارتعاش الضوء يثبت على ١ في السكون، ويتحرك خارجه", () => {
    const f = { depth: 0.2, rate: 6, seed: 1 };
    expect(flicker(3.5, f, [[3, 4]])).toBe(1);
    expect(new Set([0.1, 0.4, 0.7, 1.3].map((t) => flicker(t, f).toFixed(3))).size).toBeGreaterThan(1);
    expect(lightsAt(3.5, [{ kind: "practical", kelvin: 2200, intensity: 5, position: [0, 1, 0], flicker: f }], [[3, 4]])[0]!.intensity).toBe(5);
  });
});

describe("عدّة الثري دي: الحتمية والكاميرا والضوء", () => {
  it("الضجيج والحبيبات حتمية ببذرتها، بين حديها", () => {
    expect(noise1(4, 2.37)).toBe(noise1(4, 2.37));
    expect(noise1(4, 2.37)).not.toBe(noise1(5, 2.37));
    for (let x = 0; x < 20; x += 0.37) expect(Math.abs(noise1(9, x))).toBeLessThanOrEqual(1);
    const g = grain(64, 3, 0.5);
    expect(g).toEqual(grain(64, 3, 0.5));
    const mean = g.reduce((a, v) => a + v, 0) / g.length;
    expect(Math.abs(mean - 128)).toBeLessThan(12);
  });
  it("المدار: yaw ٠ أمام الهدف، و٩٠ على يمينه، وpitch ٩٠ فوقه", () => {
    const r = (v: number[]) => v.map((x) => Math.round(x * 1e6) / 1e6 + 0);
    expect(r(orbit(cam))).toEqual([0, 0, 5]);
    expect(r(orbit({ ...cam, yaw: 90 }))).toEqual([5, 0, 0]);
    expect(r(orbit({ ...cam, pitch: 90 }))).toEqual([0, 5, 0]);
    // أقصر طريق: من ٣٥٠ إلى ١٠ يمر بـ ٠ لا بـ ١٨٠
    expect(camAt(2, { ...cam, yaw: 350 }, [{ a: 1, b: 3, to: { ...cam, yaw: 10 } }]).position[0]).toBeCloseTo(0, 5);
  });
  it("الكلفن: السراج دافئ والنهار أبيض والسماء زرقاء", () => {
    expect(kelvin(6600)).toBe("#ffffff");
    const [r, , b] = [1, 3, 5].map((i) => parseInt(kelvin(2000).slice(i, i + 2), 16));
    expect(r).toBe(255);
    expect(b).toBeLessThan(40);
    expect(parseInt(kelvin(10000).slice(5, 7), 16)).toBe(255);
  });
});

describe("عدّة الثري دي: الخامات CC0 وحدها", () => {
  const ok: Asset = { id: "paper-1", file: "three/dafatir-alzaman/paper-1.jpg", kind: "texture", source: "polyhaven", url: "https://polyhaven.com/a/paper_1", license: "CC0", checked: "2026-11-22", channel: "dafatir-alzaman" };
  it("أصل CC0 من مصدر مسمّى بصفحته وتاريخ مراجعته يُقبل", () => expect(assetProblems(ok)).toEqual([]));
  it("يُرفض: رخصة أخرى، ورابط من غير مصدره، وبلا تاريخ، وملف قناة أخرى", () => {
    expect(assetProblems({ ...ok, license: "CC-BY" as "CC0" })).toHaveLength(1);
    expect(assetProblems({ ...ok, url: "https://polyhaven.com.evil.example/a/x" })[0]).toContain("ليس صفحة");
    expect(assetProblems({ ...ok, source: "met", url: "https://polyhaven.com/a/x" })[0]).toContain("metmuseum.org");
    expect(assetProblems({ ...ok, checked: "" })[0]).toContain("تاريخ");
    expect(assetProblems({ ...ok, file: "three/balislam/paper-1.jpg" })[0]).toContain("قناة أخرى");
  });
  it("كل مدخل في السجل سليم، وبلا تكرار", () => {
    expect(ASSETS.flatMap(assetProblems)).toEqual([]);
    expect(new Set(ASSETS.map((a) => a.id)).size).toBe(ASSETS.length);
  });
});

describe("عدّة الثري دي: لا قوالب افتراضية", () => {
  it("لا توهج ولا جسيمات زخرفية ولا لمعة عدسة؛ وما بعد المعالجة عمق الميدان وحده في lens.tsx", () => {
    const dir = path.join(import.meta.dirname, "..", "src/remotion/three");
    for (const f of readdirSync(dir)) {
      const code = readFileSync(path.join(dir, f), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      // عمق الميدان وحده مسموح (D189)، وفي lens.tsx وحده؛ التوهج والإشعاع ولمعة العدسة والجسيمات الزخرفية ممنوعة
      expect(code, f).not.toMatch(/UnrealBloom|Bloom|Lensflare|<points|PointsMaterial|Sparkles|@react-three\/drei/i);
      if (f !== "lens.tsx") expect(code, f).not.toMatch(/postprocessing|EffectComposer/i);
      expect(code, f).not.toMatch(/Math\.random|Date\.now|performance\.now/);
    }
  });
});

describe("عدّة الثري دي: التأرجح بعد الحركة (D189)", () => {
  it("صفر قبل التوقف، ثم يتأرجح ويخمد", async () => {
    const { swing } = await import("../src/remotion/three");
    expect(swing(1, 2, 0.3)).toBe(0);
    expect(Math.abs(swing(2.15, 2, 0.3))).toBeGreaterThan(0.1);
    expect(Math.abs(swing(4.5, 2, 0.3))).toBeLessThan(0.002);
  });
});
