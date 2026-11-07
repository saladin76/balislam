import React from "react";
import { ID, darken, mix } from "../palette";
import { Figure, LOOKS, POSES, blendPose, handAt, walkPose, type FigureLook, type PoseSpec } from "../Figure";
import { Bench, GROUND, Glow } from "../world";
import { Courtyard, Rooftops } from "./outdoor";
import { SouqStreet, FruitCart } from "./street";
import { Workshop } from "./interior";
import { COUNTER_TOP, StandardWeight } from "./scale";
import { CH2_CAST, ShinyWeight, StallSet, ValueScale, oranges, settle } from "./ch2";
import { CoinsGlyph, GIVE, KNEEL, reachTo, tlPose } from "./ch3";
import { Birds, K, Walker, prog, pz, type CamKey, type ShotCtx } from "./kit";

/**
 * الحلقة 001 · الفصل 5 «اللهم أرنا الأشياء كما هي». التخطيط في storyboard/ch5-plan.md (التوجيه 024).
 * ست وحدات في أربعة أماكن وبشخوص مختلفة، لا غرفة واحدة ولا بطل وحيد:
 * أ. الدعاء (c5-s1، c5-s3): صحن الدار ليلًا، شيخ عند النافورة؛ c5-s3 ساكن (ذكر الله).
 * ب. المال (c5-s4 → c5-s6): السوق. نقود في كف مشترٍ (جسر بصري من ظرف c4-s18)، نعمة ووسيلة وباب للخير، ثم رجل
 *    يزن صرّته في الميزان ويعرض عن صبي (المال مقياسًا للقيمة).
 * ج. النجاح (c5-s7، c5-s8): الورشة. نجار يتم كرسيه، ثم يعرض عن ملاحظة صبيه.
 * د. الدنيا (c5-s9 → c5-s11): الأسطح. المدينة كلها، ثم بنّاء يبني ويخطط والشمس تغيب ولا يرفع رأسه؛ c5-s11 ساكن.
 * هـ. موضعها الصحيح (c5-s13 → c5-s15): السطح نفسه صباحًا. يعمل، ويصعد ابنه بطبق، فيضع أدواته في موضعها ويجلس معه.
 * و. النظر إلى النفس وإلى الآخرين (c5-s16 → c5-s20): البطل في السوق: صورته في صينية نحاس، قوته دون غرور، خطؤه دون يأس،
 *    إنصاف صديقه وخصمه عند الميزان؛ ثم الميزان يستوي («بميزان العدل»)، ويمضي إلى الحارة (جسر إلى الفصل 6).
 * العناصر الجديدة (للمراجعة، داخل لقطات الفصل وحدها): صرّة النقود، جدار الطوب ومخطط البناء، طبق الطعام، صندوق الأدوات،
 * صينية النحاس العاكسة، صندوق البرتقال المحمول.
 */

const INK = darken(ID.night, 0.55);
const hero = LOOKS.hero as FigureLook;
type Ch5Shot = { nameAr: string; place: string; render: (c: ShotCtx) => { cam: CamKey[]; world: React.ReactNode; captionBackdrop?: number } };
const V = (t: number, x: number, z: number, y: number, cut = false): CamKey => ({ t, x, y, z, ...(cut ? { cut } : {}) });
const CAST = {
  elder: LOOKS.elder as FigureLook,
  listener: LOOKS.boy as FigureLook,
  buyer: LOOKS.stranger as FigureLook,
  cartVendor: LOOKS.vendor as FigureLook,
  needy: { outfit: "thobe", cloth: "sand", head: "kufi", skin: 1, hair: "#B9B2A6" } as FigureLook,
  rich: CH2_CAST.proud,
  boy: LOOKS.boy as FigureLook,
  carpenter: CH2_CAST.modest,
  apprentice: CH2_CAST.young,
  builder: CH2_CAST.worker,
  son: LOOKS.boy as FigureLook,
  friend: LOOKS.friend as FigureLook,
  rival: CH2_CAST.harsh,
  customer: LOOKS.womanSand as FigureLook,
};

// ———————————————————— عناصر جديدة (للمراجعة) ————————————————————

