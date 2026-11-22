/**
 * صورة الخطاف المسبق في «خط الأفق» (D198، ملاحظة المالك ٢٢ نوفمبر: «أول ٤ ثوانٍ لا تكون صفحات فارغة: اجعلها خانة التاريخ
 * الفارغة على الخط الزمني والحبر يكتب فيها «؟» مع السؤال»):
 * - الخط الزمني يُخط بالحبر من اليمين إلى اليسار على الصفحتين، وعليه علامات أزمنة بلا أرقام (لا تاريخ ثابت).
 * - خانة تاريخ واحدة فارغة تُرسم على الخط، والقلم يكتب فيها «؟»: الخطّاف مع «…البداية؟»، والنقطة مع «…كانت؟» (الثانية)،
 *   ودائرة لا تُغلق حول الخانة مع «وأين» (النبضة الثانية).
 * - الكاميرا تدفع نحو الخانة مع السؤال الأول، ثم أقرب قليلًا مع الثاني. لا نص غير «؟» (الكلام نفسه في الترجمة).
 * كل حدث على كلمته المنطوقة من التسجيل نفسه (كلمات الخطاف)، فلا يتقدم على الصوت ولا يتأخر عنه.
 */
import React from "react";
import { BookShadow, C, Camera, Defs, Ink, Page, Spine, W, easeOut, mix, prog } from "./kit";

type TimedWord = { word: string; start: number; end: number };
export type SlotCam = { cx: number; cy: number; s: number };

/** موضع الخانة وخطها بإحداثيات الدفتر (الكعب x=960) */
export const SLOT = { x: 1300, top: 455, bottom: 655, w: 150, line: 720 } as const;
const CAM0: SlotCam = { cx: 1150, cy: 600, s: 1.12 };
const CAM1: SlotCam = { cx: 1300, cy: 565, s: 1.6 };
/** أقرب كادر في الخطاف (مع السؤال الثاني) */
export const SLOT_CAM_END: SlotCam = { cx: 1300, cy: 560, s: 1.75 };
/** الدفتر كله (NEUTRAL في book.tsx): إليه يتراجع الكادر بعد القطع، ومنه يبدأ قلب الصفحة */
export const SLOT_NEUTRAL: SlotCam = { cx: 960, cy: 520, s: 1 };

/** «؟» العربية بالقلم (عكس «?» اللاتينية): تبدأ من الطرف الأيمن، وتقوّس فوقًا إلى اليسار، وينزل جانبها الأيسر إلى الساق */
const HOOK = `M${SLOT.x + 40} 512 C${SLOT.x + 40} 470 ${SLOT.x - 40} 470 ${SLOT.x - 40} 512 C${SLOT.x - 40} 545 ${SLOT.x} 548 ${SLOT.x} 585 L${SLOT.x} 600`;
const BOX = `M${SLOT.x + SLOT.w / 2} ${SLOT.top} H${SLOT.x - SLOT.w / 2} V${SLOT.bottom} H${SLOT.x + SLOT.w / 2} Z`;
/** دائرة تكاد تُغلق حول الخانة (كما في لقطة «لا تاريخ ثابتًا») */
const RING = (() => {
  const pts: string[] = [];
  for (let i = 0; i <= 40; i++) {
    const a = -Math.PI / 2 + (i / 40) * Math.PI * 2 * 0.9;
    const k = 1 + Math.sin(i * 1.7) * 0.015;
    pts.push(`${(SLOT.x + Math.cos(a) * 128 * k).toFixed(1)} ${(SLOT.top + (SLOT.bottom - SLOT.top) / 2 + Math.sin(a) * 140 * k).toFixed(1)}`);
  }
  return `M${pts.join(" L")}`;
})();
const TICKS = [1690, 1560, 1430, 1170, 1040, 860, 700, 540, 380, 230];

