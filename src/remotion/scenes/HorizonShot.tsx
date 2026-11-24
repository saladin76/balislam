import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { SceneShell } from "./SceneShell";
import { C, Dusk, LiveFrameContext, PageHeadContext, SAFE_LIFT, VerseCard, VersePageContext, VerseWindowContext, prog } from "../dafatir/horizon/kit";
import { Book, ChapterHead, NEUTRAL, SceneCloseContext, VERSE_SETTLE, parseCam } from "../dafatir/horizon/book";
import { HZ_SCENES } from "../dafatir/horizon/episode001";
import { HZ_LEAD, HZ_META, hzSentences, verseWindow } from "../dafatir/horizon/meta";
import { activeTime, breathAt, breathBeats, breathStill } from "../dafatir/horizon/breath";
import { buildTimeline, timelineFromWords, type Timeline } from "../dafatir/horizon/timeline";
import { VERSE_PLACEHOLDER } from "../../plan/quranText";
import { pageLetterBudget, pageOpacity, pageWindows, versePages } from "../../quran/versePages";
import { horizonShotWordIssue } from "../../plan/shotWords";
import { verseRef } from "../dafatir/horizon/kit";
import type { SceneBase, StringFields } from "./types";

/** حقول مشاهد المكتبة العامة (lib-*) */
type LibField = "term" | "termWord" | "sub" | "subWord" | "kind" | "source" | "sourceWord" | "matn" | "matnWord" | "matnLabel" | "matnSource" | "tafsir" | "tafsirWord" | "tafsirLabel" | "tafsirSource" | "note" | "noteWord" | "aLabel" | "aText" | "aWord" | "bLabel" | "bText" | "bWord" | "verdict" | "verdictText" | "verdictWord" | "items" | "limit" | "limitWord" | "color" | "titleWord";

/**
 * «مشهد خط الأفق» (دفاتر الزمن): مشهد مصمم لجملته على الدفتر المفتوح، يُختار بحقل shot.
 * التوقيت من صوت الراوي إن وُجد (كلمة بكلمة)، وإلا تقديري بالقواعد نفسها، فلا يتغير التصميم عند دخول الصوت.
 */
export type HorizonShotProps = SceneBase & StringFields<"shot" | "exit" | "from" | "head" | "label" | "title" | "idea" | "batch" | "ref" | "tagWord" | LibField>;

const timelineFor = (narration: string, timings: SceneBase["narrationTimings"], fps: number): Timeline => {
  const sentences = hzSentences(narration);
  if (timings?.length) {
    try {
      return timelineFromWords(sentences, timings.map((w) => ({ word: w.word, start: w.start / fps, end: w.end / fps })), 0);
    } catch {
      // عدد الكلمات مختلف: يبقى التقدير حتى تُطابق المحاذاة النص
    }
  }
  return buildTimeline(sentences, HZ_LEAD);
};

/**
 * المشهد بالكلمات وحدها (M4): حين لا يطابق التصميمُ النصَّ الحالي (كلمة صُمم عليها لم تعد فيه)، لا يُرسم من التصميم
 * شيء (القاعدة الثالثة: الفراغ أفضل من عنصر خاطئ)، بل الدفتر مفتوحًا وجملة الراوي على الصفحة تظهر عند بدء نطقها
 * (جملة كاملة لا كلمة كلمة: لا حدث لحظة ذكر الله).
 * التنبيه للمالك في فحص الخطة (src/plan/shotWords.ts)، لا على الشاشة.
 */
export const HorizonWordsOnly: React.FC<{ t: number; tl: Timeline; dur: number; exit: string; head?: string }> = ({ t, tl, dur, exit, head }) => {
  const k = tl.sentences.findIndex((s, i) => t < s.e || i === tl.sentences.length - 1);
  const sent = k >= 0 ? tl.sentences[k]! : undefined;
  const shown = sent ? sent.text.split(/\s+/).filter(Boolean) : [];
  const fadeOut = 1 - prog(t, dur - 0.75, dur - 0.15);
  return (
    <>
      <Book id="wo" t={t} dur={dur} exit={exit === "turn" || exit === "fade" ? exit : "none"} cam={NEUTRAL} R={head ? <ChapterHead label={head} /> : undefined} />
      {sent ? (
        <div style={{ position: "absolute", left: 1040, width: 600, top: 300, color: C.inkText, direction: "rtl", textAlign: "center", fontFamily: "'Amiri', serif", fontSize: 54, lineHeight: 1.7, opacity: fadeOut }}>
          <span style={{ opacity: prog(t, sent.s - 0.2, sent.s + 0.2) }}>{shown.join(" ")}</span>
        </div>
      ) : null}
    </>
  );
};

