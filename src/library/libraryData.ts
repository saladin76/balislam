/** Server-only (D206): يجمع مدخلات موضع الحلقات وقوائم التشغيل من الملفات (السلاسل، الحلقات، status.json، المجمّعات، السجلان). */
import path from "node:path";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { channelPaths } from "../channel";
import { episodesBySeries, listSeries } from "../channel/seriesStore";
import { LIBRARY_CHANNEL, readBooks, readScholars } from "./registry";
import { buildPlaylists, placeOf, type Compilation, type LibEpisode, type Place, type Playlist } from "./playlists";

const json = <T>(f: string): T | null => { try { return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as T) : null; } catch { return null; } };

/** حلقات قناة بعناوينها وحالة نشرها (بلا معامل 9xx ولا 000) */
export const libraryEpisodes = async (ch: string): Promise<LibEpisode[]> => {
  const dir = channelPaths(ch).episodes;
  return (await episodesBySeries(ch)).filter((e) => /^\d{3}$/.test(e.id) && e.id !== "000" && !e.id.startsWith("9")).map((e) => {
    const plan = json<{ title?: string }>(path.join(dir, e.dir, "plan.json"));
    const st = json<{ published?: { date?: string }; scheduled?: string }>(path.join(dir, e.dir, "status.json")) ?? {};
    const state: LibEpisode["state"] = st.published?.date ? { kind: "published", date: st.published.date } : st.scheduled ? { kind: "scheduled", date: st.scheduled } : { kind: "production" };
    return { id: e.id, series: e.series, ...(e.number ? { number: e.number } : {}), title: plan?.title?.trim() || e.dir, state };
  });
};

/** مجمّعات القناة المصنوعة (D167): channels/<القناة>/compilations/<الاسم>/manifest.json */
export const libraryCompilations = (ch: string): Compilation[] => {
  const dir = path.join(channelPaths(ch).dir, "compilations");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const m = json<{ title?: string; series?: string }>(path.join(dir, name, "manifest.json"));
    return m ? [{ name, title: m.title ?? name, ...(m.series ? { series: m.series } : {}) }] : [];
  });
};

export type LibraryRead = {
  scholars: ReturnType<typeof readScholars>["scholars"];
  books: ReturnType<typeof readBooks>["books"];
  places: Record<string, Place>;
  playlists: Playlist[];
};

/** كل ما تعرضه شاشة «المكتبة» لقناة السجلين («زبدة الكتب»)، ومواضع الحلقات وحدها لغيرها */
export const readLibrary = async (ch: string): Promise<LibraryRead> => {
  const scholars = readScholars().scholars;
  const books = readBooks().books;
  const series = listSeries(ch);
  const episodes = await libraryEpisodes(ch);
  const places = Object.fromEntries(episodes.map((e) => [e.id, placeOf(e, series, scholars, books)]));
  if (ch !== LIBRARY_CHANNEL) return { scholars, books, places, playlists: [] };
  const introTitle = (c: string, ep: string) => {
    try { return libraryTitleOf(c, ep); } catch { return undefined; }
  };
  return { scholars, books, places, playlists: buildPlaylists({ series, episodes, scholars, books, compilations: libraryCompilations(ch), introTitle }) };
};

/** عنوان حلقة في قناة أخرى (حلقة التعريف على «دفاتر الزمن») من خطتها */
export const libraryTitleOf = (ch: string, ep: string): string | undefined => {
  const dir = channelPaths(ch).episodes;
  if (!existsSync(dir)) return undefined;
  const d = readdirSync(dir).find((x) => x.startsWith(`${ep}-`));
  return d ? json<{ title?: string }>(path.join(dir, d, "plan.json"))?.title : undefined;
};
