import type { Plan } from "../plan/types";
import type { EpisodeMedia } from "../plan/media";
import { sceneSeconds } from "../plan/duration";
import { normalizeArabic } from "../script/quranMeta";
import { estimateTimings, splitWords } from "../remotion/scenes/timing";
import { HZ_LEAD, HZ_META, hzSentences, verseWindow } from "../remotion/dafatir/horizon/meta";
import { buildTimeline, timelineFromWords } from "../remotion/dafatir/horizon/timeline";

/**
 * السكون المقصود (قرار صاحب القناة، مراجعة G5 للحلقة 001 بزبدة الكتب): لا تُفرض حركة عند كلام الله
 * ولا عند ذكره. هذه المقاطع تُستثنى من نسبة الحركة الوظيفية ومن «المقاطع الساكنة»، ويُعلن زمنها في التقرير.
 * - مشهد الآية (verse-card) كله، وتمهيد الآية (ink-shot بمشهد verse-intro-*).
 * - كل ذكر لله داخل أي مشهد: من قبل الكلمة بربع ثانية إلى بعدها بربع ثانية.
 * - تمهيد الآية في أي قالب: الجملة التي تسبق بطاقة الآية مباشرة وتنتهي بنقطتين («فقال الله تعالى:»)، كلها.
 * - الدعاء المنطوق كله (نداء لله، فهو ذكر له): العبارة المقتبسة «…» التي تبدأ بـ«اللهم» أو «ربنا» أو «رب»،
 *   من أول كلمة فيها إلى آخرها (بالهامش نفسه). لا يُحدَّد بمشهد ولا بقالب: أي دعاء مقتبس في أي مشهد.
 */
export const SACRED_WORD = /الله|لله|ربنا|ربه|ربك|سبحانه|تعالي|تعالى/;

