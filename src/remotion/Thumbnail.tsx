import React from "react";
import { AbsoluteFill } from "remotion";
import { useTheme } from "../../brand/identity/index";
import { fontFamilies } from "../../brand/fonts";
import { Element } from "../../brand/elements/Element";
import { hasElement } from "../../brand/elements/registry";
import type { ThemeId } from "../../brand/themes";
import { useBrandFonts } from "./useBrandFonts";
import { Providers } from "./Providers";
import { ChannelLogo, ChannelName, useChannel } from "../channel/context";
import { useLang } from "../i18n/context";
import type { Identity } from "../../brand/identity/index";
import type { ChannelInfo } from "../channel/types";
import type { SeriesStamp } from "../channel/series";
import { SeriesBadge } from "./series/SeriesArt";

/** غلاف من الأغلفة الثلاثة (src/package/thumbnails.ts): الفكرة ونصها (≤ ٣ كلمات)، ولقطة المشهد صورةً (data URI). */
export type ThumbConceptProp = { kind: "title" | "scene" | "question"; text: string; frame?: string };
export type ThumbnailProps = { themeId: ThemeId; title: string; highlight?: string; element?: string; concept?: ThumbConceptProp; /** اسم الكتاب (book في رأس السكريبت): شارة التنبيه في مصغّرة زبدة الكتب */ book?: string; identity?: Identity; channel?: ChannelInfo; lang?: string;
  /** سلسلة الحلقة (plan.series): شارتها بأسلوب القناة فوق المصغّرة نفسها؛ غيابها = مصغّرة القناة كما هي */
  series?: Pick<SeriesStamp, "identity" | "name" | "number" | "kind" | "template"> };

/**
 * الصورة المصغّرة 1280×720: العنوان بخط كبير يمينًا، والعنصر الرمزي يسارًا داخل دائرة بلون التمييز،
 * والشعار صغيرًا في الزاوية. تُقرأ على الهاتف بحجم صغير، لذا لا أكثر من سطرين.
 */
export const Thumbnail: React.FC<ThumbnailProps> = ({ identity, channel, lang, ...rest }) => (
  <Providers identity={identity} channel={channel} lang={lang}>
    <ThumbnailInner {...rest} />
  </Providers>
);

const ThumbnailInner: React.FC<Omit<ThumbnailProps, "identity" | "channel" | "lang">> = ({ series, concept, ...props }) => {
  useBrandFonts();
  const style = useChannel().brand?.thumbnail ?? "circle";
  // الأغلفة الثلاثة: «عنوان» بأسلوب مصغّرة القناة نفسه وكلمته، و«سؤال» و«مشهد» بلغة القناة نفسها (ألوانها وخطها وشعارها)
  const signature = (p: Inner) => (style === "mihrab" ? <MihrabThumb {...p} /> : style === "horizon" ? <HorizonThumb {...p} /> : style === "highlighter" ? <HighlighterThumb {...p} /> : <CircleThumb {...p} />);
  const body = !concept ? signature(props)
    : concept.kind === "title" ? signature({ ...props, title: concept.text, highlight: concept.text.split(/\s+/).filter(Boolean).slice(-1).join(" ") })
    : concept.kind === "question" ? <QuestionThumb style={style} themeId={props.themeId} text={concept.text} />
    : <SceneThumb style={style} themeId={props.themeId} text={concept.text} frame={concept.frame} element={props.element} />;
  if (!series || series.template?.thumbnail?.layout === "channel" || series.identity.thumbnail.badge === "none") return body;
  return <AbsoluteFill>{body}<SeriesBadge d={series.identity} name={series.name} number={series.kind === "series" ? series.number : undefined} /></AbsoluteFill>;
};

/** يقسم العنوان إلى كلمات عادية وكلمات مميزة */
const splitTitle = (title: string, highlight?: string) => {
  const words = title.split(/\s+/).filter(Boolean);
  const hl = highlight?.split(/\s+/).filter(Boolean) ?? words.slice(-2);
  const bare = (w: string) => w.replace(/[؟?!.,،:]/g, "");
  const hlStart = words.findIndex((_, i) => hl.every((h, j) => bare(words[i + j] ?? "") === bare(h)));
  const groups: { on: boolean; words: string[] }[] = [];
  words.forEach((w, i) => {
    const on = hlStart >= 0 && i >= hlStart && i < hlStart + hl.length;
    const last = groups[groups.length - 1];
    if (last && last.on && on) last.words.push(w);
    else groups.push({ on, words: [w] });
  });
  return groups;
};

