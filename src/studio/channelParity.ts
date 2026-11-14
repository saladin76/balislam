/**
 * تطابق القنوات الثلاث في الاستوديو (طلب المالك ١٤ نوفمبر، D150): العقد الواحد لما يراه المالك في كل قناة.
 *
 * - الشاشات مكوّنات مشتركة واحدة؛ لا نسخة لكل قناة. ما يختلف بين القنوات يأتي من إعداد القناة (`channel.json`)
 *   بقاعدة معلنة هنا (`CHANNEL_EXCEPTIONS`)، وكل عنصر يغيب بقاعدة يُقال سببه في مكانه بسطر من هذا الملف.
 * - كل قراءة للقناة في شاشات المالك معلنة في `CHANNEL_READS`، و`tests/channel-parity.test.tsx` يفشل عند أي قراءة جديدة
 *   غير معلنة: فلا يظهر عنصر في قناة دون أخرى بلا قاعدة.
 * - المصفوفة الكاملة (عنصر × قناة) في `docs/studio/channel-parity.md`.
 *
 * نقي بلا ملفات، يُستعمل في الواجهة والاختبارات معًا.
 */
import type { ChannelConfig } from "../channel/types";
import { versesAreCitations } from "../quran/citation";
import { channelEngineFeatures } from "../plan/engine";

type Ch = Pick<ChannelConfig, "id" | "verse">;

/** شريط القرار في الخطوة ٢، من اليمين: العناصر نفسها بأسمائها وترتيبها في القنوات الثلاث (⏎ على «اعتمد المشهد»). */
export const DOCK_CONTROLS = [
  { id: "approve", label: "اعتمد المشهد" },
  { id: "motion", label: "الحركة غير مناسبة" },
  { id: "tone", label: "النبرة غير مناسبة" },
  /** «ولّد الصوت» قبل أول تسجيل، و«أعد توليد الصوت» بعده */
  { id: "voice", label: "أعد توليد الصوت" },
  /** قبل معاينة المشهد وحدها */
  { id: "render", label: "أنتج هذا المشهد" },
] as const;

/** لوحة المفاتيح في الخطوة ٢، واحدة لكل القنوات. */
export const DOCK_KEYS = { approve: "Enter", next: "ArrowLeft", previous: "ArrowRight", close: "Escape", sentencePlay: "Space" } as const;

/** عناصر الجملة في «الجمل» (تحت المشهد وفي «جمل الحلقة كلها»)، واحدة لكل القنوات. */
export const SENTENCE_CONTROLS = [
  { id: "play", label: "شغّل الجملة" },
  { id: "tone", label: "نبرة الجملة" },
  { id: "pause", label: "الوقفة بعد الجملة" },
  { id: "speed", label: "سرعة الجملة" },
  { id: "generate", label: "ولّد الجملة" },
  { id: "edit", label: "عدّل النص" },
  { id: "say", label: "ارجع إلى النطق الآلي" },
  { id: "split", label: "قسّم…" },
  { id: "merge", label: "ادمج مع التالية" },
  { id: "add", label: "أضف جملة بعدها" },
  { id: "restore", label: "ارجع إلى التسجيل السابق" },
  { id: "heard", label: "سمعتها" },
  { id: "delete", label: "احذف الجملة" },
  { id: "word-fix", label: "أعد نطق الكلمة" },
  { id: "old", label: "قديم — سُجّل على نص سابق" },
  { id: "pron-check", label: "تنبيه فقط، ولا يمنع الاعتماد" },
] as const;

/** الآية استشهاد مكتوب (D68/D100): السطر الواحد حيث تغيب خانة التلاوة. */
export const VERSE_CITATION_WHY =
  "الآيات في هذه القناة استشهاد مكتوب بلا تلاوة: تظهر بنصها ومرجعها صامتة، فلا رفع تلاوة ولا اعتماد لها، ولا يولَّد القرآن بالصوت المستنسخ أبدًا.";

/** أدوات المحرك معزولة لقناتها (CLAUDE.md): السطر حيث تغيب. لا يسمّي قناة أخرى ولا يحمل بصمتها. */
export const ENGINE_ISOLATED_WHY =
  "أدوات المحرك (الكاميرا المؤلَّفة والمشي الطبيعي والإضاءة والانتقالات ولقطات القصة) مبنية لقوالب قناة واحدة ومعزولة لها بقرار المالك، فلا تعمل في قوالب هذه القناة.";

export type ChannelException = {
  id: string;
  /** القرار أو القاعدة التي تجعله مختلفًا */
  rule: string;
  /** absent: عنصر يغيب في قنوات (وسطر السبب في مكانه)؛ content: العنصر نفسه في كل القنوات ونصه لقناته */
  kind: "absent" | "content";
  /** العناصر التي يمسها */
  controls: string[];
  /** هل يغيب العنصر في هذه القناة (absent وحده) */
  applies: (c: Ch) => boolean;
  /** ما يُقال للمالك */
  why: string;
};

