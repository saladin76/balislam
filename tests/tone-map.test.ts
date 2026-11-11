import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { isTone } from "../src/voice/tones";
import { normWord, stripTashkeel } from "../src/voice/tashkeel";
import { isQuranFreeForTts, planVerseTexts } from "../src/voice/quranGuard";

/**
 * خريطة الأداء الصوتي للحلقة 001.
 * v1 (الأمر 023) وv1.1 (الأمر 024) وv1.2 (الأمر 025، نسخة المحتوى V7) محفوظة كما سُلّمت.
 * v1.3 (V8، ١١ نوفمبر): سرد متصل بلا بطاقات آيات ولا فصول، والآيات وسم مرجع فقط؛ المقاطع الباقية بمعرّفاتها.
 * v1.4 (١١ نوفمبر، D70): v1.3 نفسها بأسماء النبرات القوية الرزينة وحدها — محفوظة باسمها مع تشكيل V8 وسكريبته وخطته.
 * v1.5 (١١ نوفمبر): نسخة المحتوى V9 (السكريبت المعتمد من المالك، وسبعة استشهادات بصرية صامتة) — محفوظة باسمها.
 * الحالية v1.6 (١١ نوفمبر، D79): v1.5 نفسها بأسماء نبرات v1.3 (أُلغي قرار النبرات القوية D70).
 */
const EP = "channels/dafatir-alzaman/episodes/001-adam-beginning";
const read = (f: string) => readFileSync(path.join(EP, f), "utf8");
type Seg = {
  n: number; id?: string; key?: string; scene: string; tone: string; text: string; marked: string; tashkeelLine: number;
  audioPart?: string; indexInScene?: number; emphasis: string[]; pauses: unknown[]; speed: string;
  tashkeelCorrection?: { decision: string; before: string; after: string };
};
type Map = {
  version: string; approved: boolean; source: { tashkeel: { sha256: string } }; sceneTones: Record<string, string>;
  segments: Seg[]; recitations: { ref: string; scene: string; status: string }[]; decisions: { id: string; decision: unknown }[];
  audioParts?: { id: string; scene: string; segments: number[]; tone: string }[];
  boundaries?: { after: string; segment: number; type: string; owner: string; target: number[] }[];
  tashkeelCorrections?: { decision: string; segment: number; tashkeelLine: number; before: string; after: string; lineBefore: string; lineAfter: string; status: string }[];
};
const v1 = JSON.parse(read("tone-map.v1.json")) as Map;
// v1.2 (V7) محفوظة باسمها، ومعها تشكيل V7 وخطته: اختبارات الأمر 025 تجري عليها كما سُلّمت
const map = JSON.parse(read("tone-map.v1.2.json")) as Map;
// v1.3 (V8) محفوظة باسمها بعد v1.4 (أسماء النبرات القوية الرزينة، ١١ نوفمبر): اختبارات V8 تجري عليها كما هي
const cur = JSON.parse(read("tone-map.v1.3.json")) as Map & { citations: { ref: string; scene: string; status: string }[]; changelog: { from: string; to: string; removed: number[]; edited: number[] }[] };
const v11 = JSON.parse(read("tone-map.v1.1.json")) as Map;
const CORRECTED = [16, 29, 32];
const tashkeel = read("versions/v7/tashkeel.md");
const tashkeel8 = read("versions/v8/tashkeel.md");
const plain = (s: string) => stripTashkeel(s).split(/\s+/).map(normWord).filter(Boolean).join(" ");

describe("خريطة الأداء الصوتي v1 — محفوظة (الأمر 023)", () => {
  it("v1 كما سُلّمت: مطابقة لنسخة المراجعة 023، وغير معتمدة، وقراراتها فارغة", () => {
    expect(v1.version).toBe("v1");
    expect(read("tone-map.v1.json")).toBe(readFileSync(path.join(EP, "tech-reviews/023/docs/tone-map-001-v1.json"), "utf8"));
    expect(v1.approved).toBe(false);
    expect(v1.decisions.every((d) => d.decision === null)).toBe(true);
  });
});

