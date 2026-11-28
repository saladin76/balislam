import { engineEnabled } from "./engine";
import { channelProductionIssues } from "../channel/productionRules";
import { hasElement } from "../../brand/elements/registry";
import { parseCameraPlan, parseCameraPlanLines, parsePoseTimeline } from "./director";
import { lightingIssues } from "./lighting";
import { transitionIssues } from "./transitions";
import type { Plan } from "./types";
import { shotWordPlanIssues } from "./shotWords";
import { silentQuoteScenes } from "./silentQuotes";
import { characterPolicyIssues } from "./characterPolicy";
import { langPack, langPacks } from "../i18n/packs";
import { isCuratedBeat, isDrawable, needsElement, parseBeats } from "./beats";
import { elementExclusion, excludeReasonAr, figuresAllowed, setExclusion, templateExclusion, type LibraryRules } from "../channel/library";

export type PlanIssue = {
  level: "error" | "warning"; sceneId: string; message: string;
  /**
   * KI-054: an error the final file refuses that is known from the plan itself (a plate with no picture, something not
   * in the channel's library). `earlyPlanErrors` says it in step ١ «قبل أن تعتمد», per scene. No gate reads this field.
   */
  early?: true;
};

/**
 * فحص الخطة قبل الرندر النهائي: ما لا يجوز نشره (حديث بلا نص، آية بنص مؤقت)
 * وما يستحق التنبيه (عنصر غير موجود في المكتبة).
 */
/** بداية رسالة «عنصر مطلوب» (يجمعها الاستوديو قائمةً لتوسيع المكتبة) */
export const NEEDS_ELEMENT = "لحظات بلا عنصر مطابق";

