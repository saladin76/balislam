import { describe, expect, it } from "vitest";
import config from "../config.json";
import { sceneAdvanceFrames, seamAudio, seamPlan, seamTarget, seamVolumeAt, SEAM } from "../src/plan/seams";
import { sceneFrames, sceneHoldFloor } from "../src/plan/duration";
import { pausedGap, defaultPauseMs } from "../src/voice/paceCore";
import { planPace, pacedTimes } from "../src/voice/pace";
import { episodeFrames, chapterStarts } from "../src/remotion/scenes/Episode";
import { buildSrt } from "../src/package/captions";
import { gainFor, narrationTarget, NARRATION_GAIN_LIMIT_DB } from "../src/studio/narrationLoudness";
import { emptyMedia, type EpisodeMedia } from "../src/plan/media";
import type { Plan, PlanScene } from "../src/plan/types";
import type { VoiceClip } from "../src/voice/generate";

/**
 * وصل السرد بين المشاهد (شكوى المالك ١٦ نوفمبر: «فصلات في الكلام لأنها من تجميع المشاهد»). بيانات مصطنعة كلها
 * (owner-pin-ok: لا تقرأ حلقة حقيقية): المشهد التالي يبدأ تحت ذيل السابق فيصير الصمت = الفاصل بين جملتين، والآية وتمهيدها
 * والبسملة والسكون المقصود كما هي، ومدة المالك تُحترم وتُذكر، ولا تلاشٍ على كلمة.
 */
const fps = config.video.fps;
const scene = (id: string, narration: string, extra: Partial<PlanScene> = {}): PlanScene =>
  ({ id, template: "alley-tale", narration, props: {}, sfx: [], ...extra }) as unknown as PlanScene;
/** A take: words from `head`, 0.4 s each, the file ends `tail` after the last word */
const clip = (s: PlanScene, head = 0.06, tail = 0.25, pause?: number): VoiceClip => {
  const ws = s.narration.split(/\s+/).filter(Boolean).map((w, i) => ({ word: w, start: head + i * 0.4, end: head + (i + 1) * 0.4 }));
  const end = ws[ws.length - 1]!.end;
  return { file: `${s.id}.wav`, hash: s.id, text: s.narration.trim(), duration: end + tail, words: ws,
    ...(pause !== undefined ? { paced: { key: "k", from: { file: "x", hash: "x", duration: 1 }, speed: 1, pause } } : {}) } as VoiceClip;
};
const mediaOf = (scenes: PlanScene[], f: (s: PlanScene) => VoiceClip | undefined = (s) => clip(s)): EpisodeMedia =>
  ({ ...emptyMedia, voice: Object.fromEntries(scenes.filter((s) => s.narration.trim()).map((s) => [s.id, f(s)!]).filter(([, c]) => c)) });
const long = "هذه جملة طويلة بما يكفي حتى لا يمسك القالب المشهد بأقل مدة له أبدا.";

