/**
 * الأمر 024: النص القرآني اليدوي داخل السكريبت.
 * المصدر الإنتاجي للبطاقة هو نص السكريبت كما كتبه صاحب المشروع، ولا يستبدله quran.json ولا يُمحى عند الحفظ،
 * ولا يصل إلى الصوت المستنسخ أبدًا، ولا يُعتمد إلا بعد مقابلة مطابقة بالمصحف المعتمد، ويسقط اعتماده بتغيّره.
 */
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";

process.env.BAL_CHANNEL = "zubdat-alkutub";

const { parseScript } = await import("../src/script/parse");
const { generatePlan } = await import("../src/plan/generate");
const { loadChannel } = await import("../src/channel/index");
const { stripQuran, withQuran, VERSE_PLACEHOLDER } = await import("../src/plan/quranText");
const { writePlanFile, readPlanFile, planPathFor, quranPathFor } = await import("../src/plan/io");
const ST = await import("../src/quran/scriptText");
const { findQuranInSpeech, assertNoQuranInSpeech, quranGuardTexts, QuranInSpeechError } = await import("../src/voice/quranGuard");
const { createElevenLabs } = await import("../src/voice/elevenlabs");
const { generateVoice } = await import("../src/voice/generate");
const { ownAudioStatus, approveOwnRecitation, verifiedOwnRecitations } = await import("../src/quran/manualAudio");
const { recitationsDirFor } = await import("../src/quran/sync");
const { saveManualQuranText, inspectMissingQuranTexts } = await import("../src/quran/fillMissingText");

// نص اختبار عربي مشكول بمسافتين داخليتين؛ ليس نص آية حقيقيًا، والمهم أن يُحفظ ويُستعاد بايتًا ببايت
const VERSE = "إِنَّنِي  أَنَا الشَّاهِدُ الْأَوَّلُ لِلِاخْتِبَارِ فَاعْبُدْنِي وَأَقِمِ الْعَمَلَ";
const STORE_TEXT = "نَصٌّ مُخْتَلِفٌ فِي الْمَخْزَنِ الْمَحَلِّيِّ";
const scriptFor = (marker: string) => `---
title: "اختبار النص اليدوي"
domain: books
episode: "998"
---

## الفصل 1 · البداية

نَقْرَأُ الْيَوْمَ كِتَابًا جَدِيدًا عَنِ الصَّلَاةِ.

${marker}

## الاستشهادات

- آية | طه 14
`;

const channel = loadChannel("zubdat-alkutub");
const dirs: string[] = [];
afterAll(async () => { for (const d of dirs.splice(0)) await rm(d, { recursive: true, force: true }); });
const fresh = async (marker = `[آية: طه 14 | ${VERSE}]`, store?: Record<string, string>) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "manual-ayah-"));
  dirs.push(dir);
  const scriptPath = path.join(dir, "script.md");
  await writeFile(scriptPath, scriptFor(marker));
  if (store) await writeFile(quranPathFor(scriptPath), JSON.stringify(store));
  return scriptPath;
};
const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

