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
import { normalizeArabic } from "../../script/quranMeta";
import { measureDiversity } from "./diversity";
import { measureCraft } from "./craft";
import { seriesDiffIssues, type SeriesDiffReport } from "./seriesDiff";
import { interactivityMinFor, type InteractivityReport } from "./interactivity";
import { MIX_MIN, type MixReport } from "./mix";
import { FREEZE_MAX_SEC, SILENCE_MAX_SEC, pauseText, type PauseReport } from "./pauses";
import { BLANK_MAX_SEC } from "./blankFrame";

export const LOUDNESS_TARGET = -14;
export const LOUDNESS_TOLERANCE = 1;
export const TRUE_PEAK_MAX = -1;
/** سكوت البداية المسموح (KI-091 يقص ما فوقه في التجميع) */
export const HEAD_SILENCE_MAX = 0.6;

export type ItemStatus = "pass" | "fail" | "unmeasured" | "warn" | "later";
/** stage "publish": يمنع إذن النشر وحده (التغليف والشورتس تُصنع من النسخة النهائية وبعد نشرها)، لا صنع النسخة النهائية */
export type CardItem = { id: string; label: string; status: ItemStatus; value?: string; need: string; reason?: string; stage?: "publish" };
export type CardSection = { id: "audio" | "picture" | "craft" | "script" | "packaging" | "shorts"; label: string; items: CardItem[] };
/** الملف الذي قيست عليه البطاقة: الحلقة المجمّعة (قبل النهائية) أو النسخة النهائية (قبل النشر) */
export type CardTarget = "assembly" | "master";
export type QualityCard = { target: CardTarget; file?: { size: number; mtimeMs: number }; measuredAt?: string; sections: CardSection[]; publishBlocks: boolean; publishBlockers: string[]; blocks: boolean; blockers: string[] };

/** ما يقيسه measure.ts على الملف (null: لم يُقس بعد) */
export type FileMeasurements = {
  loudness: { integrated: number; truePeak: number };
  headSilence: number;
  interactivity: Pick<InteractivityReport, "percent" | "counted" | "exempt" | "still" | "ok">;
  video: { width: number; height: number };
  /** فحص الخلط سطرًا سطرًا (mix.ts)؛ غيابه في قياس قديم = لم يُقس */
  mix?: MixReport;
  /** D218: السكوت الأطول من ثانية (pauses.ts)؛ غيابه في قياس قديم = لم يُقس */
  silence?: PauseReport;
  /** D218: الشاشة الواقفة الأطول من ٣ ث بعد إعفاء الآيات المتلوّة وحدها */
  frozen?: PauseReport;
  /** D218: الإطار شبه الفارغ أثناء الكلام أطول من ثانية (blankFrame.ts) */
  blank?: PauseReport;
};

const ar = (n: number, d = 1) => (Number.isFinite(n) ? n.toLocaleString("ar-EG", { maximumFractionDigits: d, minimumFractionDigits: 0 }) : "—∞");
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const unmeasured = (id: string, label: string, need: string): CardItem => ({ id, label, status: "unmeasured", need, reason: "لم يُقس الملف الحالي بعد." });
/** D218: بند الفترات الطويلة (السكوت أو الشاشة الواقفة) يمنع كالتفاعلية، ويسمّي كل فترة بزمنها ومشهدها */
const pauseItem = (id: string, label: string, need: string, r: PauseReport | undefined, why: string): CardItem => {
  if (!r) return unmeasured(id, label, need);
  const ok = r.spans.length === 0;
  return { id, label, need, status: ok ? "pass" : "fail",
    value: ok ? `أطولها ${ar(r.longest, 1)} ث` : `عدد المواضع ${ar(r.spans.length, 0)}، أطولها ${ar(r.longest, 1)} ث`,
    ...(ok ? {} : { reason: `${why}: ${r.spans.slice(0, 10).map(pauseText).join("، ")}${r.spans.length > 10 ? "، …" : ""}.` }) };
};
export const silenceItem = (m: FileMeasurements | null) =>
  pauseItem("long-silence", "لا سكوت أطول من ثانية", `لا سكوت فوق ${ar(SILENCE_MAX_SEC, 0)} ث`, m?.silence, "سكوت يُشعر المشاهد بأن الفيديو انتهى (طلب المالك ٢٤ نوفمبر)");
