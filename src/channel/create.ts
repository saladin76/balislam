import path from "node:path";
import { existsSync } from "node:fs";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { channelPaths, loadChannel } from "./index";
import { langPacks } from "../i18n/packs";
import type { ChannelConfig } from "./types";

export type NewChannelOptions = {
  id: string;
  name: string;
  nameLatin?: string;
  language: string;
  /** قناة تبدأ هويتها منها (افتراضيًا: القناة الأساسية) */
  from?: string;
  quran?: boolean;
};

/**
 * ينشئ قناة جديدة: channel.json بمجال واحد يبدأ منه، وهوية منسوخة من قناة أخرى لتعديلها في الاستوديو،
 * وقاموس نطق فارغ، ومجلد حلقات. المحرك والقوالب والمكتبة مشتركة بين كل القنوات.
 */
export const createChannel = async (opts: NewChannelOptions) => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(opts.id)) throw new Error("معرّف القناة بالإنجليزية وحروف صغيرة وشرطات فقط، مثل bilislam-tr.");
  if (!langPacks[opts.language]) throw new Error(`اللغة «${opts.language}» غير معروفة. المتاح: ${Object.keys(langPacks).join("، ")}.`);
  const p = channelPaths(opts.id);
  if (existsSync(p.channelFile)) throw new Error(`القناة «${opts.id}» موجودة بالفعل.`);
  const source = opts.from ?? "balislam";
  const src = channelPaths(source);
  const base = loadChannel(source);

  await mkdir(p.episodes, { recursive: true });
  await writeFile(path.join(p.episodes, ".gitkeep"), "");
  await copyFile(src.identityDefault, p.identity);
  await copyFile(src.identityDefault, p.identityDefault);
  await writeFile(p.pronunciation, JSON.stringify({ entries: [] }, null, 2) + "\n");

  const quran = opts.quran ?? base.rules.quran;
  const channel: ChannelConfig = {
    id: opts.id,
    name: opts.name,
    nameLatin: opts.nameLatin ?? opts.id,
    language: opts.language,
    description: "",
    masterTheme: base.masterTheme,
    domains: { general: { name: "عام", theme: base.masterTheme, tags: [] } },
    rules: { ...base.rules, quran, hadith: quran ? base.rules.hadith : false },
    youtube: { tags: [opts.name.replace(/\s+/g, "_")], postingTime: base.youtube.postingTime, voiceDisclosure: base.youtube.voiceDisclosure },
  };
  await writeFile(p.channelFile, JSON.stringify(channel, null, 2) + "\n");
  return p.dir;
};