describe("كتابة الآية في السكريبت وحفظها واستعادتها كما هي", () => {
  it("يستخرج المرجع والنص من العلامة دون أي تغيير في النص، والعلامة القديمة تبقى مدعومة", () => {
    const blocks = parseScript(scriptFor(`[آية: طه 14 | ${VERSE}]`)).chapters[0]!.blocks;
    const ayah = blocks.find((b) => b.kind === "ayah") as { ref: string; text?: string };
    expect(ayah.ref).toBe("طه 14");
    expect(ayah.text).toBe(VERSE);
    const legacy = parseScript(scriptFor("[آية: طه 14]")).chapters[0]!.blocks.find((b) => b.kind === "ayah") as { ref: string; text?: string };
    expect(legacy).toMatchObject({ ref: "طه 14" });
    expect(legacy.text).toBeUndefined();
  });

  it("نص السكريبت هو نص البطاقة، ولا يستبدله quran.json ولا النص البديل", () => {
    const plan = generatePlan(parseScript(scriptFor(`[آية: طه 14 | ${VERSE}]`)), null, { "20:14": STORE_TEXT }, channel);
    const card = plan.chapters.flatMap((c) => c.scenes).find((s) => s.template === "verse-card")!;
    expect(card.ayahText).toBe(VERSE);
    expect(card.props.text).toBe(VERSE);
    const merged = withQuran(stripQuran(plan), { "20:14": STORE_TEXT });
    expect(merged.chapters.flatMap((c) => c.scenes).find((s) => s.template === "verse-card")!.props.text).toBe(VERSE);
  });

  it("الحفظ ثم إعادة الفتح يعيدان النص بايتًا ببايت، ولا يمحوه الحفظ", async () => {
    const scriptPath = await fresh(undefined, { "20:14": STORE_TEXT });
    const plan = generatePlan(parseScript(await readFile(scriptPath, "utf8"), scriptPath), null, { "20:14": STORE_TEXT }, channel);
    await writePlanFile(planPathFor(scriptPath), plan);
    const onDisk = JSON.parse(await readFile(planPathFor(scriptPath), "utf8"));
    expect(onDisk.chapters.flatMap((c: { scenes: { template: string; props: { text: string } }[] }) => c.scenes).find((s: { template: string }) => s.template === "verse-card").props.text).toBe(VERSE);
    const back = (await readPlanFile(scriptPath))!;
    const card = back.chapters.flatMap((c) => c.scenes).find((s) => s.template === "verse-card")!;
    expect(Buffer.from(String(card.props.text), "utf8").equals(Buffer.from(VERSE, "utf8"))).toBe(true);
    // ومن إعادة توليد الخطة فوق خطة سابقة كذلك
    const again = generatePlan(parseScript(await readFile(scriptPath, "utf8"), scriptPath), back, { "20:14": STORE_TEXT }, channel);
    expect(again.chapters.flatMap((c) => c.scenes).find((s) => s.template === "verse-card")!.props.text).toBe(VERSE);
  });

  it("العلامة القديمة بلا نص: نص المخزن إن وُجد، وإلا النص البديل، وتبقى البطاقة غير معتمدة", async () => {
    const legacy = generatePlan(parseScript(scriptFor("[آية: طه 14]")), null, {}, channel);
    expect(legacy.chapters.flatMap((c) => c.scenes).find((s) => s.template === "verse-card")!.props.text).toBe(VERSE_PLACEHOLDER);
    const scriptPath = await fresh("[آية: طه 14]");
    const [st] = await ST.ayahTextStatuses(scriptPath);
    expect(st!.state).toBe("missing");
    expect(await ST.unapprovedAyahTexts(scriptPath)).toHaveLength(1);
  });

  it("لا يُنشأ نص موازٍ في quran.json لآية مكتوبة في السكريبت", async () => {
    const scriptPath = await fresh();
    await expect(saveManualQuranText(scriptPath, "20:14", VERSE)).rejects.toThrow(/مكتوب في السكريبت/);
    expect((await inspectMissingQuranTexts(scriptPath)).required[0]).toMatchObject({ status: "existing", source: "script" });
  });
});

describe("لا يتسرب النص القرآني إلى الصوت المستنسخ", () => {
  it("يكشف الآية كاملة أو أربع كلمات متتالية منها بعد حذف التشكيل، وعلامات المصحف دائمًا", () => {
    expect(findQuranInSpeech(`قَالَ: ${VERSE}`, [VERSE])).not.toBeNull();
    expect(findQuranInSpeech("قال الشاهد الاول للاختبار فاعبدني اليوم", [VERSE])).not.toBeNull();
    expect(findQuranInSpeech("نَقْرَأُ الْيَوْمَ كِتَابًا جَدِيدًا عَنِ الصَّلَاةِ.", [VERSE])).toBeNull();
    expect(findQuranInSpeech("ٱلْحَمْدُ", [])).not.toBeNull(); // ألف الوصل علامة رسم المصحف
  });

  it("generateVoice يرفض قبل أي طلب، حتى في الحساب التجريبي، ويشمل النص المجاور", async () => {
    const scriptPath = await fresh();
    const plan = generatePlan(parseScript(await readFile(scriptPath, "utf8"), scriptPath), null, {}, channel);
    plan.chapters[0]!.scenes.find((s) => s.narration.trim())!.narration = `وَقَالَ تَعَالَى: ${VERSE}`;
    await writePlanFile(planPathFor(scriptPath), plan);
    const tts = vi.fn();
    await expect(generateVoice(scriptPath, { dryRun: true })).rejects.toBeInstanceOf(QuranInSpeechError);
    await expect(generateVoice(scriptPath, { client: { tts } as never, force: true, ignoreStoryboard: true, ignoreTashkeel: true })).rejects.toBeInstanceOf(QuranInSpeechError);
    expect(tts).not.toHaveBeenCalled();
    expect(quranGuardTexts(plan)).toContain(VERSE);
  });

  it("عميل الصوت نفسه يرفض العيّنة والمشهد وإعادة التوليد قبل الشبكة", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ audio_base64: Buffer.from("x").toString("base64") }), { status: 200 }));
    const el = createElevenLabs({ apiKey: "test", voiceId: "v", fetchImpl: fetchImpl as never, quranGuard: [VERSE] });
    await expect(el.sample(VERSE)).rejects.toBeInstanceOf(QuranInSpeechError);
    await expect(el.tts("نص عادي", { previousText: VERSE })).rejects.toBeInstanceOf(QuranInSpeechError);
    await expect(el.tts("ٱلْحَمْدُ لِلَّهِ")).rejects.toBeInstanceOf(QuranInSpeechError);
    expect(fetchImpl).not.toHaveBeenCalled();
    await el.tts("نَقْرَأُ الْيَوْمَ كِتَابًا جَدِيدًا.");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(() => assertNoQuranInSpeech([{ label: "عيّنة", text: "كلام عادي" }], [VERSE])).not.toThrow();
  });
});

