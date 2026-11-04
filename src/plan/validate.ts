import { hasElement } from "../../brand/elements/registry";
import { parsePoseTimeline } from "./director";
import type { Plan } from "./types";
import { langPack, langPacks } from "../i18n/packs";
import { isCuratedBeat, isDrawable, needsElement, parseBeats } from "./beats";
import { elementExclusion, excludeReasonAr, figuresAllowed, setExclusion, templateExclusion, type LibraryRules } from "../channel/library";

export type PlanIssue = { level: "error" | "warning"; sceneId: string; message: string };

/**
 * فحص الخطة قبل الرندر النهائي: ما لا يجوز نشره (حديث بلا نص، آية بنص مؤقت)
 * وما يستحق التنبيه (عنصر غير موجود في المكتبة).
 */
/** بداية رسالة «عنصر مطلوب» (يجمعها الاستوديو قائمةً لتوسيع المكتبة) */
export const NEEDS_ELEMENT = "لحظات بلا عنصر مطابق";

export const planIssues = (plan: Plan, channel?: LibraryRules | { id: string; rules?: Partial<LibraryRules["rules"]>; library?: LibraryRules["library"] }): PlanIssue[] => {
  const out: PlanIssue[] = [];
  // مكتبة القناة: ما ليس منها خطأ يمنع النسخة النهائية (لا خلط بين القنوات)
  const lib: LibraryRules | null = channel?.rules ? { id: channel.id, rules: { faces: Boolean(channel.rules.faces), quran: Boolean(channel.rules.quran), hadith: Boolean(channel.rules.hadith) }, library: channel.library } : null;
  const notOurs = (sceneId: string, what: string, why: keyof typeof excludeReasonAr | null) => {
    if (lib && why) out.push({ level: "error", sceneId, message: `${what} ليس من مكتبة هذه القناة (${excludeReasonAr[why]}).` });
  };
  if (plan.lang && langPacks[plan.lang] && !langPack(plan.lang).ready)
    out.push({ level: "error", sceneId: "-", message: `لغة «${langPack(plan.lang).nameAr}» في مرحلة التجهيز: تخطيط القوالب من اليسار لليمين لم يُفعَّل بعد، فلا تخرج منها نسخة نهائية.` });
  for (const ch of plan.chapters)
    for (const s of ch.scenes) {
      const p = s.props;
      if (lib) {
        notOurs(s.id, `القالب «${s.template}»`, templateExclusion(lib, s.template));
        if (p.set) notOurs(s.id, `المكان «${p.set}»`, setExclusion(lib, p.set));
        if ((p.figure || p.figure2) && !figuresAllowed(lib)) notOurs(s.id, "الشخصية التاريخية بملامح", "faces");
        for (const k of ["element", "rightElement", "leftElement", "secondElement"]) if (p[k]) notOurs(s.id, `العنصر «${p[k]}»`, elementExclusion(lib, p[k]!));
        if (s.backdrop) notOurs(s.id, `الخلفية «${s.backdrop}»`, elementExclusion(lib, s.backdrop));
        for (const b of parseBeats(p.beats ?? "")) if (!b.draw.startsWith("person") && b.draw !== "people") notOurs(s.id, `رسمة «${b.draw}»`, elementExclusion(lib, b.draw));
      }
      if (s.template === "alley-tale" && plan.channel === "balislam") {
        if (p.cameraMode && p.cameraMode !== "automatic" && p.cameraMode !== "directed")
          out.push({ level: "error", sceneId: s.id, message: "وضع الكاميرا غير معروف؛ استخدم automatic أو directed." });
        if (p.cameraMode === "directed" && p.camera && !["still", "push", "track", "rise", "drift"].includes(p.camera))
          out.push({ level: "error", sceneId: s.id, message: "حركة كاميرا غير مدعومة في وضع الإخراج اليدوي." });
        if (p.poseTimeline) {
          const allowed = new Set(["stand", "think", "sit", "sit-low", "head-down", "hold", "cross", "point", "look-up", "nod", "turn-away", "walk", "proud", "apologize", "listen", "talk"]);
          const parsed = parsePoseTimeline(p.poseTimeline);
          const lines = p.poseTimeline.split("\n").map((x) => x.trim()).filter(Boolean);
          if (parsed.length !== lines.length || parsed.some((x) => !allowed.has(x.pose)))
            out.push({ level: "error", sceneId: s.id, message: "الخط الزمني للوضعيات غير صالح؛ اكتب: رقم_الإطار | الوضعية، سطرًا لكل حدث." });
        }
      }
      if (s.template === "hadith-card" && !p.text?.trim()) out.push({ level: "error", sceneId: s.id, message: `بطاقة الحديث «${p.reference ?? ""}» بلا نص.` });
      if (s.template === "verse-card" && (!p.text?.trim() || p.text.startsWith("‹")))
        out.push({ level: "error", sceneId: s.id, message: `بطاقة الآية «${p.reference ?? ""}» بنص مؤقت؛ اجلب نصوص الآيات (زر «اجلب نصوص الآيات» في الاستوديو أو الأمر bal quran) بعد إضافة مفاتيح Quran Foundation.` });
      for (const k of ["element", "rightElement", "leftElement", "secondElement"])
        if (p[k] && !hasElement(p[k]!)) out.push({ level: "warning", sceneId: s.id, message: `العنصر «${p[k]}» غير موجود في المكتبة.` });
      // نصوص أطول من مساحة القالب: تُصغَّر تلقائيًا، لكن الأوضح تقصيرها
      const wc = (x?: string) => (x ?? "").split(/\s+/).filter(Boolean).length;
      if (s.template === "big-question" && wc(p.question) > 14) out.push({ level: "warning", sceneId: s.id, message: `السؤال طويل (${wc(p.question)} كلمة)؛ الأوضح ألا يزيد على 12 كلمة.` });
      if (s.template === "character-talk" && wc(p.line) > 14) out.push({ level: "warning", sceneId: s.id, message: `جملة الفقاعة طويلة (${wc(p.line)} كلمة)؛ الأوضح ألا تزيد على 10 كلمات.` });
      if (s.template === "hadith-card" && (p.text ?? "").length > 320) out.push({ level: "warning", sceneId: s.id, message: "نص الحديث طويل وسيُعرض بخط صغير؛ يمكن الاكتفاء بموضع الشاهد مع ذكر المصدر." });
      if (s.template === "board-story" || s.template === "motion-story")
        for (const b of parseBeats(p.beats ?? "")) {
          // لقطة بلا رسمة (الكلمة وحدها) مقصودة: «عند الشك لا تُرسم»، وبجوار ذكر الله
          if (needsElement(b)) continue;
          else if (!isDrawable(b.draw)) out.push({ level: "warning", sceneId: s.id, message: `رسمة «${b.draw}» غير موجودة في المكتبة؛ اختر معرّفًا من «المكتبة» أو person/people.` });
          // قاعدة القناة: لا عنصر لا يطابق الكلمة. الرسمة المختارة آليًا (لا من قائمة المعاني المراجَعة) تحتاج مراجعة صريحة
          else if (!isCuratedBeat(b) && !s.edited) out.push({ level: "warning", sceneId: s.id, message: `رسمة «${b.draw}» للكلمة «${b.label}» اختيرت آليًا؛ تأكد أنها تطابق المعنى أو غيّرها (أي تعديل يدوي للمشهد يعتمدها).` });
        }
      // القاعدة: لا عنصر قريب ولا عام بديل. اللحظة التي لا يطابق معناها عنصر في مكتبة القناة تظهر بكلمتها وحدها،
      // وتُجمع هنا طلبًا: إن كان للمعنى رسمة تخدمه يُصمَّم عنصر جديد بهوية القناة ويُضاف للمكتبة وقائمة المعاني
      if (s.template === "board-story" || s.template === "motion-story") {
        const empty = parseBeats(p.beats ?? "").filter(needsElement).map((b) => `«${b.label}»`);
        if (empty.length) out.push({ level: "warning", sceneId: s.id, message: `${NEEDS_ELEMENT}: ${empty.join("، ")} — تظهر الكلمة بلا رسمة. إن كان للمعنى رسمة تخدمه فصمّم عنصرًا جديدًا بهوية القناة وأضفه لمكتبتها وقائمة المعاني؛ ولا تضع عنصرًا قريبًا أو عامًّا.` });
      }
      if (s.template === "doc-plate" && !p.image?.trim())
        out.push({ level: "error", sceneId: s.id, message: "لوحة وثائقية بلا صورة: ولّد الصورة من الوصف وارفعها من إعدادات المشهد." });
      if (s.backdrop && !hasElement(s.backdrop)) out.push({ level: "warning", sceneId: s.id, message: `الخلفية «${s.backdrop}» غير موجودة.` });
    }
  return out;
};
