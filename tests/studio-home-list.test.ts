import { describe, expect, it } from "vitest";
import { selectHomeCards, type HomeCardSummary } from "../app/src/tabs/homeList";

type Card = HomeCardSummary & { ready: boolean };
const items: Card[] = [
  { id: "002", title: "حلقة التجربة", dir: "002-test", domain: "quran", status: {}, ready: false },
  { id: "010", title: "حلقة معتمدة", dir: "010-approved", domain: "history", status: {}, ready: true },
  { id: "003", title: "المقدمة", dir: "003-intro", domain: "quran", status: { published: { date: "2026-11-05" } }, ready: true },
];
const select = (query = "", filter: "all" | "attention" | "ready" | "published" = "all", sort: "recent" | "oldest" | "title" = "recent") =>
  selectHomeCards(items, query, filter, sort, (item) => item.ready).map((item) => item.id);

describe("Shared studio episode-list UI selectors", () => {
  it("searches title, domain, slug and numeric episode IDs without modifying the source", () => {
    expect(select("التجربة")).toEqual(["002"]);
    expect(select("HISTORY")).toEqual(["010"]);
    expect(select("003")).toEqual(["003"]);
    expect(select("intro")).toEqual(["003"]);
    expect(items.map((i) => i.id)).toEqual(["002", "010", "003"]);
  });
  it("distinguishes unfinished, ready and published episodes", () => {
    expect(select("", "attention")).toEqual(["002"]);
    expect(select("", "ready")).toEqual(["010"]);
    expect(select("", "published")).toEqual(["003"]);
    expect(select("missing", "all")).toEqual([]);
  });
  it("sorts numeric episode IDs rather than lexical IDs", () => {
    expect(select()).toEqual(["010", "003", "002"]);
    expect(select("", "all", "oldest")).toEqual(["002", "003", "010"]);
  });
});