/** صرّة نقود من قماش مربوطة */
const Purse: React.FC<{ x: number; y: number; s?: number }> = ({ x, y, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M-24 0 Q-30 -26 -12 -38 L-6 -46 L6 -46 L12 -38 Q30 -26 24 0 Z" fill={mix(ID.seal, ID.copper, 0.45)} stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
    <path d="M-10 -40 L10 -40" stroke={ID.dawn} strokeWidth={4} strokeLinecap="round" />
  </g>
);
/** جدار طوب يُبنى صفًا بعد صف: n عدد الطوبات الموضوعة */
const BRICK = { w: 64, h: 26, per: 6 };
const brickAt = (x0: number, i: number) => {
  const row = Math.floor(i / BRICK.per);
  const col = i % BRICK.per;
  return { x: x0 + col * BRICK.w + (row % 2 ? BRICK.w / 2 : 0), y: GROUND - (row + 1) * BRICK.h };
};
const BrickWall: React.FC<{ x0: number; n: number }> = ({ x0, n }) => (
  <g>
    {Array.from({ length: Math.floor(n) }, (_, i) => {
      const b = brickAt(x0, i);
      return <rect key={i} x={b.x} y={b.y} width={BRICK.w - 3} height={BRICK.h - 3} fill={mix(ID.seal, ID.copper, 0.55)} stroke={INK} strokeWidth={2} />;
    })}
    {/* أعمدة الطابق المخطط: حدود ما سيُبنى بعد */}
    <path d={`M${x0 - 10} ${GROUND} L${x0 - 10} ${GROUND - 300} M${x0 + BRICK.per * BRICK.w + 40} ${GROUND} L${x0 + BRICK.per * BRICK.w + 40} ${GROUND - 300}`} stroke={darken(ID.copper, 0.35)} strokeWidth={10} />
  </g>
);
/** مخطط بناء مفروش على صندوق: u مقدار الفرش، extra خطوط الطابق المضاف */
const PlanSheet: React.FC<{ x: number; y: number; u: number; extra: number }> = ({ x, y, u, extra }) => {
  const w = 40 + 170 * u;
  return (
    <g>
      <rect x={x} y={y - 8} width={w} height={70} fill={mix(ID.paper, "#9DB7C8", 0.25)} stroke={INK} strokeWidth={2.2} transform={`skewX(-18)`} />
      {u > 0.6 ? (
        <g stroke={darken("#3E6C8C", 0.1)} strokeWidth={2.4} fill="none" transform={`skewX(-18)`}>
          <rect x={x + 40} y={y + 30} width={80} height={24} />
          <rect x={x + 40} y={y + 6} width={80} height={24} opacity={Math.min(1, extra * 2)} />
          <rect x={x + 130} y={y + 30} width={60} height={24} opacity={Math.min(1, Math.max(0, extra * 2 - 1))} />
        </g>
      ) : null}
      <rect x={x - 30} y={y + 62} width={260} height={60} fill={darken(ID.copper, 0.45)} stroke={INK} strokeWidth={2.4} />
    </g>
  );
};
/** طبق طعام: تمر وكأسا شاي */
const FoodTray: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g>
    <ellipse cx={x} cy={y} rx={70} ry={14} fill={mix(ID.copper, ID.dawn, 0.3)} stroke={INK} strokeWidth={2.6} />
    {[-30, -14, 2].map((dx, i) => <ellipse key={i} cx={x + dx} cy={y - 8} rx={8} ry={6} fill={darken(ID.seal, 0.35)} stroke={INK} strokeWidth={1.4} />)}
    {[26, 46].map((dx, i) => <path key={i} d={`M${x + dx - 7} ${y - 26} L${x + dx + 7} ${y - 26} L${x + dx + 5} ${y - 6} L${x + dx - 5} ${y - 6} Z`} fill={mix(ID.seal, ID.dawn, 0.4)} stroke={INK} strokeWidth={1.6} opacity={0.9} />)}
  </g>
);
/** صندوق الأدوات؛ lid من 0 مفتوح إلى 1 مغلق */
const ToolBox: React.FC<{ x: number; lid: number; trowel: boolean }> = ({ x, lid, trowel }) => (
  <g>
    {trowel ? <path d={`M${x + 20} ${GROUND - 58} l22 -26 l14 8 l-16 24 z`} fill={mix(ID.paper, ID.night, 0.35)} stroke={INK} strokeWidth={2} /> : null}
    <rect x={x - 50} y={GROUND - 54} width={100} height={54} fill={mix(ID.seal, ID.night, 0.35)} stroke={INK} strokeWidth={2.6} />
    <rect x={x - 54} y={GROUND - 62} width={108} height={10} fill={mix(ID.seal, ID.night, 0.25)} stroke={INK} strokeWidth={2.4} transform={`rotate(${-70 * (1 - lid)} ${x - 54} ${GROUND - 57})`} />
  </g>
);
/** المِسطرين في اليد */
const Trowel: React.FC<{ x: number; y: number }> = ({ x, y }) => <path d={`M${x} ${y} l20 -6 l6 16 l-22 4 z M${x} ${y} l-14 -12`} fill={mix(ID.paper, ID.night, 0.35)} stroke={INK} strokeWidth={2.2} />;
/** صندوق برتقال محمول */
const FruitBox: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g>
    {[-30, -4, 22].map((dx, i) => <circle key={i} cx={x + dx} cy={y - 44} r={13} fill={mix(ID.dawn, ID.seal, 0.3)} stroke={INK} strokeWidth={2} />)}
    <rect x={x - 50} y={y - 40} width={100} height={42} fill={mix(darken(ID.copper, 0.42), ID.copper, 0.35)} stroke={INK} strokeWidth={2.6} />
    <path d={`M${x - 50} ${y - 20} L${x + 50} ${y - 20}`} stroke={INK} strokeWidth={2} opacity={0.6} />
  </g>
);
/** صينية نحاس مصقولة معلقة عند دكان: تعكس من يقف أمامها (reflect) */
const TRAY = { x: 1180, y: GROUND - 420, r: 92 };
const CopperTray: React.FC<{ reflect: React.ReactNode; shine: number }> = ({ reflect, shine }) => (
  <g>
    <defs>
      <clipPath id="ch5-tray">
        <circle cx={TRAY.x} cy={TRAY.y} r={TRAY.r - 10} />
      </clipPath>
    </defs>
    <line x1={TRAY.x} y1={TRAY.y - TRAY.r - 40} x2={TRAY.x} y2={TRAY.y - TRAY.r} stroke={INK} strokeWidth={3} />
    <circle cx={TRAY.x} cy={TRAY.y} r={TRAY.r} fill={mix(ID.copper, ID.dawn, 0.35)} stroke={INK} strokeWidth={3.4} />
    <circle cx={TRAY.x} cy={TRAY.y} r={TRAY.r - 10} fill={mix(ID.copper, ID.paper, 0.4)} />
    <g clipPath="url(#ch5-tray)" opacity={0.75}>
      {reflect}
    </g>
    <path d={`M${TRAY.x - 60} ${TRAY.y - 40} q30 -30 70 -36`} stroke={ID.paper} strokeWidth={6} fill="none" opacity={0.35 + 0.4 * shine} strokeLinecap="round" />
  </g>
);

// مواضع ثابتة
const CART_X = 700;
const STALL = { vendor: 1262, scale: 1020 };
const ROOF = { wall: 1180, crate: 820, box: 640, bench: 380 };

