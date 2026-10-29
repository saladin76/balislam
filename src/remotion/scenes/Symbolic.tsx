import React from "react";
import { Easing, interpolate, spring, useVideoConfig } from "remotion";
import { useMotionSettings, usePalette, useSize, useTheme } from "../../../brand/identity/index";
import { fontFamilies } from "../../../brand/fonts";
import { Element } from "../../../brand/elements/Element";
import { hasElement } from "../../../brand/elements/registry";
import { SceneShell } from "./SceneShell";
import { enter, fade, float, useBoil, useSceneFrame } from "./motion";
import type { SceneBase, StringFields } from "./types";

export type SymbolicProps = SceneBase & StringFields<"element" | "secondElement" | "relation" | "caption" | "effect">;

type Effect = "pop" | "grow" | "shake" | "float";
type Relation = "becomes" | "versus" | "plus";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** حركة العنصر حسب التأثير المختار، تبدأ عند الإطار at. */
const effectStyle = (effect: Effect, frame: number, at: number, floatAmp: number) => {
  const f = frame - at;
  const opacity = interpolate(f, [0, 6], [0, 1], clamp);
  switch (effect) {
    case "pop": {
      const s = spring({ frame: f, fps: 30, config: { damping: 9, stiffness: 170, mass: 0.8 } });
      return { opacity, transform: `scale(${s})`, origin: "50% 55%", lift: 0 };
    }
    case "grow": {
      // نمو كالنبتة: يمتد طولًا قبل أن يكتمل عرضًا، من القاعدة، مع تمايل يهدأ.
      const gy = interpolate(f, [0, 34], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.5)) });
      const gx = interpolate(f, [4, 44], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.3)) });
      const sway = Math.sin(f / 8) * 5 * (1 - interpolate(f, [16, 70], [0, 1], clamp)) * (f > 0 ? 1 : 0);
      return { opacity, transform: `rotate(${sway}deg) scale(${0.08 + 0.92 * gx}, ${0.08 + 0.92 * gy})`, origin: "50% 92%", lift: 0 };
    }
    case "shake": {
      const s = spring({ frame: f, fps: 30, config: { damping: 16, stiffness: 150, mass: 0.9 } });
      const env = shakeEnv(f);
      const rot = Math.sin(frame * 1.9) * 7 * env;
      const tx = Math.sin(frame * 2.7) * 10 * env;
      return { opacity, transform: `translateX(${tx}px) rotate(${rot}deg) scale(${0.7 + 0.3 * s})`, origin: "50% 80%", lift: 0 };
    }
    case "float": {
      const a = spring({ frame: f, fps: 30, config: { damping: 18, stiffness: 80, mass: 1 } });
      const fl = float(frame, 16 * floatAmp, 96);
      const rot = Math.sin(frame / 40) * 3;
      return { opacity, transform: `translateY(${(1 - a) * 70 + fl}px) rotate(${rot}deg)`, origin: "50% 50%", lift: fl };
    }
  }
};

/** نوبتا اهتزاز قصيرتان (0 → 1 → 0) بعد الظهور. */
const shakeEnv = (f: number) => {
  const burst = (from: number, len: number) => (f >= from && f <= from + len ? Math.sin(((f - from) / len) * Math.PI) : 0);
  return burst(16, 26) + burst(64, 22) * 0.8;
};

/** نجمة رباعية صغيرة (لمعة). */
const Sparkle: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 20 20">
    <path d="M10 0 Q11.4 8.6 20 10 Q11.4 11.4 10 20 Q8.6 11.4 0 10 Q8.6 8.6 10 0Z" fill={color} />
  </svg>
);

/**
 * «المشهد الرمزي»: لحظة الاستعارة في الحلقة. عنصر واحد كبير بحركة مقصودة
 * (ظهور، نمو كالنبتة، اهتزاز، طفو)، أو عنصران بعلاقة: يتحول إلى (يُرسم سهم وتنتقل «روح» الأول
 * على السهم فيولد الثاني)، أو مقابل (فاصل بينهما)، أو مع (+). ثم عبارة قصيرة.
 */
