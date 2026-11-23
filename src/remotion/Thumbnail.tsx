import React from "react";
import { AbsoluteFill, Img } from "remotion";
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

/**
 * غلاف من الأغلفة الثلاثة (src/package/thumbnails.ts). «عنوان» بأسلوب مصغّرة القناة المعتمد وكلمته في كل القنوات.
 * «مشهد» و«سؤال» لهما تصميم بأسلوب «دفتر الأفق» وحده (D196، اتجاه دفاتر الزمن معتمد)؛ وفي الأساليب الأخرى موقوفان
 * (KI-120) حتى يُعتمد اتجاه قناتها. «مشهد» لقطة حقيقية من فيديو المشهد المعتمد (image: data URI من thumbnailFrame.ts).
 */
/** بؤرة اللقطة: مركز العنصر في الإطار (٠–١) والتكبير عليه (≥١)، فيملأ العنصر الغلاف */
export type ThumbFocus = { x: number; y: number; zoom: number; /** أدنى جزء ظاهر من الإطار (٠٫٥–١)؛ الافتراضي يخفي شريط الترجمة المحروق، ويُرفع للحظة بلا ترجمة */ bottom?: number };
export type ThumbConceptProp = { kind: "title" | "scene" | "question"; text: string; image?: string; focus?: ThumbFocus };
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
  // الأغلفة الثلاثة: «عنوان» بأسلوب مصغّرة القناة المعتمد وكلمته؛ «سؤال» و«مشهد» موقوفان (KI-120)
  const signature = (p: Inner) => (style === "mihrab" ? <MihrabThumb {...p} /> : style === "horizon" ? <HorizonThumb {...p} /> : style === "highlighter" ? <HighlighterThumb {...p} /> : <CircleThumb {...p} />);
  if (concept && concept.kind !== "title" && style !== "horizon") throw new Error(`غلاف «${concept.kind}» موقوف حتى يختار المالك اتجاه القناة (KI-120).`);
  const body = !concept ? signature(props)
    : style === "horizon" && concept.kind === "scene" ? <HorizonSceneThumb {...props} words={concept.text} image={concept.image} focus={concept.focus} />
    : style === "horizon" && concept.kind === "question" ? <HorizonQuestionThumb {...props} words={concept.text} image={concept.image} focus={concept.focus} />
    : style === "horizon" && concept.image ? <HorizonTitleFrameThumb {...props} words={concept.text} image={concept.image} focus={concept.focus} />
    : signature({ ...props, title: concept.text, highlight: concept.text.split(/\s+/).filter(Boolean).slice(-1).join(" ") });
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

/** نسبة أسفل لقطة المشهد التي يشغلها شريط الترجمة في فيديو المشهد (CaptionBar)؛ لا تظهر على الغلاف */
export const SCENE_CAPTION_BAND = 0.24;
const INK = "#2B1E14", PARCH = "#EADBC0", RED = "#D7372B", RED_DARK = "#7E2A22", CREAM = "#F3E9DA";

/**
 * اللقطة الحقيقية مقصوصة على عنصرها (D196 بعد ملاحظة المالك ٢٢ نوفمبر): تكبير على بؤرة العنصر فيملأ المساحة،
 * ولا يظهر شريط الترجمة المحروق أسفل الإطار (SCENE_CAPTION_BAND). الصورة ١٩٢٠×١٠٨٠ كفيديو المشهد.
 */
export const focusBox = (W: number, H: number, f: ThumbFocus = { x: 0.5, y: 0.4, zoom: 1 }) => {
  const scale = Math.max(1, f.zoom) * Math.max(W / 1920, H / 1080);
  const iw = 1920 * scale, ih = 1080 * scale;
  const usable = ih * Math.min(1, Math.max(0.5, f.bottom ?? 1 - SCENE_CAPTION_BAND));
  const left = Math.min(0, Math.max(W - iw, W / 2 - f.x * iw));
  const top = Math.min(0, Math.max(H - usable, H / 2 - f.y * ih));
  return { iw, ih, left, top };
};
const FramePhoto: React.FC<{ image?: string; focus?: ThumbFocus; w: number; h: number; element?: string }> = ({ image, focus, w, h, element }) => {
  const t = useTheme("paper");
  const b = focusBox(w, h, focus);
  return (
    <div data-testid="thumb-frame" style={{ position: "absolute", inset: 0, overflow: "hidden", background: PARCH }}>
      {image ? <Img src={image} style={{ position: "absolute", left: b.left, top: b.top, width: b.iw, height: b.ih, display: "block" }} />
        : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}><Element id={element && hasElement(element) ? element : "scroll"} theme={t} size={Math.min(w, h) * 0.6} /></div>}
    </div>
  );
};
const Mark: React.FC<{ light?: boolean }> = ({ light }) => {
  const t = useTheme(light ? "night" : "paper");
  return (
    <div style={{ position: "absolute", top: 22, insetInlineEnd: 26, display: "flex", alignItems: "center", gap: 10 }}>
      <ChannelLogo theme={t} size={52} tile={false} />
      <span style={{ fontFamily: "'Amiri', serif", fontWeight: 700, fontSize: 28, color: light ? CREAM : INK }}><ChannelName /></span>
    </div>
  );
};

