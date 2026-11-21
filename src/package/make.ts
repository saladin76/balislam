import { readFile } from "node:fs/promises";
import { resolveScriptPath } from "../script/episodes";
import { parseScript } from "../script/parse";
import { checkForChannel } from "../script/checkChannel";
import { formatReport } from "../script/report";
import { loadPlan, regeneratePlan } from "../plan/io";
import { isDesignedPlan } from "../plan/designed";
import { loadChannel } from "../channel";
import { elevenLabsFromEnv } from "../voice/elevenlabs";
import { generateVoice } from "../voice/generate";
import { packageEpisode } from "./package";
import { planIssues } from "../plan/validate";

/** The final file found voice that was never generated (owner decision 15–16 Nov: it does not pay for it). */
export const missingVoiceMessage = (clips: number, chars: number) =>
  `ينقص صوت ${clips.toLocaleString("ar-EG")} ${clips === 1 ? "مقطع" : "مقاطع"} (نحو ${chars.toLocaleString("ar-EG")} حرف). النسخة النهائية لا تولّد صوتًا وحدها: ولّده من «٢ المشاهد» («ولّد الصوت الآن») ثم أعد المحاولة. لم يُصرف شيء.`;

export type MakeOptions = {
  episode: string;
  /** يكمل بلا صوت (نسخة معاينة لا تُنشر) */
  noVoice?: boolean;
  /** `bal make --generate-voice` only (the owner's explicit CLI flag): generate missing voice here. Never from the Studio. */
  generateVoice?: boolean;
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
  // خطة مصمَّمة لا تُعاد كتابتها من السكريبت (حادثة دفاتر الزمن 001)؛ تُستعمل كما هي
  const existing = await loadPlan(ep);
  const plan = existing && isDesignedPlan(existing) ? existing : await regeneratePlan(ep);
  log(`   ${plan.chapters.reduce((n, c) => n + c.scenes.length, 0)} مشهدًا.`);
  const issues = planIssues(plan, loadChannel(plan.channel));
  for (const i of issues.filter((x) => x.level === "warning")) log(`   تنبيه (${i.sceneId}): ${i.message}`);
  const blocking = issues.filter((x) => x.level === "error");
  if (blocking.length && !opts.noVoice) throw new Error(`لا يمكن إخراج نسخة نهائية:\n${blocking.map((i) => `- ${i.sceneId}: ${i.message}`).join("\n")}`);
  for (const i of blocking) log(`   ⚠️ (${i.sceneId}): ${i.message}`);

  // بطاقة الجودة (المرحلة A): لا نسخة نهائية وفي بطاقة الحلقة المجمّعة ✗ أو بند لم يُقس (src/studio/quality/measure.ts)
  if (!opts.noVoice) {
    const { assertQualityForFinal } = await import("../studio/quality/measure");
    await assertQualityForFinal(ep, (m) => log(`   ${m}`));
  }

  log("٤/٥ الصوت…");
  // Owner decision (15–16 Nov): the final file never pays for voice on its own. It is made from the voice the owner
  // already generated with his own press («ولّد الصوت الآن», a scene's «ولّد/أعد توليد الصوت», «الجمل»); a missing clip
  // is refused before anything is paid. Only the CLI's explicit `bal make --generate-voice` may generate here.
  if (opts.noVoice) {
    log("   ⚠️ معاينة بلا توليد صوت (--no-voice): يُستخدم الصوت المحفوظ إن وُجد، ولا يُصرف أي رصيد. لا تُنشر.");
  } else {
    const dry = await generateVoice(ep, { dryRun: true });
    if (dry.toGenerate.length && !opts.generateVoice)
      throw new Error(`${missingVoiceMessage(dry.toGenerate.length, dry.chars)}`);
    const el = opts.generateVoice ? elevenLabsFromEnv() : null;
    if (dry.toGenerate.length && !el)
      throw new Error("مفتاح ElevenLabs أو الصوت غير مضاف. أضفهما من تبويب «الإعدادات» في الاستوديو، أو اختر «معاينة بلا صوت».");
    // Nothing to generate: the run only links the scenes to their saved clips (no request, no key needed).
    const r = await generateVoice(ep, { client: el, onProgress: (m) => log(`   ${m}`) });
    log(r.toGenerate.length ? `   ولّد ${r.toGenerate.length} مقطعًا (${r.chars} حرفًا ≈ ${r.credits} رصيد)، وأعاد استخدام ${r.cached.length}.`
      : `   الصوت كله محفوظ (${r.cached.length} مقطعًا)؛ لم يُولَّد شيء ولم يُصرف رصيد.`);
  }

  log("٥/٥ الرندر والتغليف…");
  // النسخة النهائية بأعلى جودة (4K)، والمعاينة بلا صوت سريعة 1080p؛ والشورتس بعد اعتماد النسخة الأساسية في الاستوديو
  return packageEpisode({ episode: ep, skipVideo: opts.skipVideo, stage: "episode", quality: opts.noVoice ? "preview" : "master", onProgress: (m) => log(`   ${m}`) });
};
