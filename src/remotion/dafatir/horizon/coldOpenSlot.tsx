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

/**
 * «؟» بشكل النسخ (D198 v4، شرط المالك ٢٣ نوفمبر: «علامة الاستفهام بشكل النسخ، الأول في صورة المقارنة»): محيط الحرف نفسه
 * من خط الأميري (U+061F في public/fonts/Amiri-Regular.ttf، بوحدات الخط ١٠٠٠/em، والمحور y للأعلى)، غليظ ورفيع بالتفافته
 * ونقطته — لا خط بعرض واحد. يُكتب بالحبر: قناع خط مركزي (QMARK_PEN) يُكشف على مسار القلم، من رأس الالتفافة يمينًا فوق القوس
 * إلى اليسار ثم إلى الساق، والنقطة بعده.
 */
export const QMARK_BODY = "M322 519Q326 587 276 620Q246 640 207 640Q164 638 144 614Q97 561 148 476Q182 421 199.5 364.5Q217 308 219 252Q220 227 219.0 206.0Q218 185 214 168Q211 156 201 156Q189 156 190 171Q191 181 191.0 191.0Q191 201 191 210Q191 261 162 287Q58 376 42 428Q11 525 65 601Q114 667 210 669Q252 669 290 647Q332 623 349 570Q357 545 354 510Q351 473 344 458Q325 415 284 415Q256 415 239 435Q224 455 224 476Q224 499 237 516Q250 533 278 535Q305 536 322 519Z";
export const QMARK_DOT = "M147 44Q147 66 163 81Q181 97 201 97Q223 97 239 81Q254 66 254 44Q254 23 239 6Q224 -11 201 -11Q180 -11 163 6Q147 22 147 44Z";
/** مسار القلم داخل الحرف (وحدات الخط): من رأس الالتفافة، حول القوس إلى اليسار، ثم نزولًا إلى طرف الساق */
export const QMARK_PEN = "M262 478C262 520 300 560 330 545C352 590 300 660 210 655C110 650 40 580 60 480C80 400 205 340 205 260L205 160";
/** مقياس الحرف في الخانة وخط قاعدته: ارتفاعه ~١٧٠ بكسل بين أعلى الخانة (455) وأسفلها (655) */
export const QMARK_SCALE = 0.25;
const QMARK_BASE = 637;
const QMARK_CX = 198;
const qmarkTransform = `translate(${SLOT.x - QMARK_CX * QMARK_SCALE} ${QMARK_BASE}) scale(${QMARK_SCALE} ${-QMARK_SCALE})`;

/** «؟» الأميري يُكتب بالحبر: p للجسم على مسار القلم، dot للنقطة (تظهر من مركزها) */
const NaskhQuestion: React.FC<{ p: number; dot: number }> = ({ p, dot }) => (
  <g transform={qmarkTransform}>
    <defs>
      <mask id="co-qmark-pen" maskUnits="userSpaceOnUse" x={-100} y={-100} width={600} height={900}>
        <path d={QMARK_PEN} fill="none" stroke="#fff" strokeWidth={120} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - p} />
      </mask>
    </defs>
    {p > 0 ? <path d={QMARK_BODY} fill={C.inkText} mask="url(#co-qmark-pen)" /> : null}
    {dot > 0 ? <g transform={`translate(200 43) scale(${dot}) translate(-200 -43)`}><path d={QMARK_DOT} fill={C.inkText} /></g> : null}
  </g>
);

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
        {/* «؟» بشكل النسخ (الأميري) بالقلم: الجسم ثم النقطة */}
        <NaskhQuestion p={p(b.hook)} dot={dot} />
        <Ink d={RING} w={5} p={p(b.ring) * 0.9} c={C.ribbon} />
        </g>
      </svg>
    </Camera>
  );
};
