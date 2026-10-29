import path from "node:path";
import { readFile } from "node:fs/promises";
import { Command } from "commander";
import { parseScript } from "../script/parse";
import { checkForChannel } from "../script/checkChannel";
import { formatReport } from "../script/report";
import { createEpisode, resolveScriptPath } from "../script/episodes";
import { projectRoot } from "../config/paths";

const program = new Command();

program
  .name("bal")
  .description("منظومة إنتاج قناة بالإسلام")
  .helpOption("-h, --help", "عرض المساعدة")
  .showHelpAfterError()
  .option("-c, --channel <id>", "القناة (الافتراضية في config.json)")
  .hook("preAction", (cmd) => {
    const ch = cmd.opts<{ channel?: string }>().channel;
    if (ch) process.env.BAL_CHANNEL = ch;
  });

program
  .command("new")
  .description("إنشاء مجلد حلقة جديدة بقالب السكريبت")
  .argument("<episode>", "رقم الحلقة من ثلاث خانات، مثل 002")
  .argument("<slug>", "اسم مختصر بالإنجليزية، مثل family-conflict")
  .requiredOption("-d, --domain <domain>", "المجال كما في channel.json للقناة (لبالإسلام: psychology | family | money | knowledge)")
  .option("-t, --title <title>", "عنوان الحلقة (سؤال)")
  .action(async (episode: string, slug: string, opts: { domain: string; title?: string }) => {
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
    const result = checkForChannel(parseScript(source, file));
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
  .argument("<prefix...>", "بادئة معرّف التكوين (واحدة أو أكثر)")
  .option("--stills <frames>", "أرقام إطارات مفصولة بفواصل")
  .action(async (prefix: string[], opts: { stills?: string }) => {
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
    spawn("npx", ["vite", "--config", "app/vite.config.ts"], { cwd: projectRoot, stdio: "inherit", shell: process.platform === "win32" });
  });

program
  .command("quran")
  .description("جلب نصوص آيات الحلقة بالرسم العثماني من Quran Foundation (تُخزن في quran.json)")
  .argument("<episode>", "رقم الحلقة")
  .option("--force", "إعادة الجلب حتى للمخزّن")
  .action(async (episode: string, opts: { force?: boolean }) => {
    const { quranClientFromEnv } = await import("../quran/client");
    const { syncQuran } = await import("../quran/sync");
    const { regeneratePlan } = await import("../plan/io");
    const client = quranClientFromEnv();
    if (!client) throw new Error("أضف QF_CLIENT_ID وQF_CLIENT_SECRET (وQF_ENV) إلى ملف .env.");
    const r = await syncQuran(episode, client, { force: opts.force });
    await regeneratePlan(episode);
    console.log(`جُلبت ${r.fetched.length} آية/مقطع، ومخزّنة ${r.cached.length}.`);
    for (const f of r.failed) console.log(`تعذّر: ${f.ref}: ${f.reason}`);
    if (r.failed.length) process.exitCode = 1;
  });

program
  .command("voice")
  .description("توليد صوت المشاهد من ElevenLabs (المشاهد التي لم تتغير لا يُعاد توليدها)")
  .argument("<episode>", "رقم الحلقة")
  .option("--dry-run", "حساب الحروف والرصيد فقط بلا توليد")
  .option("--force", "إعادة توليد كل المشاهد")
  .option("--scene <ids>", "مشاهد محددة مفصولة بفواصل، مثل c2-s1,c4-s3")
  .action(async (episode: string, opts: { dryRun?: boolean; force?: boolean; scene?: string }) => {
    const { elevenLabsFromEnv } = await import("../voice/elevenlabs");
    const { generateVoice } = await import("../voice/generate");
    const client = elevenLabsFromEnv();
    const r = await generateVoice(episode, { client, dryRun: opts.dryRun || !client, force: opts.force, only: opts.scene?.split(",").map((x) => x.trim()), onProgress: (m) => console.log(m) });
    console.log(`المشاهد: ${r.total} · للتوليد: ${r.toGenerate.length} · محفوظة: ${r.cached.length}`);
    console.log(`الحروف: ${r.chars} ≈ ${r.credits} رصيد ElevenLabs`);
    if (!client && !opts.dryRun) console.log("لم يُولَّد شيء: أضف ELEVENLABS_API_KEY وELEVENLABS_VOICE_ID إلى .env.");
  });

program
  .command("sfx")
  .description("توليد المؤثرات الصوتية من سجل brand/sfx.ts عبر ElevenLabs")
  .argument("[ids...]", "معرّفات المؤثرات")
  .option("--missing", "كل المؤثرات غير الموجودة")
  .option("--list", "عرض الحالة فقط")
  .option("--force", "إعادة التوليد")
  .action(async (ids: string[], opts: { missing?: boolean; list?: boolean; force?: boolean }) => {
    const { sfxLibrary } = await import("../../brand/sfx");
    const { availableSfx, generateSfx } = await import("../voice/sfx");
    const have = new Set(availableSfx());
    if (opts.list || (!ids.length && !opts.missing)) {
      for (const s of sfxLibrary) console.log(`${have.has(s.id) ? "✓" : "·"} ${s.id.padEnd(16)} ${s.nameAr}${s.category === "vocal" ? " (تسجيل بشري)" : ""}`);
      console.log(`موجود ${have.size} من ${sfxLibrary.length}.`);
      return;
    }
    const { elevenLabsFromEnv } = await import("../voice/elevenlabs");
    const client = elevenLabsFromEnv();
    if (!client) throw new Error("أضف ELEVENLABS_API_KEY وELEVENLABS_VOICE_ID إلى ملف .env.");
    const list = opts.missing ? sfxLibrary.filter((s) => !have.has(s.id)).map((s) => s.id) : ids;
    const r = await generateSfx(client, list, { force: opts.force, onProgress: (m) => console.log(m) });
    console.log(`وُلّد ${r.done.length}. ${r.skipped.map((x) => `${x.id}: ${x.reason}`).join("؛ ")}`);
  });

program
  .command("package")
  .description("تجهيز ملفات النشر: الحلقة + الشورتس + الصور المصغّرة + الترجمة + الوصف")
  .argument("<episode>", "رقم الحلقة")
  .option("--skip-video", "بلا رندر فيديو")
  .action(async (episode: string, opts: { skipVideo?: boolean }) => {
    const { packageEpisode } = await import("../package/package");
    const r = await packageEpisode({ episode, skipVideo: opts.skipVideo, onProgress: (m) => console.log(m) });
    console.log(`جاهز في ${path.relative(projectRoot, r.dir)}:\n- ${r.files.join("\n- ")}`);
  });

program
  .command("make")
  .description("من السكريبت إلى ملفات النشر بأمر واحد: فحص ← آيات ← مشاهد ← صوت ← رندر ← تغليف")
  .argument("<episode>", "رقم الحلقة")
  .option("--no-voice", "نسخة معاينة بلا صوت (لا تُنشر)")
  .option("--skip-video", "بلا رندر فيديو")
  .action(async (episode: string, opts: { voice?: boolean; skipVideo?: boolean }) => {
    const { makeEpisode } = await import("../package/make");
    const r = await makeEpisode({ episode, noVoice: opts.voice === false, skipVideo: opts.skipVideo, onProgress: (m) => console.log(m) });
    console.log(`\nتم. الملفات في ${path.relative(projectRoot, r.dir)}. راجع publish-checklist.md قبل النشر.`);
  });

const channelCmd = program.command("channel").description("إدارة القنوات (كل قناة: هوية ومجالات وحلقات خاصة، والمحرك مشترك)");

channelCmd
  .command("list")
  .description("عرض القنوات")
  .action(async () => {
    const { listChannels, loadChannel, currentChannelId } = await import("../channel");
    for (const id of listChannels()) {
      const c = loadChannel(id);
      console.log(`${id === currentChannelId() ? "●" : "·"} ${id.padEnd(16)} ${c.name} · ${c.language} · ${Object.keys(c.domains).join("، ")}`);
    }
  });

channelCmd
  .command("new")
  .description("إنشاء قناة جديدة بهوية تبدأ من قناة موجودة")
  .argument("<id>", "معرّف بالإنجليزية، مثل bilislam-tr")
  .requiredOption("-n, --name <name>", "اسم القناة كما يظهر في الفيديو")
  .requiredOption("-l, --lang <lang>", "اللغة: ar | tr | en")
  .option("--latin <name>", "الاسم بالحروف اللاتينية")
  .option("--from <id>", "القناة التي تُنسخ هويتها", "balislam")
  .option("--no-quran", "قناة لا تستشهد بالقرآن والحديث")
  .action(async (id: string, opts: { name: string; lang: string; latin?: string; from: string; quran: boolean }) => {
    const { createChannel } = await import("../channel/create");
    const dir = await createChannel({ id, name: opts.name, language: opts.lang, nameLatin: opts.latin, from: opts.from, quran: opts.quran });
    console.log(`أُنشئت القناة في ${path.relative(projectRoot, dir)}.`);
    console.log("الخطوات التالية: عدّل المجالات في channel.json، والألوان من تبويب الهوية في الاستوديو، ثم: bal --channel " + id + " new 001 …");
  });

program.parseAsync().catch((err: Error) => {
  console.error(`خطأ: ${err.message}`);
  process.exitCode = 1;
});
