/**
 * `bal plan-from-scenes`: يقرأ script.md وscenes.md للحلقة ويبني خطتها المصمَّمة (src/plan/fromScenes.ts)، ويتحقق
 * قبل أي كتابة: لا نص في السكريبت بلا مشهد ولا مشهد بنص ليس في السكريبت (مقارنة «اعتمد التجهيز» نفسها)، ولا لقطة
 * غير معتمدة (بوابة D228)، ولا بطاقة بلا صف. الكتابة صريحة: نسخة احتياطية من الخطة القائمة أولًا، وخطة قائمة مصمَّمة
 * لا يُكتب فوقها إلا بتأكيد `overwriteDesigned`.
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { parseScript } from "../script/parse";
import { resolveScriptPath } from "../script/episodes";
import { loadChannel, currentChannelId } from "../channel";
import { quranFromScript } from "../quran/scriptText";
import { backupPlanFile, planFromScriptOnly, planPathFor, readJson, writePlanFile } from "./io";
import { isDesignedPlan, scriptPlanDivergence, designedScenes } from "./designed";
import { unapprovedScenes, loadApprovals } from "./templateApproval";
import { fromScenesProblems, inlineQuotesInPlan, planFromScenes, type AttachedQuote, type FromScenesReport } from "./fromScenes";
import type { QuoteCarry } from "./quoteCarry";
import type { CarryDecision, QuotePlacement } from "./quotePlacement";
import { episodeSeriesOf, getSeries, EPISODE_SERIES_FILE } from "../channel/seriesStore";
import { stampSeries, type SeriesStamp } from "../channel/series";
import type { Plan } from "./types";

export type PlanFromScenesResult = {
  file: string;
  plan: Plan;
  report: FromScenesReport;
  problems: string[];
  /** معرّفات الشورتس القديمة التي لم يعد لها مشهد (لم تُنقل) */
  droppedShorts: number;
  written: boolean;
  backup?: string;
  seriesLinkWritten?: boolean;
};

const seriesFor = (dir: string, fm: Record<string, unknown>, now: string): { stamp?: SeriesStamp; link?: boolean } => {
  const link = episodeSeriesOf(dir);
  if (link.stamp) return { stamp: link.stamp };
  const id = typeof fm.series === "string" ? fm.series : "";
  const n = Number(fm.series_number);
  const s = id ? getSeries(currentChannelId(), id) : undefined;
  if (!s || !Number.isInteger(n) || n < 1) return {};
  return { stamp: stampSeries(s, currentChannelId(), n, now), link: true };
};

export const planFromScenesFile = async (episode: string, o: { write?: boolean; overwriteDesigned?: boolean; now?: string } = {}): Promise<PlanFromScenesResult> => {
  const scriptPath = await resolveScriptPath(episode);
  const dir = path.dirname(scriptPath);
  const scenesFile = path.join(dir, "scenes.md");
  if (!existsSync(scenesFile)) throw new Error(`لا scenes.md للحلقة ${episode}.`);
  const parsed = parseScript(await readFile(scriptPath, "utf8"), scriptPath);
  const now = o.now ?? new Date().toISOString();
  const file = planPathFor(scriptPath);
  const previous = await readJson<Plan>(file);
  const series = seriesFor(dir, (parsed.frontmatter ?? {}) as Record<string, unknown>, now);
  const { loadVoiceIndex } = await import("../voice/generate");
  const { emptyMedia } = await import("./media");
  const { plan, report } = planFromScenes({
    parsed, scenesMd: await readFile(scenesFile, "utf8"), channel: loadChannel(),
    quran: quranFromScript(parsed).texts, series: series.stamp, now,
    // D246: استمرار البطاقات بتوقيت الصوت الحقيقي إن وُجد
    media: { ...emptyMedia, voice: await loadVoiceIndex(episode).catch(() => ({})) },
    // D246 «أ»: حقول المالك/المحرر على مشاهد الخطة القائمة (carryAllowed، quotePinned) تبقى
    ...(previous ? { owner: previous } : {}),
  });
  // شورتس الخطة القائمة تبقى إن بقيت مشاهدها
  const ids = new Set(plan.chapters.flatMap((c) => c.scenes).map((s) => s.id));
  const kept = (previous?.shorts ?? []).filter((x) => [x.from, x.to, ...(x.segments ?? []).flatMap((p) => [p.from, p.to])].every((id) => ids.has(id)));
  if (kept.length) plan.shorts = kept.map((x) => ({ ...x }));
  const problems = fromScenesProblems(report);
  const div = scriptPlanDivergence(plan, await planFromScriptOnly(scriptPath));
  for (const s of div.scenes) problems.push(`نص المشهد ${s.id} ليس في السكريبت كما هو`);
  for (const u of div.unplaced) problems.push(`نص في السكريبت لا يقوله أي مشهد (السطر ${u.line})`);
  for (const u of unapprovedScenes(plan, loadApprovals())) problems.push(`D228: ${u.sceneId} بلقطة غير معتمدة ${u.key} (${u.status})`);
  const result: PlanFromScenesResult = { file, plan, report, problems, droppedShorts: (previous?.shorts?.length ?? 0) - kept.length, written: false };
  if (!o.write) return result;
  if (problems.length) throw new Error(`لم تُكتب الخطة:\n${problems.map((p) => `- ${p}`).join("\n")}`);
  if (previous) {
    if (isDesignedPlan(previous) && !o.overwriteDesigned)
      throw new Error(`الخطة القائمة ${episode} مصمَّمة (${designedScenes(previous).length} مشهدًا مصمَّمًا)؛ لم تُكتب فوقها. للكتابة الصريحة: --overwrite-designed (تُحفظ نسخة احتياطية أولًا).`);
    result.backup = await backupPlanFile(scriptPath);
  }
  await writePlanFile(file, plan);
  if (series.link && !existsSync(path.join(dir, EPISODE_SERIES_FILE))) {
    await writeFile(path.join(dir, EPISODE_SERIES_FILE), JSON.stringify({ series: series.stamp!.id, stamp: series.stamp }, null, 2) + "\n", "utf8");
    result.seriesLinkWritten = true;
  }
  result.written = true;
  return result;
};

