/**
 * الصوت جملةً جملة (قرار صاحب المشروع، ٩ نوفمبر، D50): القرص والتوليد والتركيب.
 *
 * - `voice/sentences.json` بجوار index.json (محلي على جهاز المالك مثل الصوت نفسه): جمل كل مشهد بدأ المالك
 *   العمل عليه جملةً جملة، ونبرتها ووقفتها وتسجيلها. المشهد الذي لا جمل له يبقى على المسار القائم كما هو.
 * - التوليد لجملة واحدة فقط بعميل ElevenLabs القائم، مع نص الجارتين (previous_text / next_text) لاتصال الأداء.
 *   البوابات نفسها: كلمة المالك، التشكيل ≥ 98% للجملة، اعتماد الستوري بورد للمشهد، اعتماد السكريبت والستوري بورد
 *   في السجل، النبرة، المفتاح، والصوت الاحترافي المدرَّب. الصوت المستنسخ لا يتلو القرآن أبدًا: صف الآية «ارفع التلاوة».
 * - صوت المشهد = تسجيلات جمله بوقفاتها في ملف WAV واحد بكلماته بزمن المشهد، في index.json نفسه الذي يقرؤه
 *   الرندر وسجل المشاهد، فلا يتغير شيء في الرندر. علوّ الجمل يُقارب وسيطها (±6 dB)، والقمة محمية.
 * - تعديل نص جملة يكتب نص مشهدها وحده في plan.json (لا إعادة توليد للخطة أبدًا، D46)، فيعيد السجل فتح ذلك المشهد وحده.
 * - لا يُحذف تسجيل مدفوع: التسجيل السابق يبقى في takes، وملف صوت المشهد القديم يُنقل إلى voice/superseded/.
 *
 * العمل ٨: هذه الوحدة العامة (كل من يستورد «الجمل» يستورد منها)، وأفعال المالك عليها. وتحتها:
 *   sentenceContext.ts   ملفات الجمل وسياق الصوت لكل جملة؛
 *   sentenceRead.ts      نموذج القراءة؛
 *   sentenceStitch.ts    التقسيم والتركيب (بلا طلب صوت أبدًا)؛
 *   sentenceGenerate.ts  طلب الصوت المدفوع لجملة واحدة، عبر العميل الذي يمر على حارس القرآن ثم على مزوّد الصوت.
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import config from "../../config.json";
import { resolveScriptPath } from "../script/episodes";
import { planPathFor, readJson, readPlanFile, stripQuran } from "../plan/io";
import { withPlanWrite } from "../plan/planWriteLock";
import { writeJsonAtomic } from "../io/atomicJson";
import { syncScriptNarration } from "../script/narrationSync";
import type { Plan } from "../plan/types";
import type { ElevenLabsClient } from "./elevenlabs";
import { voiceDirFor, type VoiceIndex } from "./generate";
import { isTone, tones, type Tone } from "./tones";
import { normWord, stripTashkeel } from "./tashkeel";
import { coreOf, NOOP_SAY, removeLexiconEntry, sayWarnings, setLexiconEntry } from "./lexicon";
import { isNoopSay, type LexiconMatch } from "./pronunciationRules";
import { addSentenceAfter, clampPause, contextFingerprint, deleteSentence, editSentenceText, heardKey, mergeWithNext, reconcileScene, sceneNarration, sentenceStatus, splitSentence, normText, splitBasmalaInList, words, recordedText, recordedOnOtherText } from "./sentences";
import { sentencesFileFor, sentencesDirFor, writeAtomic, saveDoc, basmalaScenes, loadToneMapLite, type Ctx, loadCtx, allScenes, isNarrated, sceneSentences, voiceOf, flatten, neighbours, sayOf, autoSendOf, sendOf, SAY_WORD_FIX, wouldRepeat, SAME_SEND } from "./sentenceContext";
import { checkSentenceSay, writeSay } from "./sentencePronunciation";
import { planVerseTexts } from "./quranGuard";
import { type SentencesRead, readSentences } from "./sentenceRead";
import { sliceByWords, recomposeBasmalaScenes, composeSentenceScene, initScene, adoptSceneAudio } from "./sentenceStitch";
import { generateOne, correctionFor, withCorrection, type WordFixOutcome, fixWord } from "./sentenceGenerate";

export { sentencesFileFor, sentencesDirFor, loadSentencesDoc, sentenceManagedScenes, basmalaScenes } from "./sentenceContext";
export { readSentences } from "./sentenceRead";
export type { SentenceRow, VerseRow, SentenceScene, SentencesRead } from "./sentenceRead";
export { SENTENCE_SAMPLE_RATE, recomposeBasmalaScenes, composeSentenceScene } from "./sentenceStitch";
export type { WordFixOutcome } from "./sentenceGenerate";

// ── الأفعال ──────────────────────────────────────────────────────────────────

export type SentenceCommand = {
  action: "init" | "adopt" | "edit" | "split" | "merge" | "delete" | "add" | "tone" | "pause" | "generate" | "restore" | "heard" | "fixword" | "unfix" | "say" | "use-take";
  /** معرّف الجملة؛ أو مشهد ورقم الجملة فيه لصف لم يبدأ العمل على مشهده بعد */
  id?: string; sceneId?: string; index?: number;
  text?: string; at?: number; tone?: string | null; ms?: number; note?: string; value?: boolean;
  /**
   * «أعد نطق الكلمة» (fixword)، و«ولّد الجملة كاملة بهذا النطق» (generate مع word وsay): رقم الكلمة في الجملة،
   * ونطقها المكتوب، و«احفظ هذا النطق للقناة».
   */
  word?: number; say?: string; save?: boolean;
  /**
   * fixword: how many words on each side are re-said with the corrected word (1 by default: its two neighbours;
   * 2 under «المزيد»: two on each side, for a smoother join). Only the corrected word is spliced in.
   */
  neighbours?: 1 | 2;
  /**
   * «النطق» (say, D131): the whole sentence as it is sent to the voice, with tashkeel; null (or the automatic text)
   * goes back to the automatic pronunciation. Never the sentence's text, the plan or the script.
   */
  pronunciation?: string | null;
  /** D136 generate: the owner confirmed «لم يتغير شيء يُرسل — سيخرج تسجيل مشابه» (nothing sent changed) */
  confirmSame?: boolean;
  /** D136 use-take: the file of the take the owner chose (the current one or one in takes) */
  file?: string;
};
export type SentenceActionOptions = {
  client?: ElevenLabsClient | null;
  /**
   * للاختبارات المعزولة فقط (لا يصل إليه الخادم ولا سطر الأوامر): تجاوز بوابتي الستوري بورد والسجل.
   * كلمة المالك والتشكيل والنبرة والآية لا تُتجاوز أبدًا.
   */
  testOnlySkipApprovalGates?: boolean;
  /** D229: مانع التوليد لمشهد بعينه (استثناء صوت مشاهد محددة من تجميد القناة)؛ نص الرفض أو null */
  generateGate?: (sceneId: string) => Promise<string | null>;
};
export type SentenceActionResult = { read: SentencesRead; planChanged: boolean; composed?: { sceneId: string; composed: boolean; reason?: string }; message?: string; fix?: WordFixOutcome;
  /** D136: nothing was generated; the owner must confirm first (nothing that would be sent changed) */
  confirm?: { kind: "same-send"; message: string } };

