/**
 * D228: ستوري بورد القوالب الجديدة بانتظار اختيار المالك. كل مجلد تحت ~/Desktop/للمراجعة/ستوري-بورد/ فيه storyboard.json:
 * [{ scene, variant, file, title, motion, why }] (أول ستة مشاهد، ٢–٣ نماذج لكل مشهد، صورة ثابتة وسطر يشرح الحركة).
 * يقرؤها الاستوديو في «بانتظارك» مع حالة كل قالب من templates/approvals.json، ويعتمد المالك نموذجًا منها.
 */
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export type StoryboardVariant = { scene: number; variant: string; file: string; title?: string; motion?: string; why?: string };
export type Storyboard = { folder: string; variants: StoryboardVariant[]; readme: boolean; issues: string[] };

export const storyboardsRoot = (home = os.homedir()) => path.join(home, "Desktop", "للمراجعة", "ستوري-بورد");

const SAFE = /^[^/\\]+$/;
export const listStoryboards = (root = storyboardsRoot()): Storyboard[] => {
  if (!existsSync(root)) return [];
  const out: Storyboard[] = [];
  for (const folder of readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
    const f = path.join(root, folder, "storyboard.json");
    if (!existsSync(f)) continue;
    const issues: string[] = [];
    let variants: StoryboardVariant[] = [];
    try {
      const raw = JSON.parse(readFileSync(f, "utf8"));
      variants = (Array.isArray(raw) ? raw : raw.variants ?? []).filter((v: StoryboardVariant) => v && SAFE.test(String(v.file ?? "")));
    } catch { issues.push("storyboard.json تالف"); }
    const scenes = [...new Set(variants.map((v) => v.scene))];
    if (variants.length && scenes.length < 6) issues.push(`فيه ${scenes.length} مشاهد، والقاعدة أول ستة`);
    for (const s of scenes) { const n = variants.filter((v) => v.scene === s).length; if (n < 2 || n > 3) issues.push(`المشهد ${s}: ${n} نموذج، والقاعدة ٢–٣`); }
    for (const v of variants) if (!existsSync(path.join(root, folder, v.file))) issues.push(`الصورة ناقصة: ${v.file}`);
    out.push({ folder, variants, readme: existsSync(path.join(root, folder, "اقرأني.md")), issues });
  }
  return out;
};

/** مسار صورة نموذج داخل مجلد الستوري بورد وحده (لا خروج منه) */
export const storyboardImage = (folder: string, file: string, root = storyboardsRoot()): string | null => {
  if (!SAFE.test(folder) || !SAFE.test(file) || !/\.(png|jpe?g|webp)$/i.test(file)) return null;
  const p = path.join(root, folder, file);
  if (!existsSync(p)) return null;
  const real = realpathSync(p);
  return real.startsWith(realpathSync(root) + path.sep) ? real : null;
};