/** حارس المشهد المصمَّم: أي خطأ في رسمه (كلمة لم تعد في النص) يعرض المشهد بالكلمات وحدها بدل أن ينهار. */
export class ShotGuard extends React.Component<{ fallback: React.ReactNode; resetKey: string; children: React.ReactNode }, { failed: string | null }> {
  state = { failed: null as string | null };
  static getDerivedStateFromError(): { failed: string } { return { failed: "x" }; }
  componentDidUpdate(prev: { resetKey: string }) { if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: null }); }
  componentDidCatch() { /* التنبيه في فحص الخطة؛ لا ضجيج في كل إطار */ }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** D214: ساعة الرسم المرئية — أزمنة الكلمات والجمل ونهاية المشهد والخروج منقولة إلى الزمن الفعّال (يقف داخل نوافذ السكون) */
/** D217: وضع الكاميرا الحية يعود إلى الإطار الأول (s=1، بلا إزاحة) في الثانية التي قبل بطاقة الآية ويبقى فيه */
export const settlePose = <P extends { s: number; x: number; y: number; bg: number }>(pose: P, t: number, w: readonly [number, number]): P => {
  const k = prog(t, w[0] - VERSE_SETTLE, w[0] - 0.05) * (1 - prog(t, w[1], w[1] + VERSE_SETTLE));
  return { ...pose, s: pose.s + (1 - pose.s) * k, x: pose.x * (1 - k), y: pose.y * (1 - k), bg: pose.bg * (1 - k) };
};

export const visualClock = (tl: Timeline, dur: number, close: number | undefined, wins: [number, number][]) => {
  const v = (x: number) => activeTime(x, wins);
  return {
    tl: { words: tl.words.map((w) => ({ ...w, s: v(w.s), e: v(w.e) })), sentences: tl.sentences.map((x) => ({ ...x, s: v(x.s), e: v(x.e) })), end: v(tl.end) } as Timeline,
    dur: v(dur),
    close: close === undefined ? undefined : v(close),
  };
};

