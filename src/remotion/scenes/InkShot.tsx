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
import { H, W, InkSpokenContext, PageSheet, Paper, fam, makeAt, makeEnd, measure, prog, type Z } from "../zubdat/inkKit";
import { allowFromName, inkShotWordIssue, spoken } from "../zubdat/spoken";
import { parseInkArgs } from "../zubdat/kitShots";
import type { SceneBase, StringFields } from "./types";

/**
 * «مشهد حبر مصمَّم» (زبدة الكتب): كل مشهد حدث بصري خاص بجملته، يُختار بحقل shot،
 * ويُرسم بهوية «القلم المميِّز» على ورق القناة، والكاميرا فوق الدفتر.
 */
export type InkShotProps = SceneBase & StringFields<"shot" | "task" | "labels" | "cues">;

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

/** حدود المنطقة الآمنة في إحداثيات المشهد (1920×1080)، وحد الترجمة على الشاشة */
export const SAFE = { x0: 192, x1: 1728, y0: 108, y1: 880, captionTop: 900 };
export const safeFrame = (c: { x: number; y: number; z: number }) => {
  // أقصى تقريب تتسع معه المنطقة الآمنة كلها فوق الترجمة (≈1.16)
  const z = Math.min(c.z, 1.16);
  const hw = W / (2 * z), hh = H / (2 * z);
  const clampX = (v: number) => (SAFE.x1 - hw <= SAFE.x0 + hw ? Math.min(SAFE.x0 + hw, Math.max(SAFE.x1 - hw, v)) : W / 2);
  // أسفل المنطقة الآمنة يقع فوق الترجمة: (y1 - y) * z + H/2 <= captionTop، وأعلاها مرئي: y - hh <= y0
  const yLo = SAFE.y1 - (SAFE.captionTop - H / 2) / z;
  const yHi = SAFE.y0 + hh;
  const y = yLo <= yHi ? Math.min(yHi, Math.max(yLo, c.y)) : (yLo + yHi) / 2;
  return { x: clampX(c.x), y, z };
};

type Reg = { r: [number, number, number, number]; t: number };

/** صندوق ما ظهر من عناصر المشهد (وما سيظهر خلال لحظة)، يتسع تدريجيًا فلا يقفز التقريب */
const contentBox = (regs: Reg[], frame: number): [number, number, number, number] | null => {
  const list = [...regs].sort((a, b) => a.t - b.t);
  let b: [number, number, number, number] | null = null;
  for (const { r, t } of list) {
    const k = interpolate(frame, [t - 26, t - 2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin) });
    if (k <= 0) break;
    if (!b) { const cx = (r[0] + r[2]) / 2, cy = (r[1] + r[3]) / 2; b = [cx, cy, cx, cy]; }
    const u: [number, number, number, number] = [Math.min(b[0], r[0]), Math.min(b[1], r[1]), Math.max(b[2], r[2]), Math.max(b[3], r[3])];
    b = [b[0] + (u[0] - b[0]) * k, b[1] + (u[1] - b[1]) * k, b[2] + (u[2] - b[2]) * k, b[3] + (u[3] - b[3]) * k];
  }
  return b;
};

/**
 * الكاميرا لا تقص عنصرًا ظهر (قرار مراجعة G5): كل ما ظهر يبقى داخل الإطار بهامش، وأسفله فوق شريط الترجمة.
 * فتقترب الكاميرا حين تكون الصفحة قليلة العناصر، وتبتعد كلما امتلأت. وبلا عناصر بعدُ: المنطقة الآمنة.
 */
const fitFrame = (c: { x: number; y: number; z: number }, box: [number, number, number, number] | null) => {
  if (!box) return safeFrame(c);
  const m = 70;
  const [x0, y0, x1, y1] = [box[0] - m, box[1] - m, box[2] + m, box[3] + m];
  const capBottom = SAFE.captionTop - H / 2; // المسافة من مركز الشاشة إلى أعلى الترجمة
  // التقريب الأقصى: العرض كله داخل الإطار، والارتفاع من الحافة العليا إلى ما فوق الترجمة
  const zFit = Math.min(W / Math.max(1, x1 - x0), (H / 2 + capBottom) / Math.max(1, y1 - y0));
  const z = Math.max(c.z < 1 ? c.z : 1, Math.min(c.z, zFit, 1.4));
  const hw = W / (2 * z), hh = H / (2 * z);
  const x = x1 - x0 <= 2 * hw ? Math.min(x0 + hw, Math.max(x1 - hw, c.x)) : (x0 + x1) / 2;
  const yLo = y1 - capBottom / z; // أسفل الصندوق فوق الترجمة
  const yHi = y0 + hh; // أعلاه داخل الإطار
  const y = yLo <= yHi ? Math.min(yHi, Math.max(yLo, c.y)) : (yLo + yHi) / 2;
  // لا تخرج الكاميرا عن الورقة
  const cx = Math.min(W - hw, Math.max(hw, x));
  const cy = Math.min(H - hh, Math.max(hh, y));
  return z >= 1 ? { x: cx, y: cy, z } : { x, y, z };
};

const SACRED = /الله|لله|ربنا|ربه|ربك|سبحانه|تعالي|تعالى/;

/**
 * المشهد بالكلمات وحدها (D-5): لقطة صُممت على كلمات لم تعد في النص لا يُرسم منها شيء (القاعدة الثالثة)، بل جملة
 * الراوي الحالية على الورقة بخط القناة، تظهر كاملة عند بدء نطقها (بلا قلم: لا كتابة لحظة ذكر الله).
 * التنبيه للمالك في فحص الخطة (src/plan/shotWords.ts).
 */
