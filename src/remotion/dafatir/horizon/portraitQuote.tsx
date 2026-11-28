/**
 * D243 + D242: بطاقة الآية أو الحديث في الإطار العمودي (1080×1920) لـ«خط الأفق».
 *
 * في الأفقي تُرسم البطاقة على صفحة الدفتر داخل كاميرته (VersePageContext، بإحداثيات عالم 1920×1080)؛ وفي العمودي يقع نصف
 * الدفتر خارج الإطار، فتُقص البطاقة. لذلك تُرسم في العمودي بإحداثيات الشاشة نفسها داخل المنطقة الآمنة للشورتس
 * (src/remotion/safeArea.ts: x 120–900، y 270–1248)، فوق الدفتر وتحت الترجمة، بالإطار نفسه (رَقّ بإطار مزدوج) والخط نفسه
 * (المصحف للآية، والأميري للحديث) وسطر المرجع نفسه. السلوك كما في 001: تظهر كاملة ساكنة طوال نافذتها والراوي مستمر
 * (والترجمة تحتها)، وتختفي دفعة واحدة.
 *
 * لا تُقص أبدًا: حجم الخط يُختار من القائمة تنازليًا حتى يسع الارتفاعُ المقدَّر (بعرض حرف 0.48 من الخط، أوسع من تقدير
 * بطاقة الصفحة 0.42، وبطول النص بتشكيله) المساحةَ فوق أسوأ ترجمة (ثلاثة أسطر بأكبر خط ترجمة في القنوات الثلاث)؛ وإن لم يسع
 * بأصغر خط مقروء قُسم النص صفحات (versePages) تتتابع في النافذة نفسها، كل صفحة كاملة.
 */
import React from "react";
import { AbsoluteFill } from "remotion";
import { quranDisplay } from "../../../quran/display";
import { versePages } from "../../../quran/versePages";
import { PORTRAIT_FRAME, PORTRAIT_TEXT, SHORTS_SAFE_AREA, SAFE_WIDTH, captionBox, type Rect } from "../../safeArea";
import { C, hadithAttribution, verseRef } from "./kit";

/** أكبر خط ترجمة عمودية في هويات القنوات الثلاث (channels/<القناة>/identity.json) */
export const WORST_CAPTION = { lines: 3, size: 62 };
/** الفراغ بين أسفل البطاقة وأعلى أسوأ ترجمة */
export const QUOTE_CAPTION_GAP = 24;
export const QUOTE_FONTS = [50, 46, 42, 38, 35, 32] as const;
/** أصغر خط مقروء على 1080×1920 */
export const QUOTE_MIN_FONT = 32;
const PAD = { top: 36, bottom: 28, x: 44 };
const LINE = 1.9;
const GLYPH = 0.48;
const REF = { size: 28, line: 1.4, gap: 18, glyph: 0.55 };

/** حدود البطاقة العمودية: عرض المنطقة الآمنة كاملًا، ومن حد الأعلى إلى ما فوق أسوأ ترجمة */
export const QUOTE_BOUNDS = {
  left: SHORTS_SAFE_AREA.left,
  right: PORTRAIT_FRAME.width - SHORTS_SAFE_AREA.right,
  top: PORTRAIT_TEXT.topLine.top,
  bottom: captionBox(WORST_CAPTION.lines, WORST_CAPTION.size).top - QUOTE_CAPTION_GAP,
} as const;
export const QUOTE_WIDTH = SAFE_WIDTH;
export const QUOTE_MAX_HEIGHT = QUOTE_BOUNDS.bottom - QUOTE_BOUNDS.top;

const linesOf = (text: string, font: number, glyph: number) => Math.max(1, Math.ceil(text.length / Math.floor((QUOTE_WIDTH - 2 * PAD.x) / (font * glyph))));
/** الارتفاع المقدَّر بسخاء (لا يقل عن الفعلي) لنص بخط font وسطر مرجع */
export const quoteHeight = (text: string, ref: string, font: number) =>
  PAD.top + linesOf(text, font, GLYPH) * font * LINE + REF.gap + linesOf(ref, REF.size, REF.glyph) * REF.size * REF.line + PAD.bottom;

export type QuotePage = { text: string; font: number; height: number; rect: Rect };
/** صفحات البطاقة: صفحة واحدة بأكبر خط يسع، وإلا صفحات بأصغر خط مقروء. كل مستطيل داخل QUOTE_BOUNDS ومتوسط فيها. */
export const portraitQuoteLayout = (text: string, ref: string): QuotePage[] => {
  const place = (t: string, font: number): QuotePage => {
    const height = quoteHeight(t, ref, font);
    const top = QUOTE_BOUNDS.top + Math.max(0, (QUOTE_MAX_HEIGHT - height) / 2);
    return { text: t, font, height, rect: { left: QUOTE_BOUNDS.left, right: QUOTE_BOUNDS.right, top, bottom: top + height } };
  };
  for (const font of QUOTE_FONTS) if (quoteHeight(text, ref, font) <= QUOTE_MAX_HEIGHT) return [place(text, font)];
  for (let budget = Math.max(20, Math.floor(text.length / 2)); budget >= 20; budget = Math.floor(budget * 0.8)) {
    const pages = versePages(text, budget);
    if (pages.length > 1 && pages.every((p) => quoteHeight(p, ref, QUOTE_MIN_FONT) <= QUOTE_MAX_HEIGHT)) return pages.map((p) => place(p, QUOTE_MIN_FONT));
  }
  return [place(text, QUOTE_MIN_FONT)];
};

export type PortraitQuote = { kind: "verse"; text: string; refKey: string; partial?: boolean } | { kind: "hadith"; text: string; refText: string; narrator?: string };
export const quoteRefLine = (q: PortraitQuote) => (q.kind === "verse" ? verseRef(q.refKey, q.partial) : hadithAttribution(q.refText, q.narrator));

/** البطاقة في الشاشة؛ progress من 0 إلى 1 داخل النافذة يختار الصفحة إن قُسمت */
export const PortraitQuoteCard: React.FC<{ quote: PortraitQuote; progress: number }> = ({ quote, progress }) => {
  const ref = quoteRefLine(quote);
  const pages = portraitQuoteLayout(quote.text, ref);
  const page = pages[Math.min(pages.length - 1, Math.max(0, Math.floor(progress * pages.length)))]!;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", direction: "ltr" }}>
      <div
        data-portrait-quote={quote.kind}
        style={{
          position: "absolute", left: page.rect.left, top: page.rect.top, width: QUOTE_WIDTH, boxSizing: "border-box",
          padding: `${PAD.top}px ${PAD.x}px ${PAD.bottom}px`, background: "#FBF4E6",
          border: "3px double rgba(74,46,31,0.65)", outline: "1.5px solid rgba(74,46,31,0.35)", outlineOffset: -14,
          borderRadius: 10, boxShadow: "0 18px 46px rgba(13,10,20,0.35)", direction: "rtl", textAlign: "center", overflowWrap: "anywhere",
        }}
      >
        <div style={{ fontFamily: quote.kind === "verse" ? "'Amiri Quran', 'Amiri', serif" : "'Amiri', serif", fontSize: page.font, lineHeight: LINE, color: C.inkText }}>
          {quote.kind === "verse" ? quranDisplay(page.text) : page.text}
        </div>
        <div style={{ marginTop: REF.gap, fontFamily: "'Tajawal', sans-serif", fontWeight: 500, fontSize: REF.size, lineHeight: REF.line, color: C.inkSoft }}>{ref}</div>
      </div>
    </AbsoluteFill>
  );
};
