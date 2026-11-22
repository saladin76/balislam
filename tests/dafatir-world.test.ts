/**
 * «مكتب الرحّالة» — عالم «دفاتر الزمن» (D190) بمعايير «الحِرفة» (D189): لقطات ٢–٨ ث بلا تكرار وبأحجام متنوعة،
 * وخطاف في أول ١٥ ث، وقطع بالشكل (دائرة بغداد ← المدينة المدوّرة بالحجم نفسه)، والألوان من «دفتر الأفق» واللازورد
 * للماء والخرائط وحدها (D188)، والخامات CC0 مسجلة وموجودة، والأصوات موجودة، والرندر ينسخ public/three.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { APPROVED_IDENTITIES } from "../brand/identity/approved";
import { ASSETS, assetFile } from "../src/remotion/three";
import { BAGHDAD_PX, CITY_R, WORLD_COLORS, WORLD_SEC, worldShots } from "../src/remotion/dafatir/world/DeskWorld";

const root = path.join(import.meta.dirname, "..");
const code = readFileSync(path.join(root, "src/remotion/dafatir/world/DeskWorld.tsx"), "utf8");

describe("مكتب الرحّالة: المونتاج والكاميرا", () => {
  const shots = worldShots();
  it("كل لقطة بين ٢ و٨ ث، متتابعة بلا فجوة حتى آخر الفيديو، وبلا لقطة مكررة", () => {
    for (const s of shots) { expect(s.b - s.a, s.id).toBeGreaterThanOrEqual(2); expect(s.b - s.a, s.id).toBeLessThanOrEqual(8); }
    shots.slice(1).forEach((s, i) => expect(s.a).toBeCloseTo(shots[i]!.b, 6));
    expect(shots[shots.length - 1]!.b).toBe(WORLD_SEC);
    expect(new Set(shots.map((s) => s.id)).size).toBe(shots.length);
  });
  it("ثلاثة أحجام لقطات على الأقل، والخطاف لقطة تفاصيل في أول ١٥ ث", () => {
    expect(new Set(shots.map((s) => s.size)).size).toBeGreaterThanOrEqual(3);
    expect(shots[0]!.size).toBe("detail");
    expect(shots[0]!.b).toBeLessThanOrEqual(15);
  });
  it("قطع بالشكل: آخر لقطة الخريطة على دائرة بغداد، وأول لقطة المدينة سورها بالحجم نفسه على الشاشة", () => {
    const map = shots.find((s) => s.id === "map")!, city = shots.find((s) => s.id === "city")!;
    expect(map.to.pitch).toBeGreaterThan(85);
    expect(city.from.pitch).toBeGreaterThan(85);
    const ringOnMap = (BAGHDAD_PX.r / 1536) * 1.26;
    expect(ringOnMap / map.to.dist).toBeCloseTo((CITY_R + 0.12) / city.from.dist, 6);
  });
});

describe("مكتب الرحّالة: الهوية والخامات والصوت", () => {
  it("كل لون من «دفتر الأفق» (واللازورد مقيّد فيها)", () => {
    const a = APPROVED_IDENTITIES["dafatir-alzaman"]!;
    const ok = new Set([...a.palette.map((p) => p.hex), ...a.signature, ...a.derived].map((x) => x.toUpperCase()));
    const used = [...Object.values(WORLD_COLORS), ...[...code.matchAll(/"(#[0-9A-Fa-f]{6})"/g)].map((m) => m[1]!)];
    // لون المكتب يُضرب في خامة الخشب (تعتيم للخامة لا لون ظاهر)
    expect(used.filter((c) => !ok.has(c.toUpperCase()) && c.toLowerCase() !== "#c9b49a")).toEqual([]);
    expect(a.restricted?.find((r) => r.hex === WORLD_COLORS.lapis)?.useAr).toContain("الماء");
  });
  it("اللازورد للماء وحده: البحر والأنهار وخندق المدينة", () => {
    const lines = code.split("\n").filter((l) => l.includes("K.lapis"));
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(/sea|euph|tigris|ringGeometry/.test(l), l.trim()).toBe(true);
  });
  it("الخامات CC0 مسجلة في قناتها وموجودة، والأصوات موجودة، والرندر ينسخ public/three", () => {
    const ids = [...code.matchAll(/"(dafatir-[a-z-]+)"/g)].map((m) => m[1]!).filter((id) => ASSETS.some((x) => x.id === id));
    expect(ids.length).toBeGreaterThanOrEqual(6);
    for (const id of ids) {
      const a = ASSETS.find((x) => x.id === id)!;
      expect([a.license, a.channel], id).toEqual(["CC0", "dafatir-alzaman"]);
      expect(existsSync(path.join(root, "public", assetFile(id))), id).toBe(true);
    }
    for (const f of [...code.matchAll(/SFX\("([a-z-]+)"\)/g)].map((m) => m[1]!)) expect(existsSync(path.join(root, "public/three/sfx", `${f}.mp3`)), f).toBe(true);
    expect(readFileSync(path.join(root, "src/render/bundle.ts"), "utf8")).toMatch(/sharedAssets = new Set\(\[[^\]]*"three"/);
  });
  it("الترجمة سطر هادئ (D187): لا كلمة مميزة، ولا عشوائية، ولا أدوات شائعة", () => {
    const c = code.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    for (const re of [/boxShadow|drop-shadow|textShadow: (?!CAPTION_SHADOW)/, /particle|sparkle|lens.?flare|glow|Bloom/i, /Math\.random|Date\.now/, /\bInter\b|Poppins/]) expect(re.test(c), String(re)).toBe(false);
    expect(code).toMatch(/words\.map\(\(w\) => w\.w\)\.join\(" "\)/);
  });
});

describe("سور بغداد من طوب لبن لا مكعبات (قرار المالك ٢٢ نوفمبر)", () => {
  it("خامة طوب لبن مسجّلة CC0 للقناة وحدها، والسوران سميكان بشرفات، والخامة مخففة التشبع", async () => {
    const { ASSETS } = await import("../src/remotion/three/materials");
    const { CITY_WALLS } = await import("../src/remotion/dafatir/world/DeskWorld");
    for (const id of ["dafatir-mudbrick-diff", "dafatir-mudbrick-nor"]) {
      const a = ASSETS.find((x) => x.id === id)!;
      expect(a.license).toBe("CC0"); expect(a.channel).toBe("dafatir-alzaman"); expect(existsSync(`public/${a.file}`)).toBe(true);
    }
    for (const w of CITY_WALLS) { expect(w.thick).toBeGreaterThan(0.02); expect(w.merlons).toBeGreaterThanOrEqual(48); }
    const code = readFileSync("src/remotion/dafatir/world/DeskWorld.tsx", "utf8");
    expect(code).toMatch(/new THREE\.LatheGeometry/);
    expect(code).toMatch(/saturate\(0\.4\)/);
  });
});
