import React from "react";
import { pageOpacity, pageWindows, verseLetters, versePages } from "../../quran/versePages";

/** صفحات الآية وأطول صفحة بالحروف (لحساب حجم الخط على الصفحة لا على الآية كلها) */
export const usePages = (text: string, budget: number) =>
  React.useMemo(() => {
    const pages = versePages(text, budget);
    return { pages, letters: Math.max(0, ...pages.map(verseLetters)) };
  }, [text, budget]);

/**
 * نص الآية في البطاقة: كما هو إن كان صفحة واحدة، وإلا صفحاته في الموضع نفسه (خلية واحدة، فلا يتحرك شيء حولها)
 * تتبدّل بخفوت هادئ على مدى التلاوة. wrap يرسم كل صفحة بأسلوب القناة (﴿ ﴾ والخط واللون).
 */
export const PagedVerse: React.FC<{
  pages: string[]; frame: number; start: number; span: number;
  wrap: (page: string, i: number, n: number) => React.ReactNode;
}> = ({ pages, frame, start, span, wrap }) => {
  if (pages.length <= 1) return <>{wrap(pages[0] ?? "", 0, 1)}</>;
  const windows = pageWindows(pages, start, span);
  return (
    <div style={{ display: "grid", width: "100%" }}>
      {windows.map((w, i) => {
        const o = pageOpacity(w, frame);
        return (
          <div key={i} data-verse-page={i} style={{ gridArea: "1 / 1", opacity: o, display: "flex", alignItems: "center", justifyContent: "center", visibility: o > 0 ? "visible" : "hidden" }}>
            {wrap(w.text, i, pages.length)}
          </div>
        );
      })}
    </div>
  );
};
