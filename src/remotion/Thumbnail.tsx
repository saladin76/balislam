import React from "react";
import { AbsoluteFill } from "remotion";
import { useTheme } from "../../brand/identity/index";
import { fontFamilies } from "../../brand/fonts";
import { Element } from "../../brand/elements/Element";
import { hasElement } from "../../brand/elements/registry";
import { LogoMark } from "../../brand/logo/Logo";
import type { ThemeId } from "../../brand/themes";
import { useBrandFonts } from "./useBrandFonts";

export type ThumbnailProps = { themeId: ThemeId; title: string; highlight?: string; element?: string };

/**
 * الصورة المصغّرة 1280×720: العنوان بخط كبير يمينًا، والعنصر الرمزي يسارًا داخل دائرة بلون التمييز،
 * والشعار صغيرًا في الزاوية. تُقرأ على الهاتف بحجم صغير، لذا لا أكثر من سطرين.
 */
export const Thumbnail: React.FC<ThumbnailProps> = ({ themeId, title, highlight, element }) => {
  useBrandFonts();
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
    <AbsoluteFill style={{ background: c.bg, direction: "rtl", fontFamily: fontFamilies.heading, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: -120, top: 70, width: 640, height: 640, borderRadius: "50%", background: c.highlight, opacity: line ? 0.55 : 0.85, border: line ? `5px solid ${c.ink}` : "none" }} />
      <div style={{ position: "absolute", left: 40, top: 150, width: 440, height: 440, display: "grid", placeItems: "center" }}>
        <Element id={el} theme={t} size={400} />
      </div>
      <div style={{ position: "absolute", right: 64, top: 0, bottom: 0, width: 700, display: "flex", flexDirection: "column", justifyContent: "center", gap: 18 }}>
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
      <div style={{ position: "absolute", top: 34, right: 40, display: "flex", alignItems: "center", gap: 12 }}>
        <LogoMark size={64} colors={t.logo} />
        <span style={{ fontFamily: fontFamilies.wordmark, fontWeight: 700, fontSize: 34, color: c.ink }}>بالإسلام</span>
      </div>
    </AbsoluteFill>
  );
};
