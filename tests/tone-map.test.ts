import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { isTone } from "../src/voice/tones";

/**
 * خريطة الأداء الصوتي للحلقة 001 (الأمر 023): مسودة غير معتمدة تغطي كل مقطع منطوق،
 * ونصها مأخوذ من tashkeel.md حرفًا بحرف، والتلاوات خارجها ومعلّقة.
 */
const EP = "channels/dafatir-alzaman/episodes/001-adam-beginning";
const read = (f: string) => readFileSync(path.join(EP, f), "utf8");
type Seg = { n: number; scene: string; tone: string; text: string; marked: string; tashkeelLine: number };
const map = JSON.parse(read("tone-map.json")) as {
  approved: boolean; source: { tashkeel: { sha256: string } }; sceneTones: Record<string, string>;
  segments: Seg[]; recitations: { ref: string; scene: string; status: string }[]; decisions: { decision: unknown }[];
};

describe("خريطة الأداء الصوتي — الحلقة 001", () => {
  it("مسودة غير معتمدة، وقرارها فارغ", () => {
    expect(map.approved).toBe(false);
    expect(map.decisions.every((d) => d.decision === null)).toBe(true);
  });

  it("مبنية على التشكيل الحالي: البصمة مطابقة، وكل مقطع مطابق لسطره حرفًا", () => {
    const t = read("tashkeel.md");
    expect(map.source.tashkeel.sha256).toBe(createHash("sha256").update(t).digest("hex"));
    const lines = t.split("\n");
    for (const s of map.segments) {
      expect(lines[s.tashkeelLine - 1]!.trim(), `مقطع ${s.n}`).toBe(s.text);
      expect(s.marked.replace(/ ?[|‖]/g, "").replace(/\*\*/g, ""), `علامات المقطع ${s.n}`).toBe(s.text);
    }
  });

  it("تغطي كل مقطع منطوق وكل مشهد منطوق، بنبرات المحرك", () => {
    const body = read("tashkeel.md").split("\n").slice(3).map((l) => l.trim()).filter((l) => l && !l.startsWith("## ") && !l.startsWith("[آية:"));
    expect(map.segments.map((s) => s.text)).toEqual(body);
    const plan = JSON.parse(read("plan.json")) as { chapters: { scenes: { id: string; narration?: string }[] }[] };
    const spoken = plan.chapters.flatMap((c) => c.scenes).filter((s) => s.narration?.trim()).map((s) => s.id).sort();
    expect(Object.keys(map.sceneTones).sort()).toEqual(spoken);
    for (const s of map.segments) {
      expect(isTone(s.tone)).toBe(true);
      expect(s.tone).toBe(map.sceneTones[s.scene]);
    }
  });

  it("التلاوات منفصلة ومعلّقة: كل علامة آية لها بطاقتها، ولا نص قرآني في الخريطة", () => {
    const refs = [...read("tashkeel.md").matchAll(/\[آية: (.+)\]/g)].map((m) => m[1]);
    expect(map.recitations.map((r) => r.ref)).toEqual(refs);
    expect(map.recitations.every((r) => /^c\d-v\d+$/.test(r.scene) && r.status.startsWith("معلّقة"))).toBe(true);
  });

  it("نسخة المراجعة 023 مطابقة للنسخة المرجعية", () => {
    expect(readFileSync(path.join(EP, "tech-reviews/023/docs/tone-map-001-v1.json"), "utf8")).toBe(read("tone-map.json"));
  });
});
