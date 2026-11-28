import path from "node:path";
import { readFile } from "node:fs/promises";
import { Command } from "commander";
import { parseScript } from "../script/parse";
import { checkForChannel } from "../script/checkChannel";
import { formatReport } from "../script/report";
import { createEpisode, resolveScriptPath } from "../script/episodes";
import { projectRoot } from "../config/paths";

const program = new Command();
/** D213: لا رندر ولا صوت لحلقة «مسودة» ولا في قناة مجمّدة (D211)؛ يخرج برسالة المالك */
const assertProducible = async (episode: string) => {
  const { productionBlockFor } = await import("../studio/stockStore");
  const { currentChannelId } = await import("../channel");
  const why = await productionBlockFor(currentChannelId(), await resolveScriptPath(episode));
  if (why) { console.error(why); process.exit(1); }
};


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
  .command("compile")
  .description("الفيديو التجميعي: يوصل النسخ النهائية لحلقات بإذن نشر بترتيبها بلا إعادة ترميز، ويكتب الفصول؛ لا يرفع شيئًا")
  .argument("<name>", "اسم التجميع (مثل 2026-11)")
  .argument("[episodes...]", "أرقام الحلقات بالترتيب")
  .requiredOption("--title <title>", "عنوان التجميع")
  .option("--series <id>", "كل حلقات السلسلة بترتيب أرقامها بدل قائمة الحلقات")
  .action(async (name: string, episodes: string[], opts: { title: string; series?: string }) => {
    const { makeCompilation } = await import("../package/compilation");
    let list = episodes;
    if (opts.series) {
      const { episodesBySeries } = await import("../channel/seriesStore");
      list = (await episodesBySeries()).filter((e) => e.series === opts.series).sort((a, b) => (a.number ?? 1e9) - (b.number ?? 1e9) || a.id.localeCompare(b.id)).map((e) => e.id);
      if (!list.length) throw Error(`لا حلقات في السلسلة «${opts.series}».`);
    }
    const r = await makeCompilation({ name, title: opts.title, episodes: list }, (m) => console.log(m));
    console.log(`التجميع: ${path.relative(projectRoot, r.out)} (${Math.round(r.seconds / 60)} د). شاهده كاملًا قبل النشر اليدوي.\nالفصول للوصف:\n${r.chapters}`);
  });

program
  .command("sfx-suggest")
  .description("D158 الخطوة ٣: اقتراح المؤثرات بالقواعد الست (الانتقال، والمكان، والكلمة)؛ للعرض فقط إلا بـ --write")
  .argument("<episode>", "رقم الحلقة")
  .option("--write", "أضف الاقتراحات إلى الخطة (لا يمس مؤثرات المالك)، واحذف المؤثرات التي لا ملف لها")
  .action(async (episode: string, opts: { write?: boolean }) => {
    const { existsSync } = await import("node:fs");
    const { loadPlan, savePlan } = await import("../plan/io");
    const { collectMedia } = await import("../plan/collect");
    const { suggestSfx, missingSfx } = await import("../plan/sfxSuggest");
    const { sfxLibrary } = await import("../../brand/sfx");
    const plan = await loadPlan(episode);
    if (!plan) throw Error("لا توجد خطة للحلقة.");
    const media = await collectMedia(episode, plan);
    const lib = new Set(sfxLibrary.map((d) => d.id).filter((id) => existsSync(path.join(process.cwd(), "assets", "sfx", `${id}.mp3`))));
    const s = suggestSfx(plan, media, lib);
    const missing = missingSfx(plan, lib);
    const voiced = plan.chapters.flatMap((c) => c.scenes).filter((x) => media.voice[x.id]?.text === x.narration.trim()).length;
    console.log(`اقتراحات المؤثرات: ${s.length} (توقيت ${voiced ? "من صوت الراوي" : "تقديري — ولّد الصوت أولًا لتوقيت دقيق"})`);
    for (const x of s) console.log(`  ${x.scene.padEnd(8)} ${x.sfx.at.toFixed(2).padStart(6)} ث  ${x.sfx.id.padEnd(15)} ${x.why}`);
    if (missing.length) console.log(`مؤثرات في الخطة بلا ملف (تُتجاهل في الرندر): ${missing.map((m) => `${m.scene}: ${m.id}`).join("، ")}`);
    if (!opts.write) { console.log("لم يُكتب شيء. اسمعها بعد الإضافة في المعاينة؛ للإضافة: --write"); return; }
    const byScene = new Map<string, typeof s>();
    for (const x of s) byScene.set(x.scene, [...(byScene.get(x.scene) ?? []), x]);
    for (const c of plan.chapters) for (const sc of c.scenes) {
      sc.sfx = sc.sfx.filter((x) => lib.has(x.id));
      if (!sc.sfx.length && byScene.has(sc.id)) sc.sfx = byScene.get(sc.id)!.map((x) => x.sfx);
    }
    await savePlan(episode, plan);
    console.log(`كُتبت ${s.length} مؤثرًا في الخطة${missing.length ? `، وحُذف ${missing.length} بلا ملف` : ""}. حدّث معاينة المشاهد لتسمعها.`);
  });

