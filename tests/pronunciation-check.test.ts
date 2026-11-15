/**
 * فحص النطق (العمل ٩): الحلقة كاملة بلا نموذج ولا شبكة.
 *   - جمل مولَّدة بعميل صوت مزيّف (صوت صناعي)، ثم تفريغ مزيّف يحاكي ما يسمعه النموذج، ويُحوَّل كل تسجيل
 *     إلى wav 16k بـ ffmpeg الاستوديو نفسه (كما على جهاز المالك).
 *   - لا تُفحص الآية ولا البسملة أبدًا، والنتيجة في voice/ (لا تُرفع)، ولا يُعاد فحص ما لم يتغير.
 *   - مطفأ افتراضيًا، ولا يُفعَّل قبل القياس، والقياس يعدّ الإنذار الكاذب على جمل «سمعتها».
 *   - عامل Python نفسه (tools/pronunciation-check/whisper_worker.py) ببروتوكوله، بنموذج بديل صغير.
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { encodeWav } from "../src/remotion/dafatir/audio/compose";
import type { ElevenLabsClient } from "../src/voice/elevenlabs";
import type { Plan } from "../src/plan/types";
import type { Transcriber } from "../src/voice/pronunciation/whisperTool";

const ENV = ["BAL_CHANNELS_DIR", "BAL_CHANNEL", "ELEVENLABS_MODEL_ID", "BAL_WORKFLOW_HMAC_KEY", "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID", "BAL_PRON_CHECK_DIR"] as const;
const saved: Record<string, string | undefined> = {};
let tmp = "";
const SR = 44100;
const S1 = "كَتَبَ الوَلَدُ الدَّرْسَ.";
const S2 = "ثُمَّ ذَهَبَ إِلَى المَدْرَسَةِ مُبَكِّرًا.";
const S3 = "وَالصَّبْرُ مِفْتَاحُ الفَرَجِ.";
const BASM = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ";
const EP = "986";
const EP_DIR = () => path.join(tmp, "balislam", "episodes", `${EP}-pron`);

const plan = (): Plan => ({
  episode: EP, title: "اختبار", tone: "calm",
  chapters: [{ number: 1, title: "تجربة", scenes: [
    { id: "c1-s1", template: "alley-tale", line: 6, narration: `${S1} ${S2}`, sfx: [], props: {} },
    { id: "c1-s2", template: "alley-tale", line: 8, narration: `${BASM} ${S3}`, sfx: [], props: {} },
    { id: "c1-s3", template: "verse-card", line: 10, narration: "", ayahKey: "1:1", sfx: [], props: { text: BASM, reference: "الفاتحة · ١" } },
  ] }],
} as unknown as Plan);

const tone = (text: string) => {
  const chars = [...text];
  const lead = 0.2, step = 0.04, n = Math.round((lead + chars.length * step + 0.3) * SR);
  const s = new Float32Array(n);
  for (let k = 0; k < n; k++) s[k] = Math.sin(2 * Math.PI * 180 * k / SR) * 0.2;
  return { wav: Buffer.from(encodeWav(s, SR)), alignment: { characters: chars, character_start_times_seconds: chars.map((_, i) => lead + i * step), character_end_times_seconds: chars.map((_, i) => lead + (i + 1) * step) } };
};
const sentToTts: string[] = [];
const fakeClient = {
  modelId: "mock",
  tts: async (text: string) => { sentToTts.push(text); const t = tone(text); return { audio: t.wav, alignment: t.alignment, model: "mock" }; },
  soundEffect: async () => Buffer.alloc(0), account: async () => ({}) as never, voices: async () => [],
} as unknown as ElevenLabsClient;

/** What the «model» hears: S3 with «الشكر» in place of «الصبر»; the others as written (without tashkeel). */
const heardFor = (text: string) => text.includes("الصَّبْرُ") ? "والشكر مفتاح الفرج" : text.replace(/[ً-ْٰ]/g, "");
let transcribed: string[] = [];
let textById = new Map<string, string>();
const fakeTranscriber: Transcriber = async (items) => {
  const out = new Map<string, { text?: string }>();
  for (const it of items) {
    // ffmpeg really made a 16 kHz mono wav
    const b = readFileSync(it.wav);
    expect(b.toString("ascii", 0, 4)).toBe("RIFF");
    expect(b.readUInt32LE(24)).toBe(16000);
    expect(b.readUInt16LE(22)).toBe(1);
    transcribed.push(it.id);
    out.set(it.id, { text: heardFor(textById.get(it.id) ?? "") });
  }
  return out;
};

