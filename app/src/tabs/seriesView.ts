/** Presentation-only helpers for the channel's series and categories (no fetching, no writes). */
import { GENERAL_SLUG, SERIES_KIND_AR, ancestry, seriesTree, type SeriesConfig, type SeriesNode } from "../../../src/channel/series";

export type SeriesEpisode = { id: string; series?: string; title?: string; dir?: string; seriesNumber?: number | null };

/** The series an episode belongs to («عام» when none). */
export const seriesOfEpisode = (e: SeriesEpisode) => e.series || GENERAL_SLUG;

/** Every id under a node (itself included): a category's episodes include its series'. */
export const subtreeIds = (id: string, all: SeriesConfig[]): Set<string> => {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const s of all) if (s.parent && out.has(s.parent) && !out.has(s.id)) { out.add(s.id); grew = true; }
  }
  return out;
};

/** Episodes in a series (or a category and everything under it); a series is ordered by its number, then id. */
export const episodesIn = <T extends SeriesEpisode>(id: string, all: SeriesConfig[], eps: readonly T[]): T[] => {
  const ids = subtreeIds(id, all);
  const s = all.find((x) => x.id === id);
  const list = eps.filter((e) => ids.has(seriesOfEpisode(e)));
  return s?.kind === "series"
    ? [...list].sort((a, b) => (a.seriesNumber ?? 9999) - (b.seriesNumber ?? 9999) || a.id.localeCompare(b.id, undefined, { numeric: true }))
    : [...list].sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true }));
};

/** The grid: active top-level nodes first (archived last), each with its nested children. */
export const seriesGrid = (all: SeriesConfig[]): SeriesNode[] => seriesTree(all);

/** «تصنيف ← سلسلة» path names for a breadcrumb. */
export const breadcrumb = (id: string, all: SeriesConfig[]) => ancestry(id, all).map((x) => all.find((s) => s.id === x)!).filter(Boolean);

export const kindAr = (s: Pick<SeriesConfig, "kind">) => SERIES_KIND_AR[s.kind];

/** The episode picker grouped by series («عام» last). */
export const groupEpisodes = <T extends SeriesEpisode>(eps: readonly T[], all: SeriesConfig[]): { id: string; name: string; episodes: T[] }[] => {
  const groups = new Map<string, T[]>();
  for (const e of eps) {
    const k = seriesOfEpisode(e);
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  const name = (id: string) => all.find((s) => s.id === id)?.name ?? (id === GENERAL_SLUG ? "عام" : id);
  return [...groups.entries()]
    .sort(([a], [b]) => Number(a === GENERAL_SLUG) - Number(b === GENERAL_SLUG) || name(a).localeCompare(name(b), "ar"))
    .map(([id, list]) => ({ id, name: name(id), episodes: list }));
};

/** Where a series may move: any category not under it and not too deep (the server checks again). */
export const parentChoices = (s: SeriesConfig, all: SeriesConfig[], maxDepth: number): SeriesConfig[] => {
  const below = subtreeIds(s.id, all);
  const height = (id: string): number => Math.max(0, ...all.filter((x) => x.parent === id).map((x) => 1 + height(x.id)));
  return all.filter((p) => p.kind === "category" && !below.has(p.id) && p.status !== "archived" && ancestry(p.id, all).length + 1 + height(s.id) <= maxDepth);
};

/** A new id from the Arabic name is not possible; suggest one from the latin field, else «series-N». */
export const suggestSlug = (latin: string, all: SeriesConfig[]): string => {
  const base = latin.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "series";
  let id = base, n = 2;
  while (all.some((s) => s.id === id)) id = `${base}-${n++}`;
  return id;
};
