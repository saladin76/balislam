import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { gregorianOf, hijriOf, ruleReadyBy, seasonDates, seasonsIssues, seasonViews, type Seasons } from "../src/studio/seasons";
import { isOwnerContentPath } from "../scripts/contentPaths.mjs";

const seed = JSON.parse(readFileSync("channels/balislam/seasons.json", "utf8")) as Seasons;

describe("مواسم السنة الهجرية (عمود «بالإسلام»، عاشرًا/٦)", () => {
  it("حساب أم القرى لـ١٤٤٨", () => {
    expect(gregorianOf(1448, 9, 1)).toBe("2027-02-08");
    expect(hijriOf("2027-03-09")).toEqual([1448, 10, 1]);
    expect(seasonDates("ramadan", 1448)).toEqual({ hijri: { from: "1448-09-01", to: "1448-09-29" }, gregorian: { from: "2027-02-08", to: "2027-03-08" } });
    expect(seasonDates("arafah", 1448).gregorian.from).toBe("2027-05-15");
    expect(seasonDates("hijri-new-year", 1449).gregorian.from).toBe("2027-06-06");
    expect(seasonDates("ashura", 1449).gregorian.from).toBe("2027-06-15");
    expect(ruleReadyBy("2027-02-08")).toBe("2026-12-28");
  });
  it("بذرة «بالإسلام» سليمة: رمضان ١٤٤٨ بحلقاته الأربع وموعد المالك أول يناير وسببه", () => {
    expect(seasonsIssues(seed)).toEqual([]);
    const r = seed.seasons.find((s) => s.id === "ramadan-1448")!;
    expect(r.readyBy).toBe("2027-01-01");
    expect(r.readyByNote).toBeTruthy();
    expect(r.episodes.map((e) => e.slot)).toEqual([1, 2, 3, 4]);
    expect(r.episodes.every((e) => e.title.trim())).toBe(true);
    expect(r.shorts?.[0]).toMatchObject({ name: "خطوة اليوم", count: 30 });
    expect(new Set(seed.seasons.map((s) => s.kind)).size).toBe(6);
  });
  it("لا مناسبة خارج المواسم المتفق عليها، ولا موعد أقل من ستة أسابيع بلا قرار مالك، ولا تاريخ بعيد عن الحساب", () => {
    const base = structuredClone(seed.seasons.find((s) => s.id === "dhul-hijja-ten-1448")!);
    expect(seasonsIssues({ version: 1, seasons: [{ ...base, id: "x", kind: "mawlid" as never }] }).join()).toContain("ليس من المواسم المتفق عليها");
    expect(seasonsIssues({ version: 1, seasons: [{ ...base, readyBy: "2027-04-20" }] }).join()).toContain("أسابيع");
    expect(seasonsIssues({ version: 1, seasons: [{ ...base, readyBy: "2027-04-20", readyByNote: "قرار المالك" }] })).toEqual([]);
    expect(seasonsIssues({ version: 1, seasons: [{ ...base, gregorian: { from: "2027-05-20", to: "2027-05-29" } }] }).join()).toContain("أم القرى");
    expect(seasonsIssues({ version: 1, seasons: [{ ...base, episodes: [{ slot: 1, title: "Claude" }] }] }).join()).toContain("القاعدة الأولى");
  });
  it("العدّ التنازلي والحالة", () => {
    const v = seasonViews(seed, "2026-11-23").find((s) => s.id === "ramadan-1448")!;
    expect(v).toMatchObject({ name: "رمضان", state: "upcoming", daysToStart: 77, daysToReady: 39, ruleReadyBy: "2026-12-28" });
    expect(seasonViews(seed, "2027-02-10").find((s) => s.id === "ramadan-1448")!.state).toBe("running");
  });
  it("الجدول محتوى مالك يُحفظ في main", () => {
    expect(isOwnerContentPath("channels/balislam/seasons.json")).toBe(true);
    expect(isOwnerContentPath("channels/balislam/seasons.json.tmp")).toBe(false);
  });
});
