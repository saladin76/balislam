/**
 * بطاقة الجودة (خطة «احترافية بلا مثيل»، قرار المالك ١، المرحلة A المهمة ٢): لا يُنشر فيديو إلا ببطاقة كلها ✓.
 * هذا الملف خالص (لا ملفات ولا ffmpeg): يبني البطاقة من القياسات ومن الخطة، ويقول هل تمنع. القياس والحفظ في measure.ts.
 *
 * حالات البند:
 * - pass ✓ و fail ✗ (يمنع «اصنع النسخة النهائية» والنشر، مع سببه).
 * - unmeasured: قياس لم يُجرَ على الملف الحالي بعد؛ يمنع أيضًا («قِس أولًا»)، فلا يمر ملف لم يُقس.
 * - warn: يُعرض للمالك ولا يمنع (قاعدة قائمة تقول إنه لا يمنع، أو قرار ينتظر المالك).
 * - later: بند لم يُبنَ بعد (مهمة لاحقة أو تيرمينال آخر)؛ يُعرض بمن يبنيه ولا يمنع.
 */
import type { Plan, PlanScene } from "../../plan/types";
import type { EpisodeMedia } from "../../plan/media";
import { sceneSeconds } from "../../plan/duration";
import { normalizeArabic } from "../../script/quranMeta";
import { measureDiversity } from "./diversity";
import { INTERACTIVITY_MIN, type InteractivityReport } from "./interactivity";

export const LOUDNESS_TARGET = -14;
export const LOUDNESS_TOLERANCE = 1;
export const TRUE_PEAK_MAX = -1;
/** سكوت البداية المسموح (KI-091 يقص ما فوقه في التجميع) */
export const HEAD_SILENCE_MAX = 0.6;
export const HOOK_WINDOW_SEC = 15;

export type ItemStatus = "pass" | "fail" | "unmeasured" | "warn" | "later";
export type CardItem = { id: string; label: string; status: ItemStatus; value?: string; need: string; reason?: string };
export type CardSection = { id: "audio" | "picture" | "script" | "packaging" | "shorts"; label: string; items: CardItem[] };
/** الملف الذي قيست عليه البطاقة: الحلقة المجمّعة (قبل النهائية) أو النسخة النهائية (قبل النشر) */
export type CardTarget = "assembly" | "master";
export type QualityCard = { target: CardTarget; file?: { size: number; mtimeMs: number }; measuredAt?: string; sections: CardSection[]; blocks: boolean; blockers: string[] };

/** ما يقيسه measure.ts على الملف (null: لم يُقس بعد) */
export type FileMeasurements = {
  loudness: { integrated: number; truePeak: number };
  headSilence: number;
  interactivity: Pick<InteractivityReport, "percent" | "counted" | "exempt" | "still" | "ok">;
  video: { width: number; height: number };
};

const ar = (n: number, d = 1) => (Number.isFinite(n) ? n.toLocaleString("ar-EG", { maximumFractionDigits: d, minimumFractionDigits: 0 }) : "—∞");
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const unmeasured = (id: string, label: string, need: string): CardItem => ({ id, label, status: "unmeasured", need, reason: "لم يُقس الملف الحالي بعد." });
const later = (id: string, label: string, need: string, who: string): CardItem => ({ id, label, status: "later", need, reason: `يُبنى في ${who}؛ لا يمنع حتى يُبنى.` });

