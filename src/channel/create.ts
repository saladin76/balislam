import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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

/** رمادي بنفس الإضاءة: يبقي تباين الألوان وعلاقاتها، ويمحو بصمة القناة المصدر */
const neutral = (hex: string) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const y = Math.round(0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255));
  const h = y.toString(16).padStart(2, "0").toUpperCase();
  return `#${h}${h}${h}`;
};

/**
 * هوية مؤقتة محايدة لقناة جديدة: بنية هوية المصدر (الثيمات والأحجام والحركة) بألوان رمادية وخطوط افتراضية،
 * حتى لا تحمل القناة الجديدة بصمة قناة معتمدة. هويتها الحقيقية تُبنى بعد ستوري بورد واعتماد.
 */
export const neutralIdentity = (source: Record<string, unknown>) => {
  const { fonts: _fonts, ...rest } = source as { fonts?: unknown } & Record<string, unknown>;
  return JSON.parse(JSON.stringify(rest).replace(/#[0-9a-fA-F]{6}\b/g, neutral));
};

/**
 * ينشئ قناة جديدة: channel.json بمجال واحد يبدأ منه، وهوية مؤقتة محايدة (بنية قناة أخرى بلا بصمتها)،
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
  const identity = JSON.stringify(neutralIdentity(JSON.parse(await readFile(src.identityDefault, "utf8"))), null, 2) + "\n";
  await writeFile(p.identity, identity);
  await writeFile(p.identityDefault, identity);
  await writeFile(p.pronunciation, JSON.stringify({ entries: [] }, null, 2) + "\n");

  const quran = opts.quran ?? base.rules.quran;
  const channel: ChannelConfig = {
    id: opts.id,
    name: opts.name,
    nameLatin: opts.nameLatin ?? opts.id,
    language: opts.language,
    description: "",
    masterTheme: base.masterTheme,
    logo: { type: "letter", letter: [...opts.name.trim()][0] ?? "؟" },
    domains: { general: { name: "عام", theme: base.masterTheme, tags: [] } },
    rules: { ...base.rules, quran, hadith: quran ? base.rules.hadith : false },
    // بلا افتتاحية وبصورة مصغّرة عامة حتى تُعتمد هوية القناة؛ وتوقيع الوصف يكتبه صاحب القناة
    brand: { intro: "none", thumbnail: "circle" },
    youtube: { tags: [opts.name.replace(/\s+/g, "_")], postingTime: base.youtube.postingTime, footer: "" },
  };
  await writeFile(p.channelFile, JSON.stringify(channel, null, 2) + "\n");
  return p.dir;
};
