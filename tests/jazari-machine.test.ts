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
import * as THREE from "three";
import { JAZARI_CAPTION_SHADOW, JAZARI_KEY_POINTS, jazariCamAt, jazariCuts, jazariEvents, jazariTags } from "../src/remotion/zubdat/world/JazariMachine";
import { orbit } from "../src/remotion/three/rig";
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
    expect(CODE).toMatch(/textShadow: JAZARI_CAPTION_SHADOW\[tone\]/);
    expect(CODE).not.toMatch(/background: "rgba|borderRadius/);
    expect(CODE).not.toMatch(/fluo|#E8F542/i);
    expect(CODE).not.toMatch(/#[0-9A-Fa-f]{6}\b/);
  });
});

describe("مراجعة المنسّق: لون الترجمة حسب ما تحتها، ولا بطاقة في نطاق الترجمة", () => {
  it("ملاحظة المالك ٢٣ نوفمبر: كل كلمة بنبرة ما خلفها فعلًا في الإطار (حبر داكن على الورق البيج، ونص فاتح على الخشب)", async () => {
    const { wordTones, captionRows, CAPTION_GEOMETRY, INK_ABOVE } = await import("../src/remotion/three/captionProbe");
    // خط وهمي: كل حرف ١٠ بكسل والمسافة ١٠؛ الكادر ١٠٠٠ والعمود ١٠ بكسل
    const measure = (s: string) => s.length * 10;
    const row = (f: (x: number) => number) => Array.from({ length: 100 }, (_, c) => f(c * 10 + 5));
    // السطر «أ بب ججج» عرضه ٨٠ ومتوسَّط حول ٥٠٠: «أ» في يمينه [٥٣٠،٥٤٠]، «بب» [٥٠٠،٥٢٠]، «ججج» [٤٦٠،٤٩٠]
    const half = row((x) => (x >= 500 ? 0.8 : 0.1)); // ورق في النصف الأيمن، وخشب في الأيسر
    expect(wordTones("أ بب ججج", { bin: 10, lum: [half] }, 1000, measure)).toEqual(["ink", "ink", "light"]);
    expect(wordTones("أ بب ججج", { bin: 10, lum: [row(() => 0.15)] }, 1000, measure)).toEqual(["light", "light", "light"]);
    expect(wordTones("أ بب ججج", { bin: 10, lum: [row(() => INK_ABOVE + 0.2)] }, 1000, measure)).toEqual(["ink", "ink", "ink"]);
    // الالتفاف: السطر الأول أعلى (الصف ١)، والأخير في الصف ٠
    const long = Array.from({ length: 30 }, () => "كلمات").join(" ");
    const tones = wordTones(long, { bin: 10, lum: [row(() => 0.1), row(() => 0.9)] }, 1000, measure);
    expect(tones[0]).toBe("ink"); expect(tones[tones.length - 1]).toBe("light");
    // صفوف القياس من أسفل الكادر إلى أعلاه، بارتفاع سطر الترجمة
    expect(captionRows(1080, 56, 2)).toEqual([[1080 - 56 - 8 - 62, 1080 - 56 - 8], [1080 - 56 - 8 - 124, 1080 - 56 - 8 - 62]]);
    expect(CAPTION_GEOMETRY.lineHeight).toBe(62);
    // القالب ينتظر قياس الإطار نفسه قبل اللقطة، ويرسم الكلمات بنبرتها، بلا مزج «الفرق»
    expect(CODE).toMatch(/delayRender\(`قياس ما خلف الترجمة/);
    expect(CODE).toMatch(/probe=\{line \? \{ frame, rows, onProbe \} : undefined\}/);
    expect(CODE).not.toMatch(/mixBlendMode/);
    for (const s of Object.values(JAZARI_SHOTS)) expect(s).not.toHaveProperty("caption");
  });
  it("ملاحظة المالك ٢٣ نوفمبر: لا ذرة غبار أمام العدسة أقرب من ثلثي مسافة التركيز (كانت قرصًا أبيض أسفل يسار اللقطة الأولى)", async () => {
    const { dustVisible } = await import("../src/remotion/three/lens");
    const { DUST_NEAR } = await import("../src/remotion/zubdat/directions/IdeaMachine");
    expect(DUST_NEAR).toBeCloseTo(0.67, 6);
    const lens = { at: [0, 0, 3] as [number, number, number], near: DUST_NEAR * 3 };
    expect(dustVisible({ x: 0, y: 0, z: 2.5 }, lens)).toBe(false); // نصف وحدة أمام العدسة
    expect(dustVisible({ x: 0, y: 0, z: 0 }, lens)).toBe(true); // عند مستوى التركيز
    const machine = readFileSync("src/remotion/zubdat/directions/IdeaMachine.tsx", "utf8");
    expect(machine).toMatch(/lens=\{\{ at: cam\.position, near: DUST_NEAR \* cam\.focus \}\}/);
  });
  it("بطاقات الأسماء فوق أجزائها، وتُخفى إن وقعت في نطاق الترجمة أسفل الكادر", async () => {
    const { TAG_AT } = await import("../src/remotion/zubdat/directions/IdeaMachine");
    const { CAPTION_BAND } = await import("../src/remotion/three/anchors");
    expect(CAPTION_BAND).toBeCloseTo(0.22, 6);
    // الكفّة والدولاب فوق أجزائهما لا تحتها (كانتا على الأرض تحت الترجمة)
    expect(TAG_AT.cup[1]).toBeGreaterThan(2); expect(TAG_AT.gear[1]).toBeGreaterThan(2);
    const machine = readFileSync("src/remotion/zubdat/directions/IdeaMachine.tsx", "utf8");
    expect(machine).toMatch(/if \(band > 0 && fromBottom < band \+ 0\.04\) return null;/);
    expect(machine).toMatch(/Math\.abs\(v\.x\) > 0\.78/);
    expect(CODE).toMatch(/captionBand=\{line \? CAPTION_BAND : 0\}/);
  });
});

describe("ملاحظة المالك على v3 (٢٤ نوفمبر): لا كادر فارغ، والحبر الداكن على الورق البيج", () => {
  const visible = (c: ReturnType<typeof jazariCuts>[number], p: number, aspect: number) => {
    const s = jazariCamAt(c, p);
    const cam = new THREE.PerspectiveCamera(s.fov, aspect, 0.01, 200);
    cam.position.set(...orbit(s)); cam.lookAt(...s.target); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    return JAZARI_KEY_POINTS.filter((q) => { const v = new THREE.Vector3(...q).project(cam); return Math.abs(v.x) < 1 && Math.abs(v.y) < 1 && v.z < 1; }).length;
  };
  it("كل لقطة وكل قطع، أفقيًا وطوليًا، فيه جزء من الآلة على الأقل طوال حركته (كان «القطر» و«الذراع» الطوليان على الجدار وحده)", () => {
    for (const portrait of [false, true]) for (const shot of Object.keys(JAZARI_SHOTS) as JazariShotId[]) for (const dur of [6, 10, 20])
      for (const c of jazariCuts(shot, dur, portrait)) for (const p of [0, 0.25, 0.5, 0.75, 1])
        expect(visible(c, p, portrait ? 9 / 16 : 16 / 9), `${portrait ? "طولي" : "أفقي"} ${shot} ${dur}ث عند ${c.a} (${p})`).toBeGreaterThanOrEqual(1);
    expect(CODE).toMatch(/jazariCuts\(shot, dur, height > width\)/);
  });
  it("الورق البيج في الظل والعمق المموّه (٠٫٣٩–٠٫٥٩ مقيسًا) حبر داكن، والخشب (≤٠٫٢٨) نص فاتح؛ وهالة الحبر ناعمة لا حد فاتح صلب", async () => {
    const { wordTones, INK_ABOVE } = await import("../src/remotion/three/captionProbe");
    const measure = (s: string) => s.length * 10;
    const flat = (v: number) => Array.from({ length: 100 }, () => v);
    for (const v of [0.39, 0.45, 0.59]) expect(wordTones("أ بب", { bin: 10, lum: [flat(v)] }, 1000, measure), String(v)).toEqual(["ink", "ink"]);
    for (const v of [0.06, 0.2, 0.28]) expect(wordTones("أ بب", { bin: 10, lum: [flat(v)] }, 1000, measure), String(v)).toEqual(["light", "light"]);
    expect(INK_ABOVE).toBeGreaterThan(0.28); expect(INK_ABOVE).toBeLessThan(0.39);
    expect(JAZARI_CAPTION_SHADOW.ink).not.toMatch(/px 0 rgba/);
  });
});
