/**
 * «جهّز كل المشاهد»: one owner action that prepares an episode's scenes for back-to-back review.
 *
 *  1. Voice: narration for every narrated scene that lacks a current clip, through the existing
 *     generateVoice (tashkeel ≥ 98%, storyboard and tone gates, script+storyboard approval). Quran is
 *     never voiced: verse cards carry no narration and their recitation stays the owner's own recording.
 *  2. Render: AV preview DRAFTS for every unapproved, unsubmitted scene (any order is reviewable, D145), in
 *     episode order, one at a time (same renderer and preview slot as «إنتاج المشهد»). A verse card whose human
 *     recitation is not attached yet does NOT stop the queue: it is drafted with its verse visible, silence
 *     for the plan's duration and a studio-only «التلاوة تُضاف لاحقًا» tag (recitations come last, D34).
 *
 * Nothing here submits or approves anything. A ready draft is reviewable at once, in any order (D145); approval stays
 * owner-authenticated and bound to the exact preview bytes. With `renderOnly` («أنتج كل المشاهد الجاهزة») step 1 is skipped.
 * Shared by the Studio server (background queue) and `bal produce` on the Mac.
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { resolveScriptPath } from "../script/episodes";
import { readPlanFile } from "../plan/io";
import { loadVoiceIndex, voiceDirFor, generateVoice } from "../voice/generate";
import type { ElevenLabsClient } from "../voice/elevenlabs";
import { ownerText as nameSceneIds } from "../i18n/sceneNames";
import {
  assertSceneOwner, assertSceneNotAwaitingChange, assertSceneRenderAllowed, inspectSceneProduction, recordSceneRenderEvidence,
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
   * Scenes not rendered on purpose, each with its real reason (audit item 5; QA 12 Nov, balislam 9 / zubdat D-7):
   * - `voice`: the scene's narration voice is missing or for older text, and it cannot be made now (no key, or the
   *   voice phase failed);
   * - `sentences`: a scene voiced sentence by sentence (D50) with sentences whose voice is not current; they are made
   *   in «الجمل», never regenerated whole here;
   * - `after-gap`: no longer produced (D145: a ready scene after one still waiting for its voice is drafted and
   *   reviewable at once); kept in the type so an older job read still parses;
   * - `blocked`: producing it waits for a fix (a verse without its text, a script error, text that differs from the
   *   script; `error` says which);
   * - `failed-before`: the same inputs already failed in the last run (the scene's own «إنتاج المشهد» retries).
   */
  skipped?: PrepareSkip[];
};
export type PrepareSkipReason = "voice" | "sentences" | "after-gap" | "blocked" | "failed-before";
export type PrepareSkip = { id: string; reason: PrepareSkipReason; error?: string; sourceSha256?: string; gap?: string };

export type RenderSceneDraft = (episode: string, sceneId: string, sourceSha256: string) => Promise<void>;

