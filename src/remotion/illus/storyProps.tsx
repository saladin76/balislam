import React from "react";
import { ID, darken, lighten, mix } from "./palette";
import { Glow, useSvgId } from "./world";
import { octagramPath } from "./emblems";

/**
 * عناصر قصة الأخوين في الحلقة 001 (القرار 031، الأمر 032): أشياء تحمل القصة من مشهد إلى مشهد بهوية واحدة.
 * أُعيد بناؤها من نماذج التصور المعتمدة (`handoff-031/reference/`) بمعايير المحرك: بلا مؤشر في الميزان،
 * القطع ثلاث دائمًا، الظرف بختم القناة، حافة تمزيق واحدة للدفتر والورقة، كرسي بأربع أرجل على الأرض.
 * كل عنصر يحمل سمات `data-*` بحالته، فتقرؤها الاختبارات من الرسم نفسه لا من وصفه.
 */
export const INK = darken(ID.night, 0.55);
const RED = ID.seal;
const GOLD = ID.dawn;

/* ───────── القطع الثلاث ───────── */

/** عدد القطع في القصة: ثلاث في كل ظهور (لا صُرّة ولا عدد آخر) */
export const COIN_COUNT = 3;

/** قطعة نحاسية بنقش النجمة الثمانية */
export const Coin: React.FC<{ x: number; y: number; r?: number; tilt?: number; opacity?: number }> = ({ x, y, r = 16, tilt = 1, opacity = 1 }) => (
  <g data-prop="coin" transform={`translate(${x} ${y}) scale(1 ${tilt})`} opacity={opacity}>
    <circle r={r} fill={ID.copper} stroke={darken(ID.copper, 0.45)} strokeWidth={r / 6} />
    <path d={octagramPath(0, 0, r * 0.62)} fill={lighten(ID.copper, 0.25)} stroke={darken(ID.copper, 0.35)} strokeWidth={Math.max(0.8, r / 11)} />
  </g>
);

/** مواضع القطع الثلاث حول مركزها (spread = تباعدها، 0 مكدسة) */
export const coinOffsets = (r: number, spread = 1) => [-1, 0, 1].map((k) => k * r * 2.3 * spread);

/** القطع الثلاث معًا: spread تباعدها، وlift رفعة خفيفة (عدّ أو ارتداد في الكف) */
export const ThreeCoins: React.FC<{ x: number; y: number; r?: number; spread?: number; tilt?: number; opacity?: number; lift?: number }> = ({ x, y, r = 16, spread = 1, tilt = 1, opacity = 1, lift = 0 }) => (
  <g data-prop="three-coins" data-count={COIN_COUNT} opacity={opacity}>
    {coinOffsets(r, spread).map((dx, i) => <Coin key={i} x={x + dx} y={y - (i === 1 ? lift : lift * 0.5)} r={r} tilt={tilt} />)}
  </g>
);

/* ───────── الظرف ───────── */

/**
 * الظرف الصغير بختم القناة الأحمر.
 * - open: 0 مغلق بالختم، 1 مفتوح اللسان.
 * - coins: 0 القطع داخله لا تُرى، 1 خارجة فوق فتحته (لا تُرسم القطع والظرف مغلق).
 */
