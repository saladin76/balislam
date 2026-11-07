import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { EpisodeMedia } from "../src/plan/media";
import type { FoundationRecitation } from "../src/quran/provider";
import { decodedAudioDuration } from "../src/voice/audioIntegrity";
import {
  approvedRecitationsForRender, assertReciterPublicationRights,
  assertRenderedRecitationsMatchApprovals,
} from "../src/quran/renderContract";

const verse = "وَأَنْ لَيْسَ لِلْإِنْسَانِ إِلَّا مَا سَعَىٰ";
const script = (text = verse, reference = "النجم 39") =>
  "---\ntitle: اختبار تكامل القرآن\n" +
  "domain: psychology\nepisode: \"999\"\n---\n" +
  "## الفصل 1 · التحقق\n[آية: " + reference + " | " + text + "]\n" +
  "## الاستشهادات\n- آية | " + reference + " | المصحف المعتمد\n";
const sha = (b: Uint8Array | string) => createHash("sha256").update(b).digest("hex");
const owned: string[] = [];
afterEach(async () => {
  for (const folder of owned.splice(0)) await rm(folder, { recursive: true, force: true });
});

const fixture = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "quran-render-contract-"));
  owned.push(root);
  const episode = path.join(root, "balislam", "episodes", "000-demo");
  const scriptPath = path.join(episode, "script.md");
  const rec = path.join(episode, "recitations");
  const originals = path.join(rec, "originals");
  const renderRoot = path.join(root, "private-render");
  const base = "_render/balislam/000-demo/" + "1".repeat(24) + "/";
  const renderDir = path.join(renderRoot, base, "recitations");
  await mkdir(originals, { recursive: true });
  await mkdir(renderDir, { recursive: true });
  await writeFile(scriptPath, script());
  const mp3 = path.join(rec, "test.mp3");
  execFileSync("ffmpeg", ["-nostdin", "-loglevel", "error", "-f", "lavfi",
    "-i", "sine=frequency=411:duration=1.2", "-c:a", "libmp3lame", mp3]);
  const bytes = await readFile(mp3);
  const duration = await decodedAudioDuration(mp3, { mp3Only: true });
  expect(duration).toBeGreaterThan(1);
  const indexFile = path.join(rec, "index.json");
  return { root, episode, scriptPath, rec, originals, indexFile, bytes,
    duration: duration!, renderRoot, base, renderDir };
};

const manual = async (x: Awaited<ReturnType<typeof fixture>>) => {
  const file = "manual-53-39-abcdef123456.mp3";
  const originalFile = "originals/00000000-0000-4000-8000-000000000001.mp3";
  await writeFile(path.join(x.rec, file), x.bytes);
  await writeFile(path.join(x.rec, originalFile), x.bytes);
  await copyFile(path.join(x.rec, file), path.join(x.renderDir, file));
  const record = {
    provider: "manual", reciter: "قارئ التجربة البشرية",
    rightsEvidence: "https://rights.example.test/licensed-reader",
    fetchedAt: new Date().toISOString(), approvedAt: new Date().toISOString(),
    approvedBy: "مراجع مستقل", reviewNote: "استمعت إلى التسجيل كاملًا وراجعت حقوقه",
    sha256: sha(x.bytes), textSha256: sha(Buffer.from(verse)),
    originalFile, originalName: "licensed-original.mp3", originalSha256: sha(x.bytes),
    parts: [{ file, duration: x.duration }],
  };
  await writeFile(x.indexFile, JSON.stringify({ "53:39": record }));
  const media: Pick<EpisodeMedia, "mode" | "base" | "recitations"> = {
    mode: "static", base: x.base,
    recitations: { "53:39": { file, duration: x.duration, reciter: record.reciter,
      source: "manual", parts: [{ file, duration: x.duration, sha256: sha(x.bytes) }] } },
  };
  return { record, media };
};

const provider = async (x: Awaited<ReturnType<typeof fixture>>) => {
  const file = "qf-7-53-39-" + sha(x.bytes).slice(0, 24) + ".mp3";
  await writeFile(path.join(x.rec, file), x.bytes);
  await copyFile(path.join(x.rec, file), path.join(x.renderDir, file));
  const choice: FoundationRecitation = {
    id: 7, name: "قارئ المصحف التجريبي",
    licence: { holder: "مالك التسجيل", evidence: "https://rights.example.test/permission",
      scope: "YouTube commercial publish", verifiedAt: new Date().toISOString(),
      verifiedBy: "مراجع حقوق", reviewNote: "راجعت دليل الاستخدام والإذن التجاري للقارئ" },
  };
  const record = { provider: "quran-foundation", reciter: choice.name, recitationId: 7,
    fetchedAt: new Date().toISOString(),
    parts: [{ file, duration: x.duration, sha256: sha(x.bytes) }] };
  await writeFile(x.indexFile, JSON.stringify({ "53:39": record }));
  const media: Pick<EpisodeMedia, "mode" | "base" | "recitations"> = {
    mode: "static", base: x.base,
    recitations: { "53:39": { file, duration: x.duration, reciter: choice.name,
      source: "quran-foundation", parts: record.parts } },
  };
  return { choice, record, media };
};

