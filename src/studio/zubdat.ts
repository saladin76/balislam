import path from "node:path";
import React from "react";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import config from "../../config.json";
import { channelInfo, channelPaths, currentChannelId, loadChannel } from "../channel";
import { collectMedia } from "../plan/collect";
import { sceneSeconds } from "../plan/duration";
import { loadPlan, readJson } from "../plan/io";
import type { Plan, PlanScene } from "../plan/types";
import { introFramesFor } from "../remotion/scenes/ChannelIntro";
import { estimateTimings, toFrames, type WordTiming } from "../remotion/scenes/timing";
import { Mark, Write, type Z } from "../remotion/zubdat/inkKit";
import { KIT_SHOTS, MIN_TEXT, parseInkArgs } from "../remotion/zubdat/kitShots";
import { INK_SHOTS } from "../remotion/zubdat/shots";
import { SACRED_WORD } from "../render/stillness";
import { resolveScriptPath } from "../script/episodes";
import { normalizeArabic } from "../script/quranMeta";
import { buildTashkeelIndex } from "../voice/tashkeel";
import { tashkeelFileFor } from "../voice/generate";
import { tashkeelReport, type TashkeelReport } from "../voice/tashkeelReport";

/**
 * استوديو «زبدة الكتب»: المعايير الدائمة والأدوات الإخراجية وفحوصها الآلية، لهذه القناة وحدها.
 * لا يقرأ ولا يكتب شيئًا من هويات القنوات الأخرى أو قوالبها، ولا يغيّر خطة ولا مشهدًا ولا اعتمادًا:
 * كل ما يفعله قراءة الحلقة وكتابة تقارير في reviews/.
 */
export const ZUBDAT = "zubdat-alkutub";
export const assertZubdat = () => {
  if (currentChannelId() !== ZUBDAT) throw new Error(`أدوات استوديو زبدة الكتب لقناة ${ZUBDAT} وحدها (القناة الحالية: ${currentChannelId()}). استعمل BAL_CHANNEL=${ZUBDAT}.`);
};

// ── المعايير والأدوات (مصدر واحد للوثيقة والتقارير) ──────────────────────
/** حد الخطأ لحجم النص (على عرض 1920)؛ وMIN_TEXT حد التنبيه */
export const MIN_TEXT_HARD = 40;
export type Level = "standard" | "tool" | "episode";
export const LEVEL_AR: Record<Level, string> = { standard: "معيار دائم للقناة", tool: "أداة إخراجية اختيارية", episode: "معالجة خاصة بحلقة" };
/**
 * حالة المعيار بعد مراجعة نطاقه (الأمر 016): ملزم بقرار مسجَّل ومصدره، أو خيار إخراجي، أو منفّذ ينتظر المراجعة.
 * لا يصير معيار ملزمًا لمجرد وجوده في الجدول؛ والمقترحات المستقبلية ليست هنا بل في سجل القرارات.
 */
export type StandardStatus = "binding" | "option" | "pending";
export const STATUS_AR: Record<StandardStatus, string> = { binding: "ملزم", option: "خيار إخراجي", pending: "منفّذ ينتظر المراجعة" };
export type Standard = { id: string; area: 1 | 2 | 3 | 4 | 5 | 6 | 7; level: Level; status: StandardStatus; source: string; title: string; rule: string; enforced: string };
export const AREA_AR = ["", "الموشن جرافيك", "التكوين البصري", "الهوية الفنية", "السرد البصري", "الإخراج الصوتي", "التزامن", "مراجعة الجودة"] as const;