export const Envelope: React.FC<{ x: number; y: number; w?: number; open?: number; coins?: number; rot?: number; glow?: number }> = ({ x, y, w = 120, open = 0, coins = 0, rot = 0, glow = 0 }) => {
  const h = w * 0.62;
  const o = Math.max(0, Math.min(1, open));
  const c = o > 0.05 ? Math.max(0, Math.min(1, coins)) : 0;
  return (
    <g data-prop="envelope" data-open={o.toFixed(2)} data-coins-out={c > 0.02 ? COIN_COUNT : 0} transform={`translate(${x} ${y}) rotate(${rot})`}>
      {glow > 0 ? <Glow cx={0} cy={0} r={w * 1.1} color={GOLD} opacity={0.55 * glow} /> : null}
      {c > 0 ? <g transform={`translate(0 ${-h * 0.5 - w * 0.2 * c})`}><ThreeCoins x={0} y={0} r={w * 0.12} tilt={0.55} opacity={Math.min(1, c * 2)} /></g> : null}
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={w * 0.035} fill={mix(ID.paper, ID.copper, 0.18)} stroke={INK} strokeWidth={Math.max(1.4, w / 40)} />
      <path d={`M${-w / 2} ${h / 2} L${-w * 0.12} ${0} M${w / 2} ${h / 2} L${w * 0.12} ${0}`} stroke={darken(ID.copper, 0.25)} strokeWidth={Math.max(1, w / 60)} />
      {o > 0.05 ? (
        <path d={`M${-w / 2} ${-h / 2} L0 ${-h / 2 - h * 0.55 * o} L${w / 2} ${-h / 2} Z`} fill={mix(ID.paper, ID.copper, 0.28)} stroke={INK} strokeWidth={Math.max(1.4, w / 40)} />
      ) : (
        <g>
          <path d={`M${-w / 2} ${-h / 2} L0 ${h * 0.08} L${w / 2} ${-h / 2}`} fill={mix(ID.paper, ID.copper, 0.24)} stroke={INK} strokeWidth={Math.max(1.2, w / 48)} />
          <circle data-seal={RED} cx={0} cy={h * 0.06} r={w * 0.1} fill={RED} stroke={darken(RED, 0.4)} strokeWidth={Math.max(1, w / 60)} />
          <path d={octagramPath(0, h * 0.06, w * 0.055)} fill={lighten(RED, 0.25)} />
        </g>
      )}
    </g>
  );
};

/* ───────── ميزان البائع ───────── */

/**
 * ميزان بائع الفاكهة: عمود وعارضة وكفتان، بلا مؤشر. الثقل المعياري المختوم في الكفة اليسرى، والفاكهة في اليمنى.
 * tilt بالدرجات، ويبقى واحدًا في كل لقطات الواقعة والتذكّر (الحكمان من المعلومة لا من الميزان).
 * weightGlow يضيء الختم (الدليل) دون أن يغير الحالة.
 */
export const VendorScale: React.FC<{ x: number; base: number; tilt?: number; s?: number; weightGlow?: number; levelGlow?: number }> = ({ x, base, tilt = 0, s = 1, weightGlow = 0, levelGlow = 0 }) => {
  const arm = 120;
  const rad = (tilt * Math.PI) / 180;
  const top = -250;
  const pan = (side: -1 | 1, children: React.ReactNode) => {
    const px = side * arm * Math.cos(rad);
    const py = top + 12 + side * arm * Math.sin(rad);
    return (
      <g transform={`translate(${px} ${py})`}>
        <path d="M0 0 L-40 92 M0 0 L40 92" stroke={darken(ID.copper, 0.2)} strokeWidth={2.4} />
        <path d="M-52 92 Q0 124 52 92 Z" fill={ID.copper} stroke={darken(ID.copper, 0.45)} strokeWidth={3} />
        <g transform="translate(0 92)">{children}</g>
      </g>
    );
  };
  return (
    <g data-prop="vendor-scale" data-tilt={tilt.toFixed(2)} transform={`translate(${x} ${base}) scale(${s})`}>
      {levelGlow > 0 ? <Glow cx={0} cy={top + 60} r={210} color={GOLD} opacity={0.5 * levelGlow} /> : null}
      <rect x={-8} y={top} width={16} height={-top} fill={darken(ID.copper, 0.15)} stroke={INK} strokeWidth={2} />
      <rect x={-40} y={-14} width={80} height={14} rx={4} fill={darken(ID.copper, 0.3)} stroke={INK} strokeWidth={2} />
      <g transform={`rotate(${tilt} 0 ${top + 12})`}>
        <rect x={-arm - 8} y={top + 6} width={(arm + 8) * 2} height={12} rx={6} fill={ID.copper} stroke={INK} strokeWidth={2} />
      </g>
      <path d={octagramPath(0, top + 12, 13)} fill={ID.copper} stroke={INK} strokeWidth={2} />
      {pan(1, (
        <g>
          {[[-22, -10], [0, -14], [22, -10], [-11, -30], [11, -30]].map(([fx, fy], i) => (
            <circle key={i} cx={fx} cy={fy} r={12} fill={i % 2 ? mix(GOLD, RED, 0.3) : mix(RED, ID.copper, 0.25)} stroke={INK} strokeWidth={2} />
          ))}
        </g>
      ))}
      {pan(-1, (
        <g data-weight="stamped">
          {weightGlow > 0 ? <Glow cx={0} cy={-24} r={60} color={GOLD} opacity={0.8 * weightGlow} /> : null}
          <path d="M-22 -2 L-16 -38 L16 -38 L22 -2 Z" fill={darken(ID.copper, 0.25)} stroke={INK} strokeWidth={2.4} />
          <circle cx={0} cy={-44} r={9} fill={darken(ID.copper, 0.25)} stroke={INK} strokeWidth={2} />
          <circle cx={0} cy={-20} r={8 + 2 * weightGlow} fill={RED} />
        </g>
      ))}
    </g>
  );
};
/** الكفتان في إحداثيات المشهد (لاختبار الحجب) */
export const scalePansBox = (x: number, base: number, s: number) => ({ lo: x - (120 + 52) * s, hi: x + (120 + 52) * s, top: base + (-250 - 10) * s, bottom: base + (-250 + 12 + 124) * s });

