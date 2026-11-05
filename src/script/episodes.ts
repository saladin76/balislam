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
    if (matches.length === 0) throw new Error(`الحلقة ${arg} غير موجودة. أنشئها من زر «حلقة جديدة» في الاستوديو، أو بالأمر: bal new ${arg} اسم-مختصر`);
    if (matches.length > 1) throw new Error(`أكثر من مجلد يبدأ بـ ${arg}-: ${matches.join("، ")}`);
    return path.join(episodesDir, matches[0] as string, "script.md");
  }
  const p = path.resolve(arg);
  if (!existsSync(p)) throw new Error(`المسار غير موجود: ${arg}`);
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

/** قالب القناة (templates/<القناة>/<الملف>)، وإلا قالب «بالإسلام» العام. */
export function templateFor(channelId: string, name: string): string;
export function templateFor(channelId: string, name: string, fallback: false): string | null;
export function templateFor(channelId: string, name: string, fallback = true): string | null {
  const own = path.join(templatesDir, channelId, name);
  if (existsSync(own)) return own;
  if (!fallback) return null;
  return path.join(templatesDir, "balislam", name);
}

export type NewEpisodeOptions = { episode: string; slug: string; domain: string; title?: string; lang?: string };

/** ينشئ مجلد حلقة جديدة بقالب السكريبت. */
export const createEpisode = async (opts: NewEpisodeOptions): Promise<string> => {
  if (!/^\d{3}$/.test(opts.episode)) throw new Error("رقم الحلقة يجب أن يكون ثلاث خانات، مثل 002.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(opts.slug)) {
    throw new Error("الاسم المختصر بالإنجليزية وحروف صغيرة وشرطات فقط، مثل family-conflict.");
  }
  const channel = loadChannel();
  const DOMAINS = domainIds(channel);
  if (!DOMAINS.includes(opts.domain)) throw new Error(`المجال يجب أن يكون واحدًا من: ${DOMAINS.join("، ")}.`);
  const episodesDir = channelPaths().episodes;

  const existing = await scriptEpisodeDirectories(episodesDir, opts.episode);
  if (existing.length) throw new Error(`الحلقة ${opts.episode} موجودة بالفعل: episodes/${existing[0]}`);

  const dir = path.join(episodesDir, `${opts.episode}-${opts.slug}`);
  if (existsSync(dir)) throw new Error(`المجلد ${path.basename(dir)} موجود مسبقًا؛ لا يمكن تحويل مختبر أو مجلد قائم إلى حلقة جديدة.`);
  await mkdir(path.join(dir, "voice"), { recursive: true });
  await mkdir(path.join(dir, "out"), { recursive: true });
  const fill = (t: string) =>
    t
      .replaceAll("{{TITLE}}", (opts.title ?? "").replace(/"/g, "'"))
      .replace("{{DOMAIN}}", opts.domain)
      .replace("{{EPISODE}}", opts.episode);
  const file = path.join(dir, "script.md");
  await writeFile(file, fill(await readFile(templateFor(channel.id, "script.md"), "utf8")), "utf8");
  // ملف البحث (أو دراسة الكتاب) بقالب القناة: للتحضير والمراجعة، لا يُقرأ ولا يُنشر
  const research = templateFor(channel.id, "research.md", false);
  if (research) await writeFile(path.join(dir, RESEARCH_FILE), fill(await readFile(research, "utf8")), "utf8");
  await writeFile(path.join(dir, "voice", ".gitkeep"), "");
  return file;
};