const InkWordsOnly: React.FC<{ timings: { word: string; start: number; end: number }[]; frame: number; dur: number; z: Z }> = ({ timings, frame, dur, z }) => {
  const sentences: { words: string[]; start: number }[] = [];
  let cur: { words: string[]; start: number } | null = null;
  for (const t of timings) {
    if (!cur) { cur = { words: [], start: t.start }; sentences.push(cur); }
    cur.words.push(t.word);
    if (/[.؟?!؛:]$/.test(t.word)) cur = null;
  }
  const k = Math.max(0, sentences.reduce((n, s, i) => (s.start <= frame + 4 ? i : n), 0));
  const s = sentences[k];
  if (!s) return null;
  const size = 76, maxW = 1380;
  const lines: string[] = [];
  for (const w of s.words) {
    const last = lines[lines.length - 1];
    if (last !== undefined && measure(`${last} ${w}`, size, fam("hand")) <= maxW) lines[lines.length - 1] = `${last} ${w}`;
    else lines.push(w);
  }
  const o = prog(frame, s.start - 6, s.start + 6) * (1 - prog(frame, dur - 14, dur - 2));
  const y0 = 470 - ((lines.length - 1) * size * 1.5) / 2;
  return (
    <g opacity={o}>
      {lines.map((l, i) => (
        <text key={`${k}-${i}`} x={W / 2} y={y0 + i * size * 1.5} direction="rtl" textAnchor="middle" fontFamily={fam("hand")} fontSize={size} fill={z.ink}>{l}</text>
      ))}
    </g>
  );
};

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
  const regs: Reg[] = [];
  const reg = (r: [number, number, number, number], t: number) => regs.push({ r, t });
  // اللقطة على نص سابق؟ (D-5) كلمة توقيت لم تعد في النص: المشهد بالكلمات وحدها. كتابة لا تُنطق: لا تُكتب.
  const allow = allowFromName(useChannel().name);
  // الحكم من نص المشهد نفسه (لا من محاذاة الصوت التي قد تقسم الكلمات بغير طريقته)، فيطابق فحص الخطة تمامًا
  const issue = React.useMemo(() => {
    if (!def || (props.shot ?? "").startsWith("kit-") || !narration.trim()) return { missing: [] as string[], unspoken: [] as string[], textTimings: [] as ReturnType<typeof estimateTimings> };
    const textTimings = estimateTimings(narration, 6, dur - 12);
    return { ...inkShotWordIssue(def, { narration, props: { labels: props.labels, cues: props.cues, task: props.task } }, textTimings, dur, allow), textTimings };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.shot, narration, dur]);
  const wordsOnly = issue.missing.length > 0;
  const isSpoken = React.useMemo(() => (issue.unspoken.length ? (text: string) => text.split(/\s+/).every((w) => spoken(issue.textTimings, w, allow)) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [issue]);
  const shot = def && !wordsOnly ? def.render({ frame, dur, z, at: makeAt(timings, dur), end: makeEnd(timings, dur), logo, reg, task: props.task, args: parseInkArgs(props.labels, props.cues) }) : null;
  // مواضع الأحداث تُعد عناصر أيضًا (للرسوم غير النصية): مستطيل حول كل حدث من لحظته
  for (const [t, x, y] of shot?.focus ?? []) reg([x - 170, y - 110, x + 170, y + 110], t);
  // سكون تام للكاميرا عند كل ذكر لله (ومع نوافذ المشهد الخاصة)
  const sacred: [number, number][] = timings.filter((w) => SACRED.test(normalizeArabic(w.word))).map((w) => [w.start - 8, w.end + 8]);
  const c0 = shot ? camAt(frame, withFocus(shot.cam, shot.focus ?? [], [...(shot.still ?? []), ...sacred], shot.camLen ?? 22), shot.camLen ?? 22) : { x: W / 2, y: H / 2, z: 1 };
  // منطقة آمنة (قرار مراجعة G5): هامش 10% من كل جانب يبقى مرئيًا دائمًا، وأسفلها فوق شريط الترجمة.
  // فلا يُقص عنصر وُضع داخلها مهما تحركت الكاميرا، ولا يختفي سطر خلف الترجمة.
  const c = fitFrame(c0, contentBox(regs, frame));
  const vb = portrait ? `${W / 2 - 304} 0 608 1080` : `0 0 ${W} ${H}`;
  return (
    <SceneShell {...props} eyebrow={undefined} motif={false} background={z.paper} durationInFrames={dur}>
      <AbsoluteFill>
        <svg viewBox={vb} preserveAspectRatio="xMidYMid slice" width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          <g transform={camTransform(c)}>
            <Paper z={z} />
            <InkSpokenContext.Provider value={isSpoken}>{shot?.world}</InkSpokenContext.Provider>
            {wordsOnly ? <InkWordsOnly timings={timings} frame={frame} dur={dur} z={z} /> : null}
          </g>
          {/* صفحة جديدة لكل فكرة: الورقة السابقة تُقلب من اليسار إلى اليمين (اتجاه تقليب الكتاب العربي) */}
          {frame < 16 ? (
            <PageSheet z={z} x={interpolate(frame, [0, 15], [0, W * 1.08], { extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) })} />
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