/* ───────── الدفتر والورقة والخدوش ───────── */

/** آثار مخالب طبيعية: ثلاثة خطوط منحنية متفاوتة مستدقة؛ باهتة أولًا وواضحة في المقارنة */
export const CLAW_STROKES = ["M0 0 q5 9 4 17 q-1 8 -3 14", "M10 -4 q9 14 6 26 q-2 6 -1 10", "M21 5 q3 7 2 13"] as const;
export const Claws: React.FC<{ x: number; y: number; s?: number; rot?: number; clear?: boolean }> = ({ x, y, s = 1, rot = 0, clear = false }) => {
  const col = clear ? mix(RED, INK, 0.25) : mix(ID.paper, mix(RED, INK, 0.3), 0.32);
  const widths = [3.4, 2.9, 2.2];
  return (
    <g data-claws={clear ? "clear" : "faint"} transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      {CLAW_STROKES.map((d, i) => (
        <g key={i}>
          <path d={d} fill="none" stroke={col} strokeWidth={(clear ? widths[i]! : widths[i]! * 0.55) + 1.4} strokeLinecap="round" opacity={clear ? 0.35 : 0.2} />
          <path d={d} fill="none" stroke={col} strokeWidth={clear ? widths[i]! : widths[i]! * 0.55} strokeLinecap="round" />
        </g>
      ))}
    </g>
  );
};

/** حافة التمزيق المشتركة: الحافة نفسها على بقية الصفحة في الدفتر وعلى الورقة المنزوعة */
export const TEAR: readonly (readonly [number, number])[] = [[0, -62], [-6, -52], [3, -44], [-5, -34], [4, -24], [-4, -14], [3, -4], [0, 6]];
export const tearPath = (dx = 0, lead: "M" | "L" = "M") => TEAR.map(([x, y], i) => `${i ? "L" : lead}${x + dx} ${y}`).join(" ");

const LINES = [-50, -36, -22];

/** صفحة منزوعة: حافتها اليمنى (جهة الكعب) هي حافة التمزيق المشتركة */
export const TornLeaf: React.FC<{ x: number; y: number; rot?: number; s?: number; claws?: "faint" | "clear" | "none"; glow?: number }> = ({ x, y, rot = 0, s = 1, claws = "faint", glow = 0 }) => (
  <g data-prop="torn-leaf" data-tear-edge="shared" transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
    {glow > 0 ? <Glow cx={-50} cy={-30} r={110} color={GOLD} opacity={0.5 * glow} /> : null}
    <path d={`M-100 -72 ${tearPath(0, "L")} L-100 6 Z`} fill={ID.paper} stroke={INK} strokeWidth={2.6} />
    {LINES.map((ly) => <line key={ly} x1={-88} y1={ly} x2={-16} y2={ly + 6} stroke={mix(ID.paper, ID.night, 0.3)} strokeWidth={3} />)}
    {claws !== "none" ? <Claws x={-74} y={-52} s={1.1} rot={-8} clear={claws === "clear"} /> : null}
  </g>
);