/**
 * D242: `bal inline-quotes <الحلقة>`: يحوّل plan.json القائمة (لا يعيد بناءها): كل بطاقة آية/حديث صامتة تُلحق بلقطة
 * «خط الأفق» المجاورة (inlineQuotesInPlan، الدالة نفسها في planFromScenes)، وكل ما سواها كما هو (النبرة، edited، الشورتس،
 * السلسلة). يتحقق قبل الكتابة: نص كل مشهد باقٍ كما كان بايتًا ببايت (فالتسجيلات تبقى صالحة بلا صوت جديد)، ولا بطاقة بقيت.
 * عرض فقط إلا بـ write (نسخة احتياطية أولًا).
 */
export type InlineQuotesResult = { file: string; plan: Plan; attached: AttachedQuote[]; unattached: { card: string; reason: string }[]; removed: string[]; carries: QuoteCarry[]; placements: QuotePlacement[]; decisions: CarryDecision[]; changedScenes: string[]; voiced: number; written: boolean; backup?: string };
export const inlineQuotesFile = async (episode: string, o: { write?: boolean } = {}): Promise<InlineQuotesResult> => {
  const scriptPath = await resolveScriptPath(episode);
  const file = planPathFor(scriptPath);
  const raw = await readFile(file, "utf8");
  const plan = JSON.parse(raw) as Plan;
  const parsed = parseScript(await readFile(scriptPath, "utf8"), scriptPath);
  // D246: الاستمرار بتوقيت الصوت الحقيقي إن وُجد (voice/index.json على هذا الجهاز)، وإلا التقدير
  const { loadVoiceIndex } = await import("../voice/generate");
  const { emptyMedia } = await import("./media");
  const media = { ...emptyMedia, voice: await loadVoiceIndex(episode).catch(() => ({})) };
  // D246 «أ»: مع scenes.md تُعاد البطاقات إلى مواضعها فيُعاد إلحاقها وموضعها واستمرارها بالقواعد الحالية
  const scenesFile = path.join(path.dirname(scriptPath), "scenes.md");
  const scenesMd = existsSync(scenesFile) ? await readFile(scenesFile, "utf8") : undefined;
  const r = inlineQuotesInPlan(plan, quranFromScript(parsed).texts, media, scenesMd);
  // نص كل مشهد باقٍ كما كان (الدالة تتحقق، وهذا تأكيد على الملف نفسه)
  const before = new Map(plan.chapters.flatMap((c) => c.scenes).map((s) => [s.id, s.narration]));
  for (const s of r.plan.chapters.flatMap((c) => c.scenes)) if (before.get(s.id) !== s.narration) throw new Error(`تغيّر نص ${s.id}`);
  // المشاهد التي تغيّرت حقولها (تُعاد رندرتها)
  const was = new Map(plan.chapters.flatMap((c) => c.scenes).map((s) => [s.id, JSON.stringify(s)]));
  const changedScenes = r.plan.chapters.flatMap((c) => c.scenes).filter((s) => was.get(s.id) !== JSON.stringify(s)).map((s) => s.id);
  const result: InlineQuotesResult = { file, ...r, changedScenes, voiced: Object.keys(media.voice).length, written: false };
  const changed = JSON.stringify(r.plan) !== JSON.stringify(plan);
  if (!o.write || !changed) return result;
  if (r.unattached.length) throw new Error(`لم تُكتب الخطة: بطاقات لم تُلحق:\n${r.unattached.map((u) => `- ${u.card}: ${u.reason}`).join("\n")}`);
  result.backup = await backupPlanFile(scriptPath);
  await writePlanFile(file, r.plan);
  result.written = true;
  return result;
};