program
  .command("tone-map-sync")
  .description("دفاتر الزمن: يطابق مقاطع خريطة النبرة بسطور التشكيل الحالي بالنص (KI-088)؛ للعرض فقط إلا بـ --write")
  .argument("<episode>", "رقم الحلقة (001) أو مسار السكريبت")
  .option("--write", "اكتب الإصدار التالي من الخريطة (السابق يُحفظ باسمه). لا يولّد صوتًا ولا يحذف تسجيلًا")
  .option("--keep-recorded", "لا يتغير نطق أي مقطع: المختلف عن التشكيل يبقى بنصه المسجَّل ويُكتب استثناءً بقرار المالك")
  .action(async (episode: string, opts: { write?: boolean; keepRecorded?: boolean }) => {
    const file = await resolveScriptPath(episode);
    const dir = path.dirname(file);
    const mapFile = path.join(dir, "tone-map.json");
    const raw = await readFile(mapFile, "utf8");
    const tashkeel = await readFile(path.join(dir, "tashkeel.md"), "utf8");
    const { syncToneMap } = await import("../voice/toneMapSync");
    const { archiveNameFor } = await import("../voice/toneMapOverride");
    const planRaw = await readFile(path.join(dir, "plan.json"), "utf8");
    const inPlan = new Set((JSON.parse(planRaw) as { chapters: { scenes: { id: string }[] }[] }).chapters.flatMap((ch) => ch.scenes.map((s) => s.id)));
    const dropScenes = [...new Set((JSON.parse(raw) as { segments: { scene: string }[] }).segments.map((s) => s.scene).filter((s) => !inPlan.has(s)))];
    if (dropScenes.length) console.log(`مقاطع لمشاهد ليست في الخطة تُرفع من الخريطة (تسجيلاتها باقية في ملفاتها): ${dropScenes.join("، ")}`);
    const r = syncToneMap(raw, tashkeel, { at: new Date().toISOString(), script: await readFile(file, "utf8"), plan: planRaw, keepRecorded: opts.keepRecorded, dropScenes });
    const c = (k: string) => r.report.rows.filter((x) => x.kind === k).length;
    console.log(`خريطة النبرة ${r.from}: ${r.report.rows.length} مقطعًا طوبق بسطره في التشكيل بالنص — مطابق ${c("same")}، كتابة فقط ${c("ortho")}، نطق تغيّر ${c("pronunciation")}`);
    for (const x of r.report.rows.filter((y) => y.kind === "pronunciation"))
      console.log(`  ${x.id} (${x.scene}): ${x.changed.map((w) => `«${w.from}» ← «${w.to}»`).join("، ")}`);
    if (opts.keepRecorded && r.report.rows.some((y) => y.kind === "pronunciation")) console.log("بقرار المالك: هذه المواضع تبقى بنطقها المسجَّل، ولا يتغير نص أي مقطع ولا تسجيل.");
    if (r.changedScenes.length) console.log(`المشاهد التي يتغير نطق صوتها: ${r.changedScenes.join("، ")} — تسجيلاتها باقية، وتظهر «تحتاج صوتًا» حتى يولّدها المالك بضغطته.`);
    if (!opts.write) { console.log("لم يُكتب شيء. للكتابة: --write"); return; }
    const { writeFile } = await import("node:fs/promises");
    await writeFile(path.join(dir, archiveNameFor(r.from)), raw);
    const { writeJsonAtomic } = await import("../io/atomicJson");
    await writeJsonAtomic(mapFile, JSON.parse(r.raw));
    console.log(`كُتبت ${r.to}، والسابق محفوظ: ${archiveNameFor(r.from)}`);
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
  .command("plan-from-scenes")
  .description("دفاتر الزمن (البدايات): الخطة المصمَّمة «خط الأفق» من scenes.md والسكريبت، بالبنية نفسها لخطة 001. عرض فقط إلا بـ --write")
  .argument("<episode>", "رقم الحلقة")
  .option("--write", "اكتب plan.json (نسخة احتياطية من القائمة أولًا؛ ويرفض إن بقي نص بلا مشهد أو لقطة غير معتمدة)")
  .option("--overwrite-designed", "اكتب فوق خطة قائمة مصمَّمة (تأكيد صريح؛ تُحفظ نسخة احتياطية أولًا)")
  .action(async (episode: string, opts: { write?: boolean; overwriteDesigned?: boolean }) => {
    const { planFromScenesFile } = await import("../plan/fromScenesFile");
    try {
      const r = await planFromScenesFile(episode, { write: opts.write === true, overwriteDesigned: opts.overwriteDesigned === true });
      const scenes = r.plan.chapters.flatMap((c) => c.scenes);
      const count = (t: string) => scenes.filter((s) => s.template === t).length;
      console.log(`الخطة من scenes.md: ${scenes.length} مشهدًا — horizon-shot ${count("horizon-shot")}، بطاقة آية ${count("verse-card")}، بطاقة حديث ${count("hadith-card")}.`);
      if (r.report.wordsOnly.length) console.log(`بالكلمات وحدها (لقطة pending): ${r.report.wordsOnly.join("، ")}`);
      if (r.report.unusedRows.length) console.log(`صفوف في scenes.md بلا نص في السكريبت (لا تدخل الخطة): ${r.report.unusedRows.join("، ")}`);
      if (r.droppedShorts > 0) console.log(`شورتس في الخطة القديمة لم يعد لها مشهد (لم تُنقل): ${r.droppedShorts}`);
      if (r.problems.length) { console.log(`مشكلات (${r.problems.length}):\n${r.problems.map((p) => `- ${p}`).join("\n")}`); process.exitCode = 1; }
      if (r.written) console.log(`كُتبت: ${path.relative(projectRoot, r.file)}${r.backup ? ` (نسخة احتياطية: ${path.basename(r.backup)})` : ""}${r.seriesLinkWritten ? "، وملف انتماء السلسلة series.json" : ""}`);
      else if (!opts.write) console.log("عرض فقط؛ للكتابة: --write");
    } catch (e) {
      console.error((e as Error).message);
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
  .command("repair-sentences")
  .description("إصلاح لمرة واحدة لملف الجمل (voice/sentences.json) بعد نقل المعرّفات مع نص تغيّر (D97): مصالحة ثابتة المعرّفات، وإرجاع التسجيلات القديمة إلى جملها «قديم». تجربة افتراضيًا، ولا يحذف شيئًا")
  .argument("<episode>", "رقم الحلقة")
  .option("--apply", "اكتب التغيير (تُحفظ نسخة voice/sentences.before-repair.json أولًا)")
  .action(async (episode: string, opts: { apply?: boolean }) => {
    const { repairSentences } = await import("../voice/sentenceVoice");
    const r = await repairSentences(episode, { apply: opts.apply === true });
    if (!r.reconciled.length && !r.restored.length) { console.log("ملف الجمل سليم؛ لا شيء يحتاج إصلاحًا."); return; }
    console.log(`مشاهد تُصالَح مع نص الخطة: ${r.reconciled.length}${r.reconciled.length ? ` (${r.reconciled.join("، ")})` : ""}`);
    console.log(`تسجيلات قديمة تعود إلى جملها («قديم»): ${r.restored.length}`);
    for (const x of r.restored) console.log(`  ${x.sceneId} / ${x.sentenceId} ← ${x.file}`);
    console.log("لا يُحذف تسجيل ولا يُولَّد شيء.");
    if (opts.apply) console.log(r.written ? `كُتب. النسخة السابقة: ${r.backup}` : "لم يُكتب.");
    else console.log("تجربة فقط؛ للكتابة: --apply");
  });

program
  .command("voice-timing")
  .description("قياس فقط (D110): هل يتجاوز توقيت كلمات التسجيلات المحلية طرفي ملفها بعد فكّه؟ يقرأ الجمل وأجزاء دفاتر الزمن ويصنّفها بقاعدة التركيب (سليم / حُصر بتنبيه / تالف). لا توليد ولا كتابة ولا حذف")
  .argument("[episode]", "رقم الحلقة (الافتراضي: كل الحلقات)")
  .option("--all-channels", "كل القنوات (الافتراضي: القناة الحالية أو --channel)")
  .option("--takes", "والتسجيلات السابقة المحفوظة (takes) أيضًا")
  .option("--all", "اعرض كل ملف، لا ما يحتاج نظرًا وحده")
  .option("--json", "إخراج JSON")
  .action(async (episode: string | undefined, opts: { allChannels?: boolean; takes?: boolean; all?: boolean; json?: boolean }) => {
    if (episode !== undefined && !/^\d{3}$/.test(episode)) throw new Error("رقم الحلقة ثلاثة أرقام، مثل 001.");
    const { channelsDir, currentChannelId, listChannels } = await import("../channel");
    const { checkVoiceTimings, formatTimingReport } = await import("../voice/timingCheck");
    const r = await checkVoiceTimings({ channelsDir: channelsDir(), channels: opts.allChannels ? listChannels() : [currentChannelId()], episode, takes: opts.takes === true });
    console.log(opts.json ? JSON.stringify(r, null, 2) : formatTimingReport(r, opts.all === true));
  });

// العمل ٩: فحص النطق المحلي (src/voice/pronunciation/). القياس قبل التفعيل؛ التثبيت والتفعيل بزر المالك في الاستوديو.
const pronCmd = program
  .command("pron-check")
  .description("فحص النطق المحلي (faster-whisper على هذا الجهاز، بلا رفع للصوت): الحالة، وقياس الإنذار الكاذب، وفحص حلقة");
pronCmd
  .command("status")
  .description("هل الأداة مثبّتة ومفعّلة، وآخر قياس")
  .option("--json", "إخراج JSON")
  .action(async (opts: { json?: boolean }) => {
    const { toolStatus } = await import("../voice/pronunciation/service");
    const s = await toolStatus();
    if (opts.json) { console.log(JSON.stringify(s, null, 2)); return; }
    console.log(s.installed ? `مثبّت (faster-whisper ${s.version}، النموذج ${s.model})، ${s.enabled ? "مفعّل" : "غير مفعّل"}.` : "فحص النطق غير مثبّت (يُثبَّت بزر «ثبّت فحص النطق» في «الاتصالات والمفاتيح»).");
    if (s.measurement) console.log(`آخر قياس ${s.measurement.at}: الإنذار الكاذب ${(s.measurement.rate * 100).toFixed(1)}% (${s.measurement.basis === "heard" ? "على جمل «سمعتها»" : "على كل الجمل، حدّ أعلى"}).`);
  });
pronCmd
  .command("measure")
  .description("قياس الإنذار الكاذب على جمل القنوات الثلاث المولَّدة على هذا الجهاز (يحفظ النتيجة، ولا يفعّل الفحص)")
  .option("--per-channel <n>", "أقصى عدد جمل لكل قناة", "60")
  .option("--channel <id...>", "قنوات بعينها (الافتراضي: الثلاث)")
  .option("--json", "إخراج JSON")
  .action(async (opts: { perChannel: string; channel?: string[]; json?: boolean }) => {
    const { measureFalseAlarms } = await import("../voice/pronunciation/service");
    const { readState, writeState } = await import("../voice/pronunciation/whisperTool");
    const m = await measureFalseAlarms({ channels: opts.channel, perChannel: Math.max(1, Number(opts.perChannel) || 60), onProgress: (_d, _n, l) => process.stderr.write(`\r${l}        `) });
    process.stderr.write("\n");
    await writeState({ ...(await readState()), measurement: m });
    if (opts.json) { console.log(JSON.stringify(m, null, 2)); return; }
    console.log(`جمل مفرَّغة: ${m.sentences} (تعذّر ${m.failed})، نُبّه على ${m.flagged}؛ «سمعتها»: ${m.heard}، نُبّه على ${m.heardFlagged}.`);
    for (const [c, x] of Object.entries(m.channels)) console.log(`  ${c}: ${x.sentences} جملة، تنبيه على ${x.flagged}`);
    console.log(`الإنذار الكاذب: ${(m.rate * 100).toFixed(1)}% (${m.basis === "heard" ? "على جمل «سمعتها»" : "على كل الجمل، حدّ أعلى"}).`);
    for (const e of m.examples) console.log(`  - ${e.channel} ${e.episode} ${e.sentenceId}: «${e.word}»${e.heard ? ` ← «${e.heard}»` : ""}`);
  });

program
  .command("render")
  .description("رندر الحلقة من plan.json")
  .argument("<episode>", "رقم الحلقة")
  .option("--portrait", "النسخة العمودية 9:16")
  .option("--chapter <n>", "فصل واحد فقط (شورت)")
  .option("--master", "بأعلى جودة 4K (الافتراضي معاينة 1080p)")
  .action(async (episode: string, opts: { portrait?: boolean; chapter?: string; master?: boolean }) => {
    await assertProducible(episode);
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
    // نفس npm run app (D101): استوديو واحد على 4321 ومشرف يعيد تشغيله بعد التحديثات
    spawn(process.execPath, [path.join(projectRoot, "scripts", "studio.mjs")], { cwd: projectRoot, stdio: "inherit" });
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
    if (!opts.dryRun) await assertProducible(episode);
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
  .description("«جهّز كل المشاهد»: يرندر مسودات AV لكل مشهد صوته جاهز (مجانًا). لا يولّد صوتًا إلا مع --generate-voice (يصرف رصيدًا، بوابة التشكيل 98%، ولا يُولَّد قرآن أبدًا). لا يعتمد شيئًا ولا يرسل للمراجعة؛ الاعتماد في الاستوديو بعد المشاهدة. يعمل مباشرة على جهاز المالك بلا كلمة مرور.")
  .option("--generate-voice", "يولّد الصوت الناقص أولًا (يصرف رصيدًا): يطبع العدد والحروف قبل البدء")
  .option("--no-voice", "(الافتراضي الآن) بلا توليد صوت")
  .action(async (episode: string, opts: { voice: boolean; generateVoice?: boolean }) => {
    const { prepareAllScenes, voiceGenerationPlan } = await import("../studio/prepareAll");
    const { elevenLabsFromEnv } = await import("../voice/elevenlabs");
    // Owner decision (15–16 Nov): nothing paid without his explicit request; the flag is that request.
    const paid = opts.generateVoice === true && opts.voice !== false;
    const voiceClient = paid ? elevenLabsFromEnv() : null;
    let last = "";
    try {
      const plan = paid ? await voiceGenerationPlan(episode) : null;
      if (plan) console.log(`الصوت: ${plan.sentences} جملة في ${plan.scenes.length} مشهد — نحو ${plan.chars} حرف من الرصيد.`);
      const r = await prepareAllScenes(episode, {
        voiceClient, renderOnly: !paid, ...(plan ? { voiceScenes: plan.scenes } : {}),
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

// سجل الأخطاء المحلي (D112، .studio/errors.jsonl): آخر الأخطاء مجمّعة بالرسالة
program
  .command("errors")
  .description("آخر أخطاء الاستوديو على هذا الجهاز (.studio/errors.jsonl)، مجمّعة بالرسالة مع عدد مرات كل منها")
  .option("--last <n>", "عدد السطور الأخيرة التي تُقرأ من السجل", "500")
  .option("--limit <n>", "عدد المجموعات المعروضة", "20")
  .option("--json", "إخراج JSON")
  .action(async (opts: { last: string; limit: string; json?: boolean }) => {
    const { errorsFileFor, formatErrorGroups, groupErrors, readErrorRecords } = await import("../studio/errorLog");
    const file = errorsFileFor(projectRoot);
    const records = (await readErrorRecords(file)).slice(-Math.max(1, Number(opts.last) || 500));
    const groups = groupErrors(records);
    const shown = file.startsWith(projectRoot + path.sep) ? path.relative(projectRoot, file) : file;
    if (opts.json) { console.log(JSON.stringify({ file: shown, records: records.length, groups }, null, 2)); return; }
    if (!records.length) { console.log("لا أخطاء مسجلة على هذا الجهاز."); return; }
    console.log(formatErrorGroups(groups, Math.max(1, Number(opts.limit) || 20)));
    console.log(`\n${records.length} خطأ في ${groups.length} مجموعة (${shown}). لإرسال خطأ: «أرسل المشكلة» في الاستوديو.`);
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
    // حالة main في CI أولًا (KI-068، D137): حفظ الاستوديو لا يشغّل الاختبارات، فلا يحمرّ main بصمت
    if (opts.fetch !== false) {
      const ci = (await import("../studio/mainCiStatus")).mainCiStatus(projectRoot);
      if (ci) console.log(ci + "\n");
    }
    if (r.message) console.log(r.message);
    if (r.fetched === "missing") console.log("لا فرع studio-notes على GitHub بعد (لم تُرسل ملاحظة).");
    if (!r.notes.length) { console.log(opts.open ? "لا ملاحظات مفتوحة." : "لا ملاحظات."); return; }
    // ملاحظة مفتوحة وحلها جاهز في فرع لم يُدمج: تُذكر تحتها حتى لا يُكتب الإصلاح مرتين أو يُنسى (c1-s3، ١٥–١٧ نوفمبر)
    const { pendingFixes, formatPendingFix } = await import("../studio/pendingFixes");
    const waiting = opts.fetch === false ? new Map<string, string[]>() : pendingFixes(projectRoot, r.notes.filter((n) => n.status === "open").map((n) => n.id));
    console.log(r.notes.map((n) => waiting.has(n.id) ? `${formatNote(n)}\n${formatPendingFix(waiting.get(n.id)!)}` : formatNote(n)).join("\n\n"));
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
  .command("migrate")
  .description("ترحيل السجلات القديمة: نسخة احتياطية ثم أرشيف محلي، ولا يُعتمد بها شيء (يعمل آليًا مع تشغيل الاستوديو)")
  .argument("<what>", "legacy")
  .option("--dry-run", "اعرض ما سيُرحَّل دون تغيير")
  .action(async (what: string, opts: { dryRun?: boolean }) => {
    if (what !== "legacy") throw new Error("المتاح: bal migrate legacy");
    const { channelsDir } = await import("../channel");
    const { migrateLegacyRecords, legacyMigrationSummary } = await import("../studio/legacyMigration");
    console.log(legacyMigrationSummary(await migrateLegacyRecords({ channelsDir: channelsDir(), dryRun: opts.dryRun === true })));
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
    await assertProducible(episode);
    const { packageEpisode } = await import("../package/package");
    const r = await packageEpisode({ episode, skipVideo: opts.skipVideo, stage: opts.shorts ? "shorts" : "episode", quality: opts.preview ? "preview" : "master", onProgress: (m) => console.log(m) });
    console.log(`جاهز في ${path.relative(projectRoot, r.dir)}:\n- ${r.files.join("\n- ")}`);
  });

// D226: جهاز رندر ثانٍ (ويندوز) للشورتس. الماك يرسل ويستلم ويتحقق؛ العامل يرندر فقط (docs/studio/windows-worker.md).
program
  .command("worker-submit")
  .description("D226: إرسال الشورتس إلى جهاز الرندر الثاني بعد اعتماد النسخة النهائية (المجلد المشترك)")
  .argument("<episode>", "رقم الحلقة")
  .option("--short <n>", "شورت واحد برقمه")
  .option("--shorts", "كل الشورتس (الافتراضي)")
  .requiredOption("--share <path>", "المجلد المشترك على الماك، مثل /Volumes/bal-share")
  .action(async (episode: string, opts: { short?: string; shorts?: boolean; share: string }) => {
    await assertProducible(episode);
    const only = opts.short !== undefined ? Number(opts.short) : undefined;
    if (only !== undefined && (!Number.isInteger(only) || only < 1)) throw new Error("رقم الشورت غير صالح.");
    const { submitWorkerShorts } = await import("../render/worker/macSide");
    const r = await submitWorkerShorts(episode, path.resolve(opts.share), { only, log: (m) => console.log(m) });
    console.log(`أُرسلت ${r.written.length} مهمة (والموجودة من قبل ${r.skipped.length}) بالـcommit ${r.commit.slice(0, 8)}. بعد انتهاء العامل: bal worker-collect ${episode} --share ${opts.share}`);
  });

program
  .command("worker-collect")
  .description("D226: استلام شورتس جهاز الرندر الثاني بعد التحقق منها على الماك (البصمة والأبعاد والمدة والحركة والأثر)")
  .argument("<episode>", "رقم الحلقة")
  .requiredOption("--share <path>", "المجلد المشترك على الماك، مثل /Volumes/bal-share")
  .option("--replace", "نقل شورت قديم بالاسم نفسه إلى superseded/ بدل الرفض")
  .action(async (episode: string, opts: { share: string; replace?: boolean }) => {
    const { collectWorkerShorts } = await import("../render/worker/macSide");
    const r = await collectWorkerShorts(episode, path.resolve(opts.share), { replace: opts.replace, log: (m) => console.log(m) });
    for (const x of r.refused) console.error(`مرفوض ${x.id}:\n  - ${x.reasons.join("\n  - ")}`);
    console.log(`استُلم ${r.imported.length}، ورُفض ${r.refused.length}. المرفوض لا يدخل الحزمة أبدًا.`);
    if (r.refused.length) process.exitCode = 1;
  });

// D232 (المرحلة ٢): رندر الاستوديو على الويندوز ثم استيراده بعد التحقق إلى السجل نفسه (src/render/worker/studioJobs.ts)
program
  .command("worker-submit-scenes")
  .description("D232: إرسال قطع المشاهد إلى جهاز الرندر (كل المفتوحة بلا مسودة جاهزة، أو مشاهد بعينها) بعد بوابات المحرر والسجل؛ لا صوت يُولَّد")
  .argument("<episode>", "رقم الحلقة")
  .requiredOption("--share <path>", "المجلد المشترك على الماك، مثل /Volumes/bal-share")
  .option("--scenes <ids>", "مشاهد بعينها مفصولة بفواصل («أنتج هذا المشهد» لكل منها)")
  .action(async (episode: string, opts: { share: string; scenes?: string }) => {
    await assertProducible(episode);
    const { submitStudioScenes } = await import("../render/worker/studioJobs");
    const r = await submitStudioScenes(episode, path.resolve(opts.share), { scenes: opts.scenes?.split(",").map((x) => x.trim()).filter(Boolean), log: (m) => console.log(m) });
    console.log(`أُرسل ${r.sent.length} مشهدًا (والموجود من قبل ${r.existing.length}) بالـcommit ${r.commit.slice(0, 8)}. التقدم: bal worker-status --share ${opts.share}؛ وبعد انتهائها: bal worker-import ${episode} --share ${opts.share}`);
  });

for (const [name, kind, what] of [["worker-submit-prefinal", "prefinal", "نسخة قبل النهائية (كل القطع الحالية)"], ["worker-submit-assembly", "assembly", "التجميع (بعد اعتماد كل المشاهد)"]] as const) {
  program
    .command(name)
    .description(`D232: إرسال ${what} إلى جهاز الرندر من قطعه المستوردة نفسها (D233: كلها من جهاز الرندر)`)
    .argument("<episode>", "رقم الحلقة")
    .requiredOption("--share <path>", "المجلد المشترك على الماك، مثل /Volumes/bal-share")
    .action(async (episode: string, opts: { share: string }) => {
      await assertProducible(episode);
      const { submitStudioJoin } = await import("../render/worker/studioJobs");
      const r = await submitStudioJoin(kind, episode, path.resolve(opts.share), { log: (m) => console.log(m) });
      console.log(`${r.fresh ? "أُرسلت" : "موجودة من قبل"} ${r.id}. بعد انتهائها: bal worker-import ${episode} --share ${opts.share}`);
    });
}

program
  .command("worker-submit-master")
  .description("D232: إرسال Master 4K إلى جهاز الرندر بعد اعتماد التجميع وكل بوابات النسخة النهائية (لا صوت يُولَّد؛ الناقص يرفض)")
  .argument("<episode>", "رقم الحلقة")
  .requiredOption("--share <path>", "المجلد المشترك على الماك، مثل /Volumes/bal-share")
  .action(async (episode: string, opts: { share: string }) => {
    await assertProducible(episode);
    const { submitStudioMaster } = await import("../render/worker/studioJobs");
    const r = await submitStudioMaster(episode, path.resolve(opts.share), { log: (m) => console.log(m) });
    console.log(`${r.fresh ? "أُرسل" : "موجود من قبل"} ${r.id}. بعد انتهائه: bal worker-import ${episode} --share ${opts.share}`);
  });

program
  .command("worker-import")
  .description("D232: استيراد نواتج الاستوديو من جهاز الرندر بعد التحقق (المهمة كما أُرسلت، البصمة، الصيغة، الأبعاد، المدة، الأثر، والحلقة لم تتغير) إلى السجل نفسه؛ المشهد يصل مسودة للمراجعة لا اعتمادًا")
  .argument("<episode>", "رقم الحلقة")
  .requiredOption("--share <path>", "المجلد المشترك على الماك، مثل /Volumes/bal-share")
  .action(async (episode: string, opts: { share: string }) => {
    const { importStudioJobs } = await import("../render/worker/studioJobs");
    const r = await importStudioJobs(episode, path.resolve(opts.share), { log: (m) => console.log(m) });
    const label = { imported: "مستورد", refused: "مرفوض", queued: "في الطابور", running: "يُرندر", failed: "فشل", missing: "غير موجود في المجلد المشترك", superseded: "حلّت محله مهمة أحدث" } as const;
    for (const x of r.rows.filter((x) => x.status !== "superseded"))
      console.log(`- ${x.sceneId ? `المشهد ${x.sceneId}` : x.kind}: ${label[x.status]}${x.progress ? ` ${x.progress}` : ""}${x.motion !== undefined ? ` (الحركة ${x.motion}%)` : ""}${x.reasons?.length ? `\n    - ${x.reasons.join("\n    - ")}` : ""}`);
    console.log(`استُورد الآن ${r.imported.length}، ورُفض أو فشل ${r.refused.length}. المستورد ينتظر مراجعة المالك واعتماده في الاستوديو؛ المرفوض لا يُستورد أبدًا.`);
    if (r.refused.length) process.exitCode = 1;
  });

// D232: الماك لا يرندر إلا للطوارئ وبإذن المالك الصريح في كل مرة (src/render/macRenderPermit.ts)
program
  .command("mac-render-permit")
  .description("D232: إذن المالك لرندر على الماك هذه المرة وحدها (طوارئ)؛ يُكتب بعد أن يأذن المالك بنفسه، ويُستهلك مع كل رندر")
  .option("--owner-words <text>", "نص إذن المالك كما قاله")
  .option("--uses <n>", "عدد مرات الرندر المأذونة (الافتراضي ١)", "1")
  .option("--minutes <n>", "صلاحية الإذن بالدقائق (الافتراضي ٦٠)", "60")
  .option("--episode <ep>", "حلقة بعينها (الافتراضي أي حلقة)")
  .option("--status", "اعرض الإذن الحالي فقط")
  .option("--revoke", "ألغِ الإذن الحالي")
  .action(async (opts: { ownerWords?: string; uses: string; minutes: string; episode?: string; status?: boolean; revoke?: boolean }) => {
    const m = await import("../render/macRenderPermit");
    if (opts.revoke) { console.log((await m.revokeMacRenderPermit()) ? "أُلغي الإذن." : "لا إذن قائم."); return; }
    if (opts.status) { const p = await m.readMacRenderPermit(); console.log(p ? `إذن قائم: ${p.uses} مرة حتى ${p.expiresAt}${p.episode ? ` للحلقة ${p.episode}` : ""} — «${p.ownerWords}»` : "لا إذن: الماك لا يرندر."); return; }
    if (!opts.ownerWords) throw new Error("--owner-words مطلوب: نص إذن المالك لهذه المرة.");
    const p = await m.grantMacRenderPermit({ ownerWords: opts.ownerWords, uses: Number(opts.uses), minutes: Number(opts.minutes), episode: opts.episode });
    console.log(`إذن رندر على الماك: ${p.uses} مرة حتى ${p.expiresAt}${p.episode ? ` للحلقة ${p.episode}` : ""}.`);
  });

// D232: كل الرندر على الويندوز. حالة الجهاز، والتجربة الكاملة (المشاهد ← التجميع ← 4K) التي لا تدخل الحزمة ولا السجل.
program
  .command("worker-status")
  .description("D232: حالة جهاز الرندر (النبض، والطابور، وتقدم المهمة الجارية)")
  .requiredOption("--share <path>", "المجلد المشترك على الماك، مثل /Volumes/bal-share")
  .action(async (opts: { share: string }) => {
    const { workerStatus } = await import("../render/worker/macJobs");
    const s = await workerStatus(path.resolve(opts.share));
    console.log(s.message);
    if (s.heartbeat) console.log(`النبض: ${s.heartbeat.host} ${s.heartbeat.state} منذ ${s.heartbeatAgeSec} ث @ ${s.heartbeat.commit?.slice(0, 8) ?? "?"}`);
    console.log(`في الطابور: ${s.queued.length}${s.queued.length ? ` (${s.queued.slice(0, 5).join("، ")}${s.queued.length > 5 ? "…" : ""})` : ""}`);
    if (!s.online) process.exitCode = 2;
  });

program
  .command("worker-trial")
  .description("D232: تجربة رندر حلقة كاملة على الويندوز (المشاهد ثم التجميع ثم 4K)؛ لا تدخل الحزمة ولا السجل الموقّع، والماك لا يرندر")
  .argument("<episode>", "رقم الحلقة")
  .requiredOption("--share <path>", "المجلد المشترك على الماك، مثل /Volumes/bal-share")
  .requiredOption("--tag <tag>", "وسم التجربة، مثل dafatir-001")
  .requiredOption("--out <dir>", "مجلد التجربة على الماك (سجلها ونسخ المراجعة الصغيرة)")
  .option("--stages <list>", "scenes,assembly,master (الافتراضي كلها بالترتيب)")
  .option("--scenes <ids>", "مشاهد بعينها مفصولة بفواصل (الافتراضي كل المشاهد)")
  .option("--concurrency <n>", "تبويبات المتصفح لـMaster التجربة (للقياس)")
  .option("--x264-preset <p>", "تجربة تسريع: إعداد x264 لـMaster 4K بالـcrf نفسه (medium؛ الإنتاج slow)")
  .option("--shared-bundle", "تجربة تسريع: حزمة Remotion واحدة للحلقة يعيد العامل استعمالها لكل المشاهد")
  .option("--chunk-frames <n>", "تجربة تسريع: Master على قطع بهذا العدد من الإطارات تُستأنف بعد الانقطاع (مثل 1800 = دقيقة)")
  .action(async (episode: string, opts: { share: string; tag: string; out: string; stages?: string; scenes?: string; concurrency?: string; x264Preset?: string; sharedBundle?: boolean; chunkFrames?: string }) => {
    const stages = opts.stages ? opts.stages.split(",").map((x) => x.trim()) : undefined;
    if (stages?.some((s) => !["scenes", "assembly", "master"].includes(s))) throw new Error("المراحل: scenes وassembly وmaster.");
    const { submitTrial } = await import("../render/worker/macJobs");
    const r = await submitTrial(episode, path.resolve(opts.share), {
      tag: opts.tag, outDir: path.resolve(opts.out), stages: stages as ("scenes" | "assembly" | "master")[] | undefined,
      scenes: opts.scenes?.split(",").map((x) => x.trim()).filter(Boolean), concurrency: opts.concurrency ? Number(opts.concurrency) : undefined,
      x264Preset: opts.x264Preset as "medium" | "slow" | undefined, sharedBundle: opts.sharedBundle, chunkFrames: opts.chunkFrames ? Number(opts.chunkFrames) : undefined,
      log: (m) => console.log(m),
    });
    console.log(`التجربة ${r.tag}: ${r.jobs.length} مهمة بالـcommit ${r.commit.slice(0, 8)}. للقراءة: bal worker-trial-collect --share ${opts.share} --out ${opts.out}`);
  });

program
  .command("worker-trial-collect")
  .description("D232: نتائج التجربة وأوقاتها بعد التحقق (البصمة والصيغة والأبعاد والمدة والأثر)؛ ينسخ نسخ المراجعة 1080p وحدها")
  .requiredOption("--share <path>", "المجلد المشترك على الماك")
  .requiredOption("--out <dir>", "مجلد التجربة على الماك")
  .option("--no-copy", "لا تنسخ شيئًا (الأوقات والتحقق فقط)")
  .action(async (opts: { share: string; out: string; copy?: boolean }) => {
    const { collectTrial } = await import("../render/worker/macJobs");
    await collectTrial(path.resolve(opts.share), path.resolve(opts.out), { copy: opts.copy, log: (m) => console.log(m) });
  });

program
  .command("place-master")
  .description("D240: ينسخ Master المعتمد إلى مكانه الدائم masters/<القناة>/<الحلقة>/<NNN>-episode.mp4 في المجلد المشترك ويتحقق من بصمته بالسجل الموقَّع")
  .argument("<episode>", "رقم الحلقة")
  .option("--share <path>", "المجلد المشترك على الماك (F:\\bal-share على ويندوز)", "/Volumes/bal-share")
  .action(async (episode: string, opts: { share: string }) => {
    const m = await import("../render/postPublishCleanup");
    const { sha256File } = await import("../render/worker/protocol");
    const r = await m.placeMaster(await m.macCleanupContext(episode, path.resolve(opts.share)), { approvedMaster: () => m.ledgerApprovedMaster(episode), sha256File });
    console.log(`${r.status === "placed" ? "نُسخ" : "موجود من قبل"} Master إلى ${r.target} (sha256 ${r.sha256}، ${m.formatBytes(r.bytes)}) ويطابق الاعتماد.`);
  });

program
  .command("cleanup")
  .description("D240: التنظيف بعد النشر — يعرض ما يُحذف وما يبقى (الافتراضي بلا حذف)؛ الحذف بـ --delete بعد الشروط الثلاثة وحدها")
  .argument("<episode>", "رقم الحلقة")
  .option("--share <path>", "المجلد المشترك على الماك (F:\\bal-share على ويندوز)", "/Volumes/bal-share")
  .option("--dry-run", "عرض فقط (الافتراضي)")
  .option("--delete", "احذف فعلًا (بعد نجاح الشروط الثلاثة كلها، وإلا لا يُحذف شيء)")
  .action(async (episode: string, opts: { share: string; dryRun?: boolean; delete?: boolean }) => {
    const m = await import("../render/postPublishCleanup");
    const share = path.resolve(opts.share);
    const plan = await m.planCleanup(await m.macCleanupContext(episode, share), await m.macCleanupDeps(episode));
    if (!opts.delete || opts.dryRun) {
      console.log(m.formatPlan(plan));
      if (!plan.ok) process.exitCode = 1;
      return;
    }
    if (!plan.ok) {
      console.error(m.formatPlan(plan));
      console.error("توقف التنظيف: لم يُحذف شيء.");
      process.exitCode = 1;
      return;
    }
    const r = await m.executeCleanup(plan);
    const { queueWindowsCleanup } = await import("../render/worker/cleanupQueue");
    const queued = await queueWindowsCleanup(share, plan).then(() => true, () => false);
    console.log(m.summaryLine(plan, r.freed, queued, r.skipped.length));
  });

program
  .command("worker")
  .description("D226: عامل الرندر على الجهاز الثاني: يرندر شورتس المجلد المشترك واحدًا بعد واحد (لا دفع ولا اعتماد)")
  .requiredOption("--share <path>", "المجلد المشترك على هذا الجهاز، مثل D:\\bal-share أو \\\\Salah\\bal-share")
  .option("--once", "مهمة واحدة على الأكثر ثم خروج")
  .action(async (opts: { share: string; once?: boolean }) => {
    const { runWorker } = await import("../render/worker/loop");
    await runWorker(path.resolve(opts.share), { once: opts.once, repo: projectRoot });
  });

program
  .command("worker-render", { hidden: true })
  .description("D226 (داخلي، يشغّله bal worker وحده): رندر مهمة واحدة من running/ — ناتج غير موثوق حتى worker-collect")
  .requiredOption("--share <path>", "المجلد المشترك")
  .requiredOption("--job <id>", "معرّف المهمة")
  .action(async (opts: { share: string; job: string }) => {
    if (process.env.BAL_RENDER_WORKER !== "1") throw new Error("هذا الأمر يشغّله «bal worker» وحده.");
    const { renderWorkerJob } = await import("../render/worker/untrustedRender");
    await renderWorkerJob(path.resolve(opts.share), opts.job, (m) => console.log(m));
  });

program
  .command("retention")
  .description("قارئ الاحتفاظ: من تصدير «Audience retention» في YouTube Studio إلى أكبر تسرب ومكانه في السكريبت (يقرأ ولا يكتب)")
  .argument("<episode>", "رقم الحلقة")
  .argument("<file>", "ملف التصدير (.zip من Studio أو CSV منه)")
  .option("--duration <seconds>", "طول الحلقة المنشورة بالثواني (إن اختلف عن الملف المجمَّع)")
  .action(async (episode: string, file: string, opts: { duration?: string }) => {
    const { analyseRetention, retentionMarkdown } = await import("../analytics/retention");
    const { readRetentionExport } = await import("../analytics/retentionFile");
    const { sceneStartsFor } = await import("../package/chapters");
    const { realEpisodeTimings } = await import("../package/realTimings");
    const { loadPlan, regeneratePlan } = await import("../plan/io");
    const { channelInfo, loadChannel } = await import("../channel");
    const scriptPath = await resolveScriptPath(episode);
    const plan = (await loadPlan(episode)) ?? (await regeneratePlan(episode));
    const real = { sceneSeconds: (await realEpisodeTimings(scriptPath, plan)).sceneSeconds };
    const at = sceneStartsFor(plan, undefined, channelInfo(loadChannel()), real);
    const duration = opts.duration ? Number(opts.duration) : at.total;
    if (!(duration > 0)) throw new Error("طول الحلقة غير معروف: مرّر --duration بالثواني.");
    const pts = await readRetentionExport(path.resolve(file), duration);
    const scenes = plan.chapters.flatMap((c) => c.scenes).map((s) => ({ id: s.id, start: at.starts[s.id] ?? 0, narration: s.narration }));
    console.log(retentionMarkdown(plan.title, analyseRetention(pts, { duration, scenes, estimated: at.estimated })));
  });

program
  .command("analytics-import")
  .description("المراجعة الأسبوعية (D191): يستورد «جدول البيانات» من YouTube Studio (نسبة النقر ومتوسط المشاهدة) وتصدير «Audience retention» لحلقة منشورة إلى .studio/analytics على هذا الجهاز (لا يُرفع)")
  .argument("<episode>", "رقم الحلقة")
  .argument("<table>", "ملف «جدول البيانات» CSV من YouTube Studio (Advanced mode ← Export)")
  .option("--retention <file>", "تصدير «Audience retention» (.zip أو CSV) للحلقة نفسها")
  .action(async (episode: string, table: string, opts: { retention?: string }) => {
    const { parseTableData } = await import("../studio/weekly");
    const F = await import("../studio/nightlyFacts");
    const { currentChannelId } = await import("../channel");
    const { readFile, mkdir, writeFile } = await import("node:fs/promises");
    const ch = currentChannelId();
    const nums = parseTableData(await readFile(path.resolve(table), "utf8"));
    await F.saveAnalytics({ version: 1, channel: ch, episode, importedAt: new Date().toISOString(), ...nums });
    if (opts.retention) {
      const { readRetentionExport } = await import("../analytics/retentionFile");
      const pts = await readRetentionExport(path.resolve(opts.retention));
      await mkdir(path.dirname(F.retentionFile(ch, episode)), { recursive: true });
      await writeFile(F.retentionFile(ch, episode), ["elapsed seconds,retention (%)", ...pts.map((p) => `${p.t},${p.r}`)].join("\n") + "\n");
    }
    console.log(`استُورد ${episode} (${ch}): ${Object.keys(nums).join("، ")}${opts.retention ? "، والاحتفاظ" : ""}.`);
  });

program
  .command("nightly")
  .description("الطابور الليلي (D191): يعرض ما سيُعمل الليلة وما ينتظر المالك، من سجل «إنتاج المشاهد» وحده؛ لا يرندر شيئًا من هنا (التشغيل من الاستوديو)")
  .action(async () => {
    const { planNightly } = await import("../studio/nightly");
    const { gatherNightFacts } = await import("../studio/nightlyFacts");
    const p = planNightly(await gatherNightFacts());
    console.log(["الليلة:", ...(p.tasks.length ? p.tasks.map((t) => `- ${t.channel} ${t.episode}: bal ${t.args.join(" ")} (${t.why})`) : ["- لا شيء معتمد ينتظر الرندر."]),
      "", "ينتظرك:", ...(p.owner.length ? p.owner.map((x) => `- ${x.channel} ${x.episode}: ${x.text}`) : ["- لا شيء."])].join("\n"));
  });

program
  .command("weekly")
  .description("المراجعة الأسبوعية (D191): نسبة النقر ومتوسط المشاهدة وأكبر تسرب وتحسين واحد لكل قناة، من البيانات المستوردة على هذا الجهاز")
  .action(async () => {
    const W = await import("../studio/weekly");
    const F = await import("../studio/nightlyFacts");
    const week = W.isoWeek(new Date());
    const md = W.weeklyMarkdown(week, (await F.gatherWeek()).map(W.reviewChannel));
    await F.saveWeekly(week, md);
    console.log(md);
  });

program
  .command("shorts-check")
  .description("D241: الشورت فكرة كاملة وحده — لكل شورت «يمر» أو «مرفوض» بسببه (الخطة، أو حزمة المسودة ومقترحات المحرر). يقرأ ولا يكتب")
  .argument("[episode]", "رقم الحلقة (الافتراضي كل حلقات القناة)")
  .option("--json", "إخراج JSON")
  .action(async (episode: string | undefined, opts: { json?: boolean }) => {
    const { checkChannelShorts, formatShortRows, isRefused } = await import("../package/shortsCheck");
    const rows = await checkChannelShorts(episode);
    console.log(opts.json ? JSON.stringify(rows, null, 2) : formatShortRows(rows));
    process.exitCode = rows.some(isRefused) ? 1 : 0;
  });

program
  .command("shorts-plan")
  .description("جدول الشورتس اليومي للقناة (ريلزان يوميًا): الأحدث أولًا، بلا تكرار، ومصدران مختلفان في اليوم ما أمكن، والفجوات بعددها")
  .option("--from <date>", "أول يوم (YYYY-MM-DD)؛ الافتراضي اليوم")
  .option("--days <n>", "عدد الأيام", "14")
  .action(async (opts: { from?: string; days: string }) => {
    const { planShorts, scheduleMarkdown } = await import("../package/shortsSchedule");
    const { channelShorts } = await import("../package/shortsScheduleFiles");
    const from = opts.from ?? new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) throw new Error("التاريخ بصيغة YYYY-MM-DD.");
    const c = await channelShorts();
    // ما حُدد في التقويم قبل أول يوم يُعدّ منشورًا فلا يعود
    const published = Object.entries(c.calendar).filter(([d]) => d < from).flatMap(([, v]) => (v.shorts ?? []).map((s) => `${s.ep}#${s.n}`));
    const plan = planShorts({ from, days: Math.max(1, Math.min(90, Number(opts.days) || 14)), perDay: c.perDay, items: c.items, published, calendar: c.calendar });
    console.log(scheduleMarkdown(c.name, plan, c.perDay));
  });

program
  .command("episodes-plan")
  .description("جدول الحلقات الطويلة بقاعدة السلاسل: حلقة أسبوعيًا (حتى ٣) في يوم القناة، كل حلقة من سلسلة مختلفة في الأسبوع، وما أذن المالك بنشره وحده")
  .option("--from <date>", "أول يوم (YYYY-MM-DD)؛ الافتراضي اليوم")
  .option("--weeks <n>", "عدد الأسابيع", "6")
  .option("--per-week <n>", "حلقات الأسبوع (١ إلى ٣)", "1")
  .action(async (opts: { from?: string; weeks: string; perWeek: string }) => {
    const { planEpisodes, episodesMarkdown, sameSeriesWeeks } = await import("../package/episodeSchedule");
    const { channelEpisodes } = await import("../package/shortsScheduleFiles");
    const from = opts.from ?? new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) throw new Error("التاريخ بصيغة YYYY-MM-DD.");
    const c = await channelEpisodes();
    const perWeek = Math.max(1, Math.min(3, Number(opts.perWeek) || 1));
    for (const x of sameSeriesWeeks(c.dated, c.longDay)) console.log(`⚠️ أسبوع ${x.week}: الحلقات ${x.episodes.join("، ")} من سلسلة واحدة (${x.series})؛ القاعدة سلسلة مختلفة لكل حلقة في الأسبوع.`);
    console.log(episodesMarkdown(c.name, planEpisodes({ from, weeks: Math.max(1, Math.min(26, Number(opts.weeks) || 6)), perWeek, longDay: c.longDay, items: c.items, dated: c.dated }), perWeek));
  });

program
  .command("stock-new")
  .description("بناء المخزون (D213): حلقة «مسودة» جديدة من قالب المخزون (script.md وresearch.md وscenes.md وpublish.draft.json). لا صوت ولا رندر.")
  .argument("<number>", "رقم الحلقة (ثلاث خانات)")
  .argument("<slug>", "الاسم المختصر بالحروف اللاتينية الصغيرة والشرطات")
  .requiredOption("--title <title>", "عنوان الحلقة")
  .requiredOption("--domain <domain>", "مجال الحلقة من مجالات القناة")
  .option("--series <series>", "معرّف السلسلة")
  .action(async (number: string, slug: string, opts: { title: string; domain: string; series?: string }) => {
    const { scaffoldStockEpisode } = await import("../studio/stockStore");
    const { currentChannelId } = await import("../channel");
    const { templatesDir } = await import("../config/paths");
    const dir = await scaffoldStockEpisode({ channel: currentChannelId(), number, slug, title: opts.title, domain: opts.domain, ...(opts.series ? { series: opts.series } : {}), templatesRoot: templatesDir });
    console.log(`أُنشئت المسودة: ${path.relative(projectRoot, dir)}`);
  });

program
  .command("editor-batch")
  .description("D234: دفعة محرر المحتوى التالية: ملف بالسكريبتات التي تنتظره (روابطها على GitHub، والجمل المتغيّرة وحدها لمن راجعه قبل) في ~/Desktop/للمراجعة/محرر-المحتوى/")
  .option("--limit <n>", "أقصى عدد سكريبتات في الدفعة", "10")
  .option("--all", "كل ما ينتظر المحرر في دفعة واحدة")
  .option("--include-sent", "أعد إدراج ما أُرسل في دفعة سابقة ولم يُسجَّل مروره بعد")
  .option("--include-paused", "أدرج سكريبتات القنوات الموقوفة تحريريًا (`frozen.editorialPause`، مثل «بالإسلام» D235)؛ تُستبعد افتراضيًا")
  .option("--dir <dir>", "مجلد الدفعات (الافتراضي ~/Desktop/للمراجعة/محرر-المحتوى)")
  .option("--dry-run", "اعرض ما ينتظر المحرر بلا كتابة ملف")
  .action(async (opts: { limit: string; all?: boolean; includeSent?: boolean; includePaused?: boolean; dir?: string; dryRun?: boolean }) => {
    const st = await import("../studio/scriptPipelineStore");
    if (opts.dryRun) {
      const q = await st.editorQueue(undefined, { includePaused: opts.includePaused });
      for (const x of q) console.log(`${x.channel} ${x.episode} | ${x.state.partial ? `جزئي: ${x.state.pending.length} جملة متغيّرة` : `كاملًا: ${x.state.total} جملة`} | ${x.title}`);
      console.log(`ينتظر المحرر: ${q.length}`);
      return;
    }
    const limit = opts.all ? undefined : Number(opts.limit);
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) throw new Error("--limit عدد صحيح موجب.");
    const r = await st.writeEditorBatch({ ...(opts.dir ? { dir: opts.dir } : {}), ...(limit ? { limit } : {}), includeSent: opts.includeSent, includePaused: opts.includePaused });
    if (!r.file) { console.log(r.waiting ? `كل ما ينتظر المحرر (${r.waiting}) أُرسل في دفعات سابقة؛ استعمل --include-sent لإعادته.` : "لا سكريبت ينتظر المحرر."); return; }
    console.log(`دفعة المحرر ${r.n}: ${r.file}`);
    for (const x of r.items) console.log(`- ${x.channel} ${x.episode}: ${x.state.partial ? `${x.state.pending.length} جملة متغيّرة` : "كاملًا"} — ${x.title}`);
    console.log(`في الدفعة ${r.items.length} من ${r.waiting} ينتظر المحرر.`);
  });

program
  .command("editor-pass")
  .description("D234: يسجّل مرور محرر المحتوى على سكريبت كما هو الآن (يسجّله المنسّق بعد أن يسلّمه المالك رد المحرر)؛ الجمل المتغيّرة بعده تعود إليه وحدها")
  .argument("<channel>", "القناة (balislam | dafatir-alzaman | zubdat-alkutub)")
  .argument("<episode>", "رقم الحلقة (ثلاث خانات)")
  .option("--by <name>", "من راجع", "محرر المحتوى")
  .option("--recorded-by <name>", "من سجّل المرور", "المنسّق")
  .option("--batch <n>", "رقم دفعة المحرر: يُرفض التسجيل إن تغيّر السكريبت بعد إرسالها")
  .option("--dir <dir>", "مجلد الدفعات (الافتراضي ~/Desktop/للمراجعة/محرر-المحتوى)")
  .option("--at <date>", "تاريخ رد المحرر (ISO)")
  .option("--grandfathered <reason>", "مرور بلا مراجعة فعلية لسبب صريح بقرار المالك (مثل حلقة منشورة قبل D234)")
  .option("--note <note>", "ملاحظة")
  .action(async (channel: string, episode: string, opts: { by: string; recordedBy: string; batch?: string; dir?: string; at?: string; grandfathered?: string; note?: string }) => {
    const { listChannels } = await import("../channel");
    if (!listChannels().includes(channel)) throw new Error(`قناة غير معروفة: ${channel}`);
    if (!/^\d{3}$/.test(episode)) throw new Error("رقم الحلقة ثلاث خانات.");
    process.env.BAL_CHANNEL = channel;
    const st = await import("../studio/scriptPipelineStore");
    const scriptPath = await resolveScriptPath(episode);
    const batch = opts.batch !== undefined ? Number(opts.batch) : undefined;
    if (batch !== undefined && !Number.isInteger(batch)) throw new Error("--batch رقم الدفعة.");
    const expectSha = batch !== undefined ? st.sentShaFor(opts.dir ?? st.defaultEditorBatchDir(), batch, channel, episode) : null;
    if (batch !== undefined && !expectSha) throw new Error(`الحلقة ${channel} ${episode} ليست في دفعة المحرر ${batch}.`);
    const r = await st.recordEditorPass(scriptPath, { by: opts.by, recordedBy: opts.recordedBy, ...(opts.at ? { at: opts.at } : {}),
      ...(batch !== undefined ? { batch } : {}), ...(expectSha ? { expectSha } : {}), ...(opts.grandfathered ? { grandfathered: opts.grandfathered } : {}), ...(opts.note ? { note: opts.note } : {}) });
    console.log(`سُجّل مرور المحرر: ${channel} ${episode} (${r.reviewed} جملة كانت تنتظره) ← ${path.relative(projectRoot, r.file)}`);
  });

program
  .command("thumbnails")
  .description("الأغلفة الثلاثة وحدها (عنوان، مشهد، سؤال) من publish.json: بلا فيديو ولا صوت ولا مساس بالنسخة النهائية")
  .argument("<episode>", "رقم الحلقة")
  .action(async (episode: string) => {
    await assertProducible(episode);
    const { makeThumbnails } = await import("../package/package");
    const r = await makeThumbnails(episode, (m) => console.log(m));
    console.log(`جاهز في ${path.relative(projectRoot, r.dir)}:\n- ${r.files.join("\n- ")}`);
  });

program
  .command("make")
  .description("من السكريبت إلى ملفات النشر بأمر واحد: فحص ← آيات ← مشاهد ← صوت ← رندر ← تغليف")
  .argument("<episode>", "رقم الحلقة")
  .option("--no-voice", "نسخة معاينة بلا صوت (لا تُنشر)")
  .option("--generate-voice", "يولّد الصوت الناقص هنا (يصرف رصيدًا؛ بلا هذا الخيار يُرفض الصوت الناقص ولا يُصرف شيء)")
  .option("--skip-video", "بلا رندر فيديو")
  .action(async (episode: string, opts: { voice?: boolean; generateVoice?: boolean; skipVideo?: boolean }) => {
    await assertProducible(episode);
    const { makeEpisode } = await import("../package/make");
    const r = await makeEpisode({ episode, noVoice: opts.voice === false, generateVoice: opts.generateVoice === true, skipVideo: opts.skipVideo, onProgress: (m) => console.log(m) });
    console.log(`\nتم. الملفات في ${path.relative(projectRoot, r.dir)}. راجع publish-checklist.md قبل النشر.`);
  });

program
  .command("quality")
  .description("بطاقة الجودة لحلقة (D162): الحلقة المجمّعة، أو النسخة النهائية إن وُجدت؛ قراءة فقط إلا مع --measure")
  .argument("<episode>", "رقم الحلقة")
  .option("--measure", "يقيس الملف الحالي أولًا (دقائق للحلقة الكاملة؛ لا يغيّر الملف ولا يصرف شيئًا)")
  .option("--target <target>", "assembly (المجمّعة) أو master (النسخة النهائية)")
  .action(async (episode: string, opts: { measure?: boolean; target?: string }) => {
    if (opts.target && opts.target !== "assembly" && opts.target !== "master") throw new Error("--target: assembly أو master");
    const Q = await import("../studio/quality/measure");
    const { cardText } = await import("../studio/quality/card");
    const first = await Q.qualityCard(episode, opts.target as "assembly" | "master" | undefined);
    if (opts.measure) {
      if (!first.exists) throw new Error(first.target === "assembly" ? "لا توجد حلقة مجمّعة بعد: «دمج المشاهد للمراجعة» في الخطوة ٣ أولًا." : "لا توجد نسخة نهائية بعد.");
      console.log("جارٍ القياس… (دقائق)");
      await Q.measureTarget(episode, first.target);
    }
    console.log(cardText(opts.measure ? await Q.qualityCard(episode, first.target) : first));
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

// D239: نسخة البسملة المعتمدة الواحدة (صوت المالك المستنسخ، بصمتها مثبّتة في src/voice/basmala.ts). لا توليد هنا أبدًا.
const basmalaCmd = program.command("basmala").description("نسخة البسملة المعتمدة (D239): تثبيت بعد فحص البصمة، وحالتها، وتركيب مشاهدها");
basmalaCmd
  .command("install")
  .description("ينسخ ملف البسملة المعتمد إلى assets/recitations/basmala/ (خارج Git) بعد مطابقة بصمته؛ ويرفض أي ملف آخر")
  .argument("<file>", "ملف البسملة المعتمد")
  .action(async (file: string) => {
    const { installBasmalaClip } = await import("../voice/basmalaClip");
    const r = await installBasmalaClip(path.resolve(file));
    console.log(`ثُبّتت نسخة البسملة المعتمدة: ${path.relative(projectRoot, r.path)} (البصمة ${r.sha256}).`);
    console.log("لتركيبها في مشاهد البسملة المنتظرة: npx bal --channel <القناة> basmala apply");
  });
basmalaCmd
  .command("status")
  .description("هل نسخة البسملة المعتمدة مثبّتة وبصمتها مطابقة؟")
  .action(async () => {
    const { basmalaClipStatus } = await import("../voice/basmalaClip");
    const s = await basmalaClipStatus();
    console.log(s.installed ? `مثبّتة ومطابقة: ${path.relative(projectRoot, s.path)}` : s.reason);
    if (!s.installed) process.exitCode = 1;
  });
basmalaCmd
  .command("apply")
  .description("يركّب مشاهد البسملة بالنسخة المعتمدة (مجانًا، بلا طلب صوت)؛ الحلقة التي لها تسجيلها المعتمد لا تُمس")
  .argument("[episode]", "رقم الحلقة (بلا رقم: كل حلقات القناة)")
  .action(async (episode?: string) => {
    const { applyBasmalaClip } = await import("../voice/basmalaClip");
    const { listScriptEpisodeDirs } = await import("../script/episodes");
    const { channelPaths } = await import("../channel");
    const list = episode ? [episode] : (await listScriptEpisodeDirs(channelPaths().episodes)).map((d) => d.slice(0, 3));
    const said = { "own-recording": "لها تسجيلها المعتمد؛ لم تُمس", "no-basmala": "لا بسملة فيها", "up-to-date": "مركّبة بالنسخة المعتمدة من قبل" } as const;
    for (const ep of list) {
      const r = await applyBasmalaClip(ep);
      console.log(r.status === "recomposed" ? `${ep}: رُكّبت البسملة في ${r.scenes.join("، ") || "—"}؛ تعود هذه المشاهد وحدها للمراجعة.` : `${ep}: ${said[r.status]}.`);
    }
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