/** يكتب نص مشهد واحد في plan.json كما هو على القرص (بلا آيات، بلا إعادة توليد للخطة أبدًا) */
const writeSceneNarration = async (scriptPath: string, sceneId: string, narration: string): Promise<boolean> => {
  const file = planPathFor(scriptPath);
  // D110: read and write under the plan write lock, as the page's save does (src/plan/planWriteLock.ts)
  return withPlanWrite(file, async () => {
    const raw = await readJson<Plan>(file);
    const scene = raw?.chapters.flatMap((c) => c.scenes).find((s) => s.id === sceneId);
    if (!raw || !scene) throw new Error("المشهد غير موجود في الخطة.");
    if (scene.template === "verse-card") throw new Error("مشهد الآية بلا تعليق؛ تلاوته تُرفع ولا تُكتب هنا.");
    if (normText(scene.narration) === narration) return false;
    const before = scene.narration;
    scene.narration = narration;
    scene.edited = true;
    await writeJsonAtomic(file, stripQuran({ ...raw, updatedAt: new Date().toISOString() }));
    // QA balislam 2: the same change in script.md when it can be placed unambiguously (else the scene is flagged).
    await syncScriptNarration(scriptPath, before, narration);
    return true;
  });
};

/**
 * فعل المالك على جملة (من الاستوديو على جهازه أو من الطرفية، بلا كلمة مرور: assertSceneOwner)؛ والأفعال على حلقة واحدة متتالية بقفل.
 */
