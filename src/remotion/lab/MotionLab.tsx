import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Figure, LOOKS, POSES, walkPose } from "../illus/Figure";
import { fitDistance, locomote, locoPose, type GaitId, type Move, type Turn } from "../illus/gait";
import { darken, ID, mix } from "../illus/palette";

/**
 * مختبر حركة الشخصيات (الأمر 006): نفس الشخصية في ست حالات، ولكل حالة مساران متزامنان:
 * فوق النظام القديم (دورة مشي واحدة بسرعة ثابتة وانقلاب فوري)، وتحت الحركة الطبيعية الجديدة.
 * علامات الأرض كل 120 وحدة تكشف انزلاق القدمين. بلا صوت، ولا يُنشر.
 */
const FPS = 30;
export const SEG = 150;
const SCALE = 1.2;
const LOOK = LOOKS.hero;
const FLOORS = [520, 1000] as const;

type Lane = { label: string; render: (f: number) => { x: number; pose: ReturnType<typeof locoPose>; flip?: boolean; facing?: number; view?: number; sway?: number } };
type Segment = { title: string; note: string; lanes: [Lane, Lane]; marker?: number };

/** النظام القديم كما هو في المحرك: سرعة ثابتة 3.4 لكل إطار، ودورة مشي كاملة تبدأ وتنتهي فجأة، والوجه يعود فورًا */
const oldWalk = (x0: number, start: number, end: number, speed = 3.4) => (f: number) => {
  const walking = f >= start && f < end;
  const x = x0 - speed * Math.max(0, Math.min(f, end) - start);
  return { x, pose: walking ? walkPose(POSES.stand, (f / FPS) * Math.PI * 2 * 0.95) : POSES.stand, flip: walking };
};
/** الحركة الجديدة */
const newMove = (x0: number, moves: Move[], turns: Turn[] = [], facing0: 1 | -1 = -1) => (f: number) => {
  const st = locomote(f, { x0, facing0, moves, turns, scale: SCALE, fps: FPS });
  return { x: st.x, pose: locoPose(POSES.stand, st), facing: st.facing, view: st.view, sway: st.sway };
};
const walkFor = (g: GaitId, frames: number) => fitDistance(g, frames, SCALE, FPS);

const OLD = "قبل: النظام القديم";
const NEW = "بعد: الحركة الطبيعية";

export const MOTION_SEGMENTS: Segment[] = [
  {
    title: "مشي طبيعي",
    note: "القدم ثابتة على الأرض: طول الخطوة يطابق سرعة الجسد",
    lanes: [
      { label: OLD, render: oldWalk(1700, 10, 140) },
      { label: NEW, render: newMove(1700, [{ start: 10, dx: -walkFor("walk", 130), gait: "walk" }]) },
    ],
  },
  {
    title: "مشي بطيء",
    note: "مشية متمهلة بخطوة أقصر وإيقاع أبطأ، لا الدورة نفسها مبطَّأة",
    lanes: [
      { label: OLD, render: oldWalk(1500, 10, 140, 2.2) },
      { label: NEW, render: newMove(1500, [{ start: 10, dx: -walkFor("stroll", 130), gait: "stroll" }]) },
    ],
  },
  {
    title: "توقف تدريجي",
    note: "تباطؤ، ثم اندفاع خفيف للجذع واستقرار، والثوب يتابع ثم يهدأ",
    marker: 760,
    lanes: [
      { label: OLD, render: oldWalk(1160, 12, 12 + (1160 - 760) / 3.4) },
      { label: NEW, render: newMove(1700, [{ start: 6, dx: -(1700 - 760), gait: "brisk" }]) },
    ],
  },
  {
    title: "التفاتة بالجسد",
    note: "يضيق الجسد وينثني قليلًا ثم ينقلب، بدل الانقلاب في إطار واحد",
    lanes: [
      {
        label: OLD,
        render: (f) => ({ x: 960, pose: POSES.stand, flip: f < 30 || f >= 95 }),
      },
      {
        label: NEW,
        render: newMove(960, [], [
          { at: 30, to: 1, dur: 20 },
          { at: 95, to: -1, dur: 20 },
        ]),
      },
    ],
  },
  {
    title: "من السكون إلى الحركة",
    note: "استعداد قصير (ركبتان وميل للخلف) ثم خطوات أولى قصيرة تتسع",
    lanes: [
      { label: OLD, render: oldWalk(1500, 45, 150) },
      { label: NEW, render: newMove(1500, [{ start: 45, dx: -walkFor("walk", 100) * 1.4, gait: "walk" }]) },
    ],
  },
  {
    title: "المشيات حسب الحالة",
    note: "متثاقل: خطوة قصيرة وجذع منحنٍ · مسرع: خطوة طويلة وذراعان نشطتان",
    lanes: [
      { label: "بعد: متثاقل", render: newMove(1500, [{ start: 10, dx: -walkFor("heavy", 130), gait: "heavy" }]) },
      { label: "بعد: مسرع", render: newMove(1800, [{ start: 10, dx: -walkFor("brisk", 130), gait: "brisk" }]) },
    ],
  },
];