describe("PR #73 Quran audio integration contract — negative safety scenarios", () => {
  it("accepts a synthetic locally-reviewed manual recording only with exact staged bytes", async () => {
    const x = await fixture();
    const { media } = await manual(x);
    expect((await approvedRecitationsForRender(x.scriptPath, undefined))["53:39"]?.source).toBe("manual");
    await expect(assertRenderedRecitationsMatchApprovals(x.scriptPath, undefined, media, x.renderRoot))
      .resolves.toBe(true);
    // A pre-existing global licensed alternative must never silently replace this source.
    const swapped: typeof media = { ...media, recitations: {
      "53:39": { ...media.recitations["53:39"]!, source: "licensed" },
    } };
    await expect(assertRenderedRecitationsMatchApprovals(x.scriptPath, undefined, swapped, x.renderRoot))
      .rejects.toThrow(/التسجيل المختار/);
  });

  it("revokes the exact reviewed manual source after Quran tashkeel or reference changes", async () => {
    const x = await fixture();
    const { media } = await manual(x);
    await writeFile(x.scriptPath, script(verse.replace("وَأَنْ", "وَأَنِ")));
    await expect(assertRenderedRecitationsMatchApprovals(x.scriptPath, undefined, media, x.renderRoot))
      .rejects.toThrow(/المراجعة|اعتماد|البصمة/);
    await writeFile(x.scriptPath, script(verse, "الإخلاص 1"));
    await expect(assertRenderedRecitationsMatchApprovals(x.scriptPath, undefined, media, x.renderRoot))
      .rejects.toThrow(/غير موجود/);
  });

  it("rejects missing reciter, rights or signed human listening notes; no cached fallback", async () => {
    const x = await fixture();
    const { record, media } = await manual(x);
    for (const patch of [
      { rightsEvidence: "" }, { reciter: "" }, { approvedBy: "" }, { reviewNote: "" },
      { sha256: "f".repeat(64) }, { textSha256: "a".repeat(64) },
      { approvedAt: "2999-01-01T00:00:00Z" },
    ]) {
      await writeFile(x.indexFile, JSON.stringify({ "53:39": { ...record, ...patch } }));
      await expect(assertRenderedRecitationsMatchApprovals(x.scriptPath, undefined, media, x.renderRoot))
        .rejects.toThrow();
    }
  });

  it("rejects a changed staged file even when original approved MP3 and index stay intact", async () => {
    const x = await fixture();
    const { media } = await manual(x);
    const file = media.recitations["53:39"]!.file;
    await writeFile(path.join(x.renderDir, file), "ANOTHER RECORDING");
    await expect(assertRenderedRecitationsMatchApprovals(x.scriptPath, undefined, media, x.renderRoot))
      .rejects.toThrow(/تغيّرت/);
    expect(sha(await readFile(path.join(x.rec, file)))).toBe(sha(x.bytes));
  });

  it("requires a QF reciter with explicit rights and correct SHA-addressed staged file", async () => {
    const x = await fixture();
    const { choice, record, media } = await provider(x);
    expect(assertReciterPublicationRights(choice)).toBe(true);
    await expect(assertRenderedRecitationsMatchApprovals(x.scriptPath, choice, media, x.renderRoot))
      .resolves.toBe(true);
    await expect(assertRenderedRecitationsMatchApprovals(x.scriptPath,
      { id: 7, name: choice.name }, media, x.renderRoot)).rejects.toThrow(/دليل حقوق/);
    await expect(assertRenderedRecitationsMatchApprovals(x.scriptPath,
      { ...choice, id: 99 }, media, x.renderRoot)).rejects.toThrow(/مصدر/);
    await expect(assertRenderedRecitationsMatchApprovals(x.scriptPath,
      { ...choice, licence: { ...choice.licence!, verifiedBy: "" } }, media, x.renderRoot))
      .rejects.toThrow(/المراجع البشري/);
    await writeFile(x.indexFile, JSON.stringify({ "53:39": { ...record, parts: [
      { ...record.parts[0], sha256: undefined },
    ] } }));
    await expect(assertRenderedRecitationsMatchApprovals(x.scriptPath, choice, media, x.renderRoot))
      .rejects.toThrow(/بصمة/);
  });

  it("rejects stale provider cache, missing verse and private-stage boundary tampering", async () => {
    const x = await fixture();
    const { choice, record, media } = await provider(x);
    const outside = { ...media, base: "_render/another/000-demo/" + "1".repeat(24) + "/" };
    await expect(assertRenderedRecitationsMatchApprovals(x.scriptPath, choice, outside, x.renderRoot))
      .rejects.toThrow(/لا تخص/);
    const missing: typeof media = { ...media, recitations: {} };
    await expect(assertRenderedRecitationsMatchApprovals(x.scriptPath, choice, missing, x.renderRoot))
      .rejects.toThrow(/مجموعة الآيات/);
    await writeFile(x.indexFile, JSON.stringify({
      "53:39": { ...record, fetchedAt: "2000-01-01T00:00:00Z" },
    }));
    await expect(assertRenderedRecitationsMatchApprovals(x.scriptPath, choice, media, x.renderRoot))
      .rejects.toThrow(/صلاحية/);
  });
});