describe("المقابلة بالمصحف المعتمد واعتماد النص", () => {
  it("يعرض الفروق رموزًا، ولا يصحّح شيئًا، ويرفض اعتماد غير المطابق وغير المقابَل", async () => {
    const scriptPath = await fresh();
    await expect(ST.approveAyahText(scriptPath, "20:14", "مراجع", "قوبل بالمصحف المعتمد")).rejects.toThrow(/لم يُقابَل/);
    const wrong = VERSE.replace("الشَّاهِدُ", "الشَّاهِدِ");
    const check = await ST.checkAyahText(scriptPath, "20:14", wrong, "مصحف الاختبار", "مراجع");
    expect(check.status).toBe("differs");
    expect(check.diffs.length).toBeGreaterThan(0);
    expect(check.diffs[0]!.shown).toMatch(/^U\+[0-9A-F]{4}$/);
    // لا يُحفظ نص المرجع ولا نص الآية في سجل المراجعة، ولا يتغير السكريبت
    const ledger = await readFile(ST.ayahTextLedgerFor(scriptPath), "utf8");
    expect(ledger).not.toContain("الشَّاهِد");
    expect(await readFile(scriptPath, "utf8")).toContain(VERSE);
    await expect(ST.approveAyahText(scriptPath, "20:14", "مراجع", "قوبل بالمصحف المعتمد")).rejects.toThrow(/يختلف/);
    expect((await ST.ayahTextStatuses(scriptPath))[0]!.state).toBe("differs");
  });

  it("المطابق يُعتمد، وتغيير النص بعد الاعتماد يُبطله ويمنع النسخة النهائية حتى إعادة المقابلة", async () => {
    const scriptPath = await fresh();
    await ST.checkAyahText(scriptPath, "20:14", VERSE, "مصحف الاختبار", "مراجع");
    const a = await ST.approveAyahText(scriptPath, "20:14", "مراجع", "قوبل بالمصحف المعتمد حرفًا بحرف");
    expect(a.textSha256).toBe(sha(VERSE));
    expect(await ST.unapprovedAyahTexts(scriptPath)).toHaveLength(0);
    await writeFile(scriptPath, scriptFor(`[آية: طه 14 | ${VERSE.replace("الْعَمَلَ", "الْعَمَلْ")}]`));
    const [st] = await ST.ayahTextStatuses(scriptPath);
    expect(st!.state).toBe("stale");
    expect(await ST.unapprovedAyahTexts(scriptPath)).toHaveLength(1);
    await expect(ST.approveAyahText(scriptPath, "20:14", "مراجع", "قوبل بالمصحف المعتمد")).rejects.toThrow(/تغيّر/);
  });

  it("لا نص يدوي: لا مقابلة ولا اعتماد", async () => {
    const scriptPath = await fresh("[آية: طه 14]");
    await expect(ST.checkAyahText(scriptPath, "20:14", VERSE, "مصحف", "مراجع")).rejects.toThrow(/لا نص يدوي/);
    await expect(ST.approveAyahText(scriptPath, "20:14", "مراجع", "ملاحظة كافية")).rejects.toThrow(/لا نص يدوي/);
  });
});