export const HorizonShot: React.FC<HorizonShotProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const dur = durationInFrames / fps;
  const shot = props.shot && HZ_SCENES[props.shot] ? props.shot : "pending";
  const meta = HZ_META[shot]!;
  const tl = timelineFor(props.narration ?? "", props.narrationTimings, fps);
  // M4: كلمة صُمم عليها المشهد ولم تعد في نصه؟ يُعرف من النص قبل الرسم، فلا يُستدعى الرسم أصلًا (بلا خطأ في كل إطار)
  const stale = React.useMemo(() => Boolean(horizonShotWordIssue({ id: "", narration: props.narration ?? "", props: { ...(props as unknown as Record<string, string>), shot } })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shot, props.narration, props.exit, props.ref]);
  const Comp = HZ_SCENES[shot]!;
  const exit = (props.exit as typeof meta.exit) || meta.exit;
  // نهاية آخر كلمة منطوقة: منها يبدأ خروج المشهد (قلب الصفحة أو خفوت الحبر)
  // (المشاهد ذات الإمساك المحسوب للقراءة، minEnd، تحتفظ بخروجها المتأخر)
  // الاستشهاد البصري: البطاقة على الصفحة من كلمتها، والخروج لا يبدأ قبل انتهاء زمن قراءتها
  const vw = verseWindow(props as unknown as Record<string, string | undefined>, tl);
  const lastWord = tl.words.length ? tl.words[tl.words.length - 1]!.e : 0;
  // D198: الخطاف المسبق يقطع المشهد عند closeAt فيبدأ خروجه (قلب الصفحة) هناك، لا عند آخر كلمة في نصه
  const closeAt = Number((props as unknown as Record<string, string | undefined>).closeAt);
  const close = Number.isFinite(closeAt) && closeAt > 0 ? closeAt
    : tl.words.length && !meta.minEnd ? Math.max(lastWord, vw ? vw[1] : 0) : undefined;
  const pr = props as unknown as Record<string, string | undefined>;
  // D214/D217: الآية ساكنة كاملة — بطاقتها تظهر كاملة لحظة نافذتها وتختفي دفعة واحدة قبل الخروج (لا تلاشٍ ولا جزء منها)
  const verseShow = vw && t >= vw[0] - 0.05 && t < vw[1] ? 1 : 0;
  // الكاميرا الحية (breath.ts): إعادة تأطير عند كل عبارة، ورجوع إلى الإطار الأول قبل القطع، وخلفية أبطأ بعكسه، والسكون المقصود ثابت
  const breath = React.useMemo(() => {
    const wins = breathStill(tl, dur, meta.still === "dhikr", vw);
    return { wins, beats: breathBeats(tl, dur, wins), total: activeTime(dur, wins) };
  },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.narration, props.narrationTimings, dur, meta.still, vw?.[0], vw?.[1]]);
  // الانجراف الدائم بالزمن الفعّال (يسكن في السكون المقصود)، ولا انجراف في مشهد ساكن كله
  const live = breathAt(t, breath.beats, breath.total > 0.5 ? activeTime(t, breath.wins) / breath.total : undefined);
  // D217: والكاميرا الحية أيضًا تعود إلى الإطار الأول قبل بطاقة الآية وتثبت عليه طوال ظهورها (لا آية مقطوعة أبدًا)
  // تصحيح D217 (v17): بالزمن الفعّال كرسم المشهد (verseSettle)، فلا تتحرك العودة داخل نافذة ذكر قبل البطاقة
  // («أخبرنا الله» قبل البقرة ٣٨، «وأباح الله» قبل البقرة ٣٥، «ربه» قبل الأعراف ٢٣ — كانت العودة تبدأ داخل نافذة اللفظ)
  const cam = vw ? settlePose(live, activeTime(t, breath.wins), [activeTime(vw[0], breath.wins), activeTime(vw[1], breath.wins)]) : live;
  // D217: المشهد يرتفع في الإطار الأفقي فيبقى شريط الترجمة لها وحدها، والدفتر يعرف وضع الكاميرا الحية الفعلي فيقيّد تأطيره
  const lift = props.orientation === "portrait" ? 0 : SAFE_LIFT;
  const pageHead = React.useMemo(() => (pr.pageHead?.trim() && !/الله|لله/.test(pr.pageHead) ? { text: pr.pageHead.trim(), side: pr.pageHeadSide === "r" ? "r" as const : "l" as const, y: Number(pr.pageHeadY) || 190 } : null), [pr.pageHead, pr.pageHeadSide, pr.pageHeadY]);
  const liveFrame = props.orientation === "portrait" ? null : { s: cam.s, y: cam.y - lift };
  // D214: رسم المشهد نفسه (الحبر والخيط والعناصر) يسكن أيضًا في نوافذ الذكر: يأخذ «الزمن المرئي» (activeTime) بدل الزمن،
  // وتُنقل أزمنة الكلمات والخروج إليه، فيبقى كل حدث عند كلمته خارج السكون، ولا يتقدم شيء داخله، ولا قفزة بعده.
  const vis = React.useMemo(() => visualClock(tl, dur, close, breath.wins), [tl, dur, close, breath.wins]);
  return (
    <SceneShell {...props} eyebrow={undefined} motif={false} watermark={false} background={C.night} durationInFrames={durationInFrames} exitFrames={0} frameless captionVariant="adaptive">
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <AbsoluteFill style={{ transform: `translateX(${cam.bg}px) scale(1.04)` }}><Dusk /></AbsoluteFill>
        <SceneCloseContext.Provider value={vis.close}>
          <VerseWindowContext.Provider value={vw ? [activeTime(vw[0], breath.wins), activeTime(vw[1], breath.wins)] : null}>
          <VersePageContext.Provider value={vw && verseShow > 0 ? <VerseCard show={verseShow} text={String(pr.verseText)} refKey={String(pr.verseKey)} partial={pr.versePartial === "1"} place="page" side={pr.verseSide === "l" ? "l" : "r"} y={pr.verseY ? Number(pr.verseY) : undefined} /> : null}>
            <LiveFrameContext.Provider value={liveFrame}>
            <PageHeadContext.Provider value={pageHead}>
            <AbsoluteFill style={{ transform: `translate(${cam.x}px, ${cam.y - lift}px) scale(${cam.s})`, transformOrigin: "50% 50%" }}>
            {stale ? <HorizonWordsOnly t={activeTime(t, breath.wins)} tl={vis.tl} dur={vis.dur} exit={exit} head={props.head} /> : (
              <ShotGuard resetKey={`${shot}|${props.narration ?? ""}`} fallback={<HorizonWordsOnly t={activeTime(t, breath.wins)} tl={vis.tl} dur={vis.dur} exit={exit} head={props.head} />}>
                <Comp t={activeTime(t, breath.wins)} tl={vis.tl} dur={vis.dur} exit={exit} from={parseCam(props.from)} p={props as unknown as Record<string, string | undefined>} />
              </ShotGuard>
            )}
            </AbsoluteFill>
            </PageHeadContext.Provider>
            </LiveFrameContext.Provider>
          </VersePageContext.Provider>
          </VerseWindowContext.Provider>
        </SceneCloseContext.Provider>
      </AbsoluteFill>
    </SceneShell>
  );
};