export const STANDARDS: Standard[] = [
  { id: "M1", area: 1, level: "standard", status: "binding", source: "القاعدتان الثانية والثالثة (CLAUDE.md)، وD04", title: "حدث لا تحريك", rule: "كل مشهد شرح حدث بصري له بداية وتطور ونتيجة (يُرسم، يمتلئ، يُشطب، يتصل)، لا نص يتحرك وحده.", enforced: "قالب ink-shot وأدوات kit-*؛ مراجعة المشهد (القاعدة السادسة)" },
  { id: "M2", area: 1, level: "standard", status: "binding", source: "القاعدة الثانية (CLAUDE.md). وحيث يكون الحدث تحركًا للأصفر يُحكم بالمراجعة البصرية (الأمر 016)", title: "الحركة بالمعنى وبالنسبة", rule: "حركة مقصودة في 80% من الثواني على الأقل (الهدف 90%)، ولا مقطع ساكن فوق ثانيتين، والسكون عند الآية وتمهيدها وذكر الله مستثنى ولا يُعوَّض بزخرفة.", enforced: "src/render/motionMeter.ts وstillness.ts (عام للقنوات، يُقرأ هنا)" },
  { id: "M3", area: 1, level: "standard", status: "binding", source: "D07", title: "قلب الصفحة لكل فكرة", rule: "الانتقال بين الأفكار قلب ورقة من اليسار إلى اليمين (اتجاه الكتاب العربي)، لا انتقالات منوعة.", enforced: "InkShot.tsx (ثابت في القالب)" },
  { id: "C1", area: 2, level: "standard", status: "binding", source: "الأمر 016، وD05", title: "المنطقة الآمنة", rule: "هامش 10% من كل جانب، وأسفلها فوق شريط الترجمة (y ≤ 880 من 1080)، والكاميرا لا تقص عنصرًا ظهر.", enforced: "SAFE وfitFrame في InkShot.tsx؛ لوحة الهاتف `zubdat sheet`" },
  { id: "C2", area: 2, level: "standard", status: "binding", source: "الأمر 016: تحت 40px خطأ ملزم. وحد 52px تنبيه يُحسم بمشاهدة الهاتف، لا تكبير آلي", title: "القراءة على الهاتف", rule: `لا نص أصغر من ${MIN_TEXT_HARD}px على عرض 1920 (خطأ)، والمعيار ${MIN_TEXT}px فأكثر (≈11px على هاتف عرضه 390) يُراجع بالمشاهدة، والأساسي 64px فأكثر؛ ونقطة تركيز واحدة في كل لحظة.`, enforced: "`zubdat check` (حجم كل نص مكتوب)" },
  { id: "I1", area: 3, level: "standard", status: "binding", source: "D01، واختبار الهويات المعتمدة", title: "القلم المميِّز", rule: "ورق أبيض بسطور خفيفة وهامش برتقالي، حبر أسود، فسفوري #E8F542 للفكرة وحدها، برتقالي للشطب والتنبيه؛ لاله زار للعناوين.", enforced: "inkKit.tsx (Z من هوية القناة)؛ tests/identity-approved.test.ts" },
  { id: "I2", area: 3, level: "standard", status: "pending", source: "أشكال الأدوات بانتظار الاعتماد البصري (الأمر 016، المختبر 980)", title: "عناصر الهوية", rule: "عدّاد الأفكار، الورقة اللاصقة، بطاقة الكتاب: رسم حبري بلا غلاف واقعي ولا صورة.", enforced: "أدوات kit-ideas وkit-book" },
  { id: "N1", area: 4, level: "standard", status: "pending", source: "الفحص يعمل ويُظهر الخطأ. نطاقه (شاشة النهاية، أسماء السور، اسم القناة) يُراجع قبل جعله ملزمًا", title: "لا نص إلا ما يُنطق", rule: "كل ما يُكتب على الشاشة منطوق في جملة المشهد نفسه، ويظهر لحظة نطقه.", enforced: "`zubdat check` (نص غير منطوق = خطأ)" },
  { id: "N2", area: 4, level: "tool", status: "option", source: "الأمر 016: أدوات اختيارية لا تُفرض، وأشكالها بانتظار الاعتماد البصري", title: "استعارات جاهزة", rule: "عدّاد الأفكار، من… إلى…، سلسلة السبب والنتيجة، مقياس المستوى، بطاقة الكتاب: تُختار عند مناسبتها للفكرة وتُخصَّص بالعبارات والتوقيت.", enforced: "src/remotion/zubdat/kitShots.tsx" },
  { id: "N3", area: 4, level: "episode", status: "option", source: "D03 وD04", title: "اللقطة المصمَّمة", rule: "حين لا تكفي الأدوات العامة يُصمَّم مشهد خاص بالجملة (مثل مشاهد الحلقة 001)، ويبقى ضمن حلقته ولا يُعمَّم إلا بقرار.", enforced: "shots.tsx وshots2.tsx (مشاهد 001)" },
  { id: "V1", area: 5, level: "standard", status: "binding", source: "ملحق الأمر 015 والأمر 016 (دليل الراوي)", title: "إيقاع طبيعي لا سرعة مفروضة", rule: "نطاق 110–140 كلمة في الدقيقة دليل لا قيد؛ الصورة تتبع الراوي (توقيت الكلمات من الصوت)، ولا تُضبط سرعته لتوافق رسمًا.", enforced: "التوقيت من محاذاة الصوت؛ دليل الراوي `zubdat guide` (مدى لا رقم)" },
  { id: "V2", area: 5, level: "standard", status: "binding", source: "القاعدة الخامسة (CLAUDE.md)، وملحق الأمر 013", title: "النطق والوقفات", rule: "تشكيل 98% فأكثر قبل أي صوت، والكلمات ذات النطقين تُراجع في سياقها، والوقفات من علامات الترقيم والمعنى لا من عدّاد، والأسماء بحركة إعرابها في موضعها.", enforced: "مدقق التشكيل؛ `zubdat guide`" },
  { id: "V3", area: 5, level: "standard", status: "binding", source: "ثوابت CLAUDE.md", title: "الأمانة الصوتية", rule: "الراوي لا يتلو القرآن (التلاوة مرخصة)، والأداء عند ذكر الله هادئ خاشع بلا مؤثر.", enforced: "قاعدة المشروع؛ `zubdat guide` يعلّم المواضع" },
  { id: "S1", area: 6, level: "standard", status: "binding", source: "الأمر 016 (فحوص التوقيت)", title: "كل رسم على كلمته", rule: "كل حدث مربوط بكلمة منطوقة (at/end)؛ كلمة لا توجد في الجملة تُسقط الحدث إلى نسبة تقديرية وهذا خطأ.", enforced: "`zubdat check` (توقيت مفقود = خطأ)" },
  { id: "S2", area: 6, level: "standard", status: "binding", source: "القاعدة الثالثة (CLAUDE.md). وتنبيه الطرف يُحسم على الصوت الفعلي", title: "سكون عند الذكر", rule: "لا يُكتب ولا يُظلَّل ولا يقع حدث في نافذة ذكر الله، والكاميرا ساكنة فيها.", enforced: "InkShot.tsx (سكون الكاميرا)؛ `zubdat check` (حدث في نافذة ذكر = خطأ)" },
  { id: "Q1", area: 7, level: "standard", status: "binding", source: "الأمر 016 (بطاقات الجودة)", title: "بطاقة الصورة والحركة", rule: "100 نقطة بأوزان الدليل المهني؛ الاعتماد 85 فأكثر.", enforced: "`zubdat qa`" },
  { id: "Q2", area: 7, level: "standard", status: "binding", source: "ملحق الأمر 015 والأمر 016", title: "بطاقة الراوي", rule: "100 نقطة (20/20/20/20/15/5)؛ 85 نجاح، 80–84 إعادة مقطع، دون 80 رفض؛ ويُرفض فورًا خطأ نطق مؤثر أو أداء آلي مصطنع.", enforced: "`zubdat qa`" },
  { id: "Q3", area: 7, level: "standard", status: "binding", source: "القاعدة السادسة (CLAUDE.md)", title: "الفحص قبل العرض", rule: "لا يُعرض مشهد قبل `zubdat check` بلا أخطاء ولوحة الهاتف عند كل كلمة مرسومة.", enforced: "`zubdat check` و`zubdat sheet`" },
];

