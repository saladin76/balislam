import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { at } from "../src/remotion/dafatir/horizon/timeline";
import { RAHHALA_COLORS, rahhalaStations, rahhalaTimeline, RAHHALA_START } from "../src/remotion/dafatir/directions/Rahhala";
import { ASTRO_COLORS, astroTimeline, yearAt } from "../src/remotion/dafatir/directions/Astrolabe";
import { repeatedNeighbours } from "../src/remotion/dafatir/archive/desk";
import { APPROVED_IDENTITIES } from "../brand/identity/approved";

const allowed = () => {
  const a = APPROVED_IDENTITIES["dafatir-alzaman"]!;
  return new Set([...a.palette.map((p) => p.hex), ...a.signature, ...a.derived].map((x) => x.toUpperCase()));
};

describe("اتجاهات دفاتر الزمن للمقارنة (لا قوالب قبل اختيار المالك)", () => {
  it("دفتر الرحّالة: محطات مربوطة بكلمات، بلا تكوين مكرر متتالٍ", () => {
    const tl = rahhalaTimeline();
    for (const w of ["المنصور", "بغداد", "دجلة", "وسمّاها", "مدينة"]) expect(() => at(tl, w)).not.toThrow();
    expect(repeatedNeighbours([RAHHALA_START, ...rahhalaStations(tl)])).toEqual([]);
  });
  it("نقش وزمن: الحلقة المدرّجة تقف على سنة ١٤٥ عند نهاية «وأربعين» وتبدأ من ١٠٠", () => {
    const tl = astroTimeline();
    expect(yearAt(0, tl)).toBe(100);
    expect(yearAt(tl.end, tl)).toBeCloseTo(145, 6);
  });
  it("الألوان داخل هوية القناة المعتمدة (الأصباغ التاريخية الأخرى تحتاج قرار المالك)", () => {
    const ok = allowed();
    for (const set of [RAHHALA_COLORS, ASTRO_COLORS]) expect(Object.values(set).filter((c) => !ok.has(c.toUpperCase()))).toEqual([]);
  });
  it("لا أدوات القوالب الشائعة في ملفات الاتجاهات", () => {
    const dir = "src/remotion/dafatir/directions";
    const banned = [/boxShadow|textShadow|drop-shadow/, /backdrop-?[Ff]ilter/, /\bInter\b|Poppins/, /particle|sparkle|lens.?flare|glow/i, /spring\(|bounce/i, /@remotion\/transitions/];
    const hits = readdirSync(dir).flatMap((f) => banned.filter((re) => re.test(readFileSync(`${dir}/${f}`, "utf8"))).map((re) => `${f}: ${re}`));
    expect(hits).toEqual([]);
  });
});
