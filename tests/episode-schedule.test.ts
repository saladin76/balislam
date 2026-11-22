/**
 * جدول الحلقات بقاعدة السلاسل (قرار المالك ٤): حلقة أسبوعيًا في يوم القناة وحتى ٣، كل حلقة من سلسلة مختلفة في الأسبوع،
 * وما أذن المالك بنشره وحده، وبترتيب السلسلة؛ والفجوة تقول ما ينقصها.
 */
import { describe, expect, it } from "vitest";
import { episodesMarkdown, firstLongDay, planEpisodes, sameSeriesWeeks, type EpisodeItem } from "../src/package/episodeSchedule";

const ep = (id: string, series: string, number?: number, ready = true): EpisodeItem => ({ id, series, ...(number ? { number } : {}), ready });
// ٢٢ نوفمبر ٢٠٢٦ أحد؛ السبت = ٦
const SAT = 6;

describe("جدول الحلقات", () => {
  it("أول يوم للقناة في التاريخ أو بعده", () => {
    expect(firstLongDay("2026-11-22", SAT)).toBe("2026-11-28");
    expect(firstLongDay("2026-11-28", SAT)).toBe("2026-11-28");
    expect(firstLongDay("2026-11-22", 1)).toBe("2026-11-23");
  });
  it("حلقة أسبوعيًا بترتيب السلسلة", () => {
    const w = planEpisodes({ from: "2026-11-22", weeks: 3, perWeek: 1, longDay: SAT, items: [ep("003", "adam", 2), ep("002", "adam", 1), ep("004", "nuh", 1)] });
    expect(w.map((x) => x.slots.map((s) => [s.date, s.episode?.id]))).toEqual([[["2026-11-28", "002"]], [["2026-12-05", "003"]], [["2026-12-12", "004"]]]);
  });
  it("حلقتان في الأسبوع من سلسلتين مختلفتين، ولا تجتمع سلسلة مرتين", () => {
    const w = planEpisodes({ from: "2026-11-28", weeks: 2, perWeek: 2, longDay: SAT, items: [ep("002", "adam", 1), ep("003", "adam", 2), ep("004", "nuh", 1)] });
    expect(w[0]!.slots.map((s) => [s.date, s.episode?.id ?? s.gap])).toEqual([["2026-11-28", "002"], ["2026-11-30", "004"]]);
    expect(w[1]!.slots.map((s) => s.episode?.id ?? s.gap)).toEqual(["003", "لا حلقة من سلسلة غير adam"]);
  });
  it("ما لم يُؤذن بنشره لا يُجدول، ولا تتقدمه حلقة بعده من سلسلته", () => {
    const w = planEpisodes({ from: "2026-11-28", weeks: 1, perWeek: 1, longDay: SAT, items: [ep("002", "adam", 1, false), ep("003", "adam", 2)] });
    expect(w[0]!.slots[0]).toEqual({ date: "2026-11-28", gap: "الحلقة 002 (adam) لم يُؤذن بنشرها بعد" });
  });
  it("المحدد في الأسبوع يدخل في الحساب: يأخذ خانة وسلسلته", () => {
    const w = planEpisodes({ from: "2026-11-28", weeks: 1, perWeek: 2, longDay: SAT, items: [ep("003", "adam", 2), ep("004", "nuh", 1)],
      dated: [{ id: "002", series: "adam", date: "2026-11-28" }] });
    expect(w[0]!.fixed.map((d) => d.id)).toEqual(["002"]);
    expect(w[0]!.slots.map((s) => s.episode?.id)).toEqual(["004"]);
  });
  it("«عام» سلسلة واحدة احتياطًا، والحد ٣ في الأسبوع", () => {
    const w = planEpisodes({ from: "2026-11-28", weeks: 1, perWeek: 9, longDay: SAT, items: [ep("002", "general"), ep("003", "general"), ep("004", "nuh", 1), ep("005", "hud", 1)] });
    expect(w[0]!.slots.map((s) => s.episode?.id)).toEqual(["002", "004", "005"]);
  });
  it("يكشف جدولًا يدويًا يجمع سلسلة مرتين في أسبوع", () => {
    expect(sameSeriesWeeks([{ id: "002", series: "adam", date: "2026-11-28" }, { id: "003", series: "adam", date: "2026-12-02" }, { id: "004", series: "adam", date: "2026-12-05" }], SAT))
      .toEqual([{ week: "2026-11-28", series: "adam", episodes: ["002", "003"] }]);
  });
  it("الملخص يسمّي أول فجوة", () => {
    const w = planEpisodes({ from: "2026-11-28", weeks: 2, perWeek: 1, longDay: SAT, items: [ep("002", "adam", 1)] });
    expect(episodesMarkdown("دفاتر الزمن", w, 1)).toContain("خانات ناقصة: 1، أولها 2026-12-05 (لا حلقة جاهزة)");
  });
});
