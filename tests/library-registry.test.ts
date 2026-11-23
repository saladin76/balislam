/**
 * D206 (عمود رفوف «زبدة الكتب»): سجل العلماء وسجل الكتب، وموضع الحلقة (الرف ← العالِم ← الكتاب ← الجزء)،
 * وقوائم التشغيل التلقائية. المدخلات مكتوبة هنا (لا قيم من حلقات المالك الحية)، إلا فحص صيغة ملفي البذرة.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { bookIssues, registryIssues, scholarIssues, type Book, type Scholar } from "../src/library/registry";
import { buildPlaylists, placeOf, playlistText, type LibEpisode } from "../src/library/playlists";
import type { SeriesConfig } from "../src/channel/series";
import { isOwnerContentPath } from "../scripts/contentPaths.mjs";

const ser = (id: string, kind: "series" | "category", parent?: string, name = id): SeriesConfig => ({ version: 1, id, name, kind, ...(parent ? { parent } : {}) });
const SERIES = [ser("turathna", "category", undefined, "تراثنا"), ser("imam-malik", "category", "turathna", "الإمام مالك"), ser("muwatta", "series", "imam-malik", "الموطأ"),
  ser("ibada", "category", undefined, "العبادة والقلب"), ser("osalli", "series", "ibada", "أول مرة أصلي"), ser("general", "category", undefined, "عام")];
const malik: Scholar = { id: "malik", name: "الإمام مالك بن أنس", died: { hijri: 179, gregorian: 795 }, place: "المدينة", field: "الحديث والفقه",
  review: { state: "not-started", doctrinalDispute: false }, series: "imam-malik", intro: { channel: "dafatir-alzaman", episode: "040" } };
const muwatta: Book = { id: "muwatta", title: "الموطأ", scholar: "malik", author: "الإمام مالك بن أنس", edition: { publisher: "", year: "", editor: "" }, parts: 2, series: "muwatta" };
const osalli: Book = { id: "osalli", title: "أول مرة أصلي", author: "د. خالد أبو شادي", edition: { publisher: "دار الراية", year: "2010", editor: "" }, parts: 3, series: "osalli" };
const pub = (date: string) => ({ kind: "published" as const, date });
const EPS: LibEpisode[] = [
  { id: "001", series: "osalli", number: 1, title: "تهيئة القلب للصلاة", state: pub("2026-11-25") },
  { id: "002", series: "osalli", number: 2, title: "معاني القراءة والركوع", state: { kind: "production" } },
  { id: "005", series: "muwatta", number: 2, title: "الموطأ ٢", state: pub("2026-12-09") },
  { id: "004", series: "muwatta", number: 1, title: "الموطأ ١", state: pub("2026-12-02") },
  { id: "006", series: "imam-malik", title: "خريطة كتب الإمام مالك", state: { kind: "production" } },
];

describe("سجل العلماء والكتب (D206)", () => {
  it("بوابة الاختيار: عالم عليه خلاف عقدي لا يُعتمد بلا تقرير متخصص", () => {
    expect(scholarIssues(malik)).toEqual([]);
    const disputed = { ...malik, review: { state: "owner-approved" as const, doctrinalDispute: true } };
    expect(scholarIssues(disputed).join(" ")).toContain("تقرير متخصص");
    expect(scholarIssues({ ...disputed, review: { ...disputed.review, report: "docs/reviews/x.md" } })).toEqual([]);
    expect(scholarIssues({ ...malik, review: { state: "report-written", doctrinalDispute: false } }).join(" ")).toContain("مسار التقرير");
  });
  it("الكتاب: العالِم من السجل، والأجزاء ١–٤٠ أو لم تُحدد، وبلا آثار أدوات", () => {
    expect(bookIssues(muwatta, [malik])).toEqual([]);
    expect(bookIssues({ ...muwatta, scholar: "x" }, [malik]).join(" ")).toContain("ليس في السجل");
    expect(bookIssues({ ...muwatta, parts: null }, [malik])).toEqual([]);
    expect(bookIssues({ ...muwatta, parts: 0 }, [malik]).length).toBe(1);
    expect(bookIssues({ ...muwatta, title: "ملخص ChatGPT" }, [malik]).join(" ")).toContain("القاعدة الأولى");
    expect(registryIssues({ version: 1, scholars: [malik, malik] }, null).join(" ")).toContain("مكرر");
  });
  it("ملفا البذرة صالحان، ومساراهما محتوى مالك يحفظه الاستوديو", () => {
    const dir = path.join(import.meta.dirname, "..", "channels/zubdat-alkutub/library");
    const s = JSON.parse(readFileSync(path.join(dir, "scholars.json"), "utf8"));
    const b = JSON.parse(readFileSync(path.join(dir, "books.json"), "utf8"));
    expect(registryIssues(s, b)).toEqual([]);
    expect(isOwnerContentPath("channels/zubdat-alkutub/library/scholars.json")).toBe(true);
    expect(isOwnerContentPath("channels/zubdat-alkutub/library/books.json")).toBe(true);
    expect(isOwnerContentPath("channels/zubdat-alkutub/library/other.json")).toBe(false);
  });
});

describe("موضع الحلقة: الرف ← العالِم ← الكتاب ← الجزء", () => {
  it("جزء من كتاب عالم", () => {
    expect(placeOf({ series: "muwatta", number: 2 }, SERIES, [malik], [muwatta, osalli])).toEqual({
      shelf: { id: "turathna", name: "تراثنا" }, scholar: { id: "malik", name: "الإمام مالك بن أنس", series: "imam-malik" },
      book: { id: "muwatta", title: "الموطأ", series: "muwatta", parts: 2 }, part: 2,
    });
  });
  it("كتاب لمؤلف معاصر بلا سلسلة عالم، وحلقة في سلسلة العالِم نفسها، وحلقة في «عام»", () => {
    expect(placeOf({ series: "osalli", number: 1 }, SERIES, [malik], [muwatta, osalli])).toMatchObject({ shelf: { id: "ibada" }, book: { id: "osalli" }, part: 1 });
    expect(placeOf({ series: "osalli", number: 1 }, SERIES, [malik], [muwatta, osalli]).scholar).toBeUndefined();
    expect(placeOf({ series: "imam-malik" }, SERIES, [malik], [muwatta])).toMatchObject({ shelf: { id: "turathna" }, scholar: { id: "malik" } });
    expect(placeOf({ series: "general" }, SERIES, [malik], [muwatta])).toEqual({});
  });
});

describe("قوائم التشغيل التلقائية (تُحسب ولا تُرفع، D53)", () => {
  const lists = (compilations = [] as { name: string; title: string; series?: string }[]) =>
    buildPlaylists({ series: SERIES, episodes: EPS, scholars: [malik], books: [muwatta, osalli], compilations, introTitle: () => "الإمام مالك: حياته وزمنه" });
  it("قائمة لكل كتاب وعالم ورف، والحلقات بترتيب أجزائها", () => {
    const l = lists();
    expect(l.map((p) => `${p.kind}:${p.id}`)).toEqual(["book:muwatta", "book:osalli", "scholar:malik", "shelf:turathna", "shelf:ibada"]);
    const book = l.find((p) => p.id === "muwatta")!;
    expect(book.items.map((i) => (i.kind === "episode" ? i.episode : ""))).toEqual(["004", "005"]);
    expect(l.find((p) => p.id === "osalli")!.notes).toEqual(["المخطط 3 أجزاء، والموجود 2."]);
  });
  it("قائمة العالِم: التعريف من «دفاتر الزمن» أولًا، وتنبيه التعاون، والكتاب المكتمل بمجمّعه مكان أجزائه", () => {
    const before = lists().find((p) => p.kind === "scholar")!;
    expect(before.items[0]).toMatchObject({ kind: "intro", channel: "dafatir-alzaman", episode: "040", title: "الإمام مالك: حياته وزمنه" });
    expect(before.items.filter((i) => i.kind === "episode").map((i) => (i as { episode: string }).episode)).toEqual(["004", "005", "006"]);
    expect(before.notes.join(" ")).toContain("Collaboration");
    const after = lists([{ name: "muwatta", title: "الموطأ كاملًا", series: "muwatta" }]).find((p) => p.kind === "scholar")!;
    expect(after.items.map((i) => i.kind)).toEqual(["intro", "compilation", "episode"]);
    expect(playlistText(after)).toContain("الفيديو المجمّع: الموطأ كاملًا");
  });
  it("لا أثر لأدوات الإنتاج في العنوان والوصف", () => {
    for (const p of lists()) expect(p.traces, p.id).toEqual([]);
  });
});
