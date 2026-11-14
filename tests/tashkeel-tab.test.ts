/**
 * «النص المشكول» في الخطوة ١ (طلب المالك ١٤ نوفمبر «نفّذه الآن رغم التجميد»، D132؛ القنوات الثلاث):
 * tashkeel.md يُقرأ ويُحفظ من الاستوديو، محتوى مالك (D101) تفحصه بوابة المحتوى. الحفظ يغيّر ما يُرسل إلى الصوت وحده
 * (نص الجملة والسكريبت والخطة والترجمة كما هي)، ويجعل التسجيلات المتأثرة «تحتاج توليدًا» بالبصمة نفسها بلا توليد ولا
 * حذف، و«النطق» المكتوب (D131) يعلو عليه لجملته. الحفظ بنسخة الملف التي فُتحت: 409 إن تغيّر بعدها.
 * لا مفاتيح ولا شبكة: عميل صوت مزيّف.
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { encodeWav } from "../src/remotion/dafatir/audio/compose";
import type { ElevenLabsClient } from "../src/voice/elevenlabs";
import type { Plan } from "../src/plan/types";
import { heavyTimeout } from "./helpers/heavyTimeout";
import { isOwnerContentPath } from "../scripts/contentPaths.mjs";

const ENV = ["BAL_CHANNELS_DIR", "BAL_CHANNEL", "ELEVENLABS_MODEL_ID", "BAL_WORKFLOW_HMAC_KEY", "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"] as const;
const saved: Record<string, string | undefined> = {};
let tmp = "";
const SR = 44100;
const CHANNELS = ["balislam", "dafatir-alzaman", "zubdat-alkutub"] as const;
const repo = path.resolve(import.meta.dirname, "..");

// the script is written without tashkeel; tashkeel.md holds the voweled copy for the voice only
const P1A = "كتب الولد الدرس.";
const P1B = "ثم ذهب إلى البيت؟";
const P3 = "ونبدأ الآن.";
const V1A = "كَتَبَ الوَلَدُ الدَّرْسَ.";
const V1A2 = "كَتَبَ الوَلَدُ الدُّرُوسَ."; // one word with other letters: a mismatch after stripping tashkeel
const V1B = "ثُمَّ ذَهَبَ إِلَى البَيْتِ؟";
const V1Bx = "ثُمَّ ذَهِبَ إِلَى البَيْتِ؟"; // same sentence, a changed vowel on one word
const V3 = "وَنَبْدَأُ الآنَ.";
const VERSE = "وَأَنْ لَيْسَ لِلْإِنْسَانِ إِلَّا مَا سَعَىٰ";
const EPISODE = "984";
const epDir = (ch: string) => path.join(tmp, ch, "episodes", "984-tk");
const TK = (ch: string) => path.join(epDir(ch), "tashkeel.md");

const plan = (): Plan => ({
  episode: EPISODE, title: "اختبار", tone: "calm",
  chapters: [{ number: 1, title: "تجربة", scenes: [
    { id: "c1-s1", template: "alley-tale", line: 6, narration: `${P1A} ${P1B}`, sfx: [], props: {} },
    { id: "c1-s2", template: "verse-card", line: 8, narration: "", ayahKey: "53:39", sfx: [], props: { text: VERSE, reference: "النجم · ٣٩" } },
    { id: "c1-s3", template: "alley-tale", line: 10, narration: P3, sfx: [], props: {} },
  ] }],
} as unknown as Plan);
const SCRIPT = `---\ntitle: "اختبار"\nepisode: "${EPISODE}"\n---\n## الفصل 1 · تجربة\n${P1A} ${P1B}\n\n[آية: النجم ٣٩ | ${VERSE}]\n\n${P3}\n`;

const freshEpisode = (ch: string, tashkeel: string | null = `${V1A} ${V1B}\n\n${VERSE}\n\n${V3}\n`) => {
  rmSync(epDir(ch), { recursive: true, force: true });
  mkdirSync(path.join(epDir(ch), "voice"), { recursive: true });
  writeFileSync(path.join(epDir(ch), "script.md"), SCRIPT);
  writeFileSync(path.join(epDir(ch), "plan.json"), JSON.stringify(plan(), null, 2) + "\n");
  if (tashkeel !== null) writeFileSync(TK(ch), tashkeel);
};

const tone = (text: string) => {
  const chars = [...text];
  const lead = 0.25, step = 0.05, n = Math.round((lead + chars.length * step + 0.4) * SR);
  const s = new Float32Array(n);
  chars.forEach((c, i) => {
    if (/\s/.test(c)) return;
    for (let k = Math.round((lead + i * step) * SR); k < Math.round((lead + (i + 1) * step) * SR); k++) s[k] = Math.sin(2 * Math.PI * 160 * k / SR) * 0.3;
  });
  for (let k = 0; k < n; k++) if (!s[k]) s[k] = 0.0002 * Math.sin(k);
  return { wav: Buffer.from(encodeWav(s, SR)), alignment: { characters: chars, character_start_times_seconds: chars.map((_, i) => lead + i * step), character_end_times_seconds: chars.map((_, i) => lead + (i + 1) * step) } };
};
const fakeClient = (sent: string[]) => ({
  modelId: "mock",
  tts: async (text: string) => { sent.push(text); const t = tone(text); return { audio: t.wav, alignment: t.alignment, model: "mock" }; },
  soundEffect: async () => Buffer.alloc(0), account: async () => ({}) as never, voices: async () => [],
}) as unknown as ElevenLabsClient;
const OPTS = { testOnlySkipApprovalGates: true } as const;
const read = (f: string) => readFileSync(f, "utf8");

beforeAll(() => {
  for (const k of ENV) saved[k] = process.env[k];
  tmp = mkdtempSync(path.join(os.tmpdir(), "bal-tk-"));
  for (const ch of CHANNELS)
    cpSync(path.join("channels", ch), path.join(tmp, ch), { recursive: true, filter: (s) => !/[\\/]episodes([\\/]|$)/.test(s) });
  process.env.BAL_CHANNELS_DIR = tmp;
  process.env.ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";
  process.env.BAL_WORKFLOW_HMAC_KEY = "LOCAL_TEST_ONLY__tashkeel_tab_signing_key_2026";
  delete process.env.ELEVENLABS_API_KEY;
});
afterAll(() => {
  for (const k of ENV) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

describe("D132: tashkeel.md محتوى مالك (D101) تفحصه بوابة المحتوى", () => {
  it("المسار بجوار السكريبت يُرفع، ولا شيء تحت voice/", () => {
    for (const ch of CHANNELS) expect(isOwnerContentPath(`channels/${ch}/episodes/001-x/tashkeel.md`)).toBe(true);
    expect(isOwnerContentPath("channels/balislam/episodes/001-x/voice/tashkeel.md")).toBe(false);
  });

  it("فحص النص: الفارغ ورموز التحكم والحروف التالفة مرفوضة، والنص العربي المشكول صالح", async () => {
    const { checkTashkeelText, tashkeelRevision } = await import("../src/voice/tashkeelFile");
    expect(checkTashkeelText("  \n")).toEqual([expect.stringMatching(/فارغة/)]);
    expect(checkTashkeelText(`${V1A}\u0000`)).toEqual([expect.stringMatching(/رموز تحكم/)]);
    expect(checkTashkeelText(`${V1A}�`)).toEqual([expect.stringMatching(/تالفة/)]);
    expect(checkTashkeelText(`${V1A}\n\n[آية: النجم ٣٩ | ${VERSE}]\n`)).toEqual([]);
    expect(tashkeelRevision(null)).toBe("none");
    expect(tashkeelRevision("a")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("بوابة المحتوى: خطأ جديد في tashkeel.md يرفض الدفع، والنص الصالح يمر", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "bal-tk-gate-"));
    try {
      const rel = "channels/balislam/episodes/001-x/tashkeel.md";
      mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
      writeFileSync(path.join(root, path.dirname(rel), "script.md"), SCRIPT);
      const gate = () => {
        try { execFileSync(path.join(repo, "node_modules", ".bin", "tsx"), [path.join(repo, "scripts", "contentGate.mts"), rel], { cwd: root, encoding: "utf8", stdio: "pipe" }); return "ok"; }
        catch (e) { return String((e as { stderr?: string }).stderr); }
      };
      writeFileSync(path.join(root, rel), `${V1A}\n`);
      expect(gate()).toBe("ok");
      writeFileSync(path.join(root, rel), `${V1A}\u0001\n`);
      expect(gate()).toMatch(/رموز تحكم/);
      writeFileSync(path.join(root, rel), "\n");
      expect(gate()).toMatch(/فارغة/);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, heavyTimeout(30_000));

  it("المطابقة: جملة بلا نظير في الملف، وجملة تختلف حروفها بعد حذف التشكيل", async () => {
    const { tashkeelAlignment } = await import("../src/voice/tashkeelEdit");
    const { buildTashkeelIndex } = await import("../src/voice/tashkeel");
    const idx = buildTashkeelIndex(`${V1A2} ${V1B}`);
    const r = tashkeelAlignment([{ sceneId: "a", text: P1A }, { sceneId: "a", text: P1B }, { sceneId: "b", text: P3 }], idx);
    expect(r).toEqual([
      { sceneId: "a", sentence: P1A, problem: "mismatch", words: ["الدرس"] },
      { sceneId: "b", sentence: P3, problem: "missing", words: ["ونبدأ", "الآن"] },
    ]);
    expect(tashkeelAlignment([{ sceneId: "a", text: P1A }], null)).toEqual([]);
    // a sentence voweled in the script itself does not need the file (it only fills marks the owner did not write)
    expect(tashkeelAlignment([{ sceneId: "b", text: V3 }], idx)).toEqual([]);
  });
});

for (const ch of CHANNELS) {
  describe(`D132 «النص المشكول» — ${ch}`, { timeout: heavyTimeout(10_000) }, () => {
    it("القراءة: النص والنسخة والتغطية والمطابقة لجمل الراوي وحدها (بلا الآية)", async () => {
      process.env.BAL_CHANNEL = ch;
      freshEpisode(ch, `${V1A} ${V1B}\n\n${VERSE}\n`);
      const T = await import("../src/voice/tashkeelEdit");
      const r = await T.readTashkeel(EPISODE);
      expect(r.exists).toBe(true);
      expect(r.text).toContain(V1A);
      expect(r.revision).toBe(T.tashkeelRevision(read(TK(ch))));
      // «ونبدأ الآن» has no counterpart: coverage below 98% and one alignment problem; the verse scene is not counted
      expect(r.report.ok).toBe(false);
      expect(r.report.gaps.map((g) => g.sceneId)).toEqual(["c1-s3"]);
      expect(r.alignment).toEqual([expect.objectContaining({ sceneId: "c1-s3", problem: "missing" })]);
      expect(r.saySentences).toBe(0);
    });

    it("لا ملف: «أنشئ من السكريبت» ينسخ script.md كما هو، والتغطية منخفضة حتى يُشكَّل؛ ولا يُنشأ فوق ملف موجود", async () => {
      process.env.BAL_CHANNEL = ch;
      freshEpisode(ch, null);
      const T = await import("../src/voice/tashkeelEdit");
      const r0 = await T.readTashkeel(EPISODE);
      expect(r0).toMatchObject({ exists: false, text: "", revision: "none" });
      expect(r0.report.file).toBe(false);
      await expect(T.saveTashkeel(EPISODE, { fromScript: true, expectedRevision: "x" })).rejects.toBeInstanceOf(T.TashkeelStaleError);
      const r = await T.saveTashkeel(EPISODE, { fromScript: true, expectedRevision: "none" });
      expect(read(TK(ch))).toBe(SCRIPT);
      expect(r.exists).toBe(true);
      expect(r.report.ok).toBe(false);
      expect(r.report.coverage).toBeLessThan(0.98);
      await expect(T.saveTashkeel(EPISODE, { fromScript: true, expectedRevision: r.revision })).rejects.toThrow(/موجودة بالفعل/);
    });

    it("التعارض: حفظ بنسخة قديمة يُرفض 409 ولا يكتب شيئًا، ويرجع النسخة المحفوظة الحالية", async () => {
      process.env.BAL_CHANNEL = ch;
      freshEpisode(ch);
      const T = await import("../src/voice/tashkeelEdit");
      const opened = (await T.readTashkeel(EPISODE)).revision;
      writeFileSync(TK(ch), `${V1A} ${V1Bx}\n\n${V3}\n`); // another save / an update arrived meanwhile
      const disk = read(TK(ch));
      const err = await T.saveTashkeel(EPISODE, { text: `${V1A} ${V1B}\n`, expectedRevision: opened }).catch((e) => e);
      expect(err).toBeInstanceOf(T.TashkeelStaleError);
      expect(err.status).toBe(409);
      expect(err.current).toEqual({ exists: true, text: disk, revision: T.tashkeelRevision(disk) });
      expect(read(TK(ch))).toBe(disk);
      // missing revision is refused too; an invalid text is 400 and writes nothing
      await expect(T.saveTashkeel(EPISODE, { text: V1A })).rejects.toBeInstanceOf(T.TashkeelStaleError);
      await expect(T.saveTashkeel(EPISODE, { text: " ", expectedRevision: T.tashkeelRevision(disk) })).rejects.toBeInstanceOf(T.TashkeelInputError);
      expect(read(TK(ch))).toBe(disk);
    });

    it("الحفظ يغيّر ما يُرسل وحده: الجملة المتأثرة «تحتاج توليدًا» بلا توليد ولا حذف، وغيرها كما هي، والنص والخطة والسكريبت كما هي", async () => {
      process.env.BAL_CHANNEL = ch;
      freshEpisode(ch);
      const sv = await import("../src/voice/sentenceVoice");
      const T = await import("../src/voice/tashkeelEdit");
      const sent: string[] = [];
      const client = fakeClient(sent);
      let read0 = await sv.readSentences(EPISODE);
      const firstId = read0.scenes[0]!.rows[0]!.id;
      let r = await sv.sentenceAction(EPISODE, { action: "generate", id: firstId }, { client, ...OPTS });
      const [a, b] = r.read.scenes[0]!.rows.map((x) => x.id);
      r = await sv.sentenceAction(EPISODE, { action: "generate", id: b! }, { client, ...OPTS });
      expect(sent).toEqual([V1A, V1B]); // spokenOf reads tashkeel.md: the voweled copy is sent
      expect(r.read.scenes[0]!.rows.map((x) => x.status)).toEqual(["generated", "generated"]);
      const planBefore = read(path.join(epDir(ch), "plan.json"));
      const scriptBefore = read(path.join(epDir(ch), "script.md"));
      const docBefore = JSON.parse(read(path.join(epDir(ch), "voice", "sentences.json")));
      const takeFiles = (d: any) => d.scenes["c1-s1"].sentences.map((s: any) => s.audio?.file);

      const rev = (await T.readTashkeel(EPISODE)).revision;
      const saved = await T.saveTashkeel(EPISODE, { text: `${V1A} ${V1Bx}\n\n${V3}\n`, expectedRevision: rev });
      expect(saved).toMatchObject({ changedSentences: 1, staleTakes: 1 });
      expect(saved.revision).toBe(T.tashkeelRevision(read(TK(ch))));

      read0 = await sv.readSentences(EPISODE);
      const rows = read0.scenes[0]!.rows;
      expect(rows.map((x) => x.id)).toEqual([a, b]);
      expect(rows.map((x) => x.text)).toEqual([P1A, P1B]); // display text and captions from script.md
      expect(rows[1]!.spoken).toBe(V1Bx);
      expect(rows.map((x) => x.status)).toEqual(["generated", "stale"]);
      expect(sent.length).toBe(2); // nothing generated by saving
      expect(read(path.join(epDir(ch), "plan.json"))).toBe(planBefore);
      expect(read(path.join(epDir(ch), "script.md"))).toBe(scriptBefore);
      const docAfter = JSON.parse(read(path.join(epDir(ch), "voice", "sentences.json")));
      expect(takeFiles(docAfter)).toEqual(takeFiles(docBefore)); // no take removed or replaced
      for (const f of takeFiles(docAfter)) expect(existsSync(path.join(epDir(ch), "voice", "sentences", f))).toBe(true);
      // the owner regenerates by hand: the new tashkeel is what is sent
      await sv.sentenceAction(EPISODE, { action: "generate", id: b! }, { client, ...OPTS });
      expect(sent).toEqual([V1A, V1B, V1Bx]);
    });

    it("«النطق» المكتوب (D131) يعلو على الملف لجملته: لا يتغير ما يُرسل لها ولا يصير تسجيلها «تحتاج توليدًا»", async () => {
      process.env.BAL_CHANNEL = ch;
      freshEpisode(ch);
      const sv = await import("../src/voice/sentenceVoice");
      const T = await import("../src/voice/tashkeelEdit");
      const sent: string[] = [];
      const client = fakeClient(sent);
      const id0 = (await sv.readSentences(EPISODE)).scenes[0]!.rows[1]!.id;
      const say = "ثُمَّ ذَهَبَ الوَلَدُ إِلَى البَيْتِ؟";
      let r = await sv.sentenceAction(EPISODE, { action: "say", id: id0, pronunciation: say }, { client, ...OPTS });
      const id = r.read.scenes[0]!.rows[1]!.id;
      r = await sv.sentenceAction(EPISODE, { action: "generate", id }, { client, ...OPTS });
      expect(sent).toEqual([say]);
      expect(r.read.scenes[0]!.rows[1]!.status).toBe("generated");
      const before = await T.readTashkeel(EPISODE);
      expect(before.saySentences).toBe(1);
      const saved = await T.saveTashkeel(EPISODE, { text: `${V1A} ${V1Bx}\n\n${V3}\n`, expectedRevision: before.revision });
      expect(saved).toMatchObject({ changedSentences: 0, staleTakes: 0 });
      const row = (await sv.readSentences(EPISODE)).scenes[0]!.rows[1]!;
      expect(row.spoken).toBe(say);
      expect(row.status).toBe("generated");
      expect(sent.length).toBe(1);

      // a take recorded under D131 (fingerprint with the automatic spoken text too) stays current
      const C = await import("../src/voice/sentenceContext");
      const { sentenceFingerprint } = await import("../src/voice/sentences");
      const ctx = await C.loadCtx(EPISODE);
      const f = C.flatten(ctx).find((x) => x.s.id === id)!;
      const v = C.voiceOf(ctx, f.scene, f.list, f.s);
      const d131 = sentenceFingerprint({ spoken: v.spoken.spoken, voiceKey: ctx.voiceKey, tts: C.ttsSettings(), tune: v.tune, exact: say });
      expect(d131).not.toBe(v.currentFingerprint);
      const docFile = path.join(epDir(ch), "voice", "sentences.json");
      const doc = JSON.parse(read(docFile));
      doc.scenes["c1-s1"].sentences.find((x: { id: string }) => x.id === id).audio.fingerprint = d131;
      writeFileSync(docFile, JSON.stringify(doc, null, 2) + "\n");
      expect((await sv.readSentences(EPISODE)).scenes[0]!.rows[1]!.status).toBe("generated");
    });

    it("القرآن: نص الآية في الملف لا يُرسل إلى الصوت، ولا يُعدّ في التغطية ولا المطابقة", async () => {
      process.env.BAL_CHANNEL = ch;
      freshEpisode(ch, `${V1A} ${V1B}\n\n[آية: النجم ٣٩ | ${VERSE}]\n\n${V3}\n`);
      const sv = await import("../src/voice/sentenceVoice");
      const T = await import("../src/voice/tashkeelEdit");
      const r = await T.readTashkeel(EPISODE);
      expect(r.report.ok).toBe(true);
      expect(r.alignment).toEqual([]);
      const sent: string[] = [];
      const client = fakeClient(sent);
      const all = (await sv.readSentences(EPISODE)).scenes.flatMap((s) => s.rows).filter((x) => x.kind === "narration");
      for (const x of all) await sv.sentenceAction(EPISODE, { action: "generate", id: x.id }, { client, ...OPTS }).catch(() => undefined);
      expect(sent.length).toBeGreaterThan(0);
      for (const t of sent) expect(t).not.toMatch(/لِلْإِنْسَانِ|سَعَىٰ|﴿/);
    });
  });
}
