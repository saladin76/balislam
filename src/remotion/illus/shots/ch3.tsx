import React from "react";
import { ID, darken, lighten, mix } from "../palette";
import { Figure, POSES, blendPose, handAt, walkPose, type FigureLook, type PoseSpec } from "../Figure";
import { GROUND, Glow, Sky, WallLamp, archPath } from "../world";
import { HomeRoom } from "./interior";
import { K, Walker, prog, type CamKey, type ShotCtx } from "./kit";

/**
 * الحلقة 001 · الفصل 3 «هل نريد معرفة الحق فعلًا؟» (التوجيه 022). التخطيط في storyboard/ch3-plan.md.
 * أ. الصفحة الممزقة (c3-s1 → c3-s8): يتهم أخاه بتمزيق دفتره ويأخذ منه ثمنه؛ القط يخرج من خلف المكتبة وفي فمه قصاصة؛
 *    يخرج الأخ؛ ثم الخيارات في الغرفة نفسها: الباب، الصفحة بآثار المخالب، النافذة المفتوحة.
 * ب. ثمن الاعتراف (c3-s9 → c3-s12): باب الأخ، الحقيبة، الظرف، الانعكاس.
 * ج. سكون الآية (c3-s13، c3-s15) حول البطاقة c3-s14.
 * د. الطريق إلى الباب (c3-s16 → c3-s21) وهـ. الجسر الساكن (c3-s22).
 * شخوص بلا ملامح، والقط والعناصر الجديدة داخل هذه اللقطات وحدها حتى يراجعها صاحب القناة.
 */

const INK = darken(ID.night, 0.55);
const hero = { outfit: "jacket", cloth: "emerald", head: "hair", skin: 1 } as FigureLook;
export const CH3_CAST = {
  brother: { outfit: "jacket", cloth: "copper", head: "hair", skin: 0, build: 1.15 } as FigureLook,
};

type Ch3Shot = { nameAr: string; place: string; render: (c: ShotCtx) => { cam: CamKey[]; world: React.ReactNode; captionBackdrop?: number } };
const V = (t: number, x: number, z: number, y: number, cut = false): CamKey => ({ t, x, y, z, ...(cut ? { cut } : {}) });
const tlPose = (frame: number, tl: [number, PoseSpec][]) => {
  let i = 0;
  while (i + 1 < tl.length && frame >= tl[i + 1]![0]) i++;
  const [t0, p0] = tl[i]!;
  return i > 0 && frame < t0 + 10 ? blendPose(tl[i - 1]![1], p0, prog(frame, t0, t0 + 10)) : p0;
};

// ———————————————————— مواضع الغرفة (HomeRoom) ————————————————————
const ROOM = { door: -20, bag: 140, shelf: 320, brother: 600, hero: 900, sideboard: 1000, envelope: 1210, jar: 1180, window: 1590 };
const KNEEL = { legFront: { s: 4, e: 96 }, legBack: { s: 70, e: 70 } };
const ACCUSE: PoseSpec = { ...POSES.point, lean: 6, head: 6, armFront: { s: 84, e: 10 } };
const PALM: PoseSpec = { ...POSES.stand, lean: 4, head: 14, armFront: { s: 58, e: 20 } };
const GIVE: PoseSpec = { ...POSES.stand, lean: 8, head: 22, armFront: { s: 62, e: 14 } };
const KNOCK: PoseSpec = { ...POSES.stand, lean: 2, head: -4, armFront: { s: 132, e: 70 } };
const PROUD_BACK: PoseSpec = { ...POSES.proud };

// ———————————————————— عناصر جديدة (للمراجعة) ————————————————————