export const frozenItem = (m: FileMeasurements | null) =>
  pauseItem("frozen-screen", "لا شاشة واقفة أطول من ٣ ثوانٍ", `لا شاشة واقفة فوق ${ar(FREEZE_MAX_SEC, 0)} ث إلا بطاقة آية تحتها تلاوة`, m?.frozen, "صورة المشهد واقفة (وآية بلا تلاوة معتمدة لا تُعفى)");
export const blankItem = (m: FileMeasurements | null) =>
  pauseItem("blank-frame", "لا إطار شبه فارغ أثناء الكلام", `لا إطار شبه فارغ فوق ${ar(BLANK_MAX_SEC, 0)} ث والراوي يتكلم`, m?.blank, "الراوي يتكلم والصفحة شبه فارغة (لا عنوان ولا رسم)");
const later = (id: string, label: string, need: string, who: string): CardItem => ({ id, label, status: "later", need, reason: `يُبنى في ${who}؛ لا يمنع حتى يُبنى.` });

export const audioItems = (m: FileMeasurements | null): CardItem[] => {
  const loudNeed = `${ar(LOUDNESS_TARGET)} LUFS ± ${ar(LOUDNESS_TOLERANCE)}`;
  const peakNeed = `≤ ${ar(TRUE_PEAK_MAX)} dBTP`;
  const headNeed = `≤ ${ar(HEAD_SILENCE_MAX)} ث`;
  const mix = mixItems(m?.mix);
  if (!m) return [unmeasured("loudness", "علو الحلقة", loudNeed), unmeasured("true-peak", "الذروة", peakNeed), unmeasured("head-silence", "سكوت البداية", headNeed), silenceItem(m), ...mix];
  const { integrated, truePeak } = m.loudness;
  const loudOk = Math.abs(integrated - LOUDNESS_TARGET) <= LOUDNESS_TOLERANCE;
  return [
    { id: "loudness", label: "علو الحلقة", need: loudNeed, value: `${ar(integrated)} LUFS`, status: loudOk ? "pass" : "fail",
      ...(loudOk ? {} : { reason: `${integrated < LOUDNESS_TARGET ? "الحلقة أخفض من علو يوتيوب؛ ستُسمع أضعف من غيرها." : "الحلقة أعلى من علو يوتيوب؛ سيخفضها يوتيوب وقد تتشوه الذروات."} الدمج والنسخة النهائية يضبطانه على −14 تلقائيًا: أعد صنع الملف (ملف صُنع قبل ذلك).` }) },
    { id: "true-peak", label: "الذروة", need: peakNeed, value: `${ar(truePeak)} dBTP`, status: truePeak <= TRUE_PEAK_MAX ? "pass" : "fail",
      ...(truePeak <= TRUE_PEAK_MAX ? {} : { reason: "ذروة الصوت قريبة من الحد فقد تُسمع مقطوعة بعد ضغط يوتيوب." }) },
    { id: "head-silence", label: "سكوت البداية", need: headNeed, value: `${ar(m.headSilence, 2)} ث`, status: m.headSilence <= HEAD_SILENCE_MAX ? "pass" : "fail",
      ...(m.headSilence <= HEAD_SILENCE_MAX ? {} : { reason: "الفيديو يبدأ بصمت؛ المشاهد يغادر قبل أول كلمة (D155)." }) },
    silenceItem(m),
    ...mix,
  ];
};

