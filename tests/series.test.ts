/**
 * السلاسل والتصنيفات داخل القناة (طلب صاحب القناة، ١١ نوفمبر): النموذج والتداخل، اشتقاق الهوية وقصّها إلى هوية
 * القناة، ختم الحلقة الجديدة، «عام» للحلقات القائمة، عزل المكتبة، نمط عنوان النشر، والافتتاحية والمصغّرة.
 */
import os from "node:os";
import path from "node:path";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { APPROVED_IDENTITIES } from "../brand/identity/approved";
import {
  GENERAL_SLUG, MAX_DEPTH, accentChoices, applyChapterTitles, colourAllowed, deriveSeriesIdentity, effectiveTemplate, foreignColours,
  nextStyle, publishTitle, seriesPublish, seriesTree, shade, stampSeries, validateSeries, withGeneral, withSeriesStamp,
  type SeriesConfig, type SeriesContext,
} from "../src/channel/series";
import { channelLibrary } from "../src/channel/library";
import { loadChannel } from "../src/channel";
import { toneIds } from "../src/voice/tones";
import { findTraces } from "../src/package/traces";
import { introFramesFor, introFrames } from "../src/remotion/scenes/ChannelIntro";
import { SERIES_STING_FRAMES, SeriesBadge, SeriesTitleCard, stingOn } from "../src/remotion/series/SeriesArt";

const CHANNELS = Object.keys(APPROVED_IDENTITIES);
const ctxFor = (ch: string): SeriesContext => {
  const c = loadChannel(ch);
  return { channelId: ch, styles: c.styles ?? [], templates: channelLibrary(c).templates, tones: [...toneIds], traces: findTraces };
};
const S = (over: Partial<SeriesConfig>): SeriesConfig => ({ version: 1, id: "x", name: "س", kind: "series", ...over });

describe("نموذج السلسلة والتداخل", () => {
  const ctx = ctxFor("balislam");
  it("المعرّف والاسم والنوع", () => {
    expect(validateSeries(S({ id: "Ramadan Nights" }), [], ctx).join()).toContain("معرّف");
    expect(validateSeries(S({ name: " " }), [], ctx).join()).toContain("اسم السلسلة مطلوب");
    expect(validateSeries(S({ kind: "x" as never }), [], ctx).join()).toContain("النوع");
    expect(validateSeries(S({ id: "ramadan", name: "ليالي رمضان" }), [], ctx)).toEqual([]);
  });
  it("الأب تصنيف موجود، ولا دورة، والعمق ٣ على الأكثر، والسلسلة لا تحوي غيرها", () => {
    const a = S({ id: "a", name: "أ", kind: "category" });
    const b = S({ id: "b", name: "ب", kind: "category", parent: "a" });
    const c = S({ id: "c", name: "ج", kind: "series", parent: "b" });
    expect(validateSeries(c, [a, b], ctx)).toEqual([]);
    expect(validateSeries(S({ id: "d", name: "د", parent: "c" }), [a, b, c], ctx).join()).toContain("تصنيفًا");
    expect(validateSeries(S({ id: "d", name: "د", kind: "category", parent: "nope" }), [a], ctx).join()).toContain("غير موجود");
    const deep = S({ id: "d", name: "د", kind: "category", parent: "b" });
    expect(validateSeries(S({ id: "e", name: "هـ", parent: "d" }), [a, b, deep], ctx).join()).toContain(`${MAX_DEPTH}`);
    expect(validateSeries({ ...a, parent: "b" }, [a, b], ctx).join()).toContain("أبًا لنفسه");
    expect(validateSeries({ ...b, kind: "series" }, [a, b, c], ctx).join()).toContain("لا تحوي");
  });
  it("الاسم لا يتكرر، ونصوص النشر بلا أثر لأدوات الإنتاج", () => {
    expect(validateSeries(S({ id: "y", name: "أ" }), [S({ id: "a", name: "أ" })], ctx).join()).toContain("مستعمل");
    expect(validateSeries(S({ template: { publish: { tags: ["ChatGPT"] } } }), [], ctx).join()).toContain("أدوات الإنتاج");
  });
  it("«عام» يُضاف افتراضيًا بلا ملف، والشجرة مرتبة والمؤرشفة آخرًا", () => {
    const list = withGeneral([S({ id: "z", name: "ز", status: "archived", order: 1 }), S({ id: "k", name: "ك", kind: "category", order: 5 }), S({ id: "m", name: "م", parent: "k" })]);
    expect(list.find((s) => s.id === GENERAL_SLUG)?.virtual).toBe(true);
    const t = seriesTree(list);
    expect(t.map((n) => n.id)).toEqual(["k", GENERAL_SLUG, "z"]);
    expect(t[0]!.children.map((n) => n.id)).toEqual(["m"]);
  });
});

