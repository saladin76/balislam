import React from "react";
import { Easing, interpolate, useVideoConfig } from "remotion";
import { useMotionSettings, useSize, useTheme } from "../../../brand/identity/index";
import { fontFamilies } from "../../../brand/fonts";
import { Element } from "../../../brand/elements/Element";
import { hasElement } from "../../../brand/elements/registry";
import { SceneShell } from "./SceneShell";
import { useLang } from "../../i18n/context";
import { clamp, enter, fade, float, useBoil, useSceneFrame } from "./motion";
import { estimateTimings, type WordTiming } from "./timing";
import type { SceneBase, StringFields } from "./types";

export type TimelineProps = SceneBase & StringFields<"title" | "events" | "element">;

type Event = { date: string; text: string };

/** السنوات بخط IBM Plex Mono (بصمة «دفتر الأفق»)، والحروف العربية في التاريخ («م»، «هـ») بخط العناوين */
const YEAR_FONT = `'IBM Plex Mono', ${fontFamilies.heading}`;

/** «التاريخ | الحدث» في كل سطر (حتى 5). السطر بلا فاصل يصير حدثًا بلا تاريخ. */
const parseEvents = (events: string): Event[] =>
  events
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const idx = l.search(/[|｜]/);
      return idx >= 0 ? { date: l.slice(0, idx).trim(), text: l.slice(idx + 1).trim() } : { date: "", text: l };
    })
    .slice(0, 5);

