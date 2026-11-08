/**
 * سياسة الصمت عند الحدود — «دفاتر الزمن» (الأمر 025، قرار D8).
 *
 * لكل حد مالك واحد، والصمت عنده قيمة واحدة لا مجموع قيم:
 * - التسجيل مقصوص من طرفيه (trim.ts)، فلا يُضاف صمته إلى ما بعده.
 * - ذيل المشهد البصري يمرّ تحت صمت الحد ولا يُضاف إليه: قبل التلاوة يُقصّر إلى أقل خروج بصري،
 *   ويُكمل صمتُ ما قبل التلاوة داخل البطاقة الباقي حتى يبلغ الحد قيمته.
 * - بطاقة الفصل وقفة بصرية مستقلة (3.2 ث تبقى كما هي)، خارج سياسة الصمت: لا يُضاف قبلها ولا بعدها صمت.
 *
 * معزول: يحسب جدولًا زمنيًا من مدد تسجيلات (حقيقية أو صناعية) ولا يغيّر توقيت الحلقة الإنتاجي ولا مسار الرندر.
 */
import type { HzExit } from "../horizon/meta";

export const SILENCE_POLICY = {
  /** قبل التلاوة: من آخر كلام الراوي إلى أول التلاوة */
  beforeVerse: 0.7,
  /** بعد التلاوة: من آخرها إلى أول كلام الراوي */
  afterVerse: 0.6,
  /** بين بطاقتي آيتين متجاورتين */
  betweenVerses: 0.25,
  /** أقل زمن يحتاجه خروج المشهد البصري (لا يُضغط تحته) */
  exitMin: { none: 0, fade: 0.5, turn: 1.0 } as Record<HzExit, number>,
} as const;

export type TimelineItem =
  | { kind: "narration"; id: string; speechStart: number; speechEnd: number; audioEnd: number; designTail: number; exit: HzExit }
  | { kind: "verse"; id: string; recitation: number }
  | { kind: "card"; id: string; seconds: number; role: "chapter" | "cover" };

export type GapOwner = "scene-tail" | "verse-lead" | "verse-trail" | "verses-gap" | "chapter-card" | "opening";
export type Gap = {
  from: string;
  to: string;
  owner: GapOwner;
  /** القيمة المقررة للمالك */
  target: number;
  /** الصمت المسموع فعلًا بين الصوتين */
  value: number;
  /** ما يفرضه البصري ولا يُضغط تحته (أقل خروج، وبطاقات الفصول) */
  visualFloor: number;
  /** وقفة بصرية مستقلة عن السياسة (بطاقة الفصل) */
  visualBeat: number;
};
export type TimedScene = { id: string; kind: TimelineItem["kind"]; start: number; end: number; tail?: number; lead?: number };
export type AudioEvent = { id: string; kind: "speech" | "recitation"; start: number; end: number };

/**
 * يبني الجدول الزمني: المشاهد متتالية، ومواضع الصوت، وصمت كل حد.
 * القاعدة: value = max(target, visualFloor) — لا target + ذيل، ولا ذيل + صمت التسجيل.
 */
