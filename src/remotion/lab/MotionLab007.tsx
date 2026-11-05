import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Figure, LOOKS, POSES, walkPose } from "../illus/Figure";
import { characterAt, fitDistance, type GaitId, type LocoOptions, type Move, type Turn } from "../illus/gait";
import { darken, ID, mix } from "../illus/palette";
import { AlleyTale } from "../scenes/AlleyTale";
import { RoadJourney, roadJourneySample } from "../scenes/RoadJourney";
import { LAB_SCENE } from "./BalislamLab";

/**
 * مختبر الأمر 007: قبول جودة حركة الشخصيات. بلا صوت، ولا يُنشر.
 * ١ الالتفاتة قبل وبعد · ٢ المشيات الأربع · ٣ وقوف ← مشي ← توقف · ثم (تركيب ثانٍ) الحركة في نوعين من المشاهد.
 */
const FPS = 30;
export const SEG7 = 180;
const SCALE = 1.2;

type Frame = { x: number; pose: ReturnType<typeof walkPose>; flip?: boolean; facing?: number; view?: number; sway?: number };
type Lane = { label: string; old?: boolean; render: (f: number) => Frame };
type Segment = { title: string; note: string; lanes: Lane[]; scale?: number };

const opts = (x0: number, moves: Move[], turns: Turn[] = [], facing0: 1 | -1 = -1, scale = SCALE): LocoOptions => ({ x0, facing0, moves, turns, scale, fps: FPS });
/** مقياس المسارات الأربعة: الحركة تُحسب بالمقياس نفسه الذي تُرسم به (وإلا انزلقت القدم) */
const SMALL = 0.62;
/** الحركة الجديدة: دوران بزاوية النظر */
const natural = (o: LocoOptions) => (f: number): Frame => {
  const c = characterAt(f, POSES.stand, o);
  return { x: c.x, pose: c.pose, facing: c.facing, view: c.view, sway: c.sway };
};
/** الالتفاتة كما كانت في الأمر 006: الحركة نفسها، لكن الجسد يُضيَّق عرضه حتى الثلث ثم ينقلب (مرجع المقارنة) */
const flatTurn = (o: LocoOptions) => (f: number): Frame => {
  const c = characterAt(f, POSES.stand, o);
  const narrow = 0.3 + 0.7 * Math.pow(Math.max(0, 1 - c.view * c.view), 0.85);
  return { x: c.x, pose: c.pose, facing: c.facing * narrow, view: 0, sway: c.sway };
};
/** المشي القديم في القوالب: سرعة ثابتة ودورة تبدأ وتنتهي فجأة */
const oldWalk = (x0: number, start: number, end: number, speed = 3.4) => (f: number): Frame => {
  const walking = f >= start && f < end;
  const x = x0 - speed * Math.max(0, Math.min(f, end) - start);
  return { x, pose: walking ? walkPose(POSES.stand, (f / FPS) * Math.PI * 2 * 0.95) : POSES.stand, flip: walking };
};
const walkFor = (g: GaitId, frames: number, scale = SCALE) => fitDistance(g, frames, scale, FPS);

const TURNS: Turn[] = [
  { at: 25, to: 1, dur: 26 },
  { at: 105, to: -1, dur: 26 },
];
export const SEGMENTS_007: Segment[] = [
  {
    title: "الالتفاتة في المكان",
    note: "قبل: يضيق الجسد حتى يصير شريحة ثم ينقلب · بعد: يدور بحجمه، جانبي ← ثلاثة أرباع ← أمامي ← الجهة الأخرى",
    lanes: [
      { label: "قبل: تضييق العرض", old: true, render: flatTurn(opts(960, [], TURNS)) },
      { label: "بعد: دوران الجسد", render: natural(opts(960, [], TURNS)) },
    ],
  },
  {
    title: "التفاتة ثم مشي في الاتجاه الآخر",
    note: "يمشي، يتوقف، يلتفت بجسده، ثم يمضي عائدًا",
    lanes: [
      { label: "قبل: تضييق العرض", old: true, render: flatTurn(opts(1500, [{ start: 6, dx: -560, gait: "walk" }, { start: 100, dx: 420, gait: "walk" }])) },
      { label: "بعد: دوران الجسد", render: natural(opts(1500, [{ start: 6, dx: -560, gait: "walk" }, { start: 100, dx: 420, gait: "walk" }])) },
    ],
  },
  {
    title: "المشيات الأربع",
    note: "متثاقل · متمهل · طبيعي · مسرع — الخطوة والإيقاع والجذع والذراعان تتغير معًا، والقدم ثابتة على الأرض",
    scale: SMALL,
    lanes: (["heavy", "stroll", "walk", "brisk"] as GaitId[]).map((g, i) => ({
      label: ["متثاقل", "متمهل", "طبيعي", "مسرع"][i]!,
      render: natural(opts(1640, [{ start: 12, dx: -walkFor(g, 160, SMALL), gait: g }], [], -1, SMALL)),
    })),
  },
  {
    title: "وقوف ← مشي ← توقف",
    note: "استعداد قصير، خطوات أولى قصيرة تتسع، تباطؤ، اندفاع خفيف للجذع ثم استقرار، والثوب يتابع ثم يهدأ",
    lanes: [
      { label: "قبل: النظام القديم", old: true, render: oldWalk(1500, 40, 140) },
      { label: "بعد: الحركة الطبيعية", render: natural(opts(1500, [{ start: 40, dx: -walkFor("walk", 100), gait: "walk" }])) },
    ],
  },
];

