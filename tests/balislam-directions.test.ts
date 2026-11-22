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
    const banned = [/boxShadow|textShadow|drop-shadow/, /backdrop-?[Ff]ilter/, /\bInter\b|Poppins/, /particle|sparkle|lens.?flare|glow|Bloom/i, /spring\(|bounce/i, /@remotion\/transitions/, /Math\.random|Date\.now/, /\b(eye|mouth|nose)s?\b/i];
    expect(files.flatMap(({ f, code }) => banned.filter((re) => re.test(code.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""))).map((re) => `${f}: ${re}`))).toEqual([]);
  });
});
