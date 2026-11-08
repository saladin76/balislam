import { readFile } from "node:fs/promises";
import { resolveScriptPath } from "../script/episodes";
import { parseScript } from "../script/parse";
import { checkForChannel } from "../script/checkChannel";
import { formatReport } from "../script/report";
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
 * فحص السكريبت والآيات المرفقة ← خطة المشاهد ← الصوت غير القرآني ← الرندر ← حزمة النشر.
 * يتوقف عند أول خطأ في السكريبت قبل صرف أي رصيد.
 */
export const makeEpisode = async (opts: MakeOptions) => {
  const log = opts.onProgress ?? (() => {});
  const ep = opts.episode;
  const scriptPath = await resolveScriptPath(ep);

  log("١/٥ فحص السكريبت…");
  const check = checkForChannel(parseScript(await readFile(scriptPath, "utf8"), scriptPath));
  if (!check.ok) throw new Error(`السكريبت فيه أخطاء، أصلحها أولًا:\n${formatReport(scriptPath, check)}`);

  // The authored script is the only source of Quran text. Never fetch verse text or recordings.
  log("٢/٥ نص الآيات المرفق بالسكريبت (لا جلب من خدمات خارجية)…");

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
