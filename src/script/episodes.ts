import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { templatesDir } from "../config/paths";
import { channelPaths, domainIds, loadChannel } from "../channel";

/** يحدد ملف السكريبت من رقم الحلقة (001) أو من مسار ملف أو مجلد. */
/**
 * مجلد الحلقة الإنتاجية يمتلك script.md؛ المختبرات التي تحتوي plan.json فقط
 * ليست حلقات سكريبت ولا يجوز أن تتسبب بتصادم الرقم مع حلقة حقيقية.
 */
const scriptEpisodeDirectories = async (episodesDir: string, number: string): Promise<string[]> => {
  if (!existsSync(episodesDir)) return [];
  const entries = await readdir(episodesDir);
  return entries
    .filter((entry) => entry.startsWith(`${number}-`) && existsSync(path.join(episodesDir, entry, "script.md")))
    .sort();
};

/**
 * قائمة الحلقات الجاهزة للتشغيل في الاستوديو: مجلدات NNN-… التي تمتلك script.md فقط.
 * المجلدات التي فيها plan.json بلا سكريبت (مشروع غير مكتمل مثل 000-trailer، أو مختبر مثل 900-…) تبقى كما هي
 * ولا تُعرض حلقاتٍ، لأن فتحها حلقةً يفشل («الحلقة غير موجودة»). القاعدة نفسها في resolveScriptPath.
 */
export const listScriptEpisodeDirs = async (episodesDir: string): Promise<string[]> =>
  existsSync(episodesDir) ? (await readdir(episodesDir)).filter((d) => /^\d{3}-/.test(d) && existsSync(path.join(episodesDir, d, "script.md"))).sort() : [];

export const resolveScriptPath = async (arg: string): Promise<string> => {
  const episodesDir = channelPaths().episodes;
  if (/^\d{3}$/.test(arg)) {
    const matches = await scriptEpisodeDirectories(episodesDir, arg);
    if (matches.length === 0) throw Object.assign(new Error(`الحلقة ${arg} غير موجودة. أنشئها من زر «حلقة جديدة» في الاستوديو، أو بالأمر: bal new ${arg} اسم-مختصر`), { code: "ENOENT" });
    if (matches.length > 1) throw new Error(`أكثر من مجلد يبدأ بـ ${arg}-: ${matches.join("، ")}`);
    return path.join(episodesDir, matches[0] as string, "script.md");
  }
  const p = path.resolve(arg);
  if (!existsSync(p)) throw Object.assign(new Error(`المسار غير موجود: ${arg}`), { code: "ENOENT" });
  return (await stat(p)).isDirectory() ? path.join(p, "script.md") : p;
};

/**
 * مجلد الحلقة لملفات المراجعة بجوارها (المعاينات وغيرها): حلقة سكريبت أولًا، وإلا مختبر plan.json فقط
 * (مثل 900-engine-lab). لا يغيّر resolveScriptPath، فلا يتصادم المختبر مع حلقة حقيقية بنفس الرقم:
 * إن وُجدت حلقة سكريبت بالرقم فهي المقصودة دائمًا.
 */
export const resolveEpisodeDir = async (arg: string): Promise<string> => {
  if (/^\d{3}$/.test(arg)) {
    const episodesDir = channelPaths().episodes;
    const scripted = await scriptEpisodeDirectories(episodesDir, arg);
    if (scripted.length) return path.dirname(await resolveScriptPath(arg));
    const labs = existsSync(episodesDir)
      ? (await readdir(episodesDir)).filter((e) => e.startsWith(`${arg}-`) && existsSync(path.join(episodesDir, e, "plan.json"))).sort()
      : [];
    if (labs.length === 1) return path.join(episodesDir, labs[0]!);
    if (labs.length > 1) throw new Error(`أكثر من مجلد يبدأ بـ ${arg}-: ${labs.join("، ")}`);
  }
  return path.dirname(await resolveScriptPath(arg));
};

/** ملف البحث بجوار السكريبت (دراسة الكتاب في زبدة الكتب) */
export const RESEARCH_FILE = "research.md";

/** قالب القناة بلا هوية: لا يحمل بنية قناة أخرى ولا مصطلحاتها («بعين الإسلام»، «الدفتر»…). */
export const NEUTRAL_TEMPLATE = "_neutral";
/** قالب القناة (templates/<القناة>/<الملف>)، وإلا القالب المحايد (templates/_neutral)، لا قالب قناة أخرى. */
export function templateFor(channelId: string, name: string): string | null;
export function templateFor(channelId: string, name: string, fallback: false): string | null;
export function templateFor(channelId: string, name: string, fallback = true): string | null {
  const own = path.join(templatesDir, channelId, name);
  if (existsSync(own)) return own;
  if (!fallback) return null;
  const neutral = path.join(templatesDir, NEUTRAL_TEMPLATE, name);
  return existsSync(neutral) ? neutral : null;
}

