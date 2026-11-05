import React from "react";
import { Easing, interpolate } from "remotion";
import { CLOTH, ID, SKIN, darken, lighten, mix, type ClothId } from "./palette";

/**
 * شخصية «بالإسلام» المصوَّرة: بلا ملامح وجه أبدًا (قاعدة القناة)، بهيكل مفاصل
 * (كتف ومرفق وورك وركبة) فتتحرك بنعومة بين الوضعيات وتمشي بدورة مشي حقيقية.
 * كل الرسم متجهي، فيبقى حادًا في رندر 4K.
 *
 * الإحداثيات: القدمان عند (0,0) والشخصية تنظر نحو +x، وطولها نحو 292 وحدة عند scale=1.
 */

const THIGH = 70;
const SHIN = 68;
const TORSO = 112;
const UPPER = 52;
const FORE = 48;
const HEAD_R = 24;
const NECK = 34;

type Limb = { s: number; e: number };
export type PoseSpec = {
  lean: number;
  head: number;
  armBack: Limb;
  armFront: Limb;
  legBack: Limb;
  legFront: Limb;
};

export type PoseName = "stand" | "think" | "sit" | "sit-low" | "head-down" | "hold" | "cross" | "point" | "look-up" | "nod" | "turn-away" | "proud" | "apologize" | "listen" | "talk" | "flinch" | "sincere" | "halt" | "sit-show" | "sit-nod" | "wave-off" | "lean-rail";

const P = (lean: number, head: number, ab: [number, number], af: [number, number], lb: [number, number], lf: [number, number]): PoseSpec => ({
  lean,
  head,
  armBack: { s: ab[0], e: ab[1] },
  armFront: { s: af[0], e: af[1] },
  legBack: { s: lb[0], e: lb[1] },
  legFront: { s: lf[0], e: lf[1] },
});