export const planIssues = (plan: Plan, channel?: LibraryRules | { id: string; rules?: Partial<LibraryRules["rules"]> & { music?: boolean }; library?: LibraryRules["library"] }): PlanIssue[] => {
  const out: PlanIssue[] = [];
  // مكتبة القناة: ما ليس منها خطأ يمنع النسخة النهائية (لا خلط بين القنوات)
  const lib: LibraryRules | null = channel?.rules ? { id: channel.id, rules: { faces: Boolean(channel.rules.faces), quran: Boolean(channel.rules.quran), hadith: Boolean(channel.rules.hadith) }, library: channel.library } : null;
  const notOurs = (sceneId: string, what: string, why: keyof typeof excludeReasonAr | null) => {
    if (lib && why) out.push({ level: "error", sceneId, message: `${what} ليس من مكتبة هذه القناة (${excludeReasonAr[why]}).`, early: true });
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
      // الإضاءة (الأمر 009): يُرفض كل إعداد لا ينفذه القالب، بدل قبوله بصمت
      for (const i of lightingIssues(s.template, p)) out.push({ level: i.level, sceneId: s.id, message: i.message });
      // الانتقال (الأمر 011): من المشهد السابق في الفصل نفسه، ويُرفض ما لا ينفذه المحرك أو لا يليق بالمشهد
      {
        const idx = ch.scenes.indexOf(s);
        if (s.transition?.trim() && !engineEnabled("transitions", plan.channel))
          out.push({ level: "error", sceneId: s.id, message: "الانتقالات غير مفعّلة لهذه القناة؛ احذف حقل الانتقال." });
        else for (const i of transitionIssues(s, idx > 0 ? ch.scenes[idx - 1] : undefined)) out.push({ level: i.level, sceneId: s.id, message: i.message });
      }
      if (s.template === "road-journey") {
        if (p.motion && !["legacy", "natural"].includes(p.motion))
          out.push({ level: "error", sceneId: s.id, message: "حركة المسافر غير معروفة؛ استخدم legacy أو natural." });
        if (p.gait && !["stroll", "walk", "brisk", "heavy"].includes(p.gait))
          out.push({ level: "error", sceneId: s.id, message: "المشية غير معروفة؛ استخدم heavy أو stroll أو walk أو brisk." });
        if (p.gait && p.motion !== "natural")
          out.push({ level: "warning", sceneId: s.id, message: "المشية لا تعمل في «الطريق» إلا مع motion = natural." });
      }
      if (s.template === "light-stage") {
        if (p.motion && !["legacy", "natural"].includes(p.motion))
          out.push({ level: "error", sceneId: s.id, message: "حركة البطل غير معروفة؛ استخدم legacy أو natural." });
        if (p.gait && !["stroll", "walk", "brisk", "heavy"].includes(p.gait))
          out.push({ level: "error", sceneId: s.id, message: "المشية غير معروفة؛ استخدم heavy أو stroll أو walk أو brisk." });
        if (p.gait && p.motion !== "natural")
          out.push({ level: "warning", sceneId: s.id, message: "المشية لا تعمل في «ظل ونور» إلا مع motion = natural." });
        if (p.motion === "natural" && /sit|head-down/.test(p.poses ?? ""))
          out.push({ level: "warning", sceneId: s.id, message: "البطل جالس في هذا المشهد، فالحركة الطبيعية لا أثر لها هنا." });
      }
      if (s.template === "alley-tale" && plan.channel === "balislam") {
        if (p.cameraMode && !["automatic", "directed", "composed"].includes(p.cameraMode))
          out.push({ level: "error", sceneId: s.id, message: "وضع الكاميرا غير معروف؛ استخدم automatic أو directed أو composed." });
        if (p.gait && !["stroll", "walk", "brisk", "heavy"].includes(p.gait))
          out.push({ level: "error", sceneId: s.id, message: "المشية غير معروفة؛ استخدم heavy أو stroll أو walk أو brisk." });
        if (p.gait && p.cameraMode !== "composed")
          out.push({ level: "warning", sceneId: s.id, message: "المشية لا تعمل إلا في وضع الكاميرا composed." });
        if (p.framing && p.framing !== "fit")
          out.push({ level: "error", sceneId: s.id, message: "التأطير غير معروف؛ اتركه فارغًا (القائم) أو fit." });
        if (p.framing === "fit" && p.cameraMode !== "composed")
          out.push({ level: "error", sceneId: s.id, message: "التأطير المحتوي (framing = fit) يعمل مع الكاميرا المؤلَّفة فقط (cameraMode = composed)." });
        if (p.framing === "fit" && p.shot)
          out.push({ level: "warning", sceneId: s.id, message: "اللقطة المصمَّمة لها تأطيرها؛ framing لا أثر له فيها." });
        if (p.framing !== "fit" && [p.cameraPlan, p.cameraPlanPortrait].some((x) => parseCameraPlan(x).some((b) => b.target === "other")))
          out.push({ level: "error", sceneId: s.id, message: "الهدف other في خطة الكاميرا يعمل مع التأطير المحتوي فقط (framing = fit)." });
        for (const plan of [p.cameraPlan, p.cameraPlanPortrait].filter(Boolean)) {
          const lines = parseCameraPlanLines(plan);
          if (lines.some((x) => x === null))
            out.push({ level: "error", sceneId: s.id, message: "خطة الكاميرا غير صالحة؛ اكتب «ثابت» وحدها، أو سطرًا لكل حركة: الكلمة (ويجوز +إطارات أو -إطارات) أو رقم الإطار | wide أو medium أو close ثم الهدف (hero، pair، door، board، center) ثم مدة اختيارية بالإطارات (12–300)." });
          if (p.cameraMode !== "composed")
            out.push({ level: "warning", sceneId: s.id, message: "خطة الكاميرا لا تعمل إلا في وضع composed." });
        }
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
        out.push({ level: "error", sceneId: s.id, message: `بطاقة الآية «${p.reference ?? ""}» بنص مؤقت؛ أضف نص الآية الصحيح إلى السكريبت وراجعه ثم أعد إعداد المشهد.` });
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
        out.push({ level: "error", sceneId: s.id, message: "لوحة وثائقية بلا صورة: ولّد الصورة من الوصف وارفعها من إعدادات المشهد.", early: true });
      if (s.backdrop && !hasElement(s.backdrop)) out.push({ level: "warning", sceneId: s.id, message: `الخلفية «${s.backdrop}» غير موجودة.` });
    }
  // D242: «دفاتر الزمن» بلا مشهد آية أو حديث صامت (النص داخل لقطة «خط الأفق» المجاورة كما في 001)
  for (const x of silentQuoteScenes(plan, plan.channel ?? channel?.id)) out.push({ level: "error", sceneId: x.sceneId, message: x.message, early: true });
  // D248: شخصيات «بالإسلام» بضوابطها الخمس (src/plan/characterPolicy.ts)؛ الخطأ مبكر في الخطوة ١
  for (const x of characterPolicyIssues(plan, plan.channel ?? channel?.id))
    out.push({ level: x.level, sceneId: x.sceneId, message: x.message, ...(x.level === "error" ? { early: true as const } : {}) });
  // Isolated policy review: never infer an approval from a creative heuristic.
  out.push(...channelProductionIssues(plan, channel));
  // اللقطات المصمَّمة على نص سابق (D-5، M4): تنبيه واضح، والقالب يعرض الكلمات وحدها بدل الرسم الخاطئ
  out.push(...shotWordPlanIssues(plan, (channel as { name?: string } | undefined)?.name));
  return out;
};

/**
 * KI-054 (D121): the plan errors that stop «اصنع النسخة النهائية» and are known from the plan from the start, per
 * scene, for step ١ «قبل أن تعتمد» and the preparation read. The same issues as `planIssues` (nothing is added or
 * removed there): the Master gate still refuses them exactly as before; here they are only said earlier.
 */
export const earlyPlanErrors = (plan: Plan, channel?: Parameters<typeof planIssues>[1]): { scene: string; message: string }[] =>
  planIssues(plan, channel).filter((i) => i.level === "error" && i.early && i.sceneId !== "-").map((i) => ({ scene: i.sceneId, message: i.message }));
