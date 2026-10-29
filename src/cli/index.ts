import path from "node:path";
import { readFile } from "node:fs/promises";
import { Command } from "commander";
import { parseScript } from "../script/parse";
import { checkScript } from "../script/check";
import { formatReport } from "../script/report";
import { createEpisode, resolveScriptPath } from "../script/episodes";
import { projectRoot } from "../config/paths";
import type { Domain } from "../../brand/themes";

const program = new Command();

program
  .name("bal")
  .description("منظومة إنتاج قناة بالإسلام")
  .helpOption("-h, --help", "عرض المساعدة")
  .showHelpAfterError();

program
  .command("new")
  .description("إنشاء مجلد حلقة جديدة بقالب السكريبت")
  .argument("<episode>", "رقم الحلقة من ثلاث خانات، مثل 002")
  .argument("<slug>", "اسم مختصر بالإنجليزية، مثل family-conflict")
  .requiredOption("-d, --domain <domain>", "المجال: psychology | family | money | knowledge")
  .option("-t, --title <title>", "عنوان الحلقة (سؤال)")
  .action(async (episode: string, slug: string, opts: { domain: Domain; title?: string }) => {
    const file = await createEpisode({ episode, slug, domain: opts.domain, title: opts.title });
    console.log(`أُنشئت الحلقة: ${path.relative(projectRoot, file)}`);
    console.log(`بعد الكتابة: bal check ${episode}`);
  });

program
  .command("check")
  .description("فحص السكريبت قبل صرف أي رصيد")
  .argument("<episode>", "رقم الحلقة (001) أو مسار السكريبت")
  .option("--json", "إخراج النتيجة بصيغة JSON")
  .action(async (episode: string, opts: { json?: boolean }) => {
    const file = await resolveScriptPath(episode);
    const source = await readFile(file, "utf8");
    const result = checkScript(parseScript(source, file));
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else console.log(formatReport(path.relative(projectRoot, file), result));
    process.exitCode = result.ok ? 0 : 1;
  });

program
  .command("stills")
  .description("رندر لوحات الهوية (صورة لكل ثيم بكل مقاس) للتحقق البصري")
  .option("--theme <theme>", "ثيم واحد فقط: paper | family | night | warm")
  .action(async (opts: { theme?: string }) => {
    const { renderBrandStills } = await import("../render/stills");
    const files = await renderBrandStills({ theme: opts.theme, onProgress: (m) => console.log(m) });
    console.log(`تم: ${files.length} صورة في ${path.relative(projectRoot, path.dirname(files[0] ?? "renders/brand/x"))}`);
  });

program
  .command("elements")
  .description("تصدير مكتبة العناصر: SVG لكل ثيم + manifest.json + كتالوج HTML")
  .action(async () => {
    const { exportElements } = await import("../elements/export");
    const r = await exportElements();
    console.log(`تم: ${r.elements} عنصرًا، ${r.files} ملفًا. الكتالوج: ${path.relative(projectRoot, r.catalog)}`);
  });

program
  .command("preview")
  .description("رندر معاينة القوالب: bal preview reel-paper-landscape، أو --stills 30,90 للقطات ثابتة")
  .argument("<prefix>", "بادئة معرّف التكوين")
  .option("--stills <frames>", "أرقام إطارات مفصولة بفواصل")
  .action(async (prefix: string, opts: { stills?: string }) => {
    const { renderPreviews } = await import("../render/previews");
    const stills = opts.stills ? opts.stills.split(",").map(Number) : undefined;
    const files = await renderPreviews({ prefix, stills, onProgress: (m) => console.log(m) });
    console.log(`تم: ${files.length} ملف في renders/previews`);
  });

program
  .command("plan")
  .description("توليد خطة المشاهد plan.json من السكريبت (تُحفظ تعديلاتك اليدوية)")
  .argument("<episode>", "رقم الحلقة")
  .action(async (episode: string) => {
    const { regeneratePlan } = await import("../plan/io");
    const plan = await regeneratePlan(episode);
    const n = plan.chapters.reduce((a, c) => a + c.scenes.length, 0);
    console.log(`الخطة جاهزة: ${plan.chapters.length} فصول، ${n} مشهدًا.`);
  });

program
  .command("render")
  .description("رندر الحلقة من plan.json")
  .argument("<episode>", "رقم الحلقة")
  .option("--portrait", "النسخة العمودية 9:16")
  .option("--chapter <n>", "فصل واحد فقط (شورت)")
  .action(async (episode: string, opts: { portrait?: boolean; chapter?: string }) => {
    const { renderEpisode } = await import("../render/episode");
    let last = -1;
    const out = await renderEpisode({
      episode,
      orientation: opts.portrait ? "portrait" : "landscape",
      chapter: opts.chapter ? Number(opts.chapter) : undefined,
      onProgress: (pct, msg) => {
        const step = Math.floor(pct / 10) * 10;
        if (step !== last) {
          last = step;
          console.log(`PROGRESS ${pct} ${msg}`);
        }
      },
    });
    console.log(`DONE ${path.relative(projectRoot, out)}`);
  });

program
  .command("app")
  .description("فتح استوديو بالإسلام في المتصفح")
  .action(async () => {
    const { spawn } = await import("node:child_process");
    spawn("npx", ["vite", "--config", "app/vite.config.ts"], { cwd: projectRoot, stdio: "inherit" });
  });

program.parseAsync().catch((err: Error) => {
  console.error(`خطأ: ${err.message}`);
  process.exitCode = 1;
});
