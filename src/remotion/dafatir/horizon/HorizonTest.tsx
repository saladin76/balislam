/**
 * دفاتر الزمن 001 — «اختبار إخراجي أولي — مشاهد غير قرآنية» (اتجاه «خط الأفق»).
 * معاينة صامتة بأزمنة تقديرية، لا تُنشر. لوحة افتتاحية تذكر ما لم يُنفذ، ثم اللقطات 1 و2 و4 (جزئية) و5 (قبل الآية) و6.
 */
import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig, type CalculateMetadataFunction } from "remotion";
import config from "../../../../config.json";
import { useBrandFonts } from "../../useBrandFonts";
import { C, Caption, Dusk, Tag, prog } from "./kit";
import { SHOTS, buildShots, type HorizonAudio, type ShotDef } from "./shots";
import type { Timeline } from "./timeline";

export const HZ_FPS = 30;
const SLATE = 4.5;
const GAP = 0.6;

const sentenceCaption = (tl: Timeline, t: number) => {
  const started = tl.sentences.filter((s) => s.s - 0.2 <= t);
  const cur = started[started.length - 1];
  if (!cur) return null;
  const o = prog(t, cur.s - 0.2, cur.s + 0.05) * (1 - prog(t, cur.e + 0.25, cur.e + 0.55));
  return o > 0 ? { text: cur.text, o } : null;
};

const ShotFrame: React.FC<{ shot: ShotDef; base?: string }> = ({ shot, base }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const fade = prog(t, 0, 0.35) * (1 - prog(t, shot.dur - 0.35, shot.dur));
  const cap = sentenceCaption(shot.tl, t);
  const Comp = shot.Comp;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Dusk warm={shot.id === "5" ? 1 : 0} />
      <AbsoluteFill style={{ opacity: fade }}>
        <Comp t={t} tl={shot.tl} q={shot.q} />
        {cap ? <Caption text={cap.text} opacity={cap.o} /> : null}
        <Tag corner="tr" text={shot.label} />
        {shot.note ? <Tag corner={shot.noteCorner ?? "tl2"} text={shot.note} tone="dark" /> : null}
        {shot.id === "5" && !shot.q ? <Tag corner="bl" tone="dark" opacity={prog(t, shot.tl.end + 0.5, shot.tl.end + 0.9)} text="تليها الأعراف 23 بتلاوة الحصري — غير منفذة في هذه المعاينة" /> : null}
      </AbsoluteFill>
      <Tag corner="tl" text={base ? "معاينة متكاملة — صوت الراوي وتلاوة الحصري · لا تُنشر" : "اختبار إخراجي أولي — مشاهد غير قرآنية · بلا صوت · أزمنة تقديرية"} />
      {base && shot.voice ? (
        <Sequence from={Math.round(shot.voice.at * fps)}>
          <Audio src={staticFile(`${base}voice/${shot.voice.file}`)} volume={config.audio.narrationVolume} />
        </Sequence>
      ) : null}
      {base && shot.recitation
        ? shot.recitation.parts.map((part, i) => {
            const at = shot.recitation!.at + shot.recitation!.parts.slice(0, i).reduce((n, x) => n + x.duration, 0);
            return (
              <Sequence key={part.file} from={Math.round(at * fps)} durationInFrames={Math.max(1, Math.ceil(part.duration * fps))}>
                <Audio src={staticFile(`${base}recitations/${part.file}`)} volume={config.audio.recitationVolume} />
              </Sequence>
            );
          })
        : null}
    </AbsoluteFill>
  );
};

const Slate: React.FC<{ audio?: boolean }> = ({ audio }) => {
  const frame = useCurrentFrame();
  const t = frame / HZ_FPS;
  const o = prog(t, 0, 0.5) * (1 - prog(t, SLATE - 0.5, SLATE));
  const line = (txt: string, size: number, color: string, font = "'Tajawal', sans-serif", weight = 500) => <div style={{ fontFamily: font, fontWeight: weight, fontSize: size, color, direction: "rtl", textAlign: "center", lineHeight: 1.5 }}>{txt}</div>;
  return (
    <AbsoluteFill>
      <Dusk />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 14, opacity: o }}>
        {line("دفاتر الزمن · الحلقة 001", 70, C.parchment, "'Amiri', serif", 700)}
        {audio ? (
          <>
            {line("اللقطات الست بالصوت والتلاوة — معاينة متكاملة", 44, C.sand)}
            <div style={{ height: 18 }} />
            {line("اتجاه «خط الأفق» · صوت الراوي المعتمد · تلاوة الشيخ محمود خليل الحصري", 30, "rgba(241,228,203,0.85)")}
            {line("نص الآيات: Quran.Foundation · لا موسيقى ولا مؤثرات · لا تُنشر", 26, "rgba(241,228,203,0.6)")}
          </>
        ) : (
          <>
            {line("اختبار إخراجي أولي — مشاهد غير قرآنية", 44, C.sand)}
            <div style={{ height: 18 }} />
            {line("اتجاه «خط الأفق» · بلا صوت · الأزمنة تقديرية وتُضبط على صوت الراوي", 30, "rgba(241,228,203,0.85)")}
            {line("لم يُنفذ هنا: اللقطة 3 (البقرة 30)، وآية اللقطة 5 (الأعراف 23)، وإطار لفظ الآية في اللقطة 4", 30, "rgba(241,228,203,0.85)")}
            {line("السبب: نص الآيات وتلاوتها يُجلبان من Quran Foundation على جهاز صاحب القناة", 26, "rgba(241,228,203,0.6)")}
          </>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const hzSchedule = (shots: ShotDef[] = SHOTS) => {
  let at = SLATE;
  return shots.map((s) => {
    const from = Math.round(at * HZ_FPS);
    const frames = Math.round(s.dur * HZ_FPS);
    at += s.dur + GAP;
    return { shot: s, from, frames };
  });
};

export const hzTotal = (shots: ShotDef[] = SHOTS) => {
  const sch = hzSchedule(shots);
  const last = sch[sch.length - 1]!;
  return last.from + last.frames + Math.round(0.3 * HZ_FPS);
};
export const HZ_TOTAL = hzTotal();

const Reel: React.FC<{ audio?: HorizonAudio }> = ({ audio }) => {
  useBrandFonts();
  const shots = buildShots(audio);
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <Sequence durationInFrames={Math.round(SLATE * HZ_FPS)}>
        <Slate audio={Boolean(audio)} />
      </Sequence>
      {hzSchedule(shots).map(({ shot, from, frames }) => (
        <Sequence key={shot.id} from={from} durationInFrames={frames}>
          <ShotFrame shot={shot} base={audio?.base} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

/** المعاينة الصامتة (horizon-test-v2): أزمنة تقديرية بلا آيات */
export const HorizonTest: React.FC = () => <Reel />;

/** المعاينة المتكاملة: صوت الراوي والآيات وتلاواتها من inputProps (تُجهَّز على جهاز الإنتاج) */
export const HorizonAudioReel: React.FC<{ audio?: HorizonAudio }> = ({ audio }) => <Reel audio={audio} />;
export const horizonAudioMetadata: CalculateMetadataFunction<{ audio?: HorizonAudio }> = ({ props }) => ({ durationInFrames: hzTotal(buildShots(props.audio)) });