/**
 * الدفتر على المكتب: صفحة يسرى سليمة، وبقية الصفحة الممزقة سابقًا عند الكعب (حافة التمزيق)،
 * وصفحة يمنى تُشد بقدر tear: 0 سليمة، ما بين 0 و1 ترتفع وتنشق من أعلى الكعب، 1 نُزعت فبقيت بقيتها بالحافة نفسها.
 */
export const StoryNotebook: React.FC<{ x: number; y: number; s?: number; tear?: number }> = ({ x, y, s = 1, tear = 0 }) => {
  const t = Math.max(0, Math.min(1, tear));
  const page = (
    <g>
      <path d="M14 6 L104 -4 L104 -74 L14 -62 Z" fill={ID.paper} stroke={INK} strokeWidth={2.4} />
      {[-48, -34, -20].map((ly) => <line key={ly} x1={26} y1={ly + 4} x2={92} y2={ly - 3} stroke={mix(ID.paper, ID.night, 0.3)} strokeWidth={3} />)}
    </g>
  );
  return (
    <g data-prop="notebook" data-tear={t.toFixed(2)} transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-110 0 L0 12 L110 0 L110 -70 L0 -58 L-110 -70 Z" fill={darken(ID.copper, 0.35)} stroke={INK} strokeWidth={3} />
      <path d="M-104 -4 L0 6 L0 -62 L-104 -74 Z" fill={ID.paper} stroke={INK} strokeWidth={2.4} />
      {LINES.map((ly) => <line key={ly} x1={-92} y1={ly} x2={-14} y2={ly + 7} stroke={mix(ID.paper, ID.night, 0.3)} strokeWidth={3} />)}
      {/* بقية الصفحة التي مُزّقت قبل القصة */}
      <path data-tear-edge="shared" d={`M2 6 ${tearPath(10, "L")} L2 -62 Z`} fill={ID.paper} stroke={INK} strokeWidth={2} />
      {t <= 0.001 ? page : t < 1 ? (
        // الصفحة مرفوعة نحو القطة، والتمزق يبدأ من أعلى الكعب
        <g transform={`rotate(${-30 * t} 14 6)`}>
          {page}
          <path d={tearPath(16).split(" ").slice(0, 2 + Math.round(5 * t)).join(" ")} fill="none" stroke={INK} strokeWidth={2.4} />
          <Claws x={70} y={-60} s={1} rot={-6} clear />
        </g>
      ) : (
        <path data-tear-edge="shared" d={`M14 6 ${tearPath(22, "L")} L14 -62 Z`} fill={ID.paper} stroke={INK} strokeWidth={2} />
      )}
    </g>
  );
};

/* ───────── القطة ───────── */

/** قطة ظلية بلا تفاصيل وجه: قائمتها الأمامية تمتد إلى نقطة paw بإحداثيات المشهد، وcrouch انخفاض الاستباق */
export const StoryCat: React.FC<{ x: number; y: number; s?: number; paw: [number, number]; crouch?: number; tail?: number }> = ({ x, y, s = 1, paw, crouch = 0, tail = 0 }) => {
  const c = mix(ID.night, ID.copper, 0.25);
  return (
    <g data-prop="cat">
      <g transform={`translate(${x} ${y}) scale(${-s} ${s})`}>
        <path d={`M-70 0 Q-80 ${-60 + 10 * crouch} -30 ${-62 + 10 * crouch} L30 ${-60 + 14 * crouch} Q60 ${-58 + 14 * crouch} 62 -30 L64 0 Z`} fill={c} stroke={INK} strokeWidth={3} />
        <path d={`M-70 -20 Q-120 -40 ${-110 + 14 * tail} ${-100 + 6 * tail}`} fill="none" stroke={c} strokeWidth={12} strokeLinecap="round" />
        <g transform={`translate(56 ${-64 + 16 * crouch})`}>
          <circle r={28} fill={c} stroke={INK} strokeWidth={3} />
          <path d="M-20 -18 L-14 -44 L-2 -24 Z M8 -24 L18 -44 L22 -16 Z" fill={c} stroke={INK} strokeWidth={2.4} />
          <circle cx={12} cy={-4} r={3.4} fill={GOLD} />
        </g>
      </g>
      <path d={`M${x - 50 * s} ${y - 24 * s} Q${(x - 50 * s + paw[0]) / 2} ${Math.min(y - 24 * s, paw[1]) - 26} ${paw[0]} ${paw[1]}`} fill="none" stroke={c} strokeWidth={13 * s} strokeLinecap="round" />
      <circle cx={paw[0]} cy={paw[1]} r={8 * s} fill={c} stroke={INK} strokeWidth={2} />
    </g>
  );
};

