/**
 * D239 (owner decision 27 Nov 2026): the basmala may be heard in the owner's cloned voice only as his one approved
 * clip, recognised by its pinned sha256. The TTS guard still refuses the basmala and every verse; the exception is a
 * fixed file, never a generation. (The episode path with an installed clip: basmala-approved-clip.test.ts.)
 */
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { APPROVED_BASMALA_CLIP, BASMALA_TEXT, isApprovedBasmalaSha256 } from "../src/voice/basmala";
import { assertApprovedBasmalaAudio, assertNoQuranForTts, isQuranFreeForTts, QuranTtsError } from "../src/voice/quranGuard";
import { basmalaClipStatus, installBasmalaClip, MISMATCH_CLIP, MISSING_CLIP } from "../src/voice/basmalaClip";
import { panelSource } from "./helpers/panelSource";

let tmp = "";
const saved = process.env.BAL_BASMALA_CLIP;
beforeAll(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), "bal-basmala-clip-"));
  process.env.BAL_BASMALA_CLIP = path.join(tmp, "installed", APPROVED_BASMALA_CLIP.file);
});
afterAll(() => {
  if (saved === undefined) delete process.env.BAL_BASMALA_CLIP; else process.env.BAL_BASMALA_CLIP = saved;
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

describe("the guard: the basmala is never generated, verses have no exception (D239)", () => {
  it("pins the owner-approved clip by its sha256", () => {
    expect(APPROVED_BASMALA_CLIP.sha256).toBe("ea235e2b0f34ac071f2532df89e313eda805eaa7b2bd4cc8e5bf9f472f721289");
    expect(APPROVED_BASMALA_CLIP.decision).toBe("D239");
    expect(Object.isFrozen(APPROVED_BASMALA_CLIP)).toBe(true);
    expect(isApprovedBasmalaSha256(APPROVED_BASMALA_CLIP.sha256.toUpperCase())).toBe(true);
    expect(isApprovedBasmalaSha256("0".repeat(64))).toBe(false);
    expect(isApprovedBasmalaSha256(undefined)).toBe(false);
  });
  it("assertNoQuranForTts still refuses the basmala text in any TTS request, alone or inside a sentence", () => {
    expect(() => assertNoQuranForTts(BASMALA_TEXT)).toThrow(QuranTtsError);
    expect(() => assertNoQuranForTts("بسم الله الرحمن الرحيم")).toThrow(/البسملة/);
    expect(isQuranFreeForTts(`نبدأ: ${BASMALA_TEXT} ثم الحكاية.`)).toBe(false);
  });
  it("and every verse, exactly as before", () => {
    expect(() => assertNoQuranForTts("﴿قل هو الله أحد﴾")).toThrow(QuranTtsError);
    expect(() => assertNoQuranForTts("نص", { template: "verse-card", ayahKey: "112:1" })).toThrow(QuranTtsError);
    const verse = "وَأَن لَّيْسَ لِلْإِنسَانِ إِلَّا مَا سَعَىٰ";
    expect(() => assertNoQuranForTts(`قال: وأن ليس للإنسان إلا ما سعى`, null, { verses: [verse] })).toThrow(QuranTtsError);
  });
  it("only the pinned bytes pass assertApprovedBasmalaAudio", () => {
    expect(() => assertApprovedBasmalaAudio(APPROVED_BASMALA_CLIP.sha256)).not.toThrow();
    expect(() => assertApprovedBasmalaAudio("f".repeat(64))).toThrow(/لا تطابق نسخة البسملة المعتمدة/);
  });
  it("the guard module documents the single exception in one place", () => {
    const guard = panelSource("src/voice/quranGuard.ts");
    expect(guard).toContain("export const assertApprovedBasmalaAudio");
    expect(guard).toMatch(/verses have no exception/);
    // The clip module never reaches the voice service.
    const clip = panelSource("src/voice/basmalaClip.ts");
    expect(clip).not.toMatch(/elevenlabs|ElevenLabsClient|\.tts\(/i);
  });
});

describe("install and status (no git, no voice)", () => {
  it("missing → the scene stays conditional, with the Arabic reason", async () => {
    expect(await basmalaClipStatus()).toEqual({ installed: false, reason: MISSING_CLIP });
  });
  it("install refuses any file whose bytes are not the approved clip, and writes nothing", async () => {
    const other = path.join(tmp, "other.mp3");
    writeFileSync(other, Buffer.from("not the approved basmala"));
    await expect(installBasmalaClip(other)).rejects.toThrow(/لا تطابق نسخة البسملة المعتمدة/);
    expect(existsSync(process.env.BAL_BASMALA_CLIP!)).toBe(false);
  });
  it("a file placed by hand with other bytes is not used (mismatch)", async () => {
    const dest = process.env.BAL_BASMALA_CLIP!;
    await import("node:fs/promises").then((f) => f.mkdir(path.dirname(dest), { recursive: true }));
    writeFileSync(dest, Buffer.from("tampered"));
    expect(await basmalaClipStatus()).toEqual({ installed: false, reason: MISMATCH_CLIP });
  });
  it("audio never goes into git: the install location is git-ignored", () => {
    expect(panelSource(".gitignore")).toContain("assets/recitations/**/*.mp3");
    expect(APPROVED_BASMALA_CLIP.file.endsWith(".mp3")).toBe(true);
  });
});
