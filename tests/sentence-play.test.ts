/**
 * تشغيل الجملة وحدها (D62): ملاحظة المالك «زر تشغيل نص الجملة فقط لا يعمل بشكل صحيح وليس فيه ميزة إيقاف».
 * كان ▶ على جملة بلا تسجيل يشغّل صوت المشهد كله من أوله، ولا يتحول إلى إيقاف، والضغط ثانيةً يعيده من البداية.
 * الآن: الجملة وحدها بحدّيها (من تسجيلها، أو من صوت المشهد بتوقيت الكلمات، أو تقديرًا «تقريبي»)، تتوقف وحدها،
 * والزر نفسه إيقاف مؤقت/استئناف، و■ أو Esc يوقف، وصوت واحد في الصفحة كلها، ويتوقف ما بدأته اللوحة عند إغلاقها.
 * (لا jsdom في المشروع: مستند ووسيط صوت مزيّفان بالقدر الذي يحتاجه المشغّل.)
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSentencePlayer, estimateSpan, sentenceClip, type SentencePlayer } from "../app/src/workspace/sentencePlayer";
import { sceneSpans } from "../src/voice/sentences";

class FakeAudio {
  static all: FakeAudio[] = [];
  src: string;
  currentTime = 0;
  duration = 20;
  readyState = 0;
  paused = true;
  plays = 0;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private ls: Record<string, ((e: unknown) => void)[]> = {};
  constructor(url: string) { this.src = url; FakeAudio.all.push(this); }
  play() { this.paused = false; this.plays++; return Promise.resolve(); }
  pause() { this.paused = true; }
  addEventListener(t: string, f: (e: unknown) => void) { (this.ls[t] ??= []).push(f); }
  removeEventListener(t: string, f: (e: unknown) => void) { this.ls[t] = (this.ls[t] ?? []).filter((x) => x !== f); }
  emit(t: string) { for (const f of [...(this.ls[t] ?? [])]) f({ target: this }); }
  /** the browser loaded the metadata */
  load() { this.readyState = 1; this.emit("loadedmetadata"); }
  /** the playhead moved */
  at(t: number) { this.currentTime = t; this.emit("timeupdate"); }
  end() { this.paused = true; this.onended?.(); }
}

/** a document with other media (the scene preview <video>) and a capture «play» listener */
const fakeDoc = () => {
  const video = { paused: false, pause() { this.paused = true; } };
  const ls: ((e: { target: unknown }) => void)[] = [];
  return {
    video,
    doc: {
      querySelectorAll: () => [video],
      addEventListener: (_t: string, f: (e: { target: unknown }) => void) => { ls.push(f); },
      removeEventListener: () => {},
    } as unknown as Document,
    /** another media element starts on the page */
    playOther: () => ls.forEach((f) => f({ target: video })),
  };
};

const flush = () => new Promise((r) => setTimeout(r, 0));
let player: SentencePlayer;
let env: ReturnType<typeof fakeDoc>;
beforeEach(() => {
  FakeAudio.all = [];
  env = fakeDoc();
  player = createSentencePlayer({ createAudio: (u) => new FakeAudio(u) as never, doc: env.doc, raf: () => 0, caf: () => {} });
});
afterEach(() => { player.dispose(); vi.useRealTimers(); });

describe("one sentence from the scene's single file", () => {
  it("seeks to the sentence start once the metadata loads, and stops by itself at its end", async () => {
    player.play("row:s2", [{ id: "s2", url: "/voice/scene.mp3", start: 3.2, end: 6.5 }], "panel");
    const a = FakeAudio.all[0]!;
    expect(a.plays).toBe(0); // waits for the metadata before seeking
    a.load();
    await flush();
    expect(a.currentTime).toBe(3.2);
    expect(a.plays).toBe(1);
    expect(player.state()).toMatchObject({ key: "row:s2", id: "s2", paused: false });
    a.at(4.85);
    expect(player.state()!.progress).toBeCloseTo(0.5, 2);
    a.at(6.5); // the sentence end: the rest of the scene is not played
    expect(player.state()).toBeNull();
    expect(a.paused).toBe(true);
  });

  it("the button toggles pause and resume without restarting the sentence", async () => {
    player.play("row:s2", [{ id: "s2", url: "/voice/scene.mp3", start: 3, end: 6 }], "panel");
    const a = FakeAudio.all[0]!;
    a.load(); await flush();
    a.at(4);
    player.toggle();
    expect(player.state()!.paused).toBe(true);
    expect(a.paused).toBe(true);
    player.toggle();
    await flush();
    expect(player.state()!.paused).toBe(false);
    expect(a.currentTime).toBe(4); // resumed where it was, not from the start
    expect(FakeAudio.all).toHaveLength(1);
    player.stop();
    expect(player.state()).toBeNull();
    expect(a.paused).toBe(true);
  });

  it("marks estimated spans («تقريبي»)", async () => {
    player.play("row:s1", [{ id: "s1", url: "/v.mp3", start: 0, end: 2, estimated: true }], "panel");
    expect(player.state()!.estimated).toBe(true);
  });
});

