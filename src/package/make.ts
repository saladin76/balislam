import { readFile } from "node:fs/promises";
import { resolveScriptPath } from "../script/episodes";
import { parseScript } from "../script/parse";
import { checkScript } from "../script/check";
import { formatReport } from "../script/report";
import { quranClientFromEnv } from "../quran/client";
import { syncQuran } from "../quran/sync";
import { regeneratePlan } from "../plan/io";
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
  const check = checkScript(parseScript(await readFile(scriptPath, "utf8"), scriptPath));
  if (!check.ok) throw new Error(`السكريبت فيه أخطاء، أصلحها أولًا:\n${formatReport(scriptPath, check)}`);

  log("٢/٥ نصوص الآيات…");
  const qf = quranClientFromEnv();
  if (qf) {
    const r = await syncQuran(ep, qf);
    if (r.failed.length) throw new Error(`تعذّر جلب آيات: ${r.failed.map((f) => `${f.ref} (${f.reason})`).join("، ")}`);
    log(`   جُلبت ${r.fetched.length}، ومخزّنة ${r.cached.length}.`);
  } else log("   ⚠️ مفاتيح Quran Foundation غير موجودة: بطاقات الآيات ستعرض نصًا مؤقتًا.");

  log("٣/٥ خطة المشاهد…");
  const plan = await regeneratePlan(ep);
  log(`   ${plan.chapters.reduce((n, c) => n + c.scenes.length, 0)} مشهدًا.`);
  const issues = planIssues(plan);
  for (const i of issues.filter((x) => x.level === "warning")) log(`   تنبيه (${i.sceneId}): ${i.message}`);
  const blocking = issues.filter((x) => x.level === "error");
  if (blocking.length && !opts.noVoice) throw new Error(`لا يمكن إخراج نسخة نهائية:\n${blocking.map((i) => `- ${i.sceneId}: ${i.message}`).join("\n")}`);
  for (const i of blocking) log(`   ⚠️ (${i.sceneId}): ${i.message}`);

  log("٤/٥ الصوت…");
  const el = elevenLabsFromEnv();
  if (el) {
    const r = await generateVoice(ep, { client: el, onProgress: (m) => log(`   ${m}`) });
    log(`   ولّد ${r.toGenerate.length} مقطعًا (${r.chars} حرفًا ≈ ${r.credits} رصيد)، وأعاد استخدام ${r.cached.length}.`);
  } else if (opts.noVoice) {
    log("   ⚠️ بلا صوت (--no-voice): نسخة معاينة بتوقيت تقديري، لا تُنشر.");
  } else {
    throw new Error("مفاتيح ElevenLabs غير موجودة في .env. أضفها، أو شغّل الأمر مع --no-voice لنسخة معاينة.");
  }

  log("٥/٥ الرندر والتغليف…");
  return packageEpisode({ episode: ep, skipVideo: opts.skipVideo, onProgress: (m) => log(`   ${m}`) });
};
