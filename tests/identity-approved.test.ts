import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { APPROVED_IDENTITIES } from "../brand/identity/approved";

/**
 * قفل الهويات المعتمدة (٣ نوفمبر ٢٠٢٦، لوحة «هويات القنوات الثلاث»).
 * أي تعديل يغيّر هوية قناة أو يُدخل بصمة قناة في أخرى يفشل هنا، ولا يُغيَّر هذا الملف إلا باعتماد جديد من صاحب القناة.
 */
const APPROVED = APPROVED_IDENTITIES;

const load = (ch: string, f: string) => JSON.parse(readFileSync(`channels/${ch}/${f}`, "utf8"));

describe("الهويات المعتمدة", () => {
  for (const [ch, a] of Object.entries(APPROVED)) {
    describe(ch, () => {
      const channel = load(ch, "channel.json");
      const identity = load(ch, "identity.json");
      const text = JSON.stringify(identity).toUpperCase();

      it("الشعار والافتتاحية والصورة المصغّرة", () => {
        expect(channel.logo).toEqual({ type: "emblem", emblem: a.emblem });
        expect(channel.brand.intro).toBe(a.intro);
        expect(channel.brand.thumbnail).toBe(a.thumbnail);
      });

      it("الخطوط", () => expect(identity.fonts).toEqual(a.fonts));

      it("الألوان المعتمدة موجودة", () => {
        for (const { hex } of a.palette) expect(text, hex).toContain(hex);
      });

      it("لا لون خارج الهوية المعتمدة (لا بقايا هويات قديمة)", () => {
        const allowed = new Set([...a.palette.map((p) => p.hex), ...a.signature, ...a.derived].map((x) => x.toUpperCase()));
        const used = new Set((text.match(/#[0-9A-F]{6}/g) ?? []));
        expect([...used].filter((h) => !allowed.has(h))).toEqual([]);
      });

      it("زخارف الخلفية من زخارف القناة فقط", () => {
        for (const [id, t] of Object.entries<{ motif: string }>(identity.themes)) expect(a.motifs, `${ch}/${id}`).toContain(t.motif);
      });

      it("لا بصمة لقناة أخرى", () => {
        for (const [other, b] of Object.entries(APPROVED)) {
          if (other === ch) continue;
          for (const c of b.signature) expect(text, `${c} من ${other}`).not.toContain(c);
          expect(identity.fonts.heading).not.toBe(b.fonts.heading);
        }
      });

      it("الهوية الافتراضية مطابقة للحالية", () => expect(load(ch, "identity.default.json")).toEqual(identity));
    });
  }
});

describe("القناة الجديدة", () => {
  it("تبدأ بهوية محايدة بلا بصمة أي قناة معتمدة", async () => {
    const { neutralIdentity } = await import("../src/channel/create");
    for (const ch of Object.keys(APPROVED)) {
      const text = JSON.stringify(neutralIdentity(load(ch, "identity.default.json"))).toUpperCase();
      for (const a of Object.values(APPROVED)) for (const c of a.signature) expect(text, `${c} في هوية جديدة من ${ch}`).not.toContain(c);
      expect(text).not.toContain("FONTS");
    }
  });
});

describe("السلاسل والتصنيفات: هوية مشتقة من هوية قناتها وحدها", () => {
  it("كل سلسلة محفوظة (channels/<القناة>/series) لا تُدخل لونًا ولا خطًا ولا زخرفة من خارج قناتها", async () => {
    const { existsSync, readdirSync } = await import("node:fs");
    const { colourAllowed, deriveSeriesIdentity, foreignColours } = await import("../src/channel/series");
    for (const [ch, a] of Object.entries(APPROVED)) {
      const dir = `channels/${ch}/series`;
      const files = existsSync(dir) ? readdirSync(dir).filter((d) => existsSync(`${dir}/${d}/series.json`)) : [];
      for (const id of files) {
        const s = JSON.parse(readFileSync(`${dir}/${id}/series.json`, "utf8"));
        const raw = JSON.stringify(s).toUpperCase();
        for (const hex of raw.match(/#[0-9A-F]{6}/g) ?? []) expect(colourAllowed(ch, hex), `${ch}/${id}: ${hex}`).toBe(true);
        for (const [other, b] of Object.entries(APPROVED)) if (other !== ch) expect(raw, `${ch}/${id}`).not.toContain(b.fonts.heading.toUpperCase());
        const d = deriveSeriesIdentity(ch, s.identity ?? {});
        expect(d.fonts).toEqual(a.fonts);
        expect(a.motifs).toContain(d.motif);
        expect(foreignColours(ch).has(d.accent)).toBe(false);
      }
    }
  });
  it("الاشتقاق لا يغيّر الهوية المعتمدة نفسها (الهويات ما زالت مقفلة)", async () => {
    const before = JSON.stringify(APPROVED);
    const { deriveSeriesIdentity } = await import("../src/channel/series");
    for (const ch of Object.keys(APPROVED)) deriveSeriesIdentity(ch, { accent: { base: "#FFFFFF", lightness: 0.15 }, motif: "girih" });
    expect(JSON.stringify(APPROVED)).toBe(before);
  });
});