describe("one audio for the whole page", () => {
  it("starting another sentence stops the current one; starting stops the scene preview video", async () => {
    player.play("row:a", [{ id: "a", url: "/a.wav" }], "p1");
    await flush();
    expect(env.video.paused).toBe(true); // the scene preview was paused
    const a = FakeAudio.all[0]!;
    player.play("row:b", [{ id: "b", url: "/b.wav" }], "p2");
    expect(a.paused).toBe(true);
    expect(player.state()!.key).toBe("row:b");
  });

  it("any other media starting on the page (the scene preview) stops the sentence", async () => {
    player.play("row:a", [{ id: "a", url: "/a.wav" }], "p1");
    await flush();
    env.playOther();
    expect(player.state()).toBeNull();
    expect(FakeAudio.all[0]!.paused).toBe(true);
  });

  it("the scene queue pauses inside the gap between sentences and resumes with the next one", async () => {
    vi.useFakeTimers();
    player.play("scene:x", [{ id: "a", url: "/a.wav", pauseAfterMs: 400 }, { id: "b", url: "/b.wav" }], "p");
    await vi.advanceTimersByTimeAsync(0);
    FakeAudio.all[0]!.end();
    expect(player.state()).toMatchObject({ id: "a", index: 0 });
    player.pause();
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeAudio.all).toHaveLength(1); // the pause holds the gap
    player.resume();
    expect(FakeAudio.all).toHaveLength(2);
    expect(player.state()).toMatchObject({ id: "b", index: 1, paused: false });
    FakeAudio.all[1]!.end();
    expect(player.state()).toBeNull();
  });

  it("closing a panel (scene change, unmount) stops only what that panel started", async () => {
    player.play("row:a", [{ id: "a", url: "/a.wav" }], "p1");
    player.stopOwner("p2");
    expect(player.state()).not.toBeNull();
    player.stopOwner("p1");
    expect(player.state()).toBeNull();
    expect(FakeAudio.all[0]!.paused).toBe(true);
  });

  it("the word preview plays its context and stops by itself", async () => {
    player.play("word:a:2", [{ id: "a", url: "/a.wav", start: 1.1, end: 2.0 }], "p");
    const a = FakeAudio.all[0]!;
    a.load(); await flush();
    expect(a.currentTime).toBe(1.1);
    a.at(2.0);
    expect(player.state()).toBeNull();
  });

  it("a refused play() (autoplay policy) reports to the panel that started it", async () => {
    const errs: string[] = [];
    player.setErrorHandler("p", (m) => errs.push(m));
    const p2 = createSentencePlayer({ createAudio: (u) => Object.assign(new FakeAudio(u), { play: () => Promise.reject(new Error("x")) }) as never, doc: null, raf: () => 0, caf: () => {} });
    p2.setErrorHandler("p", (m) => errs.push(m));
    p2.play("row:a", [{ id: "a", url: "/a.wav" }], "p");
    await flush();
    expect(errs[0]).toMatch(/الضغط على تشغيل/);
    expect(p2.state()).toBeNull();
    p2.dispose();
  });
});

describe("the sentence's span", () => {
  const url = (f: string, k: string) => `/${k}/${f}`;
  const scene = { audio: { state: "scene", file: "c1-s1.mp3", duration: 10 }, rows: [{ id: "a", text: "أَ بَ" }, { id: "b", text: "جَ دَ هَ وَ" }] };

  it("its own take wins; otherwise the scene file between the server's word-timed bounds", () => {
    expect(sentenceClip({ id: "a", text: "x", audio: { file: "a.wav" } }, scene, url)).toEqual({ id: "a", url: "/sentences/a.wav" });
    expect(sentenceClip({ id: "b", text: "x", audio: null, sceneSpan: { start: 4, end: 10, timing: "words" } }, scene, url))
      .toEqual({ id: "b", url: "/voice/c1-s1.mp3", start: 4, end: 10, estimated: false });
  });

  it("falls back to a character estimate flagged «تقريبي», and has nothing without a current scene file", () => {
    const c = sentenceClip({ id: "b", text: "جَ دَ هَ وَ", audio: null }, scene, url)!;
    expect(c.estimated).toBe(true);
    expect(c.start).toBeCloseTo((5 / 16) * 10, 5);
    expect(c.end).toBe(10);
    expect(sentenceClip({ id: "b", text: "x", audio: null }, { ...scene, audio: { state: "stale", file: "c.mp3", duration: 10 } }, url)).toBeNull();
    expect(estimateSpan(["a"], 0, 0)).toBeNull();
  });

  it("server: bounds from the scene's word timings (mid-pause), or estimated when they don't match the text", () => {
    const ws = [
      { word: "أ", start: 0.2, end: 0.6 }, { word: "ب", start: 0.7, end: 1.2 },
      { word: "ج", start: 1.8, end: 2.1 }, { word: "د", start: 2.2, end: 2.9 },
    ];
    const s = sceneSpans({ words: ws, duration: 3.4 }, ["أ ب.", "ج د."]);
    expect(s).toEqual([{ start: 0, end: 1.5, timing: "words" }, { start: 1.5, end: 3.4, timing: "words" }]);
    const est = sceneSpans({ words: ws.slice(0, 3), duration: 4 }, ["أب", "جد"]);
    expect(est.map((x) => x.timing)).toEqual(["estimated", "estimated"]);
    expect(est[0]).toMatchObject({ start: 0, end: 2 });
  });
});

describe("the panel wiring", () => {
  const tsx = readFileSync(path.join(__dirname, "..", "app/src/workspace/SentencesPanel.tsx"), "utf8");
  it("never plays the whole scene for one sentence, and cleans up on scene change and unmount", () => {
    expect(tsx).not.toMatch(/playQueue\(`scene:\$\{s\.id\}`, sceneQueue\(s\)\)\}>/);
    expect(tsx).toMatch(/return \(\) => pagePlayer\(\)\.stopOwner\(owner\);/);
    expect(tsx).toMatch(/p\.stopOwner\(owner\); \};/);
    expect(tsx).toMatch(/e\.key !== " " \|\| e\.target !== e\.currentTarget/);
    expect(tsx).toMatch(/e\.key === "Escape"/);
  });
});
