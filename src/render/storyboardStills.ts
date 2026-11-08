/**
 * لوحات الستوري بورد من الخطة الحالية (الأمر 027): صورة لكل مشهد عند لحظة لوحته (`shotFrame`)،
 * من تكوين الحلقة نفسه الذي تُرندر منه المعاينة الصامتة، فاللوحة = ما سيُرندر.
 * - صامتة بتوقيت تقديري (قبل الصوت)، بجودة المعاينة وعرض صغير؛ لا تُنشر ولا تعتمد شيئًا.
 * - الصور والبيان في `storyboard-stills/` بجوار السكريبت (خارج Git: تُعاد من الخطة بأمر واحد).
 * - البيان يحمل بصمة الخطة والمحرك ولحظة كل لوحة، فتظهر الصور قديمة إن تغيّر أي منها.
 * - البيان بصيغة يقرؤها مصدّر PDF المشترك (`scripts/studio-storyboard-pdf.mjs`: scenes[].board).
 */
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { Plan } from "../plan/types";
import { emptyMedia } from "../plan/media";
import { sceneFrames } from "../plan/duration";
import { HORIZON_BOARD_VIEW, shotFrame } from "../plan/storyboardView";
import { storyboardVisualHash } from "../plan/storyboard";
import { introFramesFor } from "../remotion/scenes/ChannelIntro";
import { motionFingerprint, currentRendererHash } from "./motionFingerprint";
import config from "../../config.json";

export const STILLS_DIR = "storyboard-stills";
export const STILLS_MANIFEST = "storyboard.json";
/** عرض اللوحة بالبكسل (ثلث 1920): تكفي للمراجعة وتبقى صغيرة */
export const STILLS_WIDTH = 640;

export type StillScene = {
  id: string; chapter: number; chapterTitle: string; name: string; narration: string; shot: string;
  /** المسار نسبةً إلى مجلد الحلقة (كما يقرؤه مصدّر PDF) */
  board: string;
  /** أول إطار للمشهد في الحلقة، ومدته، ولحظة لوحته داخله */
  from: number; durationInFrames: number; frame: number;
  visualHash: string; sha256: string;
};
export type StillsManifest = {
  kind: "storyboard-stills"; version: 1;
  channel: string; episode: string; title: string;
  storyboardVersion: string; status: "PENDING_REVIEW";
  generatedAt: string; timing: "silent-estimate"; boardView: string;
  width: number; fps: number; introFrames: number; totalFrames: number;
  /** بصمة الخطة والمحرك والهوية بلا صوت (motionFingerprint) */
  fingerprint: string;
  note: string;
  scenes: StillScene[];
};

/** توقيت كل مشهد ولحظة لوحته كما يعرضها الاستوديو (بلا صوت). */
export const boardTimings = (plan: Plan, channel: Parameters<typeof introFramesFor>[0]) => {
  let t = introFramesFor(channel, plan);
  const intro = t;
  const scenes = plan.chapters.flatMap((c) => c.scenes.map((s) => {
    const d = sceneFrames(s, emptyMedia);
    const row = { chapter: c, scene: s, from: t, durationInFrames: d, frame: shotFrame(s, d) };
    t += d;
    return row;
  }));
  return { intro, total: t, scenes };
};

const silentFingerprint = async (plan: Plan, channelId: string) => {
  const { loadChannel, loadChannelIdentity } = await import("../channel");
  const { channelInfo } = await import("../channel/types");
  return motionFingerprint(plan, emptyMedia, loadChannelIdentity(channelId), channelInfo(loadChannel(channelId)), "landscape", [],
    (await currentRendererHash()) + ":" + HORIZON_BOARD_VIEW);
};

export const stillsDirFor = (scriptPath: string) => path.join(path.dirname(scriptPath), STILLS_DIR);

export const loadStillsManifest = async (scriptPath: string): Promise<StillsManifest | null> => {
  const f = path.join(stillsDirFor(scriptPath), STILLS_MANIFEST);
  if (!existsSync(f)) return null;
  try { return JSON.parse(await readFile(f, "utf8")) as StillsManifest; } catch { return null; }
};

/** هل اللوحات المحفوظة هي ما سيُرندر الآن؟ (الخطة والمحرك ولحظة كل لوحة) */
export const stillsStatus = async (episode: string): Promise<{ exists: boolean; current: boolean; stale: string[]; missing: string[] }> => {
  const { resolveScriptPath } = await import("../script/episodes");
  const { loadPlan, regeneratePlan } = await import("../plan/io");
  const { loadChannel } = await import("../channel");
  const { channelInfo } = await import("../channel/types");
  const scriptPath = await resolveScriptPath(episode);
  const plan = (await loadPlan(episode)) ?? (await regeneratePlan(episode));
  const m = await loadStillsManifest(scriptPath);
  const ids = plan.chapters.flatMap((c) => c.scenes.map((s) => s.id));
  if (!m) return { exists: false, current: false, stale: [], missing: ids };
  const channel = loadChannel();
  const { scenes } = boardTimings(plan, channelInfo(channel));
  const saved = new Map(m.scenes.map((s) => [s.id, s]));
  const missing = ids.filter((id) => !saved.has(id) || !existsSync(path.join(path.dirname(scriptPath), saved.get(id)!.board)));
  const stale = scenes.filter(({ scene, from, durationInFrames, frame }) => {
    const s = saved.get(scene.id);
    return s && (s.visualHash !== storyboardVisualHash(scene) || s.from !== from || s.durationInFrames !== durationInFrames || s.frame !== frame);
  }).map(({ scene }) => scene.id);
  const fingerprintOk = m.fingerprint === await silentFingerprint(plan, channel.id);
  return { exists: true, current: fingerprintOk && !stale.length && !missing.length && m.scenes.length === ids.length, stale, missing };
};

