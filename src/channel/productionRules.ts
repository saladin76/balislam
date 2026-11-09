/**
 * Studio V2: one production engine, separate editorial/art-direction rules.
 *
 * These are defaults for new work and quality review, NOT permission to change
 * an existing episode, approved identity, cited text or scene by automation.
 * The source of truth for channel permissions is channel.json; this module
 * interprets those permissions without loading another channel or using global
 * state. Creative/academic/religious judgment is always a human decision.
 */
import type { ChannelConfig } from "./types";
import type { Plan } from "../plan/types";

type ChannelRulesInput = { id: string; rules?: Partial<ChannelConfig["rules"]> };
export type ChannelPolicyIssue = {
  level: "error" | "warning";
  sceneId: string;
  code: "music-forbidden" | "quran-forbidden" | "hadith-forbidden" |
    "document-provenance" | "sacred-figure-visual";
  message: string;
};

/** These are *human* review prompts, not computer-generated attestations. */
export type ChannelProductionProfile = {
  channelId: string;
  editorial: string;
  visualDirection: string;
  audioDirection: string;
  reviewFocus: readonly string[];
  sourceChecks: readonly string[];
};

const PROFILES: Record<string, Omit<ChannelProductionProfile, "channelId" | "style">> = {
  "balislam": {
    editorial: "تفسير قضايا النفس والأسرة والمال من منظور إسلامي، بدليل موثق دون وعظ بصري زائد",
    visualDirection: "محراب النور، مشاهد مرسومة بلا وجوه؛ السكون المقصود حول الآيات والذكر",
    audioDirection: "سرد وقور هادئ؛ الآيات تسجيل بشري يرفعه المالك ولا يتلوها صوت الراوي",
    reviewFocus: [
      "دقة الاستشهاد بالقرآن والحديث مع مرجع معتمد ومراجعة مؤهلة عند الحاجة",
      "عدم تجسيد الوجوه أو وضع زخارف وكلمات مشتتة بجوار الآيات",
      "عدم إدخال موسيقى أو تحريك زخرفي عند مواضع توقير الذكر",
      "وضوح التطبيق العملي من غير تحميل النص ما لا يحتمل",
    ],
    sourceChecks: ["مراجع النص الشرعي", "التشكيل والنطق", "حقوق ملف التلاوة البشرية"],
  },
  "dafatir-alzaman": {
    editorial: "رواية تاريخية تربط التسلسل الزمني والأسباب والنتائج بالمصادر، وتفصل المؤكد عن إعادة البناء",
    visualDirection: "دفتر الأفق: وثائق وخرائط ومخطوطات وشخصيات تاريخية غير مقدسة",
    audioDirection: "راوٍ وثائقي، وقفات للأحداث والأسماء؛ تلاوة الآيات إن وُجدت من المالك فقط",
    reviewFocus: [
      "التمييز بين المصدر الأصلي والاستنتاج وإعادة البناء التخيلية",
      "دقة الزمن والمكان والحدود والملابس والأسماء والتواريخ",
      "عدم تمثيل الأنبياء والصحابة أو عرض مشهد متخيل على أنه صورة تاريخية أصلية",
      "توثيق مصدر الوثائق والصور الحقيقية وحقوق استخدامها",
    ],
    sourceChecks: ["مصادر الأحداث والتواريخ", "حقوق الصور والخرائط", "الاستشهادات الشرعية عند وجودها"],
  },
  "zubdat-alkutub": {
    editorial: "شرح أفكار الكتب بأمانة، مع فصل فكرة المؤلف عن التحليل أو النقد الخاص بالقناة",
    visualDirection: "القلم المميز: أحبار وأفكار مرسومة وتأكيد فسفوري بقدر المعنى، لا نقل لهوية قناة أخرى",
    audioDirection: "شرح واضح حيوي مع وقفات للفكرة والتطبيق؛ تلاوة بشرية مرفوعة إن وُجدت",
    reviewFocus: [
      "الكتاب والمؤلف والطبعة ورقم الصفحة للمقتبس أو الفكرة الجوهرية",
      "الفصل بين ملخص أمين للكتاب ورأي القناة وتحليلها",
      "عدم اقتباس نصوص مطولة أو إعادة رسم محتوى محمي دون إذن",
      "عدم إظهار رسمة عامة أو غير مناسبة بدل العنصر المطابق للفكرة",
    ],
    sourceChecks: ["بطاقة الكتاب وصفحاته", "حدود الاقتباس والحقوق", "التشكيل وسلامة أسماء الأعلام"],
  },
};

