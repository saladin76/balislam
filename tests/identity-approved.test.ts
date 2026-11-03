import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * قفل الهويات المعتمدة (٣ نوفمبر ٢٠٢٦، لوحة «هويات القنوات الثلاث»).
 * أي تعديل يغيّر هوية قناة أو يُدخل بصمة قناة في أخرى يفشل هنا، ولا يُغيَّر هذا الملف إلا باعتماد جديد من صاحب القناة.
 */
type Approved = {
  emblem: string;
  intro: string;
  thumbnail: string;
  fonts: { heading: string; body: string; wordmark: string };
  /** ألوان يجب أن تكون في الهوية */
  colors: string[];
  /** بصمة القناة: ألوان لا تظهر في أي قناة أخرى */
  signature: string[];
  motifs: string[];
};

const APPROVED: Record<string, Approved> = {
  balislam: {
    emblem: "mihrab",
    intro: "mihrab",
    thumbnail: "mihrab",
    fonts: { heading: "Aref Ruqaa", body: "Tajawal", wordmark: "Aref Ruqaa" },
    colors: ["#0B1F1C", "#C9A24A", "#F2B35B", "#F4EEE2", "#C2412D"],
    signature: ["#0B1F1C", "#C9A24A", "#F2B35B", "#C2412D", "#0E5B4B"],
    motifs: ["arches", "girih"],
  },
  "dafatir-alzaman": {
    emblem: "horizon-book",
    intro: "horizon",
    thumbnail: "horizon",
    fonts: { heading: "Amiri", body: "Tajawal", wordmark: "Amiri" },
    colors: ["#2A1E3F", "#E07A3F", "#F1E4CB", "#4A2E1F", "#D7372B", "#C8A15A"],
    signature: ["#2A1E3F", "#E07A3F", "#F1E4CB", "#4A2E1F", "#D7372B", "#F3C98B"],
    motifs: ["stars", "horizon", "ink-lines"],
  },
  "zubdat-alkutub": {
    emblem: "highlighter-z",
    intro: "highlighter",
    thumbnail: "highlighter",
    fonts: { heading: "Lalezar", body: "Tajawal", wordmark: "Lalezar" },
    colors: ["#FFFFFF", "#111111", "#E8F542"],
    signature: ["#E8F542", "#FF6B4A"],
    motifs: ["ruled"],
  },
};

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
        for (const c of a.colors) expect(text, c).toContain(c);
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