export const Symbolic: React.FC<SymbolicProps> = (props) => {
  const { themeId, orientation, element, secondElement, relation, caption, effect } = props;
  const frame = useSceneFrame();
  const boil = useBoil();
  const motion = useMotionSettings();
  const bubbleSize = useSize("bubble", orientation);
  const { durationInFrames } = useVideoConfig();
  const t = useTheme(themeId);
  const p = usePalette(themeId);
  const c = t.colors;
  const portrait = orientation === "portrait";
  const ink = t.character.style === "line";
  const night = themeId === "night";

  const first = element && hasElement(element) ? element : "lightbulb";
  const second = secondElement && hasElement(secondElement) ? secondElement : undefined;
  const fx: Effect = effect === "grow" || effect === "shake" || effect === "float" ? effect : "pop";
  const rel: Relation | undefined = second ? (relation === "versus" || relation === "plus" ? relation : "becomes") : undefined;

  // ---------- مكوّنات صغيرة ----------
  const halo = (size: number, a: number, seed: number) => (
    <div style={{ position: "absolute", left: "50%", top: "50%", width: 0, height: 0 }}>
      <div
        style={{
          position: "absolute",
          width: size * 1.12,
          height: size * 1.12,
          left: -size * 0.56,
          top: -size * 0.56,
          borderRadius: "50%",
          background: ink ? c.secondary : night ? c.secondary : c.highlight,
          opacity: (ink ? 0.4 : night ? 0.14 : 0.38) * a,
          transform: `scale(${0.6 + 0.4 * a})`,
        }}
      />
      <svg
        width={size * 1.3}
        height={size * 1.3}
        viewBox="0 0 100 100"
        style={{ position: "absolute", left: -size * 0.65, top: -size * 0.65, opacity: a * (ink ? 0.55 : 0.4), transform: `rotate(${frame * 0.25 + seed * 40}deg)` }}
      >
        <circle cx={50} cy={50} r={48} fill="none" stroke={ink ? c.ink : c.primary} strokeWidth={ink ? 0.5 : 0.45} strokeDasharray="1.2 3.2" strokeLinecap="round" />
      </svg>
    </div>
  );

  const groundShadow = (size: number, a: number, lift: number) => {
    const k = 1 - Math.max(-1, Math.min(1, lift / 20)) * 0.18;
    return (
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: size * 0.93,
          width: size * 0.62 * k,
          height: size * 0.07,
          marginLeft: (-size * 0.62 * k) / 2,
          borderRadius: "50%",
          background: p.shadow,
          opacity: a,
        }}
      />
    );
  };

  /** خطوط انفجار صغيرة حول العنصر لحظة ظهوره. */
  const burst = (size: number, at: number, color: string) => {
    const b = interpolate(frame, [at + 3, at + 22], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
    if (b <= 0 || b >= 1) return null;
    const r1 = size * (0.5 + 0.16 * b);
    const r2 = size * (0.58 + 0.2 * b);
    return (
      <svg width={size * 2} height={size * 2} style={{ position: "absolute", left: -size / 2, top: -size / 2, overflow: "visible", opacity: 1 - b }}>
        {Array.from({ length: 12 }, (_, k) => {
          const ang = (k / 12) * Math.PI * 2 + 0.26;
          const cx = size;
          const cy = size;
          return <line key={k} x1={cx + Math.cos(ang) * r1} y1={cy + Math.sin(ang) * r1} x2={cx + Math.cos(ang) * r2} y2={cy + Math.sin(ang) * r2} stroke={color} strokeWidth={size * 0.018} strokeLinecap="round" />;
        })}
      </svg>
    );
  };

  /** لمعات تظهر بعد اكتمال النمو. */
  const sparkles = (size: number, at: number) => {
    const spots = [
      { x: 0.08, y: 0.18, s: 0.1, d: 0 },
      { x: 0.9, y: 0.3, s: 0.075, d: 6 },
      { x: 0.82, y: 0.02, s: 0.055, d: 11 },
    ];
    return spots.map((sp, k) => {
      const a = enter(frame, at + sp.d, 30, 220);
      const tw = 0.85 + 0.15 * Math.sin((frame + k * 17) / 7);
      return (
        <div key={k} style={{ position: "absolute", left: sp.x * size - (sp.s * size) / 2, top: sp.y * size, transform: `scale(${a * tw}) rotate(${(1 - a) * 90}deg)`, opacity: Math.min(1, a * 1.4) }}>
          <Sparkle size={sp.s * size} color={ink ? c.primary : c.primary} />
        </div>
      );
    });
  };

  /** خطوط حركة على الجانبين أثناء الاهتزاز. */
  const shakeLines = (size: number, at: number) => {
    const env = shakeEnv(frame - at);
    if (env < 0.05) return null;
    const arc = (dir: 1 | -1) => (
      <svg width={size * 0.3} height={size * 0.6} viewBox="0 0 30 60" style={{ position: "absolute", top: size * 0.2, [dir === 1 ? "right" : "left"]: -size * 0.24, opacity: env, transform: `scaleX(${dir})` }}>
        <path d="M6 8 Q18 30 6 52" fill="none" stroke={ink ? c.ink : c.primary} strokeWidth={3.5} strokeLinecap="round" />
        <path d="M18 16 Q26 30 18 44" fill="none" stroke={ink ? c.ink : c.primary} strokeWidth={3.5} strokeLinecap="round" />
      </svg>
    );
    return (
      <>
        {arc(1)}
        {arc(-1)}
      </>
    );
  };

  /** العنصر الرئيس مع تأثيره، وهالته، وظله، وزخارف حركته. */
  const hero = (id: string, size: number, at: number, seed: number, effectName: Effect = fx) => {
    const st = effectStyle(effectName, frame, at, motion.float);
    const a = interpolate(frame - at, [0, 14], [0, 1], clamp);
    return (
      <div style={{ position: "relative", width: size, height: size }}>
        {halo(size, enter(frame, at - 4, 30, 90), seed)}
        {groundShadow(size, a, st.lift)}
        {effectName === "pop" ? burst(size, at, c.primary) : null}
        {effectName === "shake" ? shakeLines(size, at) : null}
        <div style={{ position: "absolute", inset: 0, opacity: st.opacity, transform: `${st.transform} ${ink ? boil(frame, seed * 7 + 1, 0.8) : ""}`, transformOrigin: st.origin }}>
          <Element id={id} theme={t} size={size} />
        </div>
        {effectName === "grow" ? sparkles(size, at + 34) : null}
      </div>
    );
  };

  // ---------- العبارة ----------
  const captionEl = (at: number) => {
    const a = enter(frame, at, 30, 120);
    const u = fade(frame, at + 10, 16);
    return caption ? (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: portrait ? 18 : 14 }}>
        <div
          style={{
            fontFamily: fontFamilies.heading,
            fontWeight: 700,
            fontSize: Math.round(bubbleSize * ((caption ?? "").length > 30 ? 0.88 : 1)),
            lineHeight: 1.4,
            textAlign: "center",
            maxWidth: portrait ? 920 : 1320,
            textWrap: "balance",
            opacity: a,
            transform: `translateY(${(1 - a) * 24}px)`,
          }}
        >
          {caption}
        </div>
        <div style={{ width: portrait ? 140 : 120, height: 6, borderRadius: 3, background: c.primary, transform: `scaleX(${u}) ${ink ? boil(frame, 13, 0.4) : ""}`, opacity: 0.9 }} />
      </div>
    ) : null;
  };

  const wrap = (stage: React.ReactNode, captionAt: number) => (
    <SceneShell {...props} durationInFrames={durationInFrames}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: portrait ? 40 : 34,
          padding: portrait ? "320px 70px 570px" : "120px 160px 200px",
        }}
      >
        {stage}
        {captionEl(captionAt)}
      </div>
    </SceneShell>
  );

  // ---------- عنصر واحد ----------
  if (!second || !rel) {
    const size = portrait ? 520 : 480;
    return wrap(<div style={{ flexShrink: 0 }}>{hero(first, size, 4, 1)}</div>, fx === "grow" ? 34 : 24);
  }

  // ---------- عنصران ----------
  const longCaption = (caption ?? "").length > 30;
  const size = portrait ? (longCaption ? 260 : 300) : 380;
  const W = portrait ? 940 : 1440;
  const H = portrait ? (longCaption ? 690 : 860) : 460;
  // المركزان: الأول يمينًا (أو أعلى)، الثاني يسارًا (أو أسفل).
  const A = portrait ? { x: W / 2, y: size / 2 + 6 } : { x: W / 2 + 440, y: H / 2 };
  const B = portrait ? { x: W / 2, y: H - size / 2 - 6 } : { x: W / 2 - 440, y: H / 2 };
  const box = (pt: { x: number; y: number }, child: React.ReactNode, extra?: React.CSSProperties) => (
    <div style={{ position: "absolute", left: pt.x - size / 2, top: pt.y - size / 2, width: size, height: size, ...extra }}>{child}</div>
  );

  if (rel === "becomes") {
    // ١) الأول يظهر في الوسط كبيرًا ٢) ينتقل إلى موضعه ويصغر ٣) يُرسم السهم ٤) تسري «روحه» على السهم ٥) يولد الثاني.
    const firstIn = 2;
    const moveFrom = 30;
    const move = interpolate(frame, [moveFrom, moveFrom + 18], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
    const center = { x: W / 2, y: H / 2 };
    const pos = { x: center.x + (A.x - center.x) * move, y: center.y + (A.y - center.y) * move };
    
    const arrowFrom = moveFrom + 12;
    const arrowLen = 18;
    const draw = interpolate(frame, [arrowFrom, arrowFrom + arrowLen], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
    const headIn = fade(frame, arrowFrom + arrowLen - 3, 8);
    const ghostFrom = arrowFrom + arrowLen - 4;
    const ghostLen = 22;
    const g = interpolate(frame, [ghostFrom, ghostFrom + ghostLen], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
    const heroAt = ghostFrom + ghostLen - 6;
    const dim = interpolate(frame, [ghostFrom, ghostFrom + 10], [1, 0.45], clamp);
    const scale = interpolate(move, [0, 1], [1.25, 1]) * interpolate(frame, [ghostFrom, ghostFrom + 12], [1, 0.9], clamp);

    // السهم: قوس لطيف بين الموضعين (يبتعد عن العنصرين بهامش).
    const gap = size * (portrait ? 0.56 : 0.62);
    const S = portrait ? { x: A.x, y: A.y + gap } : { x: A.x - gap, y: A.y };
    const E = portrait ? { x: B.x, y: B.y - gap } : { x: B.x + gap, y: B.y };
    const bend = portrait ? { x: -34, y: 0 } : { x: 0, y: -70 };
    const Cc = { x: (S.x + E.x) / 2 + bend.x, y: (S.y + E.y) / 2 + bend.y };
    const q = (u: number) => ({
      x: (1 - u) * (1 - u) * S.x + 2 * (1 - u) * u * Cc.x + u * u * E.x,
      y: (1 - u) * (1 - u) * S.y + 2 * (1 - u) * u * Cc.y + u * u * E.y,
    });
    const tan = { x: E.x - Cc.x, y: E.y - Cc.y };
    const tl = Math.hypot(tan.x, tan.y) || 1;
    const ux = tan.x / tl;
    const uy = tan.y / tl;
    const hs = 26;
    const head = `M${E.x - ux * hs - uy * hs * 0.75} ${E.y - uy * hs + ux * hs * 0.75} L${E.x} ${E.y} L${E.x - ux * hs + uy * hs * 0.75} ${E.y - uy * hs - ux * hs * 0.75}`;
    const gp = q(g);
    const ghostSize = size * 0.42;
    const ghostOn = g > 0 && g < 1;

    const stage = (
      <div style={{ position: "relative", width: W, height: H, flexShrink: 0 }}>
        <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible", transform: ink ? boil(frame, 5, 0.3) : undefined }}>
          <path d={`M${S.x} ${S.y} Q${Cc.x} ${Cc.y} ${E.x} ${E.y}`} fill="none" stroke={ink ? c.ink : c.primary} strokeWidth={8} strokeLinecap="round" strokeDasharray="0.001 0.035" pathLength={1} opacity={0.35 * fade(frame, arrowFrom - 4, 8)} />
          <path d={`M${S.x} ${S.y} Q${Cc.x} ${Cc.y} ${E.x} ${E.y}`} fill="none" stroke={ink ? c.ink : c.primary} strokeWidth={8} strokeLinecap="round" pathLength={1} strokeDasharray={`${draw} 1`} />
          <path d={head} fill="none" stroke={ink ? c.ink : c.primary} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" opacity={headIn} />
        </svg>
        <div style={{ position: "absolute", left: pos.x - size / 2, top: pos.y - size / 2, width: size, height: size, transform: `scale(${scale})`, opacity: dim }}>
          {hero(first, size, firstIn, 1, "pop")}
        </div>
        {ghostOn ? (
          <div
            style={{
              position: "absolute",
              left: gp.x - ghostSize / 2,
              top: gp.y - ghostSize / 2,
              width: ghostSize,
              height: ghostSize,
              transform: `scale(${0.8 + 0.4 * Math.sin(g * Math.PI)}) rotate(${g * 20 - 10}deg)`,
            }}
          >
            <div style={{ position: "absolute", inset: -ghostSize * 0.18, borderRadius: "50%", background: ink ? c.secondary : c.highlight, opacity: night ? 0.35 : 0.6 }} />
            <div style={{ position: "absolute", inset: 0, opacity: 1 - g }}>
              <Element id={first} theme={t} size={ghostSize} />
            </div>
            <div style={{ position: "absolute", inset: 0, opacity: g }}>
              <Element id={second} theme={t} size={ghostSize} />
            </div>
          </div>
        ) : null}
        {box(B, <>{hero(second, size, heroAt, 2)}{fx !== "pop" ? burst(size, heroAt - 2, c.primary) : null}</>)}
      </div>
    );
    return wrap(stage, heroAt + (fx === "grow" ? 20 : 12));
  }

  // مقابل / مع: كلاهما بالتأثير نفسه، بتتابع.
  const atA = 4;
  const atB = rel === "plus" ? 24 : 16;
  const mid = { x: W / 2, y: H / 2 };
  let middle: React.ReactNode;
  if (rel === "versus") {
    const d = interpolate(frame, [8, 28], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
    const gem = enter(frame, 22, 30, 200);
    const len = portrait ? W * 0.62 : H * 0.95;
    middle = (
      <>
        <div
          style={{
            position: "absolute",
            left: portrait ? mid.x - (len * d) / 2 : mid.x - 2.5,
            top: portrait ? mid.y - 2.5 : mid.y - (len * d) / 2,
            width: portrait ? len * d : 5,
            height: portrait ? 5 : len * d,
            borderRadius: 3,
            background: ink ? c.ink : c.inkSoft,
            opacity: 0.55,
            transform: ink ? boil(frame, 17, 0.3) : undefined,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: mid.x - 26,
            top: mid.y - 26,
            width: 52,
            height: 52,
            background: c.bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${gem}) rotate(${45 + (1 - gem) * 90}deg)`,
          }}
        >
          <div style={{ width: 30, height: 30, background: ink ? c.secondary : c.primary, border: ink ? `3px solid ${c.ink}` : "none", boxSizing: "border-box" }} />
        </div>
      </>
    );
  } else {
    const pl = spring({ frame: frame - 14, fps: 30, config: { damping: 10, stiffness: 180, mass: 0.8 } });
    const ps = portrait ? 110 : 120;
    middle = (
      <div style={{ position: "absolute", left: mid.x - ps / 2, top: mid.y - ps / 2, width: ps, height: ps, transform: `scale(${pl}) rotate(${(1 - pl) * -90}deg) ${ink ? boil(frame, 19, 0.6) : ""}` }}>
        <svg width={ps} height={ps} viewBox="0 0 100 100">
          <path d="M50 14 V86 M14 50 H86" stroke={ink ? c.ink : c.primary} strokeWidth={16} strokeLinecap="round" />
          {ink ? <path d="M50 14 V86 M14 50 H86" stroke={c.secondary} strokeWidth={7} strokeLinecap="round" /> : null}
        </svg>
      </div>
    );
  }
  const slideA = enter(frame, atA, 30, 120);
  const slideB = enter(frame, atB, 30, 120);
  const offA = portrait ? `translateY(${(1 - slideA) * -50}px)` : `translateX(${(1 - slideA) * 80}px)`;
  const offB = portrait ? `translateY(${(1 - slideB) * 50}px)` : `translateX(${(1 - slideB) * -80}px)`;
  const stage = (
    <div style={{ position: "relative", width: W, height: H, flexShrink: 0 }}>
      {middle}
      {box(A, hero(first, size, atA, 1), { transform: offA })}
      {box(B, hero(second, size, atB, 2), { transform: offB })}
    </div>
  );
  return wrap(stage, atB + 22);
};

/** محتوى تجريبي لمعاينة القالب. */
export const symbolicSample: Omit<SymbolicProps, "themeId" | "orientation"> = {
  eyebrow: "الفصل 5 · كيف نبدأ",
  element: "seed",
  secondElement: "tree",
  relation: "becomes",
  caption: "خطوة صغيرة اليوم… أثر كبير غدًا",
  effect: "grow",
  narration: "البذرة الصغيرة اليوم تصبح شجرة غدًا.",
};
export const symbolicSeconds = 6;