/* ───────── الكرسي ───────── */

/**
 * كرسي كامل بنموذج ثلاثي الأبعاد بسيط وإسقاط ثلاثة أرباع: أربع أرجل، والأمامية اليمنى أقصر بـ CHAIR_SHORT.
 * في الراحة يقف على ثلاث (الأمامية اليسرى والخلفيتين) وتحت القصيرة فجوة. rock (0..1) يميله حول قطر
 * الأمامية اليسرى–الخلفية اليمنى حتى تلمس القصيرة الأرض، فترتفع الخلفية اليسرى: لا رجل تحت الأرض أبدًا.
 * shim (0..1) إسفين يدخل الفجوة؛ عند 1 يقف على الأربع.
 */
export const CHAIR_SHORT = 16;
const CW = 130, CD = 110, CH = 120, CB = 150;
type V3 = [number, number, number];
const FEET: Record<"fl" | "fr" | "bl" | "br", V3> = { fl: [0, 0, 0], fr: [CW, 0, 0], bl: [0, 0, CD], br: [CW, 0, CD] };
const AXIS = (() => {
  const [x, , z] = FEET.br;
  const n = Math.hypot(x, z);
  return [x / n, 0, z / n] as V3;
})();
/** بُعد الأمامية اليمنى عن القطر في مستوى الأرض */
const DIAG = (CW * CD) / Math.hypot(CW, CD);
export const CHAIR_TIP = Math.atan2(CHAIR_SHORT, DIAG);
const rotAxis = (p: V3, a: number): V3 => {
  // Rodrigues حول محور مار بالأصل (قدم الأمامية اليسرى)
  const [kx, ky, kz] = AXIS;
  const c = Math.cos(a), s = Math.sin(a);
  const dot = kx * p[0] + ky * p[1] + kz * p[2];
  const cr: V3 = [ky * p[2] - kz * p[1], kz * p[0] - kx * p[2], kx * p[1] - ky * p[0]];
  return [p[0] * c + cr[0] * s + kx * dot * (1 - c), p[1] * c + cr[1] * s + ky * dot * (1 - c), p[2] * c + cr[2] * s + kz * dot * (1 - c)];
};
/** نقطة من هيكل الكرسي (بإحداثيات الراحة) بعد الميل */
const chairPoint = (p: V3, rock: number, shim: number): V3 => {
  // مع الإسفين كاملًا لا ميل؛ وإلا يُنزل الميلُ القصيرةَ حتى الأرض عند rock = 1 (الزاوية سالبة حول القطر)
  const r = shim >= 1 ? 0 : Math.max(0, Math.min(1, rock));
  return rotAxis(p, -CHAIR_TIP * r);
};
/** ارتفاع كل قدم عن الأرض (للاختبار): الأمامية اليسرى والخلفية اليمنى على الأرض دائمًا */
export const chairFeet = (rock: number, shim = 0) => {
  const lift = (k: keyof typeof FEET) => {
    const base = FEET[k];
    const p: V3 = k === "fr" ? [base[0], CHAIR_SHORT, base[2]] : base;
    return chairPoint(p, rock, shim)[1];
  };
  const shimH = CHAIR_SHORT * Math.max(0, Math.min(1, shim));
  return { fl: lift("fl"), fr: lift("fr"), bl: lift("bl"), br: lift("br"), shim: shimH };
};
const proj = (p: V3): [number, number] => [p[0] + 0.3 * p[2], -p[1] - 0.31 * p[2]];

