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

const THIGH = 62;
const SHIN = 60;
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

export type PoseName = "stand" | "think" | "sit" | "sit-low" | "head-down" | "hold" | "cross" | "point" | "look-up" | "nod" | "turn-away";

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
const step = (x: number, y: number, len: number, ang: number) => [x + len * Math.sin(rad(ang)), y + len * Math.cos(rad(ang))] as const;
/** دوران نقطة حول مركز (لإمالة الجذع) */
const rot = (x: number, y: number, cx: number, cy: number, ang: number) => {
  const a = rad(ang);
  const dx = x - cx;
  const dy = y - cy;
  return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)] as const;
};

export type Outfit = "jacket" | "thobe" | "abaya";
export type HeadWear = "hair" | "kufi" | "hijab" | "bare";
export type FigureLook = { outfit: Outfit; cloth: ClothId; head: HeadWear; skin: 0 | 1; hair?: string };

export const LOOKS = {
  hero: { outfit: "jacket", cloth: "emerald", head: "hair", skin: 1 },
  heroThobe: { outfit: "thobe", cloth: "paper", head: "kufi", skin: 1 },
  woman: { outfit: "abaya", cloth: "ink", head: "hijab", skin: 0 },
  womanSand: { outfit: "abaya", cloth: "sand", head: "hijab", skin: 1 },
  elder: { outfit: "thobe", cloth: "sand", head: "kufi", skin: 0 },
  friend: { outfit: "jacket", cloth: "clay", head: "hair", skin: 0 },
  stranger: { outfit: "jacket", cloth: "copper", head: "bare", skin: 1 },
} satisfies Record<string, FigureLook>;
export type LookId = keyof typeof LOOKS;

export type Holding = "paper" | "phone" | "bundle" | "none";

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
};

