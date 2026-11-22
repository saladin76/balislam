/**
 * قالب «الحارة» (alley-world، D200): عالم «بالإسلام» المعتمد قالبًا للحلقات الجديدة بمعايير «الحِرفة» (D189):
 * كل حدث لحظة كلمته، ولا لقطة خارج ٢–٨ ث، والجملة التي فيها ذكر الله أو دعاء أو آية ساكنة كلها، وصوت لكل حركة،
 * والترجمة بلا مستطيل، وألوان «باء التشغيل» وحدها، وبلا وجوه.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { APPROVED_IDENTITIES } from "../brand/identity/approved";
import { templateDefs } from "../src/plan/templates";
import { templateMeta } from "../src/plan/templateMeta";
import { channelLibrary, type LibraryRules } from "../src/channel/library";
import { sceneCatalog } from "../src/remotion/scenes/catalog";
import { ALLEY_SHOTS, type AlleyShotId } from "../src/remotion/balislam/world/shots";
import { alleyCuts, alleyEvents } from "../src/remotion/balislam/world/AlleyWorld";
import { anchorAt, effectiveTime, sceneWords, stillWindows } from "../src/remotion/three/anchors";

const CODE = readFileSync("src/remotion/balislam/world/AlleyWorld.tsx", "utf8");
const ch = (id: string): LibraryRules => JSON.parse(readFileSync(`channels/${id}/channel.json`, "utf8"));
const W = (text: string, sec = 10) => sceneWords(text, undefined, 30, sec * 30);

describe("قالب «الحارة» (D200)", () => {
  it("مسجّل لبالإسلام وحدها، في الخطة والمكتبة والكتالوج", () => {
    expect(templateMeta["alley-world"]).toEqual({ family: "story", only: ["balislam"] });
    const def = templateDefs.find((d) => d.id === "alley-world")!;
    expect(def.implemented).toBe(true);
    expect(def.fields.find((f) => f.key === "shot")!.options!.map((o) => o.value).sort()).toEqual(Object.keys(ALLEY_SHOTS).sort());
    const keys = new Set(def.fields.map((f) => f.key));
    for (const s of Object.values(ALLEY_SHOTS)) for (const f of s.fields) expect(keys.has(f), f).toBe(true);
    for (const f of def.fields.filter((x) => x.key.endsWith("Word"))) expect([f.ui, f.match], f.key).toEqual(["anchor", "prefix"]);
    expect(channelLibrary(ch("balislam")).templates).toContain("alley-world");
    for (const id of ["dafatir-alzaman", "zubdat-alkutub"]) expect(channelLibrary(ch(id)).templates).not.toContain("alley-world");
    expect(sceneCatalog.some((e) => e.id === "alley-world")).toBe(true);
  });

  it("كل حدث لحظة نطق كلمته، وكلمة غير موجودة = لا حدث", () => {
    const text = "وقف رجلان في السوق، كلٌّ منهما يقول: الحقُّ معي.";
    const words = W(text);
    const ev = alleyEvents("two-figures", { enterWord: "رجلان", speakWord: "يقول", selfWord: "معي" }, words, []);
    expect(ev.map((e) => e.id)).toEqual(["enter", "speak", "self"]);
    expect(ev[0]!.a).toBeCloseTo(anchorAt(words, "رجلان")! - 0.2, 6);
    expect(ev[1]!.a).toBeCloseTo(anchorAt(words, "يقول")! - 0.05, 6);
    expect(alleyEvents("two-figures", { enterWord: "ثلاثة", speakWord: "يقول", selfWord: "معي" }, words, []).map((e) => e.id)).toEqual(["speak", "self"]);
    // شخصية واحدة: لا إيماءة «معي» لثانية غير موجودة
    expect(alleyEvents("two-figures", { figures: "1", speakWord: "يقول", selfWord: "معي" }, words, []).map((e) => e.id)).toEqual(["speak"]);
    expect(alleyEvents("market", { stallWord: "السوق" }, words, []).map((e) => [e.id, e.sfx])).toEqual([["stalls", "drop-soft"]]);
    expect(alleyEvents("alley-wide", { stallWord: "السوق" }, words, [])).toEqual([]);
  });

  it("الجملة التي فيها ذكر الله ساكنة كلها: لا حدث فيها، والكاميرا لا تتقدم", () => {
    const text = "وقف رجلان في السوق. والله يعلم ما في القلوب.";
    const words = W(text, 8);
    const still = stillWindows(text, words, true);
    const sacredStart = anchorAt(words, "والله")!, sacredEnd = words[words.length - 1]!.e;
    expect(still.some(([a, b]) => a <= sacredStart && b >= sacredEnd)).toBe(true);
    // حدث على كلمة داخل الجملة المقدسة يتأخر إلى ما بعدها
    const ev = alleyEvents("two-figures", { speakWord: "يعلم" }, words, still);
    for (const e of ev) for (const [a, b] of still) expect(e.a >= b || e.b <= a, e.id).toBe(true);
    const [a, b] = still.find(([x, y]) => x <= sacredStart && y >= sacredEnd)!;
    expect(effectiveTime(b, still) - effectiveTime(a, still)).toBeCloseTo(0, 6);
    expect(CODE).toMatch(/stillWindows\(narration, words, true\)/);
  });

  it("اللقطات ٢–٨ ث، وتتناوب زاويتا اللقطة", () => {
    for (const shot of Object.keys(ALLEY_SHOTS) as AlleyShotId[])
      for (const dur of [3, 6, 8, 8.5, 12, 19.3, 30]) {
        const cuts = alleyCuts(shot, dur);
        expect(cuts[0]!.a).toBe(0); expect(cuts[cuts.length - 1]!.b).toBeCloseTo(dur, 9);
        for (const c of cuts) expect(c.b - c.a).toBeLessThanOrEqual(8);
        if (cuts.length > 1) expect(cuts[0]!.from).not.toEqual(cuts[1]!.from);
      }
  });

  it("صوت لكل حركة فوق صوت الغرفة، ويُطفأ بـ«بلا مؤثرات» (المؤثرات لا تُفرض)، وبلا موسيقى", () => {
    expect(CODE).toMatch(/SFX\("silence-room"\)/);
    expect(CODE).toMatch(/const sounds = p\.sounds !== "off"/);
    expect(CODE).not.toMatch(/music|موسيقى\.mp3/i);
    for (const f of ["drop-soft", "swipe-paper", "tick", "paper-crumple", "silence-room"]) expect(() => readFileSync(`public/three/sfx/${f}.mp3`)).not.toThrow();
  });

  it("الترجمة سطر هادئ بظل فاتح خفيف بلا مستطيل، وألوان «باء التشغيل» وحدها، وبلا وجوه", () => {
    expect(CODE).toMatch(/textShadow: CAPTION_SHADOW_LIGHT/);
    expect(CODE).not.toMatch(/background: "rgba|borderRadius/);
    const a = APPROVED_IDENTITIES["balislam"]!;
    const ok = new Set([...a.palette.map((p) => p.hex), ...a.signature, ...a.derived].map((x) => x.toUpperCase()));
    expect([...CODE.matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m) => m[0].toUpperCase()).filter((c) => !ok.has(c))).toEqual([]);
    expect(CODE.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")).not.toMatch(/\b(eye|mouth|nose)s?\b/i);
  });
});