export const sentenceAction = async (episode: string, cmd: SentenceCommand, opts: SentenceActionOptions = {}): Promise<SentenceActionResult> => {
  const { assertSceneOwner, serialized } = await import("../studio/sceneService");
  assertSceneOwner();
  const actions = ["init", "adopt", "edit", "split", "merge", "delete", "add", "tone", "pause", "generate", "restore", "heard", "fixword", "unfix", "say", "use-take"];
  if (!cmd || !actions.includes(cmd.action) || (cmd.text !== undefined && (typeof cmd.text !== "string" || cmd.text.length > 4000)) ||
      (cmd.note !== undefined && (typeof cmd.note !== "string" || cmd.note.length > 2000)) ||
      (cmd.say !== undefined && (typeof cmd.say !== "string" || cmd.say.length > 200)) || (cmd.word !== undefined && !Number.isInteger(cmd.word)) ||
      (cmd.action === "fixword" && (cmd.word === undefined || cmd.say === undefined)) || (cmd.action === "unfix" && cmd.word === undefined) ||
      (cmd.neighbours !== undefined && cmd.neighbours !== 1 && cmd.neighbours !== 2) ||
      (cmd.pronunciation !== undefined && cmd.pronunciation !== null && (typeof cmd.pronunciation !== "string" || cmd.pronunciation.length > 4000)) ||
      (cmd.action === "say" && cmd.pronunciation === undefined) ||
      (cmd.confirmSame !== undefined && typeof cmd.confirmSame !== "boolean") ||
      (cmd.action === "use-take" && (typeof cmd.file !== "string" || !cmd.file || cmd.file.length > 200)))
    throw new Error("أمر الجملة غير صالح.");
  const scriptPath = await resolveScriptPath(episode);
  await mkdir(voiceDirFor(scriptPath), { recursive: true });
  let planChanged = false;
  let composed: SentenceActionResult["composed"];
  let message: string | undefined;
  let fix: WordFixOutcome | undefined;
  let confirm: SentenceActionResult["confirm"];
  await serialized(sentencesFileFor(scriptPath), async () => {
    const ctx = await loadCtx(episode);
    const flatScenes = allScenes(ctx.plan).map((x) => x.scene);
    // الجملة المقصودة ومشهدها
    let sceneId = cmd.sceneId;
    let id = cmd.id;
    if (id && !id.startsWith("virtual-")) {
      // D97: the id the page shows is the reconciled one (a scene whose text changed after recording is
      // reconciled on every read, with stable ids), so it is looked up in the reconciled lists, not only on disk.
      sceneId = Object.entries(ctx.doc.scenes).find(([, v]) => v.sentences.some((s) => s.id === id))?.[0]
        ?? flatScenes.filter((sc) => ctx.doc.scenes[sc.id] && isNarrated(sc)).find((sc) => sceneSentences(ctx, sc).list.some((s) => s.id === id))?.id
        ?? sceneId;
    } else if (id?.startsWith("virtual-")) {
      const m = /^virtual-(.+)-(\d+)$/.exec(id);
      if (m) { sceneId = m[1]; cmd.index = Number(m[2]); id = undefined; }
    }
    const scene = flatScenes.find((s) => s.id === sceneId);
    if (!scene || !isNarrated(scene)) throw new Error("المشهد غير موجود أو بلا تعليق.");
    // المصالحة مع نص الخطة الحالي، ثم البدء إن لم يبدأ العمل على المشهد
    if (ctx.doc.scenes[scene.id]) ctx.doc.scenes[scene.id]!.sentences = reconcileScene(ctx.doc.scenes[scene.id]!.sentences, scene.id, scene.narration);
    await initScene(ctx, scene);
    const rec = ctx.doc.scenes[scene.id]!;
    if (!id && cmd.action !== "init") {
      const s = rec.sentences[Number(cmd.index)];
      if (!s) throw new Error("الجملة غير موجودة؛ حدّث الصفحة.");
      id = s.id;
    }
    let list = rec.sentences;
    const one = () => {
      const s = list.find((x) => x.id === id);
      if (!s) throw new Error("الجملة غير موجودة؛ حدّث الصفحة.");
      return s;
    };
    switch (cmd.action) {
      case "init": break;
      case "adopt": {
        // «اضغط كلمة» في مشهد صوته ملف واحد: يُقص إلى جمله «من صوت المشهد» (بلا طلب مدفوع، ولا يُركّب المشهد)
        const clip = ((await readJson<VoiceIndex>(path.join(voiceDirFor(scriptPath), "index.json"))) ?? {})[scene.id];
        if (list.every((s) => s.audio)) break;
        if (!clip || clip.sentences) throw new Error("لا صوت مشهد ملفًا واحدًا يُقص إلى جمله؛ ولّد الجملة.");
        const r = await adoptSceneAudio(ctx, scene, list, clip);
        if (!r.ok) throw new Error(r.reason);
        rec.import = { state: "imported", note: "قُصّ صوت المشهد السابق إلى جمله بتوقيت كلماته؛ الملف الأصلي كما هو." };
        message = "قُصّ صوت المشهد إلى جمله «من صوت المشهد» بلا توليد؛ صوت المشهد نفسه لم يتغير.";
        break;
      }
      case "edit": list = editSentenceText(list, id!, String(cmd.text ?? "")); break;
      case "add": list = addSentenceAfter(list, id!, String(cmd.text ?? "")).list; break;
      case "delete": list = deleteSentence(list, id!); break;
      case "merge": list = mergeWithNext(list, id!); break;
      case "split": {
        const before = one();
        const r = splitSentence(list, id!, Number(cmd.at));
        list = r.list;
        // التسجيل الحالي يُقص عند الموضع نفسه إن كان القص موثوقًا (والأصل يبقى في takes)
        const bv = voiceOf(ctx, scene, rec.sentences, before);
        if (before.audio && before.audio.fingerprint === bv.fingerprint) {
          const cut = await sliceByWords({ scriptPath, source: path.join(sentencesDirFor(scriptPath), before.audio.file), sourceWords: before.audio.words,
            duration: before.audio.duration, parts: [{ id: r.first.id, count: words(r.first.text).length }, { id: r.second.id, count: words(r.second.text).length }], tag: "split" });
          if (cut.ok) {
            const tmp = { ...ctx, doc: { ...ctx.doc, scenes: { ...ctx.doc.scenes, [scene.id]: { ...rec, sentences: list } } } };
            const flat = flatten(tmp);
            list = list.map((s) => {
              const f = cut.files.find((x) => x.id === s.id);
              if (!f) return s;
              const nb = neighbours(flat, s.id);
              return { ...s, audio: { file: f.file, fingerprint: voiceOf(ctx, scene, list, s, bv.olderTone ? { version: bv.presetVersion } : {}).fingerprint, context: contextFingerprint(nb.previousText, nb.nextText),
                duration: f.duration, words: f.words, at: new Date().toISOString(), origin: "split" as const, ...(before.audio!.tone ? { tone: before.audio!.tone } : {}) } };
            });
          } else message = `قُسمت الجملة؛ ولم يُقص تسجيلها (${cut.reason})، فتحتاج الجملتان توليدًا.`;
        }
        break;
      }
      case "pause": list = list.map((s) => (s.id === one().id ? { ...s, pauseAfterMs: clampPause(cmd.ms) } : s)); break;
      case "heard": list = list.map((s) => (s.id === one().id ? { ...s, heard: cmd.value === false || !s.audio ? undefined : heardKey(s.audio) } : s)); break;
      case "restore": {
        const s = one();
        const prev = s.takes?.[s.takes.length - 1];
        if (!prev) throw new Error("لا تسجيل سابق لهذه الجملة.");
        // D136: the owner chose this take himself, so it is the sentence's take (and its scene audio's) as it is
        list = list.map((x) => (x.id === s.id ? { ...x, audio: prev, takes: [...(x.takes ?? []).slice(0, -1), ...(x.audio ? [x.audio] : [])], heard: undefined, chosen: prev.file } : x));
        message = "رجعت الجملة إلى تسجيلها السابق كما اخترت؛ يدخل صوت المشهد هو، والتسجيل الآخر محفوظ.";
        break;
      }
      case "use-take": {
        // D136 «استعمل هذا التسجيل» (قارن: القديم / الجديد): the owner's choice of take, kept as the current one
        const s = one();
        if (s.kind !== "narration") throw new Error("هذه الجملة لا تسجيل مولَّد لها.");
        if (s.audio?.file === cmd.file) {
          list = list.map((x) => (x.id === s.id ? { ...x, chosen: cmd.file } : x));
          message = "هذا التسجيل هو المستعمل؛ يدخل صوت المشهد كما هو.";
          break;
        }
        const k = (s.takes ?? []).findIndex((t) => t.file === cmd.file);
        if (k < 0) throw new Error("التسجيل غير موجود في تسجيلات هذه الجملة؛ حدّث الصفحة.");
        const pick = s.takes![k]!;
        if (recordedOnOtherText({ text: s.text, audio: pick })) throw new Error("هذا التسجيل سُجّل على نص سابق للجملة؛ لا يُستعمل لنصها الحالي.");
        const rest = s.takes!.filter((_, i) => i !== k);
        list = list.map((x) => (x.id === s.id ? { ...x, audio: pick, takes: [...rest, ...(x.audio ? [x.audio] : [])], heard: undefined, chosen: pick.file } : x));
        message = "استُعمل التسجيل الذي اخترته؛ يدخل صوت المشهد هو، والتسجيل الآخر محفوظ.";
        break;
      }
      case "tone": {
        const s = one();
        const tone = cmd.tone === null || cmd.tone === "" || cmd.tone === undefined ? null : cmd.tone;
        if (tone !== null && !isTone(tone)) throw new Error("النبرة المختارة غير معروفة.");
        if (ctx.map) {
          // خريطة النبرة (دفاتر الزمن): إصدار جديد للجملة وحدها (D41)، والخريطة سجل القرار
          const { writeSentenceToneOverride } = await import("./toneMapOverride");
          const v = await writeSentenceToneOverride(scriptPath, { scene: scene.id, sentence: s.id, text: s.text, tone, note: String(cmd.note ?? ""), at: new Date().toISOString() });
          if (v) message = `حُدّثت خريطة النبرة إلى ${v} لهذه الجملة وحدها.`;
          ctx.map = await loadToneMapLite(scriptPath);
        } else list = list.map((x) => (x.id === s.id ? { ...x, tone: (tone ?? undefined) as Tone | undefined } : x));
        // D136: a new tone for this sentence is the owner's new choice: a take chosen before it no longer stands in
        list = list.map((x) => (x.id === s.id && x.chosen ? { ...x, chosen: undefined } : x));
        break;
      }
      case "unfix": {
        // «ارجع للنطق الأصلي» (KI, 15 Nov): the owner's correction of this word in this sentence is removed; the word is
        // sent automatically again (tashkeel.md, then the channel lexicon). Nothing is generated; no take is deleted.
        const s = one();
        const i = Number(cmd.word);
        const ws = words(s.text);
        if (!(i >= 0 && i < ws.length)) throw new Error("الكلمة غير موجودة في الجملة؛ حدّث الصفحة.");
        const had = (s.corrections ?? []).some((x) => x.index === i);
        const rest = (s.corrections ?? []).filter((x) => x.index !== i);
        list = list.map((x) => (x.id === s.id ? { ...x, corrections: rest.length ? rest : undefined } : x));
        const auto = coreOf(sendOf(ctx, { ...s, corrections: rest }).perWord[i] || ws[i]!) || ws[i]!;
        message = had
          ? `أُزيل تصحيحك لـ«${coreOf(ws[i]!)}» في هذه الجملة؛ يُرسل لها الآن «${auto}». التسجيل الحالي كما هو: «أعد نطق الكلمة» أو «ولّد الجملة» ليُسمع.`
          : `لا تصحيح لـ«${coreOf(ws[i]!)}» في هذه الجملة؛ يُرسل لها «${auto}».`;
        break;
      }
      case "say": {
        // D131 «النطق»: the owner's pronunciation of the whole sentence (owner content, D101). Nothing is generated.
        const s = one();
        if (s.kind === "basmala") throw new Error("البسملة يسجلها صاحب القناة بصوته؛ لا نطق لها يُرسل إلى الصوت المستنسخ.");
        if (s.kind !== "narration") throw new Error("نص قرآني: لا يُرسل إلى الصوت المستنسخ أبدًا، فلا نطق له يُعدَّل.");
        const auto = autoSendOf(ctx, s).text;
        const p = cmd.pronunciation === null ? null : normText(String(cmd.pronunciation));
        if (p !== null && p !== auto) {
          const bad = checkSentenceSay(p, planVerseTexts(ctx.plan));
          if (bad) throw new Error(bad);
        }
        const had = Boolean(sayOf(ctx, s));
        if (p === null || p === auto) {
          if (had) ctx.says = await writeSay(scriptPath, scene.id, s.text, null);
          message = had ? "عاد النطق الآلي لهذه الجملة؛ نصها والترجمة كما هما." : "النطق كما هو (آلي)؛ لم يتغير شيء.";
        } else {
          ctx.says = await writeSay(scriptPath, scene.id, s.text, p);
          list = list.map((x) => (x.id === s.id && x.chosen ? { ...x, chosen: undefined } : x));
          message = "حُفظ النطق لهذه الجملة وحدها؛ نصها والسكريبت والترجمة كما هي. تحتاج توليدًا جديدًا («ولّد الجملة»)، ولا يُولَّد شيء وحده.";
        }
        break;
      }
      case "generate": {
        const gate = opts.generateGate ? await opts.generateGate(scene.id) : null;
        if (gate) throw new Error(gate);
        let s = one();
        // «ولّد الجملة كاملة بهذا النطق»: التصحيح يُحفظ مع الجملة (ولقاموس القناة إن طُلب) ثم تُولَّد كاملة
        if (cmd.say !== undefined && sayOf(ctx, s)) throw new Error(SAY_WORD_FIX);
        const c = cmd.say !== undefined ? correctionFor(s, cmd.word, cmd.say) : null;
        if (c && cmd.save && isNoopSay(c.word, c.say)) throw new Error(NOOP_SAY);
        if (c) { s = withCorrection(s, c); list = list.map((x) => (x.id === s.id ? s : x)); }
        // D136: nothing that would be sent changed (text, pronunciation, tone direction, stability, seed policy,
        // neighbours): no paid call before the owner confirms; a confirmed one varies the seed (generateOne).
        if (!c && !cmd.confirmSame && wouldRepeat(ctx, scene, list, s)) {
          confirm = { kind: "same-send", message: `${SAME_SEND}. تُولَّد من جديد ببذرة أخرى إن أكّدت (يصرف رصيدًا)، والتسجيل الحالي يبقى محفوظًا.` };
          break;
        }
        list = await generateOne(ctx, episode, scene, list, s, opts);
        if (c && cmd.save) {
          await setLexiconEntry(c.word, c.say);
          message = [`حُفظ نطق «${coreOf(c.word)}» في قاموس النطق للقناة؛ يسري على كل توليد قادم.`, ...sayWarnings(c.word, c.say)].join(" ");
        }
        break;
      }
      case "fixword": {
        const fixGate = opts.generateGate ? await opts.generateGate(scene.id) : null;
        if (fixGate) throw new Error(fixGate);
        const s = one();
        const c = correctionFor(s, cmd.word, cmd.say);
        if (cmd.save && isNoopSay(c.word, c.say)) throw new Error(NOOP_SAY);
        const r = await fixWord(ctx, episode, scene, list, s, c, { ...opts, neighbours: cmd.neighbours });
        list = r.list;
        fix = r.outcome;
        if (r.outcome.ok && cmd.save) {
          await setLexiconEntry(c.word, c.say);
          fix.savedToLexicon = true;
        }
        message = r.outcome.ok
          ? [`أُعيد نطق «${coreOf(c.word)}» وحده؛ التسجيل السابق محفوظ في «ارجع إلى التسجيل السابق».${fix.savedToLexicon ? " وحُفظ نطقها في قاموس النطق للقناة." : ""}`,
            ...(fix.savedToLexicon ? sayWarnings(c.word, c.say) : [])].join(" ")
          : "لم يندمج بشكل طبيعي — جرّب نطقًا آخر أو ولّد الجملة";
        break;
      }
    }
    // A sentence edited (or added) to hold the basmala with narration is split at once (owner, 10 Nov).
    if (["edit", "add", "merge"].includes(cmd.action)) list = splitBasmalaInList(list);
    rec.sentences = list;
    const narration = sceneNarration(list);
    if (["edit", "add", "delete", "merge", "split"].includes(cmd.action))
      planChanged = await writeSceneNarration(scriptPath, scene.id, narration);
    if (planChanged) {
      const p = await readPlanFile(scriptPath);
      if (p) ctx.plan = p;
    }
    const current = allScenes(ctx.plan).map((x) => x.scene).find((s) => s.id === scene.id)!;
    // صوت المشهد يُركّب من جمله حين تكون كلها حالية (وإلا يبقى صوته السابق كما هو)؛ وصل لم يُطبَّق لا يغيّر شيئًا
    if (cmd.action !== "init" && cmd.action !== "adopt" && cmd.action !== "heard" && !(cmd.action === "fixword" && !fix?.ok) && !confirm) {
      const c = await composeSentenceScene(ctx, current, list);
      composed = { sceneId: scene.id, ...c };
    }
    await saveDoc(scriptPath, ctx.doc);
  });
  return { read: await readSentences(episode), planChanged, ...(composed ? { composed } : {}), ...(message ? { message } : {}), ...(fix ? { fix } : {}), ...(confirm ? { confirm } : {}) };
};

