import type { Plan } from "./types";
import type { QuranTexts } from "./generate";

export const VERSE_PLACEHOLDER = "‹نص الآية مطلوب داخل السكريبت›";

/**
 * نص الآيات مصدره script.md ولا يعاد تخزينه في plan.json. قد يحتوي quran.json
 * التاريخي على ترجمات معاني ومعلومات مصدرها فقط؛ لا يؤخذ منه نص آية مطلقًا.
 */
export const stripQuran = (plan: Plan): Plan => ({
  ...plan,
  chapters: plan.chapters.map((c) => ({
    ...c,
    scenes: c.scenes.map((s) => {
      if (s.template !== "verse-card" || !s.ayahKey) return s;
      const { meaning: _m, ...props } = s.props;
      return { ...s, props: { ...props, text: "" } };
    }),
  })),
});

export const withQuran = (plan: Plan, quran: QuranTexts): Plan => ({
  ...plan,
  chapters: plan.chapters.map((c) => ({
    ...c,
    scenes: c.scenes.map((s) => {
      if (s.template !== "verse-card" || !s.ayahKey) return s;
      const meaning = quran[`${s.ayahKey}#meaning`];
      const meaningSource = quran[`${s.ayahKey}#meaningSource`] || s.props.meaningSource;
      const { meaning: _oldMeaning, meaningSource: _oldSource, ...props } = s.props;
      return { ...s, props: { ...props, text: quran[s.ayahKey] || VERSE_PLACEHOLDER,
        ...(meaning ? { meaning, ...(meaningSource ? { meaningSource } : {}) } : {}) } };
    }),
  })),
});