export const channelProductionProfile = (channel: ChannelRulesInput): ChannelProductionProfile => {
  const known = PROFILES[channel.id];
  return {
    channelId: channel.id,
    editorial: known?.editorial ?? "تحديد رسالة الحلقة والجمهور والمراجع قبل السكريبت",
    visualDirection: known?.visualDirection ?? "هوية القناة المعتمدة، مع عناصر تخدم الكلام فقط",
    audioDirection: known?.audioDirection ?? "صوت واضح، وملف تلاوة بشري يرفعه المالك عند الحاجة",
    reviewFocus: known?.reviewFocus ?? ["دقة المعلومات", "وضوح التصميم", "تماسك الصوت والصورة", "سلامة الحقوق"],
    sourceChecks: known?.sourceChecks ?? ["المصادر", "الحقوق", "أمانة النقل"],
  };
};

/**
 * Policy switches come from channel.json, never from the channel id:
 * - sacredFigures: explicit value wins; unset → on for every channel that does not forbid faces
 *   (a channel without faces cannot depict anyone, and a channel without rules gets the safe default).
 * - documentProvenance: explicit opt-in (dafatir-alzaman, and every new channel from createChannel).
 */
export const sacredFigureCheck = (channel: ChannelRulesInput): boolean =>
  typeof channel.rules?.sacredFigures === "boolean" ? channel.rules.sacredFigures : channel.rules?.faces !== false;
export const documentProvenanceCheck = (channel: ChannelRulesInput): boolean =>
  channel.rules?.documentProvenance === true;

const musicFileName = (sfxId: string): boolean =>
  /^(?:music|bgm|background-music|soundtrack|song|melody)(?:[-_]|$)/i.test(sfxId);

const sacredFigureReference = (value: string): boolean =>
  /(?:النبي|الرسول|صحاب[يية]|prophet|sahabi|companion-of-the-prophet)/i.test(value);

/**
 * Only checks facts actually representable in the plan.
 * A clear policy breach is an error; an unverifiable creative/source question
 * is a warning for the owner, never an invented automatic approval.
 */
export const channelProductionIssues = (
  plan: Plan, channel?: ChannelRulesInput,
): ChannelPolicyIssue[] => {
  if (!channel) return [];
  const issues: ChannelPolicyIssue[] = [];
  const provenance = documentProvenanceCheck(channel), sacred = sacredFigureCheck(channel);
  for (const chapter of plan.chapters) for (const scene of chapter.scenes) {
    if (channel.rules?.quran === false && scene.template === "verse-card") {
      issues.push({ level: "error", sceneId: scene.id, code: "quran-forbidden",
        message: "هذه القناة لا تسمح بإدراج بطاقات آيات في إعداداتها الحالية." });
    }
    if (channel.rules?.hadith === false && scene.template === "hadith-card") {
      issues.push({ level: "error", sceneId: scene.id, code: "hadith-forbidden",
        message: "هذه القناة لا تسمح بإدراج بطاقات أحاديث في إعداداتها الحالية." });
    }
    if (channel.rules?.music === false && (scene.sfx ?? []).some(effect => musicFileName(effect.id))) {
      issues.push({ level: "error", sceneId: scene.id, code: "music-forbidden",
        message: "الموسيقى ممنوعة في إعدادات هذه القناة؛ احذف المسار الموسيقي من المشهد." });
    }
    // An archival image may be original, licensed or generated. The machine
    // cannot know which; ask the owner for provenance rather than claiming it.
    if (provenance && scene.template === "doc-plate" &&
        scene.props.image?.trim() && !scene.props.credit?.trim()) {
      issues.push({ level: "warning", sceneId: scene.id, code: "document-provenance",
        message: "حدد في مراجعة المشهد إن كانت الصورة وثيقة تاريخية أم إعادة بناء؛ وثّق المصدر وحقوقه إن كانت وثيقة أصلية." });
    }
    if (sacred && Object.entries(scene.props).some(
      ([key, value]) => /^(?:figure|figure2|imagePrompt|characterPrompt)$/.test(key) &&
        sacredFigureReference(value ?? ""),
    )) {
      issues.push({ level: "error", sceneId: scene.id, code: "sacred-figure-visual",
        message: "وصف المشهد يتضمن تجسيدًا محتملًا لنبي أو صحابي؛ يُمنع التصوير حتى مراجعة صاحب القناة." });
    }
  }
  return issues;
};
