import React from "react";
import { ID, SKIN, darken, mix } from "../palette";
import { POSES, blendPose, type PoseSpec } from "../Figure";
import { Glow } from "../world";
import { prog, type CamKey, type ShotCtx } from "./kit";
import { CARRY, Lane, LaneHero, LaneWalker, lanePos, tlPose } from "./ch3";

/**
 * الحلقة 001 · الفصل 4 «دعاء يجمع البصيرة والعزيمة». التخطيط في storyboard/ch4-plan.md (التوجيه 023).
 * لوح الدعاء (dua-board) هو المرجع ولا يتغير؛ والأمثلة بين بطاقاته لقطات الفصلين 1 و2 (البيت والمقهى).
 * وختام الفصل (c4-s16 → c4-s18) عودة إلى الزقاق نفسه الذي انتهى عنده الفصل 3 (lane-dawn-still) والظرف لم يُسلَّم:
 * - c4-s16 وc4-s17 (ذكر الله والافتقار إليه): سكون تام، جالس على مصطبة عند بابه قبيل الفجر.
 * - c4-s18: يطلع الفجر، يضيء الطريق عند «نرى الحق»، يقوم عند «نحبه» ويمشي عند «ونتبعه» متجاوزًا موضع تراجعه
 *   في الفصل 3؛ وعند «قدر الأشياء» لقطة قريبة للظرف: النقود كما هي، لا تزيد ولا تنقص، فيغلقه عند «حقها» ويمضي.
 *   النقود جسر إلى الفصل 5 («تأمل المال»)، ووصوله إلى باب أخيه يبقى للفصل 6.
 */

const INK = darken(ID.night, 0.55);
type Ch4Shot = { nameAr: string; place: string; render: (c: ShotCtx) => { cam: CamKey[]; world: React.ReactNode; captionBackdrop?: number } };
const V = (t: number, x: number, z: number, y: number, cut = false): CamKey => ({ t, x, y, z, ...(cut ? { cut } : {}) });

/** مصطبة حجرية عند بابه (عنصر جديد للمراجعة): عليها يجلس عند d=0 */
const SEAT = (() => {
  const p = lanePos(0);
  const h = 82 * (p.s / 1.1);
  return { x: p.x - 18 * (p.s / 1.1), y: p.y, w: 150 * (p.s / 1.1), h };
})();
const Mastaba: React.FC = () => (
  <g>
    <rect x={SEAT.x - SEAT.w / 2} y={SEAT.y - SEAT.h} width={SEAT.w} height={SEAT.h} fill={mix(darken(ID.copper, 0.35), ID.night, 0.35)} stroke={INK} strokeWidth={3} />
    <rect x={SEAT.x - SEAT.w / 2 - 8} y={SEAT.y - SEAT.h - 12} width={SEAT.w + 16} height={14} fill={mix(darken(ID.copper, 0.2), ID.night, 0.3)} stroke={INK} strokeWidth={3} />
  </g>
);
/** جالس والظرف بين يديه في حجره */
const SIT_HOLD: PoseSpec = { ...POSES.sit, head: 10, armFront: { s: 40, e: 70 }, armBack: { s: 36, e: 64 } };
const READY: PoseSpec = { ...POSES.stand, head: 4, armFront: { s: 64, e: 86 } };