beforeAll(async () => {
  for (const k of ENV) saved[k] = process.env[k];
  tmp = mkdtempSync(path.join(os.tmpdir(), "bal-pron-"));
  cpSync(path.join("channels", "balislam"), path.join(tmp, "balislam"), { recursive: true, filter: (s) => !/[\\/]episodes([\\/]|$)/.test(s) });
  process.env.BAL_CHANNELS_DIR = tmp;
  process.env.BAL_CHANNEL = "balislam";
  process.env.ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";
  process.env.BAL_WORKFLOW_HMAC_KEY = "LOCAL_TEST_ONLY__pronunciation_check_signing_key_2026";
  process.env.BAL_PRON_CHECK_DIR = path.join(tmp, "tool");
  delete process.env.ELEVENLABS_API_KEY;
  mkdirSync(path.join(EP_DIR(), "voice"), { recursive: true });
  writeFileSync(path.join(EP_DIR(), "script.md"), `---\ntitle: "اختبار"\nepisode: "${EP}"\n---\n## الفصل 1 · تجربة\n${S1} ${S2}\n\n${BASM} ${S3}\n`);
  writeFileSync(path.join(EP_DIR(), "plan.json"), JSON.stringify(plan(), null, 2) + "\n");
  writeFileSync(path.join(EP_DIR(), "tashkeel.md"), `${S1} ${S2}\n\n${S3}\n`);
  const sv = await import("../src/voice/sentenceVoice");
  for (const scene of ["c1-s1", "c1-s2"]) {
    const init = await sv.sentenceAction(EP, { action: "init", sceneId: scene });
    for (const r of init.read.scenes.find((s) => s.id === scene)!.rows.filter((x) => x.kind === "narration"))
      await sv.sentenceAction(EP, { action: "generate", id: r.id }, { client: fakeClient, testOnlySkipApprovalGates: true });
  }
  const read = await sv.readSentences(EP);
  textById = new Map(read.scenes.flatMap((s) => s.rows.map((r) => [r.id, r.text] as const)));
}, 60_000);
afterAll(async () => {
  (await import("../src/voice/pronunciation/service")).setTranscriberForTests(null);
  for (const k of ENV) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

describe("فحص حلقة", () => {
  it("يفحص جمل الراوي وحدها: لا الآية ولا البسملة، والبسملة لم تُرسل إلى الصوت أصلًا", async () => {
    const sv = await import("../src/voice/sentenceVoice");
    const read = await sv.readSentences(EP);
    const kinds = read.scenes.flatMap((s) => s.rows.map((r) => r.kind));
    expect(kinds).toContain("basmala");
    expect(sentToTts.some((t) => t.includes("بِسْمِ"))).toBe(false);
    const { checkEpisode } = await import("../src/voice/pronunciation/runner");
    transcribed = [];
    const r = await checkEpisode(EP, { transcribe: fakeTranscriber });
    expect(r.checked).toBe(3);
    const checkedTexts = transcribed.map((id) => textById.get(id));
    expect(checkedTexts).toEqual([S1, S2, S3]);
    const byText = Object.fromEntries(Object.entries(r.results).map(([id, x]) => [textById.get(id), x]));
    expect(byText[S1]!.verdict).toBe("ok");
    expect(byText[S2]!.verdict).toBe("ok");
    expect(byText[S3]!.verdict).toBe("suspect");
    expect(byText[S3]!.suspects).toEqual([{ index: 0, word: "وَالصَّبْرُ", heard: "والشكر" }]);
    // the result lives with the audio (voice/, never uploaded)
    const file = path.join(EP_DIR(), "voice", "pronunciation-check.json");
    expect(existsSync(file)).toBe(true);
    const { isOwnerContentPath } = await import("../scripts/contentPaths.mjs") as { isOwnerContentPath?: (p: string) => boolean };
    if (isOwnerContentPath) expect(isOwnerContentPath(`channels/balislam/episodes/${EP}-pron/voice/pronunciation-check.json`)).toBe(false);
  });

  it("لا يُعاد فحص تسجيل لم يتغير؛ وتسجيل جديد للجملة يُفحص وحده", async () => {
    const { checkEpisode } = await import("../src/voice/pronunciation/runner");
    transcribed = [];
    expect((await checkEpisode(EP, { transcribe: fakeTranscriber })).checked).toBe(0);
    const sv = await import("../src/voice/sentenceVoice");
    const s3 = [...textById].find(([, t]) => t === S3)![0];
    // D136: a regeneration with nothing changed is confirmed by the owner
    await sv.sentenceAction(EP, { action: "generate", id: s3, confirmSame: true }, { client: fakeClient, testOnlySkipApprovalGates: true });
    const r = await checkEpisode(EP, { transcribe: fakeTranscriber });
    expect(r.checked).toBe(1);
    expect(transcribed).toEqual([s3]);
  });

  it("التنبيه لا يغيّر الجمل ولا السجل: sentences.json كما هو بعد الفحص", async () => {
    const f = path.join(EP_DIR(), "voice", "sentences.json");
    const before = readFileSync(f, "utf8");
    const { checkEpisode } = await import("../src/voice/pronunciation/runner");
    const doc = JSON.parse(readFileSync(path.join(EP_DIR(), "voice", "pronunciation-check.json"), "utf8"));
    doc.results = {};
    writeFileSync(path.join(EP_DIR(), "voice", "pronunciation-check.json"), JSON.stringify(doc));
    await checkEpisode(EP, { transcribe: fakeTranscriber });
    expect(readFileSync(f, "utf8")).toBe(before);
    expect(existsSync(path.join(EP_DIR(), "scene-production.json"))).toBe(false);
  });
});

describe("مطفأ افتراضيًا، ويُفعَّل بعد القياس وحده", () => {
  it("بلا تثبيت ولا تفعيل: «off» بلا خطأ، و«not-installed» إن فُعّل والأداة غائبة", async () => {
    const svc = await import("../src/voice/pronunciation/service");
    const tool = await import("../src/voice/pronunciation/whisperTool");
    expect(await svc.episodeView("balislam", EP)).toEqual({ state: "off" });
    expect((await tool.detectInstalled()).installed).toBe(false);
    await tool.writeState({ enabled: true });
    expect(await svc.episodeView("balislam", EP)).toEqual({ state: "not-installed" });
    await tool.writeState({ enabled: false });
    const st = await svc.toolStatus();
    expect(st).toMatchObject({ installed: false, enabled: false, measurement: null });
    expect(JSON.stringify(st)).not.toContain(tmp);
  });

  it("لا تفعيل قبل القياس؛ القياس يعدّ الإنذار الكاذب على «سمعتها»، ثم التفعيل يحفظ المعدل المقبول", async () => {
    const svc = await import("../src/voice/pronunciation/service");
    svc.setTranscriberForTests(fakeTranscriber);
    await expect(svc.setEnabled(true)).rejects.toMatchObject({ code: "NOT_MEASURED" });
    const sv = await import("../src/voice/sentenceVoice");
    // the owner listened to every sentence: a flag on one of them counts as a false alarm
    for (const id of textById.keys()) await sv.sentenceAction(EP, { action: "heard", id, value: true }).catch(() => null);
    const m = await svc.measureFalseAlarms({ channels: ["balislam"], deps: { transcribe: fakeTranscriber } });
    expect(m.sentences).toBe(3);
    expect(m.flagged).toBe(1);
    expect(m.heard).toBe(3);
    expect(m.basis).toBe("all"); // fewer than ten «سمعتها»: an upper bound on all sentences
    expect(m.rate).toBeCloseTo(1 / 3);
    expect(m.examples[0]).toMatchObject({ channel: "balislam", episode: EP, word: "وَالصَّبْرُ", heard: "والشكر" });
    const tool = await import("../src/voice/pronunciation/whisperTool");
    await tool.writeState({ ...(await tool.readState()), measurement: m });
    const on = await svc.setEnabled(true);
    expect(on).toMatchObject({ enabled: true, acceptedRate: m.rate });
    const v = await svc.episodeView("balislam", EP);
    expect(v.state).toBe("on");
    if (v.state === "on") expect(Object.values(v.results).filter((x) => x.verdict === "suspect")).toHaveLength(1);
    await svc.setEnabled(false);
    expect(await svc.episodeView("balislam", EP)).toEqual({ state: "off" });
  });

  it("التثبيت لا يبدأ إلا بطلب، ويرفض بلا Python قبل أي تنزيل", async () => {
    const tool = await import("../src/voice/pronunciation/whisperTool");
    expect(tool.currentInstall()).toBeNull();
    await expect(tool.startInstall({ env: { ...process.env, BAL_PYTHON: "/nonexistent/python3", PATH: "/nonexistent" } })).rejects.toMatchObject({ code: "NO_PYTHON" });
    expect(tool.currentInstall()).toBeNull();
    expect(existsSync(path.join(process.env.BAL_PRON_CHECK_DIR!, "venv"))).toBe(false);
  });
});

describe("عامل Python (البروتوكول)", () => {
  const py = spawnSync("python3", ["--version"]).status === 0 ? "python3" : null;
  it.skipIf(!py)("يقرأ wav من stdin JSON ويعيد نص كل ملف، وملف تالف لا يوقف الدفعة", async () => {
    const stub = path.join(tmp, "stub");
    mkdirSync(path.join(stub, "faster_whisper"), { recursive: true });
    writeFileSync(path.join(stub, "faster_whisper", "__init__.py"), [
      "import os",
      "class _S:",
      "    def __init__(self, t): self.text = t",
      "class WhisperModel:",
      "    def __init__(self, path, **kw):",
      "        assert kw.get('local_files_only') is True and os.environ.get('HF_HUB_OFFLINE') == '1'",
      "    def transcribe(self, audio, **kw):",
      "        assert kw.get('language') == 'ar' and 'initial_prompt' not in kw",
      "        return [_S(' كلمة %d ' % len(audio))], None",
    ].join("\n"));
    const wav = path.join(tmp, "a.wav");
    const s = new Float32Array(1600);
    const { encodeWav: enc } = await import("../src/remotion/dafatir/audio/compose");
    writeFileSync(wav, enc(s, 16000));
    const { localTranscriber } = await import("../src/voice/pronunciation/whisperTool");
    const prev = process.env.PYTHONPATH;
    process.env.PYTHONPATH = stub;
    try {
      const out = await localTranscriber({ installed: true, python: py!, model: stub, version: "test", at: "" })([
        { id: "a", wav }, { id: "b", wav: path.join(tmp, "missing.wav") },
      ]);
      expect(out.get("a")).toEqual({ text: "كلمة 1600", error: undefined });
      expect(out.get("b")?.error).toBeTruthy();
    } finally {
      if (prev === undefined) delete process.env.PYTHONPATH; else process.env.PYTHONPATH = prev;
    }
  });
});