describe("عزل المكتبة: قالب السلسلة من مكتبة قناتها وحدها", () => {
  it("لا أسلوب ولا قالب ولا نبرة من خارج القناة", () => {
    const z = ctxFor("zubdat-alkutub");
    expect(validateSeries(S({ template: { styles: ["alley"] } }), [], z).join()).toContain("أساليب القناة");
    const foreign = [...new Set(CHANNELS.flatMap((c) => ctxFor(c).templates))].find((t) => !z.templates.includes(t))!;
    expect(foreign).toBeTruthy();
    expect(validateSeries(S({ template: { shots: [foreign] } }), [], z).join()).toContain("مكتبة القناة");
    expect(validateSeries(S({ template: { tone: "whisper" } }), [], z).join()).toContain("النبرة");
    expect(validateSeries(S({ template: { styles: ["board"], shots: [z.templates[0]!], tone: "grave" } }), [], z)).toEqual([]);
    const b = ctxFor("balislam");
    expect(validateSeries(S({ template: { styles: ["doc-plate"] } }), [], b).join()).toContain("أساليب القناة");
  });
  it("القالب الافتراضي «قوي رزين» (D70)", () => {
    expect(effectiveTemplate({}).tone).toBe("grave");
    expect(effectiveTemplate({ tone: "documentary" }).tone).toBe("documentary");
  });
});

describe("اشتقاق هوية السلسلة وقصّها إلى هوية القناة", () => {
  for (const ch of CHANNELS) {
    const a = APPROVED_IDENTITIES[ch]!;
    it(`${ch}: خط القناة نفسه، ولون من لوحتها أو درجاتها، وزخرفة وأجزاء شعار منها`, () => {
      const d = deriveSeriesIdentity(ch, {
        accent: { base: "#123456", lightness: 0.9, chroma: 4 }, motif: "nope", emblem: { parts: ["arch", "book", "card", "x", "sun", "seal"] },
        title: { weight: "black" as never }, fonts: { heading: "Comic Sans" },
      } as never);
      expect(d.fonts).toEqual(a.fonts);
      expect(accentChoices(a)).toContain(d.accentBase);
      expect(colourAllowed(ch, d.accent)).toBe(true);
      expect(a.motifs).toContain(d.motif);
      expect(d.emblem.parts.length).toBeLessThanOrEqual(2);
      expect(d.title.weight).toBe("bold");
      expect(d.clamped.length).toBeGreaterThan(0);
    });
    it(`${ch}: لا لون لقناة أخرى في أي درجة مسموحة`, () => {
      const foreign = foreignColours(ch);
      for (const base of accentChoices(a)) for (const l of [-0.15, -0.07, 0, 0.07, 0.15]) for (const c of [0.8, 1, 1.15]) {
        const d = deriveSeriesIdentity(ch, { accent: { base, lightness: l, chroma: c } });
        expect(foreign.has(d.accent), `${ch} ${base} ${l} ${c} → ${d.accent}`).toBe(false);
        expect(foreign.has(d.paper) || foreign.has(d.ink)).toBe(false);
        expect(colourAllowed(ch, d.accent)).toBe(true);
      }
    });
    it(`${ch}: ألوان القنوات الأخرى مرفوضة لونًا أساسًا`, () => {
      for (const [other, b] of Object.entries(APPROVED_IDENTITIES)) {
        if (other === ch) continue;
        for (const hex of b.signature) {
          const d = deriveSeriesIdentity(ch, { accent: { base: hex } });
          expect(d.accentBase).not.toBe(hex.toUpperCase());
          expect(colourAllowed(ch, hex)).toBe(false);
        }
      }
    });
  }
  it("زبدة الكتب: الفسفوري للفكرة وحدها فلا يصير لون سلسلة", () => {
    expect(accentChoices(APPROVED_IDENTITIES["zubdat-alkutub"]!)).not.toContain("#E8F542");
    expect(deriveSeriesIdentity("zubdat-alkutub", { accent: { base: "#E8F542" } }).accent).not.toBe("#E8F542");
  });
  it("الدرجة تبقى في الحدود", () => {
    expect(shade("#C9A24A", 2, 9)).toBe(shade("#C9A24A", 0.15, 1.15));
    expect(colourAllowed("balislam", "#00FF00")).toBe(false);
  });
  it("قناة بلا هوية معتمدة لا تُشتق لها سلسلة", () => expect(() => deriveSeriesIdentity("new-channel", {})).toThrow());
});

