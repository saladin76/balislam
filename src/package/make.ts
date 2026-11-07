import { readFile } from "node:fs/promises";
import { resolveScriptPath } from "../script/episodes";
import { parseScript } from "../script/parse";
import { checkForChannel } from "../script/checkChannel";
import { formatReport } from "../script/report";
import { inspectMissingQuranTexts } from "../quran/fillMissingText";
import { regeneratePlan } from "../plan/io";
import { loadChannel } from "../channel";
import { elevenLabsFromEnv } from "../voice/elevenlabs";
import { generateVoice } from "../voice/generate";
import { packageEpisode } from "./package";
import { planIssues } from "../plan/validate";

export type MakeOptions = {
  episode: string;
  /** يكمل بلا صوت (نسخة معاينة لا تُنشر) */
  noVoice?: boolean;
  skipVideo?: boolean;
  onProgress?: (msg: string) => void;
};

/**
 * من السكريبت إلى ملفات النشر بأمر واحد:
 * فحص ← آيات ← خطة المشاهد ← الصوت ← رندر الحلقة والشورتس ← الصور والوصف والترجمة.
 * يتوقف عند أول خطأ في السكريبت قبل صرف أي رصيد.
 */
export const makeEpisode = async (opts: MakeOptions) => {
  const log = opts.onProgress ?? (() => {});
  const ep = opts.episode;
  const scriptPath = await resolveScriptPath(ep);

  log("١/٥ فحص السكريبت…");
  const check = checkForChannel(parseScript(await readFile(scriptPath, "utf8"), scriptPath));
  if (!check.ok) throw new Error(`السكريبت فيه أخطاء، أصلحها أولًا:\n${formatReport(scriptPath, check)}`);

  log("٢/٥ مراجعة الآيات المرسلة يدويًا…");
  const verses = await inspectMissingQuranTexts(ep);
  if (verses.invalid.length)
    throw new Error("السكريبت يحتوي مراجع آيات غير صالحة: " + verses.invalid.map(v => v.ref + " (" + v.reason + ")").join("، "));
  if (verses.missing.length) {
    log("   النصوص المطلوبة من صاحب القناة: " + verses.missing.join("، "));
    if (!opts.noVoice)
      throw new Error("لا يمكن إنتاج Master قبل إدخال نصوص الآيات المطلوبة يدويًا: " + verses.missing.join("، ") + ". افتح تبويب الصوت ← الآيات المطلوبة.");
  } else log("   النصوص المطلوبة الموجودة: " + verses.existing.length + ". لا جلب خارجي.");

  log("٣/٥ خطة المشاهد…");
  const plan = await regeneratePlan(ep);
  log(`   ${plan.chapters.reduce((n, c) => n + c.scenes.length, 0)} مشهدًا.`);
  const issues = planIssues(plan, loadChannel(plan.channel));
  for (const i of issues.filter((x) => x.level === "warning")) log(`   تنبيه (${i.sceneId}): ${i.message}`);
  const blocking = issues.filter((x) => x.level === "error");
  if (blocking.length && !opts.noVoice) throw new Error(`لا يمكن إخراج نسخة نهائية:\n${blocking.map((i) => `- ${i.sceneId}: ${i.message}`).join("\n")}`);
  for (const i of blocking) log(`   ⚠️ (${i.sceneId}): ${i.message}`);

  log("٤/٥ الصوت…");
  const el = opts.noVoice ? null : elevenLabsFromEnv();
  if (el) {
    const r = await generateVoice(ep, { client: el, onProgress: (m) => log(`   ${m}`) });
    log(`   ولّد ${r.toGenerate.length} مقطعًا (${r.chars} حرفًا ≈ ${r.credits} رصيد)، وأعاد استخدام ${r.cached.length}.`);
  } else if (opts.noVoice) {
    log("   ⚠️ معاينة بلا توليد صوت (--no-voice): يُستخدم الصوت المحفوظ إن وُجد، ولا يُصرف أي رصيد. لا تُنشر.");
  } else {
    throw new Error("مفتاح ElevenLabs أو الصوت غير مضاف. أضفهما من تبويب «الإعدادات» في الاستوديو، أو اختر «معاينة بلا صوت».");
  }

  log("٥/٥ الرندر والتغليف…");
  // النسخة النهائية بأعلى جودة (4K)، والمعاينة بلا صوت سريعة 1080p؛ والشورتس بعد اعتماد النسخة الأساسية في الاستوديو
  return packageEpisode({ episode: ep, skipVideo: opts.skipVideo, stage: "episode", quality: opts.noVoice ? "preview" : "master", onProgress: (m) => log(`   ${m}`) });
};
