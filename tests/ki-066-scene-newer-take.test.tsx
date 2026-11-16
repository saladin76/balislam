/**
 * KI-066 (owner, 14 Nov, دفاتر الزمن 001 المشهد ٣): «أعدت توليد الجملة… ثم ضغطت «أنتج هذا المشهد» ولكن لم يطبق الصوت
 * على الفيديو». The scene's sound is composed from its sentences only once every one has a current take; the new take
 * stayed outside it, and «أنتج هذا المشهد» rendered the old sound. The whole path over the real server, in the three
 * channels, is tests/e2e/scene-reproduce-audio.test.ts; here the pieces it relies on.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { heldBy, newerTakeBlockedMessage } from "../src/voice/sceneTakes";
import { compositionHash } from "../src/voice/sentenceStitch";
import { NEWER_TAKE_PRODUCE, newerTakeLine } from "../app/src/workspace/sceneProduction/newerTake";
import { SceneDecisionActions } from "../app/src/workspace/SceneProductionPanel";
import { api } from "../app/src/api";
import type { VoiceClip } from "../src/voice/generate";
import type { Sentence } from "../src/voice/sentences";

const take = (file: string, origin: "tts" | "scene" = "tts") => ({ file, fingerprint: `fp-${file}`, context: "", duration: 1, words: [], at: "", origin, timing: "aligned" as const });
const s = (id: string, audio?: ReturnType<typeof take>): Sentence => ({ id, kind: "narration", text: id, pauseAfterMs: 450, ...(audio ? { audio } : {}) } as unknown as Sentence);
const clip = (o: Partial<VoiceClip>): VoiceClip => ({ file: "scene.mp3", hash: "h", text: "x", duration: 2, words: [], ...o } as VoiceClip);

describe("which sentence takes the scene's sound holds", () => {
  it("a sound as one file holds only its own cuts: a regenerated sentence is outside it", () => {
    const held = heldBy(clip({}), [s("a", take("a1")), s("b")]);
    expect(held(s("a", take("a1")))).toBe(false);
    expect(held(s("a", take("cut", "scene")))).toBe(true);
  });
  it("a composed sound holds the takes it lists; a newer take of the same sentence is outside", () => {
    const c = clip({ sentences: { hash: "x", ids: ["a", "b"], takes: { a: "a1", b: "b1" } } });
    const held = heldBy(c, []);
    expect(held(s("a", take("a1")))).toBe(true);
    expect(held(s("a", take("a2")))).toBe(false);
  });
  it("a sound composed before the take list (14 Nov) is matched by its composition hash", () => {
    const list = [s("a", take("a1")), s("b", take("b1"))];
    const hash = compositionHash(list.map((x) => [x.id, x.audio!.file, x.audio!.fingerprint, x.pauseAfterMs]), 0);
    expect(heldBy(clip({ sentences: { hash, ids: ["a", "b"] } }), list)(list[0]!)).toBe(true);
    const newer = [s("a", take("a2")), list[1]!];
    expect(heldBy(clip({ sentences: { hash, ids: ["a", "b"] } }), newer)(newer[0]!)).toBe(false);
  });
});

describe("what the owner reads", () => {
  it("beside the player: the line asked for, or why «أنتج هذا المشهد» cannot carry it yet", () => {
    expect(newerTakeLine({ state: "produce", sentences: [1], missing: [] })).toBe("فيه تسجيل جديد لم يدخل الفيديو — اضغط «أنتج هذا المشهد»");
    expect(NEWER_TAKE_PRODUCE).toContain("أنتج هذا المشهد");
    const blocked = newerTakeLine({ state: "blocked", sentences: [1], missing: [2, 3] });
    expect(blocked).toContain("فيه تسجيل جديد لم يدخل الفيديو");
    expect(blocked).toContain("الجمل ٢، ٣ بلا تسجيل حالي");
  });
  it("the refusal of «أنتج هذا المشهد» names the sentences and says the video did not change", () => {
    const m = newerTakeBlockedMessage({ outside: [1], missing: [2] });
    expect(m).toContain("الجملة ١");
    expect(m).toContain("الجملة ٢ بلا تسجيل حالي");
    expect(m).toContain("لم يتغيّر الفيديو");
  });
  it("«أنتج هذا المشهد» is offered beside a ready draft when a newer take waits for it, and only then", () => {
    const noop = () => {};
    const base = { stage: "review" as const, voice: "ok" as const, voiceBusy: false, canVoice: true, readyForAv: true, pending: false, problem: null,
      problemText: "", tone: "", confirming: false, reviewed: false, onVoice: noop, onProblem: noop, onProblemText: noop, onTone: noop,
      onCancelProblem: noop, onSubmitProblem: noop, onConfirm: noop, onApprove: noop, onRender: noop };
    expect(renderToStaticMarkup(<SceneDecisionActions {...base} />)).not.toContain("أنتج هذا المشهد");
    expect(renderToStaticMarkup(<SceneDecisionActions {...base} newerTake="blocked" />)).not.toContain("أنتج هذا المشهد");
    expect(renderToStaticMarkup(<SceneDecisionActions {...base} newerTake="produce" />)).toContain("أنتج هذا المشهد");
  });
  it("the player's URL changes with the cut, so a new cut is never the old one from a cache", () => {
    const a = api.scenePreviewUrl("001", "c1-s3", "a".repeat(64));
    const b = api.scenePreviewUrl("001", "c1-s3", "b".repeat(64));
    expect(a).not.toBe(b);
    expect(a).toContain("/api/episodes/001/previews/scene-c1-s3-av.mp4?v=");
  });
});