/** القط: جسد مسطح بحد حبري بلا ملامح؛ يمشي أو يجلس، وقد يحمل قصاصة في فمه */
export const Cat: React.FC<{ x: number; y?: number; s?: number; frame: number; walk?: boolean; sit?: number; scrap?: number; flip?: boolean; glow?: number }> = ({ x, y = GROUND + 4, s = 1.3, frame, walk = false, sit = 0, scrap = 0, flip = false, glow = 0 }) => {
  const fur = mix(ID.copper, ID.night, 0.45);
  const step = walk ? Math.sin(frame / 3) : 0;
  const bodyY = -26 - 8 * sit;
  const tail = `M-30 ${bodyY - 4} C -60 ${bodyY - 10 - 6 * Math.sin(frame / 9)}, -58 ${bodyY - 52}, -40 ${bodyY - 60}`;
  return (
    <g transform={`translate(${x} ${y}) scale(${(flip ? -1 : 1) * s} ${s})`}>
      {glow > 0.01 ? <Glow cx={0} cy={-30} r={90} color={ID.dawn} opacity={0.7 * glow} /> : null}
      <ellipse cx={0} cy={2} rx={34} ry={5} fill="#000" opacity={0.25} />
      <path d={tail} fill="none" stroke={INK} strokeWidth={9} strokeLinecap="round" />
      <path d={tail} fill="none" stroke={fur} strokeWidth={5} strokeLinecap="round" />
      {/* الأرجل: الخلفيتان تنثنيان في الجلوس */}
      <rect x={-24 + 4 * step} y={bodyY + 6} width={8} height={20 + 8 * sit - 10 * sit} rx={3} fill={fur} stroke={INK} strokeWidth={2} />
      <rect x={-12 - 4 * step} y={bodyY + 6} width={8} height={20 + 8 * sit - 10 * sit} rx={3} fill={darken(fur, 0.15)} stroke={INK} strokeWidth={2} />
      <rect x={14 - 4 * step} y={bodyY + 6 - 6 * sit} width={8} height={20 + 8 * sit} rx={3} fill={darken(fur, 0.15)} stroke={INK} strokeWidth={2} />
      <rect x={24 + 4 * step} y={bodyY + 6 - 6 * sit} width={8} height={20 + 8 * sit} rx={3} fill={fur} stroke={INK} strokeWidth={2} />
      <ellipse cx={0} cy={bodyY} rx={34} ry={17} fill={fur} stroke={INK} strokeWidth={3} transform={`rotate(${-18 * sit} 0 ${bodyY})`} />
      <g transform={`translate(0 ${-10 * sit})`}>
        <circle cx={34} cy={bodyY - 16} r={15} fill={fur} stroke={INK} strokeWidth={3} />
        <path d={`M24 ${bodyY - 26} L27 ${bodyY - 42} L35 ${bodyY - 30} Z M36 ${bodyY - 30} L44 ${bodyY - 42} L46 ${bodyY - 25} Z`} fill={fur} stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
        {scrap > 0.01 ? <rect x={42} y={bodyY - 14} width={22} height={14} rx={1} fill={ID.paper} stroke={INK} strokeWidth={2} transform={`rotate(14 52 ${bodyY - 8})`} opacity={scrap} /> : null}
      </g>
    </g>
  );
};
/** قصاصات ممزقة على الأرض عند المكتبة */
const Scraps: React.FC<{ x: number; glow?: number }> = ({ x, glow = 0 }) => (
  <g>
    {glow > 0.01 ? <Glow cx={x + 40} cy={GROUND - 4} r={110} color={ID.dawn} opacity={0.6 * glow} /> : null}
    {[[0, 0, 12], [34, 6, -20], [70, -2, 30], [18, 12, 50]].map(([dx, dy, r], i) => (
      <rect key={i} x={x + dx!} y={GROUND - 8 + dy!} width={20} height={12} rx={1} fill={ID.paper} stroke={INK} strokeWidth={1.8} transform={`rotate(${r} ${x + dx! + 10} ${GROUND - 2 + dy!})`} />
    ))}
  </g>
);
/** حقيبة سفر: محزومة منتفخة، أو مفتوحة يخرج منها ثوب */
const Bag: React.FC<{ x: number; open?: number }> = ({ x, open = 0 }) => {
  const c = mix(ID.seal, ID.night, 0.45);
  return (
    <g>
      <ellipse cx={x} cy={GROUND + 4} rx={86} ry={8} fill="#000" opacity={0.25} />
      <path d={`M${x - 80} ${GROUND} Q${x - 86} ${GROUND - 70} ${x - 50} ${GROUND - 78} L${x + 50} ${GROUND - 78} Q${x + 86} ${GROUND - 70} ${x + 80} ${GROUND} Z`} fill={c} stroke={INK} strokeWidth={3} />
      <path d={`M${x - 40} ${GROUND - 78} Q${x} ${GROUND - 118} ${x + 40} ${GROUND - 78}`} fill="none" stroke={INK} strokeWidth={5} />
      <line x1={x - 60} y1={GROUND - 74} x2={x + 60} y2={GROUND - 74} stroke={lighten(c, 0.2)} strokeWidth={4} strokeDasharray={open > 0.5 ? "4 10" : undefined} />
      {open > 0.01 ? <path d={`M${x - 40} ${GROUND - 76} q20 ${-30 * open} 44 ${-12 * open} q22 ${-20 * open} 36 ${4 * open}`} fill={mix(ID.paper, ID.copper, 0.2)} stroke={INK} strokeWidth={2.4} /> : null}
    </g>
  );
};
/** ظرف على الخزانة: مفتوح يستقبل النقود، ثم يُغلق */
const Envelope: React.FC<{ x: number; flap: number; glow?: number }> = ({ x, flap, glow = 0 }) => {
  const y = GROUND - 172;
  return (
    <g>
      {glow > 0.01 ? <Glow cx={x + 40} cy={y - 20} r={110} color={ID.dawn} opacity={0.6 * glow} /> : null}
      <rect x={x} y={y - 46} width={84} height={46} fill={ID.paper} stroke={INK} strokeWidth={2.4} />
      <path d={`M${x} ${y - 46} L${x + 42} ${y - 46 + 30 * (2 * flap - 1)} L${x + 84} ${y - 46}`} fill={mix(ID.paper, ID.copper, 0.15)} stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
    </g>
  );
};
/** صحن حلوى زجاجي بغطاء على الخزانة */
const SweetJar: React.FC<{ x: number; lid: number; glow?: number }> = ({ x, lid, glow = 0 }) => {
  const y = GROUND - 172;
  return (
    <g>
      {glow > 0.01 ? <Glow cx={x} cy={y - 40} r={120} color={ID.dawn} opacity={0.55 * glow} /> : null}
      <path d={`M${x - 36} ${y - 70} L${x + 36} ${y - 70} L${x + 30} ${y} L${x - 30} ${y} Z`} fill={mix(ID.paper, ID.night, 0.2)} opacity={0.75} stroke={INK} strokeWidth={2.6} />
      {[[-14, -18, ID.seal], [8, -14, ID.dawn], [-4, -36, mix(ID.seal, ID.paper, 0.4)], [16, -38, ID.copper], [-18, -46, ID.dawn]].map(([dx, dy, c], i) => (
        <circle key={i} cx={x + (dx as number)} cy={y + (dy as number)} r={9} fill={c as string} stroke={INK} strokeWidth={1.6} />
      ))}
      {/* الغطاء: lid=1 مغلق فوق الصحن، lid=0 جانبه على الخزانة */}
      <g transform={`translate(${(1 - lid) * 70} ${(1 - lid) * 64})`}>
        <rect x={x - 40} y={y - 82} width={80} height={12} rx={4} fill={darken(ID.copper, 0.2)} stroke={INK} strokeWidth={2.4} />
        <circle cx={x} cy={y - 88} r={7} fill={darken(ID.copper, 0.2)} stroke={INK} strokeWidth={2} />
      </g>
    </g>
  );
};
/** النافذة المفتوحة: درفة خشبية مدارة إلى الخارج */
const OpenShutter: React.FC<{ glow?: number }> = ({ glow = 0 }) => {
  const x = 1440;
  const y = GROUND - 280;
  return (
    <g>
      {glow > 0.01 ? <Glow cx={x + 80} cy={y - 220} r={200} color={ID.dawn} opacity={0.6 * glow} /> : null}
      <path d={`M${x + 4} ${y - 4} L${x - 70} ${y - 30} L${x - 70} ${y - 360} L${x + 4} ${y - 400} Z`} fill={darken(ID.copper, 0.4)} stroke={INK} strokeWidth={3} />
      <path d={`M${x - 10} ${y - 60} L${x - 58} ${y - 76} M${x - 10} ${y - 200} L${x - 58} ${y - 214} M${x - 10} ${y - 330} L${x - 58} ${y - 344}`} stroke={darken(ID.copper, 0.6)} strokeWidth={4} />
    </g>
  );
};
/** انعكاس البطل في زجاج النافذة ليلًا */
const Reflection: React.FC<{ pose: PoseSpec; frame: number; id: string }> = ({ pose, frame, id }) => {
  const x = 1440;
  const y = GROUND - 280;
  return (
    <g>
      <defs>
        <clipPath id={id}>
          <path d={archPath(x, y, 300, 420)} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`} opacity={0.75}>
        {/* الانعكاس أكبر قليلًا وأعلى (زاوية الزجاج) فيظهر الصدر والكتفان لا الرأس وحده */}
        <Figure x={1640} y={GROUND - 60} scale={1.35} pose={pose} look={hero} flip silhouette={mix(mix(ID.night, ID.paper, 0.32), ID.paper, 0.35)} shadow={false} frame={frame} />
      </g>
    </g>
  );
};
/** الصفحة الممزقة قريبة: سطور بلا نص، حافة ممزقة، وآثار مخالب تضيء */
const PAGE = { x: 5000, y: 540 };
const PageInsert: React.FC<{ paws: number; scrap: number }> = ({ paws, scrap }) => {
  const x0 = PAGE.x - 260;
  const y0 = PAGE.y - 320;
  const torn = `M${x0} ${y0 + 40} L${x0 + 360} ${y0 + 40} L${x0 + 380} ${y0 + 80} L${x0 + 410} ${y0 + 60} L${x0 + 430} ${y0 + 120} L${x0 + 470} ${y0 + 100} L${x0 + 520} ${y0 + 160} L${x0 + 520} ${y0 + 640} L${x0} ${y0 + 640} Z`;
  const paw = (cx: number, cy: number, r: number) => (
    <g transform={`rotate(${r} ${cx} ${cy})`} fill={mix(ID.night, ID.copper, 0.3)}>
      <ellipse cx={cx} cy={cy} rx={20} ry={16} />
      {[-22, -8, 8, 22].map((dx, i) => <ellipse key={i} cx={cx + dx} cy={cy - 22 - (i === 1 || i === 2 ? 6 : 0)} rx={7} ry={9} />)}
    </g>
  );
  return (
    <g>
      <rect x={PAGE.x - 1400} y={PAGE.y - 900} width={2800} height={1800} fill={darken(ID.copper, 0.55)} />
      <Glow cx={PAGE.x} cy={PAGE.y} r={600} color={ID.dawn} opacity={0.25} />
      <path d={torn} fill={ID.paper} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
      {Array.from({ length: 9 }, (_, i) => <line key={i} x1={x0 + 50} y1={y0 + 200 + i * 48} x2={x0 + 470} y2={y0 + 200 + i * 48} stroke={mix(ID.paper, ID.night, 0.25)} strokeWidth={4} />)}
      <g opacity={0.35 + 0.65 * paws}>
        {paw(x0 + 300, y0 + 260, 20)}
        {paw(x0 + 200, y0 + 400, -10)}
        {paw(x0 + 340, y0 + 520, 15)}
      </g>
      {paws > 0.01 ? <Glow cx={x0 + 280} cy={y0 + 400} r={260} color={ID.dawn} opacity={0.35 * paws} /> : null}
      {/* القصاصة من فم القط مضمومة إلى موضعها في الحافة */}
      <path d={`M${x0 + 360} ${y0 + 40} L${x0 + 380} ${y0 + 80} L${x0 + 410} ${y0 + 60} L${x0 + 430} ${y0 + 120} L${x0 + 470} ${y0 + 100} L${x0 + 520} ${y0 + 160} L${x0 + 520} ${y0 + 40} Z`} fill={ID.paper} stroke={INK} strokeWidth={3} transform={`translate(${(1 - scrap) * 140} ${(1 - scrap) * -120})`} opacity={scrap} />
      {/* إبهام يمسك الصفحة */}
      <path d={`M${x0 - 40} ${y0 + 700} L${x0 - 10} ${y0 + 520} Q${x0 + 30} ${y0 + 470} ${x0 + 70} ${y0 + 520} L${x0 + 80} ${y0 + 700} Z`} fill="#D2A782" stroke={INK} strokeWidth={4} />
      <path d={`M${x0 - 140} ${y0 + 900} L${x0 - 60} ${y0 + 600} L${x0 + 120} ${y0 + 640} L${x0 + 120} ${y0 + 900} Z`} fill={mix(ID.night, ID.paper, 0.32)} stroke={INK} strokeWidth={4} />
    </g>
  );
};

// ———————————————————— الزقاق بين البيتين (منظور) ————————————————————
/**
 * زقاق بمنظور نقطة واحدة (التوجيه 022: لا سور حارة جانبي): بابه على الجدار الأيسر القريب، وباب أخيه في صدر الزقاق،
 * وطريق حجارة يتراجع بينهما. d على الطريق: 0 عتبة بابه (أمام الكاميرا)، 1 عتبة باب أخيه.
 */
const VP = { x: 960, y: 470 };
const END = { x0: 700, x1: 1220, top: 210, base: 560 };
const wallFloorL = (x: number) => 1100 - 0.54 * (x + 300);
const wallTopL = (x: number) => -300 + 0.51 * (x + 300);
const BRO_DOOR = { x: 900, w: 120, h: 200 };
/** موضع وحجم الشخص على الطريق عند d */
export const lanePos = (d: number) => ({ x: 330 + (955 - 330) * d, y: 1000 + (568 - 1000) * d, s: 1.75 + (0.62 - 1.75) * d });
const LANE_STONES = Array.from({ length: 14 }, (_, i) => 0.06 + i * 0.066);
const Lane: React.FC<{ frame: number; mood: "dusk" | "dawn"; lit: number; heroDoor: number; brotherDoor: number }> = ({ frame, mood, lit, heroDoor, brotherDoor }) => {
  const dawn = mood === "dawn";
  const wallL = mix(mix(ID.copper, ID.paper, 0.5), ID.night, dawn ? 0.18 : 0.3);
  const wallR = darken(wallL, 0.12);
  const endWall = mix(wallL, ID.dawn, dawn ? 0.18 : 0.05);
  const floor = mix(darken(ID.copper, 0.4), ID.night, dawn ? 0.15 : 0.3);
  const heroDoorPath = (() => {
    const x1 = 70;
    const x2 = 250;
    const h1 = 0.5 * (wallFloorL(x1) - wallTopL(x1));
    const h2 = 0.5 * (wallFloorL(x2) - wallTopL(x2));
    const y1 = wallFloorL(x1);
    const y2 = wallFloorL(x2);
    return `M${x1} ${y1} L${x1} ${y1 - h1} Q${(x1 + x2) / 2} ${(y1 - h1 + y2 - h2) / 2 - 90} ${x2} ${y2 - h2} L${x2} ${y2} Z`;
  })();
  const winL = (xa: number, xb: number, f0: number, f1: number) => {
    const p = (x: number, f: number) => `${x} ${wallFloorL(x) - f * (wallFloorL(x) - wallTopL(x))}`;
    return `M${p(xa, f0)} L${p(xb, f0)} L${p(xb, f1)} L${p(xa, f1)} Z`;
  };
  return (
    <g>
      <Sky mood={mood} frame={frame} />
      {/* الأرض */}
      <path d={`M-300 1100 L${END.x0} ${END.base} L${END.x1} ${END.base} L2220 1100 L2220 1500 L-300 1500 Z`} fill={floor} />
      {/* الجدار الأيسر (بيته) والأيمن (الجار) */}
      <path d={`M-300 -300 L${END.x0} ${END.top} L${END.x0} ${END.base} L-300 1100 Z`} fill={wallL} stroke={INK} strokeWidth={3} />
      <path d={`M2220 -300 L${END.x1} ${END.top} L${END.x1} ${END.base} L2220 1100 Z`} fill={wallR} stroke={INK} strokeWidth={3} />
      {/* صدر الزقاق: بيت أخيه */}
      <rect x={END.x0} y={END.top} width={END.x1 - END.x0} height={END.base - END.top} fill={endWall} stroke={INK} strokeWidth={3} />
      <rect x={END.x0 + 60} y={END.top + 40} width={70} height={60} fill={darken(ID.night, 0.2)} stroke={INK} strokeWidth={2} />
      <rect x={END.x1 - 130} y={END.top + 40} width={70} height={60} fill={darken(ID.night, 0.2)} stroke={INK} strokeWidth={2} />
      {brotherDoor > 0.01 ? <Glow cx={BRO_DOOR.x + BRO_DOOR.w / 2} cy={END.base - 90} r={200} color={ID.dawn} opacity={0.7 * brotherDoor} /> : null}
      <path d={archPath(BRO_DOOR.x - 10, END.base, BRO_DOOR.w + 20, BRO_DOOR.h + 12)} fill={darken(ID.copper, 0.45)} stroke={INK} strokeWidth={2.4} />
      <path d={archPath(BRO_DOOR.x, END.base, BRO_DOOR.w, BRO_DOOR.h)} fill={mix(darken(ID.copper, 0.25), ID.dawn, 0.6 * brotherDoor)} stroke={INK} strokeWidth={2} />
      {/* نوافذ الجدارين بالمنظور، ومصباح جداري وأصيص */}
      <path d={winL(420, 520, 0.62, 0.8)} fill={darken(ID.night, 0.15)} stroke={INK} strokeWidth={2.4} />
      <path d="M1400 300 L1520 262 L1520 420 L1400 442 Z" fill={darken(ID.night, 0.15)} stroke={INK} strokeWidth={2.4} />
      <WallLamp x={620} y={330} frame={frame} on={dawn ? 0.35 : 1} />
      <WallLamp x={1300} y={330} frame={frame} on={dawn ? 0.35 : 1} />
      <g>
        <path d="M1500 900 L1580 900 L1566 980 L1514 980 Z" fill={mix(ID.seal, ID.copper, 0.4)} stroke={INK} strokeWidth={3} />
        <path d="M1540 900 q-40 -80 -70 -60 M1540 900 q10 -100 30 -110 M1540 900 q40 -70 70 -50" fill="none" stroke={mix(ID.night, ID.paper, 0.35)} strokeWidth={8} strokeLinecap="round" />
      </g>
      {/* بابه على الجدار الأيسر القريب */}
      {heroDoor > 0.01 ? <Glow cx={160} cy={wallFloorL(160) - 160} r={260} color={ID.dawn} opacity={0.6 * heroDoor} /> : null}
      <path d={heroDoorPath} fill={mix(mix(ID.night, ID.paper, 0.3), ID.dawn, 0.55 * heroDoor)} stroke={INK} strokeWidth={4} />
      {/* الطريق: حجارة تتصاغر نحو باب أخيه وتضيء بمقدار lit */}
      {LANE_STONES.map((d, i) => {
        const p = lanePos(d);
        const on = prog(lit * LANE_STONES.length, i, i + 1);
        return (
          <g key={i}>
            {on > 0.01 ? <Glow cx={p.x + 40 * p.s} cy={p.y + 6} r={46 * p.s} color={ID.dawn} opacity={0.55 * on} /> : null}
            <ellipse cx={p.x + 40 * p.s} cy={p.y + 6} rx={30 * p.s} ry={9 * p.s} fill={mix(darken(ID.copper, 0.25), ID.dawn, 0.75 * on)} stroke={INK} strokeWidth={1.6} />
          </g>
        );
      })}
    </g>
  );
};
/** يمشي على الطريق بين d0 وd1 بين إطارين، بخطوة تصغر مع العمق */
const LaneWalker: React.FC<{ frame: number; d0: number; d1: number; start: number; end: number; flip?: boolean }> = ({ frame, d0, d1, start, end, flip }) => {
  const t = prog(frame, start, end, (x) => x);
  const d = d0 + (d1 - d0) * t;
  const p = lanePos(d);
  const walking = frame > start && frame < end;
  const pose = walking ? walkPose(POSES.stand, ((frame - start) / 30) * Math.PI * 2) : POSES.stand;
  return <Figure x={p.x} y={p.y} scale={p.s} pose={pose} look={hero} flip={flip} frame={frame} />;
};
const LaneHero: React.FC<{ d: number; pose: PoseSpec; frame: number; flip?: boolean }> = ({ d, pose, frame, flip }) => {
  const p = lanePos(d);
  return <Figure x={p.x} y={p.y} scale={p.s} pose={pose} look={hero} flip={flip} frame={frame} />;
};

export const CH3_SHOTS: Record<string, Ch3Shot> = {
  // ——— أ. الصفحة الممزقة ———
  "home-accuse-brother": {
    nameAr: "غرفة الجلوس: يتهم أخاه بتمزيق دفتره",
    place: "بيت العائلة غروبًا",
    render: ({ frame, at, portrait }) => {
      // البطل بالصفحة الممزقة يشير إلى أخيه عند «اختلفت»، والأخ يفتح كفيه؛ عند «قريب» تتسع اللقطة فتضيء صورهما العائلية
      const tA = at("اختلفت", 0.28);
      const tQ = at("قريب", 0.64);
      return {
        cam: portrait ? [V(0, 750, 1.15, 560), V(tQ - 6, 700, 0.9, 500)] : [K(0, 760, 1.6), K(tQ - 6, 700, 1.15)],
        world: (
          <g>
            <HomeRoom frame={frame} mood="dusk" frames={prog(frame, tQ - 4, tQ + 14)} />
            <Bag x={ROOM.bag} />
            <Scraps x={ROOM.shelf + 60} />
            <Figure x={ROOM.brother} y={GROUND + 8} scale={1.24} pose={tlPose(frame, [[0, POSES.listen], [tA + 6, POSES.talk], [tQ, { ...POSES.talk, head: 14 }]])} look={CH3_CAST.brother} frame={frame + 7} />
            <Figure x={ROOM.hero} y={GROUND + 8} scale={1.2} pose={tlPose(frame, [[0, POSES.hold], [tA - 4, ACCUSE], [tQ + 10, POSES.hold]])} look={hero} flip holding="paper" frame={frame} />
          </g>
        ),
      };
    },
  },
  "home-cat-reveals": {
    nameAr: "غرفة الجلوس: يأخذ من أخيه ثمن الدفتر، ثم يخرج القط وفي فمه قصاصة",
    place: "بيت العائلة غروبًا",
    render: ({ frame, at, portrait }) => {
      // «مقتنعًا»: يعقد ذراعيه. «أخطأ في حقك»: يمد كفه فيضع الأخ فيها نقودًا (ثمن الدفتر). «ظهرت معلومة»: يخرج القط من خلف المكتبة
      // وفي فمه قصاصة من الصفحة نفسها، والقصاصات تحت المكتبة تضيء. «أسأت فهم»: يلتفت البطل إلى القط وتنزل يده.
      const tC = at("مقتنعا", 0.08);
      const tW = at("أخطأ", 0.22);
      const tI = at("ظهرت", 0.42);
      const tU = at("أسأت", 0.72);
      const coins = frame >= tW + 14;
      const catX = 300 + 220 * prog(frame, tI - 4, tI + 34);
      const walking = frame >= tI - 4 && frame < tI + 34;
      return {
        cam: portrait
          ? [V(0, 820, 1.2, 560), V(tW - 6, 760, 1.3, 600), V(tI - 8, 430, 1.2, 640), V(tU - 6, 700, 0.95, 560)]
          : [K(0, 780, 1.6), K(tW - 6, 760, 1.8), K(tI - 8, 520, 1.5), K(tU - 6, 700, 1.3)],
        world: (
          <g>
            <HomeRoom frame={frame} mood="dusk" />
            <Bag x={ROOM.bag} />
            <Scraps x={ROOM.shelf + 60} glow={prog(frame, tI, tI + 16)} />
            {frame >= tI - 4 ? <Cat x={catX} frame={frame} walk={walking} sit={prog(frame, tI + 34, tI + 44)} scrap={1} glow={prog(frame, tI + 4, tI + 20)} /> : null}
            <Figure x={ROOM.brother} y={GROUND + 8} scale={1.24} pose={tlPose(frame, [[0, POSES.talk], [tW, GIVE], [tW + 18, { ...POSES.stand, head: 24 }], [tU + 6, { ...POSES.stand, head: 10 }]])} look={CH3_CAST.brother} holding={frame >= tW && !coins ? "coins" : "none"} frame={frame + 7} />
            <Figure x={ROOM.hero} y={GROUND + 8} scale={1.2} pose={tlPose(frame, [[0, POSES.hold], [tC, POSES.cross], [tW - 6, PALM], [tW + 22, { ...POSES.hold, head: -6 }], [tU, { ...POSES.listen, head: 24 }]])} look={hero} flip holding={coins ? "coins" : frame >= tC && frame < tW - 6 ? "none" : "paper"} frame={frame} />
          </g>
        ),
      };
    },
  },
  "home-brother-leaves": {
    nameAr: "غرفة الجلوس: يخرج الأخ مجروحًا، ويأخذ البطل القصاصة من القط",
    place: "بيت العائلة غروبًا",
    render: ({ frame, at, portrait }) => {
      // الأخ يخرج من الباب في أول المشهد (لم ينتظر الاعتذار)، فيبقى الباب مواربًا مضاءً؛ والبطل يجثو عند القط
      // ويأخذ القصاصة عند «معرفة»: عرف ما حدث.
      const tM = at("معرفة", 0.58);
      const leaving = prog(frame, 4, 60);
      const kneel: PoseSpec = { ...POSES.point, lean: 22, head: 26, armFront: { s: 40, e: 10 }, ...KNEEL };
      const heroX = 640;
      const hand = handAt(kneel, { x: heroX, y: GROUND + 8, scale: 1.2, flip: true });
      const took = prog(frame, tM - 6, tM + 6);
      return {
        cam: portrait ? [V(0, 420, 1.0, 560), V(40, 150, 1.0, 560), V(tM - 10, 560, 1.5, 660)] : [K(0, 380, 1.3), K(tM - 10, 560, 2.0)],
        world: (
          <g>
            <HomeRoom frame={frame} mood="dusk" door={0.55 * prog(frame, 40, 70)} />
            <Bag x={ROOM.bag} />
            <Scraps x={ROOM.shelf + 60} glow={0.4} />
            <Cat x={520} frame={frame} sit={1} scrap={1 - took} />
            {leaving < 1 ? <Walker frame={frame} from={ROOM.brother} to={-120} y={GROUND + 8} start={4} end={60} look={CH3_CAST.brother} scale={1.24} /> : null}
            <Figure x={heroX} y={GROUND + 8} scale={1.2} pose={tlPose(frame, [[0, POSES.listen], [tM - 24, kneel]])} look={hero} flip holding="paper" frame={frame} />
            {took > 0.01 ? <rect x={hand.x - 30} y={hand.y - 18} width={22} height={14} fill={ID.paper} stroke={INK} strokeWidth={2} opacity={took} /> : null}
            <Glow cx={hand.x} cy={hand.y} r={70} color={ID.dawn} opacity={0.5 * took} />
          </g>
        ),
      };
    },
  },
  "home-standpoint": {
    nameAr: "غرفة الجلوس: يقف بين الباب والنافذة والصفحة في يده",
    place: "بيت العائلة غروبًا",
    render: ({ frame, at, portrait }) => {
      // اللقطة العريضة: الباب المضاء يسارًا والنافذة يمينًا وهو في الوسط؛ عند «عرفت» ينظر إلى الباب
      const tK = at("عرفت", 0.6);
      return {
        cam: portrait ? [V(0, 700, 0.9, 540), V(tK - 6, 420, 1.1, 560)] : [K(0, 820, 1.0), K(tK - 6, 560, 1.35)],
        world: (
          <g>
            <HomeRoom frame={frame} mood="dusk" door={0.55} />
            <Bag x={ROOM.bag} />
            <Cat x={520} frame={frame} sit={1} />
            <Figure x={700} y={GROUND + 8} scale={1.2} pose={tlPose(frame, [[0, { ...POSES.hold, head: 22 }], [tK, { ...POSES.hold, head: 4 }]])} look={hero} flip={frame >= tK} holding="paper" frame={frame} />
          </g>
        ),
      };
    },
  },
  "home-door-step": {
    nameAr: "غرفة الجلوس: «هل تعتذر؟» يخطو نحو الباب المضاء ثم يقف",
    place: "بيت العائلة غروبًا",
    render: ({ frame, at, portrait }) => {
      const tA = at("تعتذر", 0.2);
      const walkEnd = tA + 50;
      return {
        cam: portrait ? [V(0, 420, 1.1, 560)] : [K(0, 420, 1.4), K(walkEnd, 330, 1.6)],
        world: (
          <g>
            <HomeRoom frame={frame} mood="dusk" door={0.55 + 0.4 * prog(frame, tA - 4, tA + 16)} />
            <Bag x={ROOM.bag} />
            <Cat x={520} frame={frame} sit={1} />
            {frame < tA || frame >= walkEnd ? (
              <Figure x={frame < tA ? 700 : 420} y={GROUND + 8} scale={1.2} pose={frame < tA ? POSES.hold : { ...POSES.hold, head: 26 }} look={hero} flip holding="paper" frame={frame} />
            ) : (
              <Walker frame={frame} from={700} to={420} y={GROUND + 8} start={tA} end={walkEnd} look={hero} scale={1.2} holding="paper" />
            )}
          </g>
        ),
      };
    },
  },
  "page-paw-insert": {
    nameAr: "الصفحة الممزقة قريبة: آثار مخالب القط كانت عليها",
    place: "بيت العائلة: الصفحة في يده",
    render: ({ frame, at, portrait }) => {
      // لقطة قريبة (منطقة مستقلة): القصاصة تنضم إلى موضعها، وعند «حكمك» تضيء آثار المخالب (الدليل كان في يده)،
      // وعند «متعجلًا» قطع إلى البطل يخفض رأسه.
      const tH = at("حكمك", 0.4);
      const tJ = at("متعجلا", 0.65);
      return {
        cam: portrait ? [V(0, PAGE.x, 0.85, PAGE.y), V(tJ - 2, 420, 1.4, 600, true)] : [V(0, PAGE.x, 1.4, PAGE.y), V(tJ - 2, 420, 1.8, 560, true)],
        world: (
          <g>
            <HomeRoom frame={frame} mood="dusk" door={0.6} />
            <Bag x={ROOM.bag} />
            <Figure x={420} y={GROUND + 8} scale={1.2} pose={{ ...POSES.hold, head: 34, lean: 6 }} look={hero} flip holding="paper" frame={frame} />
            <PageInsert paws={prog(frame, tH - 4, tH + 12)} scrap={prog(frame, 4, 24)} />
          </g>
        ),
      };
    },
  },
  "home-window-excuse": {
    nameAr: "عند النافذة المفتوحة: يبحث عن تفسير يحفظ موقفه",
    place: "بيت العائلة غروبًا",
    render: ({ frame, at, portrait }) => {
      // يشير إلى الدرفة المفتوحة عند «تفسير» (لو أغلقها أخوه ما دخل القط)، ويلتفت إلى الغرفة راضيًا عند «يحفظ»،
      // ويعقد ذراعيه عند «السابق».
      const tE = at("تفسير", 0.25);
      const tK = at("يحفظ", 0.46);
      const tP = at("السابق", 0.74);
      const POINT_UP: PoseSpec = { ...POSES.point, head: -14, armFront: { s: 120, e: 8 } };
      return {
        cam: portrait ? [V(0, 1420, 1.1, 520), V(tK - 6, 1330, 1.1, 560)] : [K(0, 1400, 1.6, -40), K(tK - 6, 1300, 1.35)],
        world: (
          <g>
            <HomeRoom frame={frame} mood="dusk" door={0.4} />
            <OpenShutter glow={prog(frame, tE - 4, tE + 12) * (1 - 0.5 * prog(frame, tK, tK + 20))} />
            <Figure x={1300} y={GROUND + 8} scale={1.2} pose={tlPose(frame, [[0, POSES.listen], [tE - 6, POINT_UP], [tK, POSES.nod], [tP, { ...POSES.cross, head: -8 }]])} look={hero} flip={frame >= tK} frame={frame} />
          </g>
        ),
      };
    },
  },
  "home-turns-from-evidence": {
    nameAr: "غرفة الجلوس: الأدلة حاضرة، ويعرض عنها لأن قبولها يفرض عليه الذهاب",
    place: "بيت العائلة غروبًا",
    render: ({ frame, at, portrait }) => {
      // يعطي ظهره للمكتبة والقط والقصاصات منذ «نرفض»؛ الكاميرا تمر على الأدلة مضاءة عند «أدلتها» (ليست غائبة)؛
      // عند «يفرض» يشتد ضوء الباب (ما يفرضه القبول: الذهاب إلى أخيه)، يلتفت إليه ثم يبتعد عند «نريده».
      const tE = at("أدلتها", 0.33);
      const tF = at("يفرض", 0.65);
      const tN = at("نريده", 0.87);
      const evidence = prog(frame, tE - 6, tE + 12);
      const glance = frame >= tF + 6 && frame < tN - 4;
      const heroX = 1080 + 140 * prog(frame, tN - 4, tN + 22);
      return {
        cam: portrait
          ? [V(0, 1100, 1.2, 560), V(tE - 8, 480, 1.25, 660), V(tF - 6, 150, 1.0, 560), V(tF + 10, 1120, 1.2, 560)]
          : [K(0, 1080, 1.5), K(tE - 8, 480, 1.6), K(tF - 6, 650, 0.95), K(tN - 4, 1150, 1.5)],
        world: (
          <g>
            <HomeRoom frame={frame} mood="dusk" door={0.4 + 0.55 * prog(frame, tF - 4, tF + 12)} />
            <Bag x={ROOM.bag} />
            <Scraps x={ROOM.shelf + 60} glow={evidence} />
            <Cat x={520} frame={frame} sit={1} glow={evidence} />
            <Figure x={heroX} y={GROUND + 8} scale={1.2} pose={glance ? { ...POSES.cross, head: 10 } : { ...POSES.cross, head: -6 }} look={hero} flip={glance} frame={frame} />
          </g>
        ),
      };
    },
  },

  // ——— ب. ثمن الاعتراف ———
  "lane-knock-hesitates": {
    nameAr: "الزقاق غروبًا: عند باب أخيه في صدر الزقاق، يده مرفوعة ولا تطرق",
    place: "الزقاق بين البيتين غروبًا",
    render: ({ frame, at, portrait }) => {
      const tR = at("يتطلب", 0.45);
      const tA = at("اعتذارا", 0.58);
      return {
        cam: portrait ? [V(0, 950, 1.3, 480), V(tR - 6, 950, 1.7, 470)] : [V(0, 940, 1.8, 470), V(tR - 6, 945, 2.4, 470)],
        world: (
          <g>
            <Lane frame={frame} mood="dusk" lit={0} heroDoor={0} brotherDoor={0.2} />
            <LaneHero d={0.92} pose={tlPose(frame, [[0, { ...POSES.stand, head: 8 }], [tR - 8, KNOCK], [tA, { ...KNOCK, head: 10 }]])} frame={frame} />
          </g>
        ),
      };
    },
  },
  "home-unpack-bag": {
    nameAr: "غرفة الجلوس: يفك الحقيبة التي حزمها ليترك البيت",
    place: "بيت العائلة غروبًا",
    render: ({ frame, at, portrait }) => {
      const tC = at("تغيير", 0.32);
      const tQ = at("قرار", 0.5);
      const reachP: PoseSpec = { ...POSES.point, lean: 18, head: 30, armFront: { s: 20, e: 8 }, ...KNEEL };
      return {
        cam: portrait ? [V(0, 230, 1.5, 680), V(tQ - 6, 220, 1.6, 700)] : [K(0, 240, 2.0, 40), K(tQ - 6, 220, 2.15, 50)],
        world: (
          <g>
            <HomeRoom frame={frame} mood="dusk" door={0.4} />
            <Bag x={ROOM.bag} open={prog(frame, tC - 4, tQ + 6)} />
            <Figure x={270} y={GROUND + 8} scale={1.2} pose={tlPose(frame, [[0, { ...POSES.stand, head: 24 }], [10, reachP], [tQ + 4, { ...reachP, armFront: { s: 60, e: 30 } }]])} look={hero} flip frame={frame} />
          </g>
        ),
      };
    },
  },
  "home-coins-returned": {
    nameAr: "عند الخزانة: يعيد النقود إلى ظرف أخيه ويغلقه",
    place: "بيت العائلة غروبًا",
    render: ({ frame, at, portrait }) => {
      const tG = at("التخلي", 0.32);
      const tM = at("مصلحة", 0.58);
      const P: PoseSpec = { ...POSES.point, lean: 10, head: 24, armFront: { s: 70, e: 26 } };
      const hand = handAt(P, { x: 1110, y: GROUND + 8, scale: 1.2 });
      const drop = prog(frame, tG, tG + 12);
      return {
        cam: portrait ? [V(0, 1160, 1.5, 600), V(tG - 6, 1180, 1.6, 610)] : [K(0, 1160, 2.0, -20), K(tG - 6, 1180, 2.15, -10)],
        world: (
          <g>
            <HomeRoom frame={frame} mood="dusk" door={0.4} />
            <Envelope x={ROOM.envelope} flap={1 - prog(frame, tM - 4, tM + 10)} glow={prog(frame, tG, tG + 10) * (1 - prog(frame, tM + 10, tM + 30))} />
            {drop > 0 && drop < 1 ? <circle cx={hand.x + (ROOM.envelope + 42 - hand.x) * drop} cy={hand.y + (GROUND - 200 - hand.y) * drop} r={9} fill={ID.copper} stroke={INK} strokeWidth={2} /> : null}
            <Figure x={1110} y={GROUND + 8} scale={1.2} pose={tlPose(frame, [[0, POSES.hold], [tG - 12, P], [tM + 6, { ...POSES.stand, head: 18 }]])} look={hero} holding={frame < tG ? "coins" : "none"} frame={frame} />
          </g>
        ),
      };
    },
  },
  "night-window-reflection": {
    nameAr: "الغرفة ليلًا: أمام انعكاسه في زجاج النافذة يقول لنفسه: لقد أخطأت",
    place: "بيت العائلة ليلًا",
    render: ({ frame, at, portrait }) => {
      const tS = at("لنفسه", 0.55);
      const tW = at("لقد", 0.7);
      const pose = tlPose(frame, [[0, { ...POSES.stand, head: 22 }], [tS - 6, { ...POSES.stand, head: 0 }], [tW, POSES.apologize]]);
      return {
        captionBackdrop: 0.3,
        cam: portrait ? [V(0, 1520, 1.4, 470), V(tW - 6, 1520, 1.55, 460)] : [V(0, 1540, 1.8, 470), V(tW - 6, 1550, 2.0, 460)],
        world: (
          <g>
            <HomeRoom frame={frame} mood="night" />
            <Reflection pose={pose} frame={frame} id="c3s12-refl" />
            <Figure x={1390} y={GROUND + 8} scale={1.2} pose={pose} look={hero} frame={frame} rim={0.4} rimColor={ID.paper} />
          </g>
        ),
      };
    },
  },
  "night-window-still": {
    nameAr: "الغرفة ليلًا ساكنة: البطل وانعكاسه (سكون الآية)",
    place: "بيت العائلة ليلًا",
    // سكون مقصود (القاعدة الثانية): لا حدث ولا حركة كاميرا، والعالم مجمَّد عند إطار واحد
    render: ({ portrait }) => ({
      captionBackdrop: 0.3,
      cam: portrait ? [V(0, 1520, 1.5, 465)] : [V(0, 1550, 1.9, 465)],
      world: (
        <g>
          <HomeRoom frame={0} mood="night" />
          <Reflection pose={{ ...POSES.stand, head: 20 }} frame={0} id="c3-still-refl" />
          <Figure x={1390} y={GROUND + 8} scale={1.2} pose={{ ...POSES.stand, head: 20 }} look={hero} frame={0} rim={0.4} rimColor={ID.paper} />
        </g>
      ),
    }),
  },

  // ——— د. الطريق إلى الباب ———
  "lane-two-doors": {
    nameAr: "الزقاق فجرًا: بابه قريب وباب أخيه في صدر الزقاق (التفريق بين أمرين)",
    place: "الزقاق بين البيتين فجرًا",
    render: ({ frame, at, portrait }) => {
      const tT = at("التفريق", 0.42);
      const tA = at("أمرين", 0.72);
      const open = prog(frame, 4, 20);
      const out = prog(frame, 14, 34);
      return {
        cam: portrait ? [V(0, 300, 1.0, 640), V(tT - 6, 960, 1.25, 470), V(tA, 640, 0.75, 600)] : [V(0, 960, 1.0, 540), V(tA, 940, 1.05, 540)],
        world: (
          <g>
            <Lane frame={frame} mood="dawn" lit={0} heroDoor={0.6 * open} brotherDoor={0.6 * prog(frame, tT - 4, tT + 12)} />
            {out > 0.01 ? <g opacity={Math.min(1, out * 2)}><LaneHero d={0} pose={{ ...POSES.stand, head: -4 }} frame={frame} /></g> : null}
          </g>
        ),
      };
    },
  },
  "lane-path-lights": {
    nameAr: "الزقاق فجرًا: يضيء الطريق حجرًا حجرًا إلى باب أخيه (أن نعرف الحق)",
    place: "الزقاق بين البيتين فجرًا",
    render: ({ frame, at, portrait }) => {
      const tK = at("نعرف", 0.15);
      const tH = at("الحق", 0.35);
      const lit = prog(frame, tK - 4, tH + 30, (t) => t);
      return {
        cam: portrait ? [V(0, 420, 1.0, 760), V(tK + 10, 640, 1.0, 680), V(tK + 30, 860, 1.0, 560), V(tK + 50, 950, 1.1, 480)] : [V(0, 960, 1.0, 540), V(tH + 20, 940, 1.1, 520)],
        world: (
          <g>
            <Lane frame={frame} mood="dawn" lit={lit} heroDoor={0.6} brotherDoor={0.6} />
            <LaneHero d={0} pose={{ ...POSES.stand, head: -6 }} frame={frame} />
          </g>
        ),
      };
    },
  },
  "lane-first-step": {
    nameAr: "الزقاق فجرًا: يخطو من عتبته إلى أول حجر (مستعد للعمل)",
    place: "الزقاق بين البيتين فجرًا",
    render: ({ frame, at, portrait }) => {
      const tR = at("مستعدين", 0.3);
      const tW = at("للعمل", 0.55);
      return {
        cam: portrait ? [V(0, 420, 1.2, 800), V(tW - 6, 440, 1.3, 790)] : [V(0, 470, 1.6, 800), V(tW - 6, 490, 1.7, 790)],
        world: (
          <g>
            <Lane frame={frame} mood="dawn" lit={1} heroDoor={0.6} brotherDoor={0.6} />
            {frame < tR || frame >= tR + 22 ? (
              <LaneHero d={frame < tR ? 0 : 0.1} pose={frame >= tW ? { ...POSES.stand, lean: 6, head: -2 } : POSES.stand} frame={frame} />
            ) : (
              <LaneWalker frame={frame} d0={0} d1={0.1} start={tR} end={tR + 22} />
            )}
          </g>
        ),
      };
    },
  },
  "lane-standing-still": {
    nameAr: "الزقاق فجرًا: الطريق مضيء كله وهو واقف على أول حجر",
    place: "الزقاق بين البيتين فجرًا",
    render: ({ frame, portrait }) => ({
      // المعرفة وحدها: لا يتحرك، والكاميرا تبتعد فيظهر طول الطريق المضيء أمامه إلى باب أخيه
      cam: portrait ? [V(0, 420, 1.2, 800), V(30, 700, 0.75, 640)] : [V(0, 470, 1.6, 800), V(30, 960, 1.0, 540)],
      world: (
        <g>
          <Lane frame={frame} mood="dawn" lit={1} heroDoor={0.6} brotherDoor={0.7} />
          <LaneHero d={0.1} pose={{ ...POSES.stand, lean: 6, head: -2 }} frame={frame} />
        </g>
      ),
    }),
  },
  "lane-pride-turns": {
    nameAr: "الزقاق فجرًا: يمشي نصف الطريق إلى باب أخيه ثم يرفع رأسه ويعود (الكبر)",
    place: "الزقاق بين البيتين فجرًا",
    render: ({ frame, at, portrait }) => {
      const tK = at("يعرف", 0.08);
      const tD = at("واجب", 0.5);
      const tS = at("يمنعه", 0.72);
      const tP = at("الكبر", 0.82);
      const walking = frame >= tK && frame < tD - 6;
      return {
        cam: portrait ? [V(0, 560, 1.0, 760), V(tD - 10, 760, 1.1, 640), V(tS - 6, 700, 1.4, 680)] : [V(0, 760, 1.15, 640), V(tD - 10, 860, 1.25, 600), V(tS - 6, 760, 1.6, 660)],
        world: (
          <g>
            <Lane frame={frame} mood="dawn" lit={1} heroDoor={0.6} brotherDoor={0.6 + 0.35 * prog(frame, tD - 4, tD + 12)} />
            {walking ? (
              <LaneWalker frame={frame} d0={0.1} d1={0.5} start={tK} end={tD - 6} />
            ) : (
              <LaneHero d={frame < tK ? 0.1 : 0.5} pose={tlPose(frame, [[0, POSES.stand], [tD - 6, { ...POSES.stand, head: -6 }], [tS, PROUD_BACK]])} frame={frame} flip={frame >= tP} />
            )}
          </g>
        ),
      };
    },
  },
  "night-sweets-habit": {
    nameAr: "الغرفة ليلًا: يغلق صحن الحلوى ويبعده، ثم يعود إليه",
    place: "بيت العائلة ليلًا",
    render: ({ frame, at, portrait }) => {
      // «ترك»: يضع الغطاء ويدفع الصحن بعيدًا؛ «عادة سيئة»: يلتفت عنه؛ «تغلبه»: يلتفت إليه؛ «شهوته»: يرفع الغطاء ويأخذ حبة
      const tL = at("ترك", 0.34);
      const tH = at("عادة", 0.42);
      const tO = at("تغلبه", 0.67);
      const tS = at("شهوته", 0.79);
      const lid = prog(frame, tL - 8, tL + 2) * (1 - prog(frame, tS - 4, tS + 6));
      const jarX = ROOM.jar + 90 * prog(frame, tL + 2, tL + 14);
      const reach: PoseSpec = { ...POSES.point, lean: 8, head: 22, armFront: { s: 80, e: 30 } };
      const away = frame >= tH && frame < tO;
      const heroPose = tlPose(frame, [[0, { ...POSES.stand, head: 18 }], [tL - 12, reach], [tH, { ...POSES.stand, head: 6 }], [tO, { ...POSES.stand, head: 16 }], [tS - 8, reach], [tS + 10, POSES.hold]]);
      const hand = handAt(heroPose, { x: 1060, y: GROUND + 8, scale: 1.2, flip: away });
      return {
        cam: portrait ? [V(0, 1180, 1.4, 600), V(tO - 4, 1190, 1.5, 610)] : [K(0, 1170, 1.8, -20), K(tO - 4, 1190, 1.95, -10)],
        world: (
          <g>
            <HomeRoom frame={frame} mood="night" />
            <SweetJar x={jarX} lid={lid} glow={prog(frame, tO - 6, tO + 10)} />
            <Figure x={1060} y={GROUND + 8} scale={1.2} pose={heroPose} look={hero} flip={away} frame={frame} />
            {/* الحبة في يده بعد «شهوته» */}
            {frame >= tS + 4 ? <circle cx={hand.x + 4} cy={hand.y - 6} r={9} fill={ID.seal} stroke={INK} strokeWidth={1.8} /> : null}
          </g>
        ),
      };
    },
  },
  "lane-dawn-still": {
    nameAr: "الزقاق فجرًا ساكنًا: الطريق مضيء من بابه إلى باب أخيه (سكون الدعاء)",
    place: "الزقاق بين البيتين فجرًا",
    // ذكر الهداية والدعاء: لا حدث ولا حركة كاميرا، والعالم مجمَّد
    render: ({ portrait }) => ({
      cam: portrait ? [V(0, 640, 0.75, 620)] : [V(0, 960, 1.0, 540)],
      world: (
        <g>
          <Lane frame={0} mood="dawn" lit={1} heroDoor={0.6} brotherDoor={0.7} />
          <LaneHero d={0} pose={{ ...POSES.stand, head: -2 }} frame={0} />
        </g>
      ),
    }),
  },
};