export const buildAudioTimeline = (items: TimelineItem[], policy = SILENCE_POLICY) => {
  const scenes: TimedScene[] = [];
  const audio: AudioEvent[] = [];
  const gaps: Omit<Gap, "value">[] = [];
  let t = 0;
  // بداية التلاوة داخل البطاقة التالية (تُحدد عند الحد قبلها)
  let pendingLead: number | null = null;
  const nextAudible = (i: number) => {
    let cards = 0;
    let j = i + 1;
    while (j < items.length && items[j]!.kind === "card") cards += (items[j++] as { seconds: number }).seconds;
    return { item: items[j], cards };
  };
  const leadOf = (x: TimelineItem) => (x.kind === "narration" ? x.speechStart : 0);
  for (let i = 0; i < items.length; i++) {
    const it = items[i]!;
    if (it.kind === "card") {
      scenes.push({ id: it.id, kind: "card", start: t, end: t + it.seconds });
      t += it.seconds;
      continue;
    }
    const { item: nx, cards } = nextAudible(i);
    if (it.kind === "narration") {
      const start = t;
      audio.push({ id: it.id, kind: "speech", start: start + it.speechStart, end: start + it.speechEnd });
      // أقل ذيل: خروج المشهد البصري، أو باقي التسجيل بعد آخر صوت (هامش التلاشي) — أيهما أطول، لا مجموعهما
      const minTail = Math.max(policy.exitMin[it.exit], it.audioEnd - it.speechEnd);
      let tail: number;
      if (!nx) tail = Math.max(minTail, it.designTail);
      else if (cards > 0) {
        tail = minTail;
        if (nx.kind === "verse") pendingLead = 0;
        const floor = minTail + cards + leadOf(nx);
        gaps.push({ from: it.id, to: nx.id, owner: "chapter-card", target: 0, visualFloor: floor, visualBeat: cards });
      } else if (nx.kind === "verse") {
        tail = minTail;
        pendingLead = Math.max(0, policy.beforeVerse - minTail);
        gaps.push({ from: it.id, to: nx.id, owner: "verse-lead", target: policy.beforeVerse, visualFloor: minTail, visualBeat: 0 });
      } else {
        // مشهد إلى مشهد: ذيل التصميم وحده هو الحد؛ الكلام التالي يبدأ بعد هامش قصه، فيُحسب منه لا عليه
        const lead = leadOf(nx);
        tail = Math.max(minTail, it.designTail - lead);
        gaps.push({ from: it.id, to: nx.id, owner: "scene-tail", target: it.designTail, visualFloor: minTail + lead, visualBeat: 0 });
      }
      const end = start + it.speechEnd + tail;
      scenes.push({ id: it.id, kind: "narration", start, end, tail });
      t = end;
      continue;
    }
    const start = t;
    const lead = pendingLead ?? policy.beforeVerse;
    pendingLead = null;
    audio.push({ id: it.id, kind: "recitation", start: start + lead, end: start + lead + it.recitation });
    let trail: number;
    if (nx?.kind === "verse" && cards === 0) {
      trail = policy.betweenVerses;
      pendingLead = 0;
      gaps.push({ from: it.id, to: nx.id, owner: "verses-gap", target: policy.betweenVerses, visualFloor: 0, visualBeat: 0 });
    } else if (nx && cards === 0) {
      const l = leadOf(nx);
      trail = Math.max(0, policy.afterVerse - l);
      gaps.push({ from: it.id, to: nx.id, owner: "verse-trail", target: policy.afterVerse, visualFloor: l, visualBeat: 0 });
    } else {
      trail = nx ? 0 : policy.afterVerse;
      if (nx) {
        if (nx.kind === "verse") pendingLead = 0;
        gaps.push({ from: it.id, to: nx.id, owner: "chapter-card", target: 0, visualFloor: cards + leadOf(nx), visualBeat: cards });
      }
    }
    const end = start + lead + it.recitation + trail;
    scenes.push({ id: it.id, kind: "verse", start, end, lead, tail: trail });
    t = end;
  }
  // الصمت يُقاس من مواضع الصوت الفعلية، لا من المعادلات أعلاه
  const ev = new Map(audio.map((a) => [a.id, a]));
  const measured: Gap[] = gaps.map((g) => ({ ...g, value: ev.get(g.to)!.start - ev.get(g.from)!.end }));
  return { scenes, audio, gaps: measured, duration: t };
};

/** مخالفات السياسة: صمت مزدوج، أو صمت دون المقرر، أو تداخل الأصوات */
export const silenceProblems = (tl: ReturnType<typeof buildAudioTimeline>) => {
  const out: string[] = [];
  const eps = 1e-6;
  for (const g of tl.gaps) {
    const expected = Math.max(g.target, g.visualFloor);
    if (Math.abs(g.value - expected) > eps) out.push(`${g.from}→${g.to}: ${g.value.toFixed(3)} ث والمتوقع ${expected.toFixed(3)} (${g.owner})`);
  }
  const a = [...tl.audio].sort((x, y) => x.start - y.start);
  for (let i = 1; i < a.length; i++) if (a[i]!.start < a[i - 1]!.end - eps) out.push(`تداخل ${a[i - 1]!.id} و${a[i]!.id}`);
  for (let i = 1; i < tl.scenes.length; i++) if (Math.abs(tl.scenes[i]!.start - tl.scenes[i - 1]!.end) > eps) out.push(`فجوة بصرية قبل ${tl.scenes[i]!.id}`);
  return out;
};
