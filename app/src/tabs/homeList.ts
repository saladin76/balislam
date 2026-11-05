/** Presentation-only selectors for the channel episode library. */
export type HomeCardFilter = "all" | "attention" | "ready" | "published";
export type HomeCardSort = "recent" | "oldest" | "title";

export type HomeCardSummary = {
  id: string;
  title?: string;
  dir: string;
  domain: string;
  status: { published?: unknown };
};

export const selectHomeCards = <T extends HomeCardSummary>(
  items: readonly T[],
  query: string,
  filter: HomeCardFilter,
  sort: HomeCardSort,
  isReady: (item: T) => boolean,
): T[] => {
  const term = query.trim().toLocaleLowerCase();
  return items.filter((item) => {
    const matches = !term || [item.id, item.title, item.dir, item.domain].some(
      (part) => String(part ?? "").toLocaleLowerCase().includes(term),
    );
    if (!matches) return false;
    const published = Boolean(item.status.published);
    return filter === "all" ||
      (filter === "published" && published) ||
      (filter === "ready" && !published && isReady(item)) ||
      (filter === "attention" && !published && !isReady(item));
  }).sort((a, b) =>
    sort === "title"
      ? (a.title || a.dir).localeCompare(b.title || b.dir, "ar")
      : sort === "oldest"
        ? a.id.localeCompare(b.id, undefined, { numeric: true })
        : b.id.localeCompare(a.id, undefined, { numeric: true }),
  );
};