describe("التلاوة: لا يظهر معتمدًا إلا ما يجتاز فحص الرندر، ولا يُفترض القارئ", () => {
  const seed = async (scriptPath: string, entry: Record<string, unknown>, bytes?: string) => {
    const dir = recitationsDirFor(scriptPath);
    await mkdir(dir, { recursive: true });
    const file = "manual-20-14-abcdef123456.mp3";
    if (bytes !== undefined) await writeFile(path.join(dir, file), bytes);
    const base = { provider: "manual", reciter: "قارئ معتمد", parts: [{ file, duration: 4 }], fetchedAt: "2026-11-07T00:00:00Z", approvedAt: "2026-11-07T00:00:00Z", approvedBy: "مراجع", sha256: sha(bytes ?? "ok"), textSha256: sha(VERSE) };
    await writeFile(path.join(dir, "index.json"), JSON.stringify({ "20:14": { ...base, ...entry } }));
  };

  it("تسجيل سليم مطابق لنص السكريبت يظهر معتمدًا", async () => {
    const scriptPath = await fresh();
    await seed(scriptPath, {}, "ok");
    const st = await ownAudioStatus(scriptPath);
    expect(Object.keys(st.approved)).toEqual(["20:14"]);
    expect(st.invalid).toEqual({});
  });

  it("الملف المفقود أو التالف أو المرفوض أو الذي تغيّر نص آيته لا يظهر معتمدًا", async () => {
    for (const [entry, bytes, reason] of [
      [{}, undefined, /مفقود/],
      [{ sha256: sha("other") }, "ok", /تلف|تغيّر/],
      [{ rejectedAt: "2026-11-07T01:00:00Z", rejectedBy: "مراجع", rejectReason: "خطأ في التلاوة" }, "ok", /مرفوض/],
      [{ textSha256: sha("نص قديم") }, "ok", /نص الآية/],
    ] as const) {
      const scriptPath = await fresh();
      await seed(scriptPath, entry as Record<string, unknown>, bytes as string | undefined);
      const st = await ownAudioStatus(scriptPath);
      expect(st.approved["20:14"], JSON.stringify(entry)).toBeUndefined();
      expect(st.invalid["20:14"]!.reason).toMatch(reason);
      expect(await verifiedOwnRecitations(scriptPath)).toEqual({});
    }
  });

  it("اعتماد التلاوة يتطلب اسم القارئ صراحةً", async () => {
    const scriptPath = await fresh();
    await expect(approveOwnRecitation(scriptPath, "20:14", "مراجع", "استمعت كاملًا وتحققت من الأداء", true, "")).rejects.toThrow(/القارئ/);
  });
});

describe("مصدر الترجمة التاريخي", () => {
  const MEANING = "I am the first witness (test).";
  it("يحفظ مصدر الترجمة السابق ما دامت الترجمة نفسها، ويقدّم المصدر المسجل معها", () => {
    const parsed = parseScript(scriptFor(`[آية: طه 14 | ${VERSE}]`));
    const first = generatePlan(parsed, null, { "20:14#meaning": MEANING }, channel);
    const card = first.chapters.flatMap((c) => c.scenes).find((s) => s.template === "verse-card")!;
    card.props.meaningSource = "Saheeh International";
    const again = generatePlan(parsed, first, { "20:14#meaning": MEANING }, channel);
    expect(again.chapters.flatMap((c) => c.scenes).find((s) => s.template === "verse-card")!.props.meaningSource).toBe("Saheeh International");
    const recorded = generatePlan(parsed, first, { "20:14#meaning": MEANING, "20:14#meaningSource": "Dr. Mustafa Khattab" }, channel);
    expect(recorded.chapters.flatMap((c) => c.scenes).find((s) => s.template === "verse-card")!.props.meaningSource).toBe("Dr. Mustafa Khattab");
    const changed = generatePlan(parsed, first, { "20:14#meaning": "A different translation." }, channel);
    expect(changed.chapters.flatMap((c) => c.scenes).find((s) => s.template === "verse-card")!.props.meaningSource).toBe("مدخل يدويًا — يحتاج مراجعة");
  });
});