export const CHANNEL_EXCEPTIONS: ChannelException[] = [
  {
    id: "verse-citation", rule: "D68/D100 (الآية استشهاد مكتوب، `verse.recitation: \"none\"`) مقابل D35 (تلاوة بشرية)", kind: "absent",
    controls: ["recitation-upload", "recitations-panel", "recitation-gate"], applies: (c) => versesAreCitations(c), why: VERSE_CITATION_WHY,
  },
  {
    id: "engine-tools", rule: "CLAUDE.md «أدوات المحرك دائمة ومعزولة لها» (`src/plan/engine.ts`، `channels`)", kind: "absent",
    controls: ["engine-panel", "scene-transition"], applies: (c) => channelEngineFeatures(c.id).length === 0, why: ENGINE_ISOLATED_WHY,
  },
  {
    id: "review-criteria", rule: "دستور كل قناة (`src/channel/productionRules.ts`، channel-production-policies.md)", kind: "content",
    controls: ["criteria-note"], applies: () => false, why: "«قبل أن تعتمد» في كل القنوات، ومعاييرها من دستور القناة نفسها.",
  },
  {
    id: "channel-examples", rule: "هوية كل قناة ومحتواها (أمثلة «حلقة جديدة»)", kind: "content",
    controls: ["new-episode-placeholders"], applies: () => false, why: "نافذة «حلقة جديدة» واحدة، وأمثلتها من موضوعات القناة.",
  },
  {
    id: "cast", rule: "أصوات الشخصيات من إعداد القناة (`cast`)", kind: "content",
    controls: ["scene-voice"], applies: () => false, why: "خانة «الصوت» في محرر المشهد في كل القنوات؛ وبلا أصوات شخصيات سطر «أضفها من «القناة»».",
  },
  {
    id: "review-docs", rule: "وثائق مراجعة حلقة بعينها (PDF الستوري بورد المرسل للمالك)", kind: "content",
    controls: ["board-review-pdf"], applies: () => false, why: "رابط PDF المراجعة يظهر للحلقة التي لها PDF، في أي قناة.",
  },
];

/** كل قراءة للقناة في شاشات المالك (الملف، والنص كما يطابقه الاختبار، والاستثناء الذي يبررها). */
export const CHANNEL_READS: { file: string; match: string; exception: string }[] = [
  { file: "app/src/App.tsx", match: "recitationStageNeeded(", exception: "verse-citation" },
  { file: "app/src/App.tsx", match: "useChannel(", exception: "channel-examples" },
  { file: "app/src/workspace/PreFinal.tsx", match: "useChannel(", exception: "verse-citation" },
  { file: "app/src/workspace/PreFinal.tsx", match: "versesAreCitations(", exception: "verse-citation" },
  { file: "app/src/workspace/sentences/useSentences.ts", match: "useChannel(", exception: "verse-citation" },
  { file: "app/src/workspace/sentences/useSentences.ts", match: "versesAreCitations(", exception: "verse-citation" },
  { file: "app/src/workspace/sceneProduction/SceneStep.tsx", match: "useChannel(", exception: "verse-citation" },
  { file: "app/src/workspace/sceneProduction/SceneStepParts.tsx", match: "useChannel(", exception: "verse-citation" },
  { file: "app/src/workspace/sceneProduction/useSceneProduction.ts", match: "channelProductionProfile(", exception: "review-criteria" },
  { file: "app/src/tabs/EpisodeTab.tsx", match: "engineEnabled(", exception: "engine-tools" },
  { file: "app/src/tabs/EpisodeTab.tsx", match: "channel.cast", exception: "cast" },
  { file: "app/src/tabs/ChannelBrand.tsx", match: "channelEngineFeatures(", exception: "engine-tools" },
  { file: "app/src/tabs/ChannelTab.tsx", match: "versesAreCitations(", exception: "verse-citation" },
];

export const isDeclaredRead = (file: string, match: string): boolean => CHANNEL_READS.some((r) => r.file === file && r.match === match);

/** لماذا يغيب هذا العنصر في هذه القناة (null: لا يغيب بقاعدة). */
export const absentWhy = (c: Ch, control: string): string | null =>
  CHANNEL_EXCEPTIONS.find((x) => x.kind === "absent" && x.controls.includes(control) && x.applies(c))?.why ?? null;

/**
 * مكان زر الصوت في الشريط حين لا صوت يولَّد للمشهد: سطر بالسبب بقاعدة القناة، لا اختفاء صامت.
 * null: للمشهد تعليق، فالزر في مكانه.
 */
export const dockVoiceAbsent = (c: Ch, scene: { template: string; narration: string } | null | undefined): string | null => {
  if (!scene || scene.narration.trim()) return null;
  if (scene.template === "verse-card") return versesAreCitations(c) ? "آية: استشهاد مكتوب صامت، بلا صوت ولا تلاوة" : "آية: لا تُولَّد بالصوت؛ تلاوتك تُرفع في الخطوة ٣";
  return "بلا تعليق صوتي: لا صوت لهذا المشهد";
};

/** سطر «جمل الحلقة كلها» في «أدوات وتفاصيل»: لا يَعِد برفع التلاوة في قناة الاستشهاد. */
export const allSentencesHint = (c: Ch): string =>
  versesAreCitations(c)
    ? `كل مشاهد الحلقة جملةً جملة بالترتيب، والآيات في مواضعها؛ وفيها قاموس النطق. ${VERSE_CITATION_WHY}`
    : "كل مشاهد الحلقة جملةً جملة بالترتيب، والآيات في مواضعها برفع التلاوة؛ وفيها قاموس النطق.";
