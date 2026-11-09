/**
 * «جهّز كل المشاهد»: one owner action that prepares an episode's scenes for back-to-back review.
 *
 *  1. Voice: narration for every narrated scene that lacks a current clip, through the existing
 *     generateVoice (tashkeel ≥ 98%, storyboard and tone gates, script+storyboard approval). Quran is
 *     never voiced: verse cards carry no narration and their recitation stays the owner's own recording.
 *  2. Render: AV preview DRAFTS for the current scene and every later unapproved, unsubmitted scene, in
 *     order, one at a time (same renderer and preview slot as «إنتاج المشهد»). A verse card whose human
 *     recitation is not attached yet does NOT stop the queue: it is drafted with its verse visible, silence
 *     for the plan's duration and a studio-only «التلاوة تُضاف لاحقًا» tag (recitations come last, D34).
 *
 * Nothing here submits or approves anything. A draft becomes reviewable only when its scene is current,
 * and approval stays strictly ordered, owner-authenticated and bound to the exact preview bytes.
 * Shared by the Studio server (background queue) and `bal produce` on the Mac.
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { resolveScriptPath } from "../script/episodes";
import { readPlanFile } from "../plan/io";
import { loadVoiceIndex, voiceDirFor, generateVoice } from "../voice/generate";
import type { ElevenLabsClient } from "../voice/elevenlabs";
import {
  assertSceneOwner, assertSceneRenderAllowed, inspectSceneProduction, recordSceneRenderEvidence,
  requireSceneProductionReady,
} from "./sceneService";

/** Narrated scenes whose clip is missing, for older text, or whose file is gone (read-only). */
export const scenesNeedingVoice = async (episode: string): Promise<string[]> => {
  const scriptPath = await resolveScriptPath(episode);
  const plan = await readPlanFile(scriptPath);
  if (!plan) return [];
  const voice = await loadVoiceIndex(episode);
  const dir = voiceDirFor(scriptPath);
  // Scenes voiced sentence by sentence (D50) are the owner's own work in «الجمل»; never regenerated whole here.
  const managed = await (await import("../voice/sentenceVoice")).sentenceManagedScenes(scriptPath);
  return plan.chapters.flatMap((c) => c.scenes).filter((s) => {
    const text = s.narration?.trim() ?? "";
    if (!text || s.template === "verse-card" || managed.has(s.id)) return false;
    const clip = voice[s.id];
    return !clip || clip.text !== text || path.basename(clip.file) !== clip.file || !existsSync(path.join(dir, clip.file));
  }).map((s) => s.id);
};

export type PrepareProgress = {
  phase: "voice" | "render" | "done";
  /** The scene being voiced/rendered right now. */
  sceneId?: string;
  voice: { needed: number; generated: number; status: "pending" | "done" | "no-key" | "error" | "none"; error?: string };
  rendered: string[];
  failed: { id: string; error: string; sourceSha256?: string }[];
  /** The owner stopped the queue; what finished before the stop is kept. */
  stopped?: boolean;
  /**
   * Scenes not rendered on purpose (audit item 5): `voice` — without a voice key (or after a voice
   * error) nothing past the first scene still waiting for its narration is drafted, since none of it can
   * be reviewed before that voice exists; `failed-before` — the same inputs already failed in the last
   * run, so the queue does not spend another render on them (the scene's own «إنتاج المشهد» retries).
   */
  skipped?: { id: string; reason: "voice" | "failed-before"; error?: string }[];
};

export type RenderSceneDraft = (episode: string, sceneId: string, sourceSha256: string) => Promise<void>;

/** The same render path as the single-scene route, in "ahead" mode (drafts only). */
export const renderSceneDraft: RenderSceneDraft = async (episode, sceneId, sourceSha256) => {
  await assertSceneRenderAllowed(episode, sceneId, sourceSha256, "ahead");
  const { renderShotsPreview } = await import("../render/shotsPreview");
  await renderShotsPreview(episode, [sceneId], {
    slot: `scene-${sceneId}-av`,
    title: `المشهد ${sceneId} — صوت وصورة (مسودة للمراجعة)`,
    note: "مسودة مُجهَّزة مسبقًا؛ غير معتمدة حتى يصل دورها ويشاهدها المالك ويقرر.",
    // A scene edited, submitted or approved while rendering never gets this cut published.
    verifyBeforePublish: () => assertSceneRenderAllowed(episode, sceneId, sourceSha256, "ahead"),
    // Recitations come last: a verse scene without one is drafted with a silent, marked placeholder.
    allowPendingRecitation: true,
  });
  await recordSceneRenderEvidence(episode, sceneId, sourceSha256, "ahead");
};

/** Scenes that still need a draft, in episode order, from the current scene on. */
export const scenesToRender = async (episode: string) => {
  const s = await inspectSceneProduction(episode);
  const from = s.scenes.findIndex((x) => x.id === s.progress.currentScene);
  if (from < 0) return { list: [] as { id: string; sourceSha256: string }[], blocked: [] as string[],
    beforeVoiceGap: [] as { id: string; sourceSha256: string }[] };
  const open = s.scenes.slice(from).filter((x) => (x.status === "queued" || x.status === "needs_revision") && x.draft !== "ready");
  const firstBlocked = open.findIndex((x) => !x.readyForAv);
  return {
    list: open.filter((x) => x.readyForAv).map((x) => ({ id: x.id, sourceSha256: x.sourceSha256 })),
    blocked: open.filter((x) => !x.readyForAv).map((x) => x.id),
    /** Drafts the owner can review before the first scene still waiting for its voice (in order). */
    beforeVoiceGap: (firstBlocked < 0 ? open : open.slice(0, firstBlocked)).map((x) => ({ id: x.id, sourceSha256: x.sourceSha256 })),
  };
};