export const CH5_SHOTS: Record<string, Ch5Shot> = {
  // ——— أ. الدعاء ———
  "court-saying": {
    nameAr: "صحن الدار ليلًا: شيخ على مصطبة عند النافورة يخفض رأسه، ثم يظهر من في الصحن",
    place: "صحن دار بنافورة ليلًا",
    render: ({ frame, at, portrait }) => {
      // «من الكلمات»: تتقدم الكاميرا إلى الشيخ؛ «يدعو»: يخفض رأسه بهدوء (لا يدان مرفوعتان ولا رمز)؛
      // «بعض الناس»: تبتعد فيظهر آخران في الصحن: «بعض» الناس لا كلهم
      const tK = at("الكلمات", 0.1);
      const tD = at("يدعو", 0.43);
      const tN = at("الناس", 0.73);
      const head = 6 + 18 * prog(frame, tD, tD + 18);
      return {
        cam: portrait ? [K(0, 640, 0.95), K(tK, 600, 1.35), K(tN, 900, 0.62)] : [K(0, 960, 1.05), K(tK, 640, 1.6), K(tN, 960, 0.95)],
        world: (
          <g>
            <Courtyard frame={frame} />
            <Bench x={460} w={230} mood="night" />
            <Bench x={1290} w={230} mood="night" />
            <Figure x={590} y={GROUND} scale={1.1} pose={{ ...POSES.sit, head }} look={CAST.elder} frame={frame} />
            <Figure x={1420} y={GROUND} scale={1.02} pose={{ ...POSES.sit, head: 12 }} look={CAST.listener} flip frame={frame + 7} />
            <Figure x={1760} y={GROUND - 30} scale={0.9} pose={{ ...POSES.stand, head: 14 }} look={LOOKS.womanSand as FigureLook} flip frame={frame + 3} />
          </g>
        ),
      };
    },
  },
  "court-fountain-still": {
    nameAr: "صحن الدار ساكنًا: الشيخ عند النافورة رأسه منخفض (ذكر الله)",
    place: "صحن دار بنافورة ليلًا",
    // c5-s3 فيه ذكر الله ومعنى الدعاء: كاميرا واحدة والعالم مجمَّد (حتى ماء النافورة)
    render: ({ portrait }) => ({
      cam: portrait ? [K(0, 720, 1.0)] : [K(0, 780, 1.3)],
      world: (
        <g>
          <Courtyard frame={0} />
          <Bench x={460} w={230} mood="night" />
          <Figure x={590} y={GROUND} scale={1.1} pose={{ ...POSES.sit, head: 24 }} look={CAST.elder} frame={0} />
        </g>
      ),
    }),
  },

  // ——— ب. المال ———
  "souq-coins-palm": {
    nameAr: "السوق: نقود في كف مشترٍ عند عربة الفاكهة، ثم تبتعد الكاميرا عن السوق كله",
    place: "سوق الحارة عصرًا",
    render: ({ frame, at, portrait }) => {
      // جسر بصري من ظرف c4-s18: يبدأ المشهد بنقود في كف مفتوحة، وعند «المال» تبتعد الكاميرا فيظهر المشتري والبائع والسوق
      const tM = at("المال", 0.2);
      const OPEN: PoseSpec = { ...POSES.stand, head: 18, armFront: { s: 60, e: 30 } };
      const h = handAt(OPEN, { x: 1080, y: GROUND, scale: 1.2, flip: true });
      return {
        cam: portrait ? [V(0, h.x, 2.2, h.y - 10), K(tM + 6, 960, 0.85)] : [V(0, h.x, 3.0, h.y - 10), K(tM + 6, 940, 1.2)],
        world: (
          <g>
            <SouqStreet frame={frame} />
            <FruitCart x={CART_X} />
            <Figure x={850} y={GROUND} scale={1.25} pose={{ ...POSES.stand, head: 8 }} look={CAST.cartVendor} frame={frame + 4} />
            <Figure x={1080} y={GROUND} scale={1.2} pose={OPEN} look={CAST.buyer} flip frame={frame} />
            <CoinsGlyph x={h.x} y={h.y - 6} glint={prog(frame, tM - 4, tM + 10) * (1 - prog(frame, tM + 24, tM + 40))} />
          </g>
        ),
      };
    },
  },
  "souq-money-uses": {
    nameAr: "السوق: يدفع ويأخذ حاجته، ثم يعطيها لشيخ محتاج جالس عند الجدار",
    place: "سوق الحارة عصرًا",
    render: ({ frame, at, portrait }) => {
      // «نعمة من الله»: التكوين ساكن حتى «لقضاء» (لا حدث عند ذكر الله)؛ «لقضاء»: يناول البائع النقود؛
      // «الحاجات»: يأخذ الصرة؛ «بابًا»: يلتفت إلى الشيخ ويمشي إليه؛ «للخير»: يضعها في يده
      const tP = at("لقضاء", 0.35);
      const tH = at("الحاجات", 0.43);
      const tB = at("بابا", 0.69);
      const tG = at("للخير", 0.84);
      const paid = frame >= tP + 10;
      const got = frame >= tH + 8;
      const walkS = tB + 2;
      const walkE = tG - 6;
      const given = frame >= tG + 8;
      const buyerX = frame < walkS ? 1080 : frame < walkE ? 1080 + (1340 - 1080) * prog(frame, walkS, walkE, (v) => v) : 1340;
      const buyerPose = frame < walkS ? tlPose(frame, [[0, { ...POSES.stand, head: 10 }], [tP - 8, GIVE], [tP + 12, POSES.hold]]) : frame < walkE ? walkPose(POSES.hold, ((frame - walkS) / 30) * Math.PI * 2) : tlPose(frame, [[walkE, POSES.hold], [tG - 2, { ...GIVE, head: 30 }], [tG + 16, { ...POSES.stand, head: 18 }]]);
      const flip = frame < walkS;
      return {
        cam: portrait ? [K(0, 960, 0.95), K(tP - 6, 940, 1.15), K(tB, 1300, 0.95)] : [K(0, 960, 1.3), K(tP - 6, 940, 1.6), K(tB, 1200, 1.25)],
        world: (
          <g>
            <SouqStreet frame={frame} />
            <FruitCart x={CART_X} missing={got ? 3 : 0} />
            <Bench x={1440} w={180} mood="day" />
            <Figure x={850} y={GROUND} scale={1.25} pose={tlPose(frame, [[0, POSES.stand], [tP + 4, { ...GIVE, head: 10 }], [tH + 10, POSES.stand]])} look={CAST.cartVendor} frame={frame + 4} holding={paid && !got ? "bundle" : paid ? "coins" : "none"} />
            <Figure x={buyerX} y={GROUND} scale={1.2} pose={buyerPose} look={CAST.buyer} flip={flip} frame={frame} holding={!paid ? "coins" : got && !given ? "bundle" : "none"} />
            <Figure x={1520} y={GROUND} scale={1.1} pose={{ ...POSES.sit, head: given ? -4 : 16 }} look={CAST.needy} flip frame={frame + 9} holding={given ? "bundle" : "none"} />
          </g>
        ),
      };
    },
  },
  "stall-money-measure": {
    nameAr: "دكان الميزان: يزن صرّته فتثقل كفتها، ويتعالى، ثم يعرض عن صبي بقطعة نقد واحدة",
    place: "دكان الميزان",
    render: ({ frame, at, portrait }) => {
      // «المقياس»: يضع صرّته في الكفة فتهبط على الثقل المعياري؛ «قيمته»: يتعالى؛ «وقيمة»: يقترب صبي بقطعة واحدة؛
      // «الآخرين»: يلتفت إليه ثم يلوّح بيده ويعطيه ظهره
      const tM = at("المقياس", 0.31);
      const tV = at("قيمته", 0.64);
      const tO = at("وقيمة", 0.73);
      const tA = at("الآخرين", 0.81);
      const placed = frame >= tM + 6;
      const tilt = placed ? settle(frame, tM + 6, 0, -15) : 0;
      const RX = 770;
      const o = { x: RX, y: GROUND + 6, scale: 1.25 };
      const PUT = reachTo({ x: STALL.scale - 92, y: COUNTER_TOP - 150 }, o, { ...POSES.stand, lean: 8, head: 10 });
      const h = handAt(PUT, o);
      const richPose = tlPose(frame, [[0, { ...POSES.hold, head: 10 }], [tM - 10, PUT], [tM + 12, { ...POSES.stand, head: 6 }], [tV, POSES.proud], [tA - 6, { ...POSES.proud, head: 4 }], [tA + 6, POSES["wave-off"]], [tA + 30, POSES.proud]]);
      const facingBoy = frame >= tA - 6 && frame < tA + 30;
      return {
        cam: portrait ? [V(0, 900, 0.95, 540), V(tM - 6, 960, 1.25, 560), V(tO, 700, 1.0, 560)] : [K(0, 960, 1.35, 30), K(tM - 6, 1000, 1.75, 0), K(tO, 820, 1.35, 30)],
        world: (
          <g>
            <StallSet frame={frame} vendor={{ ...POSES.stand, head: 14 }} />
            <ValueScale x={STALL.scale} tilt={tilt} left={(p) => (placed ? <Purse x={p.x} y={p.y} /> : null)} right={(p) => <StandardWeight x={p.x} y={p.y} />} />
            {!placed ? <Purse x={frame >= tM - 10 ? h.x : RX + 30} y={frame >= tM - 10 ? h.y + 30 : GROUND - 330} s={0.9} /> : null}
            <Figure x={RX} y={GROUND + 6} scale={1.25} pose={richPose} look={CAST.rich} flip={facingBoy} frame={frame} />
            {frame >= tO - 30 ? <Walker frame={frame} from={180} to={520} y={GROUND + 6} start={tO - 30} end={tO + 4} look={CAST.boy} scale={0.95} holding="coins" /> : null}
          </g>
        ),
      };
    },
  },

  // ——— ج. النجاح ———
  "workshop-success": {
    nameAr: "الورشة: نجار يمسح بيده على كرسي أتمه، ثم يتراجع خطوة وينظر إليه",
    place: "ورشة نجارة",
    render: ({ frame, at, portrait }) => {
      const tN = at("النجاح", 0.2);
      const TOUCH: PoseSpec = { ...POSES.point, lean: 20, head: 24, armFront: { s: 40, e: 10 } };
      const back = prog(frame, tN, tN + 18);
      return {
        cam: portrait ? [K(0, 1000, 1.3), K(tN, 1060, 1.05)] : [K(0, 1000, 1.7), K(tN, 1060, 1.35)],
        world: (
          <g>
            <Workshop frame={frame} />
            <Glow cx={940} cy={GROUND - 120} r={200} opacity={0.6 * back} />
            <Figure x={1040 + 140 * back} y={GROUND + 8} scale={1.2} pose={frame < tN ? TOUCH : blendPose(TOUCH, { ...POSES.stand, head: 10 }, back)} look={CAST.carpenter} flip frame={frame} />
          </g>
        ),
      };
    },
  },
  "workshop-success-pride": {
    nameAr: "الورشة: يصقل الكرسي (جهد)، يقف ساكنًا، ثم يعرض عن ملاحظة صبيه ويعقد ذراعيه",
    place: "ورشة نجارة",
    render: ({ frame, at, portrait }) => {
      // «جهد»: يصقل بحركة ذهاب وإياب؛ «وتوفيق من الله»: يقف ساكنًا والكاميرا ثابتة (من «وتوفيق» حتى «لكنه»)؛
      // «يتحول»: يدخل الصبي ويشير إلى موضع في الكرسي؛ «صاحبه»: يرفع رأسه؛ «للغرور»: يلوّح بيده ويعقد ذراعيه
      const tJ = at("جهد", 0.18);
      const tT = at("وتوفيق", 0.22);
      const tL = at("لكنه", 0.43);
      const tY = at("يتحول", 0.52);
      const tS = at("صاحبه", 0.67);
      const tG = at("للغرور", 0.84);
      const sanding = frame >= 4 && frame < tT - 4;
      const SAND_A: PoseSpec = { ...POSES.point, lean: 22, head: 26, armFront: { s: 34, e: 6 } };
      const SAND_B: PoseSpec = { ...POSES.point, lean: 26, head: 26, armFront: { s: 22, e: 4 } };
      const carpPose = sanding
        ? blendPose(SAND_A, SAND_B, 0.5 + 0.5 * Math.sin(frame / 3.2))
        : tlPose(frame, [[0, SAND_A], [tT - 4, { ...POSES.stand, head: 12 }], [tS, { ...POSES.stand, head: -10 }], [tG - 4, POSES["wave-off"]], [tG + 18, POSES.cross]]);
      return {
        cam: portrait ? [K(0, 1040, 1.25), K(tY, 900, 0.95), K(tG - 6, 1020, 1.15)] : [K(0, 1040, 1.6), K(tY, 960, 1.25), K(tG - 6, 1040, 1.5)],
        world: (
          <g>
            <Workshop frame={frame} chairMark={prog(frame, tY + 20, tY + 30) * (1 - prog(frame, tG, tG + 16))} />
            {frame >= tY ? (
              frame < tY + 26 ? (
                <Walker frame={frame} from={560} to={720} y={GROUND + 8} start={tY} end={tY + 26} look={CAST.apprentice} scale={1.05} />
              ) : (
                <Figure x={720} y={GROUND + 8} scale={1.05} pose={tlPose(frame, [[tY + 26, { ...POSES.point, head: 18, lean: 8 }], [tG + 8, { ...POSES.stand, head: 22 }]])} look={CAST.apprentice} frame={frame + 5} />
              )
            ) : null}
            <Figure x={1080} y={GROUND + 8} scale={1.2} pose={carpPose} look={CAST.carpenter} flip={frame < tG + 18} frame={frame} />
          </g>
        ),
      };
    },
  },

  // ——— د. الدنيا ———
  "roofs-whole-world": {
    nameAr: "الأسطح غروبًا: تبتعد الكاميرا من سطح واحد إلى المدينة كلها، وسرب طير يعبر",
    place: "أسطح المدينة غروبًا",
    render: ({ frame, at, portrait }) => {
      const tD = at("الدنيا", 0.2);
      const tK = at("كلها", 0.4);
      return {
        cam: portrait ? [V(0, 1540, 1.5, 520), K(tD - 4, 960, 0.75, -60), K(tK, 960, 0.6, -80)] : [V(0, 1540, 2.2, 520), K(tD - 4, 960, 1.0, -40), K(tK, 960, 0.85, -60)],
        world: (
          <g>
            <Rooftops frame={frame} mood="dusk" streetPeople />
            <Birds frame={frame} start={tD - 10} y={240} n={6} />
          </g>
        ),
      };
    },
  },
  "roof-building-forever": {
    nameAr: "السطح غروبًا ثم ليلًا: بنّاء يرص الطوب، يفرش مخططًا ويضيف إليه طابقًا، والشمس تغيب ولا يرفع رأسه",
    place: "سطح بيت يُبنى",
    render: ({ frame, at, portrait }) => {
      // «ننشغل بأعمالنا»: طوبة كل 14 إطارًا؛ «ومشروعاتنا»: يفرش المخطط؛ «نتصرف»: يغيب الضوء إلى الليل ويعود إلى الطوب؛
      // «البقاء»: يضيف طابقًا على المخطط؛ «مضمون»: طوبة أخرى، ورأسه منخفض طوال الوقت
      const tW = at("بأعمالنا", 0.15);
      const tP = at("ومشروعاتنا", 0.29);
      const tA = at("نتصرف", 0.5);
      const tB = at("البقاء", 0.66);
      const tS = at("مضمون", 0.83);
      const lays = [8, 22, tW + 6, tW + 18, tA + 4, tA + 18, tS - 4];
      const n = 10 + lays.filter((t) => frame >= t).length;
      const atPlan = frame >= tP - 6 && frame < tA - 4;
      const atPlan2 = frame >= tB - 6 && frame < tS - 10;
      const x = atPlan || atPlan2 ? ROOF.crate + 150 : ROOF.wall - 60;
      const LAY: PoseSpec = { ...POSES.point, lean: 22, head: 30, armFront: { s: 40, e: 20 } };
      const pose = atPlan || atPlan2 ? { ...POSES.point, lean: 18, head: 34, armFront: { s: 30, e: 30 } } : blendPose(LAY, { ...LAY, armFront: { s: 70, e: 30 } }, 0.5 + 0.5 * Math.sin(frame / 4));
      const night = prog(frame, tA, tA + 40);
      return {
        cam: portrait ? [K(0, 1200, 1.15), K(tP - 6, 960, 1.0), K(tA, 1080, 0.85), K(tS - 8, 1200, 1.1)] : [K(0, 1200, 1.45), K(tP - 6, 1000, 1.55), K(tA, 1060, 1.05), K(tS - 8, 1200, 1.4)],
        world: (
          <g>
            <Rooftops frame={frame} mood="dusk" to="night" t={night} />
            <PlanSheet x={ROOF.crate - 60} y={GROUND - 120} u={prog(frame, tP - 2, tP + 16)} extra={prog(frame, tB, tB + 24)} />
            <BrickWall x0={ROOF.wall} n={n} />
            <Glow cx={ROOF.wall + 160} cy={GROUND - 260} r={240} opacity={0.5 * night} />
            <Figure x={x} y={GROUND} scale={1.15} pose={pose} look={CAST.builder} flip={!(atPlan || atPlan2)} frame={frame} />
          </g>
        ),
      };
    },
  },
  "roof-night-still": {
    nameAr: "السطح ليلًا ساكنًا: الجدار نصف مبني والمخطط مفروش والبنّاء جالس على الصندوق (تمهيد الآية)",
    place: "سطح بيت يُبنى ليلًا",
    // c5-s11 تمهيد الآية (ذكر الله): لا حدث ولا حركة كاميرا، والعالم مجمَّد
    render: ({ portrait }) => ({
      cam: portrait ? [K(0, 1000, 0.8)] : [K(0, 1000, 1.05)],
      world: (
        <g>
          <Rooftops frame={0} mood="night" />
          <PlanSheet x={ROOF.crate - 60} y={GROUND - 120} u={1} extra={1} />
          <BrickWall x0={ROOF.wall} n={17} />
          <Glow cx={ROOF.wall + 160} cy={GROUND - 260} r={240} opacity={0.5} />
          <Figure x={ROOF.wall - 80} y={GROUND} scale={1.15} pose={{ ...POSES["sit-low"], head: 26 }} look={CAST.builder} flip frame={0} />
        </g>
      ),
    }),
  },

  // ——— هـ. موضعها الصحيح ———
  "roof-morning-work-meal": {
    nameAr: "السطح صباحًا: يواصل البناء، يقف ساكنًا، ثم يصعد ابنه بطبق طعام",
    place: "سطح بيت يُبنى صباحًا",
    render: ({ frame, at, portrait }) => {
      // «نترك العمل»: لا يترك؛ يرص الطوب؛ «نهمل ما أباح الله»: يقف ساكنًا (من «أو» حتى «طيباتها»)؛
      // «طيباتها»: يصعد ابنه من باب السطح بطبق تمر وشاي
      const tO = at("أو", 0.48);
      const tT = at("طيباتها", 0.82);
      const lays = [10, 28, 46, 64, 82];
      const n = 17 + lays.filter((t) => frame >= t).length;
      const working = frame < tO - 6;
      const LAY: PoseSpec = { ...POSES.point, lean: 22, head: 30, armFront: { s: 40, e: 20 } };
      const pose = working ? blendPose(LAY, { ...LAY, armFront: { s: 70, e: 30 } }, 0.5 + 0.5 * Math.sin(frame / 4)) : tlPose(frame, [[tO - 6, LAY], [tO + 6, { ...POSES.stand, head: 8 }], [tT + 10, { ...POSES.stand, head: 4 }]]);
      const sonIn = frame >= tT - 4;
      return {
        cam: portrait ? [K(0, 1180, 1.15), K(tT - 10, 900, 0.85)] : [K(0, 1200, 1.45), K(tT - 10, 960, 1.05)],
        world: (
          <g>
            <Rooftops frame={frame} mood="dawn" t={0} />
            <PlanSheet x={ROOF.crate - 60} y={GROUND - 120} u={1} extra={1} />
            <BrickWall x0={ROOF.wall} n={n} />
            <ToolBox x={ROOF.box} lid={0} trowel={false} />
            <Figure x={ROOF.wall - 60} y={GROUND} scale={1.15} pose={pose} look={CAST.builder} flip={working || frame < tT + 10} frame={frame} />
            {sonIn ? (
              <g>
                <Walker frame={frame} from={60} to={420} y={GROUND} start={tT - 4} end={tT + 34} look={CAST.son} scale={0.95} pose="hold" />
                <FoodTray x={60 + 360 * prog(frame, tT - 4, tT + 34, (v) => v) + 40} y={GROUND - 150} />
              </g>
            ) : null}
          </g>
        ),
      };
    },
  },
  "roof-tools-in-place": {
    nameAr: "السطح صباحًا: يضع المِسطرين في صندوق الأدوات ويغلقه، ثم يجلس مع ابنه إلى الطبق",
    place: "سطح بيت يُبنى صباحًا",
    render: ({ frame, at, portrait }) => {
      const tP = at("نضعها", 0.2);
      const tM = at("موضعها", 0.43);
      const tR = at("الصحيح", 0.65);
      const o = { x: ROOF.box + 110, y: GROUND, scale: 1.15, flip: true };
      const PUT = reachTo({ x: ROOF.box + 30, y: GROUND - 70 }, o, { ...POSES.stand, lean: 24, head: 30 });
      const placed = frame >= tP + 8;
      const sitting = frame >= tR;
      const h = handAt(PUT, o);
      return {
        cam: portrait ? [K(0, ROOF.box + 60, 1.25), K(tR - 6, ROOF.bench + 140, 1.0)] : [K(0, ROOF.box + 40, 1.7), K(tR - 6, ROOF.bench + 200, 1.35)],
        world: (
          <g>
            <Rooftops frame={frame} mood="dawn" t={0} />
            <BrickWall x0={ROOF.wall} n={22} />
            <ToolBox x={ROOF.box} lid={prog(frame, tM - 4, tM + 10)} trowel={placed} />
            <Bench x={ROOF.bench - 120} w={260} mood="dawn" />
            <FoodTray x={ROOF.bench + 10} y={GROUND - 92} />
            <Figure x={ROOF.bench - 70} y={GROUND} scale={0.95} pose={{ ...POSES.sit, head: 10 }} look={CAST.son} frame={frame + 3} />
            {!sitting ? (
              frame < tM + 14 ? (
                <g>
                  <Figure x={o.x} y={GROUND} scale={1.15} pose={tlPose(frame, [[0, { ...POSES.stand, head: 16 }], [tP - 8, PUT], [tM + 12, { ...POSES.stand, head: 6 }]])} look={CAST.builder} flip frame={frame} />
                  {!placed ? <Trowel x={frame >= tP - 8 ? h.x : o.x - 60} y={frame >= tP - 8 ? h.y : GROUND - 380} /> : null}
                </g>
              ) : (
                <Walker frame={frame} from={o.x} to={ROOF.bench + 90} y={GROUND} start={tM + 14} end={tR} look={CAST.builder} scale={1.15} />
              )
            ) : (
              <Figure x={ROOF.bench + 90} y={GROUND} scale={1.15} pose={{ ...POSES.sit, head: 12 }} look={CAST.builder} flip frame={frame} />
            )}
          </g>
        ),
      };
    },
  },
  "roof-not-the-end": {
    nameAr: "السطح صباحًا (عريضة): الأب وابنه إلى الطبق والجدار نصف مبني، ثم ترتفع الكاميرا إلى السماء المفتوحة",
    place: "سطح بيت يُبنى صباحًا",
    render: ({ frame, at, portrait }) => {
      const tW = at("عمل", 0.16);
      const tE = at("الغاية", 0.49);
      return {
        cam: portrait ? [K(0, 700, 0.8), K(tE - 6, 960, 0.62, -380)] : [K(0, 800, 1.05), K(tE - 6, 960, 0.9, -330)],
        world: (
          <g>
            <Rooftops frame={frame} mood="dawn" t={0} />
            <BrickWall x0={ROOF.wall} n={22} />
            <Glow cx={ROOF.wall + 200} cy={GROUND - 60} r={220} opacity={0.45 * prog(frame, tW - 2, tW + 10) * (1 - prog(frame, tW + 30, tW + 50))} />
            <ToolBox x={ROOF.box} lid={1} trowel />
            <Bench x={ROOF.bench - 120} w={260} mood="dawn" />
            <FoodTray x={ROOF.bench + 10} y={GROUND - 92} />
            <Figure x={ROOF.bench - 70} y={GROUND} scale={0.95} pose={{ ...POSES.sit, head: 4 }} look={CAST.son} frame={frame + 3} holding="cup" />
            <Figure x={ROOF.bench + 90} y={GROUND} scale={1.15} pose={{ ...POSES.sit, head: frame >= tE ? -14 : 8 }} look={CAST.builder} flip frame={frame} holding="cup" />
            <Birds frame={frame} start={tE - 20} y={160} n={5} dir={1} />
          </g>
        ),
      };
    },
  },

  // ——— و. النظر إلى النفس وإلى الآخرين ———
  "souq-tray-reflection": {
    nameAr: "السوق: البطل يمر بالبضائع، ثم يقف أمام صينية نحاس فيرى صورته فيها",
    place: "سوق الحارة عصرًا",
    render: ({ frame, at, portrait }) => {
      // «بالأشياء»: ينظر إلى البضائع وهو يمشي؛ «بأنفسنا»: يقف أمام الصينية، وتتقدم الكاميرا إلى صورته فيها
      const tT = at("بالأشياء", 0.36);
      const tN = at("بأنفسنا", 0.79);
      const stopX = TRAY.x - 190;
      const walkEnd = tN - 8;
      const x = frame < walkEnd ? 300 + (stopX - 300) * prog(frame, 0, walkEnd, (v) => v) : stopX;
      const walking = frame < walkEnd;
      const head = walking ? (frame >= tT && frame < tT + 30 ? 30 : 6) : -6;
      const pose = walking ? walkPose({ ...POSES.stand, head }, (frame / 30) * Math.PI * 2 * 0.95) : { ...POSES.stand, head };
      const reflect = (
        <g transform={`translate(${TRAY.x + 6} ${TRAY.y + 118}) scale(-0.42 0.42)`}>
          <Figure x={0} y={0} scale={1.2} pose={{ ...POSES.stand, head: -6 }} look={hero} frame={frame} />
        </g>
      );
      return {
        cam: portrait ? [K(0, 500, 1.0), K(tT, 820, 1.0), V(tN - 4, TRAY.x - 40, 1.7, TRAY.y + 40)] : [K(0, 600, 1.25), K(tT, 820, 1.35), V(tN - 4, TRAY.x - 60, 2.3, TRAY.y + 30)],
        world: (
          <g>
            <SouqStreet frame={frame} />
            <CopperTray reflect={frame >= walkEnd - 6 ? reflect : null} shine={prog(frame, tN, tN + 20)} />
            <Figure x={x} y={GROUND} scale={1.2} pose={pose} look={hero} frame={frame} />
          </g>
        ),
      };
    },
  },
  "souq-strength-humble": {
    nameAr: "السوق: البائع يعجز عن رفع صندوق، فيرفعه البطل ويضعه على العربة، ثم يومئ ويمضي بلا تعالٍ",
    place: "سوق الحارة عصرًا",
    render: ({ frame, at, portrait }) => {
      // «نعرف»: يتقدم البطل؛ «لدينا»: يرفع الصندوق؛ «مواطن قوة»: يضعه على العربة؛ «دون غرور»: يشكره البائع فيومئ ويمضي
      const tK = at("نعرف", 0.1);
      const tH = at("لدينا", 0.26);
      const tS = at("قوة", 0.59);
      const tG = at("غرور", 0.78);
      const LIFT: PoseSpec = { ...POSES.hold, lean: 6, head: 10, armFront: { s: 70, e: 40 }, armBack: { s: 64, e: 46 } };
      const STRAIN: PoseSpec = { ...POSES.stand, lean: 32, head: 34, armFront: { s: 10, e: 10 }, ...KNEEL };
      const carry = frame >= tH && frame < tS;
      // البائع عند 1100 ينحني على الصندوق (1200)؛ البطل من اليمين إلى ما وراء الصندوق، يحمله إلى العربة، ثم يمضي يسارًا
      const heroX = frame < tK ? 1520 : frame < tH ? 1520 - 230 * prog(frame, tK, tH - 2, (v) => v) : frame < tS ? 1290 - 280 * prog(frame, tH + 6, tS - 4, (v) => v) : frame < tG + 6 ? 1010 : 1010 - 620 * prog(frame, tG + 6, tG + 60, (v) => v);
      const walkingHero = (frame >= tK && frame < tH - 2) || frame >= tG + 6;
      const heroPose = carry ? LIFT : walkingHero ? walkPose({ ...POSES.stand, head: 6 }, (frame / 30) * Math.PI * 2) : tlPose(frame, [[tS, { ...POSES.stand, head: 8 }], [tG - 6, POSES.nod], [tG + 6, POSES.stand]]);
      const hh = handAt(LIFT, { x: heroX, y: GROUND, scale: 1.2, flip: true });
      const boxOnCart = frame >= tS;
      return {
        cam: portrait ? [K(0, 1180, 1.0), K(tH, 1080, 1.05), K(tG, 900, 0.95)] : [K(0, 1150, 1.45), K(tH, 1050, 1.55), K(tG, 900, 1.3)],
        world: (
          <g>
            <SouqStreet frame={frame} />
            <FruitCart x={CART_X} />
            {boxOnCart ? <FruitBox x={CART_X + 170} y={GROUND - 158} /> : !carry ? <FruitBox x={1200} y={GROUND} /> : <FruitBox x={hh.x - 30} y={hh.y + 20} />}
            <Figure x={1100} y={GROUND} scale={1.25} flip={frame >= tS} pose={frame < tH ? STRAIN : tlPose(frame, [[tH, { ...POSES.stand, head: 6 }], [tG - 8, { ...POSES.apologize, head: 14 }], [tG + 12, POSES.stand]])} look={CAST.cartVendor} frame={frame + 4} />
            <Figure x={heroX} y={GROUND} scale={1.2} pose={heroPose} look={hero} flip frame={frame} />
          </g>
        ),
      };
    },
  },
  "souq-spill-no-despair": {
    nameAr: "السوق: يصدم العربة فيتدحرج البرتقال، يضع يده على صدره معتذرًا، ثم يجثو ويعيده واحدة واحدة ويقوم",
    place: "سوق الحارة عصرًا",
    render: ({ frame, at, portrait }) => {
      const tA = at("نعترف", 0.14);
      const tN = at("دون", 0.57);
      const tY = at("يأس", 0.66);
      const bump = 6;
      // برتقالات تتدحرج من العربة ثم تُعاد إليها
      const spill = [0, 1, 2, 3, 4].map((i) => {
        const fall = prog(frame, bump + i * 2, bump + 16 + i * 3, (v) => v);
        const back = prog(frame, tN + 4 + i * 8, tN + 12 + i * 8);
        const gx = 760 + i * 70;
        const sx = CART_X + 60 + i * 28;
        const sy = GROUND - 190;
        const x = sx + (gx - sx) * fall;
        const y = sy + (GROUND - 10 - sy) * fall;
        return { x: x + (sx - x) * back, y: y + (sy - y) * back, show: true };
      });
      const kneel = frame >= tN && frame < tN + 52;
      const PICK: PoseSpec = { ...POSES.point, lean: 30, head: 30, armFront: { s: 20, e: 20 }, ...KNEEL };
      const heroPose = kneel ? PICK : tlPose(frame, [[0, walkPose(POSES.stand, frame / 5)], [bump + 4, { ...POSES.flinch, head: 20 }], [tA - 2, POSES.apologize], [tN + 52, { ...POSES.stand, head: 4 }]]);
      return {
        cam: portrait ? [K(0, 900, 1.0), K(tA, 960, 1.15), K(tY + 30, 950, 1.0)] : [K(0, 920, 1.45), K(tA, 960, 1.7), K(tY + 30, 940, 1.45)],
        world: (
          <g>
            <SouqStreet frame={frame} />
            <FruitCart x={CART_X} missing={5 - spill.filter((s) => s.y < GROUND - 185).length} />
            <Figure x={830} y={GROUND} scale={1.25} pose={tlPose(frame, [[0, POSES.stand], [bump + 6, { ...POSES.stand, head: 24 }], [tY + 40, POSES.nod]])} look={CAST.cartVendor} frame={frame + 4} />
            {spill.map((s, i) => (frame > bump && s.y > GROUND - 186 ? <circle key={i} cx={s.x} cy={s.y} r={13} fill={mix(ID.dawn, ID.seal, 0.3)} stroke={INK} strokeWidth={2} /> : null))}
            <Figure x={1000 + (frame < bump ? 60 - 10 * frame : 0)} y={GROUND} scale={1.2} pose={heroPose} look={hero} flip frame={frame} />
          </g>
        ),
      };
    },
  },
  "stall-fair-to-others": {
    nameAr: "دكان الميزان: يرى خطأ صديقه في الثقل اللامع فيصححه، ثم يقبل ملاحظة رجل لا يحبه عن ميل الميزان",
    place: "دكان الميزان",
    render: ({ frame, at, portrait }) => {
      // «محبتهم»: يده على كتف صديقه البائع؛ «أخطائهم»: يرى الثقل اللامع (المزيف من الفصل 2) فيرفعه ويضع المعياري؛
      // «كراهيتهم»: يمر الرجل القاسي من مقهى الفصل 2 ويشير إلى الميزان المائل، فيعقد البطل ذراعيه؛
      // «عندهم»: ينظر إلى الميزان؛ «حق»: يومئ ويضبط الكفة بيده
      const tL = at("محبتهم", 0.3);
      const tE = at("أخطائهم", 0.44);
      const tH = at("كراهيتهم", 0.64);
      const tI = at("إنكار", 0.76);
      const tO = at("عندهم", 0.84);
      const tR = at("حق", 0.92);
      const swapped = frame >= tE + 14;
      const fixed = frame >= tR + 6;
      const tilt = !swapped ? 0 : !fixed ? settle(frame, tE + 14, 0, 4) : settle(frame, tR + 6, 4, 0);
      const HX = 1480;
      const o = { x: HX, y: GROUND + 6, scale: 1.22, flip: true };
      const TAKE = reachTo({ x: STALL.scale + 92, y: COUNTER_TOP - 160 }, o, { ...POSES.stand, lean: 10, head: 16 });
      const SHOULDER = reachTo({ x: STALL.vendor + 40, y: GROUND - 300 }, o, { ...POSES.stand, head: 6 });
      const heroPose = tlPose(frame, [[0, { ...POSES.stand, head: 8 }], [tL - 4, SHOULDER], [tE - 6, TAKE], [tE + 20, { ...POSES.stand, head: 10 }], [tH + 6, POSES.cross], [tO, { ...POSES.cross, head: 22 }], [tR - 4, TAKE], [tR + 16, POSES.nod]]);
      const rivalIn = frame >= tH - 24;
      return {
        cam: portrait ? [V(0, 1180, 0.9, 540), V(tE - 6, 1140, 1.3, 520), V(tH - 10, 900, 0.85, 560), V(tO, 1060, 1.2, 520)] : [K(0, 1160, 1.25, 30), K(tE - 6, 1120, 1.75, 0), K(tH - 10, 1000, 1.15, 40), K(tO, 1080, 1.6, 10)],
        world: (
          <g>
            <StallSet frame={frame} />
            <Figure x={STALL.vendor} y={GROUND + 6} scale={1.5} pose={tlPose(frame, [[0, { ...POSES.stand, head: 10 }], [tE + 14, { ...POSES.stand, head: 26 }], [tH, POSES.stand]])} look={CAST.friend} flip frame={frame + 4} />
            <ValueScale x={STALL.scale} tilt={tilt} left={(p) => <g>{oranges(p, 5)}</g>} right={(p) => (swapped ? <StandardWeight x={p.x} y={p.y} /> : <ShinyWeight x={p.x} y={p.y} glow={prog(frame, tE - 8, tE + 4)} />)} />
            <Figure x={HX} y={GROUND + 6} scale={1.22} pose={heroPose} look={hero} flip frame={frame} />
            <Figure x={640} y={GROUND + 6} scale={1.15} pose={{ ...POSES.stand, head: 10 }} look={CAST.customer} frame={frame + 2} />
            {rivalIn ? (
              frame < tH ? (
                <Walker frame={frame} from={200} to={820} y={GROUND + 6} start={tH - 24} end={tH} look={CAST.rival} scale={1.2} />
              ) : (
                <Figure x={820} y={GROUND + 6} scale={1.2} pose={tlPose(frame, [[tH, { ...POSES.point, armFront: { s: 70, e: 8 } }], [tR + 10, { ...POSES.stand, head: 6 }]])} look={CAST.rival} frame={frame + 6} />
              )
            ) : null}
          </g>
        ),
      };
    },
  },
  "stall-scale-of-justice": {
    nameAr: "دكان الميزان: ينحني ليرى الكفتين بمستوى عينه، يستوي الميزان عند «بميزان العدل»، ثم يمضي إلى الحارة",
    place: "دكان الميزان ثم الطريق",
    render: ({ frame, at, portrait }) => {
      // «نحب»: الكاميرا على الميزان؛ «نجتهد في رؤية»: ينحني فيرى الكفتين بمستوى عينه؛ «بميزان العدل»: يستوي الميزان ويضيء؛
      // «السؤال العملي»: يلتفت إلى الطريق؛ «كيف ندرّب»: يمشي خارجًا من الدكان والكاميرا تتبعه
      const tJ = at("نجتهد", 0.22);
      const tM = at("بميزان", 0.35);
      const tQ = at("السؤال", 0.52);
      const tK = at("كيف", 0.62);
      const tilt = frame < tM ? 6 + 2 * Math.sin(frame / 14) : settle(frame, tM, 6, 0);
      const level = prog(frame, tM + 10, tM + 30) * (1 - prog(frame, tQ, tQ + 30));
      const HX = 1440;
      const LOOK: PoseSpec = { ...POSES.stand, lean: 26, head: 10, armBack: { s: -20, e: 30 } };
      const walking = frame >= tK;
      const heroX = walking ? HX - 1500 * prog(frame, tK, tK + 160, (v) => v) : HX;
      return {
        cam: portrait
          ? [V(0, STALL.scale, 1.5, COUNTER_TOP - 170), V(tJ, 1200, 1.1, 520), V(tM - 4, STALL.scale, 1.9, COUNTER_TOP - 180), V(tQ, 1150, 0.95, 540), V(tK + 30, 600, 0.95, 560)]
          : [V(0, STALL.scale, 2.2, COUNTER_TOP - 170), V(tJ, 1180, 1.5, 520), V(tM - 4, STALL.scale, 2.6, COUNTER_TOP - 180), V(tQ, 1120, 1.3, 540), V(tK + 30, 700, 1.2, 560)],
        world: (
          <g>
            <StallSet frame={frame} vendor={{ ...POSES.stand, head: 10 }} />
            <Glow cx={STALL.scale} cy={COUNTER_TOP - 150} r={220} opacity={0.55 * level} />
            <ValueScale x={STALL.scale} tilt={tilt} left={(p) => <g>{oranges(p, 5)}</g>} right={(p) => <StandardWeight x={p.x} y={p.y} />} />
            {walking ? (
              <Walker frame={frame} from={HX} to={HX - 1500} y={GROUND + 6} start={tK} end={tK + 160} look={hero} scale={1.22} />
            ) : (
              <Figure x={heroX} y={GROUND + 6} scale={1.22} pose={tlPose(frame, [[0, { ...POSES.stand, head: 10 }], [tJ, LOOK], [tM + 20, { ...POSES.stand, head: 6 }], [tQ, POSES.stand]])} look={hero} flip={frame < tQ + 10} frame={frame} />
            )}
          </g>
        ),
      };
    },
  },
};