/** لقطة قريبة للظرف بين يديه (منطقة مستقلة): الغطاء يُفتح فتظهر النقود كما هي، ثم يُغلق عليها */
const ENV = { x: 6000, y: 560 };
const EnvelopeInsert: React.FC<{ flap: number; coins: number; glint: number }> = ({ flap, coins, glint }) => {
  const w = 620;
  const h = 380;
  const x0 = ENV.x - w / 2;
  const y0 = ENV.y - h / 2 + 40;
  const flapY = y0 + 230 * (1 - 2 * flap);
  return (
    <g>
      <rect x={ENV.x - 1400} y={ENV.y - 900} width={2800} height={1800} fill={mix(darken(ID.copper, 0.5), ID.dawn, 0.12)} />
      <Glow cx={ENV.x} cy={ENV.y - 60} r={620} color={ID.dawn} opacity={0.28} />
      {/* الغطاء مفتوحًا خلف النقود (flap > 0.5)، ومغلقًا فوقها (flap ≤ 0.5) */}
      {flap > 0.5 ? <path d={`M${x0} ${y0} L${ENV.x} ${flapY} L${x0 + w} ${y0} Z`} fill={mix(ID.paper, ID.copper, 0.15)} stroke={INK} strokeWidth={7} strokeLinejoin="round" /> : null}
      {/* النقود داخل الظرف تطل من فتحته واحدة بعد أخرى: العدد نفسه الذي أُخذ من أخيه، ثم تعود إليه عند الإغلاق */}
      {[0, 1, 2, 3, 4].map((i) => {
        const on = prog(coins * 5, i, i + 1) * Math.min(1, flap * 1.6);
        if (on <= 0.01) return null;
        const cx = x0 + 150 + i * 80;
        const cy = y0 + 40 - 70 * on - (i % 2) * 16;
        return (
          <g key={i}>
            {glint > 0.01 ? <Glow cx={cx} cy={cy} r={60} color={ID.dawn} opacity={0.45 * glint} /> : null}
            <circle cx={cx} cy={cy} r={42} fill={mix(ID.copper, ID.dawn, 0.3)} stroke={INK} strokeWidth={5} />
            <circle cx={cx} cy={cy} r={28} fill="none" stroke={darken(ID.copper, 0.2)} strokeWidth={4} />
          </g>
        );
      })}
      <rect x={x0} y={y0} width={w} height={h} rx={6} fill={ID.paper} stroke={INK} strokeWidth={7} />
      <path d={`M${x0} ${y0 + h} L${ENV.x} ${y0 + h * 0.45} L${x0 + w} ${y0 + h}`} fill="none" stroke={mix(ID.paper, ID.night, 0.3)} strokeWidth={5} />
      {flap <= 0.5 ? <path d={`M${x0} ${y0} L${ENV.x} ${flapY} L${x0 + w} ${y0} Z`} fill={mix(ID.paper, ID.copper, 0.15)} stroke={INK} strokeWidth={7} strokeLinejoin="round" /> : null}
      {/* يداه تمسكان الظرف من جانبيه */}
      <path d={`M${x0 - 120} ${y0 + h + 300} L${x0 - 60} ${y0 + 160} Q${x0 - 20} ${y0 + 110} ${x0 + 40} ${y0 + 170} L${x0 + 60} ${y0 + h - 20} L${x0 + 20} ${y0 + h + 300} Z`} fill={SKIN[1]} stroke={INK} strokeWidth={6} />
      <path d={`M${x0 + w + 120} ${y0 + h + 300} L${x0 + w + 60} ${y0 + 160} Q${x0 + w + 20} ${y0 + 110} ${x0 + w - 40} ${y0 + 170} L${x0 + w - 60} ${y0 + h - 20} L${x0 + w - 20} ${y0 + h + 300} Z`} fill={SKIN[1]} stroke={INK} strokeWidth={6} />
      <path d={`M${x0 - 260} ${y0 + h + 420} L${x0 - 140} ${y0 + h + 120} L${x0 + 40} ${y0 + h + 160} L${x0 + 40} ${y0 + h + 420} Z`} fill={mix(ID.night, ID.paper, 0.18)} stroke={INK} strokeWidth={6} />
      <path d={`M${x0 + w + 260} ${y0 + h + 420} L${x0 + w + 140} ${y0 + h + 120} L${x0 + w - 40} ${y0 + h + 160} L${x0 + w - 40} ${y0 + h + 420} Z`} fill={mix(ID.night, ID.paper, 0.18)} stroke={INK} strokeWidth={6} />
    </g>
  );
};