describe("seam timing: the next scene starts under the tail, the speech gap = the chosen gap", () => {
  const a = scene("a", long), b = scene("b", long), c = scene("c", "وأخيرا " + long);
  const scenes = [a, b, c];

  it("stacked tail + head becomes the sentence gap, to the frame (never shorter)", () => {
    const media = mediaOf(scenes);
    const seams = seamPlan(scenes, media);
    for (const s of seams) {
      expect(s.kept).toBeUndefined();
      // before: the take's tail + the scene tail + the next head, stacked
      expect(s.stacked!).toBeGreaterThan(s.target! + 0.15);
      expect(s.gap!).toBeGreaterThanOrEqual(s.target! - 1e-6);
      expect(s.gap!).toBeLessThanOrEqual(s.target! + 1 / fps + 1e-6);
      expect(s.over).toBeUndefined();
      expect(s.overlapFrames).toBeGreaterThan(0);
      expect(s.dissolveFrames).toBe(Math.min(s.overlapFrames, Math.round(SEAM.dissolveSec * fps)));
    }
    // The gap is the measured one: end of the last word + start of the next, on the episode's own timeline
    const adv = sceneAdvanceFrames(scenes, media);
    const endA = Math.max(...media.voice.a!.words.map((w) => w.end));
    const startB = adv[0]! / fps + Math.min(...media.voice.b!.words.map((w) => w.start));
    expect(Math.abs(startB - endA - seams[0]!.gap!)).toBeLessThan(1e-3);
  });

  it("the chosen gap follows «الفاصل» exactly as the pause between two sentences inside a take", () => {
    // planPace on a two-sentence take with the natural 0.45 s pause: the shortened pause is pausedGap
    for (const f of [1, 0.6, 0.35]) {
      const words = [{ word: "أ.", start: 0.06, end: 0.5 }, { word: "ب.", start: 0.95, end: 1.4 }];
      const plan = planPace({ duration: 1.6, words }, [{ words: 1, factor: 1, exempt: false }, { words: 1, factor: 1, exempt: false }], f);
      const t = pacedTimes(plan, words);
      expect(t.words[1]!.start - t.words[0]!.end).toBeCloseTo(pausedGap(0.45, f), 3);
      const m = mediaOf([a, b], (s) => clip(s, 0.06, 0.25, f));
      expect(seamTarget(a, m)).toBeCloseTo(pausedGap(defaultPauseMs(long) / 1000, f), 3);
    }
    // «الأقصر» is much shorter than «عادي», and both are what the seams get
    expect(pausedGap(0.45, 0.35)).toBeLessThan(0.25);
    const shortest = seamPlan(scenes, mediaOf(scenes, (s) => clip(s, 0.06, 0.25, 0.35)));
    for (const s of shortest) expect(s.gap!).toBeLessThanOrEqual(pausedGap(0.45, 0.35) + SEAM.toleranceSec);
  });

  it("a question at the end of a scene keeps its own (longer) pause", () => {
    const q = scene("q", long.replace(/\.$/, "؟"));
    expect(seamTarget(q, mediaOf([q]))).toBeCloseTo(0.5, 3);
  });

  it("the episode is shorter by exactly the overlaps, and chapters and captions follow the same starts", () => {
    const media = mediaOf(scenes);
    const plan = { channel: "balislam", title: "t", chapters: [{ number: 1, title: "أ", scenes: [a, b] }, { number: 2, title: "ب", scenes: [c] }] } as unknown as Plan;
    const seams = seamPlan(scenes, media, { channelId: "balislam" });
    const sum = scenes.reduce((n, s) => n + sceneFrames(s, media), 0);
    expect(episodeFrames({ plan, media })).toBe(sum - seams.reduce((n, s) => n + s.overlapFrames, 0));
    const adv = sceneAdvanceFrames(scenes, media, { channelId: "balislam" });
    expect(chapterStarts(plan, media)[1]!.start).toBeCloseTo((adv[0]! + adv[1]!) / fps, 5);
    const srt = buildSrt(plan, scenes, media);
    const cue = srt.split("\n\n").find((x) => x.includes("وأخيرا"))!;
    const from = cue.split("\n")[1]!.split(" --> ")[0]!;
    const [hh, mm, rest] = from.split(":");
    const sec = Number(hh) * 3600 + Number(mm) * 60 + Number(rest!.replace(",", "."));
    expect(sec).toBeCloseTo((adv[0]! + adv[1]!) / fps + 0.06, 2);
  });
});

describe("kept as they are: verse, lead-in, basmala, stillness, a scene without words", () => {
  it("a verse card and its lead-in keep the deliberate pause on both sides", () => {
    const lead = scene("lead", "قال الله تعالى في كتابه الكريم ما يدل على هذا المعنى:");
    const verse = scene("v", "", { template: "verse-card", ayahKey: "1:1" } as Partial<PlanScene>);
    const after = scene("after", long);
    const before = scene("before", long);
    const list = [before, lead, verse, after];
    const seams = seamPlan(list, mediaOf(list));
    expect(seams.map((s) => s.overlapFrames)).toEqual([0, 0, 0]);
    expect(seams[0]!.kept).toMatch(/تمهيد آية|سكون مقصود/);
    expect(seams[1]!.kept).toMatch(/آية/);
    expect(seams[2]!.kept).toMatch(/آية/);
  });

  it("the basmala (the owner's recording) is never joined", () => {
    const bas = scene("bas", "بسم الله الرحمن الرحيم، " + long);
    const x = scene("x", long);
    const m = mediaOf([bas, x]);
    m.voice.bas = { ...m.voice.bas!, basmala: { pending: false, sha256: "a".repeat(64) } };
    const [s] = seamPlan([bas, x], m);
    expect(s!.overlapFrames).toBe(0);
    expect(s!.kept).toMatch(/البسملة/);
  });

  it("intended stillness (dhikr / verse lead-in shots of دفاتر الزمن) keeps its seams", () => {
    const still = scene("st", long, { template: "horizon-shot", props: { shot: "verse-tag" } } as Partial<PlanScene>);
    const x = scene("x", long, { template: "horizon-shot", props: { shot: "lib-compare" } } as Partial<PlanScene>);
    const [s] = seamPlan([x, still], mediaOf([x, still]));
    expect(s!.overlapFrames).toBe(0);
    expect(s!.kept).toMatch(/سكون مقصود/);
  });

  it("a scene without narration (chapter card, closing) is a visual beat", () => {
    const card = scene("card", "");
    const x = scene("x", long);
    const seams = seamPlan([x, card, x], mediaOf([x]));
    expect(seams.every((s) => s.overlapFrames === 0 && s.kept)).toBe(true);
  });
});

