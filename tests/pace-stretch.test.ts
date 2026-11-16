/**
 * «سرعة الإلقاء»: جودة المد الحقيقي (D140). صوت شبيه بالكلام مولَّد (نبض حنجري بطبقة متغيرة عبر رنين صوتي، وكلمات بينها
 * صمت) — لا صوت حقيقي ولا شبكة — يمر على derivePaced نفسه (atempo من WAV إلى WAV) بالسرعات الثلاث والفاصل:
 * طبقة الصوت كما هي، ولا نقرة عند أي وصلة، والمدة كما خُطط لها، وكل كلمة في توقيتها الجديد فوق صوتها فعلًا.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { encodeWav } from "../src/remotion/dafatir/audio/compose";
import { decodeAudio } from "../src/voice/dafatirParts";
import { SPEEDS, scenePace, type PaceDoc } from "../src/voice/pace";
import { derivePaced } from "../src/voice/paceApply";
import type { PlanScene } from "../src/plan/types";
import { heavyTimeout } from "./helpers/heavyTimeout";

const SR = 44100;
const tmp = mkdtempSync(path.join(os.tmpdir(), "bal-pace-audio-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

/** «كلمات» من نبض حنجري (١٠٨–١٣٢ هرتز، طبقة لكل كلمة) عبر رنينين (٧٠٠ و١٢٠٠ هرتز)، بغلاف ناعم؛ وصمت خفيف (ضوضاء الغرفة) بينها */
const synth = (counts: number[], wordSec = 0.32, inner = 0.06, between = 0.7, lead = 0.25, tail = 0.5) => {
  const words: { word: string; start: number; end: number }[] = [];
  let t = lead;
  counts.forEach((n, k) => {
    for (let i = 0; i < n; i++) { words.push({ word: `w${k}${i}`, start: t, end: t + wordSec }); t += wordSec + inner; }
    t += (k < counts.length - 1 ? between : tail) - inner;
  });
  const N = Math.round(t * SR);
  const x = new Float32Array(N);
  let phase = 0;
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648) - 0.5;
  // رنينان بسيطان (مرشح ثنائي القطب)
  const res = (f: number, bw: number) => { const r = Math.exp(-Math.PI * bw / SR), c = 2 * r * Math.cos(2 * Math.PI * f / SR); return { a1: c, a2: -r * r, y1: 0, y2: 0 }; };
  const f1 = res(700, 120), f2 = res(1200, 150);
  for (let n = 0; n < N; n++) {
    const tt = n / SR;
    const w = words.find((q) => tt >= q.start && tt < q.end);
    let src = 0;
    if (w) {
      const f0 = 108 + 6 * words.indexOf(w); // طبقة ثابتة لكل كلمة ومختلفة بينها
      phase += f0 / SR;
      if (phase >= 1) { phase -= 1; src = 1; }
    }
    const y1 = src + f1.a1 * f1.y1 + f1.a2 * f1.y2; f1.y2 = f1.y1; f1.y1 = y1;
    const y2 = y1 + f2.a1 * f2.y1 + f2.a2 * f2.y2; f2.y2 = f2.y1; f2.y1 = y2;
    const env = w ? Math.sin(Math.PI * Math.min(1, (tt - w.start) / (w.end - w.start))) : 0;
    x[n] = 0.02 * y2 * env + 0.0008 * rnd();
  }
  let peak = 0;
  for (const v of x) peak = Math.max(peak, Math.abs(v));
  for (let n = 0; n < N; n++) x[n] = (x[n]! / peak) * 0.7;
  return { pcm: x, words, duration: N / SR };
};

/** طبقة الصوت بالارتباط الذاتي في نافذة */
const pitch = (x: Float32Array, at: number, len = 0.12) => {
  const a = Math.floor(at * SR), n = Math.floor(len * SR);
  let best = 0, lagBest = 0;
  for (let lag = Math.floor(SR / 200); lag <= Math.floor(SR / 80); lag++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += x[a + i]! * x[a + i + lag]!;
    if (s > best) { best = s; lagBest = lag; }
  }
  return SR / lagBest;
};
const rms = (x: Float32Array, a: number, b: number) => {
  let s = 0, c = 0;
  for (let i = Math.max(0, Math.floor(a * SR)); i < Math.min(x.length, Math.floor(b * SR)); i++) { s += x[i]! * x[i]!; c++; }
  return c ? Math.sqrt(s / c) : 0;
};
const maxStep = (x: Float32Array) => { let m = 0; for (let i = 1; i < x.length; i++) m = Math.max(m, Math.abs(x[i]! - x[i - 1]!)); return m; };