export const Figure: React.FC<FigureProps> = ({ x, y, scale = 1, pose, look = LOOKS.hero, flip = false, opacity = 1, shadow = true, rim = 0, rimColor = ID.dawn, holding = "none", frame = 0, silhouette }) => {
  const cloth = silhouette ?? CLOTH[look.cloth];
  const clothDark = silhouette ?? darken(cloth, 0.22);
  const skin = silhouette ?? SKIN[look.skin];
  const legCol = silhouette ?? (look.outfit === "jacket" ? darken(ID.night, 0.25) : darken(cloth, 0.08));
  const shoe = silhouette ?? mix(ID.paper, ID.copper, 0.15);
  const hairCol = silhouette ?? (look as FigureLook).hair ?? darken(ID.night, 0.35);
  const breathe = Math.sin(frame / 22) * 1.1;

  // الساقان: ارتفاع الورك يتحدد بأبعد قدم عن الورك، فتلمس الأرض دائمًا
  const drop = (l: Limb) => THIGH * Math.cos(rad(l.s)) + SHIN * Math.cos(rad(l.s - l.e));
  const hipY = -Math.max(drop(pose.legBack), drop(pose.legFront));
  const hip = [0, hipY] as const;
  const leg = (l: Limb) => {
    const k = step(hip[0], hip[1], THIGH, l.s);
    const f = step(k[0], k[1], SHIN, l.s - l.e);
    return { k, f };
  };
  const lb = leg(pose.legBack);
  const lf = leg(pose.legFront);

  // الجذع يميل حول الورك
  const sh = rot(0, hipY - TORSO + breathe, 0, hipY, pose.lean);
  const neck = rot(0, hipY - TORSO - 8 + breathe, 0, hipY, pose.lean);
  const headC = rot(neck[0], neck[1] - NECK + HEAD_R * 0.4, neck[0], neck[1], pose.lean + pose.head);
  const arm = (l: Limb) => {
    const e = step(sh[0], sh[1], UPPER, l.s + pose.lean * 0.6);
    const h = step(e[0], e[1], FORE, l.s + l.e + pose.lean * 0.6);
    return { e, h };
  };
  const ab = arm(pose.armBack);
  const af = arm(pose.armFront);

  const robe = look.outfit !== "jacket";
  const legW = robe ? 30 : 17;
  const armW = 15;
  const path = (pts: readonly (readonly [number, number])[]) => pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");

  // الجذع: شكل منحنٍ من الكتفين إلى الورك (والثوب يطول إلى الركبة)
  const torsoBottom = robe ? Math.max(lb.k[1], lf.k[1]) + 6 : hipY + 22;
  const tl = rot(-26, hipY - TORSO + 14 + breathe, 0, hipY, pose.lean);
  const tr = rot(24, hipY - TORSO + 14 + breathe, 0, hipY, pose.lean);
  const bl = robe ? ([-30 + Math.min(lb.k[0], lf.k[0]) * 0.4, torsoBottom] as const) : rot(-24, torsoBottom, 0, hipY, pose.lean * 0.4);
  const br = robe ? ([30 + Math.max(lb.k[0], lf.k[0]) * 0.55, torsoBottom] as const) : rot(26, torsoBottom, 0, hipY, pose.lean * 0.4);
  const torso = `M${tl[0]} ${tl[1]} Q${sh[0]} ${sh[1] - 12} ${tr[0]} ${tr[1]} Q${tr[0] + 8} ${(tr[1] + br[1]) / 2} ${br[0]} ${br[1]} L${bl[0]} ${bl[1]} Q${tl[0] - 8} ${(tl[1] + bl[1]) / 2} ${tl[0]} ${tl[1]} Z`;

  const limb = (a: readonly [number, number], b: readonly [number, number], c: readonly [number, number], col: string, w: number) => (
    <path d={path([a, b, c])} stroke={col} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  );
  const foot = (f: readonly [number, number], k: readonly [number, number]) => {
    void k;
    return <ellipse cx={f[0] + 7} cy={f[1] - 2} rx={13} ry={5.5} fill={shoe} />;
  };

  const head = (() => {
    const [hx, hy] = headC;
    if (look.head === "hijab")
      return (
        <g>
          <path d={`M${hx - 30} ${hy + 44} Q${hx - 33} ${hy - 30} ${hx} ${hy - 31} Q${hx + 33} ${hy - 30} ${hx + 30} ${hy + 44} Z`} fill={hairCol === darken(ID.night, 0.35) ? mix(cloth, ID.night, 0.4) : hairCol} />
          <circle cx={hx + 3} cy={hy + 1} r={HEAD_R * 0.78} fill={skin} />
        </g>
      );
    return (
      <g>
        <circle cx={hx} cy={hy} r={HEAD_R} fill={skin} />
        {look.head === "hair" ? <path d={`M${hx - HEAD_R - 1} ${hy + 4} Q${hx - HEAD_R - 2} ${hy - HEAD_R - 6} ${hx + 2} ${hy - HEAD_R - 2} Q${hx + HEAD_R + 2} ${hy - HEAD_R + 2} ${hx + HEAD_R} ${hy - 4} Q${hx + 4} ${hy - 12} ${hx - HEAD_R - 1} ${hy + 4} Z`} fill={hairCol} /> : null}
        {look.head === "kufi" ? <path d={`M${hx - HEAD_R - 0.5} ${hy - 4} A${HEAD_R + 0.5} ${HEAD_R + 0.5} 0 0 1 ${hx + HEAD_R + 0.5} ${hy - 4} Z`} fill={silhouette ?? lighten(ID.paper, 0.2)} /> : null}
      </g>
    );
  })();

  const held = (() => {
    const [hx, hy] = af.h;
    switch (holding) {
      case "paper":
        return <rect x={hx - 4} y={hy - 30} width={34} height={44} rx={3} fill={silhouette ?? ID.paper} transform={`rotate(${-8} ${hx} ${hy})`} />;
      case "phone":
        return <rect x={hx - 2} y={hy - 26} width={20} height={34} rx={4} fill={silhouette ?? ID.night} stroke={silhouette ?? ID.copper} strokeWidth={2} />;
      default:
        return null;
    }
  })();
  const bundle =
    holding === "bundle" ? (
      <path d={`M${sh[0] - 18} ${sh[1] + 4} q-62 -14 -66 44 q-4 62 40 74 q30 4 34 -30 z`} fill={silhouette ?? darken(ID.copper, 0.35)} />
    ) : null;

  const rimLayer =
    rim > 0 && !silhouette ? (
      <g style={{ mixBlendMode: "screen" }} opacity={rim * 0.55}>
        <path d={torso} fill="none" stroke={rimColor} strokeWidth={5} />
        <circle cx={headC[0]} cy={headC[1]} r={HEAD_R} fill="none" stroke={rimColor} strokeWidth={4} />
      </g>
    ) : null;

  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`} opacity={opacity}>
      {shadow ? <ellipse cx={4} cy={2} rx={58} ry={9} fill="#000" opacity={0.32 * opacity} /> : null}
      {bundle}
      {limb(sh, ab.e, ab.h, silhouette ?? darken(cloth, 0.3), armW)}
      {limb(hip, lb.k, lb.f, silhouette ?? darken(legCol, 0.15), legW)}
      {foot(lb.f, lb.k)}
      <path d={torso} fill={cloth} />
      {!robe ? <path d={`M${bl[0]} ${bl[1] - 6} L${br[0]} ${br[1] - 6}`} stroke={clothDark} strokeWidth={4} opacity={0.5} /> : null}
      {limb(hip, lf.k, lf.f, legCol, legW)}
      {foot(lf.f, lf.k)}
      {held && holding === "paper" ? held : null}
      {limb(sh, af.e, af.h, clothDark, armW)}
      <circle cx={af.h[0]} cy={af.h[1]} r={6.5} fill={skin} />
      {held && holding !== "paper" ? held : null}
      {head}
      {rimLayer}
    </g>
  );
};
