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
  .description("توليد خطة المشاهد plan.json من السكريبت (تُحفظ تعديلاتك اليدوية). يرفض الكتابة فوق خطة مصمَّمة")
  .argument("<episode>", "رقم الحلقة")
  .option("--force-overwrite-designed", "امحُ المشاهد المصمَّمة وأعد التوليد من القالب العام (تُحفظ نسخة احتياطية أولًا)")
  .action(async (episode: string, opts: { forceOverwriteDesigned?: boolean }) => {
    const { regeneratePlan } = await import("../plan/io");
    try {
      const plan = await regeneratePlan(episode, {
        forceOverwriteDesigned: opts.forceOverwriteDesigned === true,
        onBackup: (f) => console.log(`نسخة احتياطية من الخطة المصمَّمة قبل محوها: ${f}`),
      });
      const n = plan.chapters.reduce((a, c) => a + c.scenes.length, 0);
      console.log(`الخطة جاهزة: ${plan.chapters.length} فصول، ${n} مشهدًا.`);
    } catch (error) {
      if ((error as { code?: string }).code !== "designed-plan") throw error;
      console.error(`${(error as Error).message}\nللمحو الصريح: npx bal plan ${episode} --force-overwrite-designed`);
      process.exitCode = 1;
    }
  });

program
  .command("remap-scene-ids")
  .description("نقل ملفات الصوت المحلية (voice/index.json وvoice/sentences.json) إلى معرّفات المشاهد الجديدة بعد جعل الخطة قسمًا واحدًا (D87). تجربة افتراضيًا")
  .argument("<episode>", "رقم الحلقة")
  .option("--map <file>", "ملف المقابل (الافتراضي: أحدث versions/*/id-map.json في مجلد الحلقة)")
  .option("--apply", "اكتب التغيير (تُحفظ نسخة <الملف>.before-remap.json أولًا)")
  .option("--with-changed-text", "انقل أيضًا ما تغيّر نص مشهده بعد تسجيله: يتبع التسجيل مشهده ويظهر «قديم» حتى يُولَّد (لا يُحذف شيء)")
  .action(async (episode: string, opts: { map?: string; apply?: boolean; withChangedText?: boolean }) => {
    const { existsSync, readdirSync } = await import("node:fs");
    const { loadPlan } = await import("../plan/io");
    const { readIdMap, remapLocalVoice } = await import("../plan/remapIds");
    const dir = path.dirname(await resolveScriptPath(episode));
    const versions = path.join(dir, "versions");
    const found = opts.map ? path.resolve(opts.map) : existsSync(versions)
      ? readdirSync(versions).sort().reverse().map((d) => path.join(versions, d, "id-map.json")).find((f) => existsSync(f)) : undefined;
    if (!found) throw new Error("لا ملف id-map.json لهذه الحلقة.");
    const plan = await loadPlan(episode);
    if (!plan) throw new Error("الخطة غير موجودة.");
    const reports = await remapLocalVoice(dir, plan, await readIdMap(found), { apply: opts.apply === true, withChangedText: opts.withChangedText === true });
    console.log(`المقابل: ${path.relative(dir, found)}`);
    if (!reports.length) console.log("لا ملفات صوت محلية لهذه الحلقة؛ لا شيء يُنقل.");
    for (const r of reports) {
      console.log(`${r.file}: ${r.moved.length} يُنقل${r.skipped.length ? `، ${r.skipped.length} لا يُنقل` : ""}${opts.apply ? (r.written ? " — كُتب" : " — لم يُكتب") : ""}`);
      for (const [a, b] of r.moved) console.log(`  ${a} → ${b}${r.changed.includes(a) ? " (نصه تغيّر بعد التسجيل: يظهر «قديم» حتى يُولَّد)" : ""}`);
      for (const s of r.skipped) console.log(`  ✗ ${s.id}: ${s.reason}`);
    }
    if (!opts.apply) console.log("تجربة فقط؛ للكتابة: --apply");
  });