export type ToneImpact = {
  tone: string | null;
  /** D136: the scope asked about (a scene id, or null for the whole episode) */
  sceneId?: string | null;
  /**
   * D136: narration sentences in the scope (without a tone of their own) whose current take was recorded with
   * another tone: they are heard with the new tone only once generated again (paid, by the owner's click).
   * `missing`: sentences in the scope with no take yet. chars/credits: what generating `regenerate` would spend.
   */
  regenerate?: { ids: { id: string; sceneId: string }[]; chars: number; credits: number; missing: number };
  /** sentences that are current now and would need a new (paid) generation under this episode tone */
  sentences: { id: string; sceneId: string }[];
  /** whole-scene voices (not sentence by sentence) that would need a new generation */
  scenes: string[];
};
/**
 * D97: what choosing (or clearing) the episode tone would invalidate, BEFORE it is applied: the studio shows
 * «سيحتاج N جملة توليدًا جديدًا» and asks. Read only: nothing is written, generated or sent.
 * Takes recorded with a known tone keep it (voiceOf pins them), so only takes made under the channel layer whose
 * sound the chosen tone really changes are counted.
 */
export const toneChangeImpact = async (episode: string, tone: string | null, scope: { sceneId?: string | null } = {}): Promise<ToneImpact> => {
  if (tone !== null && !isTone(tone)) throw new Error("النبرة المختارة غير معروفة.");
  const ctx = await loadCtx(episode);
  const sceneId = scope.sceneId ?? null;
  if (sceneId && !allScenes(ctx.plan).some((x) => x.scene.id === sceneId)) throw new Error("المشهد غير موجود في الخطة.");
  const nextPlan: Plan = sceneId
    ? { ...ctx.plan, chapters: ctx.plan.chapters.map((c) => ({ ...c, scenes: c.scenes.map((x) => (x.id === sceneId ? { ...x, tone: tone ?? undefined } : x)) })) }
    : { ...ctx.plan, tone: tone ?? undefined };
  const after: Ctx = { ...ctx, plan: nextPlan };
  const sentences: ToneImpact["sentences"] = [];
  const regen: { id: string; sceneId: string; chars: number }[] = [];
  let missing = 0;
  if (!ctx.map) for (const { scene } of allScenes(nextPlan)) {
    if (sceneId && scene.id !== sceneId) continue;
    if (!isNarrated(scene)) continue;
    const { list } = sceneSentences(after, scene);
    for (const s of list) {
      if (s.kind !== "narration") continue;
      const v = voiceOf(after, scene, list, s, { current: true });
      if (!s.audio) { missing++; continue; }
      if (v.toneInfo.explicit || recordedOnOtherText(s)) continue;
      if (s.audio.tone !== v.tone) regen.push({ id: s.id, sceneId: scene.id, chars: v.send.text.length });
    }
  }
  const chars = regen.reduce((n, x) => n + x.chars, 0);
  const regenerate = { ids: regen.map(({ id, sceneId: sc }) => ({ id, sceneId: sc })), chars, credits: Math.ceil(chars * config.voice.creditsPerChar), missing };
  if (!ctx.map) for (const { scene } of allScenes(ctx.plan)) {
    if (sceneId && scene.id !== sceneId) continue;
    if (!isNarrated(scene) || !ctx.doc.scenes[scene.id]) continue;
    const { list } = sceneSentences(ctx, scene);
    for (const s of list) {
      if (s.kind !== "narration" || !s.audio) continue;
      const now = sentenceStatus(s, voiceOf(ctx, scene, list, s).fingerprint);
      if (now !== "generated" && now !== "heard") continue;
      const later = sentenceStatus(s, voiceOf(after, scene, list, s).fingerprint);
      if (later !== "generated" && later !== "heard") sentences.push({ id: s.id, sceneId: scene.id });
    }
  }
  const { sceneVoiceToneImpact } = await import("./generate");
  const scenes = (await sceneVoiceToneImpact(ctx.scriptPath, ctx.plan, nextPlan)).filter((id) => !sceneId || id === sceneId);
  return { tone, sceneId, sentences, scenes, regenerate };
};