/**
 * موضع آية في «خط الأفق»: بلا نص في السكريبت يظهر وسم إنتاج واضح (المرجع، ومصدر النص والتلاوة) فوق صفحة ساكنة،
 * ولا إطار آية ولا نص مؤقت. ونص الآية من السكريبت يظهر دائمًا، قبل التلاوة أيضًا («نسخة قبل النهائية» بلا تلاوات،
 * طلب المالك ١٥ نوفمبر)، ويتزامن مع التلاوة البشرية عند إرفاقها. الآية الطويلة صفحات على مدى التلاوة (versePages).
 */
export type HorizonVerseProps = SceneBase & { text?: string; ayahKey?: string; reciter?: string; recitationDuration?: number; head?: string; partial?: string };
export const HorizonVerse: React.FC<HorizonVerseProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const has = Boolean(props.text?.trim() && props.text !== VERSE_PLACEHOLDER);
  const key = props.ayahKey ?? "";
  const show = props.recitationDuration ? 1 : prog(t, 0.1, 0.6);
  const windows = has ? pageWindows(versePages(props.text!, pageLetterBudget(props.orientation === "portrait" ? 80 : 90)), props.recitationDuration ? 0 : 0.6 * fps,
    (props.recitationDuration ?? (durationInFrames / fps) * 0.85) * fps - (props.recitationDuration ? 0 : 0.6 * fps)) : [];
  return (
    <SceneShell {...props} narration={undefined} eyebrow={undefined} motif={false} watermark={false} background={C.night} durationInFrames={durationInFrames} exitFrames={0} frameless>
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <Dusk />
        <Book id="vs" t={t} dur={durationInFrames / fps} cam={NEUTRAL} R={props.head ? <ChapterHead label={props.head} /> : undefined} />
        {has ? (
          windows.map((w, i) => {
            const o = windows.length > 1 ? pageOpacity(w, frame) : 1;
            return o > 0 ? <VerseCard key={i} show={show * o} text={w.text} refKey={key} reciter={props.reciter} partial={props.partial === "1"} /> : null;
          })
        ) : (
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", background: "rgba(13,10,20,0.35)" }}>
            <div style={{ padding: "26px 48px 30px", border: "3px dashed rgba(241,228,203,0.75)", borderRadius: 14, background: "rgba(13,10,20,0.82)", color: C.parchment, direction: "rtl", textAlign: "center", fontFamily: "'Tajawal', sans-serif" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: C.sand }}>موضع آية</div>
              <div style={{ marginTop: 6, fontSize: 52, fontWeight: 700 }}>{key ? verseRef(key) : "—"}</div>
              <div style={{ marginTop: 10, fontSize: 26, fontWeight: 500, opacity: 0.8 }}>يُدرج نصها من السكريبت والتلاوة من تسجيل المالك المعتمد، وتُضبط المدة على التلاوة</div>
            </div>
          </AbsoluteFill>
        )}
      </AbsoluteFill>
    </SceneShell>
  );
};

export const horizonShotSample: Omit<HorizonShotProps, "themeId" | "orientation"> = {
  shot: "known",
  head: "قصة البداية",
  narration: "فأجابهم الله بأنه يعلم ما لا يعلمون. إن معرفتنا محدودة، وعلم الله محيط بكل شيء. وقد نعرف بعض الحكم من أمر من أمور الله، ولكننا لا ندعي الإحاطة بجميع حكمه.",
};
export const horizonShotSampleEn = horizonShotSample;
export const horizonShotSeconds = 15;
