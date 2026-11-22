#!/usr/bin/env node
// D158 الخطوة ٤: نسخ بديلة للمؤثرات المتكررة بالكود، مجانًا (لا توليد ولا مفتاح خدمة).
// من المؤثر المعالَج نفسه (assets/sfx/<id>.mp3) تُصنع نسختان: <id>--v2.mp3 و<id>--v3.mp3 بطبقة أخفض وأعلى قليلًا
// وميل خفيف في النبرة (كجسم آخر من النوع نفسه)، ثم تُعاد إلى علو دورها وسقف ذروته (brand/sfxMastering.ts).
// أصوات الجو لا نسخ لها (تلتف طويلة فلا يُسمع تكرارها). الوصفات في src/plan/sfxVariants.ts (VARIANT_RECIPES).
// node scripts/sfx-variants.mjs            كل المؤثرات غير الجو
// node scripts/sfx-variants.mjs page-turn  مؤثرات بعينها
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
const run = promisify(execFile);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dir = path.join(root, "assets", "sfx");
const lib = await readFile(path.join(root, "brand", "sfx.ts"), "utf8");
const defs = [...lib.matchAll(/id: "([^"]+)", nameAr: "[^"]*", category: "([^"]+)"/g)].map((m) => ({ id: m[1], category: m[2] }));
const m = await readFile(path.join(root, "brand", "sfxMastering.ts"), "utf8");
const set = (name) => new Set([...(new RegExp(`export const ${name} = new Set\\(\\[([^\\]]+)\\]`).exec(m)[1].matchAll(/"([^"]+)"/g))].map((x) => x[1]));
const AMB = set("AMBIENCE"), IMP = set("IMPACT");
const num = (k, role) => +new RegExp(`${k}: \\{[^}]*${role}: (-?[\\d.]+)`).exec(m)[1];
const roleOf = (d) => (AMB.has(d.id) ? "ambience" : IMP.has(d.id) ? "impact" : d.category === "transition" ? "transition" : "action");
const v = await readFile(path.join(root, "src", "plan", "sfxVariants.ts"), "utf8");
const recipes = [...v.matchAll(/\{ suffix: "([^"]+)", pitch: ([\d.]+), tilt: (-?[\d.]+) \}/g)].map((x) => ({ suffix: x[1], pitch: +x[2], tilt: +x[3] }));
if (!recipes.length) throw Error("لا وصفات في src/plan/sfxVariants.ts");
const TP = -3, SR = 48000;
const ff = (args) => run("ffmpeg", ["-hide_banner", "-nostats", "-y", ...args], { maxBuffer: 32 << 20 });
// هامش ٠٫٨ dB: ترميز mp3 يرفع الذروة الحقيقية قليلًا فوق حد المحدِّد
const limit = `alimiter=limit=${Math.pow(10, (TP - 0.8) / 20).toFixed(4)}:attack=1:release=50:level=false`;
const level = async (f) => {
  const e = (await ff(["-i", f, "-af", "ebur128,astats=metadata=0", "-f", "null", "-"]).catch((x) => x)).stderr;
  const s = e.slice(e.lastIndexOf("Summary"));
  const lufs = +(/I:\s+(-?[\d.]+) LUFS/.exec(s) ?? [, -99])[1];
  return lufs > -70 ? lufs : +(/Overall[\s\S]*?RMS level dB: (-?[\d.]+)/.exec(e) ?? [, -99])[1];
};
const want = process.argv.slice(2);
for (const d of defs) {
  if (want.length && !want.includes(d.id)) continue;
  const role = roleOf(d);
  const src = path.join(dir, `${d.id}.mp3`);
  if (role === "ambience" || !existsSync(src)) continue;
  const I = num("lufs", role);
  for (const r of recipes) {
    const out = path.join(dir, `${d.id}--${r.suffix}.mp3`);
    // الطبقة: تسريع العينات (asetrate) ثم إعادة المعدل؛ والميل: رف منخفض وعالٍ متعاكسان حول ١٫٢ كيلوهرتز
    const color = `asetrate=${Math.round(SR * r.pitch)},aresample=${SR},lowshelf=f=300:g=${r.tilt},highshelf=f=4000:g=${-r.tilt}`;
    let gain = 0;
    for (let k = 0; k < 3; k++) {
      await ff(["-i", src, "-af", `${color},volume=${gain.toFixed(2)}dB,${limit},aresample=${SR}`, "-ar", String(SR), "-c:a", "libmp3lame", "-b:a", "192k", "-map_metadata", "-1", out]);
      const off = I - (await level(out));
      if (Math.abs(off) <= 0.5) break;
      gain += off;
    }
  }
  console.log(`✓ ${d.id} (${role}) ${recipes.map((r) => r.suffix).join("، ")}`);
}