export const CH4_SHOTS: Record<string, Ch4Shot> = {
  "lane-threshold-still": {
    nameAr: "الزقاق قبيل الفجر ساكنًا: جالس على مصطبة عند بابه والظرف في حجره، والطريق المضيء أمامه (سكون الافتقار إلى الله)",
    place: "الزقاق بين البيتين قبيل الفجر",
    // c4-s16 وc4-s17: ذكر الله في الجملتين، فلا حدث ولا حركة كاميرا والعالم مجمَّد (كما c3-s22)؛
    // والتأطير أعرض وأعلى من c3-s22: هو صغير في أسفل الإطار والزقاق والسماء فوقه.
    render: ({ portrait }) => ({
      cam: portrait ? [V(0, 560, 0.72, 600)] : [V(0, 900, 0.9, 500)],
      world: (
        <g>
          <Lane frame={0} mood="predawn" lit={1} heroDoor={0.6} brotherDoor={0.5} />
          <Mastaba />
          <LaneHero d={0} pose={SIT_HOLD} frame={0} />
        </g>
      ),
    }),
  },
  "lane-dawn-follows": {
    nameAr: "الزقاق يطلع عليه الفجر: يضيء الطريق، يقوم ويمضي نحو باب أخيه متجاوزًا موضع تراجعه، والظرف كما هو",
    place: "الزقاق بين البيتين فجرًا",
    render: ({ frame, at, portrait }) => {
      const tH = at("الحق", 0.14);
      const tL = at("نحبه", 0.24);
      const tF = at("ونتبعه", 0.27);
      const tW = at("أهواءنا", 0.38);
      const tQ = at("قدر", 0.6);
      const tS = at("الأشياء", 0.63);
      const tN = at("ننقصها", 0.88);
      const tR = at("حقها", 0.93);
      const day = prog(frame, 0, tH + 20, (t) => t);
      const lit = prog(frame, tH - 6, tH + 26, (t) => t);
      const walk1 = { start: tF, end: tW + 22, d0: 0, d1: 0.55 };
      const walk2 = { start: tR + 8, end: tR + 40, d0: 0.55, d1: 0.64 };
      const insert = frame >= tQ - 4 && frame < tR;
      const flap = prog(frame, tQ + 2, tQ + 16) * (1 - prog(frame, tN, tN + 16));
      const coins = prog(frame, tQ + 10, tS + 20, (t) => t);
      const glint = prog(frame, tS + 10, tS + 30) * (1 - prog(frame, tN - 10, tN + 10));
      const standPose = tlPose(frame, [[0, SIT_HOLD], [tL - 2, SIT_HOLD], [tL + 12, blendPose(POSES.sit, READY, 0.6)], [tL + 16, READY], [tF, CARRY]]);
      const seated = frame < tL + 12;
      const heroNode =
        frame < walk1.start ? (
          <LaneHero d={0} pose={standPose} frame={frame} />
        ) : frame < walk1.end ? (
          <LaneWalker frame={frame} d0={walk1.d0} d1={walk1.d1} start={walk1.start} end={walk1.end} />
        ) : frame < walk2.start ? (
          <LaneHero d={0.55} pose={{ ...CARRY, head: -4 }} frame={frame} />
        ) : (
          <LaneWalker frame={frame} d0={walk2.d0} d1={walk2.d1} start={walk2.start} end={walk2.end} />
        );
      const follow = (d: number) => lanePos(d);
      const p1 = follow(0.3);
      const p2 = follow(0.55);
      const cam: CamKey[] = portrait
        ? [V(0, 560, 0.72, 600), V(tF + 10, p1.x + 60, 1.0, p1.y - 170), V(tW, p2.x + 20, 1.2, p2.y - 120), V(tQ - 4, ENV.x, 0.62, ENV.y, true), V(tR, p2.x + 60, 1.05, p2.y - 140, true), V(tR + 14, 860, 1.15, 520)]
        : [V(0, 900, 0.9, 500), V(tF + 10, 820, 1.05, 560), V(tW, 880, 1.35, 520), V(tQ - 4, ENV.x, 1.1, ENV.y - 70, true), V(tR, 880, 1.35, 520, true), V(tR + 14, 920, 1.5, 480)];
      return {
        cam,
        world: (
          <g>
            <Lane frame={frame} mood="predawn" lit={lit} heroDoor={0.6} brotherDoor={0.5} />
            <g opacity={day}>
              <Lane frame={frame} mood="dawn" lit={lit} heroDoor={0.6} brotherDoor={0.6 + 0.3 * prog(frame, tR, tR + 18)} />
            </g>
            <Mastaba />
            {seated ? <LaneHero d={0} pose={standPose} frame={frame} /> : heroNode}
            {insert ? <EnvelopeInsert flap={flap} coins={coins} glint={glint} /> : null}
          </g>
        ),
      };
    },
  },
};