program
  .command("voice-review")
  .description("عرض اعتماد مقاطع التعليق الصوتي، أو اعتماد مقطع واحد بعد سماعه فعليًا")
  .argument("<episode>", "رقم الحلقة")
  .option("--approve <sceneId>", "معرّف مقطع مسموع ومراجع يدويًا")
  .option("--approve-episode", "اعتماد الاستماع إلى جميع المقاطع متصلة بعد اعتماد كل مقطع")
  .option("--reviewer <name>", "اسم المراجع البشري")
  .option("--note <text>", "ملاحظة الاستماع الفعلي إلى المقطع")
  .action(async (episode: string, opts: { approve?: string; approveEpisode?: boolean; reviewer?: string; note?: string }) => {
    const { resolveScriptPath } = await import("../script/episodes");
    const { loadPlan } = await import("../plan/io");
    const { loadVoiceIndex } = await import("../voice/generate");
    const { approveVoiceScene, approveVoiceEpisode, voiceReviewItems, episodeVoiceApproved } = await import("../voice/review");
    const plan = await loadPlan(episode);
    if (!plan) throw new Error("الخطة غير موجودة.");
    const scriptPath = await resolveScriptPath(episode);
    const voice = await loadVoiceIndex(episode);
    if (opts.approve) {
      if (!opts.reviewer || !opts.note) throw new Error("الموافقة تتطلب --reviewer و--note بعد الاستماع الحقيقي.");
      await approveVoiceScene(scriptPath, plan, voice, opts.approve, opts.reviewer, opts.note);
    }
    if (opts.approveEpisode) {
      if (!opts.reviewer || !opts.note) throw new Error("اعتماد الحلقة الصوتية الكاملة يتطلب --reviewer و--note بعد الاستماع.");
      await approveVoiceEpisode(scriptPath, plan, voice, opts.reviewer, opts.note);
    }
    const items = await voiceReviewItems(scriptPath, plan, voice);
    for (const item of items) console.log(`${item.id}: ${item.state}`);
    const pending = items.filter((item) => item.state !== "approved");
    const whole = await episodeVoiceApproved(scriptPath, plan, voice);
    console.log(`الصوت المعتمد ${items.length - pending.length}/${items.length}؛ الاستماع الكامل ${whole ? "معتمد" : "غير معتمد"}.`);
    if (pending.length || !whole) process.exitCode = 1;
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
      const r = await measureMotion(path.resolve(f), opts.portrait ? "portrait" : "landscape");
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
  .command("quran-text-only")
  .description("فحص وجود نص كل آية في السكريبت فقط؛ لا يجلب نصًا ولا يكتب ملفات")
  .argument("<episode>", "رقم الحلقة")
  .option("--dry-run", "عرض المراجع الناقصة دون اتصال أو كتابة أي ملف")
  .option("--confirm-cache-write", "خيار قديم غير مدعوم؛ لا تُكتب الآيات خارج السكريبت")
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
    if (!opts.confirmCacheWrite) throw new Error("استخدم --dry-run للفحص؛ نص الآيات يُكتب في السكريبت مباشرة.");
    throw new Error("أُلغي الحفظ المستقل لنص القرآن. اكتب [آية: المرجع | النص] داخل السكريبت ثم استخدم quran-evidence.");
  });

program
  .command("quran-evidence")
  .description("فحص أدلة الآيات المكتوبة في السكريبت محليًا، دون استدعاء مزود قرآن خارجي")
  .argument("<episode>", "رقم الحلقة")
  .action(async (episode: string) => {
    const { auditEpisodeQuran, writeQuranAuditReport } = await import("../quran/audit");
    const result = await auditEpisodeQuran(episode, { frames: false });
    const file = await writeQuranAuditReport(episode, result, {
      environment: "سكريبت محلي فقط؛ المقارنة الشرعية المستقلة تبقى مراجعة بشرية"
    });
    console.log("تقرير أدلة السكريبت: " + file);
  });

program
  .command("recitation-attach")
  .description("إرفاق تسجيل التلاوة الذي يرفعه المالك للآية الموجودة في السكريبت")
  .argument("<episode>", "رقم الحلقة")
  .argument("<ayah-key>", "مثل 2:255")
  .argument("<file>", "ملف التلاوة المحلي")
  .action(async (episode: string, key: string, file: string) => {
    const { prepareOwnRecitation } = await import("../quran/manualAudio");
    const candidate = await prepareOwnRecitation(episode, key, path.basename(file), await readFile(file));
    console.log(`التلاوة ${key} رُفعت للمراجعة؛ بصمة التسجيل ${candidate.sha256}`);
    console.log("لا تُعتمد التلاوة أو المشهد تلقائيًا.");
  });