/** بندا الخلط: أقل فرق بين الراوي والمؤثر في جمل الحلقة، وأسوأ الجمل سببًا */
export const mixItems = (r: MixReport | undefined): CardItem[] => {
  const spec = [
    { id: "narrator-over-ambience", label: "الراوي أعلى من صوت المكان", kind: "ambience" as const, min: MIX_MIN.ambience },
    { id: "narrator-over-sfx", label: "الراوي أعلى من المؤثر على الجملة", kind: "sfx" as const, min: MIX_MIN.sfx },
  ];
  return spec.map(({ id, label, kind, min }): CardItem => {
    const need = `≥ ${ar(min, 0)} dB في كل جملة`;
    if (!r) return unmeasured(id, label, need);
    const lines = r.lines.filter((l) => l.kind === kind);
    if (!lines.length) return { id, label, need, status: "pass", value: kind === "ambience" ? "لا صوت مكان تحت الكلام" : "لا مؤثر على الكلام" };
    const bad = lines.filter((l) => !l.ok).sort((a, b) => a.margin - b.margin);
    const least = Math.min(...lines.map((l) => l.margin));
    return { id, label, need, value: `أقل فرق ${ar(least)} dB في ${ar(lines.length, 0)} جملة`, status: bad.length ? "fail" : "pass",
      ...(bad.length ? { reason: `المؤثر يغطي الراوي في ${ar(bad.length, 0)} جملة؛ اخفضه أو انقله بعيدًا عن الكلام: ${bad.slice(0, 4).map((l) => `${l.scene} «${l.sentence.slice(0, 30)}» ← ${l.sfx} (${ar(l.margin)} dB)`).join("، ")}${bad.length > 4 ? "، …" : ""}` } : {}) };
  });
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
  const iMin = interactivityMinFor(plan.channel);
  const iOk = Boolean(m && m.interactivity.percent >= iMin);
  const need = `≥ ${ar(iMin, 0)}٪ بعد استبعاد السكون المقصود`;
  const inter: CardItem = !m ? unmeasured("interactivity", "التفاعلية", need) : {
    id: "interactivity", label: "التفاعلية", need, value: `${ar(m.interactivity.percent)}٪ (سكون مقصود مستثنى ${ar(m.interactivity.exempt, 0)} ث)`,
    status: iOk ? "pass" : "fail",
    ...(iOk ? {} : { reason: `الشاشة ساكنة أكثر من المسموح${m.interactivity.still.length ? `؛ أطول المقاطع: ${m.interactivity.still.slice(0, 4).map((x) => `${clock(x.from)}–${clock(x.to)}`).join("، ")}` : ""}.` }),
  };
  return [res, inter, frozenItem(m), blankItem(m), diversity];
};

/**
 * «الحِرفة» (قرار المالك ٢٢ نوفمبر): بنود تُقاس من الخطة، «للعلم» لا تمنع حتى يحدد المالك حدودها؛ وما تحقق فيه
 * المعيار كله (كل مشهد متحرك، ولا لقطة مكررة) يظهر ✓.
 */
/** «الاختلاف عن الحلقة السابقة في السلسلة» (D204): تنبيه لا يمنع؛ وأول حلقة في سلسلتها ✓ */
export const seriesDiffItem = (r?: SeriesDiffReport | null): CardItem => {
  const base = { id: "craft-series", label: "الاختلاف عن الحلقة السابقة في السلسلة", need: "افتتاح مختلف، ونصف التكوينات جديدة، ولا قوالب بالترتيب نفسه (D204)" };
  if (!r) return { ...base, status: "later", reason: "تُقارن حين تُقرأ حلقات السلسلة." };
  if (!r.previous) return { ...base, status: "pass", value: "لا حلقة سابقة في السلسلة" };
  const issues = seriesDiffIssues(r);
  const value = `مقارنة بالحلقة ${r.previous}: ${ar(Math.round(r.newShare * 100), 0)}٪ تكوينات جديدة (${ar(r.newCount, 0)} من ${ar(r.total, 0)})`;
  return issues.length ? { ...base, status: "warn", value, reason: `${issues.join("؛ ")}. للعلم حتى يحدد المالك الحد (لا يمنع).` } : { ...base, status: "pass", value };
};