/** The same render path as the single-scene route, in "ahead" mode (drafts only). */
export const renderSceneDraft: RenderSceneDraft = async (episode, sceneId, sourceSha256) => {
  await assertSceneRenderAllowed(episode, sceneId, sourceSha256, "ahead");
  await assertSceneNotAwaitingChange(episode, sceneId);
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

/** Scenes that still need a draft, in episode order, ALL of them (D145: any scene is reviewed in any order). */
export const scenesToRender = async (episode: string) => {
  const s = await inspectSceneProduction(episode);
  // M4: a scene sent back for a fix is not re-rendered from the same inputs (it waits for a change).
  const open = s.scenes.filter((x) => (x.status === "queued" || x.status === "needs_revision") && x.draft !== "ready" &&
    !(x as { awaitingChange?: boolean }).awaitingChange);
  // A scene whose production waits for a fix (verse without text, script error, text ≠ script) is said, not rendered.
  const why = (x: (typeof open)[number]) => [...((x as { blocked?: string[] }).blocked ?? []), ...(s.episodeBlocked ?? [])];
  const held: PrepareSkip[] = open.filter((x) => why(x).length).map((x) => ({ id: x.id, reason: "blocked" as const, error: why(x).join(" — "), sourceSha256: x.sourceSha256 }));
  const producible = open.filter((x) => !why(x).length);
  const firstBlocked = producible.findIndex((x) => !x.readyForAv);
  return {
    list: producible.filter((x) => x.readyForAv).map((x) => ({ id: x.id, sourceSha256: x.sourceSha256 })),
    blocked: producible.filter((x) => !x.readyForAv).map((x) => x.id),
    /** Drafts the owner can review before the first scene still waiting for its voice (in order). */
    beforeVoiceGap: (firstBlocked < 0 ? producible : producible.slice(0, firstBlocked)).map((x) => ({ id: x.id, sourceSha256: x.sourceSha256 })),
    held,
    /** The first scene still waiting for its voice (nothing after it is drafted while voice is missing). */
    gap: firstBlocked < 0 ? undefined : producible[firstBlocked]!.id,
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
export const pickRenderQueue = (queue: { list: QueueItem[]; beforeVoiceGap?: QueueItem[]; gap?: string }, opts: {
  /** Kept for callers; no longer holds anything back (D145: a scene after one still waiting for its voice is reviewable now). */
  voiceMissing?: boolean; previousFailures?: { id: string; error: string; sourceSha256?: string }[];
}) => {
  // Every ready scene is drafted, whatever comes before it: scenes are reviewed and approved in any order (D145).
  const skipped: PrepareSkip[] = [];
  const todo: QueueItem[] = [];
  for (const x of queue.list) {
    const before = opts.previousFailures?.find((f) => f.id === x.id && f.sourceSha256 === x.sourceSha256);
    if (before && !environmentalFailure(before.error)) skipped.push({ id: x.id, reason: "failed-before", error: before.error, sourceSha256: x.sourceSha256 });
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
  /**
   * «أعد إنتاج المشاهد المتأثرة» (سرعة الإلقاء): drafts only. No voice step at all (no request, not even the basmala
   * scenes), whatever key is configured: the paced copies were already made from the existing takes.
   * «أنتج كل المشاهد الجاهزة» (D145): free renders only. No voice of any kind is generated (no paid call, whatever
   * key is configured): only scenes whose takes already exist are drafted; the others are said as waiting for voice.
   */
  renderOnly?: boolean;
}): Promise<PrepareProgress> => {
  assertSceneOwner();
  await requireSceneProductionReady(episode);
  // QA dafatir M3: voice/ is git-ignored, so a fresh clone or a new episode has none; every voice step needs it.
  await mkdir(voiceDirFor(await resolveScriptPath(episode)), { recursive: true });
  const render = opts.render ?? renderSceneDraft;
  // A scene whose production waits for a fix is not voiced either (its voice gate would refuse the whole batch).
  const waitingFix = new Set((await inspectSceneProduction(episode)).scenes
    .filter((x) => ((x as { blocked?: string[] }).blocked ?? []).length).map((x) => x.id));
  const needed = opts.renderOnly ? [] : (await scenesNeedingVoice(episode)).filter((id) => !waitingFix.has(id));
  // renderOnly («أنتج كل المشاهد الجاهزة»، «أعد إنتاج المشاهد المتأثرة»): no voice client at all, so nothing paid is called.
  const voiceClient = opts.renderOnly ? null : opts.voiceClient;
  const p: PrepareProgress = {
    phase: "voice", voice: { needed: needed.length, generated: 0, status: needed.length ? "pending" : "none" },
    rendered: [], failed: [],
  };
  const emit = () => opts.onProgress?.({ ...p, voice: { ...p.voice }, rendered: [...p.rendered], failed: [...p.failed],
    ...(p.skipped ? { skipped: [...p.skipped] } : {}) });
  const skip = (x: PrepareSkip) => {
    p.skipped = [...(p.skipped ?? []).filter((y) => y.id !== x.id), x];
  };
  const stop = () => {
    if (!opts.shouldStop?.()) return false;
    p.stopped = true;
    return true;
  };
  emit();

  if (needed.length && !voiceClient) p.voice.status = "no-key";
  else if (needed.length && voiceClient) {
    try {
      await generateVoice(episode, {
        client: voiceClient, only: needed, shouldStop: opts.shouldStop,
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

  // The basmala scenes (owner decision 10 Nov): sentence by sentence, never the basmala itself.
  if (!opts.renderOnly) try {
    const { prepareBasmalaScenes } = await import("../voice/sentenceVoice");
    const b = await prepareBasmalaScenes(episode, { client: voiceClient, shouldStop: opts.shouldStop });
    p.voice.generated += b.generated;
    if (b.errors.length && p.voice.status !== "error") {
      p.voice.status = "error";
      p.voice.error = b.errors[0]!.error;
    }
  } catch (e) {
    if (p.voice.status !== "error") { p.voice.status = "error"; p.voice.error = (e as Error).message; }
  }

  // سرعة الإلقاء: every scene not yet approved or submitted gets the chosen pace from its own existing take (free) before
  // its draft is rendered, so a draft is never made at a pace the owner did not choose. Approved scenes wait for the
  // owner's «أعد إنتاج المشاهد المتأثرة». A failure here leaves the scene «متأثرًا» and never stops the queue.
  try { await (await import("../voice/paceApply")).refreshPace(episode, { open: true }); } catch { /* shown in «الإيقاع» */ }
  p.phase = "render";
  // Said before any render starts, so the owner sees the real blocker at once: every scene still waiting for its
  // voice, whole-scene (`voice`) or sentence by sentence (`sentences`, zubdat D-7: these were skipped silently).
  const first = await scenesToRender(episode);
  const managed = await (await import("../voice/sentenceVoice")).sentenceManagedScenes(await resolveScriptPath(episode));
  for (const id of first.blocked) skip({ id, reason: managed.has(id) ? "sentences" : "voice" });
  for (const x of first.held) skip(x);
  if (first.blocked.length && !opts.voiceClient && !opts.renderOnly && p.voice.status !== "error") p.voice.status = "no-key";
  const voiceMissing = first.blocked.length > 0 || p.voice.status === "no-key" || p.voice.status === "error";
  emit();
  const tried = new Map<string, string>(); // scene → inputs already attempted (no retry loop on failure)
  for (let pass = 0; pass < (opts.maxPasses ?? 4) && !p.stopped; pass++) {
    const picked = pickRenderQueue(await scenesToRender(episode), { voiceMissing, previousFailures: opts.previousFailures });
    for (const x of picked.skipped) skip(x);
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

type LedgerSceneLite = { id: string; status: string; sourceSha256: string; draft?: string };
type PrepareViewLike = {
  failed: { id: string; error: string; sourceSha256?: string }[];
  skipped?: PrepareSkip[];
  voice: { error?: string };
  error?: string;
};
/**
 * M3 (funnel QA, 10 Nov): the status line the owner reads, against the ledger as it is NOW. A failure expires
 * when its scene has since succeeded (a ready draft, submitted or approved) or its inputs changed — so no stale
 * «تعذّر N» stays on screen — and scene ids in the messages are named «المشهد ٣» (the Studio's numbering).
 */
export const currentPrepareView = <T extends PrepareViewLike>(job: T, scenes: LedgerSceneLite[]): T => {
  const order = scenes.map((s) => s.id);
  const live = (id: string, sourceSha256?: string) => {
    const s = scenes.find((x) => x.id === id);
    if (!s || s.draft === "ready" || (s.status !== "queued" && s.status !== "needs_revision")) return false;
    return !sourceSha256 || s.sourceSha256 === sourceSha256;
  };
  return {
    ...job,
    failed: job.failed.filter((f) => live(f.id, f.sourceSha256)).map((f) => ({ ...f, error: nameSceneIds(f.error, order) })),
    // A skipped scene that has since been drafted, submitted or approved is no longer listed.
    ...(job.skipped ? { skipped: job.skipped.filter((x) => live(x.id, x.reason === "failed-before" ? x.sourceSha256 : undefined))
      .map((x) => (x.error ? { ...x, error: nameSceneIds(x.error, order) } : x)) } : {}),
    voice: { ...job.voice, ...(job.voice.error ? { error: nameSceneIds(job.voice.error, order) } : {}) },
    ...(job.error ? { error: nameSceneIds(job.error, order) } : {}),
  };
};
