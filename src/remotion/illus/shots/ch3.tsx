import React from "react";
import { ID, darken, lighten, mix } from "../palette";
import { Figure, POSES, blendPose, handAt, walkPose, type FigureLook, type PoseSpec } from "../Figure";
import { GROUND, Glow, Sky, WallLamp, archPath } from "../world";
import { HomeRoom } from "./interior";
import { K, Walker, prog, type CamKey, type ShotCtx } from "./kit";

/**
 * الحلقة 001 · الفصل 3 «هل نريد معرفة الحق فعلًا؟». التخطيط في storyboard/ch3-plan.md (التوجيه 022)،
 * ومعالجة التوجيه 023 (ch3-v2):
 * أ. الصفحة الممزقة (c3-s1 → c3-s8) بسلسلة دليل واحدة مرسومة بالشكل نفسه في كل لقطة (PageGlyph وPIECE):
 *    يرفع الصفحة الناقصة الزاوية متهمًا؛ يأخذ من أخيه نقودًا؛ يخرج القط وفي فمه القطعة الناقصة نفسها؛ يأخذها ويضعها
 *    في موضعها فتنطبق (الدليل، لا مجرد ظهور القط)؛ وآثار المخالب على الصفحة من البداية تضيء في اللقطة القريبة.
 * ب. ثمن الاعتراف (c3-s9 → c3-s12): يد تتردد ولا تطرق؛ ثياب تعود من الحقيبة إلى الرف؛ نقود في ظرف مغلق يبقى معه
 *    (لم تُرد بعد)؛ واعتراف هادئ أمام زجاج باب طويل يعكسه بحجمه وارتفاعه.
 * ج. سكون الآية (c3-s13، c3-s15) حول البطاقة c3-s14.
 * د. الطريق (c3-s16 → c3-s20) بخمسة تأطيرات: الطريق، والاستعداد والخطوة، والتوقف، والتراجع من اللقطة المقابلة؛
 *    والظرف في يده لم يُسلَّم. العادة (c3-s21) قرار ثم رغبة. الجسر (c3-s22) قبيل الفجر بعد ليلة c3-s21، ساكن.
 * شخوص بلا ملامح، والعناصر الجديدة داخل هذه اللقطات وحدها حتى يراجعها صاحب القناة.
 */

const INK = darken(ID.night, 0.55);
const hero = { outfit: "jacket", cloth: "emerald", head: "hair", skin: 1 } as FigureLook;
export const CH3_CAST = {
  brother: { outfit: "jacket", cloth: "copper", head: "hair", skin: 0, build: 1.15 } as FigureLook,
};

type Ch3Shot = { nameAr: string; place: string; render: (c: ShotCtx) => { cam: CamKey[]; world: React.ReactNode; captionBackdrop?: number } };
const V = (t: number, x: number, z: number, y: number, cut = false): CamKey => ({ t, x, y, z, ...(cut ? { cut } : {}) });
export const tlPose = (frame: number, tl: [number, PoseSpec][]) => {
  let i = 0;
  while (i + 1 < tl.length && frame >= tl[i + 1]![0]) i++;
  const [t0, p0] = tl[i]!;
  return i > 0 && frame < t0 + 10 ? blendPose(tl[i - 1]![1], p0, prog(frame, t0, t0 + 10)) : p0;
};
/** يد أمامية تصل إلى نقطة: أقرب ذراع بالبحث (كذراع البائع في الفصل 1) */
const reachTo = (target: { x: number; y: number }, o: { x: number; y: number; scale: number; flip?: boolean }, base: PoseSpec): PoseSpec => {
  let best = { d: Infinity, s: 0, e: 0 };
  for (let s = -20; s <= 170; s += 4)
    for (let e = -10; e <= 100; e += 4) {
      const h = handAt({ ...base, armFront: { s, e } }, o);
      const d = Math.hypot(h.x - target.x, h.y - target.y);
      if (d < best.d) best = { d, s, e };
    }
  return { ...base, armFront: { s: best.s, e: best.e } };
};

// ———————————————————— مواضع الغرفة (HomeRoom) ————————————————————
const ROOM = { door: -20, bag: 140, shelf: 180, brother: 600, hero: 900, sideboard: 1000, envelope: 1210, jar: 1180 };
const KNEEL = { legFront: { s: 4, e: 96 }, legBack: { s: 70, e: 70 } };
/** يرفع الصفحة نحو أخيه (الاتهام بالدليل لا بالإصبع) */
const SHOW: PoseSpec = { ...POSES.stand, lean: 6, head: 4, armFront: { s: 86, e: 12 } };
/** الصفحة في اليد الخلفية منخفضة، والأمامية حرة */
const PAGE_LOW: PoseSpec = { ...POSES.stand, head: -8, lean: -2, armBack: { s: 28, e: 46 } };
const PALM: PoseSpec = { ...PAGE_LOW, lean: 4, head: 14, armFront: { s: 58, e: 20 } };
const GIVE: PoseSpec = { ...POSES.stand, lean: 8, head: 22, armFront: { s: 62, e: 14 } };
/** قبضة عند الباب بارتفاع الكتف، لم تلمسه */
const KNOCK: PoseSpec = { ...POSES.stand, lean: 2, head: -2, armFront: { s: 88, e: 64 } };
/** يحمل الظرف أمامه */
export const CARRY: PoseSpec = { ...POSES.stand, armFront: { s: 34, e: 52 } };

// ———————————————————— سلسلة الدليل: الصفحة والقطعة والمخالب بشكل واحد ————————————————————
/** الصفحة 100×130 بزاوية علوية ممزقة؛ PIECE هي القطعة الناقصة نفسها بالضبط */
export const TORN = "M0 0 L62 0 L66 10 L74 5 L78 20 L88 15 L100 30 L100 130 L0 130 Z";
export const PIECE = "M62 0 L66 10 L74 5 L78 20 L88 15 L100 30 L100 0 Z";
const PAWS: [number, number, number][] = [[56, 62, 20], [34, 98, -10]];
/**
 * الصفحة بمركزها (x,y) ومقياس s. piece: 0 ناقصة، 1 القطعة في موضعها (ومعها خط الوصل)؛ pieceFrom موضع القطعة قبل الانطباق.
 * آثار المخالب حاضرة دائمًا خافتة، وpaws يضيئها.
 */
