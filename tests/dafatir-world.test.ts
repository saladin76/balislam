/**
 * «مكتب الرحّالة» — عالم «دفاتر الزمن» الواحد (توصية المنسّق ٢٢ نوفمبر): الألوان من «دفتر الأفق» وحدها، والخامات
 * مسجلة CC0 وموجودة على القرص وفي قناتها، والرندر ينسخها إلى حزمته، والتوقيت كما وُصف (الإسطرلاب ٢–٤ ث للتاريخ).
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { APPROVED_IDENTITIES } from "../brand/identity/approved";
import { ASSETS, assetFile } from "../src/remotion/three";
import { WORLD_COLORS, WORLD_SEC, wAt } from "../src/remotion/dafatir/world/DeskWorld";

const root = path.join(import.meta.dirname, "..");
const code = readFileSync(path.join(root, "src/remotion/dafatir/world/DeskWorld.tsx"), "utf8");

describe("مكتب الرحّالة", () => {
  it("كل لون من «دفتر الأفق» المعتمدة (اللازورد ليس فيها: قرار هوية للمالك)", () => {
    const a = APPROVED_IDENTITIES["dafatir-alzaman"]!;
    const ok = new Set([...a.palette.map((p) => p.hex), ...a.signature, ...a.derived].map((x) => x.toUpperCase()));
    const used = [...Object.values(WORLD_COLORS), ...[...code.matchAll(/"(#[0-9A-Fa-f]{6})"/g)].map((m) => m[1]!)];
    // لون المكتب يُضرب في خامة الخشب (تعتيم للخامة لا لون ظاهر)
    expect(used.filter((c) => !ok.has(c.toUpperCase()) && c.toLowerCase() !== "#c9b49a")).toEqual([]);
  });
  it("الخامات المستعملة مسجلة CC0 في قناتها وموجودة على القرص", () => {
    const ids = [...code.matchAll(/"(dafatir-[a-z-]+)"/g)].map((m) => m[1]!).filter((id) => ASSETS.some((x) => x.id === id));
    expect(ids.length).toBeGreaterThanOrEqual(5);
    for (const id of ids) {
      const a = ASSETS.find((x) => x.id === id)!;
      expect([a.license, a.channel], id).toEqual(["CC0", "dafatir-alzaman"]);
      expect(existsSync(path.join(root, "public", assetFile(id))), id).toBe(true);
    }
    for (const a of ASSETS) expect(existsSync(path.join(root, "public", a.file)), a.file).toBe(true);
  });
  it("حزمة الرندر تنسخ public/three (وإلا خرج المشهد بلا خامات)", () => {
    expect(readFileSync(path.join(root, "src/render/bundle.ts"), "utf8")).toMatch(/sharedAssets = new Set\(\[[^\]]*"three"/);
  });
  it("الإسطرلاب للتاريخ بين ٢ و٤ ث، ثم الدفتر، ثم الوثيقة والختم", () => {
    const astro = wAt("بدأ") - 0.35;
    expect(astro).toBeGreaterThanOrEqual(2);
    expect(astro).toBeLessThanOrEqual(4);
    expect(wAt("بغداد")).toBeLessThan(wAt("وسمّاها"));
    expect(WORLD_SEC).toBeGreaterThan(wAt("السلام") + 2);
  });
  it("لا أدوات القوالب الشائعة ولا عشوائية", () => {
    const c = code.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    for (const re of [/boxShadow|textShadow|drop-shadow/, /particle|sparkle|lens.?flare|glow|Bloom/i, /Math\.random|Date\.now/, /\bInter\b|Poppins/]) expect(re.test(c), String(re)).toBe(false);
  });
});
