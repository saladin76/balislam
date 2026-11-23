/**
 * قالب «مكتب الرحّالة» (rahhala-desk، D194): العالم المعتمد لدفاتر الزمن (D190) قالبًا للحلقات الجديدة (D191)،
 * بمعايير «الحِرفة» (D189): كل حدث لحظة كلمته، ولا لقطة خارج ٢–٨ ث، والسكون المقصود عند ذكر الله، وصوت لكل حركة،
 * والترجمة بلا مستطيل (D187، D192)، وألوان «دفتر الأفق» واللازورد للماء والخرائط وحدها (D188).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { APPROVED_IDENTITIES } from "../brand/identity/approved";
import { templateDefs } from "../src/plan/templates";
import { templateMeta } from "../src/plan/templateMeta";
import { channelLibrary, type LibraryRules } from "../src/channel/library";
import { sceneCatalog } from "../src/remotion/scenes/catalog";
import { RAHHALA_CITIES, RAHHALA_SHOTS } from "../src/remotion/dafatir/world/shots";
import { anchorAt, rahhalaCuts, rahhalaEvents, rahhalaStill, rahhalaWords, type RahhalaShotId } from "../src/remotion/dafatir/world/RahhalaDesk";
import { CITY_R, CITY_WALLS, cityHouses } from "../src/remotion/dafatir/world/DeskWorld";

const CODE = readFileSync("src/remotion/dafatir/world/RahhalaDesk.tsx", "utf8");
const ch = (id: string): LibraryRules => JSON.parse(readFileSync(`channels/${id}/channel.json`, "utf8"));
const W = (text: string, sec = 10) => rahhalaWords(text, undefined, 30, sec * 30);

describe("قالب «مكتب الرحّالة» (D194)", () => {
  it("مسجّل لدفاتر الزمن وحدها، في الخطة والمكتبة والكتالوج", () => {
    expect(templateMeta["rahhala-desk"]).toEqual({ family: "story", only: ["dafatir-alzaman"] });
    const def = templateDefs.find((d) => d.id === "rahhala-desk")!;
    expect(def.implemented).toBe(true);
    expect(def.fields.find((f) => f.key === "shot")!.options!.map((o) => o.value).sort()).toEqual(Object.keys(RAHHALA_SHOTS).sort());
    // كل حقل تقرؤه لقطة معرَّف، وكل حقل «كلمة …» مرسى بالنقر على الكلمة
    const keys = new Set(def.fields.map((f) => f.key));
    for (const s of Object.values(RAHHALA_SHOTS)) for (const f of s.fields) expect(keys.has(f), f).toBe(true);
    for (const f of def.fields.filter((x) => x.key.endsWith("Word"))) expect([f.ui, f.match], f.key).toEqual(["anchor", "prefix"]);
    expect(channelLibrary(ch("dafatir-alzaman")).templates).toContain("rahhala-desk");
    for (const id of ["balislam", "zubdat-alkutub"]) expect(channelLibrary(ch(id)).templates).not.toContain("rahhala-desk");
    expect(sceneCatalog.some((e) => e.id === "rahhala-desk")).toBe(true);
  });

  it("كل حدث يقع لحظة نطق كلمته، وكلمة غير موجودة = لا حدث (الفراغ أفضل من عنصر خاطئ)", () => {
    const words = W("خرج المنصور من الكوفة حتى نزل ببغداد.");
    const ev = rahhalaEvents("map", { fromPlace: "الكوفة", fromWord: "الكوفة", toPlace: "بغداد", toWord: "ببغداد" }, words, []);
    expect(ev.find((e) => e.id === "from")!.a).toBeCloseTo(anchorAt(words, "الكوفة")! - 0.1, 6);
    expect(ev.find((e) => e.id === "to")!.a).toBeCloseTo(anchorAt(words, "ببغداد")! - 0.1, 6);
    // الطريق يكتمل مع كلمة الوصول (أو بعدها بقليل إن تقاربت الكلمتان)
    expect(ev.find((e) => e.id === "route")!.b).toBeGreaterThanOrEqual(anchorAt(words, "ببغداد")! - 1e-9);
    expect(ev.find((e) => e.id === "route")!.b).toBeLessThanOrEqual(anchorAt(words, "ببغداد")! + 1.2);
    expect(rahhalaEvents("map", { fromPlace: "البصرة", fromWord: "البصرة", toPlace: "بغداد", toWord: "ببغداد" }, words, []).map((e) => e.id)).toEqual(["to"]);
    expect(rahhalaEvents("city", { city: "مدينة-غير-مسجلة", cityWord: "نزل" }, words, [])).toEqual([]);
    expect(anchorAt(W("قال ثم قال ثانية"), "قال#2")).toBeGreaterThan(anchorAt(W("قال ثم قال ثانية"), "قال")!);
  });

  it("السكون المقصود بقواعد stillnessSpans نفسها، ولا حدث فيه", () => {
    const words = W("فخطّ مدينة مدوّرة باسم الله وبركته، لها أربعة أبواب.");
    const still = rahhalaStill(words);
    expect(still.length).toBe(1);
    const ev = rahhalaEvents("city", { city: "round-city", cityWord: "الله" }, words, still);
    for (const e of ev) for (const [s, x] of still) expect(e.a >= x || e.b <= s, e.id).toBe(true);
    expect(CODE).toMatch(/lightsAt\(t, lights, still\)/);
    expect(CODE).toMatch(/<Candle t=\{t\} still=\{still\} \/>/);
    expect(CODE).toMatch(/<BeamDust [^>]*still=\{still\}/);
    expect(CODE).toMatch(/effective\(t, still\)/);
  });

  it("اللقطات ٢–٨ ث بلا لقطة أطول من ٨، وتتناوب زاويتا اللقطة", () => {
    for (const shot of Object.keys(RAHHALA_SHOTS) as RahhalaShotId[])
      for (const dur of [3, 6, 8, 8.5, 12, 19.3, 30]) {
        const cuts = rahhalaCuts(shot, dur);
        expect(cuts[0]!.a).toBe(0); expect(cuts[cuts.length - 1]!.b).toBeCloseTo(dur, 9);
        for (const c of cuts) { expect(c.b - c.a).toBeLessThanOrEqual(8); if (dur >= 2) expect(c.b - c.a).toBeGreaterThanOrEqual(Math.min(2, dur)); }
        if (cuts.length > 1) expect(cuts[0]!.from).not.toEqual(cuts[1]!.from);
      }
  });

  it("صوت لكل حركة فوق صوت الغرفة (D158)", () => {
    const words = W("ثم أتمّ بناءها، وسمّاها مدينة السلام.");
    const ev = rahhalaEvents("document", { docWrite: "وسمّاها مدينة السلام", docWord: "وسمّاها", stamp: "١٤٥", stampWord: "السلام" }, words, []);
    expect(ev.map((e) => [e.id, e.sfx])).toEqual([["land", "swipe-paper"], ["write", "pen-write"], ["stamp", "stamp"]]);
    expect(CODE).toMatch(/SFX\("silence-room"\)/);
    for (const f of new Set(ev.map((e) => e.sfx))) expect(() => readFileSync(`public/three/sfx/${f}.mp3`)).not.toThrow();
  });

  it("الترجمة سطر هادئ بظل خفيف بلا مستطيل، وألوان «دفتر الأفق» وحدها", () => {
    expect(CODE).toMatch(/textShadow: CAPTION_SHADOW/);
    expect(CODE).not.toMatch(/background: "rgba|borderRadius/);
    expect(CODE).toMatch(/captions=\{false\}/);
    const a = APPROVED_IDENTITIES["dafatir-alzaman"]!;
    const ok = new Set([...a.palette.map((p) => p.hex), ...a.signature, ...a.derived, ...(a.restricted ?? []).map((r) => r.hex)].map((x) => x.toUpperCase()));
    const bad = [...CODE.matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m) => m[0].toUpperCase()).filter((c) => !ok.has(c) && c !== "#C9B49A");
    expect(bad).toEqual([]);
    // اللازورد للماء وحده في هذا القالب
    expect([...CODE.matchAll(/K\.lapis/g)].length).toBeGreaterThan(0);
    for (const line of CODE.split("\n").filter((l) => l.includes("K.lapis"))) expect(line, line).toMatch(/water|wash|نهر|الماء|fillStyle = K\.lapis/);
  });
});

describe("سور بغداد بعد ملاحظة المالك (٢٢ نوفمبر): لبن حقيقي وتنوع وقباب أبواب مذهّبة", () => {
  const DW = readFileSync("src/remotion/dafatir/world/DeskWorld.tsx", "utf8");
  it("السور الخارجي بأبراج، ولكل سور إيقاع شرفات مختلف", () => {
    expect(CITY_WALLS[0].towers).toBeGreaterThanOrEqual(12);
    expect(new Set(CITY_WALLS.map((w) => w.accent)).size).toBe(CITY_WALLS.length);
    expect(new Set(CITY_WALLS.map((w) => w.merlons)).size).toBe(CITY_WALLS.length);
  });
  it("البيوت متنوعة لا مكعبات مكررة: مساحات وأطوال مختلفة، وأفنية، وكلها بين السورين", () => {
    const hs = cityHouses();
    expect(hs.length).toBeGreaterThan(60);
    expect(new Set(hs.map((h) => h.h.toFixed(4))).size).toBeGreaterThan(hs.length * 0.6);
    expect(new Set(hs.map((h) => `${h.w.toFixed(3)}x${h.d.toFixed(3)}`)).size).toBeGreaterThan(hs.length * 0.8);
    expect(hs.filter((h) => h.court).length).toBeGreaterThan(10);
    for (const h of hs) { const r = Math.hypot(h.x, h.z); expect(r).toBeGreaterThan(CITY_WALLS[1].r); expect(r).toBeLessThan(CITY_R); }
  });
  it("قباب الأبواب مذهّبة، والخضراء للقصر وحده، والطوب أنعم (normalScale منخفض)", () => {
    const city = DW.slice(DW.indexOf("export const RoundCity"), DW.indexOf("/** كتاب بجلد حقيقي"));
    expect([...city.matchAll(/K\.verdigris/g)].length).toBe(1); // قبة القصر وحدها
    expect(DW).toMatch(/args=\{\[0\.05, 20, 10, 0, Math\.PI \* 2, 0, Math\.PI \/ 2\]\} \/><meshStandardMaterial color=\{K\.gold\}/);
    expect(DW).toMatch(/const mud = \(tx: THREE\.Texture\[\] \| null, n = 0\.35\)/);
  });
});
