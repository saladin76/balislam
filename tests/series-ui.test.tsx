/**
 * The series in the Studio (presentation only): the grid with nesting and counts, the episode filter helpers,
 * the series route, the band's series line, the picker grouped by series, and the publish kit's title pattern.
 */
import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SeriesGrid } from "../app/src/tabs/Series";
import { episodesIn, groupEpisodes, parentChoices, subtreeIds, suggestSlug } from "../app/src/tabs/seriesView";
import { parseStudioHash, studioHash } from "../app/src/shell/route";
import { Band } from "../app/src/shell/Band";
import { TopBar } from "../app/src/shell/TopBar";
import { STEPS } from "../app/src/shell/EpisodeSpine";
import type { Overview, SeriesRead } from "../app/src/api";
import { deriveSeriesIdentity, stampSeries, withGeneral, type SeriesConfig } from "../src/channel/series";
import { generatePublishKit } from "../src/package/social";
import { defaultChannel } from "../src/channel/types";
import type { Plan } from "../src/plan/types";

const noop = () => {};
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const cfg: SeriesConfig[] = withGeneral([
  { version: 1, id: "family", name: "الأسرة", kind: "category", order: 1 },
  { version: 1, id: "parents", name: "برّ الوالدين", kind: "series", parent: "family", order: 2 },
  { version: 1, id: "ramadan", name: "ليالي رمضان", kind: "series", order: 3 },
]);
const data: SeriesRead = { series: cfg.map((s) => ({ ...s, derived: deriveSeriesIdentity("balislam", s.identity ?? {}), episodes: 0 })), episodes: [], rules: null };
const ov = (id: string, series?: string, seriesNumber?: number): Overview => ({
  id, dir: `${id}-x`, title: `حلقة ${id}`, domain: "psychology", lang: "ar", check: { ok: true, errors: 0, warnings: 0, seconds: 60 }, scenes: 3, voice: { done: 0, total: 3 }, blocking: 0,
  package: { video: false, shorts: 0, thumbnails: 0, updatedAt: null }, planUpdatedAt: null, style: "", status: {}, series, seriesNumber,
  production: { script: true, storyboard: false, approvedScenes: 0, totalScenes: 3, canAssemble: false, assemblyApproved: false, masterApproved: false, publishAllowed: false },
});
const items = [ov("001"), ov("002", "parents", 1), ov("003", "parents", 2), ov("004", "ramadan", 1)];

describe("the series grid on the channel home", () => {
  const html = renderToStaticMarkup(<SeriesGrid data={data} items={items} onOpen={noop} onNew={noop} />);
  it("a card per series and category with its kind, count and next action; categories nest their series", () => {
    expect(html.match(/class="sr-card(?: [^"]*)?"/g)?.length).toBe(4);
    expect(text(html)).toContain("تصنيف الأسرة");
    expect(text(html)).toMatch(/سلسلة برّ الوالدين حلقتان/);
    expect(html).toMatch(/sr-kids[^>]*aria-label="داخل الأسرة"/);
    expect(text(html)).toContain("الحلقة ٢: راجع التجهيز");
  });
  it("«سلسلة جديدة» and «تصنيف جديد» are quiet buttons (the dock keeps the one filled button)", () => {
    expect(text(html)).toContain("سلسلة جديدة");
    expect(text(html)).toContain("تصنيف جديد");
    expect(html).not.toContain("btn primary");
  });
  it("every swatch is the series' derived accent from the channel palette", () => {
    for (const s of data.series) expect(html).toContain(s.derived!.accent);
  });
});

