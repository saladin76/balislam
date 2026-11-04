import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { useTheme } from "../../../brand/identity/index";
import { SceneShell } from "./SceneShell";
import { LogoMark } from "../../../brand/logo/Logo";
import { useChannel } from "../../channel/context";
import { estimateTimings } from "./timing";
import { normalizeArabic } from "../../script/quranMeta";
import { camAt, camTransform, type CamKey } from "../illus/shots/kit";
import { INK_SHOTS } from "../zubdat/shots";
import { H, W, Paper, makeAt, makeEnd, type Z } from "../zubdat/inkKit";
import type { SceneBase, StringFields } from "./types";

/**
 * «مشهد حبر مصمَّم» (زبدة الكتب): كل مشهد حدث بصري خاص بجملته، يُختار بحقل shot،
 * ويُرسم بهوية «القلم المميِّز» على ورق القناة، والكاميرا فوق الدفتر.
 */
export type InkShotProps = SceneBase & StringFields<"shot">;

/** يدمج لحظات الأحداث في مسار الكاميرا: ميل نحو موضع الحدث مع تقريب خفيف، إلا في نوافذ السكون */
const withFocus = (keys: CamKey[], focus: [number, number, number][], still: [number, number][], len: number): CamKey[] => {
  const base = [...keys].sort((a, b) => a.t - b.t);
  const inStill = (t: number) => still.some(([a, b]) => t > a - len && t < b);
  const added = focus
    .filter(([t]) => !inStill(t) && !base.some((k) => Math.abs(k.t - t) < 10))
    .map(([t, x, y]) => {
      const b0 = camAt(t, base, len);
      return { t: t - 4, x: b0.x + (x - b0.x) * 0.38, y: b0.y + (y - b0.y) * 0.32, z: b0.z * 1.1 };
    });
  // لا يبدأ انتقال ولا يمر داخل نافذة سكون: يُؤجَّل إلى نهايتها
  const shift = (k: CamKey): CamKey => {
    for (const [a, b] of still) if (k.t > a - len && k.t < b) return { ...k, t: b };
    return k;
  };
  const all = [...base.map((k, i) => (i === 0 ? k : shift(k))), ...added].sort((a, b) => a.t - b.t);
  // لا يبدأ انتقال قبل أن يكتمل سابقه بقليل (لا ارتجاف)
  return all.filter((k, i) => i === 0 || k.t - all[i - 1]!.t >= 8);
};

const SACRED = /الله|لله|ربنا|ربه|ربك|سبحانه|تعالي|تعالى/;

export const InkShot: React.FC<InkShotProps> = (props) => {
  const frame = useCurrentFrame();
  const { durationInFrames: dur } = useVideoConfig();
  const t = useTheme("paper");
  const portrait = props.orientation === "portrait";
  const narration = props.narration ?? "";
  const timings = narration ? (props.narrationTimings ?? estimateTimings(narration, 6, dur - 12)) : [];
  const z: Z = { ink: t.colors.ink, paper: t.colors.bg, hl: t.colors.highlight, alert: t.colors.secondary, faint: t.colors.inkSoft };
  const def = INK_SHOTS[props.shot ?? ""];
  const channelMark = useChannel().logo;
  const logo = (size: number) => <LogoMark size={size} colors={t.logo} mark={channelMark} />;
  const shot = def ? def.render({ frame, dur, z, at: makeAt(timings, dur), end: makeEnd(timings, dur), logo }) : null;
  // سكون تام للكاميرا عند كل ذكر لله (ومع نوافذ المشهد الخاصة)
  const sacred: [number, number][] = timings.filter((w) => SACRED.test(normalizeArabic(w.word))).map((w) => [w.start - 8, w.end + 8]);
  const c = shot ? camAt(frame, withFocus(shot.cam, shot.focus ?? [], [...(shot.still ?? []), ...sacred], shot.camLen ?? 22), shot.camLen ?? 22) : { x: W / 2, y: H / 2, z: 1 };
  const vb = portrait ? `${W / 2 - 304} 0 608 1080` : `0 0 ${W} ${H}`;
  return (
    <SceneShell {...props} eyebrow={undefined} motif={false} background={z.paper} durationInFrames={dur}>
      <AbsoluteFill>
        <svg viewBox={vb} preserveAspectRatio="xMidYMid slice" width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          <g transform={camTransform(c)}>
            <Paper z={z} />
            {shot?.world}
          </g>
          {/* صفحة جديدة لكل فكرة: الورقة السابقة تُقلب من اليسار إلى اليمين (اتجاه تقليب الكتاب العربي) */}
          {frame < 16 ? (
            <g transform={`translate(${interpolate(frame, [0, 15], [0, W * 1.08], { extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) })} 0)`}>
              <rect x={-40} y={0} width={40} height={H} fill={z.ink} opacity={0.12} />
              <rect x={0} y={0} width={W} height={H} fill={z.paper} />
              {Array.from({ length: 20 }, (_, i) => (
                <line key={i} x1={0} x2={W} y1={26 + i * 54} y2={26 + i * 54} stroke={z.ink} strokeOpacity={0.055} strokeWidth={2} />
              ))}
              <line x1={W - 150} x2={W - 150} y1={0} y2={H} stroke={z.alert} strokeOpacity={0.28} strokeWidth={3} />
            </g>
          ) : null}
        </svg>
      </AbsoluteFill>
    </SceneShell>
  );
};

export const inkShotSample: Omit<InkShotProps, "themeId" | "orientation"> = {
  shot: "one-step",
  narration: "وَلِنَجْعَلْ مِنْ هَذِهِ الْحَلْقَةِ خُطْوَةً وَاحِدَةً نَسْتَطِيعُ فِعْلَهَا: قَبْلَ صَلَاتِنَا الْقَادِمَةِ، نَتَوَقَّفُ قَلِيلًا، وَنَسْتَحْضِرُ مَعْنَى التَّكْبِيرِ الَّذِي سَنَدْخُلُ بِهِ فِي الصَّلَاةِ. خُطْوَةٌ صَغِيرَةٌ، وَلَكِنَّهَا تَتَّجِهُ بِنَا إِلَى الْمَقْصُودِ.",
};
export const inkShotSampleEn = inkShotSample;
export const inkShotSeconds = 13;
