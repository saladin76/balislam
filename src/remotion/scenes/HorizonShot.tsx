import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { SceneShell } from "./SceneShell";
import { C, Dusk, VerseCard, prog } from "../dafatir/horizon/kit";
import { Book, ChapterHead, NEUTRAL, parseCam } from "../dafatir/horizon/book";
import { HZ_SCENES } from "../dafatir/horizon/episode001";
import { HZ_LEAD, HZ_META, hzSentences } from "../dafatir/horizon/meta";
import { buildTimeline, timelineFromWords, type Timeline } from "../dafatir/horizon/timeline";
import { VERSE_PLACEHOLDER } from "../../plan/quranText";
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

export const HorizonShot: React.FC<HorizonShotProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const dur = durationInFrames / fps;
  const shot = props.shot && HZ_SCENES[props.shot] ? props.shot : "pending";
  const meta = HZ_META[shot]!;
  const tl = timelineFor(props.narration ?? "", props.narrationTimings, fps);
  const Comp = HZ_SCENES[shot]!;
  const exit = (props.exit as typeof meta.exit) || meta.exit;
  return (
    <SceneShell {...props} eyebrow={undefined} motif={false} watermark={false} background={C.night} durationInFrames={durationInFrames} exitFrames={0} frameless>
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <Dusk />
        <Comp t={t} tl={tl} dur={dur} exit={exit} from={parseCam(props.from)} p={props as unknown as Record<string, string | undefined>} />
      </AbsoluteFill>
    </SceneShell>
  );
};

/**
 * موضع آية في «خط الأفق»: بلا نص معتمد يظهر وسم إنتاج واضح (المرجع، ومصدر النص والتلاوة) فوق صفحة ساكنة،
 * ولا إطار آية ولا نص مؤقت. عند إرفاق نص الآية من السكريبت والتلاوة البشرية المرفوعة يتحول المشهد إلى بطاقة آية متزامنة بالصوت.
 */
export type HorizonVerseProps = SceneBase & { text?: string; ayahKey?: string; reciter?: string; recitationDuration?: number; head?: string };
export const HorizonVerse: React.FC<HorizonVerseProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const has = Boolean(props.text && props.text !== VERSE_PLACEHOLDER && props.reciter);
  const key = props.ayahKey ?? "";
  return (
    <SceneShell {...props} narration={undefined} eyebrow={undefined} motif={false} watermark={false} background={C.night} durationInFrames={durationInFrames} exitFrames={0} frameless>
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <Dusk />
        <Book id="vs" t={t} dur={durationInFrames / fps} cam={NEUTRAL} R={props.head ? <ChapterHead label={props.head} /> : undefined} />
        {has ? (
          <VerseCard show={props.recitationDuration ? 1 : prog(t, 0.1, 0.6)} text={props.text!} refKey={key} reciter={props.reciter!} />
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
  head: "الفصل الثاني",
  narration: "فأجابهم الله بأنه يعلم ما لا يعلمون. إن معرفتنا محدودة، وعلم الله محيط بكل شيء. وقد نعرف بعض الحكم من أمر من أمور الله، ولكننا لا ندعي الإحاطة بجميع حكمه.",
};
export const horizonShotSampleEn = horizonShotSample;
export const horizonShotSeconds = 15;
