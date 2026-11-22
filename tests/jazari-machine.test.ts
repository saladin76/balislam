/**
 * قالب «آلات الجزري» (jazari-machine، D201): عالم «زبدة الكتب» المعتمد قالبًا للحلقات الجديدة بمعايير «الحِرفة» (D189):
 * كل حدث لحظة كلمته، ولا لقطة خارج ٢–٨ ث، وجملة الذكر ساكنة كلها، وصوت لكل حركة، وبلا فسفوري (D188).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { templateDefs } from "../src/plan/templates";
import { templateMeta } from "../src/plan/templateMeta";
import { channelLibrary, type LibraryRules } from "../src/channel/library";
import { sceneCatalog } from "../src/remotion/scenes/catalog";
import { JAZARI_SHOTS, type JazariShotId } from "../src/remotion/zubdat/world/shots";
import { jazariCuts, jazariEvents, jazariTags } from "../src/remotion/zubdat/world/JazariMachine";
import { anchorAt, sceneWords, stillWindows } from "../src/remotion/three/anchors";

const CODE = readFileSync("src/remotion/zubdat/world/JazariMachine.tsx", "utf8");
const ch = (id: string): LibraryRules => JSON.parse(readFileSync(`channels/${id}/channel.json`, "utf8"));
const TEXT = "كثيرٌ منّا يصلّي ولا يشعر، لأنّه ينتظر الشعور قبل الحضور. واللهُ أقربُ إلينا ممّا نظن.";
const W = (text: string, sec = 10) => sceneWords(text, undefined, 30, sec * 30);

describe("قالب «آلات الجزري» (D201)", () => {
  it("مسجّل لزبدة الكتب وحدها، في الخطة والمكتبة والكتالوج", () => {
    expect(templateMeta["jazari-machine"]).toEqual({ family: "explain", only: ["zubdat-alkutub"] });
    const def = templateDefs.find((d) => d.id === "jazari-machine")!;
    expect(def.implemented).toBe(true);
    expect(def.fields.find((f) => f.key === "shot")!.options!.map((o) => o.value).sort()).toEqual(Object.keys(JAZARI_SHOTS).sort());
    const keys = new Set(def.fields.map((f) => f.key));
    for (const s of Object.values(JAZARI_SHOTS)) for (const f of s.fields) expect(keys.has(f), f).toBe(true);
    for (const f of def.fields.filter((x) => x.key.endsWith("Word"))) expect([f.ui, f.match], f.key).toEqual(["anchor", "prefix"]);
    expect(channelLibrary(ch("zubdat-alkutub")).templates).toContain("jazari-machine");
    for (const id of ["balislam", "dafatir-alzaman"]) expect(channelLibrary(ch(id)).templates).not.toContain("jazari-machine");
    expect(sceneCatalog.some((e) => e.id === "jazari-machine")).toBe(true);
  });

  it("السلسلة بأزمانها: قطر حتى الميل، ثم دوران حتى وصول اللوح، وكلمة غير موجودة = لا حدث", () => {
    const words = W(TEXT);
    const ev = jazariEvents({ dripWord: "يصلّي", tipWord: "ينتظر", turnWord: "الشعور", riseWord: "الحضور" }, words, [], 10);
    expect(ev.map((e) => [e.id, e.sfx])).toEqual([["drip", "water-drop"], ["tip", "drop-soft"], ["turn", "gears"]]);
    const at = (w: string) => anchorAt(words, w)!;
    expect(ev[0]!.a).toBeCloseTo(at("يصلّي") - 0.1, 6);
    expect(ev[0]!.b).toBeCloseTo(at("ينتظر") - 0.1, 6);
    expect(ev[2]!.b).toBeCloseTo(at("الحضور") + 0.1, 6);
    expect(jazariEvents({ dripWord: "غير-موجودة", tipWord: "ينتظر" }, words, [], 10).map((e) => e.id)).toEqual(["tip"]);
    expect(jazariEvents({}, words, [], 10)).toEqual([]);
  });

  it("جملة الذكر ساكنة كلها: لا حدث فيها", () => {
    const words = W(TEXT);
    const still = stillWindows(TEXT, words, true);
    const s = anchorAt(words, "واللهُ")!;
    expect(still.some(([a, b]) => a <= s && b >= words[words.length - 1]!.e)).toBe(true);
    const ev = jazariEvents({ dripWord: "أقرب", turnWord: "نظن" }, words, still, 10);
    for (const e of ev) for (const [a, b] of still) expect(e.a >= b || e.b <= a, e.id).toBe(true);
    expect(CODE).toMatch(/stillWindows\(narration, words, true\)/);
  });

  it("أسماء الأجزاء حتى أربعة بالترتيب، والفارغ بلا بطاقة", () => {
    expect(jazariTags("الحوض|العوّامة|الكفّة|الدولاب|زيادة")).toEqual({ water: "الحوض", float: "العوّامة", cup: "الكفّة", gear: "الدولاب" });
    expect(jazariTags("الحوض||الكفّة")).toEqual({ water: "الحوض", cup: "الكفّة" });
    expect(jazariTags(undefined)).toEqual({});
  });

  it("اللقطات ٢–٨ ث، وتتناوب زاويتا اللقطة", () => {
    for (const shot of Object.keys(JAZARI_SHOTS) as JazariShotId[])
      for (const dur of [4, 8, 8.5, 12, 19.3, 30]) {
        const cuts = jazariCuts(shot, dur);
        expect(cuts[0]!.a).toBe(0); expect(cuts[cuts.length - 1]!.b).toBeCloseTo(dur, 9);
        for (const c of cuts) expect(c.b - c.a).toBeLessThanOrEqual(8);
        if (cuts.length > 1) expect(cuts[0]!.from).not.toEqual(cuts[1]!.from);
      }
  });

  it("صوت لكل حركة فوق صوت الورشة، والترجمة بلا مستطيل، وبلا فسفوري ولا ألوان خارج المخطوطة", () => {
    expect(CODE).toMatch(/SFX\("silence-room"\)/);
    for (const f of ["water-drop", "drop-soft", "gears", "tick", "silence-room"]) expect(() => readFileSync(`public/three/sfx/${f}.mp3`)).not.toThrow();
    expect(CODE).toMatch(/textShadow: CAPTION_SHADOW/);
    expect(CODE).not.toMatch(/background: "rgba|borderRadius/);
    expect(CODE).not.toMatch(/fluo|#E8F542/i);
    expect(CODE).not.toMatch(/#[0-9A-Fa-f]{6}\b/);
  });
});
