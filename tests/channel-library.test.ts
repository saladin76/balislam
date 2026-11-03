import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { channelLibrary, drawAllowed, elementExclusion, type LibraryRules } from "../src/channel/library";
import { beatsFor } from "../src/plan/beats";
import { planIssues } from "../src/plan/validate";
import type { Plan } from "../src/plan/types";

const ch = (id: string): LibraryRules => JSON.parse(readFileSync(`channels/${id}/channel.json`, "utf8"));
const balislam = ch("balislam");
const dafatir = ch("dafatir-alzaman");
const zubdat = ch("zubdat-alkutub");

describe("مكتبة كل قناة", () => {
  it("زبدة الكتب: لا رموز دينية ولا آيات ولا أحاديث ولا قوالب التاريخ", () => {
    const lib = channelLibrary(zubdat);
    for (const id of ["mosque", "mushaf-rehal", "hands-dua", "verse-frame", "hadith-frame", "girih-tile", "mosque-exterior"]) expect(lib.elements, id).not.toContain(id);
    for (const id of ["verse-card", "hadith-card", "doc-plate", "map-journey"]) expect(lib.templates, id).not.toContain(id);
    for (const id of ["castle-walls", "palace-court", "walls-night"]) expect(lib.sets, id).not.toContain(id);
    expect(lib.elements).toContain("book-open");
    expect(lib.sets).toContain("wisdom-library");
  });

  it("بالإسلام: الآيات والأحاديث والرموز الإسلامية، بلا وجوه ولا لوحات وثائقية", () => {
    const lib = channelLibrary(balislam);
    expect(lib.templates).toEqual(expect.arrayContaining(["verse-card", "hadith-card", "motion-story"]));
    expect(lib.templates).not.toContain("doc-plate");
    expect(lib.elements).toEqual(expect.arrayContaining(["mushaf-rehal", "mihrab-arch", "hands-dua"]));
    expect(lib.figures).toBe(false);
    expect(lib.sets).not.toContain("walls-night");
  });

  it("القوالب القديمة برسومات ثابتة لا تظهر في أي قناة", () => {
    for (const ch of [balislam, dafatir, zubdat]) for (const id of ["desk-moment", "sim-stage", "set-scene", "map-journey"]) expect(channelLibrary(ch).templates, `${ch.id}/${id}`).not.toContain(id);
  });

  it("دفاتر الزمن: قوالب التاريخ وأماكنه وشخصياته", () => {
    const lib = channelLibrary(dafatir);
    expect(lib.templates).toEqual(expect.arrayContaining(["doc-plate", "timeline"]));
    // أماكن التصوير القديمة الألوان خارج مكتبتها حتى يُعاد رسمها بهوية «دفتر الأفق»
    expect(lib.sets).toEqual([]);
    expect(lib.figures).toBe(true);
    // لا أدوات حديثة ولا أيقونات تنمية ذاتية في قناة التاريخ، وعناصر التاريخ باقية
    for (const id of ["smartphone", "wifi", "laptop", "sports-car", "fridge", "head-gears", "energy-full", "social-like"]) expect(lib.elements, id).not.toContain(id);
    for (const id of ["scroll", "quill", "astrolabe", "map-old", "hourglass-ornate", "sailboat", "crown", "coin", "oil-lamp", "notebook"]) expect(lib.elements, id).toContain(id);
  });

  it("استبعاد قناة من ملفها لا يمس مكتبات القنوات الأخرى", () => {
    for (const other of [balislam, zubdat]) {
      expect(channelLibrary(other).elements, other.id).toContain("smartphone");
      expect(channelLibrary(other).sets.length, other.id).toBeGreaterThan(0);
    }
    expect(elementExclusion(dafatir, "smartphone")).toBe("identity");
    expect(drawAllowed(dafatir)("phone-notifications")).toBe(false);
  });

  it("كل ما في قوائم الاستبعاد موجود فعلًا في المحرك (لا خطأ إملائي يمرّر عنصرًا)", async () => {
    const { elementLibrary } = await import("../brand/elements/registry");
    const { sets } = await import("../brand/sets/index");
    const { templateDefs } = await import("../src/plan/templates");
    for (const c of [balislam, dafatir, zubdat]) {
      const ex = c.library?.exclude ?? {};
      for (const id of ex.elements ?? []) expect(elementLibrary.some((e) => e.id === id), `${c.id}/${id}`).toBe(true);
      for (const id of ex.sets ?? []) expect(sets.some((s) => s.id === id), `${c.id}/${id}`).toBe(true);
      for (const id of ex.templates ?? []) expect(templateDefs.some((t) => t.id === id), `${c.id}/${id}`).toBe(true);
    }
  });

  it("الرسمات الآلية لا تخرج عن مكتبة القناة", () => {
    const text = "القرآن يهدينا إلى الطريق.";
    expect(beatsFor(text, 1)[0]?.draw).toBe("mushaf-rehal");
    expect(beatsFor(text, 1, drawAllowed(zubdat))[0]?.draw).not.toBe("mushaf-rehal");
    expect(elementExclusion(zubdat, beatsFor(text, 1, drawAllowed(zubdat))[0]!.draw)).toBeNull();
  });

  it("فحص الخطة يرفض ما ليس من مكتبة القناة", () => {
    const plan = {
      channel: "zubdat-alkutub",
      chapters: [
        {
          id: "c1",
          title: "",
          scenes: [
            { id: "c1-s1", template: "verse-card", narration: "", props: { text: "نص", reference: "البقرة 1" } },
            { id: "c1-s2", template: "symbolic", narration: "", props: { element: "mosque" } },
            { id: "c1-s3", template: "motion-story", narration: "", edited: true, props: { beats: "hands-dua | دعاء" } },
            { id: "c1-s4", template: "set-scene", narration: "", props: { set: "castle-walls" } },
          ],
        },
      ],
    } as unknown as Plan;
    const errs = planIssues(plan, zubdat).filter((i) => i.level === "error").map((i) => i.sceneId);
    expect(errs).toEqual(expect.arrayContaining(["c1-s1", "c1-s2", "c1-s3", "c1-s4"]));
    // في بالإسلام: الآية والرموز من مكتبتها؛ وقالب «مشهد في مكان» قديم فيُرفض في كل القنوات
    const errs2 = planIssues(plan, balislam).filter((i) => i.level === "error" && /مكتبة/.test(i.message)).map((i) => i.sceneId);
    expect(errs2).toEqual(["c1-s4"]);
  });
});

