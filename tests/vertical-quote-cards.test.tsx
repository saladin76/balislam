import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { insideSafe, captionBox, SHORTS_SAFE_AREA, PORTRAIT_FRAME, SAFE_WIDTH } from "../src/remotion/safeArea";
import {
  PortraitQuoteCard, QUOTE_BOUNDS, QUOTE_FONTS, QUOTE_MIN_FONT, QUOTE_WIDTH, WORST_CAPTION, portraitQuoteLayout, quoteHeight, quoteRefLine, type PortraitQuote,
} from "../src/remotion/dafatir/horizon/portraitQuote";

/**
 * D243 + D242: بطاقات الآية والحديث في «خط الأفق» العمودي كاملة مقروءة داخل المنطقة الآمنة (x 120–900، y 270–1248)،
 * فوق أسوأ ترجمة، بلا قص. أسوأ الحالات نسخة محفوظة هنا من 002 (٢٨ نوفمبر: المائدة ٣٢ أطولها، والبقرة ٢١٣ جزءًا، وحديث
 * مسلم ١٦٢)، فلا يتغير الاختبار بتحرير المالك (KI-068)؛ ثم عقد بلا أرقام على كل آية وحديث في خطة 002 الحية.
 */
const WORST: { name: string; q: PortraitQuote }[] = [
  { name: "المائدة ٣٢", q: { kind: "verse", refKey: "5:32", text: "مِنْ أَجْلِ ذَٰلِكَ كَتَبْنَا عَلَىٰ بَنِىٓ إِسْرَٰٓءِيلَ أَنَّهُۥ مَن قَتَلَ نَفْسًۢا بِغَيْرِ نَفْسٍ أَوْ فَسَادٍ فِى ٱلْأَرْضِ فَكَأَنَّمَا قَتَلَ ٱلنَّاسَ جَمِيعًا وَمَنْ أَحْيَاهَا فَكَأَنَّمَآ أَحْيَا ٱلنَّاسَ جَمِيعًا ۚ وَلَقَدْ جَآءَتْهُمْ رُسُلُنَا بِٱلْبَيِّنَـٰتِ ثُمَّ إِنَّ كَثِيرًا مِّنْهُم بَعْدَ ذَٰلِكَ فِى ٱلْأَرْضِ لَمُسْرِفُونَ" } },
  { name: "البقرة ٢١٣ (جزء)", q: { kind: "verse", refKey: "2:213", partial: true, text: "كَانَ ٱلنَّاسُ أُمَّةً وَٰحِدَةً فَبَعَثَ ٱللَّهُ ٱلنَّبِيِّـۧنَ مُبَشِّرِينَ وَمُنذِرِينَ وَأَنزَلَ مَعَهُمُ ٱلْكِتَـٰبَ بِٱلْحَقِّ لِيَحْكُمَ بَيْنَ ٱلنَّاسِ فِيمَا ٱخْتَلَفُوا۟ فِيهِ ۚ …" } },
  { name: "مسلم ١٦٢", q: { kind: "hadith", refText: "صحيح مسلم ١٦٢", narrator: "أنس بن مالك", text: "ثُمَّ عُرِجَ بِنَا إِلَى السَّمَاءِ الرَّابِعَةِ… فَإِذَا أَنَا بِإِدْرِيسَ، فَرَحَّبَ وَدَعَا لِي بِخَيْرٍ" } },
];

const fitsWhole = (name: string, q: PortraitQuote) => {
  const ref = quoteRefLine(q);
  const pages = portraitQuoteLayout(q.text, ref);
  expect(pages.map((p) => p.text).join(" ").replace(/\s+/g, " ").trim(), `${name}: النص كله`).toBe(q.text.replace(/\s+/g, " ").trim());
  for (const p of pages) {
    expect(insideSafe(p.rect), `${name}: ${JSON.stringify(p.rect)}`).toBe(true);
    expect(p.rect.bottom, `${name}: فوق الترجمة`).toBeLessThanOrEqual(QUOTE_BOUNDS.bottom);
    expect(p.font, `${name}: مقروء`).toBeGreaterThanOrEqual(QUOTE_MIN_FONT);
    expect(p.rect.bottom - p.rect.top, `${name}: الصندوق يسع نصه المقدَّر`).toBeCloseTo(quoteHeight(p.text, ref, p.font), 6);
  }
  return pages;
};

