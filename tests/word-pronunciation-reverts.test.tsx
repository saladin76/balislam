/**
 * KI (15 Nov): owner report «بحاول اغير النطق ولكن يعيده الي القديم» (دفاتر الزمن 001، «ولهذا لا ننسب إليه…»).
 * The server-side contract of a word's pronunciation, in the three channels, with a fake client (no key, no network,
 * nothing paid): a new correction replaces the old one; the word as written (even bare letters) removes it and the word
 * is said automatically again (tashkeel.md), never the old correction; «ارجع للنطق الأصلي» (unfix) removes it with no
 * request and no take lost; and the field, the «يُرسل» preview, the row's «النطق» and what is sent all agree.
 * The page side (no reload over an edit, «ولّد» saves a typed «النطق» first) is checked below on the sources and in
 * tests/e2e/ui/studio-journey.mjs.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { encodeWav } from "../src/remotion/dafatir/audio/compose";
import type { ElevenLabsClient } from "../src/voice/elevenlabs";
import { currentSay, sourceLabel } from "../app/src/workspace/SentencesPanel";
import { editingInProgress, markEditing } from "../app/src/ui/editsInProgress";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WordFixPopover } from "../app/src/workspace/SentencesPanel";

const ENV = ["BAL_CHANNELS_DIR", "BAL_CHANNEL", "ELEVENLABS_MODEL_ID", "BAL_WORKFLOW_HMAC_KEY", "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"] as const;
const saved: Record<string, string | undefined> = {};
let tmp = "";
const SR = 44100;
const OPTS_T = 60_000;
// the owner's sentence, written without tashkeel as in دفاتر الزمن 001; tashkeel.md vowels «نَنْسِبُ»
const W = "ولهذا لا ننسب إليه بلدا دون دليل.";
const T = "وَلِهَذَا لَا نَنْسِبُ إِلَيْهِ بَلَدًا دُونَ دَلِيلٍ.";

const tone = (text: string) => {
  const chars = [...text];
  const lead = 0.25, step = 0.05, n = Math.round((lead + chars.length * step + 0.4) * SR);
  const s = new Float32Array(n);
  chars.forEach((c, i) => { if (/\s/.test(c)) return; for (let k = Math.round((lead + i * step) * SR); k < Math.round((lead + (i + 1) * step) * SR); k++) s[k] = Math.sin(2 * Math.PI * 160 * k / SR) * 0.3; });
  for (let k = 0; k < n; k++) if (!s[k]) s[k] = 0.0002 * Math.sin(k);
  return { wav: Buffer.from(encodeWav(s, SR)), alignment: { characters: chars, character_start_times_seconds: chars.map((_, i) => lead + i * step), character_end_times_seconds: chars.map((_, i) => lead + (i + 1) * step) } };
};
const sent: string[] = [];
const client = { modelId: "mock", tts: async (text: string) => { sent.push(text); const t = tone(text); return { audio: t.wav, alignment: t.alignment, model: "mock" }; },
  soundEffect: async () => Buffer.alloc(0), account: async () => ({}) as never, voices: async () => [] } as unknown as ElevenLabsClient;
const OPTS = { client, testOnlySkipApprovalGates: true } as const;

beforeAll(() => {
  for (const k of ENV) saved[k] = process.env[k];
  tmp = mkdtempSync(path.join(os.tmpdir(), "bal-wordpron-"));
  for (const ch of ["balislam", "dafatir-alzaman", "zubdat-alkutub"]) {
    cpSync(path.join("channels", ch), path.join(tmp, ch), { recursive: true, filter: (s) => !/[\\/]episodes([\\/]|$)/.test(s) });
    // a lexicon of our own: nothing from the real channel changes what this test expects
    writeFileSync(path.join(tmp, ch, "pronunciations.json"), JSON.stringify({ entries: [] }, null, 2));
  }
  process.env.BAL_CHANNELS_DIR = tmp;
  process.env.ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";
  process.env.BAL_WORKFLOW_HMAC_KEY = "LOCAL_TEST_ONLY__word_pron_signing_key_2026";
  delete process.env.ELEVENLABS_API_KEY;
});
afterAll(() => {
  for (const k of ENV) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

describe.each(["balislam", "dafatir-alzaman", "zubdat-alkutub"])("a word's pronunciation in %s", (ch) => {
  const EP = () => path.join(tmp, ch, "episodes", "985-word-pron");
  beforeEach(() => {
    process.env.BAL_CHANNEL = ch;
    rmSync(EP(), { recursive: true, force: true });
    mkdirSync(path.join(EP(), "voice"), { recursive: true });
    writeFileSync(path.join(EP(), "script.md"), `---\ntitle: "اختبار"\nepisode: "985"\n---\n${W}\n`);
    writeFileSync(path.join(EP(), "plan.json"), JSON.stringify({ episode: "985", title: "اختبار", tone: "calm",
      chapters: [{ number: 1, title: "x", scenes: [{ id: "c1-s1", template: "alley-tale", line: 5, narration: W, sfx: [], props: {} }] }] }, null, 2));
    writeFileSync(path.join(EP(), "tashkeel.md"), `${T}\n`);
    writeFileSync(path.join(tmp, ch, "pronunciations.json"), JSON.stringify({ entries: [] }, null, 2));
  });
  const start = async () => {
    const sv = await import("../src/voice/sentenceVoice");
    const init = await sv.sentenceAction("985", { action: "init", sceneId: "c1-s1" });
    const id = init.read.scenes[0]!.rows[0]!.id;
    await sv.sentenceAction("985", { action: "generate", id }, OPTS);
    const row = async () => (await sv.readSentences("985")).scenes[0]!.rows[0]!;
    const doc = () => JSON.parse(readFileSync(path.join(EP(), "voice", "sentences.json"), "utf8")).scenes["c1-s1"].sentences[0];
    return { sv, id, row, doc };
  };

  it("a new correction replaces the earlier one, and the field, the row and what is sent agree", async () => {
    const { sv, id, row } = await start();
    await sv.sentenceAction("985", { action: "fixword", id, word: 2, say: "نَنْسُبُ" }, OPTS);
    let w = (await row()).words[2]!;
    expect(w).toMatchObject({ sent: "نَنْسُبُ", source: "sentence", correction: "نَنْسُبُ", auto: "نَنْسِبُ" });
    expect(currentSay(w)).toBe("نَنْسُبُ");
    const r = await sv.sentenceAction("985", { action: "fixword", id, word: 2, say: "نَنْسَبُ" }, OPTS);
    expect(r.fix?.ok).toBe(true);
    expect(sent.at(-1)).toContain("نَنْسَبُ");
    w = (await row()).words[2]!;
    expect(w).toMatchObject({ sent: "نَنْسَبُ", source: "sentence", correction: "نَنْسَبُ" });
    expect(currentSay(w)).toBe("نَنْسَبُ");
    const rr = await row();
    expect(rr.spoken).toContain("نَنْسَبُ");
    expect(rr.applied).toEqual([{ word: "ننسب", say: "نَنْسَبُ" }]); // one entry: the earlier fix replaced, not kept beside it
    await sv.sentenceAction("985", { action: "generate", id, confirmSame: true }, OPTS);
    expect(sent.at(-1)).toBe("وَلِهَذَا لَا نَنْسَبُ إِلَيْهِ بَلَدًا دُونَ دَلِيلٍ.");
  }, OPTS_T);

  it("the word as written (bare letters) removes the correction: the word is said by tashkeel.md again, never the old correction", async () => {
    const { sv, id, row, doc } = await start();
    await sv.sentenceAction("985", { action: "fixword", id, word: 2, say: "نَنْسُبُ" }, OPTS);
    const r = await sv.sentenceAction("985", { action: "fixword", id, word: 2, say: "ننسب" }, OPTS);
    expect(r.fix?.ok).toBe(true);
    expect(sent.at(-1)).toBe("لَا نَنْسِبُ إِلَيْهِ"); // the fragment: tashkeel.md's form, not «ننسب» bare nor «نَنْسُبُ»
    expect(doc().corrections).toBeUndefined();
    const w = (await row()).words[2]!;
    expect(w).toMatchObject({ sent: "نَنْسِبُ", source: "tashkeel", correction: null, auto: "نَنْسِبُ" });
    expect((await row()).applied).toEqual([]);
    // and by «ولّد الجملة كاملة بهذا النطق» with the bare word
    await sv.sentenceAction("985", { action: "fixword", id, word: 2, say: "نَنْسُبُ" }, OPTS);
    await sv.sentenceAction("985", { action: "generate", id, word: 2, say: "ننسب" }, OPTS);
    expect(sent.at(-1)).toBe(T);
    expect(doc().corrections).toBeUndefined();
  }, OPTS_T);

  it("«ارجع للنطق الأصلي» (unfix) removes the correction with no request, and no take is lost", async () => {
    const { sv, id, row, doc } = await start();
    await sv.sentenceAction("985", { action: "fixword", id, word: 2, say: "نَنْسُبُ" }, OPTS);
    const takes = (doc().takes ?? []).length;
    const file = doc().audio.file;
    const calls = sent.length;
    const r = await sv.sentenceAction("985", { action: "unfix", id, word: 2 });
    expect(sent.length).toBe(calls);
    expect(r.message).toContain("أُزيل تصحيحك");
    expect(r.message).toContain("نَنْسِبُ");
    expect(doc().corrections).toBeUndefined();
    expect(doc().audio.file).toBe(file);
    expect((doc().takes ?? []).length).toBe(takes);
    expect((await row()).words[2]).toMatchObject({ sent: "نَنْسِبُ", source: "tashkeel", correction: null });
    await expect(sv.sentenceAction("985", { action: "unfix", id } as never)).rejects.toThrow(/غير صالح/);
  }, OPTS_T);

  it("precedence: the sentence «النطق» (D131) > this sentence's correction > the channel lexicon > tashkeel.md, and the row says which", async () => {
    const { sv, id, row } = await start();
    writeFileSync(path.join(tmp, ch, "pronunciations.json"), JSON.stringify({ entries: [{ word: "ننسب", say: "نَنْسُبُو", at: "" }] }, null, 2));
    let w = (await row()).words[2]!;
    expect(w).toMatchObject({ sent: "نَنْسُبُو", source: "lexicon", auto: "نَنْسُبُو" });
    expect(sourceLabel(w.source)).toContain("قاموس النطق للقناة");
    await sv.sentenceAction("985", { action: "fixword", id, word: 2, say: "نَنْسُبُ" }, OPTS);
    w = (await row()).words[2]!;
    expect(w).toMatchObject({ sent: "نَنْسُبُ", source: "sentence", correction: "نَنْسُبُ", auto: "نَنْسُبُو" });
    expect(sourceLabel(w.source)).toContain("يغلب قاموس القناة");
    const say = "وَلِهَذَا لَا نَنْسِبْ إِلَيْهِ بَلَدًا دُونَ دَلِيلٍ.";
    const s = await sv.sentenceAction("985", { action: "say", id, pronunciation: say });
    expect(s.message).toContain("حُفظ النطق");
    const rr = await row();
    expect(rr.spoken).toBe(say);
    expect(rr.say?.custom).toBe(say);
    expect(rr.words[2]!.sent).toBe("نَنْسِبْ");
    expect(rr.wordFix.ok).toBe(false); // the word popover says to edit «النطق» instead (SAY_WORD_FIX)
    await sv.sentenceAction("985", { action: "generate", id }, OPTS);
    expect(sent.at(-1)).toBe(say);
  }, OPTS_T);
});

describe("the page never takes an edit in progress", () => {
  const src = (f: string) => readFileSync(f, "utf8");
  it("an edit in progress holds the auto-sync reload; it is released when the edit ends", () => {
    expect(editingInProgress()).toBe(false);
    markEditing("sv-a", true);
    markEditing("sv-b", true);
    markEditing("sv-a", false);
    expect(editingInProgress()).toBe(true);
    markEditing("sv-b", false);
    expect(editingInProgress()).toBe(false);
    const badge = src("app/src/ui/SyncBadge.tsx");
    expect(badge).toMatch(/if \(editingInProgress\(\)\) return true;/);
    expect(badge.match(/!typing\(\)/g)?.length).toBe(2); // both reload paths go through it
  });
  it("«الجمل» marks the word popover, a typed «النطق», a text and a lexicon draft as edits in progress", () => {
    const hook = src("app/src/workspace/sentences/useSentences.ts");
    expect(hook).toContain("markEditing(owner, editingNow)");
    expect(hook).toMatch(/const editingNow = Boolean\(fixing \|\| adding \|\| editing \|\| Object\.keys\(sayDrafts\)\.some\(sayDirty\)/);
  });
  it("«ولّد» saves a typed, unsaved «النطق» first, so the generation says what the owner wrote", () => {
    const hook = src("app/src/workspace/sentences/useSentences.ts");
    expect(hook).toMatch(/cmd\.action === "generate" && cmd\.say === undefined && cmd\.id && sayDirty\(cmd\.id\)/);
    expect(hook).toContain('{ action: "say", id, pronunciation: sayDrafts[id]! }');
  });
  it("the field opens on the owner's correction; a voweled written word without one stays as written (D66); bare letters open on what is sent", () => {
    expect(currentSay({ correction: "نَنْسُبُ", sent: "نَنْسُبُ", say: "ننسب" })).toBe("نَنْسُبُ");
    expect(currentSay({ correction: null, sent: "أَوَّلُ", say: "أَوَّلَ" })).toBe("أَوَّلَ");
    expect(currentSay({ correction: null, sent: "نَنْسِبُ", say: "ننسب" })).toBe("نَنْسِبُ");
  });
  it("the «from» line sits under the field, never inside its row (a long line there squeezed the input to zero width)", () => {
    const words = [{ word: "المَصَادِرُ", say: "المَصَادِرُ", sent: "المَصَادِرِ", source: "sentence" as const, correction: "المَصَادِرِ", auto: "المَصَادِرُ", start: 0, end: 1, quran: false }];
    const noop = () => {};
    const html = renderToStaticMarkup(<WordFixPopover words={words} rowNo={1} draft={{ row: "r", index: 0, say: "المَصَادِرِ", save: false, wide: false }} busy={null} noKey={false}
      playing={false} pos={{ top: 0, left: 0, arrow: 0, sheet: false }} onDraft={noop} onClose={noop} onPlay={noop} onFix={noop} onWhole={noop} onUnfix={noop} />);
    const row = html.match(/<span class="ms-pop-inp">([\s\S]*?)<\/span>/)![1]!;
    expect(row).not.toContain("sv-fix-now");
    expect(html).toContain("النطق المستعمل حتى الآن «المَصَادِرِ» — من: تصحيحك");
    expect(html).toContain("ارجع للنطق الأصلي «المَصَادِرُ»");
  });
});