/**
 * D136: the tone of a whole scene or of the whole episode, from «الجمل» (after its count and cost were shown).
 * Writes plan.json under the plan write lock (the scene's or the episode's tone only). Nothing is generated: the
 * sentences it changes show «النبرة تغيّرت — اضغط ولّد لتسمع الجديد», and «ولّد» stays the owner's click.
 * A tone map episode (دفاتر الزمن) takes its tones from the map: refused here, sentence by sentence there.
 */
export const setToneScope = async (episode: string, cmd: { sceneId?: string | null; tone?: string | null }): Promise<{ read: SentencesRead; planChanged: boolean }> => {
  const { assertSceneOwner } = await import("../studio/sceneService");
  assertSceneOwner();
  const tone = cmd?.tone === null || cmd?.tone === "" || cmd?.tone === undefined ? null : cmd.tone;
  if (tone !== null && !isTone(tone)) throw new Error("النبرة المختارة غير معروفة.");
  if (cmd?.sceneId !== undefined && cmd.sceneId !== null && (typeof cmd.sceneId !== "string" || !/^[a-z0-9][a-z0-9-]{0,70}$/.test(cmd.sceneId)))
    throw new Error("أمر النبرة غير صالح.");
  const scriptPath = await resolveScriptPath(episode);
  if (await loadToneMapLite(scriptPath)) throw new Error("نبرات هذه الحلقة من خريطة النبرة: غيّر نبرة الجملة نفسها، فتُكتب في إصدار جديد من الخريطة.");
  const file = planPathFor(scriptPath);
  const planChanged = await withPlanWrite(file, async () => {
    const raw = await readJson<Plan>(file);
    if (!raw) throw new Error("خطة الحلقة غير موجودة.");
    if (cmd.sceneId) {
      const scene = raw.chapters.flatMap((c) => c.scenes).find((x) => x.id === cmd.sceneId);
      if (!scene || !isNarrated(scene)) throw new Error("المشهد غير موجود أو بلا تعليق.");
      if ((scene.tone ?? null) === tone) return false;
      if (tone) scene.tone = tone; else delete scene.tone;
      scene.edited = true;
    } else {
      if ((raw.tone ?? null) === tone) return false;
      if (tone) raw.tone = tone; else delete raw.tone;
    }
    await writeJsonAtomic(file, stripQuran({ ...raw, updatedAt: new Date().toISOString() }));
    return true;
  });
  return { read: await readSentences(episode), planChanged };
};

