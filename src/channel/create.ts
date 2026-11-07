import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { channelPaths, loadChannel, isChannelId } from "./index";
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
  if (!isChannelId(opts?.id)) throw new Error("معرّف القناة بالإنجليزية وحروف صغيرة وشرطات فقط، مثل bilislam-tr.");
  if (typeof opts.name !== "string" || !opts.name.trim() || opts.name.length > 160)
    throw new Error("اسم القناة مطلوب (بحد أقصى 160 حرفًا).");
  if (opts.nameLatin != null && (typeof opts.nameLatin !== "string" || opts.nameLatin.length > 160))
    throw new Error("اسم القناة اللاتيني غير صالح.");
  if (typeof opts.language !== "string" || !langPacks[opts.language])
    throw new Error(`اللغة «${opts.language}» غير معروفة. المتاح: ${Object.keys(langPacks).join("، ")}.`);
  if (opts.quran !== undefined && typeof opts.quran !== "boolean") throw new Error("خيار القرآن يجب أن يكون قيمة منطقية.");
  const p = channelPaths(opts.id);
  // Never take ownership of an existing directory, even if channel.json is missing.
  if (existsSync(p.dir)) throw new Error(`القناة «${opts.id}» موجودة بالفعل أو مجلدها محجوز؛ لن يُستبدل.`);

  const source = opts.from ?? "balislam";
  const src = channelPaths(source);
  const base = loadChannel(source);
  // Build and validate all input BEFORE publishing any new channel directory.
  const baseIdentity: unknown = JSON.parse(await readFile(src.identityDefault, "utf8"));
  if (!baseIdentity || typeof baseIdentity !== "object" || Array.isArray(baseIdentity) ||
      !["themes", "palettes", "typography", "motion"].every((k) => k in baseIdentity))
    throw new Error("قالب الهوية المصدر غير مكتمل؛ لم تُنشأ القناة.");
  const identity = JSON.stringify(neutralIdentity(baseIdentity as Record<string, unknown>), null, 2) + "\n";
  const quran = opts.quran ?? base.rules.quran;
  const channel: ChannelConfig = {
    id: opts.id,
    name: opts.name.trim(),
    nameLatin: opts.nameLatin ?? opts.id,
    language: opts.language,
    description: "",
    masterTheme: base.masterTheme,
    logo: { type: "letter", letter: [...opts.name.trim()][0] ?? "؟" },
    domains: { general: { name: "عام", theme: base.masterTheme, tags: [] } },
    rules: { ...base.rules, quran, hadith: quran ? base.rules.hadith : false },
    brand: { intro: "none", thumbnail: "circle" },
    youtube: { tags: [opts.name.trim().replace(/\s+/g, "_")], postingTime: base.youtube.postingTime, footer: "" },
  };

  // A sibling staging directory is invisible to listChannels. A failed write or
  // process interruption never exposes a half-created production channel.
  await mkdir(path.dirname(p.dir), { recursive: true });
  // Acquire a cross-process claim before staging. Exclusive creation ensures two
  // Studio processes cannot both publish the same id; a crash leaves a visible
  // lock that must be inspected manually rather than risking an overwrite.
  const lockPath = path.join(path.dirname(p.dir), `.${opts.id}.create.lock`);
  let lock: Awaited<ReturnType<typeof open>>;
  try {
    lock = await open(lockPath, "wx", 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      throw new Error(`إنشاء القناة «${opts.id}» قيد التنفيذ أو يحتاج فحص قفل قديم؛ لن تُستبدل أي ملفات.`);
    throw error;
  }
  let staging: string | undefined;
  try {
    staging = await mkdtemp(path.join(path.dirname(p.dir), `.${opts.id}.creating-`));
    await mkdir(path.join(staging, "episodes"));
    await writeFile(path.join(staging, "episodes", ".gitkeep"), "");
    await writeFile(path.join(staging, "identity.json"), identity);
    await writeFile(path.join(staging, "identity.default.json"), identity);
    await writeFile(path.join(staging, "pronunciation.json"), JSON.stringify({ entries: [] }, null, 2) + "\n");
    await writeFile(path.join(staging, "channel.json"), JSON.stringify(channel, null, 2) + "\n");
    // A competing createChannel has already populated the target -> rename fails.
    // Check even empty pre-existing directories before any rename.
    if (existsSync(p.dir)) throw new Error(`القناة «${opts.id}» موجودة بالفعل؛ لم تُستبدل.`);
    await rename(staging, p.dir);
  } finally {
    // Only this invocation's unique staging path may be deleted. Always release
    // the claim after success/failure; a process crash deliberately leaves it.
    try {
      if (staging) await rm(staging, { recursive: true, force: true });
    } finally {
      await lock.close();
      await rm(lockPath, { force: true });
    }
  }
  return p.dir;
};
