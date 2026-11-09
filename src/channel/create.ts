import { LEXICON_NOTE } from "../voice/lexicon";
import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { channelPaths, loadChannel } from "./index";
import { templatesDir } from "../config/paths";
import { langPacks } from "../i18n/packs";
import type { ChannelConfig } from "./types";

export type NewChannelOptions = {
  id: string;
  name: string;
  nameLatin?: string;
  language: string;
  /**
   * قناة تبدأ بنية هويتها وقواعدها منها (اختياري وصريح). بدونها: القالب المحايد templates/_neutral
   * وقواعد آمنة (SAFE_NEW_CHANNEL_RULES)، لا هوية «بالإسلام» ولا قواعدها.
   */
  from?: string;
  quran?: boolean;
};

/** زخرفة لا تخص أي قناة معتمدة (brand/identity/approved.ts ← motifs)، وتُطفأ في العرض حتى تُعتمد هوية */
const NEUTRAL_MOTIF = "house-circles";
const NEUTRAL_THEME_NAMES: Record<string, string> = { paper: "فاتح", family: "دافئ", night: "داكن", warm: "متوسط" };

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
  const out = JSON.parse(JSON.stringify(rest).replace(/#[0-9a-fA-F]{6}\b/g, neutral));
  // زخرفة الخلفية بصمة قناة (أقواس ونجمة «بالإسلام»، خطوط «دفاتر الزمن»، سطور «زبدة الكتب»): لا تُورَّث
  // وأسماء الثيمات ومجالاتها من القناة المصدر («محراب الليل»…) تُستبدل بأسماء وصفية عامة
  for (const [id, theme] of Object.entries<Record<string, unknown>>(out.themes ?? {})) {
    if (!theme || typeof theme !== "object") continue;
    if ("motif" in theme) theme.motif = NEUTRAL_MOTIF;
    if ("nameAr" in theme) theme.nameAr = NEUTRAL_THEME_NAMES[id] ?? id;
    if ("domainAr" in theme) theme.domainAr = "عام";
  }
  if (out.overlays && typeof out.overlays === "object") out.overlays.motif = false;
  return out;
};

/**
 * قواعد القناة الجديدة بلا مصدر: الأحوط حتى يقرر صاحبها. بلا وجوه ولا موسيقى، وفحص «لا يُصوَّر نبي ولا صحابي»
 * وتنبيه توثيق مصدر الصور الوثائقية مفعّلان صراحة (src/channel/productionRules.ts).
 */
export const SAFE_NEW_CHANNEL_RULES: ChannelConfig["rules"] = {
  music: false, faces: false, quran: true, hadith: true, hadithGrades: ["صحيح", "حسن"],
  sacredFigures: true, documentProvenance: true,
};
/** هوية القالب المحايد: بنية كاملة بألوان رمادية بلا خطوط ولا زخارف ولا أسماء قناة (ولَّدها neutralIdentity). */
export const neutralIdentityFile = () => path.join(templatesDir, "_neutral", "identity.json");

/**
 * ينشئ قناة جديدة: channel.json بمجال واحد يبدأ منه، وهوية مؤقتة محايدة، وقاموس نطق فارغ، ومجلد حلقات.
 * المحرك والقوالب والمكتبة مشتركة بين كل القنوات.
 */
export const createChannel = async (opts: NewChannelOptions) => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(opts.id)) throw new Error("معرّف القناة بالإنجليزية وحروف صغيرة وشرطات فقط، مثل bilislam-tr.");
  if (!langPacks[opts.language]) throw new Error(`اللغة «${opts.language}» غير معروفة. المتاح: ${Object.keys(langPacks).join("، ")}.`);
  const p = channelPaths(opts.id);
  if (existsSync(p.channelFile)) throw new Error(`القناة «${opts.id}» موجودة بالفعل.`);
  const base = opts.from ? loadChannel(opts.from) : null;
  const identitySource = opts.from ? channelPaths(opts.from).identityDefault : neutralIdentityFile();
  const sourceIdentity = JSON.parse(await readFile(identitySource, "utf8"));

  await mkdir(p.episodes, { recursive: true });
  await writeFile(path.join(p.episodes, ".gitkeep"), "");
  const identity = JSON.stringify(neutralIdentity(sourceIdentity), null, 2) + "\n";
  await writeFile(p.identity, identity);
  await writeFile(p.identityDefault, identity);
  await writeFile(p.pronunciation, JSON.stringify({ entries: [] }, null, 2) + "\n");
  // قاموس النطق للقناة («أعد نطق الكلمة»، src/voice/lexicon.ts): يبدأ فارغًا
  await writeFile(path.join(p.dir, "pronunciations.json"), JSON.stringify({ _note: LEXICON_NOTE, entries: [] }, null, 2) + "\n");

  const rules = base ? { ...base.rules } : { ...SAFE_NEW_CHANNEL_RULES };
  // الفحص الشرعي للتصوير لا يُورَّث مطفأً: قناة جديدة تبدأ به دائمًا حتى يقرر صاحبها غير ذلك
  rules.sacredFigures = true;
  const quran = opts.quran ?? rules.quran;
  const masterTheme = base?.masterTheme ?? "paper";
  const channel: ChannelConfig = {
    id: opts.id,
    name: opts.name,
    nameLatin: opts.nameLatin ?? opts.id,
    language: opts.language,
    description: "",
    masterTheme,
    logo: { type: "letter", letter: [...opts.name.trim()][0] ?? "؟" },
    domains: { general: { name: "عام", theme: masterTheme, tags: [] } },
    rules: { ...rules, quran, hadith: quran ? rules.hadith : false },
    // بلا افتتاحية وبصورة مصغّرة عامة حتى تُعتمد هوية القناة؛ وتوقيع الوصف يكتبه صاحب القناة
    brand: { intro: "none", thumbnail: "circle" },
    youtube: { tags: [opts.name.replace(/\s+/g, "_")], postingTime: base?.youtube.postingTime ?? "19:00", footer: "" },
  };
  await writeFile(p.channelFile, JSON.stringify(channel, null, 2) + "\n");
  return p.dir;
};