const text = (size: number, color: string, weight = 400): React.CSSProperties => ({ fontFamily: "Tajawal, sans-serif", fontSize: size, color, fontWeight: weight, direction: "rtl", whiteSpace: "nowrap" });

export const MotionLab007: React.FC = () => {
  const frame = useCurrentFrame();
  const i = Math.min(SEGMENTS_007.length - 1, Math.floor(frame / SEG7));
  const seg = SEGMENTS_007[i]!;
  const f = frame - i * SEG7;
  const n = seg.lanes.length;
  const top = 150;
  const laneH = (1040 - top) / n;
  const scale = seg.scale ?? SCALE;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(${ID.night}, ${darken(ID.night, 0.35)})` }}>
      <svg viewBox="0 0 1920 1080" width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {seg.lanes.map((lane, k) => {
          const s = lane.render(f);
          const y = top + laneH * (k + 1) - 30;
          return (
            <g key={k}>
              <rect x={0} y={y} width={1920} height={26} fill={darken(ID.night, 0.25)} />
              <line x1={0} x2={1920} y1={y} y2={y} stroke={mix(ID.copper, ID.night, 0.45)} strokeWidth={2} />
              {Array.from({ length: 17 }, (_, t) => (
                <line key={t} x1={t * 120} x2={t * 120} y1={y + 2} y2={y + 14} stroke={mix(ID.copper, ID.night, 0.35)} strokeWidth={3} />
              ))}
              <Figure x={s.x} y={y + 4} scale={scale} pose={s.pose} look={LOOKS.hero} flip={s.flip ?? false} {...(s.facing !== undefined ? { facing: s.facing, view: s.view ?? 0, sway: s.sway ?? 0 } : {})} frame={frame} />
            </g>
          );
        })}
      </svg>
      <div style={{ position: "absolute", right: 48, top: 26, ...text(40, ID.paper, 700) }}>
        {seg.title} <span style={text(26, mix(ID.paper, ID.night, 0.45))}>· {i + 1} من {SEGMENTS_007.length}</span>
      </div>
      <div style={{ position: "absolute", right: 48, top: 84, ...text(23, mix(ID.copper, ID.paper, 0.3)) }}>{seg.note}</div>
      {seg.lanes.map((lane, k) => (
        <div key={k} style={{ position: "absolute", left: 48, top: top + laneH * k + 12, ...text(26, lane.old ? mix(ID.paper, ID.night, 0.4) : ID.dawn, 700) }}>
          {lane.label}
        </div>
      ))}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 10, textAlign: "center", ...text(20, mix(ID.paper, ID.night, 0.55)) }}>مختبر المحرك · الأمر 007 · اختبار بصري بلا صوت · لا يُنشر</div>
    </AbsoluteFill>
  );
};

const Pane: React.FC<{ x: number; y: number; title: string; sub: string; children: React.ReactNode }> = ({ x, y, title, sub, children }) => (
  <>
    <div style={{ position: "absolute", left: x, top: y, width: 1920, height: 1080, transform: "scale(0.5)", transformOrigin: "0 0", overflow: "hidden" }}>{children}</div>
    <div style={{ position: "absolute", left: x, top: y + 452, width: 960, height: 88, paddingTop: 8, textAlign: "center", background: "rgba(7,21,18,.78)" }}>
      <div style={text(28, ID.paper, 700)}>{title}</div>
      <div style={{ ...text(21, "#A9C3B9"), marginTop: 4 }}>{sub}</div>
    </div>
  </>
);

/** الحركة نفسها في نوعين من المشاهد عبر الطبقة المشتركة: الحارة (الكاميرا المؤلَّفة) والطريق (اختياريًا motion = natural) */
export const MotionScenes007: React.FC = () => (
  <AbsoluteFill style={{ background: "#071512" }}>
    <Pane x={960} y={0} title="الطريق · قبل (الافتراضي القائم)" sub="دورة مشي ثابتة؛ القدم تنزلق على الطريق">
      <RoadJourney {...roadJourneySample} themeId="night" orientation="landscape" />
    </Pane>
    <Pane x={0} y={0} title="الطريق · بعد (motion = natural)" sub="قدم ثابتة على الطريق المتحرك، وتباطؤ واستقرار عند المحطات">
      <RoadJourney {...roadJourneySample} themeId="night" orientation="landscape" motion="natural" />
    </Pane>
    <Pane x={480} y={540} title="الحارة · الكاميرا المؤلَّفة" sub="المشي والتوقف والالتفات نحو الباب من الطبقة نفسها">
      <AlleyTale {...LAB_SCENE} themeId="night" orientation="landscape" cameraMode="composed" />
    </Pane>
  </AbsoluteFill>
);