export const craftItems = (plan: Plan, media?: Pick<EpisodeMedia, "voice" | "recitations">, series?: SeriesDiffReport | null): CardItem[] => {
  const c = measureCraft(plan, media);
  const pct = c.scenes ? Math.round((c.cameraMoving / c.scenes) * 100) : 100;
  const note = "للعلم حتى يحدد المالك الحد (لا يمنع).";
  // D158، قرار المالك (٢٣ نوفمبر): حد المؤثرات المتزامنة يبقى للعلم ولا يمنع حتى نرى ٣ حلقات
  const sfxNote = "للعلم ولا يمنع حتى نرى ٣ حلقات (قرار المالك ٢٣ نوفمبر).";
  return [
    { id: "craft-camera", label: "مشاهد فيها حركة كاميرا", need: "حركة كاميرا مسبَّبة في كل مشهد", value: `${ar(pct, 0)}٪ (${ar(c.cameraMoving, 0)} من ${ar(c.scenes, 0)})`,
      status: pct === 100 ? "pass" : "warn", ...(pct === 100 ? {} : { reason: note }) },
    { id: "craft-sizes", label: "أحجام اللقطات في الدقيقة", need: "واسعة ومتوسطة وقريبة وتفاصيل",
      ...(c.sizesPerMinute === null ? { status: "warn" as const, reason: "قوالب الحلقة لا تعلن حجم لقطاتها (props.shotSize) بعد." }
        : { status: "warn" as const, value: `${ar(c.sizesPerMinute)} حجم في الدقيقة (${ar(c.sizesDeclared, 0)} مشهدًا معلنًا)`, reason: note }) },
    { id: "craft-sfx", label: "مؤثرات متزامنة مع الحركة", need: "صوت مع كل حركة (D158)", value: `${ar(c.syncedSfx, 0)}`, status: "warn", reason: sfxNote },
    { id: "craft-repeat", label: "عدم تكرار اللقطة", need: "لا لقطة مرتين في الحلقة", value: c.repeatedShots.length ? `${ar(c.repeatedShots.length, 0)} لقطة مكررة` : "لا تكرار",
      status: c.repeatedShots.length ? "warn" : "pass",
      ...(c.repeatedShots.length ? { reason: `${note} ${c.repeatedShots.slice(0, 3).map((x) => x.scenes.join(" = ")).join("، ")}${c.repeatedShots.length > 3 ? "، …" : ""}` } : {}) },
    ...(series === undefined ? [] : [seriesDiffItem(series)]),
  ];
};

const bare = (s: string) => normalizeArabic(s);
const COMMENT_CTA = /تعليق|التعليقات|علق|شاركنا|اكتب لنا|اخبرنا/;
const REFERRAL = /الحلقه (القادمه|التاليه|السابقه|الماضيه)|حلقات|السلسله/;

/** نص كل ما يظهر أو يُقال في المشهد (التعليق وحقوله النصية) */
const sceneText = (s: PlanScene) => bare([s.narration, ...Object.values(s.props ?? {})].join(" "));

export const scriptItems = (plan: Plan, media?: Pick<EpisodeMedia, "voice" | "recitations">, citations?: { total: number; open: number }): CardItem[] => {
  const all = plan.chapters.flatMap((c) => c.scenes);
  const cta = all.some((s) => COMMENT_CTA.test(sceneText(s)));
  const ref = all.some((s) => REFERRAL.test(sceneText(s)));
  return [
    later("arabic", "فحص العربي", "بلا أخطاء", "فحص العربي (المهمة ٦)"),
    { id: "citations", label: "الاستشهادات موثقة", need: "كل استشهاد موثّق في سجل التوثيق",
      ...(!citations || !citations.total ? { status: "warn", reason: "لا سجل توثيق لهذه الحلقة على هذا الجهاز." }
        : citations.open ? { status: "warn", value: `${ar(citations.total - citations.open, 0)} من ${ar(citations.total, 0)}`, reason: "للعلم: سجل التوثيق لا يمنع شيئًا بقرار المالك (٤ و١٠ نوفمبر) حتى يقرر غير ذلك." }
        : { status: "pass", value: `${ar(citations.total, 0)} من ${ar(citations.total, 0)}` }) },
    { id: "comment-cta", label: "دعوة للتعليق", need: "دعوة المشاهد للتعليق", status: cta ? "pass" : "warn", ...(cta ? {} : { reason: "لا دعوة للتعليق في الكلام ولا في شاشة الختام (للعلم)." }) },
    { id: "referral", label: "إحالة للحلقات", need: "إحالة لحلقة أو سلسلة", status: ref ? "pass" : "warn", ...(ref ? {} : { reason: "لا إحالة لحلقة أخرى أو للسلسلة (للعلم)." }) },
  ];
};

