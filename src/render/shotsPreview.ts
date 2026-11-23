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
import { coldOpenIssues, coldOpenSource } from "../plan/coldOpen";
import type { EpisodeMedia } from "../plan/media";
import { renderEpisode } from "./episode";
import { scriptVersesAreCitations } from "../quran/citationChannel";
import { putEpisodePreview, removePreview } from "./episodePreviews";

export type ShotGap = { id: string; what: string };

/** نواقص المشاهد المختارة قبل أي رندر */
export const shotGaps = (plan: Plan, media: EpisodeMedia, ids: string[], scriptPath: string, needsRecitation: boolean): ShotGap[] => {
  const cited = scriptVersesAreCitations(scriptPath);
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
      // D68: in a channel whose verses are written citations the card is silent text; no recitation is ever asked.
      if (needsRecitation && !cited && (!s.ayahKey || !media.recitations[s.ayahKey])) gaps.push({ id, what: `التلاوة البشرية للآية ${s.ayahKey ?? ""} غير مرفوعة أو لم تُعتمد` });
    }
    if (s.narration.trim()) {
      const clip = media.voice[s.id];
      if (!clip) gaps.push({ id, what: "لا صوت للراوي (voice/)" });
      else if (clip.text !== s.narration.trim()) gaps.push({ id, what: "صوت الراوي لا يطابق النص الحالي؛ أعد توليده" });
      else if (!existsSync(path.join(path.dirname(scriptPath), "voice", clip.file))) gaps.push({ id, what: `ملف الصوت ${clip.file} مفقود` });
      else if (needsRecitation && clip.basmala?.pending) gaps.push({ id, what: "البسملة بلا تسجيلك المعتمد؛ ارفع التسجيل واعتمده" });
    }
  }
  return gaps;
};

/**
 * المعاينة الصوتية تحتوي التسجيل البشري الذي أرفقه المالك فقط، وتبقى على الجهاز دون رفعها إلى المستودع:
 * خانتها تنتهي بـ «-audio» وملفاتها مستثناة في .gitignore. وعند نجاحها تحل محل المعاينة الصامتة القديمة (replaces).
 */
export const renderShotsPreview = async (episode: string, ids: string[], opts: { slot: string; title: string; note?: string; replaces?: string; onProgress?: (p: number, m: string) => void; verifyBeforePublish?: () => Promise<void>;
  /**
   * Scene AV drafts only (owner decision, 8 Nov: recitations come last): a verse card whose human
   * recitation is not attached yet is rendered with its verse visible and SILENCE for the plan's
   * duration, marked on screen «التلاوة تُضاف لاحقًا». Never a Master; the final gates still require it.
   */
  allowPendingRecitation?: boolean }) => {
  if (!(/^[a-z0-9][a-z0-9_-]{0,70}-audio$/.test(opts.slot) || /^scene-[a-z0-9][a-z0-9-]{0,70}-av$/.test(opts.slot))) throw new Error("خانة معاينة AV غير آمنة.");
  const scriptPath = await resolveScriptPath(episode);
  const full = await loadPlan(episode);
  if (!full) throw new Error("لا توجد خطة للحلقة.");
  const sceneDraft = /^scene-[a-z0-9-]+-av$/.test(opts.slot);
  // A scene cut carries the channel intro only if it opens the episode: the assembly concatenates the cuts,
  // so it then holds one intro at the start exactly like the Master, not one per scene (funnel audit, D36).
  const opensEpisode = full.chapters[0]?.scenes[0]?.id === ids[0];
  // D198: the cold open lives in the same slot as the intro, so the first cut carries it too; its source scene
  // (later in the episode) is attached as a snapshot because the plan below keeps only the rendered scenes.
  const source = opensEpisode ? coldOpenSource(full) : null;
  const plan: Plan = { ...full, ...(sceneDraft && !opensEpisode ? { intro: false, coldOpen: undefined } : {}),
    ...(source ? { coldOpenSource: source } : {}),
    chapters: full.chapters.map((c) => ({ ...c, scenes: c.scenes.filter((s) => ids.includes(s.id)) })).filter((c) => c.scenes.length) };
  const draftMode = Boolean(opts.allowPendingRecitation && sceneDraft);
  // Only reviewed, owner-attached recordings are ever used; a draft simply leaves a missing one silent.
  // The cold open's source recording is collected with the rendered scenes (the same file, never a new one).
  // …and its page-turn sound (D158: a sound with the turn), collected like any scene's effect, never generated.
  const mediaPlan: Plan = source
    ? { ...plan, chapters: [...plan.chapters, { number: -1, title: "", scenes: [{ ...source, id: `${source.id}`, sfx: [...source.sfx, { id: "page-turn", at: 0 }] }] }] }
    : plan;
  const media = draftMode
    ? await prepareRenderMedia(episode, mediaPlan, { requireApprovedQuran: false })
    : await prepareRenderMedia(episode, mediaPlan, { requireApprovedQuran: true });
  const coldIssues = coldOpenIssues(plan, media.voice);
  if (coldIssues.length) throw new Error(coldIssues.join("\n"));
  // D68: a written-citation channel's verse card is the finished silent card, never marked «التلاوة تُضاف لاحقًا».
  const cited = scriptVersesAreCitations(scriptPath);
  const pendingRecitation = draftMode ? plan.chapters.flatMap((c) => c.scenes)
    .filter((s) => ids.includes(s.id) && ((s.template === "verse-card" && !cited && (!s.ayahKey || !media.recitations[s.ayahKey])) ||
      // The basmala composed as a silent placeholder until the owner's recording is approved (owner, 10 Nov).
      media.voice[s.id]?.basmala?.pending === true))
    .map((s) => s.id) : [];
  const gaps = shotGaps(plan, media, ids, scriptPath, !draftMode);
  if (gaps.length) {
    const e = new Error(`لم تُصنع المعاينة الصوتية لأن فيها نواقص:\n${gaps.map((g) => `- ${g.id}: ${g.what}`).join("\n")}`) as Error & { gaps: ShotGap[] };
    e.gaps = gaps;
    throw e;
  }
  const outFile = path.join(path.dirname(scriptPath), "out", `${opts.slot}-audio-preview.mp4`);
  const file = await renderEpisode({ episode, orientation: "landscape", quality: "preview",
    plan, media, outFile, onProgress: opts.onProgress,
    scenePreview: /^scene-[a-z0-9-]+-av$/.test(opts.slot),
    ...(pendingRecitation.length ? { draftMarks: { pendingRecitation } } : {}),
  });
  const timing = plan.chapters.flatMap((c) => c.scenes).map((s) => ({ id: s.id, seconds: Math.round((sceneFrames(s, media) / 30) * 10) / 10, voice: media.voice[s.id]?.duration ?? null, recitation: s.ayahKey ? media.recitations[s.ayahKey]?.duration ?? null : null }));
  // A scene edited while Remotion was running must never publish its stale cut.
  await opts.verifyBeforePublish?.();
  const up = await putEpisodePreview(episode, opts.slot, file, { title: opts.title, note: opts.note });
  // نجحت النسخة الجديدة: لا تبقى المعاينة الصامتة القديمة معروضة بجوارها
  if (opts.replaces && opts.replaces !== opts.slot) await removePreview(scriptPath, opts.replaces);
  return { file: up.file, version: up.version, timing, pendingRecitation };
};