/** عامة للقنوات التي لم تُعتمد هويتها بعد: العنوان يمينًا، والعنصر داخل دائرة بلون التمييز، والشعار في الزاوية. */
const CircleThumb: React.FC<Omit<ThumbnailProps, "identity" | "channel" | "lang">> = ({ themeId, title, highlight, element }) => {
  const t = useTheme(themeId);
  const c = t.colors;
  const line = t.character.style === "line";
  const el = element && hasElement(element) ? element : "question-mark";
  const words = title.split(/\s+/).filter(Boolean);
  const hl = highlight?.split(/\s+/).filter(Boolean) ?? words.slice(-2);
  const bare = (w: string) => w.replace(/[؟?!.,،:]/g, "");
  const hlStart = words.findIndex((_, i) => hl.every((h, j) => bare(words[i + j] ?? "") === bare(h)));
  const groups: { on: boolean; words: string[] }[] = [];
  words.forEach((w, i) => {
    const on = hlStart >= 0 && i >= hlStart && i < hlStart + hl.length;
    const last = groups[groups.length - 1];
    if (last && last.on && on) last.words.push(w);
    else groups.push({ on, words: [w] });
  });
  const size = title.length > 34 ? 84 : title.length > 22 ? 96 : 112;

  return (
    <AbsoluteFill style={{ background: c.bg, direction: useLang().dir, fontFamily: fontFamilies.heading, overflow: "hidden" }}>
      <div style={{ position: "absolute", insetInlineEnd: -120, top: 70, width: 640, height: 640, borderRadius: "50%", background: c.highlight, opacity: line ? 0.55 : 0.85, border: line ? `5px solid ${c.ink}` : "none" }} />
      <div style={{ position: "absolute", insetInlineEnd: 40, top: 150, width: 440, height: 440, display: "grid", placeItems: "center" }}>
        <Element id={el} theme={t} size={400} />
      </div>
      <div style={{ position: "absolute", insetInlineStart: 64, top: 0, bottom: 0, width: 700, display: "flex", flexDirection: "column", justifyContent: "center", gap: 18 }}>
        <div style={{ fontWeight: 700, fontSize: size, lineHeight: 1.25, color: c.ink, display: "flex", flexWrap: "wrap", gap: "0 22px", textWrap: "balance" }}>
          {groups.map((g, i) =>
            g.on ? (
              <span key={i} style={{ background: c.primary, color: t.id === "night" ? c.bg : c.surface, borderRadius: 16, padding: "0 18px", display: "inline-flex", gap: 22 }}>
                {g.words.join(" ")}
              </span>
            ) : (
              <React.Fragment key={i}>{g.words.map((w, j) => <span key={j}>{w}</span>)}</React.Fragment>
            ),
          )}
        </div>
      </div>
      <div style={{ position: "absolute", top: 34, insetInlineStart: 40, display: "flex", alignItems: "center", gap: 12 }}>
        <ChannelLogo theme={t} size={64} />
        <span style={{ fontFamily: fontFamilies.wordmark, fontWeight: 700, fontSize: 34, color: c.ink }}><ChannelName /></span>
      </div>
    </AbsoluteFill>
  );
};

// ———————— أساليب الهويات المعتمدة (٣ نوفمبر ٢٠٢٦) ————————

const titleSize = (title: string, big: number) => (title.length > 34 ? big * 0.74 : title.length > 22 ? big * 0.86 : big);
type Inner = Omit<ThumbnailProps, "identity" | "channel" | "lang">;

