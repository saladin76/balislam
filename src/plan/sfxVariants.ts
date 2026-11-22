import type { Plan } from "./types";

/**
 * D158 الخطوة ٤: المؤثر المتكرر في الحلقة لا يُسمع نسخةً واحدة (عناصر مكررة آليًا تخالف «الإيقاع البشري»).
 * لكل مؤثر غير الجو نسختان مصنوعتان بالكود من المعالَج نفسه (scripts/sfx-variants.mjs، مجانًا): طبقة أخفض وأعلى قليلًا
 * وميل نبرة خفيف، بعلو دوره نفسه. الرندر يدور عليها بترتيب ظهور المؤثر في الحلقة (الأصل ثم v2 ثم v3 ثم الأصل…)،
 * حتميًا بلا عشوائية، فالحلقة نفسها تخرج نفسها في كل رندر. خالص: لا ملفات (يصلح لحزمة Remotion، KI-093).
 */
export const VARIANT_RECIPES = [
  { suffix: "v2", pitch: 0.94, tilt: 1.5 },
  { suffix: "v3", pitch: 1.06, tilt: -1.5 },
] as const;

export const variantFile = (id: string, suffix: string) => `${id}--${suffix}.mp3`;

/**
 * اسم ملف كل مؤثر في الخطة بمفتاح «المشهد#الترتيب في المشهد»: الظهور k للمؤثر في الحلقة يأخذ النسخة k بالتدوير
 * على [الأصل، ونسخه الموجودة]. variants: لكل مؤثر لاحقات نسخه الموجودة فعلًا.
 */
export const sfxFileNames = (plan: Plan, variants: Record<string, readonly string[]> = {}): Map<string, string> => {
  const out = new Map<string, string>();
  const seen = new Map<string, number>();
  for (const s of plan.chapters.flatMap((c) => c.scenes)) s.sfx.forEach((x, i) => {
    const k = seen.get(x.id) ?? 0;
    seen.set(x.id, k + 1);
    const pool = [`${x.id}.mp3`, ...(variants[x.id] ?? []).map((v) => variantFile(x.id, v))];
    out.set(`${s.id}#${i}`, pool[k % pool.length]!);
  });
  return out;
};
