/**
 * «دفاتر الزمن» — سلسلة «البدايات»: عالمها «خطوط على الأرض» (D203، اختيار المالك ٢٣ نوفمبر، وفيه فكرة «مقطع الأرض»؛
 * وتُرك «أرض من طين»). الألوان من «دفتر الأفق» وحده، وجملة ذكر الله سكون تام كله، وخيط الزمن الأحمر وأختام «درجة الثبوت»،
 * ولا تصوير لأحد (المرجع، خامسًا/٤)، ولقطات بأحجام مختلفة على كادر ثري دي (D189)، والنقاط الخمس قبل القالب الكامل.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { APPROVED_IDENTITIES } from "../brand/identity/approved";
import { isSacredSentence } from "../src/plan/sceneCues";
import { ASSETS, safeKeys } from "../src/remotion/three";
import { BID_SACRED, BID_SENTENCES, BID_STILL, BID_WORDS, CAPTION_FADE, bidLine, effTime, n2, shotBounds, wordAt } from "../src/remotion/dafatir/bidayat/common";

const DIR = "src/remotion/dafatir/bidayat";
const files = readdirSync(DIR).map((f) => ({ f, code: readFileSync(`${DIR}/${f}`, "utf8") }));
// العالم: النموذج وبيئته المشتركة (earth.tsx، الجولة ٤: الماء والرمل والسماء يستعملها النموذج وقوالب السلسلة)
const world = readFileSync(`${DIR}/StoneLines.tsx`, "utf8") + readFileSync(`${DIR}/earth.tsx`, "utf8");
const strip = (c: string) => c.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

describe("«البدايات»: عالم واحد «خطوط على الأرض» (اختيار المالك)", () => {
  it("الاتجاه ٢ وحده، و«أرض من طين» و«مقطع الأرض» ليسا اتجاهين بعد؛ وكل لون من هوية «دفتر الأفق»", () => {
    // العالم ونموذجه، وبيئته المشتركة، وقوالب السلسلة عليه (D209)
    expect(files.map((x) => x.f).sort()).toEqual(["BidayatScene.tsx", "StoneLines.tsx", "common.tsx", "earth.tsx", "shots.ts"]);
    const labs = readFileSync("src/remotion/scenes/labs.tsx", "utf8");
    expect(labs).toContain('"dafatir-bidayat-stones"');
    expect(labs).not.toMatch(/bidayat-clay|bidayat-section/);
    const a = APPROVED_IDENTITIES["dafatir-alzaman"]!;
    const ok = new Set([...a.palette.map((p) => p.hex), ...a.signature, ...a.derived].map((x) => x.toUpperCase()));
    const bad = files.flatMap(({ f, code }) => [...code.matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m) => m[0].toUpperCase()).filter((c) => !ok.has(c)).map((c) => `${f}: ${c}`));
    expect(bad).toEqual([]);
  });
  it("جملة الذكر الأخيرة وحدها، والسكون يغطيها كلها (±٠٫٢٥ ث)، وجملة «ما ثبت وما لا نعلم» من 001 ليست ذكرًا", () => {
    expect(BID_SACRED).toBe(BID_SENTENCES.length - 1);
    expect(isSacredSentence(BID_SENTENCES[BID_SACRED]!)).toBe(true);
    for (let i = 0; i < BID_SACRED; i++) expect(isSacredSentence(BID_SENTENCES[i]!), BID_SENTENCES[i]).toBe(false);
    const s3 = BID_WORDS.filter((w) => w.si === BID_SACRED);
    expect(BID_STILL[0]![0]).toBeCloseTo(s3[0]!.s - 0.25, 6);
    expect(BID_STILL[0]![1]).toBeCloseTo(s3[s3.length - 1]!.e + 0.25, 6);
  });
  it("مفتاح حركة يقع على جملة الذكر يتأخر إلى ما بعدها", () => {
    const k = safeKeys([{ a: wordAt("طين"), b: wordAt("طين") + 0.5, to: 1 }], BID_STILL)[0]!;
    expect(k.a).toBeCloseTo(BID_STILL[0]![1], 6);
  });
  it("(٥) سكون تام: الزمن الفعّال لا يتقدم في النافذة (الشمس والماء والموج)، وسطر الترجمة مكتمل قبلها ثابت فيها", () => {
    const [s, e] = BID_STILL[0]!;
    expect(effTime(s + 0.3)).toBeCloseTo(effTime(e - 0.1), 9);
    expect(effTime(e + 1) - effTime(e)).toBeCloseTo(1, 9);
    const a = bidLine(s)!, b = bidLine((s + e) / 2)!, c = bidLine(e)!;
    for (const x of [a, b, c]) { expect(x.si).toBe(BID_SACRED); expect(x.fade).toBe(1); }
    expect(bidLine(s - CAPTION_FADE - 1 / 60 - 0.01)!.si).toBe(BID_SACRED - 1);
  });
  it("(١)(٣)(٤)(٥) في الكود: نبرة كل كلمة من الإطار، والماء بانعكاس وموج ورمل مبلول، والشمس على مدار الحلقة، وحفنة الطين", () => {
    for (const re of [/<CaptionProbe /, /wordTones\(/, /delayRender\(/, /new Reflector\(/, /swash\(te\)/, /uLevel/, /sunAt\(t\)/, /useClayHandful\(\)/, /CLAY_AT/]) expect(world, String(re)).toMatch(re);
    // لا يتحرك الماء ولا الشمس بالزمن المطلق
    expect(strip(world)).not.toMatch(/swash\(t\)|offset\.set\(t /);
  });
  it("(٢) خامات حجر ورمل وطبقات حقيقية من Poly Haven (CC0)، مسجلة بمصدرها، وموجودة في public", () => {
    const ids = [...world.matchAll(/"(dafatir-bid-[a-z0-9-]+)"/g)].map((m) => m[1]!);
    expect(new Set(ids).size).toBe(21);
    for (const id of ids) {
      const a = ASSETS.find((x) => x.id === id);
      expect(a, id).toBeTruthy();
      expect(a!.license).toBe("CC0");
      expect(a!.source).toBe("polyhaven");
      expect(existsSync(`public/${a!.file}`), a!.file).toBe(true);
    }
    // لا حجارة منخفضة الأضلاع (عشرون وجهًا)
    expect(strip(world)).not.toMatch(/IcosahedronGeometry/);
  });
  it("الجولة ٣: رمل شاحب فاتح (حبر داكن عليه)، وحجارة حقيقية متنوعة لا يتشابه منها اثنان، وحفنة طين تُقرأ طينًا", async () => {
    const m = await import("../src/remotion/dafatir/bidayat/StoneLines");
    expect(m.SAND_INK).toBe(0.5);
    expect(world).toMatch(/uPale/);
    // أنواع الحجارة كلها حاضرة، ولا يتجاور نوعان متماثلان كثيرًا، ولا حجران بالشبكة نفسها
    const geos = Array.from({ length: 30 }, (_, i) => m.stoneGeometry(i, 31));
    expect(new Set(geos.map((g) => g.kind)).size).toBe(m.STONE_KINDS.length);
    const sig = geos.map((g) => { const p = g.g.attributes.position!; return [g.minY, g.maxY, p.getX(7), p.getZ(91)].map((x) => x.toFixed(4)).join(","); });
    expect(new Set(sig).size).toBe(sig.length);
    // الحجر المكسور: وجه مسطح (رؤوس كثيرة على مستوى القطع)، لا كرة منفوخة
    expect(world).toMatch(/chips/);
    // الطين: أثر أصابع ولون رطب إلى حافة أجف، ولمعة بلل، وحلقة رطوبة وفتات
    const clay = m.clayGeometry();
    expect(clay.attributes.color).toBeTruthy();
    for (const re of [/clearcoat=/, /useDampRing\(\)/, /CLAY_CRUMBS\.map/, /CLAY_DENTS/, /clayCrack/]) expect(world, String(re)).toMatch(re);
  }, 60_000);
  it("خيط الزمن وعقدته، و«ثابت» و«رواية» و«تقدير» و«لا نعلم»، وطبقات تحت الرمل، وصوت مع كل حركة", () => {
    for (const re of [/<RedThread /, /knot=\{p\(knotK\)\}/, /"ثابت"/, /"رواية"/, /"تقدير"/, /"لا نعلم"/, /LAYERS\.map/, /<DepthOfField /, /SFX\("stamp"\)/, /<BidCaption /]) expect(world, String(re)).toMatch(re);
  });
  it("لا تصوير لأحد (لا شخص ولا هيئة ولا ظل إنسان)، ولا أدوات القوالب الشائعة ولا عشوائية", () => {
    const banned = [/\bPerson\b|figureShapes|silhouette|armPose/, /boxShadow|drop-shadow/, /backdrop-?[Ff]ilter/, /\bInter\b|Poppins/, /sparkle|lens.?flare|glow|Bloom/i, /spring\(|bounce/i, /@remotion\/transitions/, /Math\.random|Date\.now/, /\b(eye|mouth|nose|face)s?\b/i];
    expect(files.flatMap(({ f, code }) => banned.filter((re) => re.test(strip(code))).map((re) => `${f}: ${re}`))).toEqual([]);
  });
  it("الضوضاء ثنائية البعد", () => {
    const line = [[0, 2], [1, 0.2], [2, -1.6]].map(([x, z]) => n2(3, x!, z!).toFixed(3));
    expect(new Set(line).size).toBe(3);
  });
});

describe("«البدايات»: اللقطات (D189)", () => {
  it("ست لقطات بأربعة أحجام على الأقل، ٢–٨ ث، والطبقات عند «لقد»، وحفنة الطين تبدأ قبل جملة الذكر وتمتد بعدها", async () => {
    const { stoneShots, stonePath } = await import("../src/remotion/dafatir/bidayat/StoneLines");
    const shots = stoneShots();
    expect(shots.map((x) => x.id)).toEqual(["horizon", "knot", "strata", "shore", "circles", "clay"]);
    expect(new Set(shots.map((x) => x.size)).size).toBeGreaterThanOrEqual(4);
    for (const x of shots.slice(0, -1)) { expect(x.b - x.a, x.id).toBeGreaterThanOrEqual(2); expect(x.b - x.a, x.id).toBeLessThanOrEqual(8); }
    expect(shots[2]!.a).toBeCloseTo(shotBounds().s2, 6);
    expect(shots[2]!.a).toBeLessThan(wordAt("روايات"));
    const last = shots[shots.length - 1]!;
    expect(last.a).toBeLessThan(BID_STILL[0]![0]);
    expect(last.b).toBeGreaterThan(BID_STILL[0]![1]);
    // تحت الرمل: الكاميرا تنتهي تحت سطح المكان
    expect(shots[2]!.to.target[1]).toBeLessThan(0);
    const sp = stonePath().slice(11);
    const r = sp.map(([x, z]) => Math.hypot(x - 0.6, z + 1.6));
    expect(r[r.length - 1]!).toBeLessThan(r[0]! / 3);
  });
  it("الشمس من الفجر إلى الضحى، وتقف في السكون", async () => {
    const { sunAt } = await import("../src/remotion/dafatir/bidayat/StoneLines");
    const { BID_SEC } = await import("../src/remotion/dafatir/bidayat/common");
    expect(sunAt(0)).toBe(0);
    expect(sunAt(BID_SEC)).toBeCloseTo(1, 9);
    const [s, e] = BID_STILL[0]!;
    expect(sunAt(s + 0.2)).toBeCloseTo(sunAt(e - 0.05), 9);
    expect(sunAt(e + 2)).toBeGreaterThan(sunAt(e));
  });
});