program
  .command("recitation-review")
  .description("تسجيل اعتماد استماع بشري للتلاوة المرفوعة، وليس اعتماد مشهد AV")
  .argument("<episode>", "رقم الحلقة")
  .argument("<ayah-key>", "مثل 2:255")
  .requiredOption("--reciter <name>", "الاسم الحقيقي للقارئ")
  .requiredOption("--rights-evidence <text>", "دليل حق نشر هذا التسجيل")
  .requiredOption("--reviewer <name>", "اسم المراجع بعد الاستماع")
  .requiredOption("--note <text>", "تفاصيل المراجعة")
  .requiredOption("--listened", "تأكيد الاستماع الكامل البشري")
  .action(async (episode: string, key: string, opts: {
    reciter: string; rightsEvidence: string; reviewer: string; note: string; listened: boolean;
  }) => {
    if (!opts.listened) throw new Error("الاستماع الكامل للتلاوة شرط اعتمادها.");
    const { approveOwnRecitation } = await import("../quran/manualAudio");
    const result = await approveOwnRecitation(episode, key, opts.reviewer, opts.note, true, {
      reciter: opts.reciter, rightsEvidence: opts.rightsEvidence
    });
    console.log("تم اعتماد الاستماع للتسجيل " + result.sha256 + "؛ اعتماد المشهد والنشر منفصلان.");
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
    console.log(tashkeelLine(r.tashkeel));
    console.log(`التوثيق: ${r.review.verified} من ${r.review.total} موثّق ${r.review.ok ? "✓" : "✗"}`);
    console.log(`المشاهد: ${r.total} · للتوليد: ${r.toGenerate.length} · محفوظة: ${r.cached.length}`);
    console.log(`الحروف: ${r.chars} ≈ ${r.credits} رصيد ElevenLabs`);
    if (!client && !opts.dryRun) console.log("لم يُولَّد شيء: أضف ELEVENLABS_API_KEY وELEVENLABS_VOICE_ID إلى .env.");
  });

const tashkeelLine = (t: import("../voice/tashkeelReport").TashkeelReport) =>
  !t.file ? "التشكيل: لا يوجد tashkeel.md ✗" : `التشكيل: ${(t.coverage * 100).toFixed(1)}% (${t.covered} من ${t.words} كلمة مفحوصة، الحد ${Math.round(t.min * 100)}%) ${t.ok ? "✓" : "✗"}`;

