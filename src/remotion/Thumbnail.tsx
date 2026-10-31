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

export type ThumbnailProps = { themeId: ThemeId; title: string; highlight?: string; element?: string; identity?: Identity; channel?: ChannelInfo; lang?: string };

/**
 * الصورة المصغّرة 1280×720: العنوان بخط كبير يمينًا، والعنصر الرمزي يسارًا داخل دائرة بلون التمييز،
 * والشعار صغيرًا في الزاوية. تُقرأ على الهاتف بحجم صغير، لذا لا أكثر من سطرين.
 */
export const Thumbnail: React.FC<ThumbnailProps> = ({ identity, channel, lang, ...rest }) => (
  <Providers identity={identity} channel={channel} lang={lang}>
    <ThumbnailInner {...rest} />
  </Providers>
);

const ThumbnailInner: React.FC<Omit<ThumbnailProps, "identity" | "channel" | "lang">> = (props) => {
  useBrandFonts();
  const style = useChannel().brand?.thumbnail ?? "circle";
  if (style === "archive") return <ArchiveThumb {...props} />;
  if (style === "cover") return <CoverThumb {...props} />;
  return <CircleThumb {...props} />;
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

/**
 * دفاتر الزمن: رَقّ قديم بحافة محروقة، العنوان بحبر بني كبير والكلمة المهمة بأحمر الختم مع خط تحتها،
 * والعنصر داخل إطار بيضاوي كصورة أرشيفية، وختم القناة في الزاوية.
 */
const ArchiveThumb: React.FC<Omit<ThumbnailProps, "identity" | "channel" | "lang">> = ({ themeId, title, highlight, element }) => {
  const t = useTheme(themeId);
  const c = t.colors;
  const el = element && hasElement(element) ? element : "scroll";
  const groups = splitTitle(title, highlight);
  const size = title.length > 34 ? 82 : title.length > 22 ? 96 : 110;
  return (
    <AbsoluteFill style={{ background: "#EADBC0", direction: useLang().dir, fontFamily: fontFamilies.heading, overflow: "hidden" }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, #F6EBD3 0%, #E4D0AC 60%, #8A6A43 130%)" }} />
      <AbsoluteFill style={{ boxShadow: "inset 0 0 120px 30px rgba(60,35,15,.55)" }} />
      <div style={{ position: "absolute", insetInlineEnd: 60, top: 110, width: 430, height: 500, borderRadius: "50%", background: c.bg, border: "10px double #5A3A22", display: "grid", placeItems: "center", boxShadow: "0 10px 30px rgba(60,35,15,.4)", filter: "sepia(0.35)" }}>
        <Element id={hasElement(el) ? el : "question-mark"} theme={t} size={330} />
      </div>
      <div style={{ position: "absolute", insetInlineStart: 70, top: 0, bottom: 0, width: 690, display: "flex", flexDirection: "column", justifyContent: "center", gap: 14 }}>
        <div style={{ fontWeight: 800, fontSize: size, lineHeight: 1.22, color: "#2E1F14", display: "flex", flexWrap: "wrap", gap: "0 20px", textWrap: "balance" }}>
          {groups.map((g, i) => (g.on ? <span key={i} style={{ color: "#8E2F23", borderBottom: "8px solid #8E2F23", paddingBottom: 2 }}>{g.words.join(" ")}</span> : <React.Fragment key={i}>{g.words.map((w, j) => <span key={j}>{w}</span>)}</React.Fragment>))}
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 40, insetInlineStart: 60, display: "flex", alignItems: "center", gap: 12 }}>
        <ChannelLogo theme={t} size={60} />
        <span style={{ fontWeight: 700, fontSize: 32, color: "#2E1F14" }}><ChannelName /></span>
      </div>
    </AbsoluteFill>
  );
};

/**
 * زبدة الكتب: غلاف كتاب ثلاثي الأبعاد يسارًا بلون الثيم وعليه العنصر، والعنوان كبير يمينًا
 * مع شارة «في دقائق» بالكهرماني، على خلفية داكنة تبرز على الهاتف.
 */
const CoverThumb: React.FC<Omit<ThumbnailProps, "identity" | "channel" | "lang">> = ({ themeId, title, highlight, element }) => {
  const t = useTheme(themeId);
  const c = t.colors;
  const el = element && hasElement(element) ? element : "book-open";
  const groups = splitTitle(title, highlight);
  const size = title.length > 34 ? 80 : title.length > 22 ? 94 : 108;
  return (
    <AbsoluteFill style={{ background: "#0F1A20", direction: useLang().dir, fontFamily: fontFamilies.heading, overflow: "hidden" }}>
      <AbsoluteFill style={{ background: "radial-gradient(circle at 78% 55%, #1F4D52 0%, transparent 55%)" }} />
      <div style={{ position: "absolute", insetInlineEnd: 110, top: 100, width: 360, height: 500, perspective: 1200 }}>
        <div style={{ position: "absolute", inset: 0, transform: "rotateY(-22deg)", transformStyle: "preserve-3d" }}>
          <div style={{ position: "absolute", inset: 0, background: c.primary, borderRadius: "6px 16px 16px 6px", boxShadow: "18px 22px 40px rgba(0,0,0,.55)", display: "grid", placeItems: "center", border: "4px solid rgba(255,255,255,.15)" }}>
            <div style={{ background: c.surface, borderRadius: "50%", width: 260, height: 260, display: "grid", placeItems: "center" }}>
              <Element id={hasElement(el) ? el : "question-mark"} theme={t} size={210} />
            </div>
          </div>
          <div style={{ position: "absolute", top: 8, bottom: 8, insetInlineStart: "100%", width: 26, background: "repeating-linear-gradient(to bottom, #F2EDE2 0 3px, #D9D2C2 3px 5px)", transform: "translateX(-2px)" }} />
        </div>
      </div>
      <div style={{ position: "absolute", insetInlineStart: 64, top: 0, bottom: 0, width: 720, display: "flex", flexDirection: "column", justifyContent: "center", gap: 22 }}>
        <span style={{ alignSelf: "flex-start", background: "#FFB547", color: "#0F1A20", fontWeight: 800, fontSize: 40, borderRadius: 12, padding: "4px 20px" }}>في دقائق</span>
        <div style={{ fontWeight: 800, fontSize: size, lineHeight: 1.22, color: "#EEF3F2", display: "flex", flexWrap: "wrap", gap: "0 20px", textWrap: "balance" }}>
          {groups.map((g, i) => (g.on ? <span key={i} style={{ color: "#FFB547" }}>{g.words.join(" ")}</span> : <React.Fragment key={i}>{g.words.map((w, j) => <span key={j}>{w}</span>)}</React.Fragment>))}
        </div>
      </div>
      <div style={{ position: "absolute", top: 34, insetInlineStart: 40, display: "flex", alignItems: "center", gap: 12 }}>
        <ChannelLogo theme={t} size={58} />
        <span style={{ fontWeight: 700, fontSize: 30, color: "#EEF3F2" }}><ChannelName /></span>
      </div>
    </AbsoluteFill>
  );
};

/** بالإسلام: العنوان يمينًا، والعنصر داخل دائرة بلون التمييز، والشعار في الزاوية. */
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
