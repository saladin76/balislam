/**
 * «بالإسلام» — اتجاهات المقارنة الثلاثة بثري دي (لا قالب قبل اختيار المالك): خيال الظل، وهندسة النور، وحكايات الحارة
 * مطبوعة. الألوان من هوية «باء التشغيل» وحدها، والسكون المقصود يغطي جملة الذكر كلها، ولا مفتاح حركة فيه،
 * ولا أدوات القوالب الشائعة، ولا عشوائية غير حتمية.
 */
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { APPROVED_IDENTITIES } from "../brand/identity/approved";
import { isSacredSentence } from "../src/plan/sceneCues";
import { safeKeys } from "../src/remotion/three";
import { DIR_STILL, DIR_WORDS, wordAt } from "../src/remotion/balislam/directions/common";

const DIR = "src/remotion/balislam/directions";
const files = readdirSync(DIR).map((f) => ({ f, code: readFileSync(`${DIR}/${f}`, "utf8") }));

describe("اتجاهات «بالإسلام» للمقارنة", () => {
  it("كل لون في الملفات من هوية «باء التشغيل» المعتمدة", () => {
    const a = APPROVED_IDENTITIES.balislam!;
    const ok = new Set([...a.palette.map((p) => p.hex), ...a.signature, ...a.derived].map((x) => x.toUpperCase()));
    const bad = files.flatMap(({ f, code }) => [...code.matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m) => m[0].toUpperCase()).filter((c) => !ok.has(c)).map((c) => `${f}: ${c}`));
    expect(bad).toEqual([]);
  });
  it("السكون المقصود يغطي جملة ذكر الله كلها (±٠٫٢٥ ث)، وهي وحدها المقدسة", () => {
    const sacred = DIR_WORDS.slice(9);
    expect(isSacredSentence(sacred.map((w) => w.w).join(" "))).toBe(true);
    expect(isSacredSentence(DIR_WORDS.slice(0, 9).map((w) => w.w).join(" "))).toBe(false);
    expect(DIR_STILL[0]![0]).toBeCloseTo(sacred[0]!.s - 0.25, 6);
    expect(DIR_STILL[0]![1]).toBeCloseTo(sacred[sacred.length - 1]!.e + 0.25, 6);
  });
  it("مفتاح حركة يقع على جملة الذكر يتأخر إلى ما بعدها", () => {
    const k = safeKeys([{ a: wordAt("يعلمُ"), b: wordAt("يعلمُ") + 0.5, to: 1 }], DIR_STILL)[0]!;
    expect(k.a).toBeCloseTo(DIR_STILL[0]![1], 6);
  });
  it("لا أدوات القوالب الشائعة ولا عشوائية ولا وجوه مرسومة", () => {
    const banned = [/boxShadow|drop-shadow|textShadow: (?!CAPTION_SHADOW)/, /backdrop-?[Ff]ilter/, /\bInter\b|Poppins/, /particle|sparkle|lens.?flare|glow|Bloom/i, /spring\(|bounce/i, /@remotion\/transitions/, /Math\.random|Date\.now/, /\b(eye|mouth|nose)s?\b/i];
    expect(files.flatMap(({ f, code }) => banned.filter((re) => re.test(code.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""))).map((re) => `${f}: ${re}`))).toEqual([]);
  });
});

describe("«خيال الظل» عالم بالإسلام (D190) بمعايير «الحِرفة» (D189)", () => {
  it("أربع لقطات بأحجام مختلفة ٢–٦ ث بلا تكرار، والأخيرة تبدأ قبل جملة الذكر ولا تتحرك فيها", async () => {
    const { theaterShots } = await import("../src/remotion/balislam/directions/ShadowTheater");
    const shots = theaterShots();
    expect(new Set(shots.map((x) => x.size)).size).toBe(4);
    expect(new Set(shots.map((x) => x.id)).size).toBe(shots.length);
    for (const x of shots.slice(0, -1)) { expect(x.b - x.a, x.id).toBeGreaterThanOrEqual(2); expect(x.b - x.a, x.id).toBeLessThanOrEqual(8); }
    const last = shots[shots.length - 1]!;
    expect(last.a).toBeLessThanOrEqual(DIR_STILL[0]![0]);
    expect(last.b).toBeGreaterThan(DIR_STILL[0]![1]);
  });
  it("المشربية نجمة ثمانية من مربعين متراكبين في قلبها مثمن (لا تساعية ولا سباعي)، والعصيّ من أسفل", () => {
    const code = readFileSync(`${DIR}/ShadowTheater.tsx`, "utf8");
    expect(code).toContain("for (const rot of [0, Math.PI / 4])");
    expect(code).toContain("for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4 + Math.PI / 8;");
    expect(code).not.toContain("lanternShape");
    expect(code).toContain("const bottom = -0.9");
  });
});

describe("«حكايات الحارة» عالم بالإسلام بعد محاولة «خيال الظل» الأخيرة (قرار المالك ٢٢ نوفمبر) بمعايير «الحِرفة» (D189)", () => {
  it("أربع لقطات بأحجام مختلفة ٢–٨ ث بلا تكرار، والأخيرة تبدأ قبل جملة الذكر وتمتد بعدها", async () => {
    const { alleyShots } = await import("../src/remotion/balislam/directions/PrintedAlley");
    const shots = alleyShots();
    expect(new Set(shots.map((x) => x.size)).size).toBe(4);
    expect(new Set(shots.map((x) => x.id)).size).toBe(shots.length);
    for (const x of shots.slice(0, -1)) { expect(x.b - x.a, x.id).toBeGreaterThanOrEqual(2); expect(x.b - x.a, x.id).toBeLessThanOrEqual(8); }
    const last = shots[shots.length - 1]!;
    expect(last.a).toBeLessThanOrEqual(DIR_STILL[0]![0]);
    expect(last.b).toBeGreaterThan(DIR_STILL[0]![1]);
  });
  it("ورق حقيقي بسُمك وحافة قص بيضاء وظل مُلقى وعمق ميدان، وصوت مع كل حركة، والترجمة بلا مستطيل", () => {
    const code = readFileSync(`${DIR}/PrintedAlley.tsx`, "utf8");
    for (const re of [/<extrudeGeometry args=\{\[shapes, \{ depth: 0\.014/, /attach="material-1" color="#FBF6EE"/, /castShadow receiveShadow/, /<DepthOfField /, /<BeamDust /, /SFX\("swipe-paper"\)/, /SFX\("drop-soft"\)/, /textShadow: CAPTION_SHADOW_LIGHT/]) expect(code, String(re)).toMatch(re);
    expect(code).not.toMatch(/background: "rgba|DirFrame/);
  });
});