describe("what the scene holds on purpose is never cut, and is reported", () => {
  it("an owner-set duration is respected and flagged when it makes the gap longer than chosen", () => {
    const a = scene("a", long, { durationSec: 12 } as Partial<PlanScene>);
    const b = scene("b", long);
    const m = mediaOf([a, b]);
    expect(sceneHoldFloor(a, m)).toBe(12);
    const [s] = seamPlan([a, b], m);
    expect(sceneFrames(a, m) - s!.overlapFrames).toBeGreaterThanOrEqual(12 * fps - 1);
    expect(s!.over).toMatch(/مدة المشهد التي حددتها/);
  });

  it("دفاتر الزمن: the design tail (page turn, ink fade) runs under the next scene; the citation card (D219: inside the narration) is never cut", () => {
    const a = scene("a", long, { template: "horizon-shot", props: { shot: "lib-compare" } } as Partial<PlanScene>);
    const b = scene("b", long, { template: "horizon-shot", props: { shot: "lib-timeline" } } as Partial<PlanScene>);
    const m = mediaOf([a, b]);
    const [s] = seamPlan([a, b], m);
    expect(s!.stacked!).toBeGreaterThan(1.2);
    expect(s!.gap!).toBeLessThanOrEqual(s!.target! + SEAM.toleranceSec);
    const cited = scene("c", long, { template: "horizon-shot", props: { shot: "lib-compare", verseText: "كلمة ".repeat(30).trim(), verseKey: "2:30", verseFrom: "هذه" } } as Partial<PlanScene>);
    const mc = mediaOf([cited, b]);
    const floor = sceneHoldFloor(cited, mc);
    const [sc] = seamPlan([cited, b], mc);
    expect((sceneFrames(cited, mc) - sc!.overlapFrames) / fps).toBeGreaterThanOrEqual(floor - 1e-6);
    // D219: البطاقة داخل كلام الراوي، فلا يطول المشهد بعد آخر كلمة أكثر من ٠٫٨ ث للقراءة
    expect(floor).toBeLessThanOrEqual(Math.max(...mc.voice.c!.words.map((w) => w.end)) + 0.8 + 0.31);
  });

  it("a scene held by its own text animation keeps it", () => {
    const short = scene("s", "كلمتان فقط.");
    const b = scene("b", long);
    const m = mediaOf([short, b]);
    const [s] = seamPlan([short, b], m);
    expect(s!.overlapFrames).toBe(0);
    expect(s!.over).toBeDefined();
  });
});

describe("no fade to silence and no click on any word", () => {
  it("the equal-power fades touch only the file's last tenth after the last word, and the next head before its first word", () => {
    const list = [scene("a", long), scene("b", long), scene("c", long)];
    const m = mediaOf(list);
    const audio = seamAudio(list, m);
    list.forEach((s, i) => {
      const ws = m.voice[s.id]!.words;
      for (const w of ws) for (let t = w.start; t <= w.end; t += 0.01) expect(seamVolumeAt(t, audio[i]!)).toBeCloseTo(1, 6);
      const a = audio[i]!;
      if (a.fadeOutStart !== undefined) {
        expect(a.fadeOutStart).toBeGreaterThanOrEqual(Math.max(...ws.map((w) => w.end)) + SEAM.releaseSec - 1e-6);
        expect(a.fadeOutStart).toBeGreaterThanOrEqual(m.voice[s.id]!.duration - SEAM.floorFadeSec - 1e-6);
        // equal power: cos² + sin² = 1 across the crossing
        const x = 0.37;
        const out = seamVolumeAt(a.fadeOutStart + x * a.fadeOutSec!, a);
        const inn = Math.sin((Math.PI / 2) * x);
        expect(out * out + inn * inn).toBeCloseTo(1, 6);
      }
      if (a.fadeInSec) expect(a.fadeInSec).toBeLessThanOrEqual(Math.min(...ws.map((w) => w.start)));
    });
    expect(audio[0]!.fadeInSec).toBeUndefined();
    expect(audio[2]!.fadeOutStart).toBeUndefined();
  });
});