program
  .command("tashkeel")
  .description("مدقق التشكيل: الكلمات التي ستُنطق بلا تشكيل، والكلمات التي لها أكثر من نطق")
  .argument("<episode>", "رقم الحلقة")
  .action(async (episode: string) => {
    const { generateVoice } = await import("../voice/generate");
    const { tashkeel: t } = await generateVoice(episode, { dryRun: true });
    const { tashkeelDenominatorLine } = await import("../voice/tashkeelReport");
    console.log(tashkeelLine(t));
    console.log(`  ${tashkeelDenominatorLine(t)}`);
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
    console.log(`موثّق ${s.verified} من ${s.total}${s.ok ? " ✓" : ""}. القرار من الاستوديو: «١ التجهيز ← السكريبت ← سجل التوثيق».`);
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
  .command("produce <episode>")
  .description("«جهّز كل المشاهد»: يولّد صوت المشاهد التي تنقصه (بوابة التشكيل 98%، ولا يُولَّد قرآن أبدًا)، ثم يرندر مسودات AV للمشهد الحالي وما بعده بالترتيب. لا يعتمد شيئًا ولا يرسل للمراجعة؛ الاعتماد بالترتيب في الاستوديو بعد المشاهدة. يعمل مباشرة على جهاز المالك بلا كلمة مرور.")
  .option("--no-voice", "بلا توليد صوت (ترندر المشاهد التي لها صوت فقط)")
  .action(async (episode: string, opts: { voice: boolean }) => {
    const { prepareAllScenes } = await import("../studio/prepareAll");
    const { elevenLabsFromEnv } = await import("../voice/elevenlabs");
    const voiceClient = opts.voice ? elevenLabsFromEnv() : null;
    let last = "";
    try {
      const r = await prepareAllScenes(episode, {
        voiceClient,
        onProgress: (p) => {
          const line = p.phase === "voice" ? `الصوت${p.sceneId ? `: ${p.sceneId}` : ""}` : p.phase === "render" && p.sceneId ? `مسودة: ${p.sceneId} (${p.rendered.length} جاهزة)` : "";
          if (line && line !== last) console.log((last = line));
        },
      });
      const v = r.voice;
      console.log(v.status === "no-key" ? `الصوت: ${v.needed} مشهد بلا صوت ولا يوجد مفتاح صوت (أضفه من «الاتصالات والمفاتيح»).`
        : v.status === "error" ? `الصوت: توقف — ${v.error}` : `الصوت: ${v.generated} من ${v.needed} وُلّد.`);
      console.log(`المسودات: ${r.rendered.length} رُندرت${r.failed.length ? `، ${r.failed.length} تعذّرت` : ""}.`);
      for (const f of r.failed) console.log(`  ${f.id}: ${f.error.split("\n")[0]}`);
      const { inspectSceneProduction } = await import("../studio/sceneService");
      const s = await inspectSceneProduction(episode);
      console.log(`جاهز ${s.prepared.ready} من ${s.prepared.total}. الاعتماد في الاستوديو بالترتيب بعد مشاهدة كل مشهد.`);
      if (r.failed.length || v.status === "error") process.exitCode = 1;
    } catch (e) {
      console.error((e as Error).message);
      process.exitCode = 1;
    }
  });

program
  .command("horizon-audio <episode>")
  .description("دفاتر الزمن 001: اللقطات الست («خط الأفق») بصوت الراوي المعتمد وآيتي البقرة 30 والأعراف 23 بالتلاوة المرفوعة للحلقة، مضبوطة على توقيت الكلام؛ تُرفع إلى «المعاينات» (خانة -audio تبقى على الجهاز) وتحل محل المعاينة الصامتة بعد التحقق من تشغيلها. تتوقف بقائمة النواقص دون إنتاج نسخة ناقصة.")
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
  .command("upload-preview <episode> <slot> <file>")
  .description("رفع فيديو للحلقة إلى «المعاينات» في الاستوديو: يحذف النسخة القديمة لنفس الخانة ويضع الجديدة مكانها")
  .requiredOption("--title <title>", "عنوان الفيديو كما يظهر في الاستوديو")
  .option("--note <note>", "ملاحظة قصيرة تحته")
  .action(async (episode: string, slot: string, file: string, opts: { title: string; note?: string }) => {
    const { putEpisodePreview } = await import("../render/episodePreviews");
    const r = await putEpisodePreview(episode, slot, path.resolve(file), { title: opts.title, note: opts.note });
    console.log(`رُفع إلى الاستوديو: ${path.relative(projectRoot, r.file)} (رفع رقم ${r.version})${r.removed.length ? `؛ حُذف القديم: ${r.removed.join("، ")}` : ""}`);
    if (r.drive) console.log(`ونُسخ إلى Google Drive: ${r.drive}`);
    else if (r.driveError) console.log(`لم يُنسخ إلى Google Drive: ${r.driveError}`);
    else console.log("مجلد Google Drive غير مضبوط (BAL_DRIVE_PREVIEWS_DIR)؛ الفيديو محلي فقط.");
    console.log(`البصمة: ${r.sha256}`);
  });

// صندوق ملاحظات المالك (docs/studio/notes-inbox.md): Claude يبدأ كل جلسة عمل بـ «bal notes --open»
const notesCmd = program
  .command("notes")
  .description("ملاحظات المالك من الاستوديو («الحركة/النبرة غير مناسبة»): يجلب origin/studio-notes ويعرضها مع ردودها")
  .option("--open", "المفتوحة وقيد العمل فقط")
  .option("--json", "إخراج JSON")
  .option("--no-fetch", "بلا جلب (آخر نسخة محلية)")
  .action(async (opts: { open?: boolean; json?: boolean; fetch?: boolean }) => {
    const { listStudioNotes, formatNote } = await import("../studio/notesCli");
    const channel = program.opts<{ channel?: string }>().channel;
    const r = await listStudioNotes({ repoDir: projectRoot, channel, open: opts.open, fetch: opts.fetch });
    if (opts.json) { console.log(JSON.stringify(r, null, 2)); return; }
    if (r.message) console.log(r.message);
    if (r.fetched === "missing") console.log("لا فرع studio-notes على GitHub بعد (لم تُرسل ملاحظة).");
    if (!r.notes.length) { console.log(opts.open ? "لا ملاحظات مفتوحة." : "لا ملاحظات."); return; }
    console.log(r.notes.map(formatNote).join("\n\n"));
    console.log(`\n${r.notes.length} ملاحظة. للرد: bal notes resolve <id> --answer "…"`);
  });
notesCmd
  .command("resolve <id>")
  .description("يسجّل الرد على ملاحظة في resolved.json بجوارها (على main)؛ يصل المالك مع git pull")
  .requiredOption("--answer <text>", "ما الذي أُصلح، بجملة للمالك")
  .option("--status <status>", "fixed | wont-fix | in-progress", "fixed")
  .option("--by <ref>", "الـcommit أو الفرع الذي فيه الإصلاح (الافتراضي HEAD)")
  .action(async (id: string, opts: { answer: string; status: string; by?: string }) => {
    if (!["fixed", "wont-fix", "in-progress"].includes(opts.status)) throw Error("--status: fixed | wont-fix | in-progress");
    const { resolveStudioNote } = await import("../studio/notesCli");
    const r = await resolveStudioNote({ repoDir: projectRoot, id, answer: opts.answer,
      status: opts.status as "fixed" | "wont-fix" | "in-progress", fixedBy: opts.by });
    console.log(`سُجّل الرد (${opts.status}) على ${id} — ${r.note.sceneId} في ${r.file}`);
    console.log("احفظه في commit مع الإصلاح نفسه وادمجه في main؛ يظهر للمالك بعد git pull.");
  });

program
  .command("link-drive-preview <episode> <slot>")
  .description("تسجيل معاينة رُفعت إلى Google Drive من خارج جهاز المالك: الفهرس وحده يُحفظ في Git، والاستوديو يتحقق من البصمة عند التزامن")
  .requiredOption("--id <id>", "معرّف الملف على Google Drive")
  .requiredOption("--sha256 <sha>", "بصمة الفيديو")
  .requiredOption("--size <bytes>", "حجم الفيديو بالبايت")
  .requiredOption("--title <title>", "عنوان الفيديو كما يظهر في الاستوديو")
  .option("--note <note>", "ملاحظة قصيرة تحته")
  .action(async (episode: string, slot: string, opts: { id: string; sha256: string; size: string; title: string; note?: string }) => {
    const { linkDrivePreview } = await import("../render/episodePreviews");
    const e = await linkDrivePreview(episode, slot, { id: opts.id, sha256: opts.sha256, size: Number(opts.size), title: opts.title, note: opts.note });
    console.log(`سُجّل في المعاينات (رفع رقم ${e.version}): ${e.drive!.url}`);
  });

// معاينات الجلسات السحابية (D75): الفيديو على فرع previews/<القناة>/<الحلقة>/<الخانة> لا في main
const cloudPreviewCmd = program
  .command("cloud-preview")
  .description("معاينات الجلسات السحابية إلى الاستوديو عبر فرع Git خاص بكل خانة (previews/*)، لا في main أبدًا");
cloudPreviewCmd
  .command("push <episode> <slot> <file>")
  .description("يدفع الفيديو (أجزاء ≤ 45 م.ب في commit يتيم) إلى فرع الخانة ويستبدله، ويسجّل الخانة في previews/index.json")
  .requiredOption("--title <title>", "عنوان الفيديو كما يظهر في الاستوديو (اذكر حالته: جاهز للمراجعة)")
  .option("--note <note>", "ملاحظة قصيرة تحته")
  .option("--commit-index", "يحفظ previews/index.json في commit على الفرع الحالي (وحده)")
  .option("--remote <name>", "الـremote", "origin")
  .action(async (episode: string, slot: string, file: string, opts: { title: string; note?: string; commitIndex?: boolean; remote: string }) => {
    const { resolveEpisodeDir } = await import("../script/episodes");
    const { pushCloudPreview } = await import("../render/cloudPreviews");
    const { arabicMegabytes } = await import("../render/episodePreviews");
    const r = await pushCloudPreview({ episodeDir: await resolveEpisodeDir(episode), slot, file: path.resolve(file),
      title: opts.title, note: opts.note, remote: opts.remote, commitIndex: opts.commitIndex });
    const rel = path.relative(projectRoot, r.indexFile);
    console.log(`دُفع إلى ${r.ref.replace("refs/heads/", "")} (commit ${r.commit.slice(0, 10)}، ${r.parts.length} جزء، ${arabicMegabytes(r.size)})`);
    console.log(`البصمة: ${r.sha256}`);
    console.log(`سُجّلت الخانة في ${rel} (رفع رقم ${r.entry.version}).`);
    if (r.indexCommitted) console.log(`وحُفظ الفهرس في commit ${r.indexCommitted.slice(0, 10)} على الفرع الحالي؛ يصل الاستوديو بعد دمجه في main.`);
    else console.log(`الخطوة التالية: احفظ ${rel} وحده في commit وادمجه في main بالمسار المعتاد (بوابة الدفع كاملة)، مثل:\n  git add ${rel} && git commit -m "معاينة: ${slot}" -- ${rel}`);
  });
cloudPreviewCmd
  .command("pull <episode> <slot>")
  .description("على جهاز المالك: يحمّل معاينة الخانة من فرعها ويتحقق من بصمتها (مثل زر «حمّل المعاينة» في الاستوديو)")
  .option("--remote <name>", "الـremote", "origin")
  .action(async (episode: string, slot: string, opts: { remote: string }) => {
    const { resolveEpisodeDir } = await import("../script/episodes");
    const { downloadCloudPreview } = await import("../render/cloudPreviews");
    let last = -1;
    const r = await downloadCloudPreview({ episodeDir: await resolveEpisodeDir(episode), name: slot, remote: opts.remote,
      onProgress: (p) => { if (p.pct >= last + 10 || p.pct === 100) { last = p.pct; console.log(`PROGRESS ${p.pct} ${p.phase}`); } } });
    console.log(`حُمّلت المعاينة وتُحقق منها: ${path.relative(projectRoot, r.file)} (${r.sha256.slice(0, 12)})`);
  });
cloudPreviewCmd
  .command("prune")
  .description("يحذف من GitHub فروع المعاينات التي لم تعد خاناتها في previews/index.json تشير إليها (تجربة افتراضيًا)")
  .option("--apply", "احذف فعلًا (بدونه: عرض فقط)")
  .option("--against <ref>", "اقرأ الفهارس من مرجع (مثل origin/main) بدل ملفات العمل")
  .option("--remote <name>", "الـremote", "origin")
  .action(async (opts: { apply?: boolean; against?: string; remote: string }) => {
    const { pruneCloudPreviews } = await import("../render/cloudPreviews");
    const r = await pruneCloudPreviews({ repoDir: projectRoot, remote: opts.remote, apply: opts.apply, against: opts.against });
    for (const ref of r.keep) console.log(`  باقٍ   ${ref}`);
    for (const ref of r.remove) console.log(`  ${r.dryRun ? "سيُحذف" : "حُذف  "} ${ref}`);
    console.log(r.dryRun ? `تجربة: ${r.remove.length} فرع سيُحذف. للحذف: --apply` : `حُذف ${r.deleted.length} فرع.`);
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
  .option("--stills", "لوحة لكل مشهد من الخطة الحالية (رندر صامت عند لحظة لوحته، 640 بكسل) في storyboard-stills/ بجوار السكريبت؛ لا تعتمد شيئًا")
  .option("--only <ids>", "مع --stills: مشاهد محددة مفصولة بفواصل (تُرفض إن تغيّرت الخطة أو المحرك منذ آخر لوحات)")
  .option("--check-stills", "هل لوحات storyboard-stills/ هي ما سيُرندر الآن من الخطة والمحرك؟")
  .action(async (episode: string, opts: { motion?: boolean; stills?: boolean; only?: string; checkStills?: boolean }) => {
    if (opts.stills) {
      const { renderStoryboardStills } = await import("../render/storyboardStills");
      const only = opts.only?.split(/[,،\s]+/).filter(Boolean);
      const r = await renderStoryboardStills(episode, { only, onProgress: (p, msg) => console.log(`PROGRESS ${p} ${msg}`) });
      console.log(`${r.rendered} لوحة من الخطة الحالية في ${path.relative(projectRoot, r.dir)} (بلا صوت، للمراجعة فقط؛ ليست اعتمادًا).`);
      return;
    }
    if (opts.checkStills) {
      const { stillsStatus } = await import("../render/storyboardStills");
      const s = await stillsStatus(episode);
      console.log(!s.exists ? "لا لوحات محفوظة بعد: bal storyboard <الحلقة> --stills"
        : s.current ? "اللوحات المحفوظة هي ما سيُرندر من الخطة والمحرك الحاليين ✓"
        : `اللوحات قديمة${s.stale.length ? `؛ تغيّر: ${s.stale.join("، ")}` : ""}${s.missing.length ? `؛ ناقصة: ${s.missing.join("، ")}` : ""}. أعدها: bal storyboard <الحلقة> --stills`);
      if (!s.current) process.exitCode = 1;
      return;
    }
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
    console.log(`معتمد ${s.approved} من ${s.total}${s.ok ? " ✓" : ""}${s.changed.length ? `؛ تغيّر بعد الاعتماد: ${s.changed.join("، ")}` : ""}. الاعتماد من الاستوديو: «١ التجهيز» ← «اعتمد التجهيز» مرة واحدة؛ ما تغيّر بعده يسجّله النظام وتُراجَع مشاهده في «٢ المشاهد».`);
    if (!s.ok) process.exitCode = 1;
  });

program
  .command("scenes-review")
  .description("سجل المراجعة القديم للمشاهد (للقراءة فقط؛ الاعتماد الآن في «٢ المشاهد»)")
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
    console.log(`سليم ${s.ok} من ${s.total}${s.done ? " ✓" : ""}. القرار الآن من الاستوديو: «٢ المشاهد» (يُعتمد كل مشهد بصوته وصورته).`);
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
  .action(async (episode: string, opts: { skipVideo?: boolean; shorts?: boolean; preview?: boolean }) => {
    const { packageEpisode } = await import("../package/package");
    const r = await packageEpisode({ episode, skipVideo: opts.skipVideo, stage: opts.shorts ? "shorts" : "episode", quality: opts.preview ? "preview" : "master", onProgress: (m) => console.log(m) });
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
  .description("إنشاء قناة جديدة بقالب محايد وقواعد آمنة (أو ببنية قناة موجودة مع --from)")
  .argument("<id>", "معرّف بالإنجليزية، مثل bilislam-tr")
  .requiredOption("-n, --name <name>", "اسم القناة كما يظهر في الفيديو")
  .requiredOption("-l, --lang <lang>", "اللغة: ar | tr | en")
  .option("--latin <name>", "الاسم بالحروف اللاتينية")
  .option("--from <id>", "قناة تُنسخ بنية هويتها (بألوان محايدة) وقواعدها؛ بدونها القالب المحايد")
  .option("--no-quran", "قناة لا تستشهد بالقرآن والحديث")
  .action(async (id: string, opts: { name: string; lang: string; latin?: string; from?: string; quran: boolean }) => {
    const { createChannel } = await import("../channel/create");
    const dir = await createChannel({ id, name: opts.name, language: opts.lang, nameLatin: opts.latin, from: opts.from, quran: opts.quran });
    console.log(`أُنشئت القناة في ${path.relative(projectRoot, dir)}.`);
    console.log("الخطوات التالية: عدّل المجالات في channel.json، والألوان من تبويب الهوية في الاستوديو، ثم: bal --channel " + id + " new 001 …");
  });

const decisionCmd = program.command("decision").description("سجلات القرارات (ترقيم D عام لكل القنوات)");
decisionCmd
  .command("new")
  .description("يخصص رقم القرار التالي (بعد كل سجلات docs/*/0[67]-decisions.md وتاريخ main)، ويضيف عنوانه إن طُلب")
  .argument("<title>", "عنوان القرار")
  .option("--log <channel...>", "سجل القناة الذي يُعرَّف فيه القرار، ثم سجلات تُكتب فيها إحالة إليه")
  .action(async (title: string, opts: { log?: string[] }) => {
    const d = await import("../../scripts/decisions.mjs");
    const id = d.nextDecisionId(projectRoot);
    if (!opts.log?.length) { console.log(id); return; }
    const all = d.decisionLogs(projectRoot);
    const files = opts.log.map((ch) => {
      const f = all.find((x) => x.startsWith(`docs/${ch}/`));
      if (!f) throw new Error(`لا سجل قرارات للقناة «${ch}». المتاح: ${all.join("، ")}`);
      return f;
    });
    for (const w of d.appendDecision(projectRoot, id, title.trim(), files)) console.log(`${w.file}: ${w.heading}`);
    console.log(id);
  });

program.parseAsync().catch((err: Error) => {
  console.error(`خطأ: ${err.message}`);
  process.exitCode = 1;
});