export const FullChair: React.FC<{ x: number; floor: number; s?: number; rock?: number; shim?: number; gapGlow?: number; sheen?: number }> = ({ x, floor, s = 1, rock = 0, shim = 0, gapGlow = 1, sheen = 0 }) => {
  const wood = darken(ID.copper, 0.15);
  const dark = darken(ID.copper, 0.4);
  const P = (p: V3) => proj(chairPoint(p, rock, shim));
  const pts = (ps: V3[]) => ps.map((p) => P(p).join(" ")).join(" L");
  const seat = (k: "fl" | "fr" | "bl" | "br", dy = 0): V3 => [FEET[k][0], CH + dy, FEET[k][2]];
  const leg = (k: "fl" | "fr" | "bl" | "br", col: string) => {
    const foot: V3 = k === "fr" ? [FEET.fr[0], CHAIR_SHORT, 0] : FEET[k];
    const a = P(seat(k)), b = P(foot);
    return <path key={k} d={`M${a[0] - 6} ${a[1]} L${a[0] + 6} ${a[1]} L${b[0] + 6} ${b[1]} L${b[0] - 6} ${b[1]} Z`} fill={col} stroke={INK} strokeWidth={2.4} />;
  };
  const feet = chairFeet(rock, shim);
  const frFloor = proj([CW, 0, 0]);
  const frFoot = P([CW, CHAIR_SHORT, 0]);
  const gap = Math.max(0, frFloor[1] - frFoot[1] - feet.shim);
  const post = (k: "bl" | "br") => {
    const a = P(seat(k)), b = P(seat(k, CB));
    return <path key={k} d={`M${a[0] - 6} ${a[1]} L${a[0] + 6} ${a[1]} L${b[0] + 6} ${b[1]} L${b[0] - 6} ${b[1]} Z`} fill={dark} stroke={INK} strokeWidth={2.4} />;
  };
  const crest = P([CW / 2, CH + CB - 22, CD]);
  return (
    <g data-prop="full-chair" data-rock={(shim >= 1 ? 0 : rock).toFixed(3)} data-shim={shim.toFixed(2)} data-fr-lift={feet.fr.toFixed(2)} transform={`translate(${x} ${floor}) scale(${s})`}>
      <ellipse cx={CW * 0.55} cy={-CD * 0.15} rx={120} ry={16} fill={INK} opacity={0.16} />
      {leg("bl", dark)}
      {leg("br", dark)}
      {post("bl")}
      {post("br")}
      <path d={`M${pts([seat("bl", CB - 6), seat("br", CB - 6), seat("br", CB - 46), seat("bl", CB - 46)])} Z`} fill={wood} stroke={INK} strokeWidth={2.4} />
      <path d={octagramPath(crest[0], crest[1], 10)} fill={GOLD} stroke={INK} strokeWidth={1.6} />
      <path d={`M${pts([seat("bl"), seat("br"), seat("fr"), seat("fl")])} Z`} fill={lighten(wood, 0.15)} stroke={INK} strokeWidth={3} />
      {sheen > 0 ? <path d={`M${pts([seat("bl"), seat("br"), seat("fr"), seat("fl")])} Z`} fill={lighten(GOLD, 0.3)} opacity={0.35 * sheen} /> : null}
      <path d={`M${pts([seat("fl"), seat("fr"), seat("fr", -14), seat("fl", -14)])} Z`} fill={wood} stroke={INK} strokeWidth={2.4} />
      {leg("fl", wood)}
      {leg("fr", wood)}
      {gap > 0.8 && gapGlow > 0 ? (
        <g data-gap={gap.toFixed(1)}>
          <rect x={frFloor[0] - 12} y={frFloor[1] - gap - feet.shim} width={24} height={gap} fill={GOLD} opacity={0.85 * gapGlow} />
          <Glow cx={frFloor[0]} cy={frFloor[1] - gap / 2} r={40} color={GOLD} opacity={0.6 * gapGlow} />
        </g>
      ) : null}
      {feet.shim > 0.2 ? (
        <path data-prop="shim" d={`M${frFloor[0] - 16} ${frFloor[1]} L${frFloor[0] + 18} ${frFloor[1]} L${frFloor[0] + 12} ${frFloor[1] - feet.shim} L${frFloor[0] - 10} ${frFloor[1] - feet.shim + 3} Z`} fill={lighten(ID.copper, 0.2)} stroke={INK} strokeWidth={2} />
      ) : null}
    </g>
  );
};
/** موضع قدم الأمامية اليمنى على الأرض بإحداثيات المشهد (للمسطرة والإسفين) */
export const chairFrFloor = (x: number, floor: number, s: number) => ({ x: x + proj([CW, 0, 0])[0] * s, y: floor });
export const chairFlFloor = (x: number, floor: number, s: number) => ({ x: x + proj([0, 0, 0])[0] * s, y: floor });