/** بالإسلام «محراب النور»: ليل زمردي، محراب نحاسي يضيء بالفجر وفيه العنصر، عنوان بالرقعة وكلمته بلون الفجر. */
const MihrabThumb: React.FC<Inner> = ({ title, highlight, element }) => {
  const t = useTheme("night");
  const el = element && hasElement(element) ? element : "question-mark";
  const groups = splitTitle(title, highlight);
  const size = titleSize(title, 112);
  return (
    <AbsoluteFill style={{ background: "#0B1F1C", direction: useLang().dir, overflow: "hidden" }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 22% 60%, rgba(242,179,91,0.28) 0%, rgba(242,179,91,0) 45%), radial-gradient(ellipse at 70% 40%, #14382F 0%, #0B1F1C 70%)" }} />
      <svg width={1280} height={720} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="th-dawn" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#F2B35B" stopOpacity={0.8} /><stop offset="0.8" stopColor="#F2B35B" stopOpacity={0.06} /></linearGradient>
        </defs>
        <g transform="translate(110 70)">
          <path d="M0 650 V250 A190 190 0 0 1 380 250 V650 Z" fill="url(#th-dawn)" />
          <path d="M0 650 V250 A190 190 0 0 1 380 250 V650" fill="none" stroke="#C9A24A" strokeWidth={10} />
          <path d="M190 76 L222 108 L190 140 L158 108 Z M167 85 H213 V131 H167 Z" fill="none" stroke="#C9A24A" strokeWidth={5} />
        </g>
      </svg>
      <div style={{ position: "absolute", left: 140, top: 240, width: 320, height: 320, display: "grid", placeItems: "center" }}>
        <Element id={el} theme={t} size={300} />
      </div>
      <div style={{ position: "absolute", insetInlineStart: 60, top: 0, bottom: 0, width: 690, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ fontFamily: fontFamilies.ruqaa, fontWeight: 700, fontSize: size, lineHeight: 1.35, color: "#F4EEE2", display: "flex", flexWrap: "wrap", gap: "0 22px", textShadow: "0 6px 28px rgba(0,0,0,0.6)" }}>
          {groups.map((g, i) => (g.on ? <span key={i} style={{ color: "#F2B35B" }}>{g.words.join(" ")}</span> : <React.Fragment key={i}>{g.words.map((w, j) => <span key={j}>{w}</span>)}</React.Fragment>))}
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 30, insetInlineStart: 50, display: "flex", alignItems: "center", gap: 12 }}>
        <ChannelLogo theme={t} size={58} tile={false} />
        <span style={{ fontFamily: fontFamilies.ruqaa, fontWeight: 700, fontSize: 34, color: "#F4EEE2" }}><ChannelName /></span>
        <span style={{ width: 16, height: 16, borderRadius: 3, background: "#C2412D" }} />
      </div>
      <AbsoluteFill style={{ boxShadow: "inset 0 0 160px 30px #0B1F1C" }} />
    </AbsoluteFill>
  );
};