export const POSES: Record<PoseName, PoseSpec> = {
  stand: P(0, 4, [-6, 8], [6, 10], [-3, 0], [3, 0]),
  think: P(2, 10, [-4, 10], [34, 132], [-3, 0], [4, 0]),
  sit: P(4, 6, [10, 40], [22, 50], [86, 86], [90, 90]),
  "sit-low": P(14, 22, [26, 60], [34, 64], [84, 84], [92, 92]),
  "head-down": P(26, 34, [58, 150], [64, 146], [84, 84], [92, 92]),
  hold: P(4, 18, [22, 84], [30, 78], [-3, 0], [3, 0]),
  cross: P(-3, -2, [16, 118], [22, 112], [-5, 0], [5, 0]),
  point: P(2, 0, [-6, 8], [84, 6], [-4, 0], [4, 0]),
  "look-up": P(-6, -22, [-10, 10], [-4, 12], [-3, 0], [3, 0]),
  nod: P(2, 20, [-6, 8], [6, 10], [-3, 0], [3, 0]),
  "turn-away": P(-2, 8, [-4, 6], [4, 8], [-3, 0], [3, 0]),
  // يتعالى: ظهر مشدود للخلف ورأس مرفوع ويدان خلف الظهر
  proud: P(-9, -16, [-34, 40], [-30, 44], [-5, 0], [6, 0]),
  // يعتذر: انحناءة خفيفة ويد على الصدر
  apologize: P(14, 24, [-4, 10], [38, 118], [-3, 0], [3, 0]),
  // يُصغي: ميل خفيف للأمام ورأس مائل
  listen: P(6, 12, [-6, 12], [8, 18], [-3, 0], [3, 0]),
  // يتكلم: يد مفتوحة نحو من أمامه
  talk: P(2, 2, [-6, 10], [58, 34], [-3, 0], [3, 0]),
  // يتألم من كلمة: يتراجع ويحمي صدره
  flinch: P(-12, 20, [26, 120], [34, 116], [-8, 0], [4, 0]),
  // صادق فيما يقول: يد على الصدر، قائم
  sincere: P(0, 6, [-6, 10], [30, 128], [-3, 0], [3, 0]),
  // مهلًا: كفّ مرفوعة للأمام
  halt: P(-2, 0, [-6, 10], [60, 70], [-3, 0], [3, 0]),
  // جالس يُري من أمامه ما في يده
  "sit-show": P(4, 6, [10, 40], [72, 18], [86, 86], [90, 90]),
  // جالس يومئ موافقًا
  "sit-nod": P(6, 24, [10, 40], [30, 70], [86, 86], [90, 90]),
  // يلوّح بيده رافضًا
  "wave-off": P(-6, -8, [-6, 10], [70, 100], [-4, 0], [4, 0]),
  // متكئ على سور ينظر إلى أسفل
  "lean-rail": P(22, 30, [44, 30], [52, 24], [-3, 0], [5, 0]),
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpLimb = (a: Limb, b: Limb, t: number): Limb => ({ s: lerp(a.s, b.s, t), e: lerp(a.e, b.e, t) });
export const blendPose = (a: PoseSpec, b: PoseSpec, t: number): PoseSpec => ({
  lean: lerp(a.lean, b.lean, t),
  head: lerp(a.head, b.head, t),
  armBack: lerpLimb(a.armBack, b.armBack, t),
  armFront: lerpLimb(a.armFront, b.armFront, t),
  legBack: lerpLimb(a.legBack, b.legBack, t),
  legFront: lerpLimb(a.legFront, b.legFront, t),
});

/** وضعية الإطار من خط زمني [{at, pose}]: انتقال ناعم مدته 14 إطارًا */
export const poseAt = (frame: number, timeline: { at: number; pose: PoseName }[]): PoseSpec => {
  const tl = [...timeline].sort((a, b) => a.at - b.at);
  if (!tl.length) return POSES.stand;
  let cur = POSES[tl[0]!.pose];
  for (let i = 1; i < tl.length; i++) {
    const k = tl[i]!;
    if (frame < k.at) break;
    const t = interpolate(frame, [k.at, k.at + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
    cur = blendPose(cur, POSES[k.pose], t);
  }
  return cur;
};

/** دورة المشي فوق الوضعية: phase بالراديان */
export const walkPose = (base: PoseSpec, phase: number, amount = 1): PoseSpec => {
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  const leg = (sn: number, cs: number): Limb => ({ s: 24 * sn * amount, e: 36 * Math.max(0, cs) * amount + 4 });
  return {
    ...base,
    lean: base.lean + 4 * amount,
    legFront: leg(s, c),
    legBack: leg(-s, -c),
    armFront: { s: lerp(base.armFront.s, -20 * s, amount), e: lerp(base.armFront.e, 14, amount) },
    armBack: { s: lerp(base.armBack.s, 20 * s, amount), e: lerp(base.armBack.e, 14, amount) },
  };
};

const rad = (d: number) => (d * Math.PI) / 180;

/** هندسة الساقين لوضعية ما (إحداثيات محلية، القدمان على الأرض y=0 تقريبًا): للرسم ولاختبار انزلاق القدمين */
export const legGeometry = (pose: PoseSpec) => {
  const drop = (l: Limb) => THIGH * Math.cos(rad(l.s)) + SHIN * Math.cos(rad(l.s - l.e));
  const hipY = -Math.max(drop(pose.legBack), drop(pose.legFront)) - 6;
  const leg = (l: Limb) => {
    const kx = THIGH * Math.sin(rad(l.s));
    const ky = hipY + THIGH * Math.cos(rad(l.s));
    return { k: [kx, ky] as const, f: [kx + SHIN * Math.sin(rad(l.s - l.e)), ky + SHIN * Math.cos(rad(l.s - l.e))] as const };
  };
  return { hipY, back: leg(pose.legBack), front: leg(pose.legFront) };
};
export const LEG_LEN = THIGH + SHIN;
const step = (x: number, y: number, len: number, ang: number) => [x + len * Math.sin(rad(ang)), y + len * Math.cos(rad(ang))] as const;
/** دوران نقطة حول مركز (لإمالة الجذع) */
const rot = (x: number, y: number, cx: number, cy: number, ang: number) => {
  const a = rad(ang);
  const dx = x - cx;
  const dy = y - cy;
  return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)] as const;
};

export type Outfit = "jacket" | "thobe" | "abaya" | "shirt";
export type HeadWear = "hair" | "kufi" | "hijab" | "bare" | "ghutra";
export type FigureLook = { outfit: Outfit; cloth: ClothId; head: HeadWear; skin: 0 | 1; hair?: string; inner?: string; pants?: string; head2?: string };

export const LOOKS = {
  hero: { outfit: "jacket", cloth: "emerald", head: "hair", skin: 1 },
  heroThobe: { outfit: "thobe", cloth: "paper", head: "kufi", skin: 1 },
  woman: { outfit: "abaya", cloth: "ink", head: "hijab", skin: 0 },
  womanSand: { outfit: "abaya", cloth: "sand", head: "hijab", skin: 1, head2: "#7A4A3A" },
  elder: { outfit: "thobe", cloth: "sand", head: "kufi", skin: 0, hair: "#B9B2A6" },
  friend: { outfit: "jacket", cloth: "clay", head: "hair", skin: 0 },
  stranger: { outfit: "shirt", cloth: "copper", head: "bare", skin: 1 },
  vendor: { outfit: "shirt", cloth: "sand", head: "ghutra", skin: 0, pants: "#3A3427" },
  boy: { outfit: "shirt", cloth: "teal", head: "hair", skin: 1 },
} satisfies Record<string, FigureLook>;
export type LookId = keyof typeof LOOKS;

export type Holding = "paper" | "phone" | "bundle" | "coins" | "book" | "cup" | "none";

type FigureProps = {
  x: number;
  y: number;
  scale?: number;
  pose: PoseSpec;
  look?: FigureLook;
  flip?: boolean;
  opacity?: number;
  /** ظل ناعم تحت القدمين */
  shadow?: boolean;
  /** إضاءة جانبية بلون الضوء (0..1) */
  rim?: number;
  rimColor?: string;
  holding?: Holding;
  /** تنفس خفيف: رقم الإطار */
  frame?: number;
  /** لون صامت (للأطياف والظلال) */
  silhouette?: string;
  /** شدة الظل على الجانب البعيد عن الضوء (0..1) */
  shade?: number;
  /** اتجاه الجسد بين -1 و1 (للالتفاتة التدريجية)؛ إن وُجد يتقدم على flip */
  facing?: number;
  /** تأخر الثوب عن الجسد (وحدات محلية، موجب = إلى الخلف): متابعة القماش بعد الحركة والتوقف */
  sway?: number;
  /**
   * زاوية النظر حول المحور الرأسي (0..1): 0 جانبي كما يُرسم اليوم، 0.5 ثلاثة أرباع، 1 أمامي.
   * كل مفصل له موضع في العمق يُسقط على الشاشة، والأطراف بطولها وسُمكها، والجذع والرأس بعرض
   * المقطع البيضاوي المُسقط؛ فيحافظ الجسد على حجمه أثناء الالتفات بلا تضييق ولا تشويه.
   */
  view?: number;
};

/** موضع الوركين والكتفين على جانبي الجسد (وحدات محلية) */
const HIP_U = 11;
const SH_U = 34;

type Pt = readonly [number, number];
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const norm = (v: Pt): Pt => {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
};
const f1 = (n: number) => n.toFixed(1);
/** قطعة مخروطية بين نقطتين بعرضين (نصف عرض) وطرفين مستديرين */
const segPath = (a: Pt, b: Pt, wa: number, wb: number) => {
  const d = norm(sub(b, a));
  const n: Pt = [-d[1], d[0]];
  const p1: Pt = [a[0] + n[0] * wa, a[1] + n[1] * wa];
  const p2: Pt = [b[0] + n[0] * wb, b[1] + n[1] * wb];
  const p3: Pt = [b[0] - n[0] * wb, b[1] - n[1] * wb];
  const p4: Pt = [a[0] - n[0] * wa, a[1] - n[1] * wa];
  return `M${f1(p1[0])} ${f1(p1[1])} L${f1(p2[0])} ${f1(p2[1])} A${f1(wb)} ${f1(wb)} 0 0 0 ${f1(p3[0])} ${f1(p3[1])} L${f1(p4[0])} ${f1(p4[1])} A${f1(wa)} ${f1(wa)} 0 0 0 ${f1(p1[0])} ${f1(p1[1])} Z`;
};
/** طرف (فخذ وساق، أو عضد وساعد) بحدّ رسم خارجي لا تظهر وصلاته */
const Limb2: React.FC<{ pts: Pt[]; w: number[]; fill: string; ink: string; o?: number }> = ({ pts, w, fill, ink, o = 2.6 }) => {
  const segs = pts.slice(1).map((b, i) => [pts[i]!, b, w[i]!, w[i + 1]!] as const);
  return (
    <g>
      {segs.map(([a, b, wa, wb], i) => (
        <path key={`o${i}`} d={segPath(a, b, wa + o, wb + o)} fill={ink} />
      ))}
      {segs.map(([a, b, wa, wb], i) => (
        <path key={`f${i}`} d={segPath(a, b, wa, wb)} fill={fill} />
      ))}
    </g>
  );
};

export const Figure: React.FC<FigureProps> = ({ x, y, scale = 1, pose, look = LOOKS.hero, flip = false, opacity = 1, shadow = true, rim = 0, rimColor = ID.dawn, holding = "none", frame = 0, silhouette, shade = 1, facing, sway = 0, view = 0 }) => {
  const L = look as FigureLook;
  // الإسقاط: s = 0 يعطي الرسم الجانبي نفسه حرفيًا (اختبار المرجع يثبت ذلك)
  const vw = Math.max(0, Math.min(1, view));
  const cY = vw === 0 ? 1 : Math.cos((vw * Math.PI) / 2);
  const sY = vw === 0 ? 0 : Math.sin((vw * Math.PI) / 2);
  const flat = sY === 0;
  /** نقطة في العمق: f للأمام، u للجانب القريب من الناظر */
  const P = (f: number, u: number) => (flat ? f : f * cY + u * sY);
  /** حافة مقطع بيضاوي: عرضه جانبيًا xp وأماميًا xf */
  const E = (xp: number, xf: number) => (flat ? xp : Math.sign(xp || xf) * Math.hypot(xp * cY, xf * sY));
  /** رسمان لنفس الشكل (جانبي وأمامي) بنفس البنية */
  const V = (a: number, b: number) => (flat ? a : a + (b - a) * sY);
  const pr = (pt: Pt, u: number): Pt => (flat ? pt : [P(pt[0], u), pt[1]]);
  const sil = silhouette;
  const cloth = sil ?? CLOTH[L.cloth];
  const clothDark = sil ?? darken(cloth, 0.2 * shade + 0.06);
  const clothLight = sil ?? lighten(cloth, 0.1);
  const skin = sil ?? SKIN[L.skin];
  const skinDark = sil ?? darken(SKIN[L.skin], 0.16);
  const inner = sil ?? L.inner ?? mix(ID.paper, ID.copper, 0.1);
  const pants = sil ?? L.pants ?? darken(ID.night, 0.2);
  const shoe = sil ?? darken(ID.copper, 0.62);
  const hairCol = sil ?? L.hair ?? darken(ID.night, 0.45);
  const ink = sil ?? darken(ID.night, 0.55);
  const breathe = Math.sin(frame / 22) * 1.1;
  const robe = L.outfit === "thobe" || L.outfit === "abaya";

  // الساقان: ارتفاع الورك يتحدد بأبعد قدم عن الورك، فتلمس الأرض دائمًا
  const drop = (l: Limb) => THIGH * Math.cos(rad(l.s)) + SHIN * Math.cos(rad(l.s - l.e));
  const hipY = -Math.max(drop(pose.legBack), drop(pose.legFront)) - 6;
  const hip: Pt = [0, hipY];
  const leg = (l: Limb, u: number) => {
    const k = step(hip[0], hip[1], THIGH, l.s);
    const f = step(k[0], k[1], SHIN, l.s - l.e);
    return { k: pr(k as Pt, u), f: pr(f as Pt, u), h: pr(hip, u) };
  };
  // الساق الخلفية في الجانب البعيد، والأمامية في الجانب القريب
  const lb = leg(pose.legBack, -HIP_U);
  const lf = leg(pose.legFront, HIP_U);
  const seated = Math.abs(lb.k[1] - hipY) < 30;

  // الجذع والرأس يُرسمان في إحداثيات محلية ثم تُمال المجموعة حول الورك
  const shY = hipY - TORSO + breathe;
  const sh = rot(0, shY + 8, 0, hipY, pose.lean) as Pt;
  const leanV = flat ? pose.lean : pose.lean * cY;
  const arm = (l: Limb, u: number) => {
    const e = step(sh[0], sh[1], UPPER, l.s + pose.lean * 0.6) as Pt;
    const h = step(e[0], e[1], FORE, l.s + l.e + pose.lean * 0.6) as Pt;
    return { e: pr(e, u), h: pr(h, u), sh: pr(sh, u) };
  };
  const ab = arm(pose.armBack, -SH_U);
  const af = arm(pose.armFront, SH_U);

  // الحذاء: من الكعب (-9) إلى المقدمة (25) جانبيًا، وعرضه 16 أماميًا
  const shoeL = flat ? -9 : -9 * cY - 8 * sY;
  const shoeR = flat ? 25 : 25 * cY + 8 * sY;
  const sx = (dx: number) => (flat ? dx : shoeL + ((dx + 9) / 34) * (shoeR - shoeL));
  const shoeEl = (f: Pt, key: string) => (
    <g key={key}>
      <path d={`M${f[0] + sx(-9)} ${f[1] - 2} Q${f[0] + sx(-10)} ${f[1] - 13} ${f[0] + sx(2)} ${f[1] - 13} Q${f[0] + sx(22)} ${f[1] - 11} ${f[0] + sx(25)} ${f[1] - 3} L${f[0] + sx(25)} ${f[1] + 1} L${f[0] + sx(-9)} ${f[1] + 1} Z`} fill={shoe} stroke={ink} strokeWidth={2.4} strokeLinejoin="round" />
      <rect x={f[0] + sx(-9)} y={f[1] - 2} width={sx(25) - sx(-9)} height={3} fill={sil ?? darken(shoe, 0.35)} />
    </g>
  );

  // الأرجل: بنطال، أو ثوب ينسدل
  const legW = robe ? [19, 17, 15] : [14, 11, 8];
  const legFill = robe ? cloth : pants;
  // الطرف البعيد أغمق جانبيًا فقط؛ أماميًا الطرفان متساويان (فلا قفزة لونية عند الانقلاب)
  const far = (dark: string, near: string) => (flat || sil ? dark : mix(dark, near, sY));
  const legsBack = <Limb2 pts={[lb.h, lb.k, lb.f]} w={legW} fill={far(robe ? clothDark : darken(pants, 0.18), legFill)} ink={ink} />;
  const legsFront = <Limb2 pts={[lf.h, lf.k, lf.f]} w={legW} fill={legFill} ink={ink} />;
  // ذيل الثوب: يغطي ما بين الساقين واقفًا
  const hemY = Math.max(lb.f[1], lf.f[1]) - 9;
  const hemL = Math.min(lb.f[0], lf.f[0], lb.k[0] - 6, lf.k[0] - 6) - 24 - sway;
  const hemR = Math.max(lb.f[0], lf.f[0], lb.k[0] + 6, lf.k[0] + 6) + 24 - sway;
  const skirt = robe && !seated ? (
    <path d={`M${E(-24, -30)} ${hipY - 4} L${E(24, 30)} ${hipY - 4} Q${hemR - 4} ${(hipY + hemY) / 2} ${hemR} ${hemY} Q${(hemL + hemR) / 2} ${hemY + 6} ${hemL} ${hemY} Q${hemL + 4} ${(hipY + hemY) / 2} ${E(-24, -30)} ${hipY - 4} Z`} fill={cloth} stroke={ink} strokeWidth={2.6} strokeLinejoin="round" />
  ) : null;
  const skirtFolds = robe && !seated ? (
    <g stroke={clothDark} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.8}>
      <path d={`M-6 ${hipY + 20} Q${hemL * 0.35} ${(hipY + hemY) / 2 + 10} ${hemL * 0.5} ${hemY - 4}`} />
      <path d={`M10 ${hipY + 30} Q${hemR * 0.3} ${(hipY + hemY) / 2 + 20} ${hemR * 0.45} ${hemY - 2}`} />
    </g>
  ) : null;

  // الذراع: كم مخروطي، وكفّ بإبهام
  const hand = (e: Pt, h: Pt, key: string, back: boolean) => {
    const d = norm(sub(h, e));
    const hc: Pt = [h[0] + d[0] * 7, h[1] + d[1] * 7];
    const ang = (Math.atan2(d[1], d[0]) * 180) / Math.PI;
    return (
      <g key={key}>
        <ellipse cx={hc[0]} cy={hc[1]} rx={10.5} ry={8} transform={`rotate(${ang} ${hc[0]} ${hc[1]})`} fill={back ? far(skinDark, skin) : skin} stroke={ink} strokeWidth={2.4} />
        <ellipse cx={hc[0] - d[1] * 6 + d[0] * 2} cy={hc[1] + d[0] * 6 + d[1] * 2} rx={4.5} ry={3.4} transform={`rotate(${ang} ${hc[0]} ${hc[1]})`} fill={back ? far(skinDark, skin) : skin} />
      </g>
    );
  };
  const sleeve = (a: { e: Pt; h: Pt; sh: Pt }, back: boolean, key: string) => {
    const nearFill = L.outfit === "shirt" ? cloth : darken(cloth, 0.06);
    const fill = back ? far(clothDark, nearFill) : nearFill;
    return (
      <g key={key}>
        <Limb2 pts={[a.sh, a.e, a.h]} w={robe ? [12, 10.5, 9.5] : [11, 8.5, 7]} fill={fill} ink={ink} />
        {L.outfit === "jacket" ? <path d={segPath(a.h, [a.h[0] + (a.h[0] - a.e[0]) * 0.08, a.h[1] + (a.h[1] - a.e[1]) * 0.08], 7.5, 7.5)} fill={inner} /> : null}
        {hand(a.e, a.h, `${key}h`, back)}
      </g>
    );
  };

  // الجذع في إحداثيات محلية
  const waist = hipY + (robe ? -2 : 18);
  // ذيل الجاكيت يتأخر قليلًا مع الحركة
  const tail = L.outfit === "jacket" ? sway * 0.35 : 0;
  const torsoPath = `M${E(-29, -40)} ${shY + 14} Q${E(-30, -41)} ${shY + 2} ${E(-18, -28)} ${shY} L${E(20, 28)} ${shY} Q${E(31, 41)} ${shY + 2} ${E(30, 40)} ${shY + 16} Q${E(29, 39)} ${(shY + waist) / 2} ${E(25, 32)} ${waist} L${E(-25, -32) - tail} ${waist} Q${E(-31, -39)} ${(shY + waist) / 2} ${E(-29, -40)} ${shY + 14} Z`;
  const backShade = `M${E(-29, -40)} ${shY + 14} Q${E(-30, -41)} ${shY + 2} ${E(-18, -28)} ${shY} L${P(-4, -14)} ${shY} Q${P(-8, -18)} ${(shY + waist) / 2} ${P(-10, -20)} ${waist} L${E(-25, -32) - tail} ${waist} Q${E(-31, -39)} ${(shY + waist) / 2} ${E(-29, -40)} ${shY + 14} Z`;
  // تفاصيل الصدر في منتصفه الأمامي: تُسقط بموضعها (تتجه نحو المنتصف كلما واجه الناظر)
  const chest = (center: number, half: number, halfFront: number): [number, number, number] => (flat ? [center - half, center, center + half] : [center * cY - (half * cY + halfFront * sY), center * cY, center * cY + half * cY + halfFront * sY]);
  const [jL, jC, jR] = chest(12, 8, 12);
  const [shL, shC, shR] = chest(12, 6, 8);
  const [thL, thC, thR] = chest(13, 5, 7);
  const bandX = E(-25, -32);
  const bandW = E(25, 32) - bandX;
  const sideDetail = flat ? 1 : cY;
  const torso = (
    <g>
      <path d={torsoPath} fill={cloth} stroke={ink} strokeWidth={2.6} strokeLinejoin="round" />
      <path d={backShade} fill="#000" opacity={flat ? 0.16 * shade : 0.16 * shade * cY} />
      {L.outfit === "jacket" ? (
        <g>
          <path d={`M${jL} ${shY + 1} L${jR} ${shY + 1} L${jC} ${shY + 44} Z`} fill={inner} />
          <path d={`M${jL} ${shY + 1} L${jC} ${shY + 44} L${flat ? 10 : jC - 2 * cY} ${waist}`} stroke={darken(cloth, 0.3)} strokeWidth={2.4} fill="none" />
          <path d={`M${jR} ${shY + 1} L${flat ? 14 : jC + 2 * cY} ${shY + 40}`} stroke={darken(cloth, 0.3)} strokeWidth={2} fill="none" />
          <rect x={bandX} y={waist - 4} width={bandW} height={4} fill={darken(cloth, 0.22)} />
        </g>
      ) : null}
      {L.outfit === "shirt" ? (
        <g>
          <path d={`M${shL} ${shY + 1} L${shR} ${shY + 1} L${shC} ${shY + 18} Z`} fill={darken(cloth, 0.25)} />
          <path d={`M${shC} ${shY + 18} L${shC} ${waist}`} stroke={darken(cloth, 0.22)} strokeWidth={2} />
          <rect x={bandX} y={waist - 3} width={bandW} height={5} fill={darken(pants, 0.2)} />
        </g>
      ) : null}
      {L.outfit === "thobe" ? (
        <g>
          <path d={`M${thL} ${shY + 2} L${thR} ${shY + 2} L${flat ? 14 : thC + cY} ${shY + 34} Z`} fill={darken(cloth, 0.1)} />
          <path d={`M${thC} ${shY + 6} L${thC} ${shY + 50}`} stroke={darken(cloth, 0.22)} strokeWidth={2} />
          <path d={`M${P(-16, -28)} ${shY + 40} Q${P(-12, -26)} ${waist - 20} ${P(-18, -30)} ${waist}`} stroke={darken(cloth, 0.15)} strokeWidth={2.4} fill="none" opacity={flat ? undefined : sideDetail} />
        </g>
      ) : null}
      {L.outfit === "abaya" ? <path d={`M${P(-10, -24)} ${shY + 30} Q${P(-4, -20)} ${waist - 30} ${P(-12, -26)} ${waist}`} stroke={darken(cloth, 0.35)} strokeWidth={2.4} fill="none" opacity={flat ? undefined : sideDetail} /> : null}
    </g>
  );

  // الرأس (بلا ملامح): بيضاوي، بأذن وشعر أو غطاء
  const neckTop = shY - 10;
  const headTilt = flat ? pose.head : pose.head * cY;
  const hy = neckTop - 22;
  const headEl = (
    <g transform={`rotate(${headTilt} 0 ${neckTop + 6})`}>
      <path d={segPath([flat ? 2 : 2 * cY, shY + 4], [flat ? 3 : 3 * cY, neckTop], 7.5, 7)} fill={skinDark} stroke={ink} strokeWidth={2.4} />
      {L.head === "hijab" ? (
        <g>
          <path d={`M${V(-27, -28)} ${V(shY + 22, shY + 20)} Q${V(-31, -32)} ${hy - 26} ${V(2, 0)} ${hy - 29} Q${V(31, 32)} ${hy - 26} ${V(28, 28)} ${V(shY + 12, shY + 20)} Q${V(10, 0)} ${V(shY + 26, shY + 30)} ${V(-27, -28)} ${V(shY + 22, shY + 20)} Z`} fill={sil ?? L.head2 ?? mix(cloth, ID.night, 0.25)} stroke={ink} strokeWidth={2.6} />
          <ellipse cx={V(8, 0)} cy={hy + 2} rx={V(14, 15)} ry={18} fill={skin} />
          <path d={`M${V(-6, -13)} ${hy - 14} Q${V(4, 0)} ${hy - 22} ${V(20, 13)} ${hy - 14}`} stroke={darken(sil ?? L.head2 ?? cloth, 0.2)} strokeWidth={3} fill="none" />
          <path d={`M-20 ${shY + 18} Q${V(-14, -17)} ${hy + 10} ${V(-16, -18)} ${hy - 10}`} stroke={darken(sil ?? L.head2 ?? cloth, 0.25)} strokeWidth={2.6} fill="none" />
        </g>
      ) : (
        <g>
          <ellipse cx={V(3, 0)} cy={hy} rx={V(20, 19)} ry={23.5} fill={skin} stroke={ink} strokeWidth={2.6} />
          <path d={`M-17 ${hy - 10} Q-20 ${hy + 8} -10 ${hy + 19} Q-2 ${hy + 22} 2 ${hy + 21} L-3 ${hy - 10} Z`} fill="#000" opacity={flat ? 0.08 * shade : 0.08 * shade * cY} />
          {L.head === "hair" ? (
            <path
              d={`M${V(-17, -20)} ${V(hy + 4, hy + 2)} Q${V(-20, -22)} ${V(hy - 22, hy - 24)} ${V(2, 0)} ${V(hy - 25, hy - 26)} Q${V(20, 22)} ${V(hy - 25, hy - 24)} ${V(23, 20)} ${V(hy - 10, hy + 2)} Q${V(14, 14)} ${V(hy - 15, hy - 12)} ${V(6, 8)} ${V(hy - 13, hy - 12)} Q${V(2, 2)} ${V(hy - 4, hy - 14)} ${V(0, 0)} ${V(hy - 2, hy - 12)} Q${V(-6, -2)} ${V(hy - 6, hy - 14)} ${V(-8, -8)} ${V(hy + 2, hy - 12)} Q${V(-12, -14)} ${V(hy + 6, hy - 12)} ${V(-17, -20)} ${V(hy + 4, hy + 2)} Z`}
              fill={hairCol}
              stroke={ink}
              strokeWidth={2.2}
              strokeLinejoin="round"
            />
          ) : null}
          {L.head === "kufi" ? (
            <g>
              {L.hair ? <path d={`M-17 ${hy + 2} Q-18 ${hy - 6} -12 ${hy - 10} L-8 ${hy + 4} Z`} fill={L.hair} opacity={flat ? undefined : cY} /> : null}
              <path d={`M${V(-18, -21)} ${hy - 6} Q${V(-17, -20)} ${hy - 26} ${V(3, 0)} ${hy - 27} Q${V(22, 20)} ${hy - 26} ${V(23, 21)} ${hy - 6} Z`} fill={sil ?? lighten(ID.paper, 0.25)} stroke={ink} strokeWidth={2.2} />
              <path d={`M${V(-17, -20)} ${hy - 10} Q${V(3, 0)} ${hy - 14} ${V(23, 20)} ${hy - 10}`} stroke={sil ?? mix(ID.paper, ID.copper, 0.3)} strokeWidth={2} fill="none" />
            </g>
          ) : null}
          {L.head === "ghutra" ? (
            <g>
              <path d={`M${V(-24, -27)} ${V(shY + 6, shY + 8)} Q${V(-28, -30)} ${hy - 28} ${V(3, 0)} ${hy - 29} Q${V(26, 30)} ${hy - 28} ${V(25, 27)} ${V(hy - 6, shY + 8)} L${V(20, 18)} ${V(hy - 4, shY + 4)} Q${V(4, 16)} ${V(hy - 14, hy - 14)} ${V(-10, 0)} ${V(hy - 2, hy - 14)} Q${V(-16, -16)} ${V(hy + 16, hy - 14)} ${V(-14, -18)} ${V(shY + 8, shY + 4)} Z`} fill={sil ?? lighten(ID.paper, 0.2)} stroke={ink} strokeWidth={2.4} />
              <path d={`M${V(-19, -21)} ${hy - 14} Q${V(3, 0)} ${hy - 22} ${V(24, 21)} ${V(hy - 13, hy - 14)}`} stroke={sil ?? darken(ID.night, 0.4)} strokeWidth={5} fill="none" />
            </g>
          ) : null}
        </g>
      )}
    </g>
  );

  const held = (() => {
    const [hx, hy2] = af.h;
    switch (holding) {
      case "paper":
        return <rect x={hx - 2} y={hy2 - 34} width={34} height={44} rx={2} fill={sil ?? ID.paper} stroke={ink} strokeWidth={2} transform={`rotate(-8 ${hx} ${hy2})`} />;
      case "phone":
        return (
          <g transform={`rotate(-10 ${hx} ${hy2})`}>
            <rect x={hx - 2} y={hy2 - 30} width={21} height={38} rx={4} fill={sil ?? darken(ID.night, 0.3)} stroke={ink} strokeWidth={2} />
            <rect x={hx + 1} y={hy2 - 26} width={15} height={29} rx={2} fill={sil ?? mix(ID.dawn, ID.paper, 0.5)} opacity={0.9} />
          </g>
        );
      case "cup":
        return (
          <g>
            <path d={`M${hx - 4} ${hy2 - 22} L${hx + 14} ${hy2 - 22} L${hx + 11} ${hy2 + 2} L${hx - 1} ${hy2 + 2} Z`} fill={sil ?? mix(ID.paper, ID.dawn, 0.3)} stroke={ink} strokeWidth={1.8} opacity={0.95} />
            <rect x={hx - 2} y={hy2 - 12} width={14} height={12} fill={sil ?? darken(ID.seal, 0.2)} opacity={0.8} />
          </g>
        );
      case "coins":
        return (
          <g>
            <path d={`M${hx - 14} ${hy2 - 4} q-6 -26 14 -30 q20 4 14 30 z`} fill={sil ?? darken(ID.copper, 0.35)} stroke={ink} strokeWidth={2} />
            <rect x={hx - 6} y={hy2 - 36} width={12} height={6} rx={2} fill={sil ?? ID.copper} />
            {[0, 1, 2].map((k) => (
              <ellipse key={k} cx={hx + 18 + k * 2} cy={hy2 + 4 - k * 5} rx={8} ry={3} fill={sil ?? ID.dawn} stroke={ink} strokeWidth={1.2} />
            ))}
          </g>
        );
      case "book":
        return (
          <g transform={`rotate(-10 ${hx} ${hy2})`}>
            <path d={`M${hx - 30} ${hy2 - 22} q15 -6 30 0 v34 q-15 -6 -30 0 z`} fill={sil ?? ID.paper} stroke={ink} strokeWidth={2} />
            <path d={`M${hx} ${hy2 - 22} q15 -6 30 0 v34 q-15 -6 -30 0 z`} fill={sil ?? mix(ID.paper, ID.copper, 0.15)} stroke={ink} strokeWidth={2} />
          </g>
        );
      default:
        return null;
    }
  })();
  const bundleEl = holding === "bundle" ? <path d={`M${sh[0] - 18} ${sh[1] + 4} q-62 -14 -66 44 q-4 62 40 74 q30 4 34 -30 z`} fill={sil ?? darken(ID.copper, 0.35)} stroke={ink} strokeWidth={2.4} /> : null;
  // الحِمل على الظهر يختفي خلف الجسد كلما واجه الناظر
  const bundle = flat || !bundleEl ? bundleEl : <g opacity={1 - sY}>{bundleEl}</g>;

  const rimLayer =
    rim > 0 && !sil ? (
      <g style={{ mixBlendMode: "screen" }} opacity={flat ? rim * 0.6 : rim * 0.6 * cY} transform={`rotate(${leanV} 0 ${hipY})`}>
        <path d={`M${E(30, 40)} ${shY + 16} Q${E(29, 39)} ${(shY + waist) / 2} ${E(25, 32)} ${waist}`} fill="none" stroke={rimColor} strokeWidth={5} strokeLinecap="round" />
        <path d={`M14 ${hy - 22} Q26 ${hy - 10} 22 ${hy + 10}`} fill="none" stroke={rimColor} strokeWidth={4.5} strokeLinecap="round" transform={`rotate(${headTilt} 0 ${neckTop + 6})`} />
      </g>
    ) : null;

  return (
    <g transform={`translate(${x} ${y}) scale(${(facing ?? (flip ? -1 : 1)) * scale} ${scale})`} opacity={opacity}>
      {shadow ? <ellipse cx={6} cy={2} rx={64} ry={10} fill="#000" opacity={0.3 * opacity} /> : null}
      {bundle}
      {sY < 0.85 ? sleeve(ab, true, "ab") : null}
      {skirt ? null : legsBack}
      {shoeEl(lb.f, "sb")}
      {skirt ? null : legsFront}
      {shoeEl(lf.f, "sf")}
      {skirt}
      {skirtFolds}
      <g transform={`rotate(${leanV} 0 ${hipY})`}>
        {torso}
        {headEl}
      </g>
      {/* أماميًا الذراعان على جانبي الجذع، فلا تختفي البعيدة خلفه */}
      {sY >= 0.85 ? sleeve(ab, true, "ab") : null}
      {held && holding === "paper" ? held : null}
      {sleeve(af, false, "af")}
      {held && holding !== "paper" ? held : null}
      {rimLayer}
    </g>
  );
};