describe("بطاقات الآية والحديث في العمودي (D243)", () => {
  it("الحدود: عرض المنطقة الآمنة كله، من حد الأعلى إلى ما فوق أسوأ ترجمة بفراغ", () => {
    expect([QUOTE_BOUNDS.left, QUOTE_BOUNDS.right, QUOTE_BOUNDS.top]).toEqual([SHORTS_SAFE_AREA.left, PORTRAIT_FRAME.width - SHORTS_SAFE_AREA.right, SHORTS_SAFE_AREA.top]);
    expect(QUOTE_WIDTH).toBe(SAFE_WIDTH);
    expect(QUOTE_BOUNDS.bottom).toBeLessThan(captionBox(WORST_CAPTION.lines, WORST_CAPTION.size).top);
    expect(insideSafe(QUOTE_BOUNDS)).toBe(true);
  });

  it("أسوأ الحالات (المائدة ٣٢، والبقرة ٢١٣، ومسلم ١٦٢) بطاقة واحدة ساكنة كاملة كـ001، داخل المنطقة بلا قص", () => {
    for (const { name, q } of WORST) expect(fitsWhole(name, q), name).toHaveLength(1); // owner-pin-ok: نسخة محفوظة في الاختبار نفسه
    // الأطول بأصغر خط مقروء أو أكبر منه، والأقصر بخط أكبر
    const font = (i: number) => fitsWhole(WORST[i]!.name, WORST[i]!.q)[0]!.font;
    expect(font(0)).toBeGreaterThanOrEqual(QUOTE_MIN_FONT);
    expect(font(2)).toBeGreaterThan(font(0));
    expect(QUOTE_FONTS[0]).toBeGreaterThan(QUOTE_MIN_FONT);
  });

  it("كل آية وحديث في خطة 002 الحية كاملة داخل المنطقة (عقد بلا أرقام)", () => {
    const root = path.resolve(import.meta.dirname, "..");
    const plan = JSON.parse(readFileSync(path.join(root, "channels/dafatir-alzaman/episodes/002-ibna-adam/plan.json"), "utf8")) as { chapters: { scenes: { id: string; props?: Record<string, string> }[] }[] };
    for (const s of plan.chapters.flatMap((c) => c.scenes)) {
      const p = s.props ?? {};
      if (p.hadithText) fitsWhole(s.id, { kind: "hadith", text: p.hadithText, refText: p.hadithRef ?? "", narrator: p.hadithNarrator });
      else if (p.verseText) fitsWhole(s.id, { kind: "verse", text: p.verseText, refKey: p.verseKey ?? "", partial: p.versePartial === "1" });
    }
  });

  it("نص أطول من كل ذلك يُقسم صفحات كاملة متتابعة، كل صفحة داخل المنطقة", () => {
    const long: PortraitQuote = { ...WORST[0]!.q, text: Array.from({ length: 4 }, () => WORST[0]!.q.text).join(" ") } as PortraitQuote;
    expect(fitsWhole("أربعة أضعاف المائدة ٣٢", long).length).toBeGreaterThan(1);
  });

  it("الرسم: البطاقة بإحداثيات الشاشة عند مستطيلها، بالعرض الآمن، بلا ارتفاع ثابت ولا قص، وسطر المرجع", () => {
    const q = WORST[2]!.q;
    const html = renderToStaticMarkup(<PortraitQuoteCard quote={q} progress={0.5} />);
    const m = /data-portrait-quote="hadith"[^>]*style="([^"]*)"|style="([^"]*)"[^>]*data-portrait-quote="hadith"/.exec(html)!;
    const s = (m[1] ?? m[2]!).replace(/\s/g, "");
    const page = portraitQuoteLayout(q.text, quoteRefLine(q))[0]!;
    expect(s).toContain(`left:${page.rect.left}px`);
    expect(s).toContain(`width:${QUOTE_WIDTH}px`);
    expect(s).toContain(`top:${page.rect.top}px`);
    expect(s).not.toMatch(/(^|;)height:|overflow:hidden/);
    expect(html).toContain(quoteRefLine(q));
  });

  it("HorizonShot: في العمودي لا بطاقة على صفحة الدفتر، بل بطاقة الشاشة في نافذة الآية نفسها والراوي مستمر", () => {
    const src = readFileSync(path.resolve(import.meta.dirname, "..", "src/remotion/scenes/HorizonShot.tsx"), "utf8");
    expect(src).toContain("vw && verseShow > 0 && !portrait ?");
    expect(src).toContain("{portrait && vw && verseShow > 0 ? (");
    expect(src).toContain("<PortraitQuoteCard");
  });
});
