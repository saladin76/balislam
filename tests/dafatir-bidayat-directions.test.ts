/**
 * «دفاتر الزمن» — سلسلة «البدايات»: الاتجاهات الثلاثة لعالمها (D203، قرار المالك ٢٣ نوفمبر). الألوان من «دفتر الأفق»
 * وحده، وجملة ذكر الله سكون مقصود كله، وفي كل اتجاه خيط الزمن الأحمر وختم «درجة الثبوت»، ولا تصوير لأحد (المرجع، خامسًا/٤)،
 * وأربع لقطات بأحجام مختلفة على كادر ثري دي (D189).
 */
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { APPROVED_IDENTITIES } from "../brand/identity/approved";
import { isSacredSentence } from "../src/plan/sceneCues";
import { safeKeys } from "../src/remotion/three";
import { BID_SENTENCES, BID_STILL, BID_WORDS, n2, shotBounds, wordAt } from "../src/remotion/dafatir/bidayat/common";

const DIR = "src/remotion/dafatir/bidayat";
const files = readdirSync(DIR).map((f) => ({ f, code: readFileSync(`${DIR}/${f}`, "utf8") }));
const directions = files.filter((x) => x.f !== "common.tsx");

describe("«البدايات»: الاتجاهات الثلاثة للمقارنة", () => {
  it("ثلاثة اتجاهات، وكل لون في الملفات من هوية «دفتر الأفق» المعتمدة", () => {
    expect(directions.map((x) => x.f).sort()).toEqual(["ClayLand.tsx", "EarthSection.tsx", "StoneLines.tsx"]);
    const a = APPROVED_IDENTITIES["dafatir-alzaman"]!;
    const ok = new Set([...a.palette.map((p) => p.hex), ...a.signature, ...a.derived].map((x) => x.toUpperCase()));
    const bad = files.flatMap(({ f, code }) => [...code.matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m) => m[0].toUpperCase()).filter((c) => !ok.has(c)).map((c) => `${f}: ${c}`));
    expect(bad).toEqual([]);
  });
  it("الجملة الثالثة وحدها ذكر لله، والسكون يغطيها كلها (±٠٫٢٥ ث)", () => {
    expect(isSacredSentence(BID_SENTENCES[2]!)).toBe(true);
    expect(isSacredSentence(BID_SENTENCES[0]!)).toBe(false);
    expect(isSacredSentence(BID_SENTENCES[1]!)).toBe(false);
    const s3 = BID_WORDS.filter((w) => w.si === 2);
    expect(BID_STILL[0]![0]).toBeCloseTo(s3[0]!.s - 0.25, 6);
    expect(BID_STILL[0]![1]).toBeCloseTo(s3[s3.length - 1]!.e + 0.25, 6);
  });
  it("مفتاح حركة يقع على جملة الذكر يتأخر إلى ما بعدها", () => {
    const k = safeKeys([{ a: wordAt("طين"), b: wordAt("طين") + 0.5, to: 1 }], BID_STILL)[0]!;
    expect(k.a).toBeCloseTo(BID_STILL[0]![1], 6);
  });
  it("كل اتجاه: خيط الزمن وعقدته، وختما «ثابت» و«تقدير»، وصوت مع كل حركة، والترجمة بلا مستطيل", () => {
    for (const { f, code } of directions) {
      for (const re of [/<RedThread /, /knot=\{p\(knotK\)\}/, /"ثابت"/, /"تقدير"/, /<DepthOfField /, /SFX\("stamp"\)/, /<BidLine /]) expect(code, `${f} ${re}`).toMatch(re);
      expect(code, f).not.toMatch(/background: "rgba\(0|DirFrame/);
    }
  });
  it("لا تصوير لأحد (لا شخص ولا هيئة ولا ظل إنسان)، ولا أدوات القوالب الشائعة ولا عشوائية", () => {
    const banned = [/\bPerson\b|figureShapes|silhouette|armPose/, /boxShadow|drop-shadow/, /backdrop-?[Ff]ilter/, /\bInter\b|Poppins/, /sparkle|lens.?flare|glow|Bloom/i, /spring\(|bounce/i, /@remotion\/transitions/, /Math\.random|Date\.now/, /\b(eye|mouth|nose|face)s?\b/i];
    expect(files.flatMap(({ f, code }) => banned.filter((re) => re.test(code.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""))).map((re) => `${f}: ${re}`))).toEqual([]);
  });
  it("الضوضاء ثنائية البعد (لا خطوط متوازية على الطين والحجر)", () => {
    // ضوضاء على مزيج خطي واحد (٠٫٩س + ٠٫٥ع) ثابتة على كل خط يحفظه؛ n2 تتغير على الخط نفسه
    const line = [[0, 2], [1, 0.2], [2, -1.6]].map(([x, z]) => n2(3, x!, z!).toFixed(3));
    expect(new Set(line).size).toBe(3);
  });
});

describe("«البدايات»: أربع لقطات بأحجام مختلفة لكل اتجاه (D189)", () => {
  const cases: [string, () => Promise<{ id: string; size: string; a: number; b: number }[]>][] = [
    ["أرض من طين", async () => (await import("../src/remotion/dafatir/bidayat/ClayLand")).clayShots()],
    ["خطوط على الأرض", async () => (await import("../src/remotion/dafatir/bidayat/StoneLines")).stoneShots()],
    ["مقطع الأرض", async () => (await import("../src/remotion/dafatir/bidayat/EarthSection")).sectionShots()],
  ];
  for (const [name, get] of cases) {
    it(`${name}: أربعة أحجام بلا تكرار، ٢–٨ ث، والأخيرة تبدأ قبل جملة الذكر وتمتد بعدها`, async () => {
      const shots = await get();
      expect(new Set(shots.map((x) => x.size)).size).toBe(4);
      expect(new Set(shots.map((x) => x.id)).size).toBe(4);
      for (const x of shots.slice(0, -1)) { expect(x.b - x.a, x.id).toBeGreaterThanOrEqual(2); expect(x.b - x.a, x.id).toBeLessThanOrEqual(8); }
      const last = shots[shots.length - 1]!;
      expect(last.a).toBeLessThanOrEqual(BID_STILL[0]![0]);
      expect(last.b).toBeGreaterThan(BID_STILL[0]![1]);
      expect(shots[1]!.a).toBeCloseTo(shotBounds().s1, 6);
    });
  }
  it("الحلزون في «خطوط على الأرض» يلتف إلى الداخل، والطين في «أرض من طين» مسطح قبل «الأرض»", async () => {
    const { stonePath } = await import("../src/remotion/dafatir/bidayat/StoneLines");
    const sp = stonePath().slice(11);
    const r = sp.map(([x, z]) => Math.hypot(x - 0.6, z + 1.6));
    expect(r[r.length - 1]!).toBeLessThan(r[0]! / 3);
    const { clayHeight } = await import("../src/remotion/dafatir/bidayat/ClayLand");
    expect(Math.abs(clayHeight(2.4, -1.6, 0))).toBeLessThan(0.02);
    expect(clayHeight(2.4, -1.6, 1)).toBeGreaterThan(0.6);
  });
});