/**
 * يرندر لوحة لكل مشهد من الخطة الحالية (أو المشاهد المحددة) ويكتب البيان.
 * لا يلمس سجل الاعتماد ولا الخطة ولا المعاينات.
 */
export const renderStoryboardStills = async (episode: string, opts: { only?: string[]; width?: number; onProgress?: (pct: number, msg: string) => void } = {}) => {
  const log = opts.onProgress ?? (() => {});
  const { resolveScriptPath } = await import("../script/episodes");
  const { loadPlan, regeneratePlan } = await import("../plan/io");
  const { loadChannel, loadChannelIdentity } = await import("../channel");
  const { channelInfo } = await import("../channel/types");
  const { createIsolatedRenderBundle, browserExecutable } = await import("./bundle");
  const { selectComposition, renderStill, openBrowser } = await import("@remotion/renderer");
  const scriptPath = await resolveScriptPath(episode);
  const plan = (await loadPlan(episode)) ?? (await regeneratePlan(episode));
  const channel = loadChannel();
  const info = channelInfo(channel);
  const width = opts.width ?? STILLS_WIDTH;
  const { intro, total, scenes } = boardTimings(plan, info);
  const ids = new Set(plan.chapters.flatMap((c) => c.scenes.map((s) => s.id)));
  const unknown = (opts.only ?? []).filter((id) => !ids.has(id));
  if (unknown.length) throw new Error(`مشاهد ليست في الخطة: ${unknown.join("، ")}`);
  const dir = stillsDirFor(scriptPath);
  await mkdir(dir, { recursive: true });
  const fingerprint = await silentFingerprint(plan, channel.id);
  const previous = opts.only?.length ? await loadStillsManifest(scriptPath) : null;
  // لوحات جزئية فوق لوحات من خطة أو محرك آخر تخلط نسختين: تُعاد كلها
  if (opts.only?.length && (!previous || previous.fingerprint !== fingerprint))
    throw new Error("الخطة أو المحرك تغيّر منذ آخر لوحات (أو لا لوحات بعد): أعد اللوحات كلها بلا --only.");
  const wanted = scenes.filter(({ scene }) => !opts.only?.length || opts.only.includes(scene.id));
  log(0, "تجميع المشروع…");
  const sandbox = await createIsolatedRenderBundle(emptyMedia);
  const rows = new Map<string, StillScene>((previous?.scenes ?? []).map((s) => [s.id, s]));
  try {
    const inputProps = { plan, orientation: "landscape" as const, media: emptyMedia, timingMode: "estimated" as const,
      identity: loadChannelIdentity(channel.id), channel: info };
    const browser = await openBrowser("chrome", { browserExecutable: browserExecutable() });
    try {
      const composition = await selectComposition({ serveUrl: sandbox.serveUrl, id: "episode-landscape", inputProps, puppeteerInstance: browser });
      if (composition.durationInFrames !== total) throw new Error(`مدة الحلقة في التكوين (${composition.durationInFrames}) لا تطابق حساب اللوحات (${total}).`);
      let i = 0;
      for (const { chapter, scene, from, durationInFrames, frame } of wanted) {
        const file = `${scene.id}.jpg`;
        const out = path.join(dir, file);
        const pending = `${out}.${randomUUID()}.part.jpg`;
        try {
          await renderStill({ serveUrl: sandbox.serveUrl, composition, inputProps, frame: from + frame, output: pending,
            imageFormat: "jpeg", jpegQuality: 82, scale: width / config.video.episode.width, puppeteerInstance: browser, overwrite: true });
          await rename(pending, out);
        } finally {
          await rm(pending, { force: true });
        }
        rows.set(scene.id, {
          id: scene.id, chapter: chapter.number, chapterTitle: chapter.title,
          name: String(scene.props.shot ?? scene.template), narration: scene.narration, shot: String(scene.props.shot ?? scene.template),
          board: `${STILLS_DIR}/${file}`, from, durationInFrames, frame, visualHash: storyboardVisualHash(scene),
          sha256: createHash("sha256").update(await readFile(out)).digest("hex"),
        });
        log(Math.round((++i / wanted.length) * 100), scene.id);
      }
    } finally {
      await browser.close({ silent: true });
    }
  } finally {
    await sandbox.cleanup();
  }
  // صور مشاهد حُذفت من الخطة لا تبقى بجوار البيان
  for (const name of await readdir(dir)) {
    const id = name.replace(/\.jpg$/, "");
    if (name.endsWith(".jpg") && !ids.has(id)) await rm(path.join(dir, name), { force: true });
  }
  const ordered = scenes.map(({ scene }) => rows.get(scene.id)).filter((s): s is StillScene => Boolean(s));
  const manifest: StillsManifest = {
    kind: "storyboard-stills", version: 1, channel: channel.id, episode: path.basename(path.dirname(scriptPath)), title: plan.title,
    storyboardVersion: `plan ${createHash("sha256").update(JSON.stringify(ordered.map((s) => [s.id, s.visualHash]))).digest("hex").slice(0, 12)}`,
    status: "PENDING_REVIEW", generatedAt: new Date().toISOString(), timing: "silent-estimate", boardView: HORIZON_BOARD_VIEW,
    width, fps: config.video.fps, introFrames: intro, totalFrames: total,
    fingerprint,
    note: "لوحات من الخطة الحالية بلا صوت (توقيت تقديري)، من تكوين الحلقة نفسه عند لحظة لوحة كل مشهد. للمراجعة فقط؛ ليست اعتمادًا ولا تُنشر.",
    scenes: ordered,
  };
  await writeFile(path.join(dir, STILLS_MANIFEST), JSON.stringify(manifest, null, 1) + "\n");
  return { dir, manifest, rendered: wanted.length };
};