export const audioItems = (m: FileMeasurements | null): CardItem[] => {
  const loudNeed = `${ar(LOUDNESS_TARGET)} LUFS ± ${ar(LOUDNESS_TOLERANCE)}`;
  const peakNeed = `≤ ${ar(TRUE_PEAK_MAX)} dBTP`;
  const headNeed = `≤ ${ar(HEAD_SILENCE_MAX)} ث`;
  const mix = [
    later("narrator-over-ambience", "الراوي أعلى من صوت المكان", "≥ ١٥ dB", "فحص الخلط سطرًا سطرًا (المهمة ٦)"),
    later("narrator-over-sfx", "الراوي أعلى من المؤثر على الجملة", "≥ ٦ dB", "فحص الخلط سطرًا سطرًا (المهمة ٦)"),
  ];
  if (!m) return [unmeasured("loudness", "علو الحلقة", loudNeed), unmeasured("true-peak", "الذروة", peakNeed), unmeasured("head-silence", "سكوت البداية", headNeed), ...mix];
  const { integrated, truePeak } = m.loudness;
  const loudOk = Math.abs(integrated - LOUDNESS_TARGET) <= LOUDNESS_TOLERANCE;
  return [
    { id: "loudness", label: "علو الحلقة", need: loudNeed, value: `${ar(integrated)} LUFS`, status: loudOk ? "pass" : "fail",
      ...(loudOk ? {} : { reason: `${integrated < LOUDNESS_TARGET ? "الحلقة أخفض من علو يوتيوب؛ ستُسمع أضعف من غيرها." : "الحلقة أعلى من علو يوتيوب؛ سيخفضها يوتيوب وقد تتشوه الذروات."} الدمج والنسخة النهائية يضبطانه على −14 تلقائيًا: أعد صنع الملف (ملف صُنع قبل ذلك).` }) },
    { id: "true-peak", label: "الذروة", need: peakNeed, value: `${ar(truePeak)} dBTP`, status: truePeak <= TRUE_PEAK_MAX ? "pass" : "fail",
      ...(truePeak <= TRUE_PEAK_MAX ? {} : { reason: "ذروة الصوت قريبة من الحد فقد تُسمع مقطوعة بعد ضغط يوتيوب." }) },
    { id: "head-silence", label: "سكوت البداية", need: headNeed, value: `${ar(m.headSilence, 2)} ث`, status: m.headSilence <= HEAD_SILENCE_MAX ? "pass" : "fail",
      ...(m.headSilence <= HEAD_SILENCE_MAX ? {} : { reason: "الفيديو يبدأ بصمت؛ المشاهد يغادر قبل أول كلمة (D155)." }) },
    ...mix,
  ];
};

/** 4K: 3840×2160 للحلقة و2160×3840 للعمودي (القاعدة الرابعة) */
export const is4k = (v: { width: number; height: number }) => Math.max(v.width, v.height) >= 3840 && Math.min(v.width, v.height) >= 2160;

export const pictureItems = (m: FileMeasurements | null, target: CardTarget, plan: Plan): CardItem[] => {
  const div = measureDiversity(plan);
  const diversity: CardItem = {
    id: "diversity", label: "تنوع اللقطات", need: `لا تكرار متتالٍ، و${ar(div.minDistinct, 0)} تكوينًا مختلفًا على الأقل`,
    value: `${ar(div.distinct, 0)} من ${ar(div.scenes, 0)}${div.repeats.length ? ` · تكرار متتالٍ: ${ar(div.repeats.length, 0)}` : ""}`,
    status: div.ok ? "pass" : "warn",
    ...(div.ok ? {} : { reason: `للعلم حتى يقرر المالك حده (لا يمنع): ${div.repeats.slice(0, 4).map((x) => `${x.a} ← ${x.b}`).join("، ")}${div.repeats.length > 4 ? "، …" : ""}` }),
  };
  const res: CardItem = target === "assembly"
    ? { id: "resolution", label: "دقة 4K", need: "3840×2160", status: "later", reason: "تُفحص على النسخة النهائية نفسها قبل النشر (المجمّعة معاينة 1080p)." }
    : !m ? unmeasured("resolution", "دقة 4K", "3840×2160")
    : { id: "resolution", label: "دقة 4K", need: "3840×2160", value: `${m.video.width}×${m.video.height}`, status: is4k(m.video) ? "pass" : "fail",
        ...(is4k(m.video) ? {} : { reason: "النسخة النهائية ليست 4K (القاعدة الرابعة)." }) };
  const need = `≥ ${ar(INTERACTIVITY_MIN, 0)}٪ بعد استبعاد السكون المقصود`;
  const inter: CardItem = !m ? unmeasured("interactivity", "التفاعلية", need) : {
    id: "interactivity", label: "التفاعلية", need, value: `${ar(m.interactivity.percent)}٪ (سكون مقصود مستثنى ${ar(m.interactivity.exempt, 0)} ث)`,
    status: m.interactivity.ok ? "pass" : "fail",
    ...(m.interactivity.ok ? {} : { reason: `الشاشة ساكنة أكثر من المسموح${m.interactivity.still.length ? `؛ أطول المقاطع: ${m.interactivity.still.slice(0, 4).map((x) => `${clock(x.from)}–${clock(x.to)}`).join("، ")}` : ""}.` }),
  };
  return [res, inter, diversity];
};

