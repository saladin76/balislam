/**
 * D239 (owner decision 27 Nov 2026) on a real episode layout: a basmala scene is satisfied by the owner's one approved
 * clip when it is installed and its bytes match; missing or different bytes keep it «مشروط» exactly as before; and an
 * episode with its own approved recording (the shape of «دفاتر الزمن» 001, published and frozen, D231) keeps it, with
 * the same scene fingerprints whether the clip is installed or not.
 *
 * The real pinned sha256 cannot be forged here, so the pin is swapped for a test clip's hash (vi.mock); the guard's own
 * test (basmala-approved-clip-guard.test.ts) checks the real pin. No voice request is made anywhere in this file.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { encodeWav } from "../src/remotion/dafatir/audio/compose";
import type { Plan } from "../src/plan/types";
import { BASMALA_TEXT } from "../src/voice/basmala";

vi.mock("../src/voice/basmala", async (orig) => {
  const real = await orig<typeof import("../src/voice/basmala")>();
  const clip = { ...real.APPROVED_BASMALA_CLIP, get sha256() { return process.env.TEST_BASMALA_SHA ?? ""; } };
  return { ...real, APPROVED_BASMALA_CLIP: clip, isApprovedBasmalaSha256: (s: unknown) => typeof s === "string" && s === process.env.TEST_BASMALA_SHA };
});

const SR = 44100;
const ONLY = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ.";
const ENV = ["BAL_CHANNELS_DIR", "BAL_CHANNEL", "BAL_BASMALA_CLIP", "TEST_BASMALA_SHA", "ELEVENLABS_API_KEY", "BAL_WORKFLOW_HMAC_KEY"] as const;
const saved: Record<string, string | undefined> = {};
let tmp = "";
const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
/** A short mp3 tone (ffmpeg), so the recitation checks read it as they read the owner's real files. */
const tone = (sec: number, hz: number) => {
  const s = new Float32Array(Math.round(sec * SR));
  for (let k = Math.round(0.1 * SR); k < s.length - Math.round(0.1 * SR); k++) s[k] = Math.sin(2 * Math.PI * hz * k / SR) * 0.3;
  const dir = mkdtempSync(path.join(os.tmpdir(), "bal-basmala-tone-"));
  try {
    writeFileSync(path.join(dir, "a.wav"), Buffer.from(encodeWav(s, SR)));
    execFileSync("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", path.join(dir, "a.wav"), "-c:a", "libmp3lame", "-b:a", "192k", path.join(dir, "a.mp3")]);
    return readFileSync(path.join(dir, "a.mp3"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
};
const CLIP = tone(2.68, 180);
const OWN = tone(2.42, 150);
const EP = (n: string) => path.join(tmp, "dafatir-alzaman", "episodes", n);
const plan = (n: string): Plan => ({
  episode: n, title: "بسملة", tone: "calm",
  chapters: [{ number: 1, title: "البداية", scenes: [
    { id: "c1-s0", template: "alley-tale", line: 6, narration: "", sfx: [], props: {} },
    { id: "c1-s1", template: "alley-tale", line: 8, narration: ONLY, sfx: [], props: {} },
  ] }],
} as unknown as Plan);
const episode = (n: string) => {
  mkdirSync(path.join(EP(n), "voice"), { recursive: true });
  writeFileSync(path.join(EP(n), "script.md"), `---\ntitle: "بسملة"\nepisode: "${n.slice(0, 3)}"\n---\n## الفصل 1 · البداية\n${ONLY}\n`);
  writeFileSync(path.join(EP(n), "plan.json"), JSON.stringify(plan(n.slice(0, 3)), null, 2) + "\n");
  writeFileSync(path.join(EP(n), "tashkeel.md"), `${ONLY}\n`);
};
/** The episode's own approved basmala, shaped like «دفاتر الزمن» 001's recitations/index.json (14 Nov). */
const ownRecording = (n: string) => {
  const dir = path.join(EP(n), "recitations");
  mkdirSync(dir, { recursive: true });
  const file = "manual-basmala-0e9607b40185.mp3";
  writeFileSync(path.join(dir, file), OWN);
  writeFileSync(path.join(dir, "index.json"), JSON.stringify({ basmala: {
    provider: "manual", reciter: "صاحب القناة", rightsEvidence: "تسجيلي الخاص بصوتي", parts: [{ file, duration: 2.42 }],
    fetchedAt: "2026-11-14T18:01:36.585Z", approvedAt: "2026-11-14T18:02:15.824Z", approvedBy: "owner",
    reviewNote: "تم الاستماع والاعتماد", sha256: sha(OWN), textSha256: sha(Buffer.from(BASMALA_TEXT, "utf8")),
  } }, null, 2));
};
const install = () => { mkdirSync(path.dirname(process.env.BAL_BASMALA_CLIP!), { recursive: true }); writeFileSync(process.env.BAL_BASMALA_CLIP!, CLIP); };
const uninstall = () => { try { unlinkSync(process.env.BAL_BASMALA_CLIP!); } catch { /* none */ } };
const voiceIndex = (n: string) => JSON.parse(readFileSync(path.join(EP(n), "voice", "index.json"), "utf8"));
const inputs = async (n: string) => (await import("../src/studio/sceneInputs")).sourceNow(n);
const fingerprint = async (n: string) => (await inputs(n)).initial.scenes.find((s: { id: string }) => s.id === "c1-s1");

beforeAll(() => {
  for (const k of ENV) saved[k] = process.env[k];
  tmp = mkdtempSync(path.join(os.tmpdir(), "bal-basmala-d239-"));
  cpSync(path.join("channels", "dafatir-alzaman"), path.join(tmp, "dafatir-alzaman"), { recursive: true, filter: (s) => !/[\\/]episodes([\\/]|$)/.test(s) });
  process.env.BAL_CHANNELS_DIR = tmp;
  process.env.BAL_CHANNEL = "dafatir-alzaman";
  process.env.BAL_BASMALA_CLIP = path.join(tmp, "assets", "recitations", "basmala", "approved-basmala-v4.mp3");
  process.env.TEST_BASMALA_SHA = sha(CLIP);
  process.env.BAL_WORKFLOW_HMAC_KEY = "LOCAL_TEST_ONLY__basmala_d239_signing_key";
  delete process.env.ELEVENLABS_API_KEY;
  episode("101-clip");
  episode("102-own");
  ownRecording("102-own");
});
afterAll(() => {
  for (const k of ENV) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

describe("(b) clip missing or with other bytes → conditional, as before", () => {
  it("missing: the basmala scene is composed with the marked placeholder and waits («مشروط بالتلاوة»)", async () => {
    uninstall();
    const { recomposeBasmalaScenes } = await import("../src/voice/sentenceVoice");
    expect(await recomposeBasmalaScenes("101")).toContain("c1-s1");
    expect(voiceIndex("101-clip")["c1-s1"].basmala).toEqual({ pending: true, sha256: null });
    const now = await inputs("101");
    expect(now.recitationPending["c1-s1"]).toBe(true);
    expect(now.ready["c1-s1"]).toBe(false);
    const { applyBasmalaClip } = await import("../src/voice/basmalaClip");
    await expect(applyBasmalaClip("101")).rejects.toThrow(/غير مثبّتة/);
  });
  it("other bytes at the install location are not used", async () => {
    mkdirSync(path.dirname(process.env.BAL_BASMALA_CLIP!), { recursive: true });
    writeFileSync(process.env.BAL_BASMALA_CLIP!, tone(2.68, 300));
    const { basmalaClipStatus, applyBasmalaClip } = await import("../src/voice/basmalaClip");
    expect((await basmalaClipStatus()).installed).toBe(false);
    await expect(applyBasmalaClip("101")).rejects.toThrow(/لا تطابق بصمته/);
    expect((await inputs("101")).recitationPending["c1-s1"]).toBe(true);
    uninstall();
  });
});

describe("(a) the installed approved clip satisfies the basmala", () => {
  it("install verifies the hash, apply composes the scene with it, and the scene is no longer conditional", async () => {
    const src = path.join(tmp, "02_صوتي-المستنسخ_البسملة_أفضل-v4.mp3");
    writeFileSync(src, CLIP);
    const { installBasmalaClip, applyBasmalaClip } = await import("../src/voice/basmalaClip");
    expect((await installBasmalaClip(src)).sha256).toBe(sha(CLIP));
    const before = await fingerprint("101");
    const r = await applyBasmalaClip("101");
    expect(r).toEqual({ episode: "101", status: "recomposed", scenes: ["c1-s1"] });
    expect(voiceIndex("101-clip")["c1-s1"].basmala).toEqual({ pending: false, sha256: sha(CLIP) });
    const now = await inputs("101");
    expect(now.recitationPending["c1-s1"]).toBe(false);
    expect(now.ready["c1-s1"]).toBe(true);
    // The scene's inputs changed (it re-opens alone); the empty scene is untouched.
    expect((await fingerprint("101"))!.sourceSha256).not.toBe(before!.sourceSha256);
    expect(await applyBasmalaClip("101")).toEqual({ episode: "101", status: "up-to-date" });
  });
  it("removing the clip later puts the scene back to conditional (bytes are checked every time)", async () => {
    uninstall();
    expect((await inputs("101")).recitationPending["c1-s1"]).toBe(true);
    install();
    expect((await inputs("101")).recitationPending["c1-s1"]).toBe(false);
  });
});

describe("(d) an episode's own approved recording takes precedence and does not change", () => {
  it("is composed with its own recording, and apply leaves it alone", async () => {
    uninstall();
    const { recomposeBasmalaScenes } = await import("../src/voice/sentenceVoice");
    await recomposeBasmalaScenes("102");
    const own = voiceIndex("102-own")["c1-s1"];
    expect(own.basmala).toEqual({ pending: false, sha256: sha(OWN) });
    const without = await inputs("102");
    expect(without.recitationPending["c1-s1"]).toBe(false);

    install();
    const { applyBasmalaClip } = await import("../src/voice/basmalaClip");
    expect(await applyBasmalaClip("102")).toEqual({ episode: "102", status: "own-recording" });
    // Even a recomposition (the studio's own approve flow) keeps the episode's recording, byte for byte.
    await recomposeBasmalaScenes("102");
    expect(voiceIndex("102-own")["c1-s1"]).toEqual(own);
    const withClip = await inputs("102");
    // Every scene fingerprint (what the signed ledger, assembly, Master and permission rest on) is unchanged.
    expect(withClip.initial.scenes).toEqual(without.initial.scenes);
    expect(withClip.recitationPending).toEqual(without.recitationPending);
    expect(withClip.ready).toEqual(without.ready);
  });
});