describe("أسلوب كل قناة لها وحدها", () => {
  it("لا يشترك قالب أسلوب بين قناتين، وأساليب كل قناة من مكتبتها", async () => {
    const { styleTemplate } = await import("../src/plan/styles");
    const styles = (id: string) => (JSON.parse(readFileSync(`channels/${id}/channel.json`, "utf8")).styles as string[]).map((s) => styleTemplate(s) ?? s);
    const all = { balislam: styles("balislam"), dafatir: styles("dafatir-alzaman"), zubdat: styles("zubdat-alkutub") };
    const lib = { balislam: channelLibrary(balislam).templates, dafatir: channelLibrary(dafatir).templates, zubdat: channelLibrary(zubdat).templates };
    for (const [k, v] of Object.entries(all)) for (const t of v) expect(lib[k as keyof typeof lib], `${k}/${t}`).toContain(t);
    const keys = Object.keys(all) as (keyof typeof all)[];
    for (const a of keys) for (const b of keys) if (a !== b) for (const t of all[a]) expect(lib[b], `${t} من ${a} في ${b}`).not.toContain(t);
  });

  it("بالإسلام بلا سبورة ولا رسم", () => {
    for (const t of ["board-story", "sketch-board"]) expect(channelLibrary(balislam).templates).not.toContain(t);
  });
});