/** A render-browser setup failure is environmental (network/browser), not the scene's: retried on the next press. */
export const environmentalFailure = (error: string) => /تعذّر تجهيز متصفح الرندر|ENOTFOUND|ECONNRESET|ETIMEDOUT/.test(error);

type QueueItem = { id: string; sourceSha256: string };
/**
 * Which drafts one pass renders (audit item 5, pure). Without a usable voice nothing past the first scene
 * still waiting for its narration is drafted; a scene whose same inputs failed last run (for a reason of
 * its own, not the network/browser) is skipped by the queue.
 */
export const pickRenderQueue = (queue: { list: QueueItem[]; beforeVoiceGap: QueueItem[] }, opts: {
  voiceMissing: boolean; previousFailures?: { id: string; error: string; sourceSha256?: string }[];
}) => {
  const allowed = opts.voiceMissing ? queue.beforeVoiceGap.filter((x) => queue.list.some((y) => y.id === x.id)) : queue.list;
  const kept = new Set(allowed.map((x) => x.id));
  const skipped: { id: string; reason: "voice" | "failed-before"; error?: string }[] =
    queue.list.filter((x) => !kept.has(x.id)).map((x) => ({ id: x.id, reason: "voice" as const }));
  const todo: QueueItem[] = [];
  for (const x of allowed) {
    const before = opts.previousFailures?.find((f) => f.id === x.id && f.sourceSha256 === x.sourceSha256);
    if (before && !environmentalFailure(before.error)) skipped.push({ id: x.id, reason: "failed-before", error: before.error });
    else todo.push(x);
  }
  return { todo, skipped };
};

export const prepareAllScenes = async (episode: string, opts: {
  /** null: no voice key configured; scenes that already have their voice are still rendered. */
  voiceClient: ElevenLabsClient | null;
  render?: RenderSceneDraft;
  onProgress?: (p: PrepareProgress) => void;
  /** Re-scan passes: a scene whose inputs change during the run is discarded and re-queued. */
  maxPasses?: number;
  /** «أوقف» (D36): checked between steps; the clip/render in progress finishes and is kept. */
  shouldStop?: () => boolean;
  /** The previous run's failures; the same scene with the same inputs is not rendered again by the queue. */
  previousFailures?: { id: string; error: string; sourceSha256?: string }[];
}): Promise<PrepareProgress> => {
  assertSceneOwner();
  await requireSceneProductionReady(episode);
  const render = opts.render ?? renderSceneDraft;
  const needed = await scenesNeedingVoice(episode);
  const p: PrepareProgress = {
    phase: "voice", voice: { needed: needed.length, generated: 0, status: needed.length ? "pending" : "none" },
    rendered: [], failed: [],
  };
  const emit = () => opts.onProgress?.({ ...p, voice: { ...p.voice }, rendered: [...p.rendered], failed: [...p.failed],
    ...(p.skipped ? { skipped: [...p.skipped] } : {}) });
  const skip = (id: string, reason: "voice" | "failed-before", error?: string) => {
    p.skipped = [...(p.skipped ?? []).filter((x) => x.id !== id), { id, reason, ...(error ? { error } : {}) }];
  };
  const stop = () => {
    if (!opts.shouldStop?.()) return false;
    p.stopped = true;
    return true;
  };
  emit();

  if (needed.length && !opts.voiceClient) p.voice.status = "no-key";
  else if (needed.length) {
    try {
      await generateVoice(episode, {
        client: opts.voiceClient, only: needed, shouldStop: opts.shouldStop,
        onProgress: (m) => {
          const id = m.match(/\)\s*([a-z0-9-]+):/)?.[1];
          if (id) { p.sceneId = id; emit(); }
        },
      });
      const still = new Set(await scenesNeedingVoice(episode));
      p.voice.generated = needed.filter((id) => !still.has(id)).length;
      p.voice.status = "done";
      stop();
    } catch (e) {
      p.voice.status = "error";
      p.voice.error = (e as Error).message;
    }
  }

  p.phase = "render";
  // Said before any render starts, so the owner sees the real blocker at once.
  const voiceMissing = p.voice.status === "no-key" || p.voice.status === "error";
  emit();
  const tried = new Map<string, string>(); // scene → inputs already attempted (no retry loop on failure)
  for (let pass = 0; pass < (opts.maxPasses ?? 4) && !p.stopped; pass++) {
    const picked = pickRenderQueue(await scenesToRender(episode), { voiceMissing, previousFailures: opts.previousFailures });
    for (const x of picked.skipped) skip(x.id, x.reason, x.error);
    const todo = picked.todo.filter((x) => tried.get(x.id) !== x.sourceSha256);
    if (!todo.length) break;
    for (const scene of todo) {
      if (stop()) break;
      tried.set(scene.id, scene.sourceSha256);
      p.sceneId = scene.id;
      emit();
      try {
        await render(episode, scene.id, scene.sourceSha256);
        p.failed = p.failed.filter((f) => f.id !== scene.id);
        if (!p.rendered.includes(scene.id)) p.rendered.push(scene.id);
      } catch (e) {
        p.failed = [...p.failed.filter((f) => f.id !== scene.id), { id: scene.id, error: (e as Error).message, sourceSha256: scene.sourceSha256 }];
      }
      emit();
    }
  }
  p.phase = "done";
  p.sceneId = undefined;
  emit();
  return p;
};