const bare = (s: string) => normalizeArabic(s);
const COMMENT_CTA = /تعليق|التعليقات|علق|شاركنا|اكتب لنا|اخبرنا/;
const REFERRAL = /الحلقه (القادمه|التاليه|السابقه|الماضيه)|حلقات|السلسله/;

/** نص كل ما يظهر أو يُقال في المشهد (التعليق وحقوله النصية) */
const sceneText = (s: PlanScene) => bare([s.narration, ...Object.values(s.props ?? {})].join(" "));

/**
 * الخطاف: سؤال للمشاهد يبدأ نطقه في أول ١٥ ث من الفيديو. موضع الجملة في المشهد بنسبة موضع حروفها من نص المشهد
 * (تقدير يكفي للحكم على أول ربع دقيقة؛ المشهد يُقال بإيقاع واحد).
 */
export const hookIn = (plan: Plan, media?: Pick<EpisodeMedia, "voice" | "recitations">): { ok: boolean; text?: string; at?: number } => {
  let t = 0;
  // أول سؤال في الحلقة كلها: داخل النافذة ينجح، وبعدها يُذكر موضعه ليُعرف كم يُقدَّم
  for (const s of plan.chapters.flatMap((c) => c.scenes)) {
    const text = s.narration ?? "";
    const d = sceneSeconds(s, media);
    let pos = 0;
    for (const sentence of text.split(/(?<=[؟?.!۔])\s+/)) {
      const at = Math.round((t + (text.length ? (pos / text.length) * d : 0)) * 10) / 10;
      if (/[؟?]/.test(sentence)) return { ok: at < HOOK_WINDOW_SEC, text: sentence.trim(), at };
      pos += sentence.length + 1;
    }
    t += d;
  }
  return { ok: false };
};

export const scriptItems = (plan: Plan, media?: Pick<EpisodeMedia, "voice" | "recitations">, citations?: { total: number; open: number }): CardItem[] => {
  const hook = hookIn(plan, media);
  const all = plan.chapters.flatMap((c) => c.scenes);
  const cta = all.some((s) => COMMENT_CTA.test(sceneText(s)));
  const ref = all.some((s) => REFERRAL.test(sceneText(s)));
  return [
    { id: "hook", label: "خطاف في أول ١٥ ثانية", need: "سؤال للمشاهد في أول ١٥ ث", status: hook.ok ? "pass" : "fail",
      ...(hook.ok ? { value: `«${hook.text!.slice(0, 60)}»` }
        : { ...(hook.text ? { value: `أول سؤال عند نحو ${ar(hook.at!, 0)} ث` } : {}),
            reason: `لا سؤال للمشاهد في أول ١٥ ثانية من الكلام (قرار المالك ٢: سؤال في البداية)${hook.text ? `؛ أول سؤال «${hook.text.slice(0, 60)}» يأتي بعدها: قدّمه أو أضف سؤالًا قبله` : ""}.` }) },
    later("arabic", "فحص العربي", "بلا أخطاء", "فحص العربي (المهمة ٦)"),
    { id: "citations", label: "الاستشهادات موثقة", need: "كل استشهاد موثّق في سجل التوثيق",
      ...(!citations || !citations.total ? { status: "warn", reason: "لا سجل توثيق لهذه الحلقة على هذا الجهاز." }
        : citations.open ? { status: "warn", value: `${ar(citations.total - citations.open, 0)} من ${ar(citations.total, 0)}`, reason: "للعلم: سجل التوثيق لا يمنع شيئًا بقرار المالك (٤ و١٠ نوفمبر) حتى يقرر غير ذلك." }
        : { status: "pass", value: `${ar(citations.total, 0)} من ${ar(citations.total, 0)}` }) },
    { id: "comment-cta", label: "دعوة للتعليق", need: "دعوة المشاهد للتعليق", status: cta ? "pass" : "warn", ...(cta ? {} : { reason: "لا دعوة للتعليق في الكلام ولا في شاشة الختام (للعلم)." }) },
    { id: "referral", label: "إحالة للحلقات", need: "إحالة لحلقة أو سلسلة", status: ref ? "pass" : "warn", ...(ref ? {} : { reason: "لا إحالة لحلقة أخرى أو للسلسلة (للعلم)." }) },
  ];
};

