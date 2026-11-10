/**
 * بوابات النسخة النهائية: كل حالة تستوجب المنع تمنع فعلًا، والحالة السليمة تمر.
 * حلقة صغيرة مصطنعة لقناة «دفاتر الزمن» (لها قارئ): جملة واحدة وآية واحدة.
 */
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

process.env.BAL_CHANNEL = "dafatir-alzaman";

const { parseScript } = await import("../src/script/parse");
const { generatePlan } = await import("../src/plan/generate");
const { loadChannel } = await import("../src/channel/index");
const { setReview, reviewItems } = await import("../src/script/review");
const { approveStoryboard } = await import("../src/plan/storyboard");
const { setSceneReview } = await import("../src/plan/sceneReview");
const { assertMasterReady } = await import("../src/render/episode");
const { approveVoiceScene, approveVoiceEpisode } = await import("../src/voice/review");

const tempDirs: string[] = [];
afterAll(async () => { await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true }))); });

const SCRIPT = `---
title: "حلقة اختبار البوابات"
domain: islamic
episode: "999"
---

## الفصل 1 · البداية

أخبر الله ملائكته أنه جاعل في الأرض خليفة.

[آية: البقرة 30 | نص الآية للاختبار]

## الاستشهادات

- آية | البقرة 30 | القارئ: …
`;

type Plan = Awaited<ReturnType<typeof generatePlan>>;
const channel = loadChannel("dafatir-alzaman");

/** حالة سليمة كاملة في مجلد مؤقت، ثم يكسر كل اختبار شرطًا واحدًا */
const fresh = async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "gates-"));
  tempDirs.push(dir);
  const scriptPath = path.join(dir, "script.md");
  await writeFile(scriptPath, SCRIPT);
  const parsed = parseScript(SCRIPT, scriptPath);
  const plan = generatePlan(parsed, null, { "2:30": "نص الآية للاختبار" }, channel) as Plan;
  const scenes = plan.chapters.flatMap((c) => c.scenes);
  const spoken = scenes.find((s) => s.narration.trim())!;
  const verse = scenes.find((s) => s.template === "verse-card")!;
  await mkdir(path.join(dir, "voice"), { recursive: true });
  execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=3.0", "-c:a", "libmp3lame", path.join(dir, "voice", "a.mp3")]);
  const media = {
    mode: "url" as const,
    base: "",
    sfx: [],
    voice: { [spoken.id]: { file: "a.mp3", text: spoken.narration.trim(), duration: 3, words: [] } },
    recitations: { [verse.ayahKey!]: { file: "r.mp3", duration: 6, source: "manual" as const } },
  };
  for (const s of scenes) if (s.template === "verse-card") s.props.text = "نص الآية للاختبار";
  // المشهد المنطوق بقالب لا يحتاج صورة (القالب الافتراضي للقناة لوحة وثائقية تحتاج صورة)
  spoken.tone = "documentary";
  spoken.template = "noor-text";
  spoken.props = { text: "", light: "ink", subtitle: "" };
  for (const item of reviewItems(parsed, null)) await setReview(scriptPath, parsed, item.key, "verified");
  await approveStoryboard(scriptPath, plan);
  for (const s of scenes) await setSceneReview(scriptPath, plan, s.id, "ok");
  await approveVoiceScene(scriptPath, plan, media.voice as never, spoken.id, "owner-test", "استمعت للمقطع كاملًا وتحققت من النبرة والنطق");
  await approveVoiceEpisode(scriptPath, plan, media.voice as never, "owner-test", "تم الاستماع المتصل للتعليق الصوتي كاملًا وتحقق انتقال المقاطع");
  return { dir, scriptPath, parsed, plan, media, spoken, verse };
};

describe("بوابات النسخة النهائية", () => {
  let ok: Awaited<ReturnType<typeof fresh>>;
  beforeAll(async () => {
    ok = await fresh();
  });

  it("الحالة المكتملة تمر", async () => {
    await expect(assertMasterReady({ scriptPath: ok.scriptPath, plan: ok.plan, media: ok.media as never, channel })).resolves.toBe(true);
  });

  it("مراجعة المشهد القديمة (scene-review.json) ليست سلطة: لا تمنح ولا تمنع؛ الحَكَم سجل «إنتاج المشاهد»", async () => {
    const s = await fresh();
    await setSceneReview(s.scriptPath, s.plan, s.spoken.id, "pending");
    await expect(assertMasterReady({ scriptPath: s.scriptPath, plan: s.plan, media: s.media as never, channel })).resolves.toBe(true);
  });

  it("مشهد تغيّر بعد اعتماد الستوري بورد يمنع", async () => {
    const s = await fresh();
    s.spoken.props.subtitle = "تعديل بعد الاعتماد";
    await expect(assertMasterReady({ scriptPath: s.scriptPath, plan: s.plan, media: s.media as never, channel })).rejects.toThrow(/بعد اعتماد التجهيز.*«١ التجهيز»/);
  });

  // Owner decision (10 Nov), CLAUDE.md rule 5: the citation ledger is documentation only and never blocks.
  it("التوثيق لا يمنع النسخة النهائية (حتى مصدر مرفوض)", async () => {
    const s = await fresh();
    const key = reviewItems(s.parsed, null)[0]!.key;
    await setReview(s.scriptPath, s.parsed, key, "rejected", "لا تطابق التلاوة نص الآية");
    await expect(assertMasterReady({ scriptPath: s.scriptPath, plan: s.plan, media: s.media as never, channel })).resolves.toBe(true);
  });

  it("تلاوة مفقودة تمنع", async () => {
    const s = await fresh();
    await expect(assertMasterReady({ scriptPath: s.scriptPath, plan: s.plan, media: { ...s.media, recitations: {} } as never, channel })).rejects.toThrow(/تلاوة/);
  });

  it("صوت لا يطابق نصه يمنع", async () => {
    const s = await fresh();
    const media = { ...s.media, voice: { [s.spoken.id]: { ...s.media.voice[s.spoken.id]!, text: "نص قديم" } } };
    await expect(assertMasterReady({ scriptPath: s.scriptPath, plan: s.plan, media: media as never, channel })).rejects.toThrow(/صوتي/);
  });

  it("تغيير النبرة لا يمر عبر الفحص التقني إلى اعتماد قديم: الاعتماد البشري في سجل المشاهد وحده", async () => {
    const sample = await fresh();
    sample.spoken.tone = "warm";
    // The technical gate does not hold human approvals any more (no episode voice approval);
    // the tone change re-opens this scene in the scene-first ledger (tests/studio-scene-production).
    await expect(assertMasterReady({ scriptPath: sample.scriptPath, plan: sample.plan, media: sample.media as never, channel }))
      .resolves.toBe(true);
  });

  it("آية بلا نصها تمنع", async () => {
    const s = await fresh();
    s.verse.props.text = "";
    await expect(assertMasterReady({ scriptPath: s.scriptPath, plan: s.plan, media: s.media as never, channel })).rejects.toThrow();
  });
});
