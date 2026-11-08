/**
 * معاينة صوتية لمشاهد مختارة من الحلقة (مثل اللقطات الست): بصوت الراوي الحقيقي والتلاوة الفعلية،
 * بجودة المعاينة، ثم تُرفع إلى «المعاينات» في الاستوديو مكان النسخة السابقة في خانتها.
 * لا تُصنع نسخة توحي بالاكتمال مع نقص: آية بلا نص أو بلا تلاوة، أو جملة بلا صوت مطابق لنصها،
 * فيُرفض الطلب بقائمة النواقص المحددة، ولا يُولَّد أي صوت بديل.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { loadPlan } from "../plan/io";
import { prepareRenderMedia } from "../plan/collect";
import { VERSE_PLACEHOLDER } from "../plan/quranText";
import { sceneFrames } from "../plan/duration";
import { resolveScriptPath } from "../script/episodes";
import type { Plan } from "../plan/types";
import type { EpisodeMedia } from "../plan/media";
import { renderEpisode } from "./episode";
import { putEpisodePreview, removePreview } from "./episodePreviews";

export type ShotGap = { id: string; what: string };

/** نواقص المشاهد المختارة قبل أي رندر */
export const shotGaps = (plan: Plan, media: EpisodeMedia, ids: string[], scriptPath: string, needsRecitation: boolean): ShotGap[] => {
  const scenes = new Map(plan.chapters.flatMap((c) => c.scenes).map((s) => [s.id, s]));
  const gaps: ShotGap[] = [];
  for (const id of ids) {
    const s = scenes.get(id);
    if (!s) {
      gaps.push({ id, what: "المشهد غير موجود في الخطة" });
      continue;
    }
    if (s.template === "verse-card") {
      if (!s.props.text?.trim() || s.props.text === VERSE_PLACEHOLDER) gaps.push({ id, what: `نص الآية ${s.ayahKey ?? ""} غير مرفق في السكريبت` });
      if (needsRecitation && (!s.ayahKey || !media.recitations[s.ayahKey])) gaps.push({ id, what: `التلاوة البشرية للآية ${s.ayahKey ?? ""} غير مرفوعة أو لم تُعتمد` });
    }
    if (s.narration.trim()) {
      const clip = media.voice[s.id];
      if (!clip) gaps.push({ id, what: "لا صوت للراوي (voice/)" });
      else if (clip.text !== s.narration.trim()) gaps.push({ id, what: "صوت الراوي لا يطابق النص الحالي؛ أعد توليده" });
      else if (!existsSync(path.join(path.dirname(scriptPath), "voice", clip.file))) gaps.push({ id, what: `ملف الصوت ${clip.file} مفقود` });
    }
  }
  return gaps;
};

/**
 * المعاينة الصوتية تحتوي التسجيل البشري الذي أرفقه المالك فقط، وتبقى على الجهاز دون رفعها إلى المستودع:
 * خانتها تنتهي بـ «-audio» وملفاتها مستثناة في .gitignore. وعند نجاحها تحل محل المعاينة الصامتة القديمة (replaces).
 */
export const renderShotsPreview = async (episode: string, ids: string[], opts: { slot: string; title: string; note?: string; replaces?: string; onProgress?: (p: number, m: string) => void; verifyBeforePublish?: () => Promise<void> }) => {
  if (!(/^[a-z0-9][a-z0-9_-]{0,70}-audio$/.test(opts.slot) || /^scene-[a-z0-9][a-z0-9-]{0,70}-av$/.test(opts.slot))) throw new Error("خانة معاينة AV غير آمنة.");
  const scriptPath = await resolveScriptPath(episode);
  const full = await loadPlan(episode);
  if (!full) throw new Error("لا توجد خطة للحلقة.");
  const plan: Plan = { ...full, chapters: full.chapters.map((c) => ({ ...c, scenes: c.scenes.filter((s) => ids.includes(s.id)) })).filter((c) => c.scenes.length) };
  const media = await prepareRenderMedia(episode, plan, { requireApprovedQuran: true });
  const gaps = shotGaps(plan, media, ids, scriptPath, true);
  if (gaps.length) {
    const e = new Error(`لم تُصنع المعاينة الصوتية لأن فيها نواقص:\n${gaps.map((g) => `- ${g.id}: ${g.what}`).join("\n")}`) as Error & { gaps: ShotGap[] };
    e.gaps = gaps;
    throw e;
  }
  const outFile = path.join(path.dirname(scriptPath), "out", `${opts.slot}-audio-preview.mp4`);
  const file = await renderEpisode({ episode, orientation: "landscape", quality: "preview",
    plan, media, outFile, onProgress: opts.onProgress,
    scenePreview: /^scene-[a-z0-9-]+-av$/.test(opts.slot),
  });
  const timing = plan.chapters.flatMap((c) => c.scenes).map((s) => ({ id: s.id, seconds: Math.round((sceneFrames(s, media) / 30) * 10) / 10, voice: media.voice[s.id]?.duration ?? null, recitation: s.ayahKey ? media.recitations[s.ayahKey]?.duration ?? null : null }));
  // A scene edited while Remotion was running must never publish its stale cut.
  await opts.verifyBeforePublish?.();
  const up = await putEpisodePreview(episode, opts.slot, file, { title: opts.title, note: opts.note });
  // نجحت النسخة الجديدة: لا تبقى المعاينة الصامتة القديمة معروضة بجوارها
  if (opts.replaces && opts.replaces !== opts.slot) await removePreview(scriptPath, opts.replaces);
  return { file: up.file, version: up.version, timing };
};
