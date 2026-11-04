/**
 * دفاتر الزمن 001 — «اختبار إخراجي أولي — مشاهد غير قرآنية» (اتجاه «خط الأفق»).
 * معاينة صامتة بأزمنة تقديرية، لا تُنشر. لوحة افتتاحية تذكر ما لم يُنفذ، ثم اللقطات 1 و2 و4 (جزئية) و5 (قبل الآية) و6.
 */
import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { useBrandFonts } from "../../useBrandFonts";
import { C, Caption, Dusk, Tag, prog } from "./kit";
import { SHOTS, type ShotDef } from "./shots";
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

const ShotFrame: React.FC<{ shot: ShotDef }> = ({ shot }) => {
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
        <Comp t={t} tl={shot.tl} />
        {cap ? <Caption text={cap.text} opacity={cap.o} /> : null}
        <Tag corner="tr" text={shot.label} />
        {shot.note ? <Tag corner={shot.noteCorner ?? "tl2"} text={shot.note} tone="dark" /> : null}
        {shot.id === "5" ? <Tag corner="bl" tone="dark" opacity={prog(t, shot.tl.end + 0.3, shot.tl.end + 0.8)} text="تليها الأعراف 23 بتلاوة الحصري — غير منفذة في هذه المعاينة" /> : null}
      </AbsoluteFill>
      <Tag corner="tl" text="اختبار إخراجي أولي — مشاهد غير قرآنية · بلا صوت · أزمنة تقديرية" />
    </AbsoluteFill>
  );
};

const Slate: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / HZ_FPS;
  const o = prog(t, 0, 0.5) * (1 - prog(t, SLATE - 0.5, SLATE));
  const line = (txt: string, size: number, color: string, font = "'Tajawal', sans-serif", weight = 500) => <div style={{ fontFamily: font, fontWeight: weight, fontSize: size, color, direction: "rtl", textAlign: "center", lineHeight: 1.5 }}>{txt}</div>;
  return (
    <AbsoluteFill>
      <Dusk />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 14, opacity: o }}>
        {line("دفاتر الزمن · الحلقة 001", 70, C.parchment, "'Amiri', serif", 700)}
        {line("اختبار إخراجي أولي — مشاهد غير قرآنية", 44, C.sand)}
        <div style={{ height: 18 }} />
        {line("اتجاه «خط الأفق» · بلا صوت · الأزمنة تقديرية وتُضبط على صوت الراوي", 30, "rgba(241,228,203,0.85)")}
        {line("لم يُنفذ هنا: اللقطة 3 (البقرة 30)، وآية اللقطة 5 (الأعراف 23)، وإطار لفظ الآية في اللقطة 4", 30, "rgba(241,228,203,0.85)")}
        {line("السبب: نص الآيات وتلاوتها يُجلبان من Quran Foundation على جهاز صاحب القناة", 26, "rgba(241,228,203,0.6)")}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const hzSchedule = () => {
  let at = SLATE;
  return SHOTS.map((s) => {
    const from = Math.round(at * HZ_FPS);
    const frames = Math.round(s.dur * HZ_FPS);
    at += s.dur + GAP;
    return { shot: s, from, frames };
  });
};

export const HZ_TOTAL = (() => {
  const sch = hzSchedule();
  const last = sch[sch.length - 1]!;
  return last.from + last.frames + Math.round(0.3 * HZ_FPS);
})();

export const HorizonTest: React.FC = () => {
  useBrandFonts();
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <Sequence durationInFrames={Math.round(SLATE * HZ_FPS)}>
        <Slate />
      </Sequence>
      {hzSchedule().map(({ shot, from, frames }) => (
        <Sequence key={shot.id} from={from} durationInFrames={frames}>
          <ShotFrame shot={shot} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
