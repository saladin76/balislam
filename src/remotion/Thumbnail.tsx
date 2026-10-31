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

/** مشترك للأسلوب السينمائي: خلفية داكنة بضوء جانبي، عنصر داخل إطار ذهبي متوهج، عنوان كريمي بكلمة ذهبية. */
const CineThumb: React.FC<Omit<ThumbnailProps, "identity" | "channel" | "lang"> & { look: { bg: string; glow: string; gold: string; cream: string; font: string; frame: "oval" | "book"; badge?: string } }> = ({ themeId, title, highlight, element, look }) => {
  const t = useTheme(themeId);
  const el = element && hasElement(element) ? element : "question-mark";
  const groups = splitTitle(title, highlight);
  const size = title.length > 34 ? 80 : title.length > 22 ? 94 : 108;
  return (
    <AbsoluteFill style={{ background: look.bg, direction: useLang().dir, fontFamily: look.font, overflow: "hidden" }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 24% 52%, ${look.glow} 0%, transparent 52%)` }} />
      <AbsoluteFill style={{ background: `linear-gradient(90deg, transparent 40%, ${look.bg}cc 70%)` }} />
      {/* العنصر داخل إطار */}
      <div style={{ position: "absolute", insetInlineEnd: 90, top: 95, width: 400, height: look.frame === "oval" ? 520 : 470, display: "grid", placeItems: "center" }}>
        {look.frame === "oval" ? (
          <>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `5px solid ${look.gold}`, boxShadow: `0 0 50px ${look.gold}55, inset 0 0 60px ${look.bg}` }} />
            <div style={{ position: "absolute", inset: 14, borderRadius: "50%", border: `1.5px solid ${look.gold}99` }} />
            <div style={{ position: "absolute", inset: 22, borderRadius: "50%", background: `radial-gradient(circle at 50% 40%, #F3E3C2 0%, #C9A877 80%)`, filter: "sepia(.25)" }} />
          </>
        ) : (
          <>
            <div style={{ position: "absolute", inset: 0, borderRadius: "8px 22px 22px 8px", background: `linear-gradient(135deg, #12303A, #0A1A20)`, border: `4px solid ${look.gold}`, boxShadow: `22px 26px 50px rgba(0,0,0,.6), 0 0 40px ${look.gold}33` }} />
            <div style={{ position: "absolute", top: 12, bottom: 12, insetInlineStart: 26, width: 3, background: `${look.gold}88` }} />
            <div style={{ position: "absolute", top: -8, insetInlineEnd: 70, width: 40, height: 120, background: look.cream, clipPath: "polygon(0 0,100% 0,100% 100%,50% 82%,0 100%)" }} />
            <div style={{ position: "absolute", width: 290, height: 290, borderRadius: "50%", background: `radial-gradient(circle, #F7EBD3 0%, #E4D3AE 75%)` }} />
          </>
        )}
        <div style={{ position: "relative" }}><Element id={el} theme={t} size={look.frame === "oval" ? 320 : 240} /></div>
      </div>
      <div style={{ position: "absolute", insetInlineStart: 64, top: 0, bottom: 0, width: 700, display: "flex", flexDirection: "column", justifyContent: "center", gap: 20 }}>
        {look.badge ? <span style={{ alignSelf: "flex-start", border: `2px solid ${look.gold}`, color: look.gold, fontWeight: 700, fontSize: 34, borderRadius: 10, padding: "2px 18px", fontFamily: fontFamilies.heading }}>{look.badge}</span> : null}
        <div style={{ fontWeight: 700, fontSize: size, lineHeight: 1.25, color: look.cream, display: "flex", flexWrap: "wrap", gap: "0 20px", textWrap: "balance", textShadow: "0 6px 24px rgba(0,0,0,.6)" }}>
          {groups.map((g, i) => (g.on ? <span key={i} style={{ color: look.gold }}>{g.words.join(" ")}</span> : <React.Fragment key={i}>{g.words.map((w, j) => <span key={j}>{w}</span>)}</React.Fragment>))}
        </div>
        <div style={{ width: 160, height: 3, background: `linear-gradient(90deg, ${look.gold}, transparent)` }} />
      </div>
      <AbsoluteFill style={{ boxShadow: `inset 0 0 160px 40px ${look.bg}` }} />
      <div style={{ position: "absolute", bottom: 34, insetInlineStart: 50, display: "flex", alignItems: "center", gap: 12 }}>
        <ChannelLogo theme={t} size={56} />
        <span style={{ fontWeight: 700, fontSize: 30, color: look.cream, fontFamily: look.font }}><ChannelName /></span>
      </div>
    </AbsoluteFill>
  );
};

/** دفاتر الزمن: أسود دافئ وذهب، صورة أرشيفية في إطار بيضاوي، وخط أميري */
const ArchiveThumb: React.FC<Omit<ThumbnailProps, "identity" | "channel" | "lang">> = (p) => (
  <CineThumb {...p} element={p.element || "scroll"} look={{ bg: "#0C0907", glow: "#4A2E16", gold: "#D4A24C", cream: "#F1E3C6", font: "'Amiri', serif", frame: "oval" }} />
);

/** زبدة الكتب: أزرق ليلي وكهرماني، كتاب مجسّم بشريط، وشارة «في دقائق» */
const CoverThumb: React.FC<Omit<ThumbnailProps, "identity" | "channel" | "lang">> = (p) => (
  <CineThumb {...p} element={p.element || "book-open"} look={{ bg: "#071116", glow: "#1A4552", gold: "#F2C46D", cream: "#F3EEE4", font: fontFamilies.heading, frame: "book", badge: "في دقائق" }} />
);

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