const scene = { id: "c1-s1", template: "alley-tale", line: 1, narration: "أ ب ج. د ه.", sfx: [], props: {} } as unknown as PlanScene;
const list = [{ text: "أ ب ج.", kind: "narration" as const }, { text: "د ه.", kind: "narration" as const }];

describe("المد الحقيقي يحفظ الصوت", () => {
  const ep = path.join(tmp, "episodes", "001-x");
  mkdirSync(path.join(ep, "voice"), { recursive: true });
  const scriptPath = path.join(ep, "script.md");
  writeFileSync(scriptPath, "");
  const src = synth([3, 2]);
  writeFileSync(path.join(ep, "voice", "raw.wav"), encodeWav(src.pcm, SR));
  const raw = { file: "raw.wav", hash: "rawhash", text: scene.narration, duration: src.duration, words: src.words };

  for (const [label, doc] of [
    ["سريع", { version: 1, episode: { speed: "fast" } }],
    ["سريع والفاصل الأقصر", { version: 1, episode: { speed: "fast", pause: "shortest" } }],
    ["هادئ", { version: 1, episode: { speed: "relaxed" } }],
  ] as [string, PaceDoc][]) {
    it(`${label}: طبقة الصوت، ولا نقرة، والمدة، والكلمات على صوتها`, async () => {
      const sp = scenePace(doc, scene, undefined, list, (t) => t.trim().split(/\s+/).length);
      const entry = await derivePaced(scriptPath, raw, sp);
      expect(entry.clip.file).toMatch(/^paced-[a-f0-9]{16}\.wav$/);
      const out = await decodeAudio(path.join(ep, "voice", entry.clip.file), SR);
      // المدة المسجلة = طول الملف
      expect(Math.abs(out.length / SR - entry.clip.duration)).toBeLessThan(0.01);
      const f = sp.sentences[0]!.factor;
      // الكلام: طوله الجديد = الأصل ÷ المعامل (±٣٪)
      const speech = (ws: { start: number; end: number }[]) => ws[2]!.end - ws[0]!.start;
      expect(speech(entry.clip.words) / (speech(src.words) / f)).toBeGreaterThan(0.97);
      expect(speech(entry.clip.words) / (speech(src.words) / f)).toBeLessThan(1.03);
      // طبقة الصوت كما هي (±٤٪) في وسط كل كلمة
      for (let i = 0; i < src.words.length; i++) {
        const a = src.words[i]!, b = entry.clip.words[i]!;
        const p0 = pitch(src.pcm, (a.start + a.end) / 2 - 0.06), p1 = pitch(out, (b.start + b.end) / 2 - 0.06);
        expect(Math.abs(p1 / p0 - 1), `pitch of word ${i}: ${p0.toFixed(1)} → ${p1.toFixed(1)}`).toBeLessThan(0.04);
        // الكلمة في توقيتها الجديد فوق صوتها: وسطها أعلى بكثير من الصمت
        expect(rms(out, b.start + 0.08, b.end - 0.08)).toBeGreaterThan(20 * rms(out, 0, 0.1));
      }
      // لا نقرة: أكبر قفزة بين عينتين لا تزيد على الأصل إلا بقدر يسير
      expect(maxStep(out)).toBeLessThan(maxStep(src.pcm) * 1.5);
      // العلو كما هو تقريبًا
      expect(rms(out, entry.clip.words[0]!.start, entry.clip.words[4]!.end) / rms(src.pcm, src.words[0]!.start, src.words[4]!.end)).toBeGreaterThan(0.85);
      if (doc.episode?.pause === "shortest") expect(entry.clip.words[3]!.start - entry.clip.words[2]!.end).toBeLessThan(0.45 * (src.words[3]!.start - src.words[2]!.end));
      if (f < 1) expect(entry.clip.duration).toBeGreaterThan(src.duration);
      else expect(entry.clip.duration).toBeLessThan(src.duration);
      expect(entry.clip.paced).toMatchObject({ key: sp.key, from: { file: "raw.wav", hash: "rawhash" } });
    }, heavyTimeout(60_000));
  }

  it("«متوسط» و«عادي»: لا نسخة — المفتاح فارغ، والصوت كما وُلّد", () => {
    expect(scenePace({ version: 1 }, scene, undefined, list, (t) => t.split(" ").length).key).toBe("");
    expect(SPEEDS.medium.factor).toBe(1);
  });
});