/**
 * دفاتر الزمن — غلاف «عنوان» من صورة الحلقة (D196 v2): العنصر يملأ يسار الغلاف (٦٢٪)، والكلمات على ورق الدفتر الصافي يمينه
 * بحبر داكن كبير جدًا؛ خط حبر فاصل وشريط التاريخ الأحمر عند رأس العمود. لا سماء ولا تدرّج ولا نجوم.
 */
const HorizonTitleFrameThumb: React.FC<Inner & { words: string; image?: string; focus?: ThumbFocus }> = ({ words, image, focus, element }) => {
  const w = words.trim();
  return (
    <AbsoluteFill style={{ direction: useLang().dir, overflow: "hidden", background: PARCH }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: 800, height: 720 }}><FramePhoto image={image} focus={focus} w={800} h={720} element={element} /></div>
      <div style={{ position: "absolute", left: 800, top: 0, width: 8, height: 720, background: INK }} />
      <svg width={1280} height={720} style={{ position: "absolute", inset: 0 }}><path d="M1160 0 H1212 V120 L1186 100 L1160 120 Z" fill={RED} stroke={RED_DARK} strokeWidth={3} /></svg>
      <div data-testid="thumb-title-words" style={{ position: "absolute", left: 830, right: 40, top: 130, bottom: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "'Amiri', serif", fontWeight: 700, fontSize: w.length > 9 ? 128 : 150, lineHeight: 1.12, color: INK, textAlign: "center" }}>{w}</div>
      </div>
    </AbsoluteFill>
  );
};

/**
 * دفاتر الزمن — غلاف «مشهد» (D196 v2): اللقطة الحقيقية تملأ الغلاف كله مكبّرة على عنصرها، والكلمات على شريط التاريخ الأحمر
 * الصلب أسفله بلون الورق (تباين عالٍ بلا ظل ولا تدرّج).
 */
const HorizonSceneThumb: React.FC<Inner & { words: string; image?: string; focus?: ThumbFocus }> = ({ words, image, focus, element }) => {
  const w = words.trim();
  return (
    <AbsoluteFill style={{ direction: useLang().dir, overflow: "hidden", background: PARCH }}>
      <FramePhoto image={image} focus={focus} w={1280} h={w ? 560 : 720} element={element} />
      {w ? (
        <div data-testid="thumb-scene-band" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 160, background: RED, borderTop: `6px solid ${RED_DARK}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontFamily: "'Amiri', serif", fontWeight: 700, fontSize: 118, lineHeight: 1, color: CREAM }}>{w}</div>
        </div>
      ) : null}
      <Mark />
    </AbsoluteFill>
  );
};

/**
 * دفاتر الزمن — غلاف «سؤال» (D196 v2): العنصر في أعلى الغلاف مكبّرًا، وتحته ورق الدفتر الصافي والسؤال بحبر داكن كبير جدًا
 * و«؟» بأحمر شريط التاريخ. فكرة ثالثة مختلفة: الصورة سؤال، والكلمات سؤال.
 */
const HorizonQuestionThumb: React.FC<Inner & { words: string; image?: string; focus?: ThumbFocus }> = ({ words, image, focus, element }) => {
  const q = words.trim().replace(/[؟?]\s*$/, "");
  return (
    <AbsoluteFill style={{ direction: useLang().dir, overflow: "hidden", background: PARCH }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: 1280, height: 440 }}><FramePhoto image={image} focus={focus} w={1280} h={440} element={element} /></div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 440, height: 7, background: INK }} />
      <div data-testid="thumb-question" style={{ position: "absolute", left: 40, right: 40, top: 447, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "'Amiri', serif", fontWeight: 700, fontSize: q.length > 10 ? 150 : 170, lineHeight: 1, color: INK, textAlign: "center" }}>
          {q}<span style={{ color: RED }}>؟</span>
        </div>
      </div>
      <Mark />
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