export type SentencesRepair = {
  file: string;
  /** scenes whose saved sentences were behind the plan text (reconciled now, with stable ids) */
  reconciled: string[];
  /** old takes the earlier reconcile had parked on a scene's first sentence, put back on the sentence they belong to («قديم») */
  restored: { sceneId: string; sentenceId: string; file: string }[];
  written: boolean;
  backup: string | null;
};
const plainWords = (t: string) => new Set(words(stripTashkeel(t)).map(normWord).filter(Boolean));
const overlap = (a: string, b: string) => {
  const x = plainWords(a), y = plainWords(b);
  let n = 0;
  for (const w of x) if (y.has(w)) n++;
  return x.size + y.size - n ? n / (x.size + y.size - n) : 0;
};
/**
 * D97 one-time repair of voice/sentences.json (owner's Mac, after remap-scene-ids --with-changed-text):
 * 1) every saved scene whose text changed is reconciled with the plan once and saved (stable ids; changed sentences
 *    keep their old take as «قديم»);
 * 2) takes the earlier reconcile parked on the scene's first sentence (recorded on another sentence's text) are put
 *    back as the «قديم» take of the sentence without audio whose text is closest (≥ 30% shared words).
 * Preview by default; `apply` writes after a backup (sentences.before-repair.json). Nothing is deleted or generated.
 */