/** دفاتر الزمن «دفتر الأفق»: سماء غروب فوق خط الأفق وخريطة عتيقة تحته، والعنوان بالأميري. */
const HorizonThumb: React.FC<Inner> = ({ title, highlight, element }) => {
  const t = useTheme("night");
  const el = element && hasElement(element) ? element : "scroll";
  const groups = splitTitle(title, highlight);
  const size = titleSize(title, 104);
  const year = title.match(/[0-9٠-٩]{3,4}/)?.[0];
  return (
    <AbsoluteFill style={{ direction: useLang().dir, overflow: "hidden", background: "linear-gradient(180deg, #120C1E 0%, #2A1E3F 30%, #6B3552 56%, #C8603A 72%, #E07A3F 76%, #EADBC0 76%, #E3D2B3 100%)" }}>
      <svg width={1280} height={720} style={{ position: "absolute", inset: 0 }}>
        <defs><clipPath id="th-sky"><rect x={0} y={0} width={1280} height={547} /></clipPath></defs>
        <circle cx={290} cy={547} r={200} fill="#F3C98B" clipPath="url(#th-sky)" />
        {Array.from({ length: 50 }, (_, i) => <circle key={i} cx={(Math.sin(i * 91.7) * 0.5 + 0.5) * 1280} cy={(Math.sin(i * 37.3) * 0.5 + 0.5) * 220} r={1.5} fill="#F3E9DA" opacity={0.5} />)}
        <path d="M0 547 H1280" stroke="#2B1E14" strokeWidth={5} />
        {Array.from({ length: 11 }, (_, i) => <path key={i} d={`M${i * 120 + 60} 547 V${i % 4 === 0 ? 575 : 562}`} stroke="#2B1E14" strokeWidth={4} />)}
        <path d="M60 660 C200 600 320 690 470 630 S700 600 760 640" fill="none" stroke="#7E2A22" strokeWidth={5} strokeDasharray="14 12" />
        <circle cx={760} cy={640} r={12} fill="#7E2A22" />
      </svg>
      <div style={{ position: "absolute", left: 140, top: 230, width: 300, height: 300, display: "grid", placeItems: "center", filter: "drop-shadow(0 12px 24px rgba(18,12,30,0.5))" }}>
        <Element id={el} theme={t} size={280} />
      </div>
      <div style={{ position: "absolute", insetInlineStart: 60, top: 40, height: 480, width: 700, display: "flex", flexDirection: "column", justifyContent: "center", gap: 16 }}>
        {year ? <span style={{ alignSelf: "flex-start", fontFamily: fontFamilies.mono, fontSize: 34, color: "#F3E9DA", background: "#D7372B", padding: "2px 16px", direction: "ltr" }}>{year}</span> : null}
        <div style={{ fontFamily: "'Amiri', serif", fontWeight: 700, fontSize: size, lineHeight: 1.3, color: "#F3E9DA", display: "flex", flexWrap: "wrap", gap: "0 22px", textShadow: "0 6px 26px rgba(18,12,30,0.75)" }}>
          {groups.map((g, i) => (g.on ? <span key={i} style={{ color: "#F3C98B" }}>{g.words.join(" ")}</span> : <React.Fragment key={i}>{g.words.map((w, j) => <span key={j}>{w}</span>)}</React.Fragment>))}
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 26, insetInlineStart: 50, display: "flex", alignItems: "center", gap: 12 }}>
        <ChannelLogo theme={t} size={64} tile={false} />
        <span style={{ fontFamily: "'Amiri', serif", fontWeight: 700, fontSize: 34, color: "#2B1E14" }}><ChannelName /></span>
      </div>
    </AbsoluteFill>
  );
};