export type NewEpisodeOptions = { episode: string; slug: string; domain: string; title?: string; lang?: string;
  /** سلسلة الحلقة أو تصنيفها (src/channel/series.ts)؛ غيابها أو «general» = «عام» */
  series?: string };

/** The owner's input to «حلقة جديدة» is refused (a 409 in the Studio, never a 500): which field, in Arabic, without a path. */
export class EpisodeInputError extends Error {
  constructor(message: string, readonly field: "episode" | "slug" | "domain" | "series") { super(message); this.name = "EpisodeInputError"; }
}
const arD = (s: string) => s.replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]!);

/** ينشئ مجلد حلقة جديدة بقالب السكريبت. */
export const createEpisode = async (opts: NewEpisodeOptions): Promise<string> => {
  if (!/^\d{3}$/.test(opts.episode)) throw new EpisodeInputError("رقم الحلقة ثلاث خانات، مثل ٠٠٢.", "episode");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(opts.slug)) {
    throw new EpisodeInputError("اسم المجلد بحروف إنجليزية صغيرة وأرقام وشرطات فقط، مثل family-conflict.", "slug");
  }
  const channel = loadChannel();
  const DOMAINS = domainIds(channel);
  if (!DOMAINS.includes(opts.domain)) throw new EpisodeInputError(`اختر المجال من القائمة (${DOMAINS.join("، ")}).`, "domain");
  const episodesDir = channelPaths().episodes;

  const existing = await scriptEpisodeDirectories(episodesDir, opts.episode);
  if (existing.length) throw new EpisodeInputError(`الحلقة ${arD(opts.episode)} موجودة بالفعل في هذه القناة؛ اختر رقمًا آخر.`, "episode");

  const dir = path.join(episodesDir, `${opts.episode}-${opts.slug}`);
  if (existsSync(dir)) throw new EpisodeInputError(`في القناة مجلد بالرقم والاسم نفسيهما (مختبر أو مجلد قائم)؛ غيّر اسم المجلد أو الرقم.`, "slug");
  await mkdir(path.join(dir, "voice"), { recursive: true });
  await mkdir(path.join(dir, "out"), { recursive: true });
  const fill = (t: string) =>
    t
      .replaceAll("{{TITLE}}", (opts.title ?? "").replace(/"/g, "'"))
      .replace("{{DOMAIN}}", opts.domain)
      .replace("{{EPISODE}}", opts.episode);
  const file = path.join(dir, "script.md");
  // السلسلة: قالب سكريبتها إن اختارته، وعناوين فصولها، وأسلوب من أساليبها يختلف عن أسلوب الحلقة السابقة (التنوع)
  const series = await import("../channel/seriesStore");
  const model = await import("../channel/series");
  const chosen = opts.series && opts.series !== model.GENERAL_SLUG ? series.getSeries(channel.id, opts.series) : undefined;
  if (opts.series && opts.series !== model.GENERAL_SLUG && !chosen) throw new EpisodeInputError(`السلسلة المختارة غير موجودة في هذه القناة؛ اختر غيرها.`, "series");
  if (chosen?.status === "archived") throw new EpisodeInputError(`«${chosen.name}» مؤرشفة؛ أعدها نشطة قبل إضافة حلقة.`, "series");
  const ownTemplate = chosen?.template?.script?.source === "series" ? path.join(templatesDir, channel.id, "series", chosen.id, "script.md") : null;
  const scriptTemplate = ownTemplate && existsSync(ownTemplate) ? ownTemplate : templateFor(channel.id, "script.md");
  if (!scriptTemplate) throw new Error("لا يوجد قالب سكريبت لهذه القناة ولا القالب المحايد templates/_neutral/script.md.");
  let text = fill(await readFile(scriptTemplate, "utf8"));
  if (chosen) {
    text = model.applyChapterTitles(text, chosen.template?.chapters?.titles);
    const prev = (await listScriptEpisodeDirs(episodesDir)).filter((d) => d !== path.basename(dir)).pop();
    const prevStyle = prev ? (await readFile(path.join(episodesDir, prev, "script.md"), "utf8")).match(/^style:\s*"?([a-z-]+)"?\s*$/m)?.[1] : undefined;
    const style = model.nextStyle(chosen.template?.styles, prevStyle);
    if (style && !/^style:/m.test(text)) text = text.replace(/^(episode:.*)$/m, `$1\nstyle: ${style}`);
  }
  await writeFile(file, text, "utf8");
  // ملف البحث (أو دراسة الكتاب) بقالب القناة، وإلا المحايد: للتحضير والمراجعة، لا يُقرأ ولا يُنشر
  const research = templateFor(channel.id, "research.md");
  if (research) await writeFile(path.join(dir, RESEARCH_FILE), fill(await readFile(research, "utf8")), "utf8");
  await writeFile(path.join(dir, "voice", ".gitkeep"), "");
  // الانتماء والختم بجوار السكريبت (لا يُكتب لـ«عام» الافتراضي ما لم يُحفظ ملفه)
  if (chosen && !chosen.virtual) await series.linkNewEpisode(channel.id, dir, chosen.id);
  return file;
};
