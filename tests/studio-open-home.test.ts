/**
 * D85 (owner decision 11 Nov): the Studio opens on «الرئيسية» of the last channel chosen. A reload while working
 * keeps the place; a link pasted or clicked during the session still opens its place.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { bootPlace, navigationKind, parseStudioHash, studioHash } from "../app/src/shell/route";

const src = (f: string) => readFileSync(path.join(__dirname, "..", f), "utf8");
const oldPlace = { channel: "zubdat-alkutub", episode: "001", tab: "episode" };
const perf = (type?: string, legacy?: number) => ({
  getEntriesByType: () => (type ? [{ type }] : []) as unknown as PerformanceEntryList,
  ...(legacy === undefined ? {} : { navigation: { type: legacy } }),
});

describe("فتح جديد ← الرئيسية", () => {
  it("an old hash and an old remembered step land on home of the last channel", () => {
    const b = bootPlace({ hash: "#/zubdat-alkutub/001/episode", navigation: "open", stored: oldPlace });
    expect(b).toEqual({ channel: "zubdat-alkutub", episode: "001", tab: "home" });
    expect(studioHash(b)).toBe("#/zubdat-alkutub/home");
  });
  // D156 (owner, 18 Nov): «رئيسية القناة اللي في الرابط». Was D85: the last channel chosen won over the hash.
  it("the channel the link names wins over the last channel chosen, on its home, without the other channel's episode", () => {
    const b = bootPlace({ hash: "#/balislam/002/storyboard", navigation: "open", stored: { channel: "dafatir-alzaman", episode: "003", tab: "review" } });
    expect(b).toEqual({ channel: "balislam", episode: undefined, tab: "home" });
    expect(studioHash(b)).toBe("#/balislam/home");
    // a link without a channel keeps the last channel and its episode
    expect(bootPlace({ hash: "", navigation: "open", stored: { channel: "dafatir-alzaman", episode: "003" } })).toEqual({ channel: "dafatir-alzaman", episode: "003", tab: "home" });
  });
  it("no stored channel: the hash names the channel; nothing at all: home with no channel", () => {
    expect(bootPlace({ hash: "#/balislam/001/episode", navigation: "open", stored: {} })).toEqual({ channel: "balislam", episode: undefined, tab: "home" });
    expect(bootPlace({ hash: "", navigation: "open", stored: { channel: null, episode: null, tab: null } })).toEqual({ channel: undefined, episode: undefined, tab: "home" });
  });
  it("a stored series page or settings page is not reopened either", () => {
    expect(bootPlace({ hash: "#/balislam/series/ramadan", navigation: "open", stored: { channel: "balislam", tab: "series" } }).tab).toBe("home");
    expect(bootPlace({ hash: "#/balislam/settings", navigation: "open", stored: { channel: "balislam", tab: "settings" } }).tab).toBe("home");
  });
});

describe("تحديث أثناء العمل ← المكان نفسه", () => {
  it("a reload keeps the channel, episode and step in the address bar", () => {
    expect(bootPlace({ hash: "#/zubdat-alkutub/001/episode", navigation: "reload", stored: { channel: "balislam", episode: "002", tab: "home" } }))
      .toEqual({ channel: "zubdat-alkutub", episode: "001", tab: "episode" });
    expect(bootPlace({ hash: "#/balislam/series/ramadan", navigation: "reload", stored: {} })).toEqual({ channel: "balislam", episode: undefined, tab: "series", series: "ramadan" });
  });
  it("a reload with no hash falls back to the place remembered locally (as before D85)", () => {
    expect(bootPlace({ hash: "", navigation: "reload", stored: oldPlace })).toEqual(oldPlace);
    expect(bootPlace({ hash: "", navigation: "reload", stored: { channel: "balislam", tab: "nonsense" } }).tab).toBe("home");
  });
  it("only a browser reload counts as a reload; navigate, back_forward and unknown are a fresh open", () => {
    expect(navigationKind(perf("reload"))).toBe("reload");
    expect(navigationKind(perf("navigate"))).toBe("open");
    expect(navigationKind(perf("back_forward"))).toBe("open");
    expect(navigationKind(perf("prerender"))).toBe("open");
    expect(navigationKind(perf(undefined, 1))).toBe("reload");
    expect(navigationKind(perf(undefined, 0))).toBe("open");
    expect(navigationKind(undefined)).toBe("open");
    expect(navigationKind({ getEntriesByType: () => { throw new Error("x"); } })).toBe("open");
  });
});

describe("رابط أثناء الجلسة يعمل", () => {
  it("a deliberate deep link (?link) opens its place on a fresh open", () => {
    expect(bootPlace({ hash: "#/balislam/001/episode", search: "?link", navigation: "open", stored: { channel: "zubdat-alkutub", tab: "home" } }))
      .toEqual({ channel: "balislam", episode: "001", tab: "episode" });
    expect(bootPlace({ hash: "#/balislam/001/review", search: "?link&n=3", navigation: "open", stored: {} }).tab).toBe("review");
    expect(bootPlace({ hash: "#/balislam/001/review", search: "?n=3", navigation: "open", stored: {} }).tab).toBe("home");
    expect(bootPlace({ hash: "#/balislam/001/review", search: "?linked", navigation: "open", stored: {} }).tab).toBe("home");
  });
  it("App boots through bootPlace and follows hashchange with parseStudioHash (not the boot rule)", () => {
    const app = src("app/src/App.tsx");
    expect(app).toMatch(/bootPlace\(\{\s*hash: window\.location\.hash,\s*search: window\.location\.search,\s*navigation: navigationKind\(\)/);
    expect(app).not.toMatch(/bootRoute\.\w+ \?\? \(store\.get/);
    const onHash = app.slice(app.indexOf("onHash.current = () => {"), app.indexOf('window.removeEventListener("hashchange"'));
    expect(onHash).toContain("parseStudioHash(window.location.hash)");
    expect(onHash).toContain("confirmLeaveScript()");
    expect(onHash).not.toContain("bootPlace");
    expect(app).toContain('window.addEventListener("hashchange", h)');
    // a pasted link is parsed to its place
    expect(parseStudioHash("#/zubdat-alkutub/001/episode")).toEqual({ channel: "zubdat-alkutub", episode: "001", tab: "episode" });
  });
  it("the channel is still remembered and no local data is removed", () => {
    const app = src("app/src/App.tsx");
    expect(app).toContain('store.set("bal-channel", channelId)');
    expect(app).not.toMatch(/localStorage\.(removeItem|clear)/);
    expect(app).toContain('window.addEventListener("beforeunload", h)');
  });
  it("the QA scripts open deep links with ?link", () => {
    for (const f of ["app/scripts/ui-audit.mjs", "app/scripts/scroll-qa.mjs"])
      for (const m of src(f).matchAll(/goto\(`\$\{origin\}\/([^`]*)`/g)) expect(m[1]!.startsWith("?link"), `${f}: ${m[1]}`).toBe(true);
  });
});