describe("خريطة الأداء الصوتي v1.2 — محفوظة (الأمر 025، نسخة المحتوى V7)", () => {
  it("v1.1 محفوظة كما سُلّمت في المراجعة 024، وv1.2 غير معتمدة ومطابقة لنسخة المراجعة 025", () => {
    expect(v11.version).toBe("v1.1");
    expect(read("tone-map.v1.1.json")).toBe(readFileSync(path.join(EP, "tech-reviews/024/docs/tone-map-001-v1.1.json"), "utf8"));
    expect(map.version).toBe("v1.2");
    expect(map.approved).toBe(false);
    expect(read("tone-map.v1.2.json")).toBe(readFileSync(path.join(EP, "tech-reviews/025/docs/tone-map-001-v1.2.json"), "utf8"));
  });

  it("مبنية على التشكيل الحالي: البصمة مطابقة، وكل مقطع مطابق لسطره حرفًا، والعلامات لا تغيّر النص", () => {
    expect(map.source.tashkeel.sha256).toBe(createHash("sha256").update(tashkeel).digest("hex"));
    const lines = tashkeel.split("\n");
    for (const s of map.segments) {
      expect(lines[s.tashkeelLine - 1]!.trim(), `مقطع ${s.n}`).toBe(s.text);
      expect(s.marked.replace(/ ?[|‖]/g, "").replace(/\*\*/g, ""), `علامات المقطع ${s.n}`).toBe(s.text);
    }
  });

  it("المقاطع الـ88 محفوظة عن v1: الرقم والمشهد والنص والسطر والعلامات والتأكيد والوقفات والسرعة", () => {
    expect(map.segments).toHaveLength(88);
    expect(v1.segments).toHaveLength(88);
    map.segments.forEach((s, i) => {
      const o = v1.segments[i]!;
      // المقاطع المصححة تشكيلها وحده تغيّر (D2–D4)؛ حروفها كما هي
      const t = (x: string) => (CORRECTED.includes(s.n) ? stripTashkeel(x) : x);
      expect({ n: s.n, scene: s.scene, text: t(s.text), line: s.tashkeelLine, marked: t(s.marked), emphasis: s.emphasis.map(t), pauses: s.pauses, speed: s.speed }).toEqual({
        n: o.n, scene: o.scene, text: t(o.text), line: o.tashkeelLine, marked: t(o.marked), emphasis: o.emphasis.map(t), pauses: o.pauses, speed: o.speed,
      });
    });
    expect(map.segments.filter((s, i) => s.text !== v1.segments[i]!.text).map((s) => s.n)).toEqual(CORRECTED);
    expect(map.recitations).toEqual(v1.recitations);
  });

  it("معرّفات ثابتة ومفاتيح لا تتغير بالتشكيل، وكل مشهد منطوق نصه في الخطة = مقاطعه موصولة", () => {
    expect(map.segments.map((s) => s.id)).toEqual(map.segments.map((s) => `s${String(s.n).padStart(3, "0")}`));
    for (const s of map.segments) expect(s.key).toBe(createHash("sha1").update(stripTashkeel(s.text).replace(/[^\p{L}\p{N}\s_]/gu, "").replace(/\s+/g, " ").trim()).digest("hex").slice(0, 12));
    const plan = JSON.parse(read("plan.v7.json")) as { chapters: { scenes: { id: string; narration?: string }[] }[] };
    const scenes = plan.chapters.flatMap((c) => c.scenes);
    const spoken = scenes.filter((s) => s.narration?.trim());
    expect(Object.keys(map.sceneTones).sort()).toEqual(spoken.map((s) => s.id).sort());
    // الترتيب: المقاطع تتبع ترتيب المشاهد في الخطة، ولكل مشهد مقاطعه متتالية
    const sceneOrder = map.segments.map((s) => s.scene).filter((x, i, a) => a.indexOf(x) === i);
    expect(sceneOrder).toEqual(spoken.map((s) => s.id));
    for (const sc of spoken) {
      const segs = map.segments.filter((s) => s.scene === sc.id);
      expect(segs.map((s) => s.indexInScene)).toEqual(segs.map((_, i) => i + 1));
      expect(plain(segs.map((s) => s.text).join(" ")), sc.id).toBe(plain(sc.narration!));
    }
  });

  it("القرارات D1–D9 مثبتة، ولا نبرة درامية ولا حماسية (D9)", () => {
    expect(map.decisions.map((d) => d.id)).toEqual(["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9"]);
    expect(map.decisions.every((d) => typeof d.decision === "string" && (d.decision as string).length > 10)).toBe(true);
    for (const s of map.segments) {
      expect(isTone(s.tone)).toBe(true);
      expect(["dramatic", "energetic"]).not.toContain(s.tone);
    }
  });

  it("D5: الحمد جزء صوتي مستقل بنبرة هادئة داخل المشهد البصري c7-s8 الواحد، وكل مقطع في جزء واحد", () => {
    const parts = map.audioParts!;
    expect(parts).toHaveLength(52);
    expect(parts.filter((p) => p.scene === "c7-s8")).toEqual([
      expect.objectContaining({ id: "c7-s8.a", segments: [86, 87], tone: "warm" }),
      expect.objectContaining({ id: "c7-s8.b", segments: [88], tone: "calm" }),
    ]);
    expect(parts.flatMap((p) => p.segments).sort((a, b) => a - b)).toEqual(map.segments.map((s) => s.n));
    for (const s of map.segments) {
      const p = parts.find((x) => x.id === s.audioPart)!;
      expect(p.scene).toBe(s.scene);
      expect(s.tone).toBe(p.tone);
    }
    expect(stripTashkeel(map.segments[87]!.text)).toBe("والحمد لله رب العالمين.");
  });

  it("D7: لا وقفة قبل «عليه السلام» في أي مقطع", () => {
    for (const s of map.segments) expect(s.marked, `مقطع ${s.n}`).not.toMatch(/[|‖] عَلَيْهِ السَّلَامُ/);
  });

  it("D2–D4: التصحيحات مطبقة على التشكيل، كلمة واحدة في سطرها، والصياغة وعلامات الآيات لا تتغير", () => {
    const lines = tashkeel.split("\n");
    const c = map.tashkeelCorrections!;
    expect(c.map((x) => [x.decision, x.segment, x.tashkeelLine])).toEqual([["D4", 16, 42], ["D2", 29, 77], ["D3", 32, 87]]);
    for (const x of c) {
      expect(x.status).toContain("مطبَّق");
      expect(lines[x.tashkeelLine - 1]).toBe(x.lineAfter);
      expect(v11.segments[x.segment - 1]!.text).toBe(x.lineBefore);
      expect(map.segments[x.segment - 1]!.text).toBe(x.lineAfter);
      expect(x.lineBefore.split(x.before)).toHaveLength(2);
      expect(x.lineAfter).toBe(x.lineBefore.replace(x.before, x.after));
      expect(stripTashkeel(x.after)).toBe(stripTashkeel(x.before));
      expect(plain(x.lineAfter)).toBe(plain(x.lineBefore));
      expect(map.segments[x.segment - 1]!.tashkeelCorrection).toMatchObject({ decision: x.decision, before: x.before, after: x.after });
    }
    expect([...tashkeel.matchAll(/\[آية: (.+)\]/g)]).toHaveLength(22);
    // النص بعد التصحيح يبقى مطابقًا للسكريبت بلا تشكيل
    const script = read("versions/v7/script.md");
    for (const x of c) expect(plain(script)).toContain(plain(x.lineAfter));
  });

  it("D8: حد واحد بعد كل مقطع بمالك واحد، والوقفات داخل الجمل وحدها", () => {
    const b = map.boundaries!;
    expect(b.map((x) => x.segment)).toEqual(map.segments.map((s) => s.n));
    const owners: Record<string, string> = { sentence: "clip", "audio-part": "part-gap", scene: "scene-tail", verse: "verse-lead", chapter: "chapter-card", end: "scene-tail" };
    for (const x of b) {
      expect(owners[x.type], x.after).toBe(x.owner);
      expect(x.target[0]!).toBeLessThanOrEqual(x.target[1]!);
    }
    // حد التلاوة عند كل مقطع تليه آية في التشكيل، ولا غيره
    expect(b.filter((x) => x.type === "verse").map((x) => x.segment)).toEqual(
      [...new Set(map.segments.filter((s) => (s as Seg & { nextRecitation: string[] }).nextRecitation.length).map((s) => s.n))],
    );
    expect(b.filter((x) => x.type === "verse").every((x) => x.target[1]! <= 0.8)).toBe(true);
    expect(b.filter((x) => x.type === "chapter")).toHaveLength(6);
    for (const s of map.segments) expect(s.marked.trim(), `مقطع ${s.n}`).not.toMatch(/[|‖]$/);
  });

  it("التلاوات منفصلة ومعلّقة: كل علامة آية لها بطاقتها، ولا تلاوة في أي جزء صوتي", () => {
    const refs = [...tashkeel.matchAll(/\[آية: (.+)\]/g)].map((m) => m[1]);
    expect(map.recitations.map((r) => r.ref)).toEqual(refs);
    expect(map.recitations.every((r) => /^c\d-v\d+$/.test(r.scene) && r.status.startsWith("معلّقة"))).toBe(true);
    expect(map.audioParts!.some((p) => /-v\d/.test(p.scene))).toBe(false);
  });
});