/** التغليف والشورتس من تيرمينال B: يُضاف مزوّدهما هنا حين يُسلَّم */
export const packagingItems = (): CardItem[] => [later("packaging", "التغليف (العنوان والصورة المصغّرة والوصف)", "معايير B", "تيرمينال B (النمو)")];
export const shortsItems = (): CardItem[] => [later("shorts", "الشورتس", "معايير B", "تيرمينال B (النمو)")];

/** يمنع ما فيه ✗ أو قياس لم يُجرَ؛ والتنبيه والمؤجل لا يمنعان */
export const BLOCKING: ReadonlySet<ItemStatus> = new Set(["fail", "unmeasured"]);

export const buildCard = (input: {
  target: CardTarget; plan: Plan; media?: Pick<EpisodeMedia, "voice" | "recitations">;
  measured: (FileMeasurements & { file: { size: number; mtimeMs: number }; at: string }) | null;
  citations?: { total: number; open: number };
}): QualityCard => {
  const m = input.measured;
  const sections: CardSection[] = [
    { id: "audio", label: "الصوت", items: audioItems(m) },
    { id: "picture", label: "الصورة", items: pictureItems(m, input.target, input.plan) },
    { id: "script", label: "السكريبت", items: scriptItems(input.plan, input.media, input.citations) },
    { id: "packaging", label: "التغليف", items: packagingItems() },
    { id: "shorts", label: "الشورتس", items: shortsItems() },
  ];
  const blockers = sections.flatMap((s) => s.items.filter((i) => BLOCKING.has(i.status)).map((i) => `${s.label} — ${i.label}: ${i.status === "unmeasured" ? "لم يُقس بعد" : i.reason ?? "✗"}`));
  return { target: input.target, ...(m ? { file: m.file, measuredAt: m.at } : {}), sections, blocks: blockers.length > 0, blockers };
};

/** رسالة الرفض للمالك: ما يمنع، بندًا بندًا */
export const cardRefusal = (card: QualityCard, action: "final" | "publish") =>
  `${action === "final" ? "لا تُصنع النسخة النهائية" : "لا يُمنح إذن النشر"} قبل أن تكون بطاقة الجودة بلا ✗ (${card.target === "assembly" ? "الحلقة المجمّعة" : "النسخة النهائية"}):\n${card.blockers.map((b) => `- ${b}`).join("\n")}`;

const SIGN: Record<ItemStatus, string> = { pass: "✓", fail: "✗", unmeasured: "…", warn: "!", later: "—" };
/** البطاقة نصًا (للطرفية، `bal quality`): كل بند بعلامته وقيمته والمطلوب وسببه، ثم الحكم */
export const cardText = (card: QualityCard): string => {
  const lines = [`بطاقة الجودة — ${card.target === "assembly" ? "الحلقة المجمّعة" : "النسخة النهائية"}${card.measuredAt ? ` (قيست ${card.measuredAt})` : " (لم تُقس بعد)"}`];
  for (const s of card.sections) {
    lines.push("", s.label);
    for (const i of s.items) lines.push(`  ${SIGN[i.status]} ${i.label}${i.value ? `: ${i.value}` : ""} — المطلوب ${i.need}${i.reason ? `\n      ${i.reason}` : ""}`);
  }
  lines.push("", card.blocks ? `تمنع (${card.blockers.length}):\n${card.blockers.map((b) => `  - ${b}`).join("\n")}` : "لا ✗: لا تمنع شيئًا.");
  return lines.join("\n");
};
