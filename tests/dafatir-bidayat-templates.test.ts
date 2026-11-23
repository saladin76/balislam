/**
 * قوالب سلسلة «البدايات» (D209): مجموعة قوالب على عالم «خطوط على الأرض» (D203) لا قالب واحد (عمود السلاسل، D202):
 * لدفاتر الزمن وحدها، ولكل قالب لقطاته بزاويتين، وكل حدث لحظة كلمته ولا حدث في نافذة سكون، ومشهد الآية ساكن كله،
 * ولا لقطة أطول من ٧ ث، ولا تصوير لأحد، ولا لفظ قرآني يُكتب في الرمل من نماذج القناة.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { templateDefs } from "../src/plan/templates";
import { templateMeta } from "../src/plan/templateMeta";
import { channelLibrary, type LibraryRules } from "../src/channel/library";
import { sceneCatalog } from "../src/remotion/scenes/catalog";
import { COMPOSITION_FIELDS } from "../src/studio/quality/diversity";
import { BID_TEMPLATES, BID_CAPTION_TONE, type BidShotId, type BidTemplateId } from "../src/remotion/dafatir/bidayat/shots";
import { BID_SETUPS, bidCuts, bidEvents, bidShotOf, bidSun, bidayatSamples, fanPaths, twoPaths } from "../src/remotion/dafatir/bidayat/BidayatScene";
import { rahhalaStill, rahhalaWords } from "../src/remotion/dafatir/world/RahhalaDesk";
import { waterAlpha } from "../src/remotion/dafatir/bidayat/earth";
import { groundH } from "../src/remotion/dafatir/bidayat/StoneLines";

const ch = (id: string): LibraryRules => JSON.parse(readFileSync(`channels/${id}/channel.json`, "utf8"));
const IDS = Object.keys(BID_TEMPLATES) as BidTemplateId[];
const CODE = readFileSync("src/remotion/dafatir/bidayat/BidayatScene.tsx", "utf8") + readFileSync("src/remotion/dafatir/bidayat/earth.tsx", "utf8");
const strip = (c: string) => c.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
const W = (text: string, sec = 10) => rahhalaWords(text, undefined, 30, sec * 30);

describe("«البدايات»: مجموعة قوالب للسلسلة (D209)", () => {
  it("خمسة قوالب مسجلة لدفاتر الزمن وحدها، بنموذج من سكريبت 001 لكل منها، وتكوين لكل لقطة", () => {
    expect(IDS.length).toBeGreaterThanOrEqual(5);
    for (const id of IDS) {
      expect(templateMeta[id]?.only, id).toEqual(["dafatir-alzaman"]);
      const def = templateDefs.find((d) => d.id === id)!;
      expect(def.implemented, id).toBe(true);
      expect(Object.keys(def.shots ?? {}), id).toEqual(Object.keys(BID_TEMPLATES[id].shots));
      expect(sceneCatalog.some((e) => e.id === id), id).toBe(true);
      expect(COMPOSITION_FIELDS[id]?.layout, id).toContain("shot");
      expect(bidayatSamples[id], id).toBeTruthy();
    }
    expect(channelLibrary(ch("dafatir-alzaman")).templates).toEqual(expect.arrayContaining(IDS));
    for (const c of ["balislam", "zubdat-alkutub"]) for (const id of IDS) expect(channelLibrary(ch(c)).templates).not.toContain(id);
  });
  it("لكل لقطة زاويتان بحجمين أو موضعين، ولا قطع أطول من ٧ ث فوق ٨ ث، ونبرة ترجمة", () => {
    const shots = IDS.flatMap((id) => Object.keys(BID_TEMPLATES[id].shots)) as BidShotId[];
    expect(new Set(shots).size).toBe(shots.length);
    for (const s of shots) {
      expect(BID_SETUPS[s], s).toHaveLength(2);
      expect(BID_CAPTION_TONE[s], s).toBeTruthy();
      for (const dur of [3, 8, 14, 29]) {
        const cuts = bidCuts(s, dur);
        expect(cuts[cuts.length - 1]!.b).toBeCloseTo(dur, 6);
        for (const c of cuts) expect(c.b - c.a, `${s} ${dur}`).toBeLessThanOrEqual(dur <= 8 ? 8 : 7);
      }
    }
    expect(bidShotOf("bidayat-stone", "nope")).toBe("verse");
    expect(bidShotOf("bidayat-line", "circles")).toBe("circles");
  });
  it("كل حدث لحظة كلمته، ولا حدث يبدأ في نافذة ذكر الله؛ ولا كلمة = لا حدث", () => {
    const text = "فحين سئل عن ذلك، قال إنه خير من آدم؛ لأن الله خلقه من نار وخلق آدم من طين. فجعل هذا الظن مقدمًا على أمر الله.";
    const w = W(text, 14), still = rahhalaStill(w);
    const ev = bidEvents("scale", { aWord: "نار", bWord: "طين", verdictWord: "الظن" }, w, still, 14);
    expect(ev.map((e) => e.id)).toEqual(["a", "b", "verdict"]);
    const at = (x: string) => w.find((y) => y.w.startsWith(x))!.s;
    expect(ev[0]!.a).toBeCloseTo(at("نار") - 0.1, 1);
    for (const e of ev) for (const [s, en] of still) expect(e.a >= en || e.a < s, `${e.id} ${e.a}`).toBe(true);
    expect(bidEvents("scale", { aWord: "ماء" }, w, still, 14)).toEqual([]);
    // الختم من أختام «درجة الثبوت» وحدها
    expect(bidEvents("shore", { stamp: "صحيح", stampWord: "قال" }, w, still, 14)).toEqual([]);
    expect(bidEvents("shore", { stamp: "لا نعلم", stampWord: "قال" }, w, still, 14).map((e) => e.id)).toEqual(["stamp"]);
  });
  it("مشهد الآية ساكن الكاميرا كله: زاويتاه ثابتتان (من = إلى)", () => {
    for (const s of BID_SETUPS.verse) expect(s.from).toEqual(s.to);
    expect(CODE).toMatch(/shot === "verse" \? \[\[-1, dur \+ 1\]\]/);
  });
  it("الشمس من موضع المشهد في الحلقة وتتقدم قليلًا، والماء يرقّ نحو الشاطئ", () => {
    expect(bidSun("0.2", 0, 10)).toBeCloseTo(0.2, 9);
    expect(bidSun("0.2", 10, 10)).toBeGreaterThan(0.2);
    expect(bidSun("1", 10, 10)).toBe(1);
    expect(waterAlpha(0.05, 0, 30)).toBe(0);
    expect(waterAlpha(0.05, 0, -20)).toBeGreaterThan(0.8);
    expect(groundH(0, -20)).toBeLessThan(0);
  });
  it("الخطوط والطريقان: خطوط النسل تبتعد عن الأصل، والطريق الراجع يعود قرب بدايته", () => {
    for (const br of fanPaths(4)) expect(Math.hypot(br[8]![0] + 0.6, br[8]![1] - 3.2)).toBeGreaterThan(Math.hypot(br[0]![0] + 0.6, br[0]![1] - 3.2));
    const [away, back] = twoPaths();
    const d = (p: [number, number], q: [number, number]) => Math.hypot(p[0] - q[0], p[1] - q[1]);
    expect(d(away[away.length - 1]!, away[0]!)).toBeGreaterThan(3);
    expect(d(back[back.length - 1]!, away[0]!)).toBeLessThan(d(back[6]!, away[0]!));
  });
  it("لا تصوير لأحد (لا شخص ولا هيئة ولا ظل إنسان ولا أثر قدم)، ولا لهب ولا وهج، ولا عشوائية", () => {
    const banned = [/\bPerson\b|figureShapes|silhouette|armPose|footprint|Footprint/, /sparkle|lens.?flare|glow|Bloom|flame/i, /spring\(|bounce/i, /Math\.random|Date\.now/, /\b(eye|mouth|nose|face|hand)s?\b/i];
    expect(banned.filter((re) => re.test(strip(CODE))).map(String)).toEqual([]);
  });
  it("نماذج القناة لا تكتب لفظًا قرآنيًا في الرمل (الآيات على لوح الحجر وحده)", () => {
    for (const [id, s] of Object.entries(bidayatSamples)) for (const k of ["mark", "aText", "bText", "verdictText"]) {
      const v = (s as Record<string, string>)[k];
      if (v) expect(["الصراط المستقيم", "فتاب عليه", "من الجن", "ملكين"].some((q) => v.includes(q)), `${id}/${k}`).toBe(false);
    }
  });
});