/** جذع الكلمة للمطابقة: بلا تشكيل ولا علامات ولا «ال» والواو والفاء في أولها، وبتوحيد الهمزات والتاء المربوطة */
const stem = (w: string) =>
  w
    .replace(/[ً-ْٰـ؟?!.,،:؛«»"()]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة$/, "ه")
    .replace(/ى$/, "ي")
    .replace(/^(وال|فال|بال|لل|ال|و|ف)(?=..)/, "");

/**
 * لحظة نطق كل حدث: أول كلمة من نص الحدث (أو تاريخه) تُنطق بعد الحدث السابق.
 * بذلك تظهر النقطة والبطاقة مع الكلمة نفسها (قاعدة القناة: العنصر يظهر وقت نطقه).
 * ما لا يُعثر عليه في الكلام يأخذ موضعًا متساويًا بين جاريه.
 */
export const eventArrivals = (list: { date: string; text: string }[], timings: WordTiming[], from: number, to: number): number[] => {
  const found: (number | undefined)[] = [];
  let cursor = 0;
  for (const e of list) {
    const keys = `${e.text} ${e.date}`.split(/\s+/).map(stem).filter((k) => k.length >= 3 || /\d{3,}/.test(k));
    let hit: number | undefined;
    for (let wi = cursor; wi < timings.length; wi++) {
      const w = stem(timings[wi]!.word);
      if (w.length >= 3 && keys.some((k) => k === w || (k.length >= 4 && w.length >= 4 && (k.startsWith(w) || w.startsWith(k))))) {
        hit = timings[wi]!.start;
        cursor = wi + 1;
        break;
      }
    }
    found.push(hit);
  }
  // سدّ الفراغات بالتوزيع المتساوي، مع ضمان الترتيب وفاصل ثلث ثانية على الأقل
  const n = list.length;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    if (found[i] !== undefined) {
      out.push(found[i]!);
      continue;
    }
    const prevI = [...Array(i).keys()].reverse().find((k) => found[k] !== undefined);
    const nextI = found.findIndex((v, k) => k > i && v !== undefined);
    const a = prevI !== undefined ? found[prevI]! : from;
    const b = nextI >= 0 ? found[nextI]! : to;
    const ia = prevI !== undefined ? prevI : -1;
    const ib = nextI >= 0 ? nextI : n;
    out.push(Math.round(a + ((b - a) * (i - ia)) / (ib - ia)));
  }
  for (let i = 1; i < n; i++) out[i] = Math.max(out[i]!, out[i - 1]! + 10);
  return out.map((v) => Math.max(from, Math.min(to, v)));
};

/**
 * «الخط الزمني»: خط يُرسم تدريجيًا (أفقيًا من جانب البداية: يمين→يسار في العربية ويسار→يمين في LTR،
 * ومن الأعلى إلى الأسفل عموديًا مع الخط على جانب البداية)،
 * وكلما بلغ رأسُ القلم موضع حدث ظهرت نقطته بموجة صغيرة، ثم تاريخه البارز، ثم نصّه.
 */
export const Timeline: React.FC<TimelineProps> = (props) => {
  const { themeId, orientation, title, events = "", element } = props;
  const frame = useSceneFrame();
  const boil = useBoil();
  const motion = useMotionSettings();
  const questionSize = useSize("question", orientation);
  const bubbleSize = useSize("bubble", orientation);
  const { durationInFrames } = useVideoConfig();
  const t = useTheme(themeId);
  const c = t.colors;
  const portrait = orientation === "portrait";
  const ink = t.character.style === "line";
  // اتجاه القراءة: الخط يُرسم من جانب البداية (يمين في العربية، يسار في التركية/الإنجليزية).
  const rtl = useLang().dir === "rtl";
  const s = rtl ? 1 : -1;

  const list = parseEvents(events);
  const n = Math.max(1, list.length);
  const icon = element && hasElement(element) ? element : undefined;

  const titleSize = Math.round(questionSize * (portrait ? 0.62 : 0.56));
  const dateSize = Math.round(bubbleSize * (n >= 5 ? 0.8 : portrait ? 0.92 : 0.95));
  const textSize = Math.round(bubbleSize * (n >= 5 ? (portrait ? 0.6 : 0.6) : portrait ? 0.68 : 0.68));

  // توقيت الأحداث من الكلام نفسه: كل حدث يصل وقت نطق كلماته (أو بالتقدير قبل توليد الصوت)
  const timings: WordTiming[] = props.narration ? (props.narrationTimings ?? estimateTimings(props.narration, 6, durationInFrames - 12)) : [];
  const lineFrom = 12;
  const lastAt = Math.max(lineFrom + 20, durationInFrames - 30);
  const arrivals = list.length ? eventArrivals(list, timings, lineFrom + 8, lastAt) : [];
  const reachFrame = (i: number) => arrivals[i] ?? lineFrom;
  const lineLen = Math.max(20, durationInFrames - 16 - lineFrom);

  // الحدث الحالي (للتمييز): آخر حدث نُطق
  const current = arrivals.reduce((acc, a, i) => (frame >= a ? i : acc), -1);

  const uid = React.useId().replace(/:/g, "");
  const titleIn = enter(frame, 0, 30, 130);
  const iconIn = enter(frame, 6, 30, 150);
  const trackIn = fade(frame, 8, 14);
  const headIn = fade(frame, lineFrom + lineLen - 4, 10);
  // تمييز الحدث الحالي: يقوى عند نطقه ويخفت حين يأتي التالي
  const focusOf = (i: number) => (i === current ? fade(frame, reachFrame(i), 10) : i < current ? 1 - fade(frame, reachFrame(current), 12) : 0);

  const lineColor = ink ? c.ink : c.primary;
  const sw = portrait ? 7 : 7;

  const dot = (a: number, ring: number, i: number) => {
    const d = portrait ? 38 : 40;
    return (
      <div style={{ position: "relative", width: d, height: d }}>
        <div
          style={{
            position: "absolute",
            inset: -d * 0.9 * ring,
            borderRadius: "50%",
            border: `3px solid ${c.primary}`,
            opacity: (1 - ring) * 0.7 * (ring > 0 ? 1 : 0),
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: ink ? c.secondary : c.primary,
            border: ink ? `4px solid ${c.ink}` : `6px solid ${c.surface}`,
            boxShadow: ink ? "none" : `0 0 0 3px ${c.primary}`,
            boxSizing: "border-box",
            transform: `scale(${a}) ${ink ? boil(frame, 30 + i, 2) : ""}`,
          }}
        />
      </div>
    );
  };

  const titleRow = title || icon ? (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: portrait ? 24 : 32, maxWidth: portrait ? 940 : 1500 }}>
      {icon ? (
        <div style={{ flexShrink: 0, opacity: iconIn, transform: `translateY(${float(frame, 5 * motion.float, 84) + (1 - iconIn) * 20}px) scale(${0.6 + 0.4 * iconIn}) ${ink ? boil(frame, 3) : ""}` }}>
          <Element id={icon} theme={t} size={portrait ? 130 : 120} />
        </div>
      ) : null}
      {title ? (
        <div
          style={{
            fontFamily: fontFamilies.heading,
            fontWeight: 700,
            fontSize: titleSize,
            lineHeight: 1.3,
            textWrap: "balance",
            textAlign: icon ? "start" : "center",
            opacity: titleIn,
            transform: `translateY(${(1 - titleIn) * 22}px)`,
          }}
        >
          {title}
        </div>
      ) : null}
    </div>
  ) : null;

  // المسافة بين الأحداث على الخط (أفقيًا في 16:9، رأسيًا في 9:16)
  const col = portrait ? 520 : 700;
  /**
   * القلم يمشي بسرعة ثابتة على الأقل (الزمن يمضي)، وكل حدث يوضع على الخط حيث يكون القلم لحظة نطقه،
   * بمسافة لا تقل عن عرض بطاقة بين حدثين (فإن تقاربا في الكلام أسرع القلم بينهما).
   */
  const SPEED = (portrait ? 140 : 190) / 30; // بكسل لكل إطار (أبطأ في العمودي لأن نافذته أقصر)
  const t0 = lineFrom;
  const us: number[] = [];
  arrivals.forEach((a, i) => {
    const prevU = i ? us[i - 1]! : 0;
    const prevA = i ? arrivals[i - 1]! : t0;
    us.push(Math.max(i ? prevU + col : 0, prevU + SPEED * (a - prevA)));
  });
  const uOf = (i: number) => us[i] ?? 0;
  const endFrame = Math.max(t0 + 2, durationInFrames - 4);
  const lastU = us.length ? us[us.length - 1]! : 0;
  const lastA = arrivals.length ? arrivals[arrivals.length - 1]! : t0;
  const penKeys: [number, number][] = [[t0, 0], ...arrivals.map((a, i): [number, number] => [a, uOf(i)]), [endFrame, lastU + SPEED * (endFrame - lastA)]];
  for (let i = 1; i < penKeys.length; i++) if (penKeys[i]![0] <= penKeys[i - 1]![0]) penKeys[i]![0] = penKeys[i - 1]![0] + 1;
  const pen = interpolate(frame, penKeys.map((k) => k[0]), penKeys.map((k) => k[1]), clamp);
  const total = penKeys[penKeys.length - 1]![1];
  const cam = pen + col * 0.12;

  if (portrait) {
    /** عمودي: الخط على جانب البداية ينزل مع القلم، والكاميرا تتبعه، وسطور الدفتر تمر خلفه */
    const VH = 1920;
    const uidP = uid;
    const lineX = rtl ? 1080 - 120 : 120;
    // القلم في أسفل النافذة، فيبقى آخر حدث نُطق ظاهرًا فوقه أطول وقت
    const Y = (u: number) => 1060 + (u - pen);
    const penY = Y(pen);
    const startY = Y(-VH);
    const endY = Y(total + col * 0.6);
    const textW = 1080 - 120 - 170;
    return (
      <SceneShell {...props} durationInFrames={durationInFrames}>
        {/* نافذة الخط بين العنوان والترجمة: ما يمضي يخفت للأعلى، والقادم يظهر من الأسفل */}
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", WebkitMaskImage: "linear-gradient(to bottom, transparent 440px, #000 560px, #000 1160px, transparent 1240px)", maskImage: "linear-gradient(to bottom, transparent 440px, #000 560px, #000 1160px, transparent 1240px)" }}>
          <svg width={1080} height={VH} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
            <defs>
              <linearGradient id={`tlp-rule-${uidP}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={c.ink} stopOpacity={0} />
                <stop offset="0.5" stopColor={c.ink} stopOpacity={0.2} />
                <stop offset="1" stopColor={c.ink} stopOpacity={0} />
              </linearGradient>
            </defs>
            {/* سطور الدفتر وثنيته تمر مع الكاميرا */}
            {Array.from({ length: Math.ceil((total + 2 * VH) / 960) + 2 }, (_, k) => {
              const gy = Y(-VH + k * 960);
              if (gy < -60 || gy > VH + 60) return null;
              return <rect key={`g${k}`} x={0} y={gy - 36} width={1080} height={72} fill={`url(#tlp-rule-${uidP})`} />;
            })}
            {Array.from({ length: Math.ceil((total + 2 * VH) / 80) + 2 }, (_, k) => {
              const ty = Y(-VH + k * 80);
              if (ty < -20 || ty > VH + 20) return null;
              const big = k % 4 === 0;
              return <rect key={`t${k}`} x={rtl ? lineX + 12 : lineX - 12 - (big ? 40 : 20)} y={ty - 3} width={big ? 40 : 20} height={6} rx={3} fill={lineColor} opacity={(big ? 0.9 : 0.6) * trackIn} />;
            })}
            <line x1={lineX} x2={lineX} y1={startY} y2={endY} stroke={c.inkSoft} strokeOpacity={0.3 * trackIn} strokeWidth={3} strokeDasharray="2 14" strokeLinecap="round" />
            <line x1={lineX} x2={lineX} y1={startY} y2={penY} stroke={lineColor} strokeWidth={sw} strokeLinecap="round" />
            <path d={`M${lineX - 16} ${endY - 6} L${lineX} ${endY + 14} L${lineX + 16} ${endY - 6}`} fill="none" stroke={lineColor} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" opacity={headIn} />
            <circle cx={lineX} cy={penY} r={12} fill={c.primary} opacity={frame < durationInFrames - 12 ? 1 : 0} />
            <circle cx={lineX} cy={penY} r={22 + 6 * Math.sin(frame / 6)} fill="none" stroke={c.primary} strokeOpacity={0.35} strokeWidth={3} />
          </svg>
          {list.map((e, i) => {
            const cy = Y(uOf(i));
            const at = reachFrame(i);
            const focus = focusOf(i);
            const a = enter(frame, at, 30, 200);
            const ring = frame >= at ? fade(frame, at, 20) : 0;
            const dIn = enter(frame, at + 2, 30, 150);
            const tIn = fade(frame, at + 6, 12);
            if (cy < -400 || cy > VH + 400) return null;
            return (
              <React.Fragment key={i}>
                <div style={{ position: "absolute", top: cy - 20, left: lineX - 20 }}>{dot(a, ring, i)}</div>
                <div style={{ position: "absolute", top: cy - 30, ...(rtl ? { right: 1080 - lineX + 50 } : { left: lineX + 50 }), width: textW, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, transform: `translateX(${(1 - dIn) * 30 * s}px) translateX(${-8 * focus * s}px)` }}>
                  <div style={{ fontFamily: e.date ? YEAR_FONT : fontFamilies.heading, fontWeight: e.date ? 500 : 700, fontSize: Math.round(dateSize * (e.date ? 1.2 : 1.1)), lineHeight: 1.15, color: e.date ? c.primary : c.ink, opacity: dIn }}>{e.date || e.text}</div>
                  {e.date ? (
                    <div style={{ fontSize: Math.round(textSize * 1.1), fontWeight: 600, lineHeight: 1.35, color: c.ink, opacity: tIn, background: c.surface, border: `3px solid ${focus > 0.01 ? c.highlight : "rgba(0,0,0,0)"}`, borderRadius: 20, padding: "14px 20px" }}>{e.text}</div>
                  ) : null}
                </div>
              </React.Fragment>
            );
          })}
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 300, display: "flex", justifyContent: "center", padding: "0 70px" }}>{titleRow}</div>
      </SceneShell>
    );
  }

  /**
   * أفقي: «القلم يكتب الزمن والكاميرا تتبعه». الخط طويل، لكل حدث مسافة ثابتة عليه،
   * والقلم يتقدم باستمرار طوال المشهد فيبلغ كل حدث وقت نطقه، والكاميرا تتبع رأس القلم:
   * ما نُطق يمضي إلى جانب البداية، والقادم يظهر من جانب النهاية.
   */
  const VW = 1920;
  const lineY = 600; // ارتفاع الخط في الإطار
  // من موضع على الخط إلى x في الإطار (البداية يمينًا في العربية)
  const X = (u: number) => VW / 2 + (rtl ? -1 : 1) * (u - cam);
  const penX = X(pen);
  const startX = X(-VW);
  const endX = X(total + col * 0.6);
  const cardW = col - 120;

  return (
    <SceneShell {...props} durationInFrames={durationInFrames}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 120, display: "flex", justifyContent: "center", padding: "0 140px" }}>{titleRow}</div>
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <svg width={VW} height={1080} style={{ position: "absolute", inset: 0, overflow: "visible", transform: ink ? boil(frame, 9, 0.06) : undefined }}>
          <defs>
            <linearGradient id={`tl-fold-${uid}`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor={c.ink} stopOpacity={0} />
              <stop offset="0.5" stopColor={c.ink} stopOpacity={0.2} />
              <stop offset="1" stopColor={c.ink} stopOpacity={0} />
            </linearGradient>
          </defs>
          {/* صفحات الدفتر: ثنية بين كل صفحتين تمر مع الكاميرا (بصمة «دفتر الأفق») */}
          {Array.from({ length: Math.ceil((total + 2 * VW) / 1280) + 2 }, (_, k) => {
            const gx = X(-VW + k * 1280);
            if (gx < -60 || gx > VW + 60) return null;
            return (
              <g key={`g${k}`}>
                <rect x={gx - 36} y={0} width={72} height={1080} fill={`url(#tl-fold-${uid})`} />
                <rect x={gx - 1} y={0} width={2} height={1080} fill={c.ink} opacity={0.35} />
              </g>
            );
          })}
          {/* مسطرة الزمن: علامة كل 80 بكسل، وأطول كل 320 */}
          {Array.from({ length: Math.ceil((total + 2 * VW) / 80) + 2 }, (_, k) => {
            const tx = X(-VW + k * 80);
            if (tx < -20 || tx > VW + 20) return null;
            const big = k % 4 === 0;
            return <rect key={`t${k}`} x={tx - 3} y={lineY + 10} width={6} height={big ? 40 : 20} rx={3} fill={lineColor} opacity={(big ? 0.9 : 0.6) * trackIn} />;
          })}
          {/* المسار القادم منقّطًا، والمكتوب بلون القناة حتى رأس القلم */}
          <line x1={startX} x2={endX} y1={lineY} y2={lineY} stroke={c.inkSoft} strokeOpacity={0.3 * trackIn} strokeWidth={3} strokeDasharray="2 14" strokeLinecap="round" />
          <line x1={startX} x2={penX} y1={lineY} y2={lineY} stroke={lineColor} strokeWidth={sw} strokeLinecap="round" />
          <path d={`M${endX + 6 * s} ${lineY - 16} L${endX - 14 * s} ${lineY} L${endX + 6 * s} ${lineY + 16}`} fill="none" stroke={lineColor} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" opacity={headIn} />
          {/* رأس القلم */}
          <circle cx={penX} cy={lineY} r={12} fill={c.primary} opacity={frame < durationInFrames - 12 ? 1 : 0} />
          <circle cx={penX} cy={lineY} r={22 + 6 * Math.sin(frame / 6)} fill="none" stroke={c.primary} strokeOpacity={0.35} strokeWidth={3} />
        </svg>
        {list.map((e, i) => {
          const cx = X(uOf(i));
          const at = reachFrame(i);
          const focus = focusOf(i);
          const a = enter(frame, at, 30, 200);
          const ring = frame >= at ? fade(frame, at, 20) : 0;
          const dIn = enter(frame, at + 2, 30, 150);
          const tIn = fade(frame, at + 6, 12);
          if (cx < -cardW || cx > VW + cardW) return null;
          return (
            <React.Fragment key={i}>
              <div style={{ position: "absolute", left: cx - 20, top: lineY - 20 }}>{dot(a, ring, i)}</div>
              <div style={{ position: "absolute", left: cx - 1.5, top: lineY - 44, width: 3, height: 18, background: c.inkSoft, opacity: 0.45 * dIn }} />
              {/* فوق الخط: السنة بخط السنوات، أو الحدث نفسه بخط العناوين كبيرًا إن لم تكن له سنة */}
              {e.date || e.text ? (
                <div
                  style={{
                    position: "absolute",
                    left: cx - cardW / 2,
                    width: cardW,
                    bottom: 1080 - lineY + 52,
                    textAlign: "center",
                    fontFamily: e.date ? YEAR_FONT : fontFamilies.heading,
                    fontWeight: e.date ? 500 : 700,
                    fontSize: Math.round(dateSize * (e.date ? 1.25 : e.text.split(/\s+/).length <= 3 ? 1.35 : 0.95)),
                    textWrap: "balance",
                    lineHeight: 1.1,
                    color: e.date ? c.primary : c.ink,
                    opacity: dIn,
                    transform: `translateY(${(1 - dIn) * 30}px) scale(${1 + 0.06 * focus})`,
                  }}
                >
                  {e.date || e.text}
                </div>
              ) : null}
              {e.date ? <div style={{ position: "absolute", left: cx - cardW / 2, width: cardW, top: lineY + 74, opacity: tIn, transform: `translateY(${(1 - tIn) * -16 - 8 * focus}px) ${ink ? boil(frame, 40 + i, 0.25) : ""}` }}>
                <div
                  style={{
                    position: "relative",
                    boxSizing: "border-box",
                    background: c.surface,
                    border: ink ? `3px solid ${c.ink}` : `3px solid ${focus > 0.01 ? c.highlight : "rgba(0,0,0,0)"}`,
                    boxShadow: ink ? `6px 6px 0 ${c.secondary}` : `0 14px 34px rgba(0,0,0,${themeId === "night" ? 0.3 : 0.07})`,
                    borderRadius: 22,
                    padding: "22px 26px",
                    textAlign: "center",
                    fontSize: Math.round(textSize * 1.12),
                    fontWeight: 600,
                    lineHeight: 1.4,
                    color: c.ink,
                    textWrap: "balance",
                  }}
                >
                  <svg width={34} height={18} viewBox="0 0 34 18" style={{ position: "absolute", top: ink ? -17 : -15, left: "50%", marginLeft: -17 }}>
                    <path d="M2 18 L17 2 L32 18" fill={c.surface} stroke={ink ? c.ink : "none"} strokeWidth={3} strokeLinejoin="round" />
                  </svg>
                  <div style={{ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 3, overflow: "hidden" }}>{e.text}</div>
                </div>
              </div> : null}
            </React.Fragment>
          );
        })}
      </div>
    </SceneShell>
  );
};

/** محتوى تجريبي لمعاينة القالب. */
export const timelineSample: Omit<TimelineProps, "themeId" | "orientation"> = {
  eyebrow: "بعين الإسلام",
  title: "كيف يكبر التأجيل",
  events: "اليوم الأول | أؤجل خمس دقائق فقط\nالأسبوع الأول | تتراكم المهام الصغيرة\nالشهر الأول | يصبح التأجيل عادة\nبعد سنة | تضيع فرص كبيرة",
  element: "hourglass-patience",
  narration: "يبدأ التأجيل صغيرًا، ثم يكبر يومًا بعد يوم حتى يصبح عادة.",
};
export const timelineSeconds = 9;

/** English preview sample (LTR). */
export const timelineSampleEn: Omit<TimelineProps, "themeId" | "orientation"> = {
  eyebrow: "Through the lens of Islam",
  title: "How procrastination grows",
  events: "Day one | Just five more minutes\nWeek one | Small tasks pile up\nMonth one | Delay becomes a habit\nOne year later | Big chances slip away",
  element: "hourglass-patience",
  narration: "Procrastination starts small, then grows day by day until it becomes a habit.",
};