export const VISUAL_SCORECARD: [string, number][] = [
  ["جودة الفكرة والسيناريو والسرد", 15], ["جودة التصميم والتكوين البصري", 15], ["احترافية التحريك والانسيابية", 20], ["تناسق الهوية والأسلوب الفني", 10],
  ["جودة التعليق الصوتي والمزج", 10], ["المزامنة والإيقاع والانتقالات", 10], ["وضوح المعلومات وسهولة الفهم", 10], ["الجودة التقنية والتصدير", 5], ["الإبداع والأصالة", 5],
];
export const VOICE_SCORECARD: [string, number][] = [
  ["سلامة النطق والتشكيل والأسماء", 20], ["الوقفات ومواضعها بالمعنى", 20], ["الإيقاع الطبيعي (لا سرعة مفروضة ولا رتابة)", 20], ["النبرة المناسبة للمعنى والتوقير", 20], ["وضوح التسجيل ونظافته", 15], ["الاتساق بين المقاطع", 5],
];
export const VOICE_PASS = 85;
export const VOICE_RETAKE = 80;

// ── زمن الحلقة ───────────────────────────────────────────────────────────
export type SceneSpan = { scene: PlanScene; chapter: number; start: number; dur: number; timings: WordTiming[]; voiced: boolean };
export const episodeTimeline = async (episode: string): Promise<{ plan: Plan; spans: SceneSpan[]; total: number }> => {
  const plan = await loadPlan(episode);
  if (!plan) throw new Error(`لا خطة للحلقة ${episode}`);
  const media = await collectMedia(episode, plan);
  const fps = config.video.fps;
  let t = introFramesFor(channelInfo(loadChannel()), plan);
  const spans: SceneSpan[] = [];
  for (const c of plan.chapters)
    for (const s of c.scenes) {
      const dur = Math.round(sceneSeconds(s, media) * fps);
      const clip = media.voice[s.id];
      const voiced = Boolean(clip && clip.text === s.narration.trim());
      const timings = voiced ? toFrames(clip!.words, fps) : s.narration ? estimateTimings(s.narration, 6, dur - 12) : [];
      spans.push({ scene: s, chapter: c.number, start: t, dur, timings, voiced });
      t += dur;
    }
  return { plan, spans, total: t };
};