/** مسطرة قياس رأسية بعلامات */
export const Ruler: React.FC<{ x: number; floor: number; h?: number; show?: number }> = ({ x, floor, h = 160, show = 1 }) =>
  show <= 0.001 ? null : (
    <g data-prop="ruler" opacity={Math.min(1, show)} transform={`translate(0 ${(1 - show) * 30})`}>
      <rect x={x} y={floor - h} width={14} height={h} fill={GOLD} stroke={INK} strokeWidth={2} />
      {Array.from({ length: Math.floor(h / 12) }, (_, k) => <line key={k} x1={x} y1={floor - k * 12} x2={x + (k % 5 ? 6 : 11)} y2={floor - k * 12} stroke={INK} strokeWidth={1.6} />)}
    </g>
  );

/* ───────── الهاتف ───────── */

const lerpN = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t));

export const PHONE_IMAGE = { x: -150, y: -230, w: 300, h: 290 } as const;
/** نافذة القص على الصورة الأصلية نفسها: full 0 مقصوصة (بلا الرف والصندوق)، 1 كاملة */
export const phoneCrop = (full: number) => {
  const top = -110 - 105 * Math.max(0, Math.min(1, full));
  return { x: -130, y: top, w: 260, h: 45 - top };
};

/**
 * شاشة الهاتف بعين البطل: صورة واحدة (رجل يمد ذراعه، طفل يجفل، وفوقهما رف يسقط منه صندوق؛ people = الرجل والطفل).
 * القص نافذة على الصورة نفسها تتسع حتى الأصل، فلا صورة بديلة. نص الغضب أشرطة بلا حروف، والوسم الأحمر يبهت بالكشف.
 */