/** زبدة الكتب «القلم المميِّز»: أبيض، بطاقة كتاب سوداء مائلة، والعنوان بخط ثقيل وكلمته مظلّلة بالفسفوري. */
const HighlighterThumb: React.FC<Inner> = ({ title, highlight, book }) => {
  // «القلم المميِّز» كما في لوحة الهوية: ورقة مسطّرة، بطاقة الكتاب السوداء بشريطها الفسفوري، العنوان وكلمته المظلّلة، واسم الكتاب بلون التنبيه
  const t = useTheme("paper");
  const c = t.colors;
  const groups = splitTitle(title, highlight);
  const size = titleSize(title, 128);
  return (
    <AbsoluteFill style={{ background: c.bg, direction: useLang().dir, overflow: "hidden" }}>
      <svg width={1280} height={720} style={{ position: "absolute", inset: 0 }}>
        {Array.from({ length: 11 }, (_, i) => <path key={i} d={`M0 ${(i + 1) * 64} H1280`} stroke={c.ink} strokeOpacity={0.05} strokeWidth={2} />)}
      </svg>
      <div style={{ position: "absolute", left: 96, top: 116, width: 300, height: 450, background: c.ink, borderRadius: 10, transform: "rotate(-5deg)", boxShadow: `22px 26px 0 ${c.ink}1F` }}>
        <div style={{ margin: "58px 30px 0", height: 30, background: c.highlight }} />
        <div style={{ margin: "22px 30px 0 70px", height: 18, background: c.bg, opacity: 0.45 }} />
      </div>
      <div style={{ position: "absolute", insetInlineStart: 64, top: 0, bottom: 0, width: 720, display: "flex", flexDirection: "column", justifyContent: "center", gap: 46 }}>
        <div style={{ fontFamily: fontFamilies.bold, fontSize: size, lineHeight: 1.3, color: c.ink, display: "flex", flexWrap: "wrap", gap: "0 24px" }}>
          {groups.map((g, i) => (g.on ? <span key={i} style={{ background: c.highlight, color: c.onHighlight, padding: "0 14px" }}>{g.words.join(" ")}</span> : <React.Fragment key={i}>{g.words.map((w, j) => <span key={j}>{w}</span>)}</React.Fragment>))}
        </div>
        {book ? (
          <div style={{ alignSelf: "flex-start", background: c.secondary, color: c.bg, fontFamily: fontFamilies.bold, fontSize: 54, lineHeight: 1.25, padding: "6px 26px 10px", borderRadius: 12 }}>{book}</div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

// ———————— الأغلفة الثلاثة (قرار المالك ٢١ نوفمبر ٢٠٢٦): «سؤال» و«مشهد» بلغة كل قناة ————————

type ThumbStyle = "circle" | "mihrab" | "horizon" | "highlighter" | string;
/** لغة القناة في الغلاف: الخلفية، والحبر، ولون التمييز ونصه، وخط العنوان، ولون الشعار. لا تخرج عن هوية القناة. */
const useSkin = (style: ThumbStyle, themeId: ThemeId) => {
  const night = useTheme("night");
  const paper = useTheme("paper");
  const own = useTheme(themeId);
  if (style === "mihrab") return { theme: night, bg: "radial-gradient(ellipse at 70% 40%, #14382F 0%, #0B1F1C 70%)", base: "#0B1F1C", ink: "#F4EEE2", accent: "#F2B35B", onAccent: "#0B1F1C", font: fontFamilies.ruqaa, nameFont: fontFamilies.ruqaa, block: false };
  if (style === "horizon") return { theme: night, bg: "linear-gradient(180deg, #120C1E 0%, #2A1E3F 38%, #6B3552 70%, #C8603A 100%)", base: "#120C1E", ink: "#F3E9DA", accent: "#F3C98B", onAccent: "#120C1E", ribbon: "#D7372B", font: "'Amiri', serif", nameFont: "'Amiri', serif", block: false };
  if (style === "highlighter") return { theme: paper, bg: paper.colors.bg, base: paper.colors.ink, ink: paper.colors.ink, accent: paper.colors.highlight, onAccent: paper.colors.onHighlight, font: fontFamilies.bold, nameFont: fontFamilies.bold, block: true };
  const c = own.colors;
  return { theme: own, bg: c.bg, base: c.ink, ink: c.ink, accent: c.primary, onAccent: own.id === "night" ? c.bg : c.surface, font: fontFamilies.heading, nameFont: fontFamilies.wordmark, block: true };
};
type Skin = ReturnType<typeof useSkin>;

/** النص الكبير (≤ ٣ كلمات) وكلمته الأخيرة بلون التمييز: كتلة في «الدائرة» و«القلم المميِّز»، ولون في «المحراب» و«الأفق». */
const ConceptWords: React.FC<{ skin: Skin; text: string; size: number; color?: string; shadow?: string; all?: boolean }> = ({ skin, text, size, color, shadow, all }) => {
  const words = text.split(/\s+/).filter(Boolean);
  const cut = all ? 0 : Math.max(words.length - 1, 0);
  const plain = words.slice(0, cut).join(" ");
  const hl = words.slice(cut).join(" ");
  return (
    <div style={{ fontFamily: skin.font, fontWeight: 700, fontSize: size, lineHeight: 1.25, color: color ?? skin.ink, display: "flex", flexWrap: "wrap", gap: "0 26px", textShadow: shadow, textWrap: "balance" }}>
      {plain ? <span>{plain}</span> : null}
      {hl ? (skin.block
        ? <span style={{ background: skin.accent, color: skin.onAccent, padding: "0 20px", borderRadius: 14, textShadow: "none" }}>{hl}</span>
        : <span style={{ color: skin.accent }}>{hl}</span>) : null}
    </div>
  );
};

const ConceptLogo: React.FC<{ skin: Skin; color: string }> = ({ skin, color }) => (
  <div style={{ position: "absolute", bottom: 30, insetInlineStart: 50, display: "flex", alignItems: "center", gap: 12 }}>
    <ChannelLogo theme={skin.theme} size={60} tile={skin.block} />
    <span style={{ fontFamily: skin.nameFont, fontWeight: 700, fontSize: 34, color }}><ChannelName /></span>
  </div>
);

const conceptSize = (text: string) => (text.length > 18 ? 132 : text.length > 11 ? 156 : 184);

/** «سؤال»: السؤال وحده كبيرًا، وعلامة استفهام ضخمة بلون التمييز في الجهة الأخرى. بلا عنصر رمزي (الفكرة هي السؤال). */
export const QuestionThumb: React.FC<{ style: ThumbStyle; themeId: ThemeId; text: string }> = ({ style, themeId, text }) => {
  const skin = useSkin(style, themeId);
  return (
    <AbsoluteFill style={{ background: skin.bg, direction: useLang().dir, overflow: "hidden" }}>
      {style === "highlighter" ? (
        <svg width={1280} height={720} style={{ position: "absolute", inset: 0 }}>
          {Array.from({ length: 11 }, (_, i) => <path key={i} d={`M0 ${(i + 1) * 64} H1280`} stroke={skin.ink} strokeOpacity={0.05} strokeWidth={2} />)}
        </svg>
      ) : null}
      {style === "horizon" ? <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 150, background: "linear-gradient(180deg, #EADBC0 0%, #E3D2B3 100%)", borderTop: "5px solid #2B1E14" }} /> : null}
      <div style={{ position: "absolute", insetInlineEnd: 40, top: -60, fontFamily: skin.font, fontWeight: 700, fontSize: 760, lineHeight: 1, color: skin.accent, opacity: skin.block ? 0.9 : 0.85 }}>؟</div>
      <div style={{ position: "absolute", insetInlineStart: 70, top: 0, bottom: style === "horizon" ? 150 : 0, width: 760, display: "flex", flexDirection: "column", justifyContent: "center", gap: 20 }}>
        {"ribbon" in skin && skin.ribbon ? <span style={{ alignSelf: "flex-start", width: 120, height: 14, background: skin.ribbon }} /> : null}
        <ConceptWords skin={skin} text={text} size={conceptSize(text)} shadow={skin.block ? undefined : "0 6px 28px rgba(0,0,0,0.55)"} />
      </div>
      <ConceptLogo skin={skin} color={style === "horizon" ? "#2B1E14" : skin.ink} />
    </AbsoluteFill>
  );
};

/**
 * «مشهد»: لقطة حقيقية من مشهد معتمد بملء الصورة، وظلّ متدرّج من جهة النص بلون القناة، والكلمات (إن وُجدت) بخطها.
 * بلا لقطة (معاينة قبل صنع المشاهد) يظهر عنصر الحلقة على خلفية القناة، فلا تُخرج صورة فارغة.
 */
export const SceneThumb: React.FC<{ style: ThumbStyle; themeId: ThemeId; text: string; frame?: string; element?: string }> = ({ style, themeId, text, frame, element }) => {
  const skin = useSkin(style, themeId);
  const dir = useLang().dir;
  const el = element && hasElement(element) ? element : style === "horizon" ? "scroll" : "question-mark";
  const scrim = `linear-gradient(${dir === "rtl" ? "270deg" : "90deg"}, ${skin.base}F2 0%, ${skin.base}B3 34%, ${skin.base}00 66%)`;
  return (
    <AbsoluteFill style={{ background: skin.bg, direction: dir, overflow: "hidden" }}>
      {frame
        ? <img src={frame} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        : <div style={{ position: "absolute", insetInlineEnd: 120, top: 150, width: 420, height: 420, display: "grid", placeItems: "center" }}><Element id={el} theme={skin.theme} size={400} /></div>}
      {text.trim() ? <AbsoluteFill style={{ background: scrim }} /> : null}
      <AbsoluteFill style={{ background: `linear-gradient(0deg, ${skin.base}CC 0%, ${skin.base}00 22%)` }} />
      {text.trim() ? (
        <div style={{ position: "absolute", insetInlineStart: 70, top: 0, bottom: 90, width: 640, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <ConceptWords skin={skin} text={text} size={conceptSize(text) * 0.9} color={style === "highlighter" ? "#FFFFFF" : skin.ink} shadow="0 6px 30px rgba(0,0,0,0.7)" />
        </div>
      ) : null}
      <ConceptLogo skin={skin} color={style === "highlighter" ? "#FFFFFF" : skin.ink} />
    </AbsoluteFill>
  );
};