describe("series helpers", () => {
  it("a category's episodes include its series'; a series is ordered by its number", () => {
    expect([...subtreeIds("family", cfg)].sort()).toEqual(["family", "parents"]);
    expect(episodesIn("family", cfg, items).map((e) => e.id).sort()).toEqual(["002", "003"]);
    expect(episodesIn("parents", cfg, [items[2]!, items[1]!]).map((e) => e.id)).toEqual(["002", "003"]);
    expect(episodesIn("general", cfg, items).map((e) => e.id)).toEqual(["001"]);
  });
  it("the picker groups by series, «عام» last", () => {
    expect(groupEpisodes(items, cfg).map((g) => g.name)).toEqual(["برّ الوالدين", "ليالي رمضان", "عام"]);
  });
  it("a series may move only into a category not under it", () => {
    expect(parentChoices(cfg.find((s) => s.id === "ramadan")!, cfg, 3).map((s) => s.id)).toEqual(["family", "general"]);
    expect(parentChoices(cfg.find((s) => s.id === "family")!, cfg, 3).map((s) => s.id)).toEqual(["general"]);
    expect(suggestSlug("Ramadan Nights", cfg)).toBe("ramadan-nights");
    expect(suggestSlug("ramadan", cfg)).toBe("ramadan-2");
  });
  it("a series page has its own link", () => {
    expect(studioHash({ channel: "balislam", tab: "series", series: "ramadan" })).toBe("#/balislam/series/ramadan");
    expect(parseStudioHash("#/balislam/series/ramadan")).toEqual({ channel: "balislam", tab: "series", series: "ramadan" });
    expect(parseStudioHash("#/balislam/series/Bad Id")).toEqual({ channel: "balislam" });
  });
});

describe("the band and the header", () => {
  it("the band shows the current series under the channel name", () => {
    const html = renderToStaticMarkup(<Band channels={[]} channelId="balislam" channelName="بالإسلام" onChannel={noop} onHome={noop}
      episode={{ id: "002", title: "ع" }} steps={{ done: [false, false, false, false], here: 0 }} stepTitles={STEPS.map((s) => s.title)} onStep={noop}
      series={{ id: "parents", name: "برّ الوالدين", kind: "سلسلة" }} manage={[]} active="storyboard" onManage={noop} />);
    expect(html).toMatch(/class="ms-band-series"[^>]*aria-label="سلسلة برّ الوالدين"/);
  });
  it("the episode picker groups episodes by series", () => {
    const eps = items.map((e) => ({ id: e.id, dir: e.dir, title: e.title, domain: e.domain, hasPlan: true, series: e.series }));
    const html = renderToStaticMarkup(<TopBar episodes={eps} episodeId="002" onEpisode={noop} views={[]} scheme="light" onToggleScheme={noop}
      seriesNames={Object.fromEntries(cfg.map((s) => [s.id, s.name]))} />);
    expect([...html.matchAll(/<optgroup label="([^"]+)"/g)].map((m) => m[1])).toEqual(["برّ الوالدين", "ليالي رمضان", "عام"]);
  });
});

describe("the publish kit reads the episode's series", () => {
  const base: Plan = { version: 1, episode: "004", title: "لماذا نصوم؟", domain: "psychology", themeId: "paper", updatedAt: "", chapters: [{ number: 1, title: "السؤال", scenes: [{ id: "c1-s1", template: "big-question", narration: "لماذا نصوم كل عام؟ سؤال قديم.", line: 1, props: {}, sfx: [] }] }] } as unknown as Plan;
  const script = '---\ntitle: "لماذا نصوم؟"\ndomain: psychology\nepisode: "004"\n---\n\n## الفصل 1 · السؤال\n\nلماذا نصوم كل عام؟\n';
  it("the title pattern, the series tags and the playlist; without a series nothing changes", () => {
    const stamp = stampSeries({ version: 1, id: "ramadan", name: "ليالي رمضان", kind: "series", template: { publish: { titlePattern: "{series} | الحلقة {n}: {title}", tags: ["رمضان_كريم"] } } }, "balislam", 4);
    const kit = generatePublishKit({ ...base, series: stamp }, script, undefined, defaultChannel);
    expect(kit.long.titles[0]!.text).toBe("ليالي رمضان | الحلقة ٤: لماذا نصوم؟");
    expect(kit.long.tags[0]).toBe("رمضان_كريم");
    expect(kit.long.playlist).toBe("ليالي رمضان");
    const plain = generatePublishKit(base, script, undefined, defaultChannel);
    expect(plain.long.titles[0]!.text).toBe("لماذا نصوم؟");
    expect(plain.long.playlist).toBeUndefined();
  });
});

describe("docs and isolation", () => {
  it("CLAUDE.md and the interface doc describe series", () => {
    expect(readFileSync("CLAUDE.md", "utf8")).toContain("السلاسل والتصنيفات");
    expect(readFileSync("docs/studio-interface.md", "utf8")).toContain("السلاسل والتصنيفات");
  });
});
