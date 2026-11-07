import type { Plan } from "./types";
import type { QuranTexts } from "./generate";

export const VERSE_PLACEHOLDER = "‹نص الآية مطلوب من صاحب القناة›";

/**
 * نصوص الآيات المرسلة يدويًا تُحفظ فقط في quran.json لا داخل plan.json (بدون مزامنة خارجية؛
 * وplan.json يُرفع إلى GitHub). يُحفظان في quran.json على الجهاز فقط ويُدمجان عند القراءة.
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
      return { ...s, props: { ...s.props, text: quran[s.ayahKey] || VERSE_PLACEHOLDER, ...(meaning ? { meaning } : {}) } };
    }),
  })),
});

