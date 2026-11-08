/**
 * Owner decision (8 Nov): Quran recitations come LAST. Pure checks of the conditional verse approval in the
 * scene-first state machine, of the edge-silence trimmer that must never eat a letter, and of the draft
 * marks that can never reach a Master.
 */
import { describe, expect, it } from "vitest";
import {
  approveSceneAv, approveScript, approveStoryboard, approvedSceneInputsSha256, createSceneFirstProduction,
  nextSceneId, recitationPendingScenes, reviseSceneInput, sceneFirstProgress, submitAssembly, submitSceneAvPreview,
  type SceneFirstProduction,
} from "../src/studio/sceneProduction";
import { edgeSilence } from "../src/quran/recitationPolish";
import { renderEpisode } from "../src/render/episode";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PendingRecitationTag } from "../src/remotion/scenes/Episode";

const h = (c: string) => c.repeat(64);
const at = "2026-11-08T10:00:00.000Z";

const base = (): SceneFirstProduction => {
  let p = createSceneFirstProduction({ channel: "balislam", episode: "985-x", scriptSha256: h("a"), storyboardSha256: h("b"),
    scenes: [{ id: "c1-s1", sourceSha256: h("1") }, { id: "c1-s2", sourceSha256: h("2") }, { id: "c1-s3", sourceSha256: h("3") }] });
  p = approveScript(p, "owner", at, h("a"));
  return approveStoryboard(p, "owner", at, h("b"));
};
const approve = (p: SceneFirstProduction, id: string, src: string, preview: string, recitationPending?: boolean) =>
  approveSceneAv(submitSceneAvPreview(p, id, src, preview), id, { by: "owner", at, previewSha256: preview, watchedWithAudio: true, recitationPending });

describe("«اعتماد مشروط بالتلاوة» in the scene state machine", () => {
  it("keeps the order moving but blocks assembly and Master until the recitation is attached and re-approved", () => {
    let p = approve(base(), "c1-s1", h("1"), h("d"));
    p = approve(p, "c1-s2", h("2"), h("e"), true);
    expect(p.scenes[1]!.approval?.recitationPending).toBe(true);
    // The next scene can be worked on and approved (order is satisfied by the conditional approval).
    expect(nextSceneId(p)).toBe("c1-s3");
    p = approve(p, "c1-s3", h("3"), h("f"));
    expect(nextSceneId(p)).toBeNull();
    expect(recitationPendingScenes(p)).toEqual(["c1-s2"]);
    expect(sceneFirstProgress(p)).toMatchObject({ approvedScenes: 3, canAssemble: false, recitationPending: ["c1-s2"] });
    // No assembly, therefore no Master and no publish permission.
    expect(() => approvedSceneInputsSha256(p)).toThrow(/recitation/);
    expect(() => submitAssembly(p, h("9"))).toThrow(/recitation/);

    // Attaching the recitation changes ONLY that scene's inputs: it re-opens alone.
    p = reviseSceneInput(p, "c1-s2", h("7"));
    expect(p.scenes.map((s) => s.status)).toEqual(["approved", "needs_revision", "approved"]);
    expect(nextSceneId(p)).toBe("c1-s2");
    expect(recitationPendingScenes(p)).toEqual([]);
    expect(sceneFirstProgress(p).canAssemble).toBe(false);
    // A fresh, unconditional approval of the scene with its recitation unlocks the assembly.
    p = approve(p, "c1-s2", h("7"), h("8"));
    expect(p.scenes[1]!.approval?.recitationPending).toBeUndefined();
    expect(sceneFirstProgress(p)).toMatchObject({ canAssemble: true, recitationPending: [] });
    expect(submitAssembly(p, h("9")).assembly?.videoSha256).toBe(h("9"));
  });

  it("never stores a conditional flag unless the trusted server set it", () => {
    const p = approve(base(), "c1-s1", h("1"), h("d"), false);
    expect(p.scenes[0]!.approval).not.toHaveProperty("recitationPending");
  });
});

describe("recitation edge-silence trimming", () => {
  const rate = 16000;
  const build = (parts: { sec: number; amp: number; hz?: number }[]) => {
    const total = parts.reduce((n, p) => n + Math.round(p.sec * rate), 0);
    const out = new Float32Array(total);
    let i = 0, seed = 7;
    const noise = () => { seed = (seed * 16807) % 2147483647; return (seed / 2147483647) * 2 - 1; };
    for (const p of parts) for (let k = 0; k < Math.round(p.sec * rate); k++, i++)
      out[i] = 0.0003 * noise() + p.amp * Math.sin(2 * Math.PI * (p.hz ?? 220) * (i / rate));
    return out;
  };

  it("cuts only the silent edges and keeps a soft first letter and a fading tail", () => {
    // 0.8 s room tone, a whispered onset (-46 dBFS), 1.5 s of recitation, a fading madd, 1.2 s room tone.
    const s = build([{ sec: 0.8, amp: 0 }, { sec: 0.12, amp: 0.005, hz: 3000 }, { sec: 1.5, amp: 0.2 },
      { sec: 0.3, amp: 0.006 }, { sec: 1.2, amp: 0 }]);
    const t = edgeSilence(s, rate);
    expect(t.start).toBeGreaterThan(0.5);
    expect(t.start).toBeLessThanOrEqual(0.8); // before the whispered onset, with its margin
    expect(t.end).toBeGreaterThanOrEqual(0.8 + 0.12 + 1.5 + 0.3); // the fading tail is kept
    expect(t.end).toBeLessThan(t.duration);
  });

  it("trims nothing when the recording has no silent edge", () => {
    const s = build([{ sec: 2, amp: 0.2 }]);
    expect(edgeSilence(s, rate)).toMatchObject({ trimmedHead: 0, trimmedTail: 0 });
  });
});

describe("draft marks never reach a Master", () => {
  it("burns a small studio-only tag on the silent verse draft", () => {
    const html = renderToStaticMarkup(<PendingRecitationTag />);
    expect(html).toContain("التلاوة تُضاف لاحقًا");
    expect(html).toContain('data-draft-mark="pending-recitation"');
  });

  it("refuses a pending-recitation mark on a Master or a non-scene render before any work", async () => {
    await expect(renderEpisode({ episode: "985", orientation: "landscape", quality: "master",
      draftMarks: { pendingRecitation: ["c1-s2"] } })).rejects.toThrow(/never to a Master/);
    await expect(renderEpisode({ episode: "985", orientation: "landscape", quality: "preview",
      draftMarks: { pendingRecitation: ["c1-s2"] } })).rejects.toThrow(/never to a Master/);
  });
});