/** بنود التغليف والشورتس من B (`src/package/qualityCard.ts`) بصيغة البطاقة؛ كلها «للنشر» */
export type ReadyItems = { items: { id: string; label: string; ok: boolean; detail?: string }[] };
const fromReady = (r: ReadyItems | undefined, missing: CardItem): CardItem[] =>
  !r ? [missing] : r.items.map((i) => ({
    id: i.id, label: i.label, need: i.label, stage: "publish" as const,
    // رابط الحلقة في وصف الشورت لا يوجد إلا بعد نشر الحلقة: تنبيه لا منع
    status: i.ok ? "pass" as const : i.id === "shorts-link" ? "warn" as const : "fail" as const,
    ...(i.detail ? { reason: i.detail } : {}),
  }));
export const packagingItems = (r?: ReadyItems): CardItem[] =>
  fromReady(r, { id: "packaging", label: "حزمة النشر (publish.json)", need: "العناوين والأغلفة والوصف", status: "fail", stage: "publish", reason: "لا توجد حزمة نشر للحلقة بعد." });
export const shortsItems = (r?: ReadyItems): CardItem[] =>
  fromReady(r, { id: "shorts", label: "الشورتس", need: "شورتس بعناوين أسئلة", status: "fail", stage: "publish", reason: "لا توجد حزمة نشر للحلقة بعد." });

/** يمنع ما فيه ✗ أو قياس لم يُجرَ؛ والتنبيه والمؤجل لا يمنعان */
export const BLOCKING: ReadonlySet<ItemStatus> = new Set(["fail", "unmeasured"]);

export const buildCard = (input: {
  target: CardTarget; plan: Plan; media?: Pick<EpisodeMedia, "voice" | "recitations">;
  measured: (FileMeasurements & { file: { size: number; mtimeMs: number }; at: string }) | null;
  citations?: { total: number; open: number };
  ready?: { packaging: ReadyItems; shorts: ReadyItems };
  /** D204: المقارنة بالحلقة السابقة في السلسلة (null: لم تُقرأ) */
  series?: SeriesDiffReport | null;
}): QualityCard => {
  const m = input.measured;
  const sections: CardSection[] = [
    { id: "audio", label: "الصوت", items: audioItems(m) },
    { id: "picture", label: "الصورة", items: pictureItems(m, input.target, input.plan) },
    { id: "craft", label: "الحِرفة", items: craftItems(input.plan, input.media, input.series) },
    { id: "script", label: "السكريبت", items: scriptItems(input.plan, input.media, input.citations) },
    { id: "packaging", label: "التغليف", items: packagingItems(input.ready?.packaging) },
    { id: "shorts", label: "الشورتس", items: shortsItems(input.ready?.shorts) },
  ];
  const line = (s: CardSection, i: CardItem) => `${s.label} — ${i.label}: ${i.status === "unmeasured" ? "لم يُقس بعد" : i.reason ?? "✗"}`;
  const publishBlockers = sections.flatMap((s) => s.items.filter((i) => BLOCKING.has(i.status)).map((i) => line(s, i)));
  // النسخة النهائية لا ينتظرها ما يُصنع منها أو بعد نشرها
  const blockers = sections.flatMap((s) => s.items.filter((i) => BLOCKING.has(i.status) && i.stage !== "publish").map((i) => line(s, i)));
  return { target: input.target, ...(m ? { file: m.file, measuredAt: m.at } : {}), sections, blocks: blockers.length > 0, blockers, publishBlocks: publishBlockers.length > 0, publishBlockers };
};

/** رسالة الرفض للمالك: ما يمنع، بندًا بندًا */
export const cardRefusal = (card: QualityCard, action: "final" | "publish") =>
  `${action === "final" ? "لا تُصنع النسخة النهائية" : "لا يُمنح إذن النشر"} قبل أن تكون بطاقة الجودة بلا ✗ (${card.target === "assembly" ? "الحلقة المجمّعة" : "النسخة النهائية"}):\n${(action === "final" ? card.blockers : card.publishBlockers).map((b) => `- ${b}`).join("\n")}`;

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