export const repairSentences = async (episode: string, o: { apply?: boolean } = {}): Promise<SentencesRepair> => {
  const { serialized } = await import("../studio/sceneService");
  const scriptPath = await resolveScriptPath(episode);
  const file = sentencesFileFor(scriptPath);
  const out: SentencesRepair = { file, reconciled: [], restored: [], written: false, backup: null };
  if (o.apply) (await import("../studio/sceneService")).assertSceneOwner();
  if (!existsSync(file)) return out;
  await serialized(file, async () => {
    const ctx = await loadCtx(episode);
    for (const { scene } of allScenes(ctx.plan)) {
      const rec = ctx.doc.scenes[scene.id];
      if (!rec || !isNarrated(scene)) continue;
      const list = reconcileScene(rec.sentences, scene.id, scene.narration).map((x) => ({ ...x }));
      if (list !== rec.sentences && sceneNarration(rec.sentences) !== normText(scene.narration)) out.reconciled.push(scene.id);
      const head = list[0];
      const parked = (head?.takes ?? []).filter((t) => { const r = recordedText(t); return r !== null && normText(r) !== normText(head!.text) && !list.some((x) => normText(x.text) === normText(r)); });
      for (const t of parked) {
        const target = list.filter((x) => x.kind === "narration" && !x.audio)
          .map((x) => ({ x, score: overlap(recordedText(t)!, x.text) })).sort((a, z) => z.score - a.score)[0];
        if (!target || target.score < 0.3) continue;
        target.x.audio = t;
        head!.takes = head!.takes!.filter((y) => y !== t);
        out.restored.push({ sceneId: scene.id, sentenceId: target.x.id, file: t.file });
      }
      if (head && !head.takes?.length) delete head.takes;
      rec.sentences = list;
    }
    if (o.apply && (out.reconciled.length || out.restored.length)) {
      const backup = path.join(path.dirname(file), "sentences.before-repair.json");
      if (!existsSync(backup)) await writeAtomic(backup, await readFile(file));
      out.backup = backup;
      await saveDoc(scriptPath, ctx.doc);
      out.written = true;
    }
  });
  return out;
};