const Ground: React.FC<{ y: number; marker?: number }> = ({ y, marker }) => (
  <g>
    <rect x={0} y={y} width={1920} height={60} fill={darken(ID.night, 0.25)} />
    <line x1={0} x2={1920} y1={y} y2={y} stroke={mix(ID.copper, ID.night, 0.45)} strokeWidth={2} />
    {Array.from({ length: 17 }, (_, i) => (
      <line key={i} x1={i * 120} x2={i * 120} y1={y + 2} y2={y + 16} stroke={mix(ID.copper, ID.night, 0.35)} strokeWidth={3} />
    ))}
    {marker !== undefined ? <line x1={marker} x2={marker} y1={y - 380} y2={y + 30} stroke={ID.dawn} strokeWidth={2} strokeDasharray="10 10" opacity={0.6} /> : null}
  </g>
);

const text = (size: number, color: string, weight = 400): React.CSSProperties => ({ fontFamily: "Tajawal, sans-serif", fontSize: size, color, fontWeight: weight, direction: "rtl", whiteSpace: "nowrap" });

export const MotionLab: React.FC = () => {
  const frame = useCurrentFrame();
  const i = Math.min(MOTION_SEGMENTS.length - 1, Math.floor(frame / SEG));
  const seg = MOTION_SEGMENTS[i]!;
  const f = frame - i * SEG;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(${ID.night}, ${darken(ID.night, 0.35)})` }}>
      <svg viewBox="0 0 1920 1080" width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <line x1={0} x2={1920} y1={600} y2={600} stroke={mix(ID.paper, ID.night, 0.85)} strokeWidth={2} />
        {seg.lanes.map((lane, k) => {
          const s = lane.render(f);
          return (
            <g key={k}>
              <Ground y={FLOORS[k]!} marker={seg.marker} />
              <Figure x={s.x} y={FLOORS[k]! + 4} scale={SCALE} pose={s.pose} look={LOOK} flip={s.flip ?? false} {...(s.facing !== undefined ? { facing: s.facing, view: s.view ?? 0, sway: s.sway ?? 0 } : {})} frame={frame} />
            </g>
          );
        })}
      </svg>
      <div style={{ position: "absolute", right: 48, top: 26, ...text(40, ID.paper, 700) }}>
        {seg.title} <span style={text(26, mix(ID.paper, ID.night, 0.45))}>· {i + 1} من {MOTION_SEGMENTS.length}</span>
      </div>
      <div style={{ position: "absolute", right: 48, top: 82, ...text(24, mix(ID.copper, ID.paper, 0.3)) }}>{seg.note}</div>
      {seg.lanes.map((lane, k) => (
        <div key={k} style={{ position: "absolute", left: 48, top: k === 0 ? 130 : 618, ...text(26, k === 0 && lane.label === OLD ? mix(ID.paper, ID.night, 0.4) : ID.dawn, 700) }}>
          {lane.label}
        </div>
      ))}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 14, textAlign: "center", ...text(20, mix(ID.paper, ID.night, 0.55)) }}>مختبر المحرك · حركة الشخصيات · اختبار بصري بلا صوت · لا يُنشر</div>
    </AbsoluteFill>
  );
};