// ── فحص مشاهد الحبر ──────────────────────────────────────────────────────
const strip = (w: string) => normalizeArabic(w.replace(/[«»"“”'؟?!.,،:؛…ـ()]/g, ""));
const PRE_AT = ["", "و", "ف", "ب", "ل", "وب", "ول"];
const PRE_END = ["", "و", "ف", "ب", "ل"];
const findWord = (timings: WordTiming[], word: string, nth: number, pre: string[]) => {
  const k = strip(word);
  if (!k) return null;
  let n = 0;
  for (const t of timings) {
    const w = strip(t.word);
    if (pre.some((p) => w === p + k)) if (++n === nth) return t;
  }
  return null;
};
/** جذع الكلمة للمقارنة: بلا سابقة (و ف ب ل ك) ولا «ال» ولا ألف التنوين أو التاء المربوطة في آخرها */
const stem = (w: string) => strip(w).replace(/^(?:[وف]?(?:[بلك])?)(?:ال|ل(?=ل))?/, "").replace(/(?:ا|ة|ه)$/, "");
const spoken = (timings: WordTiming[], token: string, allow: Set<string>) => {
  const k = stem(token);
  if (!k || !/[ء-ي]/.test(k) || allow.has(k)) return true;
  return timings.some((t) => stem(t.word) === k);
};

type Drawn = { id: string; text: string; size: number; p: number; kind: "write" | "mark" };
/** يجمع النصوص المكتوبة (Write) من شجرة المشهد، ويفتح المكوّنات الصغيرة الخالية من الخطافات */
const collectWrites = (node: React.ReactNode, out: Drawn[], depth = 0) => {
  if (depth > 40 || node == null || typeof node === "boolean") return;
  if (Array.isArray(node)) { for (const n of node) collectWrites(n, out, depth + 1); return; }
  if (!React.isValidElement(node)) return;
  const el = node as React.ReactElement<Record<string, unknown>>;
  const props = el.props ?? {};
  if (el.type === Write) { out.push({ id: String(props.id ?? ""), text: String(props.text ?? ""), size: Number(props.size ?? 0), p: Number(props.p ?? 0), kind: "write" }); return; }
  if (el.type === Mark) { out.push({ id: "mark", text: "", size: 0, p: Number(props.p ?? 0), kind: "mark" }); return; }
  if (typeof el.type === "function") {
    try { collectWrites((el.type as (p: unknown) => React.ReactNode)(props), out, depth + 1); } catch { /* مكوّن بخطافات: لا نص فيه من مشاهد الحبر */ }
    return;
  }
  collectWrites(props.children as React.ReactNode, out, depth + 1);
};

export type Finding = { level: "error" | "warn"; code: string; msg: string };
export type InkSceneCheck = { id: string; shot: string; kit: boolean; seconds: number; voiced: boolean; cues: number; texts: Drawn[]; findings: Finding[] };

const Z0: Z = { ink: "#111", paper: "#fff", hl: "#E8F542", alert: "#C2412D", faint: "#888" };

export const checkInkScene = (span: Pick<SceneSpan, "scene" | "dur" | "timings" | "voiced">): InkSceneCheck => {
  const s = span.scene;
  const shot = String(s.props?.shot ?? "");
  const def = INK_SHOTS[shot];
  const findings: Finding[] = [];
  const kit = shot in KIT_SHOTS;
  const base = { id: s.id, shot, kit, seconds: span.dur / config.video.fps, voiced: span.voiced };
  if (!def) return { ...base, cues: 0, texts: [], findings: [{ level: "error", code: "shot", msg: `المشهد «${shot}» غير موجود في مكتبة مشاهد الحبر` }] };
  const missing = new Set<string>();
  const times: [string, number][] = [];
  const mk = (pre: string[], key: "start" | "end") => (word: string, frac: number, nth = 1) => {
    const hit = findWord(span.timings, word, nth, pre);
    // النسبة السالبة «استطلاع» (هل نُطقت الكلمة؟) لا توقيت حدث، فلا تُعد مفقودة
    if (!hit) { if (frac >= 0) missing.add(word ? `«${word}»${nth > 1 ? `#${nth}` : ""}` : "(بلا كلمة)"); return Math.round(frac * span.dur); }
    times.push([word, hit[key]]);
    return hit[key];
  };
  const args = parseInkArgs(String(s.props?.labels ?? ""), String(s.props?.cues ?? ""));
  const texts = new Map<string, Drawn>();
  const frames = [...new Set([0, ...Array.from({ length: 12 }, (_, i) => Math.round(((i + 1) / 12) * (span.dur - 1)))])];
  for (const frame of frames) {
    const out = def.render({ frame, dur: span.dur, z: Z0, at: mk(PRE_AT, "start"), end: mk(PRE_END, "end"), logo: () => null, reg: () => {}, task: String(s.props?.task ?? "") || undefined, args });
    const drawn: Drawn[] = [];
    collectWrites(out.world, drawn);
    for (const d of drawn) if (d.kind === "write") texts.set(`${d.id}|${d.text}`, d);
  }
  for (const m of missing) findings.push({ level: "error", code: "cue", msg: `توقيت على كلمة غير منطوقة في المشهد: ${m} (يسقط الحدث إلى نسبة تقديرية)` });
  const allow = new Set(String(channelInfo(loadChannel(ZUBDAT)).name ?? "").split(/\s+/).map(stem).filter(Boolean));
  for (const d of texts.values()) {
    const bad = d.text.split(/\s+/).filter((w) => !spoken(span.timings, w, allow));
    if (bad.length && !s.narration.trim()) findings.push({ level: "warn", code: "unspoken", msg: `نص في مشهد بلا كلام: «${d.text}» (يُراجع أنه من بصمة القناة)` });
    else if (bad.length) findings.push({ level: "error", code: "unspoken", msg: `نص على الشاشة غير منطوق: «${d.text}» (${bad.join("، ")})` });
    if (d.size < MIN_TEXT_HARD) findings.push({ level: "error", code: "size", msg: `نص أصغر من حد القراءة على الهاتف: «${d.text}» ${Math.round(d.size)}px (< ${MIN_TEXT_HARD})` });
    else if (d.size < MIN_TEXT) findings.push({ level: "warn", code: "size", msg: `نص صغير على الهاتف: «${d.text}» ${Math.round(d.size)}px (المعيار ≥ ${MIN_TEXT})` });
  }
  // توقير (S2): لا قلم يكتب ولا تظليل يُسحب لحظة نطق ذكر الله
  for (const w of span.timings.filter((w) => SACRED_WORD.test(normalizeArabic(w.word)))) {
    const active = new Set<string>();
    const edge = new Set<string>();
    for (let f = w.start; f <= w.end; f += 1) {
      const core = f >= w.start + 4 && f <= w.end - 4;
      const out = def.render({ frame: f, dur: span.dur, z: Z0, at: mk(PRE_AT, "start"), end: mk(PRE_END, "end"), logo: () => null, reg: () => {}, task: String(s.props?.task ?? "") || undefined, args });
      const drawn: Drawn[] = [];
      collectWrites(out.world, drawn);
      for (const d of drawn) if (d.p > 0.001 && d.p < 0.999) (core ? active : edge).add(d.kind === "mark" ? "تظليل" : `كتابة «${d.text}»`);
    }
    if (active.size) findings.push({ level: "error", code: "sacred", msg: `عند «${w.word}»: ${[...active].join("، ")} (لا قلم ولا تظليل عند ذكر الله)` });
    const touch = [...edge].filter((x) => !active.has(x));
    if (touch.length) findings.push({ level: "warn", code: "sacred-edge", msg: `عند طرف «${w.word}» (≤ 4 إطارات): ${touch.join("، ")}؛ يُتحقق منه على توقيت الصوت الفعلي` });
  }
  if (kit) {
    const n = args.labels.length;
    const need: Record<string, [number, number]> = { "kit-ideas": [2, 5], "kit-shift": [2, 2], "kit-chain": [2, 4], "kit-meter": [0, 3], "kit-book": [1, 3] };
    const [lo, hi] = need[shot] ?? [0, 9];
    if (n < lo || n > hi) findings.push({ level: "error", code: "labels", msg: `عدد العبارات ${n}، والأداة تقبل ${lo === hi ? lo : `${lo}–${hi}`}` });
    for (const l of args.labels) if (SACRED_WORD.test(normalizeArabic(l))) findings.push({ level: "warn", code: "sacred-label", msg: `العبارة «${l}» فيها ذكر لله فلا تُكتب (توقير)؛ تبقى للصوت وحده` });
    if (shot === "kit-meter" && !args.cues.rise && !args.labels[1]) findings.push({ level: "error", code: "cue", msg: "مقياس المستوى يحتاج كلمة الارتفاع (rise) أو عبارة «الأعلى»" });
  }
  return { ...base, cues: new Set(times.map(([w]) => w)).size, texts: [...texts.values()], findings };
};

export const checkEpisode = async (episode: string) => {
  assertZubdat();
  const { spans } = await episodeTimeline(episode);
  return spans.filter((s) => s.scene.template === "ink-shot").map(checkInkScene);
};

// ── دليل الراوي ──────────────────────────────────────────────────────────
export type GuideScene = { id: string; text: string; words: number; range: [number, number]; marks: string[]; verse?: string };
const PAUSE: [RegExp, string][] = [[/،/g, "<i class=p1>·</i>"], [/[.]/g, "<i class=p2>‖</i>"], [/[؟?]/g, "<i class=p2>‖</i>"], [/[:؛]/g, "<i class=p1>·</i>"]];
export const narratorGuide = async (episode: string) => {
  assertZubdat();
  const plan = await loadPlan(episode);
  if (!plan) throw new Error(`لا خطة للحلقة ${episode}`);
  const script = await resolveScriptPath(episode);
  const scenes = plan.chapters.flatMap((c) => c.scenes);
  const idx = existsSync(tashkeelFileFor(script)) ? buildTashkeelIndex(await readFile(tashkeelFileFor(script), "utf8")) : null;
  const dict = (await readJson<{ entries?: { text: string; say: string }[] }>(channelPaths().pronunciation)) ?? {};
  const tk: TashkeelReport = tashkeelReport(scenes.filter((s) => s.narration.trim()), idx, dict);
  const out: GuideScene[] = scenes.map((s) => {
    const words = s.narration.trim() ? s.narration.trim().split(/\s+/).length : 0;
    const marks: string[] = [];
    if (s.template === "verse-card") marks.push("آية: تلاوة مرخّصة، لا يقرؤها الراوي");
    if (SACRED_WORD.test(normalizeArabic(s.narration))) marks.push("ذكر الله: أداء هادئ خاشع، والصورة ساكنة");
    if (/«[^»]+»/.test(s.narration)) marks.push("اقتباس بين «»: يُميَّز بالنبرة لا بالتمثيل");
    if (/[؟?]/.test(s.narration)) marks.push("سؤال: نبرة استفهام حقيقية ثم وقفة");
    const gap = tk.gaps.find((g) => g.sceneId === s.id);
    if (gap) marks.push(`بلا تشكيل: ${gap.words.join("، ")}`);
    const amb = tk.ambiguous.filter((a) => a.scenes.includes(s.id));
    if (amb.length) marks.push(`لها أكثر من نطق: ${amb.map((a) => a.forms.join(" / ")).join("؛ ")}`);
    return { id: s.id, text: s.narration, words, range: [(words / 140) * 60, (words / 110) * 60], marks, verse: s.ayahKey };
  });
  return { scenes: out, tashkeel: tk };
};

// ── التقارير ─────────────────────────────────────────────────────────────
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const reviewsDir = async (episode: string) => {
  const dir = path.join(path.dirname(await resolveScriptPath(episode)), "reviews");
  await mkdir(dir, { recursive: true });
  return dir;
};
const page = (title: string, body: string) => `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>:root{--ink:#111;--rule:#ddd;--hl:#E8F542;--alert:#C2412D}*{box-sizing:border-box}body{margin:0;background:#f6f6f3;color:var(--ink);font:16px/1.8 "IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif}.wrap{max-width:1100px;margin:0 auto;padding:24px 16px 64px}h1{font-size:26px;margin:0 0 6px}h2{font-size:20px;margin:28px 0 8px;border-bottom:3px solid var(--hl);display:inline-block}section,article{background:#fff;border:1px solid var(--rule);border-radius:12px;padding:12px 16px;margin:12px 0;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%;font-size:14px}th,td{border:1px solid var(--rule);padding:5px 7px;text-align:start;vertical-align:top}th{background:#fafaf6}code{background:#f0f0ea;padding:0 4px;border-radius:4px;direction:ltr;unicode-bidi:isolate}.err{background:#fbe6e1;color:var(--alert);padding:0 5px;font-weight:700}.warn{background:#fff6d6;color:#7a5b00;padding:0 5px;font-weight:700}.ok{background:#e5f3ea;color:#1f6f43;padding:0 5px;font-weight:700}.say{font-size:20px;line-height:2.2}.p1{color:#888;font-style:normal;padding:0 3px}.p2{color:var(--alert);font-style:normal;font-weight:700;padding:0 4px}.muted{color:#666;font-size:14px}.scroll{overflow-x:auto}</style></head><body><div class="wrap">${body}</div></body></html>`;

const findingsHtml = (f: Finding[]) => (f.length ? f.map((x) => `<div><span class="${x.level === "error" ? "err" : "warn"}">${x.level === "error" ? "خطأ" : "تنبيه"}</span> ${esc(x.msg)}</div>`).join("") : `<span class="ok">سليم</span>`);

export const writeCheckReport = async (episode: string, checks: InkSceneCheck[]) => {
  const errors = checks.reduce((n, c) => n + c.findings.filter((f) => f.level === "error").length, 0);
  const warns = checks.reduce((n, c) => n + c.findings.filter((f) => f.level === "warn").length, 0);
  const rows = checks.map((c) => `<tr><td><b>${esc(c.id)}</b><div class="muted">${esc(c.shot)}${c.kit ? " · أداة" : ""} · ${c.seconds.toFixed(1)} ث · ${c.voiced ? "توقيت الصوت" : "توقيت تقديري"}</div></td><td>${c.cues}</td><td>${c.texts.length}${c.texts.length ? ` <span class="muted">(أصغرها ${Math.round(Math.min(...c.texts.map((t) => t.size)))}px)</span>` : ""}</td><td>${findingsHtml(c.findings)}</td></tr>`).join("");
  const body = `<h1>فحص مشاهد الحبر — الحلقة ${esc(episode)}</h1><p class="muted">فحص آلي للمعايير S1 وS2 وN1 وC2 (زبدة الكتب). لا يغيّر شيئًا في الحلقة. ${checks.some((c) => !c.voiced) ? "التوقيت تقديري حيث لا صوت؛ يُعاد الفحص بعد الصوت على توقيته الفعلي." : ""}</p>
<section><b>${checks.length}</b> مشهد حبر · <span class="${errors ? "err" : "ok"}">${errors} خطأ</span> · <span class="${warns ? "warn" : "ok"}">${warns} تنبيه</span></section>
<div class="scroll"><table><thead><tr><th>المشهد</th><th>كلمات التوقيت</th><th>نصوص مكتوبة</th><th>النتيجة</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  const file = path.join(await reviewsDir(episode), "studio-check.html");
  await writeFile(file, page(`فحص مشاهد الحبر — ${episode}`, body));
  return { file, errors, warns };
};

const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(0).padStart(2, "0")}`;
export const writeGuideReport = async (episode: string, g: Awaited<ReturnType<typeof narratorGuide>>) => {
  const total = g.scenes.reduce((n, s) => n + s.words, 0);
  const lo = g.scenes.reduce((n, s) => n + s.range[0], 0), hi = g.scenes.reduce((n, s) => n + s.range[1], 0);
  const say = (t: string) => PAUSE.reduce((acc, [re, mark]) => acc.replace(re, (m) => `${m}${mark}`), esc(t));
  const rows = g.scenes.map((s) => `<article><b>${esc(s.id)}</b> <span class="muted">${s.words} كلمة · ${s.verse ? `بطاقة ${esc(s.verse)}` : `${s.range[0].toFixed(0)}–${s.range[1].toFixed(0)} ث بإيقاع طبيعي`}</span>${s.text ? `<div class="say">${say(s.text)}</div>` : ""}${s.marks.map((m) => `<div>• ${esc(m)}</div>`).join("")}</article>`).join("");
  const body = `<h1>دليل الراوي — الحلقة ${esc(episode)}</h1>
<section><b>${total}</b> كلمة · المدى الطبيعي ${fmt(lo)}–${fmt(hi)} (110–140 كلمة/د دليل لا قيد) · تغطية التشكيل <span class="${g.tashkeel.ok ? "ok" : "err"}">${(g.tashkeel.coverage * 100).toFixed(1)}%</span> (الحد ${(g.tashkeel.min * 100).toFixed(0)}%)</section>
<section class="muted">العلامات: <i class=p1>·</i> وقفة قصيرة يقتضيها المعنى (فاصلة) · <i class=p2>‖</i> وقفة تامة (نهاية جملة) (وبعد علامة السؤال: نبرة استفهام ثم وقفة). هي اقتراح من الترقيم، والقرار للمعنى؛ لا وقفة مفروضة قبل كلمة لم يُطلب إبرازها، ولا إيقاع ثابت في الكلام كله. الصورة تتبع الراوي لا العكس.</section>
${rows}`;
  const file = path.join(await reviewsDir(episode), "narrator-guide.html");
  await writeFile(file, page(`دليل الراوي — ${episode}`, body));
  return file;
};

const scoreTable = (rows: [string, number][]) => `<table><thead><tr><th>المعيار</th><th>الوزن</th><th>الدرجة</th><th>الملاحظة</th></tr></thead><tbody>${rows.map(([n, w]) => `<tr><td>${esc(n)}</td><td>${w}</td><td>__ / ${w}</td><td></td></tr>`).join("")}<tr><th>المجموع</th><th>100</th><th>__ / 100</th><th></th></tr></tbody></table>`;

export const writeQaReport = async (episode: string, checks: InkSceneCheck[], motion: string | null) => {
  const errors = checks.flatMap((c) => c.findings.filter((f) => f.level === "error").map((f) => `${c.id}: ${f.msg}`));
  const body = `<h1>مراجعة الجودة — الحلقة ${esc(episode)}</h1><p class="muted">بطاقتا المعيارين Q1 وQ2 لاستوديو زبدة الكتب. الأقسام الآلية تُملأ من الفحص، والدرجات يملؤها المراجع؛ هذا التقرير لا يعتمد شيئًا.</p>
<h2>الآلي</h2><section><div>مشاهد الحبر: ${errors.length ? `<span class="err">${errors.length} خطأ</span>${errors.slice(0, 12).map((e) => `<div class="muted">${esc(e)}</div>`).join("")}` : `<span class="ok">بلا أخطاء</span>`} (التفصيل: <code>reviews/studio-check.html</code>)</div><div>الحركة: ${motion ? esc(motion) : "لا تقرير حركة بعد (<code>npx bal render</code> يكتبه)"}</div></section>
<h2>بطاقة الصورة والحركة (Q1)</h2><section>${scoreTable(VISUAL_SCORECARD)}<p>الاعتماد: 85 فأكثر، مع خلو الفحص الآلي من الأخطاء ومراجعة كل مشهد (القاعدة السادسة).</p></section>
<h2>بطاقة الراوي (Q2)</h2><section>${scoreTable(VOICE_SCORECARD)}<p>${VOICE_PASS} فأكثر نجاح · ${VOICE_RETAKE}–${VOICE_PASS - 1} إعادة المقاطع الضعيفة ثم إعادة التقييم · دون ${VOICE_RETAKE} رفض. ويُرفض فورًا مهما كان المجموع: خطأ نطق مؤثر في المعنى أو في اسم أو في آية/ذكر، أو أداء آلي مصطنع.</p></section>`;
  const file = path.join(await reviewsDir(episode), "studio-qa.html");
  await writeFile(file, page(`مراجعة الجودة — ${episode}`, body));
  return file;
};

// ── لوحة الهاتف: لقطة عند كل كلمة مرسومة، بعرض هاتف 390 مع المنطقة الآمنة ──
export const sheetMoments = async (episode: string) => {
  const { spans } = await episodeTimeline(episode);
  const fps = config.video.fps;
  return spans.filter((s) => s.scene.template === "ink-shot").map((sp) => {
    const def = INK_SHOTS[String(sp.scene.props?.shot ?? "")];
    const ts = new Set<number>();
    const rec = (pre: string[], key: "start" | "end") => (word: string, frac: number, nth = 1) => {
      const hit = findWord(sp.timings, word, nth, pre);
      const t = hit ? hit[key] : Math.round(frac * sp.dur);
      ts.add(t);
      return t;
    };
    if (def) def.render({ frame: 0, dur: sp.dur, z: Z0, at: rec(PRE_AT, "start"), end: rec(PRE_END, "end"), logo: () => null, reg: () => {}, args: parseInkArgs(String(sp.scene.props?.labels ?? ""), String(sp.scene.props?.cues ?? "")) });
    // لحظة بعد اكتمال كل حدث بقليل، ولحظة بين الأحداث، والنهاية
    const sorted = [...ts].filter((t) => t >= 0 && t < sp.dur).sort((a, b) => a - b);
    const pick = [...new Set([...sorted.map((t) => Math.min(sp.dur - 14, t + 14)), sp.dur - 14])].sort((a, b) => a - b);
    const thin = pick.filter((t, i) => i === 0 || t - pick[i - 1]! >= 12).slice(0, 10);
    return { id: sp.scene.id, shot: String(sp.scene.props?.shot ?? ""), times: thin.map((f) => (sp.start + f) / fps) };
  });
};
