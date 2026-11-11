import path from "node:path";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { channelPaths, currentChannelId, loadChannel } from "./index";
import { channelLibrary } from "./library";
import { listScriptEpisodeDirs } from "../script/episodes";
import { toneIds } from "../voice/tones";
import { findTraces } from "../package/traces";
import { writeJsonAtomic } from "../io/atomicJson";
import {
  GENERAL_SLUG, SLUG_RE, deriveSeriesIdentity, stampSeries, validateSeries, withGeneral,
  type SeriesConfig, type SeriesContext, type SeriesStamp,
} from "./series";

/**
 * حفظ السلاسل والتصنيفات على القرص (`channels/<القناة>/series/<المعرّف>/series.json`، يُحفظ في Git)،
 * وانتماء الحلقة إلى سلسلتها في `channels/<القناة>/episodes/<المجلد>/series.json` بجوار السكريبت
 * (لا يُعدَّل script.md، فلا تتغير بصمة السكريبت ولا اعتماده). حلقة بلا هذا الملف في «عام».
 */
export const seriesDir = (ch = currentChannelId()) => path.join(channelPaths(ch).dir, "series");
const fileOf = (ch: string, id: string) => path.join(seriesDir(ch), id, "series.json");
export const EPISODE_SERIES_FILE = "series.json";

export const seriesContext = (ch = currentChannelId()): SeriesContext => {
  const c = loadChannel(ch);
  return { channelId: ch, styles: c.styles ?? [], templates: channelLibrary(c).templates, tones: [...toneIds], traces: findTraces };
};

/** السلاسل المحفوظة (بلا «عام» الافتراضي) */
export const readSeriesFiles = (ch = currentChannelId()): SeriesConfig[] => {
  const dir = seriesDir(ch);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((d) => SLUG_RE.test(d) && existsSync(fileOf(ch, d))).map((d) => JSON.parse(readFileSync(fileOf(ch, d), "utf8")) as SeriesConfig);
};

/** كل سلاسل القناة ومعها «عام» (افتراضيًا بلا ملف) */
export const listSeries = (ch = currentChannelId()): SeriesConfig[] => withGeneral(readSeriesFiles(ch));

export const getSeries = (ch: string, id: string): SeriesConfig | undefined => listSeries(ch).find((s) => s.id === id);

export type EpisodeSeriesLink = { series: string; stamp?: SeriesStamp };

/** سلسلة الحلقة من ملفها بجوار السكريبت، وإلا «عام» */
export const episodeSeriesOf = (episodeDir: string): EpisodeSeriesLink => {
  const f = path.join(episodeDir, EPISODE_SERIES_FILE);
  if (!existsSync(f)) return { series: GENERAL_SLUG };
  try {
    const x = JSON.parse(readFileSync(f, "utf8")) as EpisodeSeriesLink;
    return SLUG_RE.test(x.series ?? "") ? x : { series: GENERAL_SLUG };
  } catch {
    return { series: GENERAL_SLUG };
  }
};

/** مجلدات حلقات القناة مع سلسلة كل منها */
export const episodesBySeries = async (ch = currentChannelId()): Promise<{ id: string; dir: string; series: string; number?: number }[]> => {
  const eps = channelPaths(ch).episodes;
  return (await listScriptEpisodeDirs(eps)).map((d) => {
    const link = episodeSeriesOf(path.join(eps, d));
    return { id: d.slice(0, 3), dir: d, series: link.series, ...(link.stamp?.number ? { number: link.stamp.number } : {}) };
  });
};

export class SeriesError extends Error {
  constructor(public issues: string[]) { super(issues.join(" ")); }
}

/** يحفظ سلسلة جديدة أو معدّلة بعد التحقق (الاسم، الأب، التداخل، القالب، الآثار، وهويتها مشتقة بلا خطأ) */
export const saveSeries = async (ch: string, s: SeriesConfig): Promise<SeriesConfig> => {
  const all = listSeries(ch);
  const clean: SeriesConfig = { ...s, version: 1, name: s.name?.trim(), status: s.status ?? "active" };
  delete clean.virtual;
  if (clean.parent === "") delete clean.parent;
  const issues = validateSeries(clean, all, seriesContext(ch));
  if (clean.id === GENERAL_SLUG && clean.parent) issues.push("«عام» في أعلى القناة ولا يُنقل.");
  if (clean.id === GENERAL_SLUG && clean.kind !== "category") issues.push("«عام» تصنيف.");
  if (clean.id === GENERAL_SLUG && clean.status === "archived") issues.push("«عام» لا يُؤرشف: فيه كل حلقة بلا سلسلة.");
  if (issues.length) throw new SeriesError(issues);
  // الهوية تُقصّ إلى هوية القناة قبل الحفظ (لا يُحفظ لون أو زخرفة أو جزء شعار من خارجها)
  const d = deriveSeriesIdentity(ch, clean.identity ?? {});
  clean.identity = {
    ...clean.identity,
    accent: { base: d.accentBase, ...(clean.identity?.accent?.lightness !== undefined ? { lightness: Math.max(-0.15, Math.min(0.15, clean.identity.accent.lightness)) } : {}), ...(clean.identity?.accent?.chroma !== undefined ? { chroma: Math.max(0.8, Math.min(1.15, clean.identity.accent.chroma)) } : {}) },
    motif: d.motif,
    title: d.title,
    intro: d.intro,
    thumbnail: d.thumbnail,
    emblem: { parts: d.emblem.parts },
  };
  const f = fileOf(ch, clean.id);
  await mkdir(path.dirname(f), { recursive: true });
  await writeFile(f, JSON.stringify(clean, null, 2) + "\n", "utf8");
  return clean;
};