describe("الختم وحزمة النشر", () => {
  const s = S({ id: "ramadan", name: "ليالي رمضان", template: { publish: { titlePattern: "{series} | الحلقة {n}: {title}", tags: ["رمضان", "#رمضان"] }, intro: "sting" } });
  it("نمط العنوان، وبلا رقم يسقط جزؤه", () => {
    expect(publishTitle("{series} | الحلقة {n}: {title}", { series: "ليالي رمضان", n: 3, title: "لماذا نصوم؟" })).toBe("ليالي رمضان | الحلقة 3: لماذا نصوم؟");
    expect(publishTitle("{series} | الحلقة {n}: {title}", { series: "الأسرة", title: "لماذا نصوم؟" })).toBe("الأسرة | لماذا نصوم؟");
    expect(publishTitle("", { series: "س", title: "ع" })).toBe("ع");
  });
  it("الختم يحمل الهوية المشتقة والقالب ورقم الحلقة، والحزمة تأخذ العنوان والوسوم وقائمة التشغيل", () => {
    const st = stampSeries(s, "balislam", 2, "2026-11-11T00:00:00Z");
    expect(st.number).toBe(2);
    expect(st.identity.fonts.heading).toBe("Aref Ruqaa");
    expect(st.template.tone).toBe("grave");
    const pub = seriesPublish({ title: "لماذا نصوم؟", series: st }, String);
    expect(pub).toEqual({ title: "ليالي رمضان | الحلقة 2: لماذا نصوم؟", tags: ["رمضان"], playlist: "ليالي رمضان" });
    expect(seriesPublish({ title: "ع" })).toEqual({ title: "ع", tags: [] });
  });
  it("الخطة الأولى تأخذ الختم؛ والخطة القائمة لا تتغير بتعديل السلسلة", () => {
    const st = stampSeries(s, "balislam", 1);
    type P = { title: string; tone?: string; intro?: boolean; series?: typeof st };
    const p0: P = { title: "ع" };
    const first = withSeriesStamp<P>(p0, null, st);
    expect(first.series).toBe(st);
    expect(first.tone).toBe("grave");
    const later = stampSeries({ ...s, name: "اسم جديد" }, "balislam", 1);
    expect(withSeriesStamp<P>(p0, first, later).series?.name).toBe("ليالي رمضان");
    const old = withSeriesStamp<P>(p0, p0, later);
    expect(old.series).toBeUndefined();
  });
  it("الافتتاحية: بطاقة السلسلة بعد افتتاحية القناة، والحلقة بلا ختم كما كانت", () => {
    const ch = { id: "balislam", name: "بالإسلام", nameLatin: "", language: "ar", brand: { intro: "mihrab" as const } };
    const st = stampSeries(s, "balislam", 1);
    expect(introFramesFor(ch, {})).toBe(introFrames("mihrab"));
    expect(stingOn(st)).toBe(true);
    expect(introFramesFor(ch, { series: st })).toBe(introFrames("mihrab") + SERIES_STING_FRAMES);
    expect(introFramesFor(ch, { series: { ...st, template: { intro: "channel" } } })).toBe(introFrames("mihrab"));
  });
  it("بطاقة العنوان والشارة بخط القناة ولون السلسلة وحدهما", () => {
    for (const ch of CHANNELS) {
      const d = deriveSeriesIdentity(ch, { thumbnail: { badge: "corner" } });
      const html = renderToStaticMarkup(React.createElement(React.Fragment, null,
        React.createElement(SeriesTitleCard, { d, name: "السلسلة", number: 2, width: 480, height: 270 }),
        React.createElement(SeriesBadge, { d, name: "السلسلة", number: 2 })));
      expect(html).toContain(APPROVED_IDENTITIES[ch]!.fonts.heading);
      expect(html).toContain('data-series-badge="corner"');
      const fonts = [...html.matchAll(/font-family:'([^']+)'/g)].map((m) => m[1]);
      expect(fonts.every((f) => f === APPROVED_IDENTITIES[ch]!.fonts.heading)).toBe(true);
      const hexes = new Set([...html.matchAll(/#[0-9A-Fa-f]{6}/g)].map((m) => m[0].toUpperCase()));
      for (const h of hexes) expect(foreignColours(ch).has(h), `${ch}: ${h}`).toBe(false);
    }
    expect(renderToStaticMarkup(React.createElement(SeriesBadge, { d: deriveSeriesIdentity("balislam", { thumbnail: { badge: "none" } }), name: "س" }))).toBe("");
  });
  it("عناوين فصول السلسلة والأسلوب بالتناوب (التنوع)", () => {
    const t = "## الفصل 1 · السؤال\n\nنص\n\n## الفصل 2 · الواقع\n";
    expect(applyChapterTitles(t, ["البداية"])).toBe("## الفصل 1 · البداية\n\nنص\n\n## الفصل 2 · الواقع\n");
    expect(nextStyle(["alley", "road"], "alley")).toBe("road");
    expect(nextStyle(["alley"], "alley")).toBe("alley");
    expect(nextStyle(undefined, "alley")).toBeUndefined();
  });
});

describe("الحفظ على القرص: «عام» للقائم، وختم الحلقة الجديدة، والحذف المرفوض", () => {
  let tmp = "";
  const ENV = ["BAL_CHANNELS_DIR", "BAL_CHANNEL"] as const;
  const saved: Record<string, string | undefined> = {};
  beforeAll(() => {
    for (const k of ENV) saved[k] = process.env[k];
    tmp = mkdtempSync(path.join(os.tmpdir(), "bal-series-"));
    for (const ch of CHANNELS) cpSync(path.join("channels", ch), path.join(tmp, ch), { recursive: true, filter: (s) => !/[\\/]episodes([\\/]|$)/.test(s) });
    // one existing episode with no series file: it is in «عام»
    const ep = path.join(tmp, "balislam", "episodes", "001-old");
    mkdirSync(ep, { recursive: true });
    writeFileSync(path.join(ep, "script.md"), '---\ntitle: "قديمة"\ndomain: psychology\nepisode: "001"\n---\n\n## الفصل 1 · السؤال\n\nنص.\n');
    process.env.BAL_CHANNELS_DIR = tmp;
    process.env.BAL_CHANNEL = "balislam";
  });
  afterAll(() => {
    for (const k of ENV) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
    rmSync(tmp, { recursive: true, force: true });
  });

  it("الحلقات القائمة في «عام» بلا كتابة أي ملف", async () => {
    const store = await import("../src/channel/seriesStore");
    expect(store.listSeries("balislam").map((s) => s.id)).toEqual([GENERAL_SLUG]);
    expect(await store.episodesBySeries("balislam")).toEqual([{ id: "001", dir: "001-old", series: GENERAL_SLUG }]);
    expect(existsSync(path.join(tmp, "balislam", "series"))).toBe(false);
  });

  it("سلسلة جديدة تُحفظ مقصوصة إلى هوية القناة، والحلقة الجديدة فيها تُختم لحظة إنشائها", async () => {
    const store = await import("../src/channel/seriesStore");
    const { createEpisode } = await import("../src/script/episodes");
    const s = await store.saveSeries("balislam", S({ id: "ramadan", name: "ليالي رمضان", identity: { accent: { base: "#E07A3F" } }, template: { styles: ["alley", "road"], chapters: { titles: ["الهلال"] }, publish: { titlePattern: "{series} | الحلقة {n}: {title}" } } }));
    expect(s.identity?.accent?.base).not.toBe("#E07A3F");
    expect(existsSync(path.join(tmp, "balislam", "series", "ramadan", "series.json"))).toBe(true);
    const file = await createEpisode({ episode: "002", slug: "moon", domain: "psychology", title: "الهلال", series: "ramadan" });
    const script = readFileSync(file, "utf8");
    expect(script).toContain("## الفصل 1 · الهلال");
    expect(script).toMatch(/^style: alley$/m);
    const link = JSON.parse(readFileSync(path.join(path.dirname(file), "series.json"), "utf8"));
    expect(link.series).toBe("ramadan");
    expect(link.stamp.number).toBe(1);
    expect(link.stamp.template.tone).toBe("grave");
    const second = await createEpisode({ episode: "003", slug: "moon-two", domain: "psychology", title: "ثانية", series: "ramadan" });
    expect(JSON.parse(readFileSync(path.join(path.dirname(second), "series.json"), "utf8")).stamp.number).toBe(2);
    // تعديل القالب لاحقًا لا يمس ختم الحلقة القائمة
    await store.saveSeries("balislam", { ...s, name: "رمضان", template: { ...s.template, tone: "documentary" } });
    expect(JSON.parse(readFileSync(path.join(path.dirname(file), "series.json"), "utf8")).stamp.name).toBe("ليالي رمضان");
    // الحلقة القديمة لم تُلمس
    expect(readdirSync(path.join(tmp, "balislam", "episodes", "001-old"))).toEqual(["script.md"]);
  });

  it("لا تُحذف سلسلة فيها حلقات؛ تُنقل أولًا ثم تُحذف، و«عام» لا يُحذف", async () => {
    const store = await import("../src/channel/seriesStore");
    await expect(store.deleteSeries("balislam", "ramadan")).rejects.toThrow(/انقلها/);
    await expect(store.deleteSeries("balislam", GENERAL_SLUG)).rejects.toThrow(/لا يُحذف/);
    const eps = path.join(tmp, "balislam", "episodes");
    const before = readFileSync(path.join(eps, "002-moon", "script.md"), "utf8");
    expect((await store.moveEpisode("balislam", path.join(eps, "002-moon"), "ramadan")).stamp?.number).toBe(1);
    for (const d of ["002-moon", "003-moon-two"]) await store.moveEpisode("balislam", path.join(eps, d), GENERAL_SLUG);
    expect(readFileSync(path.join(eps, "002-moon", "script.md"), "utf8")).toBe(before);
    await store.deleteSeries("balislam", "ramadan");
    expect(store.listSeries("balislam").map((x) => x.id)).toEqual([GENERAL_SLUG]);
  });

  it("سلسلة مؤرشفة لا تأخذ حلقة جديدة، و«عام» لا يُؤرشف", async () => {
    const store = await import("../src/channel/seriesStore");
    const { createEpisode } = await import("../src/script/episodes");
    await store.saveSeries("balislam", S({ id: "old", name: "قديمة", status: "archived" }));
    await expect(createEpisode({ episode: "004", slug: "x", domain: "psychology", title: "ع", series: "old" })).rejects.toThrow(/مؤرشفة/);
    await expect(store.saveSeries("balislam", { ...S({ id: GENERAL_SLUG, name: "عام", kind: "category" }), status: "archived" })).rejects.toThrow(/لا يُؤرشف/);
  });
});
