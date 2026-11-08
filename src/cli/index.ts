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
  .description("منظومة إنتاج القنوات: بالإسلام، دفاتر الزمن، زبدة الكتب")
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
  .command("art")
  .description("رندر صور القنوات للمنصات: صورة الحساب وأغلفة يوتيوب وفيسبوك وX (bal art أو bal art dafatir-alzaman)")
  .argument("[channels...]")
  .action(async (channels: string[]) => {
    const { renderChannelArt } = await import("../render/stills");
    const files = await renderChannelArt({ channels, onProgress: (m) => console.log(m) });
    console.log(`تم: ${files.length} صورة في renders/brand/`);
  });

program
  .command("elements")
  .description("تصدير مكتبة كل قناة بهويتها: SVG لكل ثيم + manifest.json + كتالوج HTML في renders/elements/<القناة> (bal elements أو bal elements zubdat-alkutub)")
  .argument("[channels...]")
  .action(async (channels: string[]) => {
    const { exportElements } = await import("../elements/export");
    const { listChannels } = await import("../channel");
    for (const id of channels.length ? channels : listChannels()) {
      const r = await exportElements(id);
      console.log(`${r.channel}: ${r.elements} عنصرًا، ${r.files} ملفًا. الكتالوج: ${path.relative(projectRoot, r.catalog)}`);
    }
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
  .option("--master", "بأعلى جودة 4K (الافتراضي معاينة 1080p)")
  .action(async (episode: string, opts: { portrait?: boolean; chapter?: string; master?: boolean }) => {
    const { renderEpisode } = await import("../render/episode");
    let last = -1;
    const out = await renderEpisode({
      episode,
      orientation: opts.portrait ? "portrait" : "landscape",
      chapter: opts.chapter ? Number(opts.chapter) : undefined,
      quality: opts.master ? "master" : "preview",
      onProgress: (pct, msg) => {
        const step = Math.floor(pct / 10) * 10;
        if (step !== last) {
          last = step;
          console.log(`PROGRESS ${pct} ${msg}`);
        }
      },
    });
    const { measureMotion, motionSummary } = await import("../render/motionMeter");
    const { exemptForRender } = await import("../render/stillness");
    const { loadPlan } = await import("../plan/io");
    const plan = await loadPlan(episode);
    const exempt = plan ? await exemptForRender(plan, undefined, opts.chapter ? Number(opts.chapter) : undefined) : undefined;
    console.log(motionSummary(await measureMotion(out, opts.portrait ? "portrait" : "landscape", exempt), "الحركة"));
    console.log(`DONE ${path.relative(projectRoot, out)}`);
  });

program
  .command("motion")
  .description("مقياس الحركة لفيديو مرندر (قاعدة القناة: 80% على الأقل، والهدف 90%)")
  .argument("<files...>", "ملفات الفيديو")
  .option("--portrait", "فيديو عمودي")
  .action(async (files: string[], opts: { portrait?: boolean }) => {
    const { measureMotion, motionSummary, MOTION_MIN } = await import("../render/motionMeter");
    let bad = false;
    for (const f of files) {
      const r = await measureMotion(f, opts.portrait ? "portrait" : "landscape");
      console.log(motionSummary(r, path.basename(f)));
      bad ||= r.percent < MOTION_MIN;
    }
    if (bad) process.exitCode = 1;
  });

program
  .command("zubdat <action> <episode>")
  .description("استوديو زبدة الكتب (لهذه القناة وحدها): check فحص مشاهد الحبر · guide دليل الراوي · qa بطاقتا الجودة · sheet لوحة الهاتف من رندر")
  .option("--video <file>", "فيديو الحلقة (لـ qa: قياس الحركة، ولـ sheet: مصدر اللقطات؛ الافتراضي previews/episode.mp4)")
  .action(async (action: string, episode: string, opts: { video?: string }) => {
    const st = await import("../studio/zubdat");
    st.assertZubdat();
    const rel = (f: string) => path.relative(projectRoot, f);
    if (action === "check") {
      const checks = await st.checkEpisode(episode);
      for (const c of checks) for (const f of c.findings) console.log(`${f.level === "error" ? "✗" : "!"} ${c.id} (${c.shot}): ${f.msg}`);
      const r = await st.writeCheckReport(episode, checks);
      console.log(`${checks.length} مشهد حبر · ${r.errors} خطأ · ${r.warns} تنبيه. التقرير: ${rel(r.file)}`);
      if (r.errors) process.exitCode = 1;
    } else if (action === "guide") {
      console.log(`دليل الراوي: ${rel(await st.writeGuideReport(episode, await st.narratorGuide(episode)))}`);
    } else if (action === "qa") {
      const checks = await st.checkEpisode(episode);
      await st.writeCheckReport(episode, checks);
      const video = opts.video ?? path.join(path.dirname(await resolveScriptPath(episode)), "previews", "episode.mp4");
      let motion: string | null = null;
      if (opts.video || (await import("node:fs")).existsSync(video)) {
        const { measureMotion, motionSummary } = await import("../render/motionMeter");
        const { exemptForRender } = await import("../render/stillness");
        const { loadPlan } = await import("../plan/io");
        const { collectMedia } = await import("../plan/collect");
        const plan = (await loadPlan(episode))!;
        motion = motionSummary(await measureMotion(video, "landscape", await exemptForRender(plan, await collectMedia(episode, plan))), path.basename(video));
      }
      console.log(`مراجعة الجودة: ${rel(await st.writeQaReport(episode, checks, motion))}`);
    } else if (action === "sheet") {
      const { writePhoneSheet } = await import("../studio/zubdatSheet");
      const video = opts.video ?? path.join(path.dirname(await resolveScriptPath(episode)), "previews", "episode.mp4");
      console.log(`لوحة الهاتف: ${rel(await writePhoneSheet(episode, path.resolve(video)))}`);
    } else throw new Error(`إجراء غير معروف: ${action} (check | guide | qa | sheet)`);
  });

program
  .command("app")
  .description("فتح الاستوديو في المتصفح")
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
  .command("quran-text-only")
  .description("جلب نصوص الآيات الناقصة فقط إلى quran.json؛ لا يكتب plan.json ولا يجلب صوتًا أو يغيّر مراجعات الحلقة")
  .argument("<episode>", "رقم الحلقة")
  .option("--dry-run", "عرض المراجع الناقصة دون اتصال أو كتابة أي ملف")
  .option("--confirm-cache-write", "إقرار صريح بحفظ النصوص الناقصة في quran.json فقط")
  .action(async (episode: string, opts: { dryRun?: boolean; confirmCacheWrite?: boolean }) => {
    if (opts.dryRun) {
      const { inspectMissingQuranTexts } = await import("../quran/fillMissingText");
      const result = await inspectMissingQuranTexts(episode);
      for (const key of result.missing) console.log(`${key}: نص محلي ناقص`);
      for (const key of result.existing) console.log(`${key}: نص محلي موجود`);
      for (const failure of result.invalid) console.log(`${failure.ref}: مرجع غير صالح — ${failure.reason}`);
      console.log(`ناقص: ${result.missing.length} · موجود: ${result.existing.length} · غير صالح: ${result.invalid.length} (فحص دون كتابة)`);
      if (result.invalid.length) process.exitCode = 1;
      return;
    }
    {
      const { assertFetchAllowed } = await import("../quran/scriptText");
      const { resolveScriptPath } = await import("../script/episodes");
      assertFetchAllowed(await resolveScriptPath(episode));
    }
    if (!opts.confirmCacheWrite) throw new Error("استخدم --dry-run للفحص أو --confirm-cache-write للإذن بحفظ النصوص الناقصة.");
    const { quranClientFromEnv } = await import("../quran/client");
    const { fillMissingQuranTexts } = await import("../quran/fillMissingText");
    const client = quranClientFromEnv();
    if (!client) throw new Error("أضف QF_CLIENT_ID وQF_CLIENT_SECRET (وQF_ENV) إلى ملف .env.");
    const result = await fillMissingQuranTexts(episode, client);
    for (const key of result.fetched) console.log(`${key}: جُلب النص الناقص`);
    for (const key of result.existing) console.log(`${key}: النص المحلي موجود؛ لم يُعدّل`);
    for (const failure of result.failed) console.log(`${failure.ref}: تعذّر الجلب — ${failure.reason}`);
    console.log(`نصوص مضافة: ${result.fetched.length} · موجودة: ${result.existing.length} · تعذّرت: ${result.failed.length}`);
    if (result.failed.length) process.exitCode = 1;
  });

program
  .command("quran-compare")
  .description("مقابلة نص بطاقات الآيات بنص Quran Foundation حرفًا وحركةً، دون تغيير quran.json (النتيجة في «ملفات المراجعة»)")
  .argument("<episode>", "رقم الحلقة")
  .option("--evidence-only", "تقرير الأدلة المحلية فقط (النص المعروض ومصدره وصورة البطاقة وأرقامها) دون جلب المرجع؛ لا يُعد مطابقة")
  .action(async (episode: string, opts: { evidenceOnly?: boolean }) => {
    const { quranClientFromEnv } = await import("../quran/client");
    const { auditEpisodeQuran, writeQuranAuditReport, CLASS_AR } = await import("../quran/audit");
    const client = opts.evidenceOnly ? null : quranClientFromEnv();
    if (!client && !opts.evidenceOnly) throw new Error("أضف QF_CLIENT_ID وQF_CLIENT_SECRET (وQF_ENV=production) إلى ملف .env، أو استعمل --evidence-only لتقرير الأدلة وحدها.");
    const result = await auditEpisodeQuran(episode, { client });
    for (const a of result.audits) {
      const kinds = [...new Set(a.ops.map((o) => CLASS_AR[o.cls]))].join("، ");
      console.log(`${a.key}: ${a.status === "match" ? "مطابق" : a.status === "differs" ? `فيه ${a.ops.length} فرق${kinds ? ` (${kinds})` : ""}${a.numbers.ok ? "" : "، ورقم السورة/الآية يحتاج مراجعة"}` : a.status === "pending" ? "لم يُقابَل بالمرجع" : a.reason ?? a.status}`);
    }
    if (client && client.env !== "production") console.log("تنبيه: QF_ENV ليست production؛ اجعلها production للمطابقة بالمرجع المعتمد.");
    console.log(`التقرير: ${await writeQuranAuditReport(episode, result, { environment: client ? `<b>بيئة المرجع:</b> Quran Foundation (${client.env}).` : "<b>بيئة المرجع:</b> لم يُجلب المرجع في هذا التشغيل (--evidence-only)." })}`);
    if (result.audits.some((a) => a.status !== "match")) process.exitCode = 1;
  });

program
  .command("quran-script")
  .description("نص الآيات من السكريبت: يستخرج ما كتبه صاحب القناة في [آية: المرجع | النص]، ويقابله بالمصحف المعتمد (Quran Foundation) ويكتب تقرير الفروق للمراجعة الشرعية. لا يجلب نصًّا إلى البطاقة، ولا يصحح، ولا يعتمد")
  .argument("<episode>", "رقم الحلقة")
  .action(async (episode: string) => {
    const { readFile } = await import("node:fs/promises");
    const { resolveScriptPath } = await import("../script/episodes");
    const { parseScript } = await import("../script/parse");
    const { scriptVerses, quranTextSourceFor } = await import("../quran/scriptText");
    const { quranClientFromEnv } = await import("../quran/client");
    const { auditEpisodeQuran, writeQuranAuditReport, CLASS_AR } = await import("../quran/audit");
    const scriptPath = await resolveScriptPath(episode);
    if (quranTextSourceFor(scriptPath) !== "script") throw new Error("مصدر نص الآيات في هذه القناة ليس السكريبت (rules.quranText). استعمل quran-compare.");
    const verses = scriptVerses(parseScript(await readFile(scriptPath, "utf8"), scriptPath));
    for (const v of verses) console.log(`${v.key ?? v.ref} (السطر ${v.line}): ${v.reason ? `مرجع غير صالح — ${v.reason}` : v.text ? `النص مكتوب (${Array.from(v.text).length} رمزًا)` : "لم يُكتب النص بعد"}`);
    const client = quranClientFromEnv();
    const result = await auditEpisodeQuran(episode, { client });
    for (const a of result.audits) {
      const kinds = [...new Set(a.ops.map((o) => CLASS_AR[o.cls]))].join("، ");
      console.log(`  ${a.key}: ${a.status === "match" ? "مطابق للمصحف المعتمد" : a.status === "differs" ? `فيه ${a.ops.length} فرق${kinds ? ` (${kinds})` : ""}` : a.status === "pending" ? "لم يُقابَل بالمرجع (لا مفاتيح Quran Foundation هنا)" : a.reason ?? a.status}`);
    }
    if (client && client.env !== "production") console.log("تنبيه: QF_ENV ليست production؛ اجعلها production للمطابقة بالمرجع المعتمد.");
    const env = client ? `<b>المرجع:</b> المصحف المعتمد من Quran Foundation (${client.env}).` : "<b>المرجع:</b> لم يُجلب في هذا التشغيل: لا مفاتيح Quran Foundation (QF_CLIENT_ID وQF_CLIENT_SECRET) في هذه البيئة. شغّل الأمر نفسه حيث توجد المفاتيح.";
    console.log(`التقرير: ${await writeQuranAuditReport(episode, result, { provenance: "<b>مصدر النص المعروض:</b> السكريبت. نص الآية يكتبه صاحب القناة بيده في علامتها، ولا يُجلب ولا يُصحَّح آليًا. القرار للمراجع الشرعي في «سجل التوثيق».", environment: env })}`);
    if (result.audits.some((a) => a.status !== "match")) process.exitCode = 1;
  });

program
  .command("voice")
  .description("توليد صوت المشاهد من ElevenLabs (المشاهد التي لم تتغير لا يُعاد توليدها)")
  .argument("<episode>", "رقم الحلقة")
  .option("--dry-run", "حساب الحروف والرصيد فقط بلا توليد")
  .option("--force", "إعادة توليد كل المشاهد")
  .option("--scene <ids>", "مشاهد محددة مفصولة بفواصل، مثل c2-s1,c4-s3")
  .option("--ignore-tashkeel", "التوليد رغم نقص التشكيل (غير مستحسن)")
  .option("--ignore-review", "التوليد قبل اكتمال سجل التوثيق (غير مستحسن)")
  .option("--ignore-storyboard", "التوليد قبل اعتماد الستوري بورد (غير مستحسن)")
  .action(async (episode: string, opts: { dryRun?: boolean; force?: boolean; scene?: string; ignoreTashkeel?: boolean; ignoreReview?: boolean; ignoreStoryboard?: boolean }) => {
    const { elevenLabsFromEnv } = await import("../voice/elevenlabs");
    const { generateVoice } = await import("../voice/generate");
    const client = elevenLabsFromEnv();
    const r = await generateVoice(episode, { client, dryRun: opts.dryRun || !client, force: opts.force, ignoreTashkeel: opts.ignoreTashkeel, ignoreReview: opts.ignoreReview, ignoreStoryboard: opts.ignoreStoryboard, only: opts.scene?.split(",").map((x) => x.trim()), onProgress: (m) => console.log(m) });
    console.log(tashkeelLine(r.tashkeel));
    console.log(`التوثيق: ${r.review.verified} من ${r.review.total} موثّق ${r.review.ok ? "✓" : "✗"}`);
    console.log(`المشاهد: ${r.total} · للتوليد: ${r.toGenerate.length} · محفوظة: ${r.cached.length}`);
    console.log(`الحروف: ${r.chars} ≈ ${r.credits} رصيد ElevenLabs`);
    if (!client && !opts.dryRun) console.log("لم يُولَّد شيء: أضف ELEVENLABS_API_KEY وELEVENLABS_VOICE_ID إلى .env.");
  });

const tashkeelLine = (t: import("../voice/tashkeelReport").TashkeelReport) =>
  !t.file ? "التشكيل: لا يوجد tashkeel.md ✗" : `التشكيل: ${(t.coverage * 100).toFixed(1)}% (${t.covered} من ${t.words} كلمة، الحد ${Math.round(t.min * 100)}%) ${t.ok ? "✓" : "✗"}`;

program
  .command("tashkeel")
  .description("مدقق التشكيل: الكلمات التي ستُنطق بلا تشكيل، والكلمات التي لها أكثر من نطق")
  .argument("<episode>", "رقم الحلقة")
  .action(async (episode: string) => {
    const { generateVoice } = await import("../voice/generate");
    const { tashkeel: t } = await generateVoice(episode, { dryRun: true });
    console.log(tashkeelLine(t));
    for (const g of t.gaps) console.log(`  ${g.sceneId}: ${g.words.join("، ")}`);
    if (t.ambiguous.length) console.log("كلمات لها أكثر من نطق في الملف (راجع السياق):");
    for (const a of t.ambiguous) console.log(`  ${a.forms.join(" / ")} ← ${a.scenes.join("، ")}`);
    if (!t.ok) process.exitCode = 1;
  });

program
  .command("review")
  .description("سجل التوثيق: حالة مراجعة كل استشهاد (آية، حديث، مصدر، صفحة كتاب)")
  .argument("<episode>", "رقم الحلقة")
  .action(async (episode: string) => {
    const { resolveScriptPath } = await import("../script/episodes");
    const { parseScript } = await import("../script/parse");
    const { loadLedger, reviewItems, reviewSummary } = await import("../script/review");
    const { readFile } = await import("node:fs/promises");
    const file = await resolveScriptPath(episode);
    const items = reviewItems(parseScript(await readFile(file, "utf8"), file), await loadLedger(file));
    const mark = { verified: "✓ موثّق", rejected: "✗ مرفوض", pending: "… بانتظار المراجعة", changed: "! تغيّر بعد الاعتماد" } as const;
    for (const i of items) console.log(`${mark[i.status]} · ${i.label} | ${i.ref}${i.detail ? ` | ${i.detail}` : ""}${i.note ? ` — ${i.note}` : ""}`);
    const s = reviewSummary(items);
    console.log(`موثّق ${s.verified} من ${s.total}${s.ok ? " ✓" : ""}. القرار من الاستوديو: «السكريبت ← سجل التوثيق».`);
    if (!s.ok) process.exitCode = 1;
  });

program
  .command("shots-preview <episode> <ids>")
  .description("معاينة صوتية لمشاهد مختارة (صوت الراوي والتلاوة الفعلية) تُرفع إلى «المعاينات» مكان النسخة السابقة؛ تُرفض بقائمة النواقص إن نقص نص آية أو تلاوة أو صوت")
  .option("--slot <slot>", "خانة المعاينة (تنتهي بـ -audio)", "six-shots-audio")
  .option("--replaces <slot>", "الخانة الصامتة التي تحل محلها عند النجاح", "six-shots")
  .option("--title <title>", "العنوان في الاستوديو", "اللقطات الست بالصوت والتلاوة")
  .option("--note <note>", "ملاحظة تحته", "معاينة بصوت الراوي وتلاوة الحصري، بجودة المعاينة. لا تُنشر.")
  .action(async (episode: string, ids: string, opts: { slot: string; title: string; note: string; replaces: string }) => {
    const { renderShotsPreview } = await import("../render/shotsPreview");
    try {
      const r = await renderShotsPreview(episode, ids.split(/[,،\s]+/).filter(Boolean), { ...opts, onProgress: (p, m) => console.log(`PROGRESS ${p} ${m}`) });
      console.log(`رُفعت إلى الاستوديو: ${path.relative(projectRoot, r.file)} (رفع رقم ${r.version})`);
      for (const t of r.timing) console.log(`  ${t.id}: ${t.seconds} ث${t.voice ? ` · صوت ${t.voice.toFixed(1)} ث` : ""}${t.recitation ? ` · تلاوة ${t.recitation.toFixed(1)} ث` : ""}`);
    } catch (e) {
      console.error((e as Error).message);
      process.exitCode = 1;
    }
  });

program
  .command("horizon-audio <episode>")
  .description("دفاتر الزمن 001: اللقطات الست («خط الأفق») بصوت الراوي المعتمد وآيتي البقرة 30 والأعراف 23 بتلاوة قارئ القناة، مضبوطة على توقيت الكلام؛ تُرفع إلى «المعاينات» (خانة -audio تبقى على الجهاز) وتحل محل المعاينة الصامتة بعد التحقق من تشغيلها. تتوقف بقائمة النواقص دون إنتاج نسخة ناقصة.")
  .option("--slot <slot>", "خانة المعاينة (تنتهي بـ -audio)", "six-shots-audio")
  .option("--replaces <slot>", "المعاينة الصامتة التي تحل محلها بعد النجاح", "horizon-test-v2")
  .action(async (episode: string, opts: { slot: string; replaces: string }) => {
    const { renderHorizonAudio } = await import("../render/horizonAudio");
    try {
      const r = await renderHorizonAudio(episode, { ...opts, onProgress: (m) => console.log(m) });
      console.log(`رُفعت إلى الاستوديو: ${path.relative(projectRoot, r.file)} (رفع رقم ${r.version})${r.replaced ? ` · أُزيلت ${r.replaced} من العرض` : ""}`);
      console.log(`المدة: ${r.seconds} ث`);
      for (const s of r.shots) console.log(`  اللقطة ${s.id}: ${s.seconds} ث · الراوي ${s.voice} ث${s.recitation ? ` · التلاوة ${s.recitation} ث` : ""}`);
      for (const v of r.verses) console.log(`  ${v.key}: ${v.words} كلمة · ${v.parts} ملف تلاوة · ${v.seconds} ث · ${v.reciter}`);
      console.log(`الحركة بعد الاستثناءات: ${r.motion.percent}% (مستثنى ${r.motion.exempt} ث)${r.motion.still.length ? ` · مقاطع ساكنة: ${r.motion.still.map((x) => `${x.from}-${x.to}`).join("، ")}` : ""}`);
    } catch (e) {
      console.error((e as Error).message);
      process.exitCode = 1;
    }
  });

program
  .command("scenes-preview <episode> <ids>")
  .description("معاينة موضعية صامتة لمشاهد مختارة (مثل c1-s1,c1-s2) بتوقيت الحلقة وهويتها، بلا افتتاحية؛ لا تغيّر الخطة ولا الاعتمادات")
  .option("--portrait", "العمودي 9:16")
  .option("--out <file>", "مسار الملف (الافتراضي renders/scenes/)")
  .action(async (episode: string, ids: string, opts: { portrait?: boolean; out?: string }) => {
    const { renderScenesPreview } = await import("../render/scenesPreview");
    let last = -1;
    const out = await renderScenesPreview({
      episode,
      ids: ids.split(/[,،\s]+/).filter(Boolean),
      orientation: opts.portrait ? "portrait" : "landscape",
      out: opts.out ? path.resolve(opts.out) : undefined,
      onProgress: (pct) => {
        const step = Math.floor(pct / 20) * 20;
        if (step !== last) console.log(`PROGRESS ${(last = step)}`);
      },
    });
    console.log(`DONE ${path.relative(projectRoot, out)}`);
  });

program
  .command("storyboard-board <episode>")
  .description("لوحة الستوري بورد المرئية للحلقة كاملة: لقطات ثابتة من المحرك لكل مشهد بالاتجاهين، وPDF وورقة لكل فصل وبيان بالبصمات؛ لا فيديو ولا صوت ولا اعتماد")
  .requiredOption("--version <v>", "إصدار اللوحة (v1، v2…): مجلد storyboard/<v>/ لا يُكتب فوق إصدار سابق")
  .option("--note <text>", "ملاحظة الغلاف", "لوحة للمراجعة قبل النبرة والصوت. لم تُعتمد.")
  .option("--only <ids>", "مشاهد بعينها فقط (اختبار)")
  .option("--chapter <n>", "فصل واحد في مجلد إصداره (لا تُنسخ ملفاته فوق ملفات الإصدار الكامل)")
  .option("--compare <v>", "إصدار سابق للمقارنة: شارة «معدّل / دون تغيير» لكل مشهد من بصمة الخطة وبايتات الصور")
  .action(async (episode: string, opts: { version: string; note: string; only?: string; chapter?: string; compare?: string }) => {
    const { buildStoryboardBoard } = await import("../render/storyboardBoard");
    const { existsSync } = await import("node:fs");
    const { resolveScriptPath } = await import("../script/episodes");
    const dir = path.join(path.dirname(await resolveScriptPath(episode)), "storyboard", opts.version);
    if (!opts.only && existsSync(path.join(dir, "board-manifest.json"))) throw new Error(`الإصدار ${opts.version} موجود؛ استعمل إصدارًا جديدًا فلا تُفقد نسخة سابقة.`);
    const r = await buildStoryboardBoard({ episode, version: opts.version, note: opts.note, only: opts.only?.split(/[,،\s]+/).filter(Boolean), chapter: opts.chapter ? Number(opts.chapter) : undefined, compare: opts.compare, onProgress: (m) => console.log(m) });
    for (const f of r.delivered) console.log(`FILE ${f.path} sha256=${f.sha256}`);
    console.log(`DONE ${path.relative(projectRoot, r.outDir)} · ${r.manifest.scenes.length} مشهدًا · PENDING_REVIEW`);
  });

program
  .command("upload-preview <episode> <slot> <file>")
  .description("رفع فيديو للحلقة إلى «المعاينات» في الاستوديو: يحذف النسخة القديمة لنفس الخانة ويضع الجديدة مكانها")
  .requiredOption("--title <title>", "عنوان الفيديو كما يظهر في الاستوديو")
  .option("--note <note>", "ملاحظة قصيرة تحته")
  .action(async (episode: string, slot: string, file: string, opts: { title: string; note?: string }) => {
    const { putEpisodePreview } = await import("../render/episodePreviews");
    const r = await putEpisodePreview(episode, slot, path.resolve(file), { title: opts.title, note: opts.note });
    console.log(`رُفع إلى الاستوديو: ${path.relative(projectRoot, r.file)} (رفع رقم ${r.version})${r.removed.length ? `؛ حُذف القديم: ${r.removed.join("، ")}` : ""}`);
  });

program
  .command("upload-storyboard <lab> <slot> <file>")
  .description("حفظ صورة ستوري بورد في مختبر (بالإسلام): نسخة جديدة برقمها وتاريخها «جاهز للمراجعة»، ولا تُحذف النسخ السابقة")
  .requiredOption("--title <title>", "عنوان النسخة كما يظهر في الاستوديو")
  .option("--note <note>", "ما تغيّر في هذه النسخة")
  .option("--order <order>", "رقم الأمر الذي تنتمي إليه (مثل 015)")
  .option("--at <iso>", "تاريخ صنع النسخة إن حُفظت لاحقًا (الافتراضي الآن)")
  .option("--topic <topic>", "عنوان الموضوع (الخانة) كما يظهر فوق نسخه")
  .action(async (lab: string, slot: string, file: string, opts: { title: string; note?: string; order?: string; at?: string; topic?: string }) => {
    const { channelPaths, currentChannelId } = await import("../channel");
    const sb = await import("../channel/labStoryboards");
    const dir = await sb.resolveLabDir(channelPaths().episodes, lab);
    const r = await sb.addLabStoryboard(currentChannelId(), dir, slot, path.resolve(file), { title: opts.title, note: opts.note, order: opts.order, uploadedAt: opts.at, topic: opts.topic });
    console.log(`حُفظ في المختبر: ${path.relative(projectRoot, r.file)} (النسخة ${r.version} · جاهز للمراجعة)`);
  });

program
  .command("storyboard-decision <lab> <slot> <version> <status>")
  .description("تسجيل قرار صاحب القناة على نسخة ستوري بورد: approved (معتمد فنيًا) أو changes (يحتاج تعديلًا) أو review؛ لا يُستعمل إلا بقراره الصريح")
  .requiredOption("--by <name>", "صاحب القرار")
  .requiredOption("--decision <text>", "نص القرار")
  .option("--at <iso>", "تاريخ القرار (الافتراضي الآن)")
  .action(async (lab: string, slot: string, version: string, status: string, opts: { by: string; decision: string; at?: string }) => {
    const { channelPaths, currentChannelId } = await import("../channel");
    const sb = await import("../channel/labStoryboards");
    const dir = await sb.resolveLabDir(channelPaths().episodes, lab);
    const v = await sb.decideLabStoryboard(currentChannelId(), dir, slot, Number(version), { status: status as never, by: opts.by, note: opts.decision, at: opts.at });
    console.log(`${slot} v${v.version}: ${sb.STORYBOARD_STATUS_AR[v.status]} (${v.decision?.by})`);
  });

program
  .command("render-batch <compositions...>")
  .description("رندر عدة تكوينات عبر الطابور الآمن: التوازي من موارد الجهاز، والفاشل لا يوقف غيره، وسببه مسجَّل في render-queue.json (--retry يعيد الفاشل وحده)")
  .option("--out <dir>", "مجلد النواتج", "renders/batch")
  .option("--retry", "أعد المهام الفاشلة أو غير المكتملة في السجل السابق فقط")
  .option("--max <n>", "حد أعلى للتوازي (الحد الفعلي هو الأصغر بينه وبين ما تسمح به الذاكرة)")
  .option("--frames <range>", "نطاق إطارات لكل تكوين (للقياس السريع)")
  .option("--props <json>", "خصائص تُمرر إلى كل تكوين")
  .option("--timeout <minutes>", "مهلة قصوى لكل مهمة بالدقائق (تُصنف «انتهاء المهلة»)")
  .option("--stall <minutes>", "مهلة التقدم: مهمة لا تستهلك المعالج هذه المدة تُوقف (الافتراضي 5)", "5")
  .action(async (compositions: string[], opts: { out: string; retry?: boolean; max?: string; frames?: string; props?: string; timeout?: string; stall: string }) => {
    const { FAILURE_LABEL, RenderPool, memoryInfo, safeParallelism } = await import("../render/pool");
    const out = path.resolve(opts.out);
    const ledger = path.join(out, "render-queue.json");
    const prev = await RenderPool.readLedger(ledger);
    const pool = new RenderPool({
      ledger,
      ...(prev ? { perJobMB: prev.perJobMB } : {}),
      ...(opts.max ? { maxParallel: Number(opts.max) } : {}),
      stallMs: Number(opts.stall) * 60_000,
      onChange: (t) => console.log(`${t.status === "done" ? "✓" : t.status === "error" || t.status === "cancelled" ? "✗" : t.status === "running" ? "▶" : "…"} ${t.id}${t.seconds ? ` ${t.seconds.toFixed(1)} ث` : ""}${t.peakMB ? ` ذروة ${t.peakMB} م.ب` : ""}${t.failure ? ` — [${FAILURE_LABEL[t.failure.kind]}] ${t.failure.message}` : ""}`),
    });
    const done = new Set(opts.retry && prev ? prev.tasks.filter((t) => t.status === "done").map((t) => t.id) : []);
    // الناجح سابقًا يبقى في السجل ناجحًا كما هو
    // وعدد المحاولات يُحمل من السجل السابق
    if (opts.retry && prev) for (const t of prev.tasks) pool.tasks.set(t.id, { ...t, status: t.status === "done" ? "done" : "error", log: [] });
    // Ctrl-C: إلغاء كل المهام المنتظرة والجارية بطلب المستخدم (تُسجل «ألغاها المستخدم»، ولا يُمس ناتج سابق)
    process.once("SIGINT", () => {
      console.log("\nإلغاء بطلب المستخدم…");
      for (const t of pool.tasks.values()) if (t.status === "queued" || t.status === "running") pool.cancel(t.id);
    });
    const mem = memoryInfo();
    console.log(`الذاكرة المتاحة ${Math.round(mem.availableMB)} م.ب · التوازي الآمن الآن ${safeParallelism(mem.availableMB, (await import("node:os")).cpus().length, pool.perJobMB, 900)} (ذروة المهمة ${Math.round(pool.perJobMB)} م.ب)`);
    const browser = process.env.REMOTION_BROWSER_EXECUTABLE;
    for (const id of compositions) {
      if (done.has(id)) {
        console.log(`= ${id} نجح سابقًا، لا يُعاد`);
        continue;
      }
      const output = path.join(out, `${id}.mp4`);
      const args = ["remotion", "render", "src/remotion/index.ts", id, output, "--codec=h264", "--crf=20", "--log=error"];
      if (browser) args.push(`--browser-executable=${browser}`);
      if (opts.frames) args.push(`--frames=${opts.frames}`);
      if (opts.props) args.push(`--props=${opts.props}`);
      pool.add({ id, cmd: "npx", args, cwd: projectRoot, output, outputArg: 4, costKey: id, ...(opts.timeout ? { timeoutMs: Number(opts.timeout) * 60_000 } : {}) });
    }
    // شبكة أمان: لو انتهى البرنامج والمهام لم تكتمل فهذا فشل صريح لا نجاح صامت
    process.once("beforeExit", () => {
      const left = [...pool.tasks.values()].filter((t) => t.status === "queued" || t.status === "running");
      if (left.length) {
        console.error(`✗ انتهى البرنامج و${left.length} مهمة لم تكتمل: ${left.map((t) => t.id).join("، ")}`);
        process.exitCode = 1;
      }
    });
    await pool.idle();
    await pool.save();
    const failed = [...pool.tasks.values()].filter((t) => t.status === "error" || t.status === "cancelled");
    console.log(failed.length ? `فشل ${failed.length}؛ السجل: ${path.relative(projectRoot, ledger)} · أعد الفاشل وحده: bal render-batch … --retry` : "اكتملت كل المهام.");
    if (failed.length) process.exitCode = 1;
  });

program
  .command("storyboard <episode>")
  .description("الستوري بورد: هل اعتمد صاحب القناة لقطة كل مشهد قبل الصوت والنسخة النهائية؟ (--motion يقيس حركة كل مشهد بمعاينة صامتة خفيفة)")
  .option("--motion", "قياس حركة كل مشهد (معاينة صامتة بثلث الدقة، لا تُنشر)")
  .action(async (episode: string, opts: { motion?: boolean }) => {
    if (opts.motion) {
      const { measureStoryboardMotion } = await import("../render/storyboardMotion");
      const m = await measureStoryboardMotion(episode, { onProgress: (p, msg) => console.log(`PROGRESS ${p} ${msg}`) });
      const low = Object.entries(m.scenes).filter(([, v]) => v.still > 2).map(([k]) => k);
      console.log(`الحركة في الحلقة: ${m.percent}%${low.length ? `؛ سكون فوق ثانيتين في: ${low.join("، ")}` : ""}`);
      return;
    }
    const { resolveScriptPath } = await import("../script/episodes");
    const { loadPlan, regeneratePlan } = await import("../plan/io");
    const { loadStoryboard, storyboardStatus } = await import("../plan/storyboard");
    const plan = (await loadPlan(episode)) ?? (await regeneratePlan(episode));
    const s = storyboardStatus(plan, await loadStoryboard(await resolveScriptPath(episode)));
    console.log(`معتمد ${s.approved} من ${s.total}${s.ok ? " ✓" : ""}${s.changed.length ? `؛ تغيّر بعد الاعتماد: ${s.changed.join("، ")}` : ""}. الاعتماد من الاستوديو: «المشاهد ← ستوري بورد».`);
    if (!s.ok) process.exitCode = 1;
  });

program
  .command("scenes-review")
  .description("مراجعة المشاهد: هل حركات كل مشهد سليمة ومتناسقة مع النص وغير عشوائية؟")
  .argument("<episode>", "رقم الحلقة")
  .action(async (episode: string) => {
    const { resolveScriptPath } = await import("../script/episodes");
    const { loadPlan, regeneratePlan } = await import("../plan/io");
    const { loadSceneLedger, sceneReviewItems, sceneReviewSummary } = await import("../plan/sceneReview");
    const file = await resolveScriptPath(episode);
    const plan = (await loadPlan(episode)) ?? (await regeneratePlan(episode));
    const items = sceneReviewItems(plan, await loadSceneLedger(file));
    const mark = { ok: "✓ سليم", fix: "✗ يحتاج إصلاحًا", pending: "… لم يُراجع", changed: "! تغيّر بعد المراجعة" } as const;
    for (const i of items) console.log(`${mark[i.status]} · ${i.id}${i.note ? ` — ${i.note}` : ""}`);
    const s = sceneReviewSummary(items);
    console.log(`سليم ${s.ok} من ${s.total}${s.done ? " ✓" : ""}. القرار من الاستوديو: «المشاهد ← مراجعة المشهد».`);
    if (!s.done) process.exitCode = 1;
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
  .option("--shorts", "الشورتس/الريلز بأعلى جودة (بعد اعتماد النسخة الأساسية في الاستوديو)")
  .option("--preview", "معاينة سريعة 1080p بدل أعلى جودة (لا تُنشر)")
  .option("--ignore-scene-review", "النسخة النهائية قبل اكتمال مراجعة المشاهد (غير مستحسن)")
  .action(async (episode: string, opts: { skipVideo?: boolean; shorts?: boolean; preview?: boolean; ignoreSceneReview?: boolean }) => {
    const { packageEpisode } = await import("../package/package");
    const r = await packageEpisode({ episode, skipVideo: opts.skipVideo, ignoreSceneReview: opts.ignoreSceneReview, stage: opts.shorts ? "shorts" : "episode", quality: opts.preview ? "preview" : "master", onProgress: (m) => console.log(m) });
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