/** يحذف سلسلة فارغة فقط: لا حلقات فيها ولا سلاسل تحتها، و«عام» لا يُحذف */
export const deleteSeries = async (ch: string, id: string): Promise<void> => {
  if (id === GENERAL_SLUG) throw new SeriesError(["«عام» لا يُحذف: فيه كل حلقة بلا سلسلة."]);
  const s = readSeriesFiles(ch).find((x) => x.id === id);
  if (!s) throw new SeriesError([`السلسلة «${id}» غير موجودة.`]);
  const eps = (await episodesBySeries(ch)).filter((e) => e.series === id);
  if (eps.length) throw new SeriesError([`في «${s.name}» ${eps.length} حلقة؛ انقلها إلى سلسلة أخرى أولًا ثم احذفها.`]);
  const kids = readSeriesFiles(ch).filter((x) => x.parent === id);
  if (kids.length) throw new SeriesError([`تحت «${s.name}» ${kids.map((k) => `«${k.name}»`).join("، ")}؛ انقلها أولًا.`]);
  await rm(path.dirname(fileOf(ch, id)), { recursive: true, force: true });
};

/** رقم الحلقة التالية في السلسلة */
export const nextNumberIn = async (ch: string, id: string): Promise<number> =>
  Math.max(0, ...(await episodesBySeries(ch)).filter((e) => e.series === id).map((e) => e.number ?? 0)) + 1;

/** يكتب انتماء حلقة جديدة إلى سلسلتها مع الختم (لحظة الإنشاء) */
export const linkNewEpisode = async (ch: string, episodeDir: string, seriesId: string): Promise<EpisodeSeriesLink> => {
  const s = getSeries(ch, seriesId);
  if (!s) throw new SeriesError([`السلسلة «${seriesId}» غير موجودة.`]);
  if (s.status === "archived") throw new SeriesError([`«${s.name}» مؤرشفة؛ أعدها نشطة قبل إضافة حلقة.`]);
  const link: EpisodeSeriesLink = { series: s.id, stamp: stampSeries(s, ch, s.kind === "series" ? await nextNumberIn(ch, s.id) : undefined) };
  await writeFile(path.join(episodeDir, EPISODE_SERIES_FILE), JSON.stringify(link, null, 2) + "\n", "utf8");
  return link;
};

/**
 * ينقل حلقة قائمة إلى سلسلة أخرى بقرار المالك: يُكتب ملف الانتماء وحده بختم جديد (script.md لا يُلمس).
 * الخطة القائمة يُحدَّث ختمها في plan.json للصورة المصغّرة والافتتاحية؛ ولا يمس المشاهد ولا بصمتها.
 */
export const moveEpisode = async (ch: string, episodeDir: string, seriesId: string): Promise<EpisodeSeriesLink> => {
  const s = getSeries(ch, seriesId);
  if (!s) throw new SeriesError([`السلسلة «${seriesId}» غير موجودة.`]);
  const file = path.join(episodeDir, EPISODE_SERIES_FILE);
  const current = episodeSeriesOf(episodeDir);
  if (current.series === s.id) return current; // نقلها إلى سلسلتها نفسها لا يغيّر رقمها ولا ختمها
  if (s.id === GENERAL_SLUG && s.virtual) {
    await rm(file, { force: true });
    await restampPlan(episodeDir, undefined);
    return { series: GENERAL_SLUG };
  }
  const link = await linkNewEpisode(ch, episodeDir, seriesId);
  await restampPlan(episodeDir, link.stamp);
  return link;
};

const restampPlan = async (episodeDir: string, stamp: SeriesStamp | undefined) => {
  const f = path.join(episodeDir, "plan.json");
  if (!existsSync(f)) return;
  const plan = JSON.parse(await readFile(f, "utf8")) as { series?: SeriesStamp };
  if (stamp) plan.series = stamp;
  else delete plan.series;
  await writeJsonAtomic(f, plan);
};
