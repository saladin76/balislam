/**
 * بيانات مشاهد المكتبة العامة لـ«دفاتر الزمن» (بلا React): مشاهد تُضبط من الخطة بحقولها، لا ترتبط بحلقة.
 * تُدمج في HZ_META فتظهر في قائمة «المشهد» بالاستوديو لكل حلقة من القناة. التوثيق: docs/dafatir-alzaman/03-tools.md
 */
import type { HzMeta } from "../horizon/meta";
import { at, type Timeline } from "../horizon/timeline";

export const LIB_META: Record<string, HzMeta> = {
  chapter: { nameAr: "عنوان الفصل (بلا كلام)", tail: 0, exit: "none", seconds: 3.2 },
  "verse-intro": { nameAr: "تمهيد آية (صفحة ساكنة)", tail: 1.0, exit: "none", still: "verse-intro" },
  "verse-tag": { nameAr: "تمهيد آية بختم سورتها", tail: 1.0, exit: "none" },
  pending: { nameAr: "قيد التصميم (مكان المشهد في الخطة)", tail: 1.0, exit: "none" },
  "lib-term": { nameAr: "مكتبة · مصطلح يُكتب بالحبر (مع مصدره)", tail: 1.2, exit: "fade", minEnd: (p, tl) => termMinEnd(p, tl) },
  "lib-gloss": { nameAr: "مكتبة · متن وحاشية وتعليق (فصل المصادر)", tail: 1.4, exit: "turn" },
  "lib-compare": { nameAr: "مكتبة · مقارنة قولين أو موقفين أو دليلين", tail: 1.3, exit: "fade" },
  "lib-timeline": { nameAr: "مكتبة · خط زمني بعلامات وفجوات", tail: 1.4, exit: "fade" },
  "lib-evidence": { nameAr: "مكتبة · شواهد أثرية وحدودها", tail: 1.4, exit: "fade" },
};

/** إمساك القراءة بعد اكتمال كتابة المصطلح قبل بدء الخروج (الأمر 019، L1) */
export const TERM_HOLD = 2.0;
const EXIT_LEN: Record<string, number> = { turn: 1.0, fade: 0.8, none: 0 };
const firstWord = (s?: string) => (s ?? "").trim().split(/\s+/)[0] ?? "";
const letters = (s: string) => s.replace(/[\u064B-\u0652\u0670\u0640\s]/g, "").length;
/**
 * أقل مدة لمشهد lib-term: المصطلح يبقى مقروءًا TERM_HOLD ثانية بعد اكتمال كتابته ثم يبدأ الخروج.
 * لا يُقدَّم المصطلح عن كلمته: المشهد هو الذي يطول حين يكون المصطلح آخر السرد.
 */
export const termMinEnd = (p: Record<string, string | undefined>, tl: Timeline): number => {
  let a: number;
  try {
    const [w, n] = (p.termWord || firstWord(p.term)).split("#");
    a = at(tl, w!, Number(n) || 1);
  } catch {
    return 0;
  }
  const len = Math.min(1.4, 0.4 + 0.08 * letters(p.term ?? ""));
  return a + len + TERM_HOLD + (EXIT_LEN[p.exit ?? "fade"] ?? 0.8);
};

/** نسخة من SACRED_WORD في src/render/stillness.ts (يتحقق اختبار من تطابقهما) — لا يُستورد هناك حتى لا يدخل كود الرندر إلى المشاهد */
export const LIB_SACRED = /الله|لله|ربنا|ربه|ربك|سبحانه|تعالي|تعالى/;
