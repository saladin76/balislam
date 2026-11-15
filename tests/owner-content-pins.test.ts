/**
 * حارس «لا تثبيت لمحتوى المالك في الاختبارات» (KI-068، D137؛ بعد KI-063 وD133).
 *
 * محتوى الحلقة الحي (plan.json وscript.md وtashkeel.md وtone-map.json…، scripts/contentPaths.mjs) يحرّره المالك
 * في الاستوديو ويُحفظ في main ببوابة المحتوى وحدها، بلا اختبارات (D101). فاختبار يقرأ هذا المحتوى ويقارنه بقيمة
 * حرفية (مدة، عدد، قائمة آيات، نص) يُحمِّر main عند أول تعديل مشروع من المالك، ويرفض بعدها كل دفع كود.
 * المطلوب في هذه الاختبارات: عقد على المحتوى (تطابق الخطة والسكريبت، احترام قيمة المالك، حدود معقولة)، أو نسخة
 * محفوظة باسمها لا يحرّرها الاستوديو (versions/…، plan.v7.json) كما في D133.
 *
 * الحارس عدّاد لا يزيد (ratchet): لكل ملف اختبار يقرأ حلقة حقيقية عددُ مقارناته بقيم حرفية اليوم في
 * owner-content-pins.baseline.json. يُرفض أي ملف يزيد عدده؛ المقارنة الحرفية المقصودة على بيانات مصطنعة داخل
 * الاختبار نفسه تُعلَّم في سطرها بـ `// owner-pin-ok: السبب`. نقص العدد مسموح، ويُحدَّث الأساس بالأمر:
 *   BAL_UPDATE_PIN_BASELINE=1 npx vitest run tests/owner-content-pins.test.ts
 * (يُكتب الأساس بأرقام لا تزيد على السابقة أبدًا.)
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const BASELINE = path.join(root, "tests", "owner-content-pins.baseline.json");

/** حلقة حقيقية بمجلدها (لا مجلد مؤقت): channels/<القناة>/episodes/<رقم-الاسم> أو ثابت يُركّب منه */
const READS_REAL_EPISODE = /channels\/[a-z0-9-]+\/episodes\/\d{3}-[a-z0-9-]+|episodes\/\d{3}-[a-z0-9-]+/;
/** ملف محتوى يحرّره المالك (CONTENT_PATH_RES)؛ النسخ المحفوظة باسمها (versions/، plan.v7.json) ليست منها */
const OWNER_FILE = /(plan|publish|series|tone-map|review|sentence-pronunciations)\.json|(script|research|tashkeel)\.md/;
/** مقارنة بقيمة حرفية: رقم غير الصفر، أو نص، أو قائمة تبدأ بقيمة حرفية */
const LITERAL_PIN = /\.(toBe|toEqual|toStrictEqual|toBeCloseTo|toHaveLength)\(\s*(-?(?:[1-9]\d*(?:\.\d+)?|0\.\d+)\b|"[^"]+"|'[^']+'|`[^`$]+`|\[\s*(?:-?\d|"|'))/;

export const literalPins = (source: string): number =>
  source.split("\n").filter((l) => LITERAL_PIN.test(l) && !/owner-pin-ok:/.test(l)).length;

export const readsOwnerContent = (source: string): boolean =>
  READS_REAL_EPISODE.test(source) && OWNER_FILE.test(source);

const testFiles = (): string[] => {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== "fixtures" && e.name !== "node_modules") walk(p); }
      else if (/\.test\.tsx?$/.test(e.name)) out.push(path.relative(root, p).split(path.sep).join("/"));
    }
  };
  walk(path.join(root, "tests"));
  return out.sort();
};

describe("حارس تثبيت محتوى المالك في الاختبارات (KI-068)", () => {
  it("يكشف المقارنة الحرفية ويتجاوز المعلَّمة والصفر والقيم المنطقية", () => {
    expect(literalPins(`expect(dur).toBeCloseTo(2.6, 5);`)).toBe(1); // owner-pin-ok: مثال الحارس
    expect(literalPins(`expect(cites).toEqual(["البقرة 30"]);`)).toBe(1); // owner-pin-ok: مثال الحارس
    expect(literalPins(`expect(list).toHaveLength(23);`)).toBe(1); // owner-pin-ok: مثال الحارس
    expect(literalPins(`expect(x).toBe(3); // owner-pin-ok: بيانات مصطنعة`)).toBe(0);
    expect(literalPins(`expect(errs).toHaveLength(0);\nexpect(ok).toBe(true);\nexpect(a).toEqual([]);\nexpect(d).toBe(s.durationSec);`)).toBe(0);
    expect(readsOwnerContent(`const EP = "channels/dafatir-alzaman/episodes/001-adam-beginning";\nreadFileSync(\`\${EP}/plan.json\`)`)).toBe(true);
    expect(readsOwnerContent(`const dir = mkdtempSync("x"); writeFileSync(path.join(dir, "plan.json"), "{}")`)).toBe(false);
  });

  it("لا يزيد عدد المقارنات الحرفية في اختبار يقرأ محتوى حلقة حقيقية (عقد لا تثبيت)", () => {
    const baseline: Record<string, number> = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, "utf8")) : {};
    const now: Record<string, number> = {};
    for (const f of testFiles()) {
      if (f === "tests/owner-content-pins.test.ts") continue;
      const src = readFileSync(path.join(root, f), "utf8");
      if (!readsOwnerContent(src)) continue;
      const n = literalPins(src);
      if (n) now[f] = n;
    }
    const grown = Object.entries(now).filter(([f, n]) => n > (baseline[f] ?? 0))
      .map(([f, n]) => `${f}: ${n} مقارنة حرفية (الأساس ${baseline[f] ?? 0})`);
    if (process.env.BAL_UPDATE_PIN_BASELINE === "1") {
      // لا يرفع الأساس أبدًا: ما زاد يبقى مرفوضًا حتى يُكتب عقدًا أو يُعلَّم
      const next = Object.fromEntries(Object.entries(now).map(([f, n]) => [f, Math.min(n, baseline[f] ?? n)]).sort((x, y) => String(x[0]).localeCompare(String(y[0]))));
      writeFileSync(BASELINE, JSON.stringify(next, null, 2) + "\n");
    }
    expect(grown, "اختبار جديد يثبّت محتوى يحرّره المالك؛ اكتبه عقدًا على المحتوى (KI-068، D137) أو علّم المقارنة على بيانات مصطنعة بـ «// owner-pin-ok: السبب»").toEqual([]);
  });
});