describe("خريطة الأداء الصوتي — v1.3 (نسخة المحتوى V8، ١١ نوفمبر)", () => {
  const plan8 = JSON.parse(read("plan.v8.json")) as { chapters: { number: number; scenes: { id: string; template: string; narration?: string; props?: Record<string, unknown> }[] }[] };
  const scenes8 = plan8.chapters.flatMap((c) => c.scenes);
  const spoken8 = scenes8.filter((s) => s.narration?.trim());

  it("غير معتمدة، ومبنية على التشكيل والسكريبت والخطة الحالية ببصماتها", () => {
    expect(cur.version).toBe("v1.3");
    expect(cur.approved).toBe(false);
    const sha = (f: string) => createHash("sha256").update(readFileSync(path.join(EP, f))).digest("hex");
    // الخطة تغيّرت بعد v1.3 في وسم c5-s6 وحده (props.ref، لا نص)؛ v1.4 تحمل بصمتها الحالية
    expect(cur.source).toMatchObject({ tashkeel: { sha256: sha("versions/v8/tashkeel.md") }, script: { sha256: sha("versions/v8/script.md") } });
    expect((cur as unknown as { previous: { version: string }[] }).previous.map((x) => x.version)).toEqual(["v1", "v1.1", "v1.2"]);
  });

  it("المقاطع الباقية بمعرّفاتها ونصها عن v1.2، إلا الستة المعدلة؛ والمحذوفة مع مشاهدها وحدها", () => {
    const last = cur.changelog.at(-1)!;
    expect(last).toMatchObject({ from: "v1.2", to: "v1.3" });
    expect(last.edited).toEqual([25, 47, 50, 58, 60, 64]);
    expect(cur.segments.map((s) => s.n)).toEqual(map.segments.map((s) => s.n).filter((n) => !last.removed.includes(n)));
    for (const s of cur.segments) {
      const o = map.segments.find((x) => x.n === s.n)!;
      expect(s.id).toBe(o.id);
      expect(s.scene).toBe(o.scene);
      if (!last.edited.includes(s.n)) expect(s.text, `مقطع ${s.n}`).toBe(o.text);
    }
    // المحذوف: مشاهد كاملة فقط
    const gone = new Set(map.segments.filter((s) => last.removed.includes(s.n)).map((s) => s.scene));
    expect([...gone].sort()).toEqual(["c1-s7", "c1-s8", "c2-s5", "c3-s2", "c3-s3", "c7-s4", "c7-s5", "c7-s7"]);
  });

  it("كل مقطع مطابق لسطره في التشكيل، والعلامات لا تغيّر النص، وكل مشهد منطوق = مقاطعه", () => {
    const lines = tashkeel8.split("\n");
    for (const s of cur.segments) {
      expect(lines[s.tashkeelLine - 1]!.trim(), `مقطع ${s.n}`).toBe(s.text);
      expect(s.marked.replace(/ ?[|‖]/g, "").replace(/\*\*/g, ""), `علامات ${s.n}`).toBe(s.text);
      expect(s.key).toBe(createHash("sha1").update(stripTashkeel(s.text).replace(/[^\p{L}\p{N}\s_]/gu, "").replace(/\s+/g, " ").trim()).digest("hex").slice(0, 12));
      expect(s.marked, `مقطع ${s.n}`).not.toMatch(/[|‖] عَلَيْهِ السَّلَامُ/);
    }
    expect(Object.keys(cur.sceneTones).sort()).toEqual(spoken8.map((s) => s.id).sort());
    for (const sc of spoken8) expect(plain(cur.segments.filter((s) => s.scene === sc.id).map((s) => s.text).join(" ")), sc.id).toBe(plain(sc.narration!));
  });

  it("لا تلاوة ولا علامة آية: المراجع الـ23 استشهاد فقط، ولا حد آية ولا حد فصل", () => {
    expect(cur.recitations).toEqual([]);
    expect([...tashkeel8.matchAll(/\[آية: /g)]).toHaveLength(0);
    expect(cur.citations).toHaveLength(23);
    expect(cur.citations.every((c) => c.status.startsWith("مرجع فقط"))).toBe(true);
    const b = cur.boundaries!;
    expect(b.map((x) => x.segment)).toEqual(cur.segments.map((s) => s.n));
    expect(b.filter((x) => x.type === "verse" || x.type === "chapter")).toEqual([]);
    expect(b.at(-1)!.type).toBe("end");
    expect(cur.audioParts!.flatMap((p) => p.segments).sort((a, c) => a - c)).toEqual(cur.segments.map((s) => s.n));
    expect(cur.audioParts!.filter((p) => p.scene === "c7-s8").map((p) => p.id)).toEqual(["c7-s8.a", "c7-s8.b"]);
  });

  it("الخطة V8: لا بطاقة آية ولا بطاقة فصل ولا رأس فصل، ووسم المرجع باقٍ على صفحاته", () => {
    expect(scenes8.filter((s) => s.template === "verse-card")).toEqual([]);
    expect(scenes8.filter((s) => s.props?.shot === "chapter")).toEqual([]);
    expect(scenes8.filter((s) => "head" in (s.props ?? {}))).toEqual([]);
    expect(scenes8.filter((s) => s.props?.ref).map((s) => s.id)).toEqual(["c2-s1", "c2-s2", "c3-s4", "c3-s5", "c3-s7", "c3-s8", "c4-s4", "c5-s6", "c5-s7", "c6-s1"]);
    // تنظيم المشاهد الداخلي ومعرّفاتها باقية
    expect(plan8.chapters.map((c) => c.number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(scenes8).toHaveLength(44);
  });
});

describe("خريطة الأداء الصوتي — v1.4 (النبرات قوية ورزينة، ١١ نوفمبر، D70) محفوظة", () => {
  type Labeled = Map & { legend: { tones: Record<string, string> }; previous: { version: string; path: string }[]; changelog: { from: string; to: string; source?: string }[];
    citations?: unknown[]; source: Record<string, unknown> };
  const live = JSON.parse(read("tone-map.v1.4.json")) as Labeled;
  const v13 = cur as unknown as Labeled;
  it("v1.4 = v1.3 مع أسماء النبرات وحدها؛ المقاطع والأجزاء والحدود والمراجع والبصمات كما هي، وv1.3 محفوظة", () => {
    expect(live.version).toBe("v1.4");
    expect(live.approved).toBe(false);
    expect(v13.version).toBe("v1.3");
    for (const k of ["segments", "audioParts", "sceneTones", "boundaries", "citations", "recitations", "decisions"] as const)
      expect((live as Record<string, unknown>)[k], k).toEqual((v13 as Record<string, unknown>)[k]);
    // البصمات: التشكيل والسكريبت كما في v1.3، والخطة بعد وسم c5-s6 (props.ref وحده، والنص كما هو)
    const sha = (f: string) => createHash("sha256").update(readFileSync(path.join(EP, f))).digest("hex");
    const src = live.source as Record<string, { sha256: string }>;
    const src13 = v13.source as Record<string, { sha256: string }>;
    expect(src.tashkeel).toEqual(src13.tashkeel);
    expect(src.script).toEqual(src13.script);
    expect(src.plan!.sha256).toBe(sha("plan.v8.json"));
    expect(live.legend.tones).toEqual({ calm: "تأمّلي رزين", documentary: "وثائقي حازم", warm: "حكّاء رزين", intimate: "قريب رزين" });
    expect(Object.values(live.legend.tones).join(" ")).not.toMatch(/هادئ|ناعم|هامس|دافئ/);
    for (const t of Object.keys(live.legend.tones)) expect(isTone(t)).toBe(true);
    expect(live.previous.map((x) => x.version)).toEqual(["v1", "v1.1", "v1.2", "v1.3"]);
    expect(live.previous.at(-1)).toEqual({ version: "v1.3", path: "tone-map.v1.3.json" });
    expect(live.changelog.slice(0, -1)).toEqual(v13.changelog);
    expect(live.changelog.at(-1)).toMatchObject({ from: "v1.3", to: "v1.4", source: "strong-voice" });
  });
});

describe("خريطة الأداء الصوتي — v1.5 (نسخة المحتوى V9، ١١ نوفمبر) محفوظة", () => {
  type V15 = Map & { order: string; previous: { version: string; path: string }[]; citations: { ref: string; scene: string | null; status: string }[];
    changelog: { from: string; to: string; kept: number[]; added: number[]; removed: number[] }[]; quranFlags: { scene: string }[];
    source: Record<string, { sha256: string }> };
  const v15 = JSON.parse(read("tone-map.v1.5.json")) as V15;
  const v14 = JSON.parse(read("tone-map.v1.4.json")) as V15;
  const plan9 = JSON.parse(read("plan.v9.json")) as { chapters: { scenes: { id: string; narration?: string; props?: Record<string, unknown> }[] }[] };
  const spoken9 = plan9.chapters.flatMap((c) => c.scenes).filter((s) => s.narration?.trim());
  const tashkeel9 = read("versions/v9/tashkeel.md");
  const sha = (f: string) => createHash("sha256").update(readFileSync(path.join(EP, f))).digest("hex");

  it("غير معتمدة، ومبنية على تشكيل V9 وسكريبته وخطته ببصماتها، وv1.4 محفوظة", () => {
    expect(v15.version).toBe("v1.5");
    expect(v15.order).toBe("V9");
    expect(v15.approved).toBe(false);
    expect(v15.source.tashkeel!.sha256).toBe(sha("versions/v9/tashkeel.md"));
    expect(v15.source.script!.sha256).toBe(sha("versions/v9/script.md"));
    expect(v15.source.plan!.sha256).toBe(sha("plan.v9.json"));
    expect(v15.previous.at(-1)).toEqual({ version: "v1.4", path: "tone-map.v1.4.json" });
    expect(v15.changelog.at(-1)).toMatchObject({ from: "v1.4", to: "v1.5" });
  });

  it("كل مقطع مطابق لسطره في التشكيل وكل مشهد منطوق = مقاطعه؛ الباقي بنصه احتفظ بمعرّفه ونبرته", () => {
    const lines = tashkeel9.split("\n");
    for (const s of v15.segments) {
      expect(lines[s.tashkeelLine - 1]!.trim(), `مقطع ${s.n}`).toBe(s.text);
      expect(s.marked.replace(/ ?[|‖]/g, "").replace(/\*\*/g, ""), `علامات ${s.n}`).toBe(s.text);
      expect(s.key).toBe(createHash("sha1").update(stripTashkeel(s.text).replace(/[^\p{L}\p{N}\s_]/gu, "").replace(/\s+/g, " ").trim()).digest("hex").slice(0, 12));
      expect(isTone(s.tone), `نبرة ${s.n}`).toBe(true);
    }
    expect(new Set(v15.segments.map((s) => s.id)).size).toBe(v15.segments.length);
    expect(Object.keys(v15.sceneTones).sort()).toEqual(spoken9.map((s) => s.id).sort());
    for (const sc of spoken9) expect(plain(v15.segments.filter((s) => s.scene === sc.id).map((s) => s.text).join(" ")), sc.id).toBe(plain(sc.narration!));
    const last = v15.changelog.at(-1)!;
    for (const s of v15.segments) {
      const o = v14.segments.find((x) => x.text === s.text);
      if (o) {
        expect(last.kept).toContain(o.n);
        expect(s.id).toBe(o.id);
        expect(s.tone).toBe(o.tone);
      } else expect(last.added).toContain(s.n);
    }
    expect(last.kept.length + last.added.length).toBe(v15.segments.length);
  });

  it("لا تلاوة؛ سبعة استشهادات بصرية صامتة في مشاهدها والباقي مرجع فقط؛ والجملتان المطابقتان لنص آية معلَّمتان", () => {
    expect(v15.recitations).toEqual([]);
    const shown = v15.citations.filter((c) => c.scene);
    expect(shown.map((c) => c.ref)).toEqual(["البقرة 30", "البقرة 31", "البقرة 34", "البقرة 35", "الأعراف 23", "البقرة 38", "النساء 1"]);
    for (const c of shown) expect(plan9.chapters.flatMap((x) => x.scenes).find((s) => s.id === c.scene)!.props!.verseText, c.ref).toBeTruthy();
    expect(v15.citations).toHaveLength(23);
    expect(v15.quranFlags.map((f) => f.scene)).toEqual(["c6-s1", "c7-s1"]);
    const b = v15.boundaries!;
    expect(b.map((x) => x.segment)).toEqual(v15.segments.map((s) => s.n));
    expect(b.filter((x) => x.type === "verse" || x.type === "chapter")).toEqual([]);
    expect(b.at(-1)!.type).toBe("end");
    expect(v15.audioParts!.flatMap((p) => p.segments).sort((a, c) => a - c)).toEqual(v15.segments.map((s) => s.n));
    expect(v15.audioParts!.filter((p) => p.scene === "c7-s8").map((p) => p.id)).toEqual(["c7-s8.a", "c7-s8.b"]);
  });
});

describe("خريطة الأداء الصوتي — v1.6 (أُلغيت النبرات القوية D70، ١١ نوفمبر، D79) محفوظة", () => {
  type Labeled = Map & { legend: { tones: Record<string, string>; pauses?: unknown }; previous: { version: string; path: string }[]; changelog: { from: string; to: string; source?: string }[];
    source: Record<string, unknown> };
  const live = JSON.parse(read("tone-map.v1.6.json")) as Labeled;
  const v15 = JSON.parse(read("tone-map.v1.5.json")) as Labeled;
  const v13 = cur as unknown as Labeled;
  it("v1.6 = v1.5 (V9) بأسماء v1.3 وحدها؛ كل ما عدا الاسم والإصدار والسجل كما في v1.5، وv1.5 محفوظة", () => {
    expect(live.version).toBe("v1.6");
    expect(live.approved).toBe(false);
    expect(v15.version).toBe("v1.5");
    const { version: _a, status: _b, legend: l6, previous: p6, changelog: c6, ...rest6 } = live as unknown as Record<string, unknown> & Labeled;
    const { version: _c, status: _d, legend: l5, previous: p5, changelog: c5, ...rest5 } = v15 as unknown as Record<string, unknown> & Labeled;
    expect(rest6).toEqual(rest5);
    expect(l6.pauses).toEqual(l5.pauses);
    expect(l6.tones).toEqual(v13.legend.tones);
    expect(l6.tones).toEqual({ calm: "هادئ تأملي", documentary: "وثائقي رصين", warm: "حكّاء دافئ", intimate: "قريب هادئ" });
    expect(l5.tones).toEqual({ calm: "تأمّلي رزين", documentary: "وثائقي حازم", warm: "حكّاء رزين", intimate: "قريب رزين" });
    for (const t of Object.keys(l6.tones)) expect(isTone(t)).toBe(true);
    expect(p6).toEqual([...p5, { version: "v1.5", path: "tone-map.v1.5.json" }]);
    expect(c6.slice(0, -1)).toEqual(c5);
    expect(c6.at(-1)).toMatchObject({ from: "v1.5", to: "v1.6", source: "revert-strong-voice" });
  });
});

/** النسخة قبل جعل الخطة قسمًا واحدًا (D87): خطة v1.7 وتشكيلها بأقسامهما السبعة */
const SECTIONS = "versions/2026-11-11-4a9cc3b0-sections";

describe("خريطة الأداء الصوتي — v1.7 (صياغة المالك بالمعنى لجملتي c6-s1 وc7-s1، ١١ نوفمبر) محفوظة مع خطتها وتشكيلها بأقسامهما السبعة", () => {
  type V17 = Map & { order: string; legend: { tones: Record<string, string> }; previous: { version: string; path: string }[];
    changelog: { from: string; to: string; edited?: number[] }[]; quranFlags: { scene: string; status?: string }[]; source: Record<string, { sha256: string }> };
  const v17 = JSON.parse(read("tone-map.v1.7.json")) as V17;
  const v16 = JSON.parse(read("tone-map.v1.6.json")) as V17;
  const plan = JSON.parse(read(`${SECTIONS}/plan.json`)) as { chapters: { scenes: { id: string; narration?: string; props?: Record<string, unknown> }[] }[] };
  const spoken = plan.chapters.flatMap((c) => c.scenes).filter((s) => s.narration?.trim());
  const sha = (f: string) => createHash("sha256").update(readFileSync(path.join(EP, f))).digest("hex");

  it("مبنية على السكريبت والتشكيل والخطة الحالية، وv1.6 محفوظة، وأسماء النبرات كما في v1.6", () => {
    expect(v17.version).toBe("v1.7");
    expect(v17.approved).toBe(false);
    expect(v17.source.tashkeel!.sha256).toBe(sha(`${SECTIONS}/tashkeel.md`));
    // بُنيت على السكريبت بعناوين V8؛ حُذفت العناوين بعدها (D83) ونسخته محفوظة، والكلام المنطوق والخريطة كما هما
    expect(v17.source.script!.sha256).toBe(sha("versions/2026-11-11-d5569881-headings/script.md"));
    const heading = /^## الفصل \d+ · /;
    const withHeadings = read("versions/2026-11-11-d5569881-headings/script.md").split("\n");
    const removed = withHeadings.filter((l) => heading.test(l));
    expect(removed).toEqual(read("versions/v8/script.md").split("\n").filter((l) => heading.test(l)));
    expect(read("script.md").split("\n").some((l) => heading.test(l))).toBe(false);
    const nonBlank = (ls: string[]) => ls.filter((l) => l.trim() && !heading.test(l));
    expect(nonBlank(read("script.md").split("\n"))).toEqual(nonBlank(withHeadings));
    expect(v17.source.plan!.sha256).toBe(sha(`${SECTIONS}/plan.json`));
    expect(v17.legend.tones).toEqual(v16.legend.tones);
    expect(v17.previous.at(-1)).toEqual({ version: "v1.6", path: "tone-map.v1.6.json" });
    expect(v17.changelog.slice(0, -1)).toEqual(v16.changelog);
    expect(v17.changelog.at(-1)).toMatchObject({ from: "v1.6", to: "v1.7", edited: [64, 72] });
  });

  it("المقطعان المعدلان وحدهما تغيّرا؛ كل مقطع مطابق لسطره وكل مشهد = مقاطعه", () => {
    const lines = read(`${SECTIONS}/tashkeel.md`).split("\n");
    for (const s of v17.segments) {
      expect(lines[s.tashkeelLine - 1]!.trim(), `مقطع ${s.n}`).toBe(s.text);
      expect(s.marked.replace(/ ?[|‖]/g, "").replace(/\*\*/g, "")).toBe(s.text);
      const o = v16.segments.find((x) => x.n === s.n)!;
      if ([64, 72].includes(s.n)) expect(s.id).not.toBe(o.id);
      else { expect(s.id).toBe(o.id); expect(s.text).toBe(o.text); expect(s.tone).toBe(o.tone); }
    }
    for (const sc of spoken) expect(plain(v17.segments.filter((s) => s.scene === sc.id).map((s) => s.text).join(" ")), sc.id).toBe(plain(sc.narration!));
  });

  it("الحارس يقبل كل مقطع عدا البسملة (يسجلها المالك)، ويعرف نصوص الآيات المعروضة السبع", () => {
    expect(v17.quranFlags.map((f) => [f.scene, f.status])).toEqual([["c6-s1", "resolved"], ["c7-s1", "resolved"]]);
    const verses = planVerseTexts(plan as never);
    expect(verses).toHaveLength(7);
    for (const s of v17.segments) {
      if (s.scene === "c1-s1") continue;
      expect(isQuranFreeForTts(stripTashkeel(s.text), { id: s.scene }, { verses }), `مقطع ${s.n}`).toBe(true);
    }
  });
});

describe("خريطة الأداء الصوتي — الإصدار الحالي v1.8 (سرد واحد بلا فصول: الخطة قسم واحد، D87)", () => {
  type Seg8 = Seg & { audioPart: string; chapter: number };
  type V18 = Omit<Map, "segments" | "audioParts"> & { segments: Seg8[]; audioParts: { id: string; scene: string; segments: number[]; tone: string }[];
    previous: { version: string; path: string }[]; changelog: { from: string; to: string; source?: string }[];
    citations: { ref: string; scene: string | null }[]; quranFlags: { scene: string; status?: string; note?: string }[];
    source: Record<string, { sha256: string }>; [k: string]: unknown };
  type P = { chapters: { number: number; title: string; scenes: ({ id: string; narration?: string } & Record<string, unknown>)[] }[] };
  const v18 = JSON.parse(read("tone-map.json")) as V18;
  const v17 = JSON.parse(read("tone-map.v1.7.json")) as V18;
  const ids = (JSON.parse(read(`${SECTIONS}/id-map.json`)) as { map: Record<string, string> }).map;
  const plan = JSON.parse(read("plan.json")) as P;
  const old = JSON.parse(read(`${SECTIONS}/plan.json`)) as P;
  const sha = (f: string) => createHash("sha256").update(readFileSync(path.join(EP, f))).digest("hex");

  it("v1.7 محفوظة بايتًا، والخطة الحالية قسم واحد بلا عنوان: كل مشهد كما كان إلا معرّفه", () => {
    expect(read("tone-map.v1.7.json")).toBe(read(`${SECTIONS}/tone-map.json`));
    expect(v17.version).toBe("v1.7");
    expect(v18.version).toBe("v1.8");
    expect(v18.approved).toBe(false);
    expect(plan.chapters.map((c) => [c.number, c.title])).toEqual([[1, ""]]);
    const before = old.chapters.flatMap((c) => c.scenes);
    const after = plan.chapters[0]!.scenes;
    expect(after.map((s) => s.id)).toEqual(before.map((s) => ids[s.id]));
    expect(after.map((s) => s.id)).toEqual(["c1-s0", ...after.slice(1).map((_, i) => `c1-s${i + 1}`)]);
    after.forEach((s, i) => expect({ ...s, id: before[i]!.id }).toEqual(before[i]));
    expect(old.chapters).toHaveLength(7);
  });

  it("كل نبرة لكل جملة كما هي: المقاطع والأجزاء والحدود والقرارات لم تتغير إلا معرّف المشهد ورقم السطر", () => {
    expect(v18.segments).toHaveLength(v17.segments.length);
    v18.segments.forEach((s, i) => {
      const o = v17.segments[i]!;
      expect(s.scene).toBe(ids[o.scene]);
      expect(s.chapter).toBe(1);
      const { scene: _a, chapter: _b, tashkeelLine: _c, ...rest } = s;
      const { scene: _d, chapter: _e, tashkeelLine: _f, ...restOld } = o;
      expect(rest, `مقطع ${s.n}`).toEqual(restOld);
      expect(s.tone).toBe(o.tone);
    });
    // معرّف الجزء داخل بصمة تسجيله (src/voice/generate.ts)، فيبقى كما هو وتبقى التسجيلات المدفوعة صالحة
    expect(v18.audioParts).toEqual(v17.audioParts.map((p) => ({ ...p, scene: ids[p.scene] })));
    expect(v18.sceneTones).toEqual(Object.fromEntries(Object.entries(v17.sceneTones).map(([k, t]) => [ids[k], t])));
    expect(v18.citations).toEqual(v17.citations.map((c) => (c.scene ? { ...c, scene: ids[c.scene] } : c)));
    expect(v18.quranFlags).toEqual(v17.quranFlags.map((c) => ({ ...c, scene: ids[c.scene] })));
    for (const k of ["boundaries", "decisions", "legend", "direction", "silenceRules", "recitations", "stats"])
      expect(v18[k], k).toEqual((v17 as Record<string, unknown>)[k]);
    expect(v18.previous.slice(0, -1)).toEqual(v17.previous);
    expect(v18.previous.at(-1)).toEqual({ version: "v1.7", path: "tone-map.v1.7.json" });
    expect(v18.changelog.slice(0, -1)).toEqual(v17.changelog);
    expect(v18.changelog.at(-1)).toMatchObject({ from: "v1.7", to: "v1.8", source: "single-section" });
  });

  it("مبنية على السكريبت والتشكيل والخطة الحالية؛ التشكيل بلا عناوين فصول، وكل مقطع مطابق لسطره وكل مشهد = مقاطعه", () => {
    expect(v18.source.tashkeel!.sha256).toBe(sha("tashkeel.md"));
    expect(v18.source.script!.sha256).toBe(sha("script.md"));
    expect(v18.source.plan!.sha256).toBe(sha("plan.json"));
    const tk = read("tashkeel.md");
    expect(tk.split("\n").some((l) => /^## الْفَصْلُ/.test(l))).toBe(false);
    const heading = /^## الْفَصْلُ /;
    const nonBlank = (ls: string[]) => ls.filter((l) => l.trim() && !heading.test(l));
    expect(nonBlank(tk.split("\n"))).toEqual(nonBlank(read(`${SECTIONS}/tashkeel.md`).split("\n")));
    const lines = tk.split("\n");
    for (const s of v18.segments) expect(lines[s.tashkeelLine - 1]!.trim(), `مقطع ${s.n}`).toBe(s.text);
    expect(v18.tashkeelCorrections).toEqual(v17.tashkeelCorrections);
    const spoken = plan.chapters.flatMap((c) => c.scenes).filter((s) => s.narration?.trim());
    expect(Object.keys(v18.sceneTones).sort()).toEqual(spoken.map((s) => s.id).sort());
    for (const sc of spoken) expect(plain(v18.segments.filter((s) => s.scene === sc.id).map((s) => s.text).join(" ")), sc.id).toBe(plain(sc.narration!));
  });

  it("مسار الأجزاء يقبلها على الخطة والتشكيل الحاليين، ومهام التوليد نفسها (الجزء والنص والنبرة والملف) بالمشهد الجديد", async () => {
    const { validatePartsContext } = await import("../src/voice/dafatirParts");
    const { partJobs } = await import("../src/remotion/dafatir/audio/parts");
    const jobs = validatePartsContext(v18 as never, plan as never, read("tashkeel.md"));
    const before = partJobs(v17 as never);
    expect(jobs).toEqual(before.map((j) => ({ ...j, scene: ids[j.scene] })));
    expect(() => validatePartsContext(v17 as never, plan as never, read("tashkeel.md"))).toThrow();
  });
});
