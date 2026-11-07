import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { isTone } from "../src/voice/tones";
import { normWord, stripTashkeel } from "../src/voice/tashkeel";

/**
 * خريطة الأداء الصوتي للحلقة 001.
 * v1 (الأمر 023) محفوظة كما هي؛ وv1.1 (الأمر 024) تثبّت قرارات D1–D9 دون أن تغيّر نص أي مقطع أو مشهده أو رقمه،
 * وتصحيحات التشكيل فيها معدّة غير مطبقة، والتلاوات خارجها معلّقة، وكل حد صمت له مالك واحد.
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
const map = JSON.parse(read("tone-map.json")) as Map;
const tashkeel = read("tashkeel.md");
const plain = (s: string) => stripTashkeel(s).split(/\s+/).map(normWord).filter(Boolean).join(" ");

describe("خريطة الأداء الصوتي v1 — محفوظة (الأمر 023)", () => {
  it("v1 كما سُلّمت: مطابقة لنسخة المراجعة 023، وغير معتمدة، وقراراتها فارغة", () => {
    expect(v1.version).toBe("v1");
    expect(read("tone-map.v1.json")).toBe(readFileSync(path.join(EP, "tech-reviews/023/docs/tone-map-001-v1.json"), "utf8"));
    expect(v1.approved).toBe(false);
    expect(v1.decisions.every((d) => d.decision === null)).toBe(true);
  });
});

describe("خريطة الأداء الصوتي v1.1 — الأمر 024", () => {
  it("الإصدار v1.1، غير معتمد نهائيًا، ونسخة المراجعة 024 مطابقة له", () => {
    expect(map.version).toBe("v1.1");
    expect(map.approved).toBe(false);
    expect(read("tone-map.json")).toBe(readFileSync(path.join(EP, "tech-reviews/024/docs/tone-map-001-v1.1.json"), "utf8"));
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
      expect({ n: s.n, scene: s.scene, text: s.text, line: s.tashkeelLine, marked: s.marked, emphasis: s.emphasis, pauses: s.pauses, speed: s.speed }).toEqual({
        n: o.n, scene: o.scene, text: o.text, line: o.tashkeelLine, marked: o.marked, emphasis: o.emphasis, pauses: o.pauses, speed: o.speed,
      });
    });
    expect(map.recitations).toEqual(v1.recitations);
  });

  it("معرّفات ثابتة ومفاتيح لا تتغير بالتشكيل، وكل مشهد منطوق نصه في الخطة = مقاطعه موصولة", () => {
    expect(map.segments.map((s) => s.id)).toEqual(map.segments.map((s) => `s${String(s.n).padStart(3, "0")}`));
    for (const s of map.segments) expect(s.key).toBe(createHash("sha1").update(stripTashkeel(s.text).replace(/[^\p{L}\p{N}\s_]/gu, "").replace(/\s+/g, " ").trim()).digest("hex").slice(0, 12));
    const plan = JSON.parse(read("plan.json")) as { chapters: { scenes: { id: string; narration?: string }[] }[] };
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

  it("D2–D4: التصحيحات معدّة غير مطبقة، كلمة واحدة في سطرها، والصياغة لا تتغير", () => {
    const lines = tashkeel.split("\n");
    const c = map.tashkeelCorrections!;
    expect(c.map((x) => [x.decision, x.segment, x.tashkeelLine])).toEqual([["D4", 16, 42], ["D2", 29, 77], ["D3", 32, 87]]);
    for (const x of c) {
      expect(x.status).toContain("لم يُطبَّق");
      expect(lines[x.tashkeelLine - 1]).toBe(x.lineBefore);
      expect(x.lineBefore.split(x.before)).toHaveLength(2);
      expect(x.lineAfter).toBe(x.lineBefore.replace(x.before, x.after));
      expect(stripTashkeel(x.after)).toBe(stripTashkeel(x.before));
      expect(plain(x.lineAfter)).toBe(plain(x.lineBefore));
      expect(map.segments[x.segment - 1]!.tashkeelCorrection).toMatchObject({ decision: x.decision, before: x.before, after: x.after });
    }
    // النص بعد التصحيح يبقى مطابقًا للسكريبت بلا تشكيل
    const script = read("script.md");
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
