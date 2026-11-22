/**
 * «زبدة الكتب» — اتجاهات المقارنة الثلاثة بثري دي (لا قالب قبل اختيار المالك): الأفكار آلات، ومطبعة بولاق، وغرفة القراءة.
 * الألوان من «القلم المميِّز» وحدها، والفسفوري للفكرة وحدها، والسكون المقصود يغطي جملة ذكر الله، ولا أدوات القوالب الشائعة.
 */
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { APPROVED_IDENTITIES } from "../brand/identity/approved";
import { isSacredSentence } from "../src/plan/sceneCues";
import { IDEA, ZB, ZWORDS, Z_STILL } from "../src/remotion/zubdat/directions/common";

const DIR = "src/remotion/zubdat/directions";
const files = readdirSync(DIR).map((f) => ({ f, code: readFileSync(`${DIR}/${f}`, "utf8") }));

describe("اتجاهات «زبدة الكتب» للمقارنة", () => {
  it("كل لون من هوية «القلم المميِّز» المعتمدة", () => {
    const a = APPROVED_IDENTITIES["zubdat-alkutub"]!;
    const ok = new Set([...a.palette.map((p) => p.hex), ...a.signature, ...a.derived].map((x) => x.toUpperCase()));
    const bad = files.flatMap(({ f, code }) => [...code.matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m) => m[0].toUpperCase()).filter((c) => !ok.has(c)).map((c) => `${f}: ${c}`));
    expect(bad).toEqual([]);
  });
  it("الفسفوري للفكرة وحدها في «غرفة القراءة» و«بولاق»، ولا فسفوري في عالم «الأفكار آلات» (D188)", () => {
    const count = (f: string) => (files.find((x) => x.f === f)!.code.match(/ZB\.fluo/g) ?? []).length;
    expect({ common: count("common.tsx"), machine: count("IdeaMachine.tsx"), bulaq: count("BulaqPress.tsx"), reading: count("ReadingRoom.tsx") })
      .toEqual({ common: 2, machine: 0, bulaq: 0, reading: 1 });
    expect(ZB.fluo).toBe("#E8F542");
    expect(ZWORDS.some((w) => w.w.startsWith(IDEA))).toBe(true);
  });
  it("السكون المقصود يغطي جملة ذكر الله كلها، وهي وحدها المقدسة", () => {
    const sacred = ZWORDS.slice(10);
    expect(isSacredSentence(sacred.map((w) => w.w).join(" "))).toBe(true);
    expect(isSacredSentence(ZWORDS.slice(0, 10).map((w) => w.w).join(" "))).toBe(false);
    expect(Z_STILL[0]![0]).toBeCloseTo(sacred[0]!.s - 0.25, 6);
    expect(Z_STILL[0]![1]).toBeCloseTo(sacred[sacred.length - 1]!.e + 0.25, 6);
  });
  it("لا أدوات القوالب الشائعة ولا عشوائية", () => {
    const banned = [/boxShadow|textShadow|drop-shadow/, /backdrop-?[Ff]ilter/, /\bInter\b|Poppins/, /particle|sparkle|lens.?flare|glow|Bloom/i, /spring\(|bounce/i, /@remotion\/transitions/, /Math\.random|Date\.now/];
    expect(files.flatMap(({ f, code }) => banned.filter((re) => re.test(code.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""))).map((re) => `${f}: ${re}`))).toEqual([]);
  });
});

describe("«الأفكار آلات» بأسلوب مخطوطة الجزري (D188، D190) ومعايير «الحِرفة» (D189)", () => {
  it("ألوان المخطوطة المقيّدة لهذا العالم، والأسماء بالأحمر بخط النسخ، وأربع لقطات ٢–٦ ث بلا تكرار", async () => {
    const { JAZARI, machineShots } = await import("../src/remotion/zubdat/directions/IdeaMachine");
    const a = APPROVED_IDENTITIES["zubdat-alkutub"]!;
    for (const hex of [JAZARI.red, JAZARI.green, JAZARI.gold, JAZARI.wood]) expect(a.restricted?.some((r) => r.hex === hex && r.useAr.includes("الأفكار آلات")), hex).toBe(true);
    const code = files.find((x) => x.f === "IdeaMachine.tsx")!.code;
    expect(code).toMatch(/fillStyle = J\.red;[^\n]*font = `bold \$\{big \? 150 : 100\}px Amiri`/);
    const shots = machineShots();
    expect(new Set(shots.map((x) => x.id)).size).toBe(shots.length);
    expect(new Set(shots.map((x) => x.size)).size).toBe(4);
    for (const x of shots) expect(x.b - x.a, x.id).toBeGreaterThanOrEqual(2);
  });
});
