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

// ———————— Moving episodes between series (D77): the dialog's tree, the selection, drag and drop ————————

export type MoveTargetRow = { id: string; name: string; kind: SeriesConfig["kind"]; depth: number; path: string; accent?: string; current: boolean; match: boolean };

/** Arabic search key: no tashkeel or tatweel, one alef, ه for ة, ي for ى, case-free latin. */
export const searchKey = (s: string) => s.normalize("NFKC").replace(/[ً-ٰٟـ]/g, "").replace(/[إأآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").toLowerCase().trim();

/**
 * The move dialog's tree: every active series and category in grid order with its depth and swatch; the
 * current one marked. A search keeps the matches and their parents (for context, still choosable).
 */
export const moveTargetRows = (all: (SeriesConfig & { derived?: { accent: string } | null })[], query = "", current?: string): MoveTargetRow[] => {
  const rows: MoveTargetRow[] = [];
  const walk = (nodes: SeriesNode[], depth: number) => {
    for (const n of nodes) {
      if (n.status === "archived") continue;
      const s = all.find((x) => x.id === n.id);
      rows.push({ id: n.id, name: n.name, kind: n.kind, depth, path: breadcrumb(n.id, all).map((x) => x.name).join(" ← "), accent: s?.derived?.accent, current: n.id === current, match: true });
      walk(n.children, depth + 1);
    }
  };
  walk(seriesTree(all), 0);
  const q = searchKey(query);
  if (!q) return rows;
  const hits = new Set(rows.filter((r) => searchKey(r.name).includes(q)).map((r) => r.id));
  const keep = new Set<string>();
  for (const id of hits) for (const a of ancestry(id, all)) keep.add(a);
  return rows.filter((r) => keep.has(r.id)).map((r) => ({ ...r, match: hits.has(r.id) }));
};

/** «انقل المحدّد (٣)» */
export const selectionLabel = (n: number) => `انقل المحدّد (${n.toLocaleString("ar-EG")})`;

/** The series every given episode is in, when they share one (the dialog marks it «الحالية»). */
export const sharedSeries = (ids: readonly string[], eps: readonly SeriesEpisode[]): string | undefined => {
  const set = new Set(ids.map((id) => seriesOfEpisode(eps.find((e) => e.id === id) ?? { id })));
  return set.size === 1 ? [...set][0] : undefined;
};

/** The drag payload's type: only rows of this Studio carry it (a dragged file or text never moves anything). */
export const EPISODE_DRAG_TYPE = "application/x-bal-episodes";

/** Dragging a selected row drags the whole selection; an unselected row drags itself alone. */
export const dragEpisodes = (id: string, selected: ReadonlySet<string>): string[] =>
  selected.has(id) ? [...selected].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })) : [id];

export const encodeDrag = (ids: readonly string[]) => JSON.stringify({ episodes: ids });
/** The episodes in a drop, or null when it is not a valid Studio row drag. */
export const decodeDrag = (raw: string | undefined | null): string[] | null => {
  if (!raw) return null;
  try {
    const x = JSON.parse(raw) as { episodes?: unknown };
    const ids = Array.isArray(x.episodes) ? x.episodes.map(String) : [];
    return ids.length && ids.every((id) => /^\d{3}$/.test(id)) ? [...new Set(ids)] : null;
  } catch { return null; }
};

/** Whether the dragged episodes may drop on a card: never on an archived one, nor where they all already are. */
export const dropVerdict = (target: SeriesConfig | undefined, ids: readonly string[], eps: readonly SeriesEpisode[]): { ok: boolean; reason?: string } => {
  if (!target) return { ok: false, reason: "غير موجودة" };
  if (!ids.length) return { ok: false };
  if (target.status === "archived") return { ok: false, reason: "مؤرشفة" };
  if (ids.every((id) => seriesOfEpisode(eps.find((e) => e.id === id) ?? { id }) === target.id)) return { ok: false, reason: "هي فيها" };
  return { ok: true };
};
