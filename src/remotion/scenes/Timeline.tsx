import React from "react";
import { Easing, interpolate, useVideoConfig } from "remotion";
import { useMotionSettings, useSize, useTheme } from "../../../brand/identity/index";
import { fontFamilies } from "../../../brand/fonts";
import { Element } from "../../../brand/elements/Element";
import { hasElement } from "../../../brand/elements/registry";
import { SceneShell } from "./SceneShell";
import { useLang } from "../../i18n/context";
import { enter, fade, float, useBoil, useSceneFrame } from "./motion";
import type { SceneBase, StringFields } from "./types";

export type TimelineProps = SceneBase & StringFields<"title" | "events" | "element">;

type Event = { date: string; text: string };

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

  // توقيت رسم الخط: خطي حتى يصل القلم إلى كل حدث في موعد معروف.
  const lineFrom = 16;
  const perEvent = Math.max(16, Math.min(24, Math.round(96 / n)));
  const lineLen = perEvent * n + 8;
  const p = interpolate(frame, [lineFrom, lineFrom + lineLen], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.3, 0, 0.7, 1) });
  // يقابل p لكل حدث (معكوس منحنى التسهيل تقريبًا بالبحث).
  const reachFrame = (frac: number) => {
    for (let f = lineFrom; f <= lineFrom + lineLen; f++) {
      const v = interpolate(f, [lineFrom, lineFrom + lineLen], [0, 1], { easing: Easing.bezier(0.3, 0, 0.7, 1) });
      if (v >= frac) return f;
    }
    return lineFrom + lineLen;
  };

  const titleIn = enter(frame, 0, 30, 130);
  const iconIn = enter(frame, 6, 30, 150);
  const trackIn = fade(frame, 8, 14);
  const headIn = fade(frame, lineFrom + lineLen - 4, 10);

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

  if (portrait) {
    const W = 940;
    const lineX = rtl ? W - 44 : 44; // من اليسار (الخط على جانب البداية)
    const top = 30;
    const rowH = Math.min(200, Math.floor(740 / n));
    const textLines = Math.max(1, Math.min(3, Math.floor((rowH - 18 - dateSize * 1.2) / (textSize * 1.35))));
    const H = top + rowH * n;
    const y0 = top - 10;
    const y1 = H - 34;
    const tipY = y0 + (y1 - y0) * p;
    return (
      <SceneShell {...props} durationInFrames={durationInFrames}>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 44, padding: "350px 70px 600px" }}>
          {titleRow}
          <div style={{ position: "relative", width: W, height: H, flexShrink: 0 }}>
            <svg width={W} height={H + 40} style={{ position: "absolute", inset: 0, overflow: "visible", transform: ink ? boil(frame, 9, 0.15) : undefined }}>
              <line x1={lineX} x2={lineX} y1={y0} y2={y1} stroke={c.inkSoft} strokeOpacity={0.3 * trackIn} strokeWidth={3} strokeDasharray="2 14" strokeLinecap="round" />
              <line x1={lineX} x2={lineX} y1={y0} y2={tipY} stroke={lineColor} strokeWidth={sw} strokeLinecap="round" />
              <path d={`M${lineX - 16} ${y1 + 6} L${lineX} ${y1 + 26} L${lineX + 16} ${y1 + 6}`} fill="none" stroke={lineColor} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" opacity={headIn} />
              {p > 0 && p < 1 ? <circle cx={lineX} cy={tipY} r={10} fill={c.primary} /> : null}
            </svg>
            {list.map((e, i) => {
              const frac = n === 1 ? 0.15 : (i * rowH + 37) / (y1 - y0);
              const at = reachFrame(Math.min(1, frac));
              const a = enter(frame, at, 30, 200);
              const ring = frame >= at ? fade(frame, at, 20) : 0;
              const dIn = enter(frame, at + 2, 30, 150);
              const tIn = fade(frame, at + 7, 14);
              const rowTop = top + i * rowH;
              return (
                <React.Fragment key={i}>
                  <div style={{ position: "absolute", top: rowTop + 8, left: lineX - 19 }}>
                    {dot(a, ring, i)}
                  </div>
                  <div style={{ position: "absolute", top: rowTop - 8, ...(rtl ? { right: W - lineX + 46, left: 0 } : { left: lineX + 46, right: 0 }), height: rowH, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                    {e.date ? (
                      <div
                        style={{
                          fontFamily: fontFamilies.heading,
                          fontWeight: 700,
                          fontSize: dateSize,
                          lineHeight: 1.2,
                          color: c.primary,
                          opacity: dIn,
                          transform: `translateX(${(1 - dIn) * 30 * s}px)`,
                        }}
                      >
                        {e.date}
                      </div>
                    ) : null}
                    <div
                      style={{
                        fontSize: textSize,
                        fontWeight: 600,
                        lineHeight: 1.35,
                        color: c.ink,
                        opacity: tIn,
                        transform: `translateY(${(1 - tIn) * 10}px)`,
                        display: "-webkit-box",
                        WebkitBoxOrient: "vertical",
                        WebkitLineClamp: e.date ? textLines : textLines + 1,
                        overflow: "hidden",
                      }}
                    >
                      {e.text}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </SceneShell>
    );
  }

  // أفقي: الخط من اليمين إلى اليسار، التواريخ فوقه والأحداث تحته.
  const W = 1640;
  const colW = W / n;
  const lineY = 128;
  const H = lineY + 300;
  const x0 = rtl ? W : 0; // البداية: يمينًا في العربية، يسارًا في LTR
  const x1 = rtl ? 0 : W;
  const tipX = x0 - (x0 - x1) * p;

  return (
    <SceneShell {...props} durationInFrames={durationInFrames}>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 70, padding: "130px 140px 200px" }}>
        {titleRow}
        <div style={{ position: "relative", width: W, height: H, flexShrink: 0 }}>
          <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible", transform: ink ? boil(frame, 9, 0.06) : undefined }}>
            <line x1={x0} x2={x1} y1={lineY} y2={lineY} stroke={c.inkSoft} strokeOpacity={0.3 * trackIn} strokeWidth={3} strokeDasharray="2 14" strokeLinecap="round" />
            <line x1={x0} x2={tipX} y1={lineY} y2={lineY} stroke={lineColor} strokeWidth={sw} strokeLinecap="round" />
            <path d={`M${x1 + 6 * s} ${lineY - 16} L${x1 - 14 * s} ${lineY} L${x1 + 6 * s} ${lineY + 16}`} fill="none" stroke={lineColor} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" opacity={headIn} />
            {p > 0 && p < 1 ? <circle cx={tipX} cy={lineY} r={10} fill={c.primary} /> : null}
          </svg>
          {list.map((e, i) => {
            const cx = rtl ? W - (i + 0.5) * colW : (i + 0.5) * colW;
            const at = reachFrame((i + 0.5) / n);
            const a = enter(frame, at, 30, 200);
            const ring = frame >= at ? fade(frame, at, 20) : 0;
            const dIn = enter(frame, at + 2, 30, 150);
            const tIn = fade(frame, at + 7, 14);
            return (
              <React.Fragment key={i}>
                <div style={{ position: "absolute", left: cx - 20, top: lineY - 20 }}>
                  {dot(a, ring, i)}
                </div>
                {/* وصلة قصيرة بين النقطة والتاريخ */}
                <div style={{ position: "absolute", left: cx - 1.5, top: lineY - 44, width: 3, height: 18, background: c.inkSoft, opacity: 0.45 * dIn }} />
                <div
                  style={{
                    position: "absolute",
                    left: cx - colW / 2 + 12,
                    width: colW - 24,
                    bottom: H - lineY + 50,
                    textAlign: "center",
                    fontFamily: fontFamilies.heading,
                    fontWeight: 700,
                    fontSize: dateSize,
                    lineHeight: 1.15,
                    color: c.primary,
                    opacity: dIn,
                    transform: `translateY(${(1 - dIn) * 24}px)`,
                    textWrap: "balance",
                  }}
                >
                  {e.date}
                </div>
                <div
                  style={{
                    position: "absolute",
                    left: cx - colW / 2 + 14,
                    width: colW - 28,
                    top: lineY + 52,
                    opacity: tIn,
                    transform: `translateY(${(1 - tIn) * -14}px) ${ink ? boil(frame, 40 + i, 0.25) : ""}`,
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      width: "100%",
                      boxSizing: "border-box",
                      background: c.surface,
                      border: ink ? `3px solid ${c.ink}` : "none",
                      boxShadow: ink ? `6px 6px 0 ${c.secondary}` : `0 14px 34px rgba(0,0,0,${themeId === "night" ? 0.3 : 0.07})`,
                      borderRadius: 22,
                      padding: "20px 24px",
                      textAlign: "center",
                      fontSize: textSize,
                      fontWeight: 600,
                      lineHeight: 1.4,
                      color: c.ink,
                      textWrap: "balance",
                    }}
                  >
                    <svg width={34} height={18} viewBox="0 0 34 18" style={{ position: "absolute", top: ink ? -17 : -14, left: "50%", marginLeft: -17 }}>
                      <path d="M2 18 L17 2 L32 18" fill={c.surface} stroke={ink ? c.ink : "none"} strokeWidth={3} strokeLinejoin="round" />
                      <rect x={0} y={ink ? 16 : 14} width={34} height={6} fill={c.surface} />
                    </svg>
                    <div style={{ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 3, overflow: "hidden" }}>{e.text}</div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </SceneShell>
  );
};

/** محتوى تجريبي لمعاينة القالب. */
export const timelineSample: Omit<TimelineProps, "themeId" | "orientation"> = {
  eyebrow: "الفصل 4 · بعين الإسلام",
  title: "كيف يكبر التأجيل",
  events: "اليوم الأول | أؤجل خمس دقائق فقط\nالأسبوع الأول | تتراكم المهام الصغيرة\nالشهر الأول | يصبح التأجيل عادة\nبعد سنة | تضيع فرص كبيرة",
  element: "hourglass-patience",
  narration: "يبدأ التأجيل صغيرًا، ثم يكبر يومًا بعد يوم حتى يصبح عادة.",
};
export const timelineSeconds = 9;

/** English preview sample (LTR). */
export const timelineSampleEn: Omit<TimelineProps, "themeId" | "orientation"> = {
  eyebrow: "Chapter 4 · Through the lens of Islam",
  title: "How procrastination grows",
  events: "Day one | Just five more minutes\nWeek one | Small tasks pile up\nMonth one | Delay becomes a habit\nOne year later | Big chances slip away",
  element: "hourglass-patience",
  narration: "Procrastination starts small, then grows day by day until it becomes a habit.",
};