/** أزمنة الأحداث من كلمات الخطاف: [فمتى، كانت، تلك، البداية؟، وأين، كانت؟] */
export const slotBeats = (words: TimedWord[]) => {
  const w = (i: number) => words[Math.min(i, words.length - 1)] ?? { start: 0, end: 0.5, word: "" };
  const second = words.length >= 6;
  return {
    line: [0, Math.max(0.9, w(1).end + 0.2)] as const,
    box: [0, Math.max(0.6, w(1).end)] as const,
    hook: [w(2).start, w(3).end] as const,
    ring: second ? ([w(4).start, w(5).end] as const) : null,
    dot: (second ? [w(5).start, w(5).start + 0.25] : [w(3).end - 0.1, w(3).end + 0.15]) as readonly [number, number],
    push1: [w(1).start, w(3).end] as const,
    push2: second ? ([w(4).start, w(5).end] as const) : null,
  };
};

const lerpCam = (a: SlotCam, b: SlotCam, p: number): SlotCam => ({ cx: mix(a.cx, b.cx, p), cy: mix(a.cy, b.cy, p), s: mix(a.s, b.s, p) });

/** بعد القطع (ث): تراجع الكادر إلى الدفتر كله مع خفوت الحبر، قبل قلب الصفحة */
export const SLOT_BACK_SEC = 0.35;

export const ColdOpenSlot: React.FC<{ t: number; words: TimedWord[]; end?: number }> = ({ t, words, end }) => {
  const b = slotBeats(words);
  const p = (r: readonly [number, number] | null, e = easeOut) => (r ? prog(t, r[0], r[1], e) : 0);
  let cam = lerpCam(CAM0, CAM1, p(b.push1));
  if (b.push2) cam = lerpCam(cam, SLOT_CAM_END, p(b.push2));
  const back = end !== undefined ? prog(t, end, end + SLOT_BACK_SEC) : 0;
  if (back > 0) cam = lerpCam(cam, SLOT_NEUTRAL, back);
  const ink = 1 - back;
  const line = p(b.line);
  const dot = p(b.dot);
  return (
    <Camera {...cam}>
      <svg width={W} height={1080} style={{ position: "absolute", overflow: "visible" }}>
        <Defs id="co" />
        <BookShadow />
        <Page id="co" side="l">
          <Ink d={`M940 ${SLOT.line} C700 ${SLOT.line + 4} 420 ${SLOT.line - 4} 190 ${SLOT.line}`} w={4} p={prog(line, 0.5, 1)} opacity={ink} />
        </Page>
        <Page id="co" side="r">
          <Ink d={`M1730 ${SLOT.line} C1500 ${SLOT.line - 4} 1200 ${SLOT.line + 4} 980 ${SLOT.line}`} w={4} p={prog(line, 0, 0.5)} opacity={ink} />
        </Page>
        <Spine />
        <g opacity={ink}>
        {/* علامات الأزمنة على الخط بلا أرقام: تظهر كلما مر بها القلم */}
        {TICKS.map((x, i) => {
          const at = (1730 - x) / 1540;
          return <Ink key={i} d={`M${x} ${SLOT.line - 14} V${SLOT.line + 14}`} w={3} p={prog(line, at, at + 0.06)} c={C.inkSoft} />;
        })}
        {/* الخانة الفارغة على الخط: ساقها إلى الخط ثم إطارها */}
        <Ink d={`M${SLOT.x} ${SLOT.bottom} V${SLOT.line}`} w={3} p={p(b.box)} />
        <rect x={SLOT.x - SLOT.w / 2} y={SLOT.top} width={SLOT.w} height={SLOT.bottom - SLOT.top} rx={6} fill={C.page} opacity={p(b.box) * 0.9} />
        <Ink d={BOX} w={4} p={p(b.box)} />
        {/* «؟» بالقلم: الخطّاف ثم النقطة */}
        <Ink d={HOOK} w={11} p={p(b.hook)} c={C.inkText} />
        {dot > 0 ? <circle cx={SLOT.x} cy={630} r={9 * dot} fill={C.inkText} /> : null}
        <Ink d={RING} w={5} p={p(b.ring) * 0.9} c={C.ribbon} />
        </g>
      </svg>
    </Camera>
  );
};