/** أول كلمة في دعاء مقتبس: نداء لله */
const DUA_OPENER = /^(اللهم|ربنا|رب|ربي)$/;
const bare = (w: string) => normalizeArabic(w.replace(/[«»"“”'؟?!.,،:؛…]/g, ""));

/** مدى الدعاء المقتبس في كلمات الجملة: [أول كلمة، آخر كلمة] لكل عبارة «…» تبدأ بنداء لله */
export const duaRanges = (words: string[]): [number, number][] => {
  const out: [number, number][] = [];
  for (let i = 0; i < words.length; i++) {
    if (!words[i]!.includes("«")) continue;
    let j = i;
    while (j < words.length - 1 && !words[j]!.includes("»")) j++;
    if (DUA_OPENER.test(bare(words[i]!.slice(words[i]!.indexOf("«") + 1)))) out.push([i, j]);
    i = j;
  }
  return out;
};

export type Span = { from: number; to: number; why: string };

export const intendedStillness = (plan: Plan, startSec: number, media?: Pick<EpisodeMedia, "voice" | "recitations">, chapter?: number): Span[] => {
  const spans: Span[] = [];
  let t = startSec;
  for (const c of plan.chapters) {
    if (chapter && c.number !== chapter) continue;
    for (const [i, s] of c.scenes.entries()) {
      const d = sceneSeconds(s, media);
      const shot = String(s.props?.shot ?? "");
      if (s.template === "verse-card") spans.push({ from: t, to: t + d, why: "آية" });
      else if (s.template === "ink-shot" && shot.startsWith("verse-intro")) spans.push({ from: t, to: t + d, why: "تمهيد آية" });
      else if (s.template === "horizon-shot" && HZ_META[shot]?.still) spans.push({ from: t, to: t + d, why: HZ_META[shot]!.still === "dhikr" ? "ذكر الله" : "تمهيد آية" });
      else if (s.narration && c.scenes[i + 1]?.template === "verse-card" && /[:：]\s*$/.test(s.narration.trim())) spans.push({ from: t, to: t + d, why: "تمهيد آية" });
      else if (s.narration) {
        const clip = media?.voice[s.id];
        const words = clip && clip.text === s.narration.trim() ? clip.words.map((w) => ({ word: w.word, start: w.start * 30, end: w.end * 30 })) : estimateTimings(s.narration, 6, Math.round(d * 30) - 12);
        for (const w of words) if (SACRED_WORD.test(normalizeArabic(w.word))) spans.push({ from: t + w.start / 30 - 0.25, to: t + w.end / 30 + 0.25, why: "ذكر الله" });
        // علامات الاقتباس من نص المشهد (توقيت الصوت قد يحذفها) إن تطابق عدد الكلمات
        const tokens = splitWords(s.narration);
        for (const [a, b] of duaRanges(tokens.length === words.length ? tokens : words.map((w) => w.word))) spans.push({ from: t + words[a]!.start / 30 - 0.25, to: t + words[b]!.end / 30 + 0.25, why: "دعاء" });
        // استشهاد بصري صامت (دفاتر الزمن V9، المراجعة 031): نافذة موثقة واحدة لا غير — من نهاية آخر كلمة منطوقة
        // إلى نهاية زمن قراءة الآية المعروضة (verseWindow)، لا إلى نهاية المشهد؛ فذيل الخروج وما قبل آخر كلمة يُقاسان كالمعتاد.
        // محصورة في لقطات «خط الأفق» المسجلة (HZ_META) التي تحمل verseKey وverseText معًا؛ لا تمس قوالب القنوات الأخرى.
        if (s.template === "horizon-shot" && HZ_META[shot] && typeof s.props?.verseText === "string" && s.props.verseText.trim() && s.props?.verseKey && words.length) {
          const voiced = Boolean(clip && clip.text === s.narration.trim());
          // التوقيت كما يرسمه HorizonShot: كلمات الصوت إن طابقت النص، وإلا التقدير
          let tl = buildTimeline(hzSentences(s.narration), HZ_LEAD);
          if (voiced) {
            try {
              tl = timelineFromWords(hzSentences(s.narration), clip!.words.map((w) => ({ word: w.word, start: w.start, end: w.end })), 0);
            } catch {
              // عدد الكلمات مختلف: يبقى التقدير
            }
          }
          const vw = verseWindow(s.props as Record<string, string | undefined>, tl);
          const lastWord = voiced ? words[words.length - 1]!.end / 30 : tl.end;
          if (vw) {
            const from = t + lastWord;
            const to = t + Math.min(d, vw[1]);
            if (to - from > 0.5) spans.push({ from, to, why: "آية" });
          }
        }
      }
      t += d;
    }
  }
  return spans;
};

/** دمج الفترات المتداخلة أو المتلاصقة، فلا تُحسب مساحة التداخل مرتين (ذكران متقاربان، أو ذكر داخل مشهد آية) */
export const mergeSpans = (spans: Span[]): Span[] => {
  const sorted = [...spans].filter((x) => x.to > x.from).sort((a, b) => a.from - b.from);
  const out: Span[] = [];
  for (const x of sorted) {
    const last = out[out.length - 1];
    if (last && x.from <= last.to) {
      last.to = Math.max(last.to, x.to);
      if (!last.why.split("، ").includes(x.why)) last.why += `، ${x.why}`;
    } else out.push({ ...x });
  }
  return out;
};

/**
 * الثواني الصحيحة التي يغطي السكون المقصود أغلبها (بعد دمج الفترات المتداخلة).
 * وكل فترة مدتها نصف ثانية فأكثر تُعفي ثانية منتصفها على الأقل: ذكرٌ مدته 0.9 ث يقع على حد ثانيتين
 * (35.52–36.42 مثلًا) لا يغطي نصف أيٍّ منهما، فكان يسقط من الإعفاء كله بحسب موضعه من الحد لا بحسب الكلام (D34).
 */
export const exemptSeconds = (spans: Span[], seconds: number): Set<number> => {
  const out = new Set<number>();
  const merged = mergeSpans(spans);
  for (let s = 0; s < seconds; s++) {
    const cover = merged.reduce((a, x) => a + Math.max(0, Math.min(s + 1, x.to) - Math.max(s, x.from)), 0);
    if (cover >= 0.5) out.add(s);
  }
  for (const x of merged) {
    const mid = Math.floor((x.from + x.to) / 2);
    if (x.to - x.from >= 0.5 && mid >= 0 && mid < seconds) out.add(mid);
  }
  return out;
};

/** ثواني السكون المقصود في فيديو مرندر من الخطة (الحلقة كلها أو فصل واحد للشورت) */
export const exemptForRender = async (plan: Plan, media?: Pick<EpisodeMedia, "voice" | "recitations">, chapter?: number): Promise<Set<number>> => {
  const { introFramesFor } = await import("../remotion/scenes/ChannelIntro");
  const { channelInfo, loadChannel } = await import("../channel/index");
  const start = introFramesFor(channelInfo(loadChannel()), plan, chapter) / 30;
  const spans = intendedStillness(plan, start, media, chapter);
  const end = spans.reduce((a, x) => Math.max(a, x.to), 0);
  return exemptSeconds(spans, Math.ceil(end) + 1);
};