export type LexiconCommand = { op: "set" | "remove"; word: string; say?: string; note?: string; match?: LexiconMatch };
/** «قاموس النطق» في «أدوات وتفاصيل»: تعديل كلمة أو حذفها (المالك على جهازه). لا يُبطل تسجيلًا قائمًا. */
export const lexiconAction = async (episode: string, cmd: LexiconCommand): Promise<SentencesRead> => {
  const { assertSceneOwner } = await import("../studio/sceneService");
  assertSceneOwner();
  if (!cmd || (cmd.op !== "set" && cmd.op !== "remove") || typeof cmd.word !== "string" || cmd.word.length > 80 ||
      (cmd.say !== undefined && (typeof cmd.say !== "string" || cmd.say.length > 200)) || (cmd.note !== undefined && typeof cmd.note !== "string") ||
      (cmd.match !== undefined && cmd.match !== "exact" && cmd.match !== "letters"))
    throw new Error("أمر قاموس النطق غير صالح.");
  if (cmd.op === "set") await setLexiconEntry(cmd.word, String(cmd.say ?? ""), cmd.note, undefined, cmd.match);
  else await removeLexiconEntry(cmd.word);
  return readSentences(episode);
};

/** أسماء النبرات للعرض */
export const toneNames = Object.fromEntries(Object.entries(tones).map(([k, v]) => [k, v.nameAr]));

/**
 * «جهّز كل المشاهد» for the scenes holding the basmala (owner decision 10 Nov): their split is saved, each
 * narration sentence without a current take is voiced through the same sentence gates (tashkeel, approvals,
 * tone, the Quran guard), and the scene is composed with the owner's recording or its marked placeholder.
 * The basmala itself is never sent to the voice. Returns what was voiced and what could not be, per scene.
 */
export const prepareBasmalaScenes = async (episode: string, opts: { client: ElevenLabsClient | null; shouldStop?: () => boolean; /** the scenes the owner confirmed */ only?: Set<string> }) => {
  const scriptPath = await resolveScriptPath(episode);
  const all = await basmalaScenes(scriptPath);
  const ids = opts.only ? all.filter((id) => opts.only!.has(id)) : all;
  const out = { generated: 0, errors: [] as { id: string; error: string }[] };
  if (!all.length) return out;
  await recomposeBasmalaScenes(episode);
  if (!opts.client) return out;
  for (const sceneId of ids) {
    const read = await readSentences(episode);
    const scene = read.scenes.find((x) => x.id === sceneId);
    for (const row of scene?.rows ?? []) {
      if (opts.shouldStop?.()) return out;
      if (row.kind !== "narration" || row.status === "generated" || row.status === "heard") continue;
      try {
        await sentenceAction(episode, { action: "generate", id: row.id }, { client: opts.client });
        out.generated++;
      } catch (e) {
        out.errors.push({ id: sceneId, error: (e as Error).message });
        break;
      }
    }
  }
  return out;
};

/**
 * M5 (funnel QA, 10 Nov): «أعد توليد الصوت» in the dock for a scene voiced sentence by sentence regenerates
 * EVERY narration sentence of that scene through the sentence path (same gates; the basmala and verses are
 * never voiced), then the scene is composed from them. Old takes are kept (never deleted).
 */
export const regenerateSceneSentences = async (episode: string, sceneId: string, opts: { client: ElevenLabsClient | null; confirmSame?: boolean } & Pick<SentenceActionOptions, "testOnlySkipApprovalGates">) => {
  await sentenceAction(episode, { action: "init", sceneId });
  let read = await readSentences(episode);
  const rows = read.scenes.find((x) => x.id === sceneId)?.rows ?? [];
  // D136: sentences whose request would be exactly the one that made their take: the owner confirms first
  const same = rows.filter((r) => r.kind === "narration" && r.wouldRepeat).length;
  if (same && !opts.confirmSame)
    return { generated: 0, composed: undefined, read, confirm: { kind: "same-send" as const, count: same,
      message: `${SAME_SEND}: ${same === rows.filter((r) => r.kind === "narration").length ? "كل جمل هذا المشهد" : `${same.toLocaleString("ar-EG")} من جمل هذا المشهد`} بالنص والنطق والنبرة نفسها. تُولَّد من جديد ببذرة أخرى إن أكّدت (يصرف رصيدًا).` } };
  let generated = 0;
  let composed: SentenceActionResult["composed"];
  for (const row of rows) {
    if (row.kind !== "narration") continue;
    const r = await sentenceAction(episode, { action: "generate", id: row.id, confirmSame: true }, { client: opts.client, testOnlySkipApprovalGates: opts.testOnlySkipApprovalGates });
    generated++;
    read = r.read;
    composed = r.composed ?? composed;
  }
  if (!generated) throw new Error("لا جمل للراوي في هذا المشهد؛ البسملة والآيات تُرفع بتسجيلك ولا تُولَّد.");
  return { generated, composed, read, confirm: undefined };
};