const PageGlyph: React.FC<{ x: number; y: number; s: number; piece?: number; pieceFrom?: { x: number; y: number }; paws?: number; glow?: number }> = ({ x, y, s, piece = 0, pieceFrom, paws = 0, glow = 0 }) => {
  const ox = x - 50 * s;
  const oy = y - 65 * s;
  const sw = Math.max(1.4, 2.6 * s) / s;
  const pieceAt = pieceFrom ? { x: pieceFrom.x + (ox + 62 * s - pieceFrom.x) * piece, y: pieceFrom.y + (oy - pieceFrom.y) * piece } : { x: ox + 62 * s, y: oy };
  return (
    <g>
      {glow > 0.01 ? <Glow cx={x} cy={y} r={110 * s + 40} color={ID.dawn} opacity={0.55 * glow} /> : null}
      <g transform={`translate(${ox} ${oy}) scale(${s})`}>
        <path d={TORN} fill={ID.paper} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />
        {[45, 62, 79, 96, 113].map((ly) => <line key={ly} x1={10} y1={ly} x2={90} y2={ly} stroke={mix(ID.paper, ID.night, 0.28)} strokeWidth={sw * 0.6} />)}
        <g fill={mix(ID.night, ID.copper, 0.3)} opacity={0.4 + 0.6 * paws}>
          {PAWS.map(([cx, cy, r], i) => (
            <g key={i} transform={`rotate(${r} ${cx} ${cy})`}>
              <ellipse cx={cx} cy={cy} rx={6} ry={5} />
              {[-7, -2.5, 2.5, 7].map((dx, k) => <ellipse key={k} cx={cx + dx} cy={cy - 7 - (k === 1 || k === 2 ? 2 : 0)} rx={2.2} ry={2.8} />)}
            </g>
          ))}
        </g>
      </g>
      {paws > 0.01 ? <Glow cx={ox + 45 * s} cy={oy + 80 * s} r={70 * s + 20} color={ID.dawn} opacity={0.4 * paws} /> : null}
      {piece > 0.001 || pieceFrom ? (
        <g transform={`translate(${pieceAt.x - 62 * s} ${pieceAt.y}) scale(${s})`}>
          <path d={PIECE} fill={ID.paper} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />
        </g>
      ) : null}
      {piece > 0.98 ? <path d={`M${ox + 62 * s} ${oy} L${ox + 66 * s} ${oy + 10 * s} L${ox + 74 * s} ${oy + 5 * s} L${ox + 78 * s} ${oy + 20 * s} L${ox + 88 * s} ${oy + 15 * s} L${ox + 100 * s} ${oy + 30 * s}`} fill="none" stroke={mix(ID.dawn, ID.copper, 0.4)} strokeWidth={Math.max(1.6, 3 * s)} /> : null}
    </g>
  );
};
/** موضع الصفحة من الكف (كالورقة المحمولة) */
const pageAtHand = (h: { x: number; y: number }, sc: number, flip: boolean) => ({ x: h.x + (flip ? -1 : 1) * 14 * sc, y: h.y - 16 * sc });
const PAGE_S = 0.46;
/** نقود: ثلاث قطع نحاسية */
export const CoinsGlyph: React.FC<{ x: number; y: number; glint?: number }> = ({ x, y, glint = 0 }) => (
  <g>
    {glint > 0.01 ? <Glow cx={x} cy={y} r={44} color={ID.dawn} opacity={0.6 * glint} /> : null}
    {[[0, 0], [7, -5], [-6, -8]].map(([dx, dy], i) => <circle key={i} cx={x + dx!} cy={y + dy!} r={7} fill={mix(ID.copper, ID.dawn, 0.3)} stroke={INK} strokeWidth={1.8} />)}
  </g>
);
/** ظرف صغير مغلق في اليد */
export const EnvelopeGlyph: React.FC<{ x: number; y: number; s?: number }> = ({ x, y, s = 1.2 }) => {
  const w = 26 * s;
  const h = 17 * s;
  return (
    <g>
      <rect x={x - w / 2} y={y - h} width={w} height={h} fill={ID.paper} stroke={INK} strokeWidth={Math.max(1.2, 1.8 * s)} />
      <path d={`M${x - w / 2} ${y - h} L${x} ${y - h * 0.45} L${x + w / 2} ${y - h}`} fill="none" stroke={INK} strokeWidth={Math.max(1, 1.4 * s)} />
    </g>
  );
};
/** ثوب مطوي */
const Garment: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g>
    <rect x={x - 34} y={y - 16} width={68} height={16} rx={3} fill={mix(ID.paper, ID.copper, 0.25)} stroke={INK} strokeWidth={2.2} />
    <line x1={x - 24} y1={y - 8} x2={x + 24} y2={y - 8} stroke={mix(ID.paper, ID.night, 0.3)} strokeWidth={1.6} />
  </g>
);

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
        {/* القصاصة في فمه: القطعة نفسها الناقصة من الصفحة (PIECE)، بمقياس أصغر */}
        {scrap > 0.01 ? (
          <g transform={`translate(${38} ${bodyY - 22}) scale(0.62) translate(-62 0)`} opacity={scrap}>
            <path d={PIECE} fill={ID.paper} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
          </g>
        ) : null}
      </g>
    </g>
  );
};
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
      {[[-14, -18, darken(ID.copper, 0.3)], [8, -14, mix(ID.copper, ID.seal, 0.3)], [-4, -36, darken(ID.copper, 0.15)], [16, -38, mix(darken(ID.copper, 0.3), ID.seal, 0.3)], [-18, -46, darken(ID.copper, 0.2)]].map(([dx, dy, c], i) => (
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
/**
 * باب زجاجي طويل حتى الأرض مكان النافذة ليلًا (التوجيه 023): يعكس البطل بحجمه وارتفاعه كاملًا.
 * الزجاج مستوى عمودي عند GLASS_X، والانعكاس صورة مرآة عبره (x' = 2·GLASS_X − x) بالوجهة المعكوسة والوضعية نفسها.
 */
const GLASS = { x0: 1430, x1: 1750, top: 150 };
const GLASS_X = 1440;
const TallGlass: React.FC = () => (
  <g>
    <path d={archPath(GLASS.x0 - 22, GROUND + 4, GLASS.x1 - GLASS.x0 + 44, GROUND - GLASS.top + 26)} fill={darken(ID.copper, 0.5)} stroke={INK} strokeWidth={3} />
    <path d={archPath(GLASS.x0, GROUND, GLASS.x1 - GLASS.x0, GROUND - GLASS.top)} fill={mix(darken(ID.night, 0.35), ID.night, 0.4)} />
    {[[1520, 320], [1660, 260], [1700, 420]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3} fill={ID.dawn} opacity={0.5} />)}
  </g>
);
const TallGlassFrame: React.FC = () => (
  <g stroke={darken(ID.copper, 0.5)} strokeWidth={8} fill="none">
    <line x1={(GLASS.x0 + GLASS.x1) / 2 + 40} y1={GLASS.top + 20} x2={(GLASS.x0 + GLASS.x1) / 2 + 40} y2={GROUND} />
    <line x1={GLASS.x0} y1={GROUND - 520} x2={GLASS.x1} y2={GROUND - 520} />
    <path d={archPath(GLASS.x0, GROUND, GLASS.x1 - GLASS.x0, GROUND - GLASS.top)} strokeWidth={6} stroke={INK} />
  </g>
);
/** البطل أمام الزجاج على بعد قصير منه، والانعكاس على البعد نفسه خلف سطحه */
const HERO_AT_GLASS = 1330;
const REFL_X = 2 * GLASS_X - HERO_AT_GLASS + 110;
const Reflection: React.FC<{ pose: PoseSpec; frame: number; id: string }> = ({ pose, frame, id }) => (
  <g>
    <defs>
      <clipPath id={id}>
        <path d={archPath(GLASS.x0, GROUND, GLASS.x1 - GLASS.x0, GROUND - GLASS.top)} />
      </clipPath>
    </defs>
    {/* الحجم والارتفاع نفسهما، والوجهة معكوسة، وشفافية زجاج مظلم تضيئه الغرفة */}
    <g clipPath={`url(#${id})`}>
      <Glow cx={REFL_X} cy={GROUND - 200} r={220} color={mix(ID.paper, ID.dawn, 0.4)} opacity={0.18} />
      <g opacity={0.55}>
        <Figure x={REFL_X} y={GROUND + 8} scale={1.2} pose={pose} look={hero} flip silhouette={mix(ID.paper, ID.night, 0.45)} shadow={false} frame={frame} />
      </g>
    </g>
  </g>
);

// ———————————————————— اللقطة القريبة للصفحة ————————————————————
const PAGE = { x: 5000, y: 540 };
const PageInsert: React.FC<{ paws: number }> = ({ paws }) => (
  <g>
    <rect x={PAGE.x - 1400} y={PAGE.y - 900} width={2800} height={1800} fill={darken(ID.copper, 0.55)} />
    <Glow cx={PAGE.x} cy={PAGE.y} r={600} color={ID.dawn} opacity={0.25} />
    <PageGlyph x={PAGE.x} y={PAGE.y + 20} s={5} piece={1} paws={paws} />
    <path d={`M${PAGE.x - 290} ${PAGE.y + 420} L${PAGE.x - 260} ${PAGE.y + 240} Q${PAGE.x - 220} ${PAGE.y + 190} ${PAGE.x - 180} ${PAGE.y + 240} L${PAGE.x - 170} ${PAGE.y + 420} Z`} fill="#D2A782" stroke={INK} strokeWidth={4} />
    <path d={`M${PAGE.x - 390} ${PAGE.y + 620} L${PAGE.x - 310} ${PAGE.y + 320} L${PAGE.x - 130} ${PAGE.y + 360} L${PAGE.x - 130} ${PAGE.y + 620} Z`} fill={mix(ID.night, ID.paper, 0.32)} stroke={INK} strokeWidth={4} />
  </g>
);

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
/**
 * reverse: اللقطة المقابلة من عند باب أخيه (التوجيه 023): صدر الزقاق بيته هو، والجدار الأيسر القريب بيت أخيه؛
 * والموضع على الطريق حينئذٍ lanePos(1 - d).
 */
export const Lane: React.FC<{ frame: number; mood: "dusk" | "dawn" | "predawn"; lit: number; heroDoor: number; brotherDoor: number; reverse?: boolean }> = ({ frame, mood, lit, heroDoor, brotherDoor, reverse = false }) => {
  const dawn = mood === "dawn";
  const dark = mood === "predawn" ? 0.45 : dawn ? 0.18 : 0.3;
  const nearDoor = reverse ? brotherDoor : heroDoor;
  const farDoor = reverse ? heroDoor : brotherDoor;
  const nearCol = reverse ? mix(darken(ID.copper, 0.25), ID.dawn, 0.55 * nearDoor) : mix(mix(ID.night, ID.paper, 0.3), ID.dawn, 0.55 * nearDoor);
  const farCol = reverse ? mix(mix(ID.night, ID.paper, 0.3), ID.dawn, 0.6 * farDoor) : mix(darken(ID.copper, 0.25), ID.dawn, 0.6 * farDoor);
  const wallL = mix(mix(ID.copper, ID.paper, 0.5), ID.night, dark);
  const wallR = darken(wallL, 0.12);
  const endWall = mix(wallL, ID.dawn, dawn ? 0.18 : 0.05);
  const floor = mix(darken(ID.copper, 0.4), ID.night, dark);
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
      {farDoor > 0.01 ? <Glow cx={BRO_DOOR.x + BRO_DOOR.w / 2} cy={END.base - 90} r={200} color={ID.dawn} opacity={0.7 * farDoor} /> : null}
      <path d={archPath(BRO_DOOR.x - 10, END.base, BRO_DOOR.w + 20, BRO_DOOR.h + 12)} fill={darken(ID.copper, 0.45)} stroke={INK} strokeWidth={2.4} />
      <path d={archPath(BRO_DOOR.x, END.base, BRO_DOOR.w, BRO_DOOR.h)} fill={farCol} stroke={INK} strokeWidth={2} />
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
      {nearDoor > 0.01 ? <Glow cx={160} cy={wallFloorL(160) - 160} r={260} color={ID.dawn} opacity={0.6 * nearDoor} /> : null}
      <path d={heroDoorPath} fill={nearCol} stroke={INK} strokeWidth={4} />
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
export const LaneWalker: React.FC<{ frame: number; d0: number; d1: number; start: number; end: number; flip?: boolean; reverse?: boolean; carry?: boolean }> = ({ frame, d0, d1, start, end, flip, reverse = false, carry = true }) => {
  const t = prog(frame, start, end, (x) => x);
  const d = d0 + (d1 - d0) * t;
  const walking = frame > start && frame < end;
  const pose = walking ? walkPose(CARRY, ((frame - start) / 30) * Math.PI * 2) : CARRY;
  return <LaneHero d={d} pose={pose} frame={frame} flip={flip} reverse={reverse} carry={carry} />;
};
/** البطل على الطريق؛ والظرف في يده (carry) من الفصل نفسه: لم يُسلَّم بعد */
export const LaneHero: React.FC<{ d: number; pose: PoseSpec; frame: number; flip?: boolean; reverse?: boolean; carry?: boolean }> = ({ d, pose, frame, flip, reverse = false, carry = true }) => {
  const p = lanePos(reverse ? 1 - d : d);
  const h = handAt(pose, { x: p.x, y: p.y, scale: p.s, flip });
  return (
    <g>
      <Figure x={p.x} y={p.y} scale={p.s} pose={pose} look={hero} flip={flip} frame={frame} />
      {carry ? <EnvelopeGlyph x={h.x} y={h.y} s={p.s} /> : null}
    </g>
  );
};

/** يمشي بوضعية أساسية تحمل شيئًا في اليد (يُرسم بـdraw عند الكف) */
const WalkHold: React.FC<{ frame: number; from: number; to: number; start: number; end: number; y: number; scale: number; flip?: boolean; base: PoseSpec; draw?: (h: { x: number; y: number }) => React.ReactNode }> = ({ frame, from, to, start, end, y, scale, flip, base, draw }) => {
  const t = prog(frame, start, end, (v) => v);
  const x = from + (to - from) * t;
  const walking = frame > start && frame < end;
  const pose = walking ? walkPose(base, ((frame - start) / 30) * Math.PI * 2) : base;
  const h = handAt(pose, { x, y, scale, flip });
  return (
    <g>
      <Figure x={x} y={y} scale={scale} pose={pose} look={hero} flip={flip} frame={frame} />
      {draw ? draw(h) : null}
    </g>
  );
};
/** موضع القطعة في فم القط الجالس عند x (مطابق لرسم Cat) */
const catMouth = (x: number) => ({ x: x + 50 * 1.3, y: GROUND + 4 - 57 * 1.3 });
const HOLD_PAGE = (head: number): PoseSpec => ({ ...POSES.hold, head });

export const CH3_SHOTS: Record<string, Ch3Shot> = {
  // ——— أ. الصفحة الممزقة ———
  "home-accuse-brother": {
    nameAr: "غرفة الجلوس: يرفع الصفحة الممزقة في وجه أخيه متهمًا",
    place: "بيت العائلة غروبًا",
    render: ({ frame, at, portrait }) => {
      // الاتهام بالدليل: يرفع الصفحة الناقصة الزاوية نحو أخيه عند «اختلفت»، والأخ يفتح كفيه؛ عند «قريب» تتسع اللقطة فتضيء صورهما.
      const tA = at("اختلفت", 0.28);
      const tQ = at("قريب", 0.64);
      const pose = tlPose(frame, [[0, HOLD_PAGE(10)], [tA - 6, SHOW], [tQ + 10, HOLD_PAGE(2)]]);
      const pg = pageAtHand(handAt(pose, { x: ROOM.hero, y: GROUND + 8, scale: 1.2, flip: true }), 1.2, true);
      return {
        cam: portrait ? [V(0, 750, 1.15, 560), V(tQ - 6, 700, 0.9, 500)] : [K(0, 760, 1.6), K(tQ - 6, 700, 1.15)],
        world: (
          <g>
            <HomeRoom frame={frame} mood="dusk" frames={prog(frame, tQ - 4, tQ + 14)} />
            <Bag x={ROOM.bag} />
            <Figure x={ROOM.brother} y={GROUND + 8} scale={1.24} pose={tlPose(frame, [[0, POSES.listen], [tA + 6, POSES.talk], [tQ, { ...POSES.talk, head: 14 }]])} look={CH3_CAST.brother} frame={frame + 7} />
            <Figure x={ROOM.hero} y={GROUND + 8} scale={1.2} pose={pose} look={hero} flip frame={frame} />
            <PageGlyph x={pg.x} y={pg.y} s={PAGE_S} glow={0.6 * prog(frame, tA - 4, tA + 10) * (1 - prog(frame, tQ, tQ + 14))} />
          </g>
        ),
      };
    },
  },
  "home-cat-reveals": {
    nameAr: "غرفة الجلوس: يأخذ من أخيه نقودًا، ثم يخرج القط وفي فمه القطعة الناقصة",
    place: "بيت العائلة غروبًا",
    render: ({ frame, at, portrait }) => {
      // الصفحة في يده الأخرى طوال المشهد. «مقتنعًا»: يرفع رأسه. «أخطأ في حقك»: يمد كفه فتنتقل النقود من يد أخيه إليها (لقطة قريبة).
      // «ظهرت»: يخرج القط من خلف المكتبة وفي فمه قطعة بشكل الزاوية الناقصة. «أسأت»: ينظر البطل إليه ويده بالنقود تنزل.
      const tC = at("مقتنعا", 0.08);
      const tW = at("أخطأ", 0.22);
      const tK = at("حقك", 0.32);
      const tI = at("ظهرت", 0.42);
      const tU = at("أسأت", 0.72);
      const heroPose = tlPose(frame, [[0, PAGE_LOW], [tC, { ...PAGE_LOW, head: -16, lean: -4 }], [tW - 6, PALM], [tK + 14, { ...PAGE_LOW, armFront: { s: 30, e: 40 }, head: -6 }], [tU, { ...PAGE_LOW, armFront: { s: 24, e: 30 }, head: 26, lean: 6 }]]);
      const broPose = tlPose(frame, [[0, POSES.talk], [tW, GIVE], [tK + 10, { ...POSES.stand, head: 24 }], [tU + 6, { ...POSES.stand, head: 10 }]]);
      const hf = handAt(heroPose, { x: ROOM.hero, y: GROUND + 8, scale: 1.2, flip: true });
      const hb = handAt(heroPose, { x: ROOM.hero, y: GROUND + 8, scale: 1.2, flip: true, front: false });
      const bh = handAt(broPose, { x: ROOM.brother, y: GROUND + 8, scale: 1.24 });
      const pass = prog(frame, tW + 4, tK + 2);
      const coins = frame >= tW ? { x: bh.x + (hf.x - bh.x) * pass, y: bh.y + (hf.y - bh.y) * pass } : null;
      const pg = pageAtHand(hb, 1.2, true);
      const catX = 300 + 220 * prog(frame, tI - 4, tI + 34);
      const walking = frame >= tI - 4 && frame < tI + 34;
      return {
        cam: portrait
          ? [V(0, 820, 1.2, 560), V(tW - 6, 760, 1.6, 640), V(tI - 8, 430, 1.2, 640), V(tU - 6, 700, 0.95, 560)]
          : [K(0, 780, 1.6), V(tW - 6, 760, 2.3, 640), K(tI - 8, 520, 1.5), K(tU - 6, 700, 1.3)],
        world: (
          <g>
            <HomeRoom frame={frame} mood="dusk" />
            <Bag x={ROOM.bag} />
            {frame >= tI - 4 ? <Cat x={catX} frame={frame} walk={walking} sit={prog(frame, tI + 34, tI + 44)} scrap={1} glow={prog(frame, tI + 4, tI + 20)} /> : null}
            <Figure x={ROOM.brother} y={GROUND + 8} scale={1.24} pose={broPose} look={CH3_CAST.brother} frame={frame + 7} />
            <Figure x={ROOM.hero} y={GROUND + 8} scale={1.2} pose={heroPose} look={hero} flip frame={frame} />
            <PageGlyph x={pg.x} y={pg.y} s={PAGE_S} />
            {coins ? <CoinsGlyph x={coins.x} y={coins.y} glint={prog(frame, tW + 2, tW + 10) * (1 - prog(frame, tK + 4, tK + 16))} /> : null}
          </g>
        ),
      };
    },
  },
  "home-brother-leaves": {
    nameAr: "غرفة الجلوس: يخرج الأخ، ويأخذ البطل القطعة من القط فتنطبق على زاوية الصفحة",
    place: "بيت العائلة غروبًا",
    render: ({ frame, at, portrait }) => {
      // الدليل لا مجرد ظهور القط: يأخذ القطعة من فم القط، وعند «معرفة» يضعها في الزاوية الناقصة فتنطبق (لقطة قريبة للكفين).
      const tM = at("معرفة", 0.58);
      const tT = 34;
      const heroX = 650;
      const REACH: PoseSpec = { ...POSES.point, lean: 22, head: 26, armFront: { s: 40, e: 10 }, armBack: { s: 30, e: 40 }, ...KNEEL };
      const FIT: PoseSpec = { ...POSES.stand, ...KNEEL, lean: 10, head: 30, armFront: { s: 62, e: 40 }, armBack: { s: 54, e: 54 } };
      const pose = tlPose(frame, [[0, { ...PAGE_LOW, head: 24 }], [tT - 14, REACH], [tM - 24, FIT]]);
      const o = { x: heroX, y: GROUND + 8, scale: 1.2, flip: true };
      const hf = handAt(pose, o);
      const pg = pageAtHand(handAt(pose, { ...o, front: false }), 1.2, true);
      const pgFit = pageAtHand(handAt(FIT, { ...o, front: false }), 1.2, true);
      const taken = frame >= tT;
      const lift = prog(frame, tT, tT + 8);
      const mouth = catMouth(520);
      const pieceFrom = taken ? { x: mouth.x + (hf.x - mouth.x) * lift, y: mouth.y + (hf.y - 12 - mouth.y) * lift } : undefined;
      const fit = prog(frame, tM - 6, tM + 6);
      return {
        cam: portrait ? [V(0, 420, 1.0, 560), V(40, 600, 1.2, 660), V(tM - 10, pgFit.x, 3.0, pgFit.y)] : [K(0, 400, 1.3), K(30, 600, 1.9), V(tM - 10, pgFit.x, 3.6, pgFit.y)],
        world: (
          <g>
            <HomeRoom frame={frame} mood="dusk" door={0.55 * prog(frame, 40, 70)} />
            <Bag x={ROOM.bag} />
            <Cat x={520} frame={frame} sit={1} scrap={taken ? 0 : 1} />
            {frame < 60 ? <Walker frame={frame} from={ROOM.brother} to={-120} y={GROUND + 8} start={4} end={60} look={CH3_CAST.brother} scale={1.24} /> : null}
            <Figure x={heroX} y={GROUND + 8} scale={1.2} pose={pose} look={hero} flip frame={frame} />
            <PageGlyph x={pg.x} y={pg.y} s={PAGE_S} piece={fit} pieceFrom={fit < 1 ? pieceFrom : undefined} glow={0.7 * prog(frame, tM, tM + 8)} />
          </g>
        ),
      };
    },
  },
  "home-standpoint": {
    nameAr: "غرفة الجلوس: الصفحة كاملة في يده، بين الباب والنافذة",
    place: "بيت العائلة غروبًا",
    render: ({ frame, at, portrait }) => {
      // عرف ما حدث (الصفحة مكتملة)؛ الآن موقفه: الباب المضاء يسارًا والنافذة يمينًا. عند «عرفت» ينظر إلى الباب، دون إيماءة.
      const tK = at("عرفت", 0.6);
      const pose = tlPose(frame, [[0, HOLD_PAGE(22)], [tK, HOLD_PAGE(4)]]);
      const flip = frame >= tK;
      const pg = pageAtHand(handAt(pose, { x: 700, y: GROUND + 8, scale: 1.2, flip }), 1.2, flip);
      return {
        cam: portrait ? [V(0, 700, 0.9, 540), V(tK - 6, 420, 1.1, 560)] : [K(0, 820, 1.0), K(tK - 6, 560, 1.35)],
        world: (
          <g>
            <HomeRoom frame={frame} mood="dusk" door={0.55} />
            <Bag x={ROOM.bag} />
            <Cat x={520} frame={frame} sit={1} />
            <Figure x={700} y={GROUND + 8} scale={1.2} pose={pose} look={hero} flip={flip} frame={frame} />
            <PageGlyph x={pg.x} y={pg.y} s={PAGE_S} piece={1} />
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
      const base = HOLD_PAGE(frame >= walkEnd ? 26 : 8);
      return {
        cam: portrait ? [V(0, 420, 1.1, 560)] : [K(0, 420, 1.4), K(walkEnd, 330, 1.6)],
        world: (
          <g>
            <HomeRoom frame={frame} mood="dusk" door={0.55 + 0.4 * prog(frame, tA - 4, tA + 16)} />
            <Bag x={ROOM.bag} />
            <Cat x={520} frame={frame} sit={1} />
            <WalkHold frame={frame} from={700} to={420} start={tA} end={walkEnd} y={GROUND + 8} scale={1.2} flip base={base} draw={(h) => { const pg = pageAtHand(h, 1.2, true); return <PageGlyph x={pg.x} y={pg.y} s={PAGE_S} piece={1} />; }} />
          </g>
        ),
      };
    },
  },
  "page-paw-insert": {
    nameAr: "الصفحة قريبة: آثار مخالب القط كانت عليها من البداية",
    place: "بيت العائلة: الصفحة في يده",
    render: ({ frame, at, portrait }) => {
      // الصفحة نفسها مكتملة بخط الوصل، وآثار المخالب الخافتة (موجودة منذ المشهد الأول) تضيء عند «حكمك»؛
      // عند «متعجلًا» قطع إليه يخفض رأسه والصفحة في يده.
      const tH = at("حكمك", 0.4);
      const tJ = at("متعجلا", 0.65);
      const pose = HOLD_PAGE(34);
      const pg = pageAtHand(handAt(pose, { x: 420, y: GROUND + 8, scale: 1.2, flip: true }), 1.2, true);
      return {
        cam: portrait ? [V(0, PAGE.x, 0.85, PAGE.y), V(tJ - 2, 420, 1.4, 600, true)] : [V(0, PAGE.x, 1.4, PAGE.y), V(tJ - 2, 420, 1.8, 560, true)],
        world: (
          <g>
            <HomeRoom frame={frame} mood="dusk" door={0.6} />
            <Bag x={ROOM.bag} />
            <Figure x={420} y={GROUND + 8} scale={1.2} pose={pose} look={hero} flip frame={frame} />
            <PageGlyph x={pg.x} y={pg.y} s={PAGE_S} piece={1} paws={0.6} />
            <PageInsert paws={prog(frame, tH - 4, tH + 12)} />
          </g>
        ),
      };
    },
  },
  "home-window-excuse": {
    nameAr: "عند النافذة المفتوحة: يلمس الدرفة باحثًا عن تفسير، ثم يخفي الصفحة خلف ظهره",
    place: "بيت العائلة غروبًا",
    render: ({ frame, at, portrait }) => {
      // لا إشارة اتهام جديدة: عند «تفسير» يضع كفه على الدرفة المفتوحة (لو أُغلقت ما دخل القط)، وعند «يحفظ» يلتفت إلى الغرفة،
      // وعند «السابق» يعقد يديه خلف ظهره والصفحة فيهما (يخفي الدليل).
      const tE = at("تفسير", 0.25);
      const tK = at("يحفظ", 0.46);
      const tP = at("السابق", 0.74);
      const o = { x: 1300, y: GROUND + 8, scale: 1.2 };
      const TOUCH = reachTo({ x: 1384, y: 452 }, o, { ...PAGE_LOW, lean: 16, head: -12 });
      const pose = tlPose(frame, [[0, PAGE_LOW], [tE - 8, TOUCH], [tK, { ...PAGE_LOW, head: 4 }], [tP, POSES.proud]]);
      const flip = frame >= tK;
      const hidden = frame >= tP;
      const pg = pageAtHand(handAt(pose, { ...o, flip, front: false }), 1.2, flip);
      return {
        cam: portrait ? [V(0, 1420, 1.1, 520), V(tK - 6, 1330, 1.1, 560)] : [K(0, 1400, 1.6, -40), K(tK - 6, 1300, 1.35)],
        world: (
          <g>
            <HomeRoom frame={frame} mood="dusk" door={0.4} />
            <OpenShutter glow={prog(frame, tE - 4, tE + 12) * (1 - 0.5 * prog(frame, tK, tK + 20))} />
            <Figure x={1300} y={GROUND + 8} scale={1.2} pose={pose} look={hero} flip={flip} frame={frame} />
            {hidden ? null : <PageGlyph x={pg.x} y={pg.y} s={PAGE_S} piece={1} />}
          </g>
        ),
      };
    },
  },
  "home-turns-from-evidence": {
    nameAr: "غرفة الجلوس: القط والصفحة حاضران، ويعرض عنهما لأن قبولهما يفرض عليه الذهاب",
    place: "بيت العائلة غروبًا",
    render: ({ frame, at, portrait }) => {
      // يداه خلف ظهره والصفحة فيهما؛ عند «أدلتها» يضيء القط ويضيء ما بين يديه (الأدلة حاضرة لا غائبة)؛
      // عند «يفرض» يشتد ضوء الباب، يلتفت إليه ثم يبتعد عند «نريده».
      const tE = at("أدلتها", 0.33);
      const tF = at("يفرض", 0.65);
      const tN = at("نريده", 0.87);
      const evidence = prog(frame, tE - 6, tE + 12);
      const glance = frame >= tF + 6 && frame < tN - 4;
      const heroX = 1080 + 140 * prog(frame, tN - 4, tN + 22);
      const hb = handAt(POSES.proud, { x: heroX, y: GROUND + 8, scale: 1.2, flip: glance, front: false });
      return {
        cam: portrait
          ? [V(0, 1100, 1.2, 560), V(tE - 8, 760, 1.0, 620), V(tF - 6, 150, 1.0, 560), V(tF + 10, 1120, 1.2, 560)]
          : [K(0, 1080, 1.5), K(tE - 8, 800, 1.15), K(tF - 6, 650, 0.95), K(tN - 4, 1150, 1.5)],
        world: (
          <g>
            <HomeRoom frame={frame} mood="dusk" door={0.4 + 0.55 * prog(frame, tF - 4, tF + 12)} />
            <Bag x={ROOM.bag} />
            <Cat x={520} frame={frame} sit={1} glow={evidence} />
            <Glow cx={hb.x} cy={hb.y} r={90} color={ID.dawn} opacity={0.6 * evidence * (1 - prog(frame, tF, tF + 20))} />
            <Figure x={heroX} y={GROUND + 8} scale={1.2} pose={glance ? { ...POSES.proud, head: 10 } : POSES.proud} look={hero} flip={glance} frame={frame} />
          </g>
        ),
      };
    },
  },

  // ——— ب. ثمن الاعتراف ———
  "lane-knock-hesitates": {
    nameAr: "الزقاق غروبًا: عند باب أخيه، ترتفع يده لتطرق ثم تتوقف وتنزل",
    place: "الزقاق بين البيتين غروبًا",
    render: ({ frame, at, portrait }) => {
      // التردد: ترتفع اليد عند «يتطلب»، تتوقف قرب الباب حتى «اعتذارًا»، ثم تنزل ببطء ويتراجع خطوة صغيرة؛ لم يطرق.
      const tR = at("يتطلب", 0.45);
      const tA = at("اعتذارا", 0.58);
      const d = 0.92 - 0.035 * prog(frame, tA + 20, tA + 40);
      return {
        cam: portrait ? [V(0, 950, 1.3, 480), V(tR - 6, 950, 1.75, 470)] : [V(0, 940, 1.8, 470), V(tR - 6, 945, 2.5, 470)],
        world: (
          <g>
            <Lane frame={frame} mood="dusk" lit={0} heroDoor={0} brotherDoor={0.2} />
            <LaneHero d={d} carry={false} pose={tlPose(frame, [[0, { ...POSES.stand, head: 8 }], [tR - 8, KNOCK], [tA + 8, { ...KNOCK, head: 12 }], [tA + 16, { ...POSES.stand, head: 22, armFront: { s: 8, e: 12 } }]])} frame={frame} />
          </g>
        ),
      };
    },
  },
  "home-unpack-bag": {
    nameAr: "غرفة الجلوس: يفتح الحقيبة التي حزمها ليترك البيت ويعيد ثيابه إلى الرف",
    place: "بيت العائلة غروبًا",
    render: ({ frame, at, portrait }) => {
      // تغيير القرار بفعل منطقي: الحقيبة عند الباب (قرار الرحيل)؛ يفتحها عند «تغيير»، ويخرج ثوبًا مطويًا عند «قرار»،
      // ثم يقوم ويضعه على رف المكتبة: باقٍ في البيت.
      const tC = at("تغيير", 0.32);
      const tQ = at("قرار", 0.5);
      const o = { x: 300, y: GROUND + 8, scale: 1.2, flip: true };
      const AT_BAG = reachTo({ x: 190, y: GROUND - 70 }, o, { ...POSES.stand, ...KNEEL, lean: 20, head: 30 });
      const AT_SHELF = reachTo({ x: 250, y: GROUND - 236 }, o, { ...POSES.stand, lean: 6, head: 6 });
      const pose = tlPose(frame, [[0, { ...POSES.stand, ...KNEEL, head: 24 }], [tC - 10, AT_BAG], [tQ + 6, { ...POSES.stand, head: 10, armFront: { s: 60, e: 40 } }], [tQ + 20, AT_SHELF]]);
      const h = handAt(pose, o);
      const held = frame >= tQ - 2 && frame < tQ + 30;
      const placed = frame >= tQ + 30;
      return {
        cam: portrait ? [V(0, 240, 1.5, 680), V(tQ - 6, 260, 1.4, 640)] : [K(0, 250, 2.0, 40), K(tQ - 6, 270, 1.85, 10)],
        world: (
          <g>
            <HomeRoom frame={frame} mood="dusk" door={0.4} />
            <Bag x={ROOM.bag} open={prog(frame, tC - 4, tC + 8)} />
            <Figure x={o.x} y={o.y} scale={1.2} pose={pose} look={hero} flip frame={frame} />
            {held ? <Garment x={h.x - 10} y={h.y + 4} /> : null}
            {placed ? <Garment x={250} y={GROUND - 228} /> : null}
          </g>
        ),
      };
    },
  },
  "home-coins-returned": {
    nameAr: "عند الخزانة: يضع النقود في ظرف ويغلقه، ويبقى الظرف في يده (لم يُرد بعد)",
    place: "بيت العائلة غروبًا",
    render: ({ frame, at, portrait }) => {
      // التخلي عن المصلحة نية وتهيئة لا تسليم: النقود تسقط في الظرف عند «التخلي»، ويُغلق عند «مصلحة»،
      // ثم يرفعه ويمسكه وينظر نحو الباب (جهة بيت أخيه)؛ الأخ لم يستلم شيئًا.
      const tG = at("التخلي", 0.32);
      const tM = at("مصلحة", 0.58);
      const o = { x: 1110, y: GROUND + 8, scale: 1.2 };
      const P: PoseSpec = { ...POSES.point, lean: 10, head: 24, armFront: { s: 70, e: 26 } };
      const picked = frame >= tM + 14;
      const pose = tlPose(frame, [[0, POSES.hold], [tG - 12, P], [tM + 6, P], [tM + 14, CARRY], [tM + 26, { ...CARRY, head: 4 }]]);
      const flip = frame >= tM + 26;
      const h = handAt(pose, { ...o, flip });
      const drop = prog(frame, tG, tG + 12);
      return {
        cam: portrait ? [V(0, 1160, 1.5, 600), V(tG - 6, 1180, 1.6, 610), V(tM + 20, 1120, 1.3, 600)] : [K(0, 1160, 2.0, -20), K(tG - 6, 1180, 2.15, -10), K(tM + 20, 1100, 1.7)],
        world: (
          <g>
            <HomeRoom frame={frame} mood="dusk" door={0.4} />
            {picked ? null : <Envelope x={ROOM.envelope} flap={1 - prog(frame, tM - 4, tM + 6)} glow={prog(frame, tG, tG + 10)} />}
            {frame < tG ? <CoinsGlyph x={h.x} y={h.y} /> : drop < 1 ? <CoinsGlyph x={h.x + (ROOM.envelope + 42 - h.x) * drop} y={h.y + (GROUND - 200 - h.y) * drop} /> : null}
            <Figure x={o.x} y={o.y} scale={1.2} pose={pose} look={hero} flip={flip} frame={frame} />
            {picked ? <EnvelopeGlyph x={h.x} y={h.y} s={1.2} /> : null}
          </g>
        ),
      };
    },
  },
  "night-window-reflection": {
    nameAr: "الغرفة ليلًا: أمام زجاج الباب الطويل يرى نفسه، ويقول لنفسه بهدوء: لقد أخطأت",
    place: "بيت العائلة ليلًا",
    render: ({ frame, at, portrait }) => {
      // اعتراف هادئ بلا انكسار: يرفع رأسه إلى انعكاسه عند «لنفسه»، ويضع كفه على صدره ورأسه منخفض قليلًا عند «لقد أخطأت»؛
      // والانعكاس بالحجم والارتفاع نفسهما يفعل الشيء نفسه معكوس الوجهة.
      const tS = at("لنفسه", 0.55);
      const tW = at("لقد", 0.7);
      const pose = tlPose(frame, [[0, { ...POSES.stand, head: 22 }], [tS - 6, { ...POSES.stand, head: 0 }], [tW, { ...POSES.sincere, head: 12 }]]);
      return {
        captionBackdrop: 0.3,
        cam: portrait ? [V(0, 1500, 1.0, 600), V(tW - 6, 1500, 1.15, 620)] : [V(0, 1500, 1.45, 620), V(tW - 6, 1500, 1.7, 640)],
        world: (
          <g>
            <HomeRoom frame={frame} mood="night" />
            <TallGlass />
            <Reflection pose={pose} frame={frame} id="c3s12-refl" />
            <TallGlassFrame />
            <Figure x={HERO_AT_GLASS} y={GROUND + 8} scale={1.2} pose={pose} look={hero} frame={frame} rim={0.45} rimColor={ID.paper} />
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
      cam: portrait ? [V(0, 1500, 1.1, 610)] : [V(0, 1500, 1.6, 630)],
      world: (
        <g>
          <HomeRoom frame={0} mood="night" />
          <TallGlass />
          <Reflection pose={{ ...POSES.stand, head: 14 }} frame={0} id="c3-still-refl" />
          <TallGlassFrame />
          <Figure x={HERO_AT_GLASS} y={GROUND + 8} scale={1.2} pose={{ ...POSES.stand, head: 14 }} look={hero} frame={0} rim={0.45} rimColor={ID.paper} />
        </g>
      ),
    }),
  },

  // ——— د. الطريق إلى الباب: خمسة تأطيرات ———
  "lane-two-doors": {
    nameAr: "الزقاق فجرًا (عريضة): بابه قريب وباب أخيه في صدر الزقاق، والظرف في يده",
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
            {out > 0.01 ? <g opacity={Math.min(1, out * 2)}><LaneHero d={0} pose={{ ...CARRY, head: -4 }} frame={frame} /></g> : null}
          </g>
        ),
      };
    },
  },
  "lane-path-lights": {
    nameAr: "الزقاق فجرًا (منخفضة على الطريق): تضيء الحجارة من قدميه إلى باب أخيه (أن نعرف الحق)",
    place: "الزقاق بين البيتين فجرًا",
    render: ({ frame, at, portrait }) => {
      // معرفة الطريق: الكاميرا منخفضة عند قدميه والحجارة تضيء واحدة بعد أخرى نحو صدر الزقاق؛ يرفع رأسه عند «الحق».
      const tK = at("نعرف", 0.15);
      const tH = at("الحق", 0.35);
      const lit = prog(frame, tK - 4, tH + 30, (t) => t);
      return {
        cam: portrait ? [V(0, 500, 1.2, 860), V(tK + 10, 720, 1.2, 760), V(tK + 34, 900, 1.3, 640)] : [V(0, 640, 1.6, 860), V(tH + 10, 700, 1.5, 820)],
        world: (
          <g>
            <Lane frame={frame} mood="dawn" lit={lit} heroDoor={0.6} brotherDoor={0.6} />
            <LaneHero d={0} pose={{ ...CARRY, head: frame >= tH ? -12 : 10 }} frame={frame} />
          </g>
        ),
      };
    },
  },
  "lane-first-step": {
    nameAr: "الزقاق فجرًا (قريبة): يضم الظرف إلى صدره ثم يخطو أول خطوة",
    place: "الزقاق بين البيتين فجرًا",
    render: ({ frame, at, portrait }) => {
      // الاستعداد ثم الخطوة الأولى: عند «مستعدين» يرفع الظرف إلى صدره (قريبة على الجذع والكف)، وعند «للعمل» يخطو إلى أول حجر.
      const tR = at("مستعدين", 0.3);
      const tW = at("للعمل", 0.55);
      const READY: PoseSpec = { ...POSES.stand, head: 8, armFront: { s: 64, e: 86 } };
      const stepping = frame >= tW && frame < tW + 22;
      return {
        cam: portrait ? [V(0, 360, 1.7, 680), V(tW - 4, 420, 1.2, 800)] : [V(0, 380, 2.3, 660), V(tW - 4, 470, 1.6, 800)],
        world: (
          <g>
            <Lane frame={frame} mood="dawn" lit={1} heroDoor={0.6} brotherDoor={0.6} />
            {stepping ? (
              <LaneWalker frame={frame} d0={0} d1={0.1} start={tW} end={tW + 22} />
            ) : (
              <LaneHero d={frame < tW ? 0 : 0.1} pose={tlPose(frame, [[0, CARRY], [tR - 6, READY], [tW + 22, { ...CARRY, lean: 6 }]])} frame={frame} />
            )}
          </g>
        ),
      };
    },
  },
  "lane-standing-still": {
    nameAr: "الزقاق فجرًا (من خلفه): يمشي حجرين ثم يقف والطريق المضيء طويل أمامه",
    place: "الزقاق بين البيتين فجرًا",
    render: ({ frame, at, portrait }) => {
      // التوقف رغم المعرفة: يتقدم قليلًا ثم يقف عند «تضمن»، والكاميرا تتجه إلى ما بقي من الطريق لا إليه.
      const tS = at("تضمن", 0.45);
      const walking = frame >= 6 && frame < tS;
      return {
        cam: portrait ? [V(0, 560, 1.0, 760), V(tS, 820, 0.95, 640)] : [V(0, 700, 1.3, 720), V(tS, 830, 1.4, 650)],
        world: (
          <g>
            <Lane frame={frame} mood="dawn" lit={1} heroDoor={0.6} brotherDoor={0.7} />
            {walking ? <LaneWalker frame={frame} d0={0.1} d1={0.3} start={6} end={tS} /> : <LaneHero d={frame < 6 ? 0.1 : 0.3} pose={{ ...CARRY, head: 6 }} frame={frame} />}
          </g>
        ),
      };
    },
  },
  "lane-pride-turns": {
    nameAr: "الزقاق فجرًا (اللقطة المقابلة من عند باب أخيه): يقترب ثم يرفع رأسه ويعود إلى بيته والظرف في يده",
    place: "الزقاق بين البيتين فجرًا",
    render: ({ frame, at, portrait }) => {
      // التراجع: الكاميرا الآن عند باب أخيه وبيته في صدر الزقاق. يقترب (يكبر) حتى «واجب» فيضيء باب أخيه القريب،
      // ويرفع رأسه عند «يمنعه»، ويستدير عائدًا نحو بيته البعيد عند «الكبر»، والظرف لم يُسلَّم.
      const tK = at("يعرف", 0.08);
      const tD = at("واجب", 0.5);
      const tS = at("يمنعه", 0.72);
      const tP = at("الكبر", 0.82);
      const approach = frame >= tK && frame < tD - 6;
      const retreat = frame >= tP + 4;
      return {
        cam: portrait ? [V(0, 760, 1.15, 660), V(tS - 6, 660, 1.6, 700)] : [V(0, 760, 1.2, 640), V(tS - 6, 680, 1.75, 690)],
        world: (
          <g>
            <Lane frame={frame} mood="dawn" lit={1} heroDoor={0.6} brotherDoor={0.6 + 0.35 * prog(frame, tD - 4, tD + 12)} reverse />
            {approach ? (
              <LaneWalker frame={frame} d0={0.3} d1={0.5} start={tK} end={tD - 6} reverse flip />
            ) : retreat ? (
              <LaneWalker frame={frame} d0={0.5} d1={0.36} start={tP + 4} end={tP + 40} reverse />
            ) : (
              <LaneHero d={frame < tK ? 0.3 : 0.5} reverse flip={frame < tP} pose={tlPose(frame, [[0, CARRY], [tD - 6, { ...CARRY, head: -6 }], [tS, { ...CARRY, head: -18, lean: -6 }]])} frame={frame} />
            )}
          </g>
        ),
      };
    },
  },
  "night-sweets-habit": {
    nameAr: "الغرفة ليلًا: يقرر ترك صحن الحلوى فيبتعد عنه، ثم يتوقف ويعود إليه",
    place: "بيت العائلة ليلًا",
    render: ({ frame, at, portrait }) => {
      // الصراع مقروء: «ترك» يضع الغطاء ويدفع الصحن إلى الخلف (القرار)، «سيئة» يمشي مبتعدًا، «ثم» يتوقف ويلتفت،
      // «تغلبه» يعود، «شهوته» تتردد يده فوق الغطاء لحظة ثم يرفعه ويأخذ حبة.
      const tL = at("ترك", 0.34);
      const tA = at("سيئة", 0.5);
      const tT = at("ثم", 0.62);
      const tO = at("تغلبه", 0.67);
      const tS = at("شهوته", 0.79);
      const lid = prog(frame, tL - 8, tL + 2) * (1 - prog(frame, tS + 10, tS + 18));
      const jarX = ROOM.jar + 90 * prog(frame, tL + 2, tL + 14);
      const atJar = 1060;
      const away = 860;
      const reach = (x: number): PoseSpec => reachTo({ x, y: GROUND - 260 }, { x: atJar, y: GROUND + 8, scale: 1.2 }, { ...POSES.stand, lean: 8, head: 22 });
      const leaving = frame >= tA - 6 && frame < tA + 18;
      const returning = frame >= tO && frame < tO + 18;
      const x = frame < tA - 6 ? atJar : frame < tO ? away : atJar;
      const hover = reach(ROOM.jar + 90);
      const pose = tlPose(frame, [[0, { ...POSES.stand, head: 18 }], [tL - 12, reach(ROOM.jar)], [tL + 16, { ...POSES.stand, head: 6 }], [tO + 18, { ...POSES.stand, head: 18 }], [tS - 6, { ...hover, armFront: { s: hover.armFront.s - 14, e: hover.armFront.e } }], [tS + 8, hover], [tS + 22, POSES.hold]]);
      const flip = (frame >= tL + 16 && frame < tT) || leaving;
      const h = handAt(pose, { x, y: GROUND + 8, scale: 1.2, flip });
      return {
        cam: portrait ? [V(0, 1100, 1.2, 600), V(tO, 1150, 1.45, 610)] : [K(0, 1060, 1.45, -10), K(tO, 1150, 1.85, -10)],
        world: (
          <g>
            <HomeRoom frame={frame} mood="night" />
            <SweetJar x={jarX} lid={lid} glow={0.6 * prog(frame, tT - 4, tT + 10) * (1 - prog(frame, tS + 18, tS + 30))} />
            {leaving ? (
              <Walker frame={frame} from={atJar} to={away} y={GROUND + 8} start={tA - 6} end={tA + 18} look={hero} scale={1.2} />
            ) : returning ? (
              <Walker frame={frame} from={away} to={atJar} y={GROUND + 8} start={tO} end={tO + 18} look={hero} scale={1.2} />
            ) : (
              <Figure x={x} y={GROUND + 8} scale={1.2} pose={pose} look={hero} flip={flip} frame={frame} />
            )}
            {frame >= tS + 18 && !leaving && !returning ? <circle cx={h.x + 4} cy={h.y - 6} r={9} fill={mix(darken(ID.copper, 0.3), ID.seal, 0.3)} stroke={INK} strokeWidth={1.8} /> : null}
          </g>
        ),
      };
    },
  },
  "lane-dawn-still": {
    nameAr: "الزقاق قبيل الفجر ساكنًا: مصابيح الليل ما زالت مضاءة، وهو عند عتبته والظرف في يده (سكون الدعاء)",
    place: "الزقاق بين البيتين قبيل الفجر",
    // الربط الزمني: بعد ليلة c3-s21 مباشرة، قبيل الفجر والمصابيح لم تُطفأ بعد؛ والطريق مضيء كما عرفه.
    // ذكر الهداية والدعاء: لا حدث ولا حركة كاميرا، والعالم مجمَّد
    render: ({ portrait }) => ({
      cam: portrait ? [V(0, 640, 0.75, 620)] : [V(0, 960, 1.0, 540)],
      world: (
        <g>
          <Lane frame={0} mood="predawn" lit={1} heroDoor={0.6} brotherDoor={0.5} />
          <LaneHero d={0} pose={{ ...CARRY, head: -2 }} frame={0} />
        </g>
      ),
    }),
  },
};
