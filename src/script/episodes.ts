import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { templatesDir } from "../config/paths";
import { channelPaths, domainIds, loadChannel } from "../channel";

/** يحدد ملف السكريبت من رقم الحلقة (001) أو من مسار ملف أو مجلد. */
export const resolveScriptPath = async (arg: string): Promise<string> => {
  const episodesDir = channelPaths().episodes;
  if (/^\d{3}$/.test(arg)) {
    const entries = existsSync(episodesDir) ? await readdir(episodesDir) : [];
    const matches = entries.filter((e) => e.startsWith(`${arg}-`));
    if (matches.length === 0) throw new Error(`الحلقة ${arg} غير موجودة. أنشئها من زر «حلقة جديدة» في الاستوديو، أو بالأمر: bal new ${arg} اسم-مختصر`);
    if (matches.length > 1) throw new Error(`أكثر من مجلد يبدأ بـ ${arg}-: ${matches.join("، ")}`);
    return path.join(episodesDir, matches[0] as string, "script.md");
  }
  const p = path.resolve(arg);
  if (!existsSync(p)) throw new Error(`المسار غير موجود: ${arg}`);
  return (await stat(p)).isDirectory() ? path.join(p, "script.md") : p;
};

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

  const existing = existsSync(episodesDir) ? (await readdir(episodesDir)).filter((e) => e.startsWith(`${opts.episode}-`)) : [];
  if (existing.length) throw new Error(`الحلقة ${opts.episode} موجودة بالفعل: episodes/${existing[0]}`);

  const dir = path.join(episodesDir, `${opts.episode}-${opts.slug}`);
  await mkdir(path.join(dir, "voice"), { recursive: true });
  await mkdir(path.join(dir, "out"), { recursive: true });
  const template = await readFile(path.join(templatesDir, "script.md"), "utf8");
  const script = template
    .replace("{{TITLE}}", (opts.title ?? "").replace(/"/g, "'"))
    .replace("{{DOMAIN}}", opts.domain)
    .replace("{{EPISODE}}", opts.episode);
  const file = path.join(dir, "script.md");
  await writeFile(file, script, "utf8");
  await writeFile(path.join(dir, "voice", ".gitkeep"), "");
  return file;
};