describe("one narration bed: the episode's own median loudness", () => {
  it("each scene gets one linear gain to the median, limited to ±6 dB, none when already there", () => {
    expect(narrationTarget([-20, -16, -18])).toBe(-18);
    expect(narrationTarget([-20, -16])).toBe(-18);
    expect(gainFor(-18, -18)).toBe(1);
    expect(gainFor(-20, -18)).toBeCloseTo(10 ** (2 / 20), 4);
    expect(gainFor(-40, -18)).toBeCloseTo(10 ** (NARRATION_GAIN_LIMIT_DB / 20), 4);
    expect(gainFor(-8, -18)).toBeCloseTo(10 ** (-NARRATION_GAIN_LIMIT_DB / 20), 4);
  });
});

describe("prosody across the seam: the next generation is sent with the neighbour sentences of the other scene", () => {
  it("the first sentence of a scene gets the last sentence of the scene before as previous_text (and the reverse)", async () => {
    const { neighbours } = await import("../src/voice/sentenceContext");
    const s1 = scene("s1", "الأولى. الثانية."), s2 = scene("s2", "الثالثة. الرابعة.");
    const sent = (sc: PlanScene, id: string, text: string) => ({ scene: sc, list: [], s: { id, sceneId: sc.id, kind: "narration", text, pauseAfterMs: 450 } });
    const flat = [sent(s1, "a1", "الأولى."), sent(s1, "a2", "الثانية."), sent(s2, "b1", "الثالثة."), sent(s2, "b2", "الرابعة.")] as never[];
    expect(neighbours(flat, "b1")).toEqual({ previousText: "الثانية.", nextText: "الرابعة." });
    expect(neighbours(flat, "a2")).toEqual({ previousText: "الأولى.", nextText: "الثالثة." });
    // a verse between two scenes is a border the context never crosses (KI-011): unchanged
    const cut = [...flat.slice(0, 2), { ...(flat[2] as unknown as object), verseBefore: true }, flat[3]] as never[];
    expect(neighbours(cut, "b1").previousText).toBeUndefined();
  });
});

describe("narration loudness is measured on the takes themselves (EBU R128)", () => {
  it("a quieter scene is lifted to the others, the verse and the basmala are never touched", async () => {
    const { mkdtemp, mkdir, rm } = await import("node:fs/promises");
    const { execFileSync } = await import("node:child_process");
    const os = await import("node:os");
    const path = await import("node:path");
    const { narrationLoudness } = await import("../src/studio/narrationLoudness");
    const dir = await mkdtemp(path.join(os.tmpdir(), "bal-loud-"));
    try {
      await mkdir(path.join(dir, "voice"));
      const tone = (f: string, amp: number) => execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-y", "-f", "lavfi", "-i",
        `aevalsrc='${amp}*sin(2*PI*220*t)':s=44100:d=3`, path.join(dir, "voice", f)]);
      tone("a.wav", 0.2); tone("b.wav", 0.2); tone("c.wav", 0.1); tone("bas.wav", 0.05);
      const ss = ["a", "b", "c"].map((id) => scene(id, long));
      const bas = scene("bas", "بسم الله الرحمن الرحيم، " + long);
      const verse = scene("v", "", { template: "verse-card", ayahKey: "1:1" } as Partial<PlanScene>);
      const plan = { chapters: [{ number: 1, title: "", scenes: [...ss, bas, verse] }] } as unknown as Plan;
      const voice = Object.fromEntries([...ss, bas].map((s) => [s.id, { ...clip(s), file: `${s.id}.wav` }]));
      const r = await narrationLoudness(path.join(dir, "script.md"), plan, { voice });
      expect(Object.keys(r.lufs).sort()).toEqual(["a", "b", "c"]);
      expect(r.gain.a).toBeUndefined();
      expect(r.gain.c).toBeCloseTo(2, 1); // −6 dB quieter → ×2
      expect(r.gain.bas).toBeUndefined();
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});
