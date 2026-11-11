/**
 * «أعد توليد ما وُلّد بالنبرة القوية» (بعد إلغاء قرار النبرات القوية D70 بطلب صاحب القناة ١١ نوفمبر).
 *
 * عادت النبرات كما كانت (الإصدار ١ في src/voice/tones.ts)، ولا يُعاد أي تسجيل آليًا: ما وُلّد بالنبرة القوية
 * المُلغاة (الإصدار ٢) صالح بإصداره ويظهر عليه «وُلّدت بالنبرة القوية (المُلغاة)». هذا الأمر وحده يعيده بالإعدادات
 * الحالية (كما قبل D70)، بضغطة المالك الصريحة بعد أن يرى عدد الجمل والمشاهد والحروف (رصيد مدفوع). البوابات كلها
 * كما هي (التشكيل، الاعتمادات، النبرة، القرآن، قفل الصوت)، والتسجيل السابق يبقى في takes وvoice/superseded/ ولا يُحذف.
 */
import config from "../../config.json";
import type { ElevenLabsClient } from "./elevenlabs";
import { generateVoice } from "./generate";
import { readSentences, sentenceAction, type SentenceActionOptions } from "./sentenceVoice";

export type ToneUpgradePlan = {
  /** جمل تسجيلها بالنبرة القوية المُلغاة (مسار الجمل) */
  sentences: { id: string; sceneId: string; chars: number }[];
  /** مشاهد أو أجزاء صوتها ملف واحد بالنبرة القوية المُلغاة (المسار العام أو أجزاء خريطة النبرة) */
  sceneJobs: { ids: string[]; scenes: string[]; chars: number };
  /** كل المشاهد المتأثرة */
  scenes: string[];
  chars: number;
  credits: number;
};

export const toneUpgradePlan = async (episode: string): Promise<ToneUpgradePlan> => {
  const read = await readSentences(episode);
  const sentences = read.scenes.flatMap((sc) => sc.rows.filter((r) => r.kind === "narration" && r.olderTone).map((r) => ({ id: r.id, sceneId: sc.id, chars: r.chars })));
  const report = await generateVoice(episode, { dryRun: true });
  const sceneJobs = report.olderTone;
  const scenes = [...new Set([...sentences.map((s) => s.sceneId), ...sceneJobs.scenes])];
  const chars = sentences.reduce((n, s) => n + s.chars, 0) + sceneJobs.chars;
  return { sentences, sceneJobs, scenes, chars, credits: Math.ceil(chars * config.voice.creditsPerChar) };
};

export type ToneUpgradeResult = { plan: ToneUpgradePlan; sentences: number; sceneJobs: number; errors: { id: string; error: string }[]; stopped: boolean };

export const upgradeTones = async (episode: string, opts: { client: ElevenLabsClient | null; shouldStop?: () => boolean } & Pick<SentenceActionOptions, "testOnlySkipApprovalGates">):
  Promise<ToneUpgradeResult> => {
  if (!opts.client) throw new Error("مفاتيح ElevenLabs غير موجودة. أضف المفتاح واختر الصوت من تبويب «الإعدادات» في الاستوديو.");
  const plan = await toneUpgradePlan(episode);
  const out: ToneUpgradeResult = { plan, sentences: 0, sceneJobs: 0, errors: [], stopped: false };
  for (const s of plan.sentences) {
    if (opts.shouldStop?.()) { out.stopped = true; return out; }
    try {
      await sentenceAction(episode, { action: "generate", id: s.id }, { client: opts.client, testOnlySkipApprovalGates: opts.testOnlySkipApprovalGates });
      out.sentences++;
    } catch (e) {
      out.errors.push({ id: s.id, error: (e as Error).message });
    }
  }
  if (plan.sceneJobs.scenes.length) {
    const r = await generateVoice(episode, { client: opts.client, upgradeTone: true, only: plan.sceneJobs.scenes, shouldStop: opts.shouldStop,
      testOnlySkipGates: opts.testOnlySkipApprovalGates });
    out.sceneJobs = r.toGenerate.length;
  }
  return out;
};