export const StoryPhone: React.FC<{ x: number; y: number; full?: number; s?: number; show?: number; lines?: number; tag?: number; thumb?: number; man?: number; reveal?: number; people: React.ReactNode }> = ({ x, y, full = 0, s = 1, show = 1, lines = 3, tag = 1, thumb = 0, man = 0, reveal = 0, people }) => {
  const clip = useSvgId("phonecrop");
  if (show <= 0.001) return null;
  const W = 300, H = 560;
  const f = Math.max(0, Math.min(1, full));
  const c = phoneCrop(f);
  return (
    <g data-prop="story-phone" data-full={f.toFixed(2)} opacity={Math.min(1, show * 1.5)} transform={`translate(${x} ${y + (1 - show) * 40}) scale(${s})`}>
      <rect x={-W / 2 - 14} y={-H / 2 - 14} width={W + 28} height={H + 28} rx={40} fill={darken(ID.night, 0.4)} stroke={INK} strokeWidth={4} />
      <rect x={-W / 2} y={-H / 2} width={W} height={H} rx={28} fill={mix(ID.paper, ID.night, 0.08)} />
      <defs>
        <clipPath id={clip}>
          <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={10} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <g data-image="original">
          <rect x={PHONE_IMAGE.x} y={PHONE_IMAGE.y} width={PHONE_IMAGE.w} height={PHONE_IMAGE.h} fill={mix(ID.copper, ID.paper, 0.35)} />
          <g transform="translate(0 40) scale(0.4)">
            <rect x={-320} y={-520} width={640} height={16} fill={darken(ID.copper, 0.4)} />
            <g transform="rotate(-14 150 -440)"><rect x={90} y={-480} width={130} height={90} fill={darken(ID.copper, 0.3)} stroke={INK} strokeWidth={5} /></g>
            {man > 0 ? <Glow cx={-90} cy={-200} r={200} color={GOLD} opacity={0.6 * man} /> : null}
            {people}
          </g>
        </g>
        {/* الاكتشاف: دائرة ذهبية حول الصندوق وخط من يد الرجل إليه (الصورة نفسها ثابتة، والتعليم فوقها) */}
        {reveal > 0.01 ? (
          <g data-reveal={reveal.toFixed(2)} opacity={Math.min(1, reveal * 1.5)}>
            <circle cx={62} cy={-136} r={26 + 6 * (1 - reveal)} fill="none" stroke={GOLD} strokeWidth={4} />
            <path d={`M${-10} ${-62} L${lerpN(-10, 44, reveal)} ${lerpN(-62, -118, reveal)}`} stroke={GOLD} strokeWidth={3} strokeDasharray="6 5" strokeLinecap="round" />
          </g>
        ) : null}
      </g>
      <rect data-crop="frame" x={c.x} y={c.y} width={c.w} height={c.h} rx={10} fill="none" stroke={mix(RED, GOLD, f)} strokeWidth={5} />
      {[80, 110, 140].slice(0, Math.max(0, Math.min(3, Math.ceil(lines)))).map((ly, i) => (
        <rect key={ly} x={-120} y={ly} width={(i === 2 ? 150 : 240) * Math.max(0, Math.min(1, lines - i))} height={14} rx={7} fill={mix(RED, ID.paper, 0.3 + 0.45 * f)} />
      ))}
      {tag > 0.01 ? <rect x={-62} y={178} width={124} height={38} rx={19} fill={RED} opacity={tag * (1 - f)} /> : null}
      {thumb > 0.01 ? <ellipse cx={20} cy={197 + 40 * (1 - thumb)} rx={34} ry={46} fill={mix(ID.copper, ID.paper, 0.45)} stroke={INK} strokeWidth={3} opacity={Math.min(1, thumb * 1.5)} /> : null}
      <circle cx={0} cy={H / 2 - 30} r={14} fill="none" stroke={mix(ID.paper, ID.night, 0.4)} strokeWidth={3} />
    </g>
  );
};
/* ───────── فقاعة الذكرى ───────── */

/** دائرة ذكرى من رأس شخص: ما شعر به (مشهد مصغّر بداخلها) */
export const MemoryBubble: React.FC<{ cx: number; cy: number; head: [number, number]; r?: number; show: number; ring?: string; children: React.ReactNode }> = ({ cx, cy, head, r = 118, show, ring = ID.copper, children }) => {
  const id = useSvgId("bubble");
  if (show <= 0.001) return null;
  const s = 0.3 + 0.7 * show;
  const ex = cx + (head[0] < cx ? -r * 0.7 : r * 0.7);
  const ey = cy + r * 0.62;
  return (
    <g data-prop="memory-bubble" opacity={Math.min(1, show * 1.4)}>
      {[0.3, 0.6].map((k, i) => (show > 0.2 + i * 0.2 ? <circle key={i} cx={head[0] + (ex - head[0]) * k} cy={head[1] + (ey - head[1]) * k} r={6 + 6 * k} fill={ID.paper} stroke={ring} strokeWidth={3} /> : null))}
      <g transform={`translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})`}>
        <defs>
          <clipPath id={id}>
            <circle cx={cx} cy={cy} r={r} />
          </clipPath>
        </defs>
        <circle cx={cx} cy={cy} r={r + 7} fill={darken(ID.night, 0.2)} opacity={0.35} />
        <g clipPath={`url(#${id})`}>
          <rect x={cx - r} y={cy - r} width={2 * r} height={2 * r} fill={mix(ID.paper, ID.copper, 0.22)} />
          {children}
        </g>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={ring} strokeWidth={7} />
      </g>
    </g>
  );
};
