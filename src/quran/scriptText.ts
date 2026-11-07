/**
 * النص القرآني اليدوي في السكريبت: مصدره ومطابقته واعتماده (الأمر 024).
 *
 * - المصدر الإنتاجي للبطاقة: النص المكتوب في السكريبت `[آية: طه 14 | النص]` كما هو حرفًا بحرف.
 *   والعلامات القديمة بلا نص تبقى مدعومة، ونصها من quran.json (إدخال صاحب القناة اليدوي في الاستوديو).
 * - المطابقة بالمصحف المعتمد: يقدّم المراجع نص المرجع وما مصدره؛ تُعرض الفروق رمزًا برمز ولا يُصحَّح شيء آليًا.
 *   ولا يُحفظ نص المرجع ولا نص الآية في سجل المراجعة: البصمات ورموز الفروق فقط.
 * - الاعتماد بشري ومستقل عن اعتماد السكريبت والستوري بورد والصوت والتلاوة، ومربوط ببصمة النص:
 *   أي تغيير في النص بعده يعيد الآية «غير معتمدة». والنسخة النهائية لا تُرندر قبل اعتماد كل آية في نطاقها.
 */
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { parseScript } from "../script/parse";
import { parseAyahRef } from "../script/quranMeta";
import { resolveScriptPath } from "../script/episodes";
import { quranPathFor } from "../plan/io";
import { alignDiff, codepoint, type CharClass } from "./audit";

export type AyahTextSource = "script" | "store";
export type EffectiveAyah = { key: string; ref: string; line: number; text: string; source: AyahTextSource; sha256: string };
export type AyahCheck = {
  textSha256: string; source: AyahTextSource; referenceSha256: string; referenceSource: string;
  checkedAt: string; checkedBy: string; status: "match" | "differs";
  /** الفروق برموز يونيكود لا بالنص: الموضع في النص اليدوي، ونوع الفرق، ورمز النص ورمز المرجع. */
  diffs: { at: number; op: "sub" | "ins" | "del"; shown: string; reference: string; cls: CharClass }[];
};
export type AyahApproval = { textSha256: string; source: AyahTextSource; referenceSha256: string; referenceSource: string; approvedBy: string; note: string; approvedAt: string };
export type AyahTextLedger = { version: 1; checks: Record<string, AyahCheck>; approvals: Record<string, AyahApproval> };
export type AyahTextState = "missing" | "unchecked" | "differs" | "stale" | "checked" | "approved";
export type AyahTextStatus = { key: string; ref: string; source: AyahTextSource | null; state: AyahTextState; reason: string; check?: AyahCheck; approval?: AyahApproval };

export const AYAH_TEXT_STATE_AR: Record<AyahTextState, string> = {
  missing: "لا نص يدوي", unchecked: "لم يُقابَل بالمصحف", differs: "يختلف عن المصحف المعتمد",
  stale: "تغيّر النص بعد المقابلة أو الاعتماد", checked: "مطابق، بانتظار الاعتماد", approved: "معتمد",
};

const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
/** ملف المراجعة بجوار السكريبت؛ بلا نص قرآني، فيُرفع إلى GitHub مع الحلقة. */
export const ayahTextLedgerFor = (scriptPath: string) => path.join(path.dirname(scriptPath), "quran-text-review.json");

const readStore = async (scriptPath: string): Promise<Record<string, string>> => {
  try {
    const v: unknown = JSON.parse(await readFile(quranPathFor(scriptPath), "utf8"));
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, string>) : {};
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw e;
  }
};

/** نصوص الآيات في السكريبت (العلامات ذات النص فقط)، بمفتاح الآية، دون أي تعديل للنص. */
export const scriptAyahTexts = (script: string, scriptPath = "script.md"): Map<string, { ref: string; text: string; line: number }> => {
  const out = new Map<string, { ref: string; text: string; line: number }>();
  for (const b of parseScript(script, scriptPath).chapters.flatMap((c) => c.blocks)) {
    if (b.kind !== "ayah" || !b.text) continue;
    const r = parseAyahRef(b.ref);
    if (r.ok && !out.has(r.ref.key)) out.set(r.ref.key, { ref: b.ref, text: b.text, line: b.line });
  }
  return out;
};

/** النص الفعّال لكل آية في السكريبت: نص السكريبت أولًا، ثم quran.json للعلامات القديمة بلا نص. */
export const effectiveAyahTexts = async (scriptPath: string, scriptText?: string): Promise<{ ayahs: EffectiveAyah[]; missing: { key: string; ref: string; line: number }[]; conflicts: string[] }> => {
  const script = scriptText ?? (await readFile(scriptPath, "utf8"));
  const store = await readStore(scriptPath);
  const ayahs: EffectiveAyah[] = [];
  const missing: { key: string; ref: string; line: number }[] = [];
  const conflicts: string[] = [];
  const seen = new Set<string>();
  for (const b of parseScript(script, scriptPath).chapters.flatMap((c) => c.blocks)) {
    if (b.kind !== "ayah") continue;
    const r = parseAyahRef(b.ref);
    if (!r.ok || seen.has(r.ref.key)) continue;
    seen.add(r.ref.key);
    const key = r.ref.key;
    const stored = store[key]?.trim() ? store[key]! : "";
    if (b.text) {
      if (stored && stored !== b.text) conflicts.push(key);
      ayahs.push({ key, ref: b.ref, line: b.line, text: b.text, source: "script", sha256: sha(b.text) });
    } else if (stored) ayahs.push({ key, ref: b.ref, line: b.line, text: stored, source: "store", sha256: sha(stored) });
    else missing.push({ key, ref: b.ref, line: b.line });
  }
  return { ayahs, missing, conflicts };
};

export const loadAyahTextLedger = async (scriptPath: string): Promise<AyahTextLedger> => {
  try {
    const v = JSON.parse(await readFile(ayahTextLedgerFor(scriptPath), "utf8")) as Partial<AyahTextLedger>;
    return { version: 1, checks: v.checks ?? {}, approvals: v.approvals ?? {} };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return { version: 1, checks: {}, approvals: {} };
    throw e;
  }
};
const saveLedger = async (scriptPath: string, ledger: AyahTextLedger) => {
  const target = ayahTextLedgerFor(scriptPath);
  const tmp = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(tmp, JSON.stringify(ledger, null, 2) + "\n", { flag: "wx" });
    await rename(tmp, target);
  } finally {
    await rm(tmp, { force: true });
  }
};

/** يقابل النص اليدوي بنص المرجع رمزًا برمز (بعد NFC فقط). لا يغيّر النص اليدوي ولا يعتمد شيئًا. */
export const compareAyahToReference = (text: string, reference: string): AyahCheck["diffs"] =>
  alignDiff(text, reference).map((d) => ({ at: d.at, op: d.op, shown: d.shown ? codepoint(d.shown) : "", reference: d.ref ? codepoint(d.ref) : "", cls: d.cls }));

/** حالة كل آية في السكريبت: نص يدوي؟ مقابلة؟ اعتماد مطابق لبصمة النص الحالي؟ */
export const ayahTextStatuses = async (scriptPath: string, scriptText?: string): Promise<AyahTextStatus[]> => {
  const { ayahs, missing } = await effectiveAyahTexts(scriptPath, scriptText);
  const ledger = await loadAyahTextLedger(scriptPath);
  const out: AyahTextStatus[] = missing.map((m) => ({ key: m.key, ref: m.ref, source: null, state: "missing" as const, reason: "اكتب نص الآية في السكريبت: [آية: المرجع | النص]." }));
  for (const a of ayahs) {
    const check = ledger.checks[a.key];
    const approval = ledger.approvals[a.key];
    let state: AyahTextState;
    let reason: string;
    if (approval && approval.textSha256 === a.sha256 && check && check.textSha256 === a.sha256 && check.status === "match") { state = "approved"; reason = `اعتمده ${approval.approvedBy}`; }
    else if (approval || (check && check.textSha256 !== a.sha256)) { state = "stale"; reason = "تغيّر نص الآية بعد مقابلته أو اعتماده؛ أعد المقابلة والاعتماد."; }
    else if (!check) { state = "unchecked"; reason = "قابل النص بالمصحف المعتمد."; }
    else if (check.status === "differs") { state = "differs"; reason = `${check.diffs.length} فرق عن المرجع؛ يُصحَّح النص يدويًا في السكريبت.`; }
    else { state = "checked"; reason = "مطابق؛ ينتظر اعتماد المراجع."; }
    out.push({ key: a.key, ref: a.ref, source: a.source, state, reason, ...(check ? { check } : {}), ...(approval ? { approval } : {}) });
  }
  return out;
};

/** يسجل مقابلة آية بنص مرجع يقدّمه المراجع. نص المرجع لا يُحفظ؛ بصمته ومصدره وفروقه فقط. */
export const checkAyahText = async (episode: string, key: string, referenceText: string, referenceSource: string, checkedBy: string): Promise<AyahCheck> => {
  if (!referenceSource?.trim()) throw Error("اذكر مصدر نص المصحف المعتمد الذي قوبل به النص.");
  if (!checkedBy?.trim()) throw Error("اذكر اسم من أجرى المقابلة.");
  if (!referenceText?.trim() || !/\p{Script=Arabic}/u.test(referenceText)) throw Error("نص المرجع فارغ أو ليس عربيًا.");
  const scriptPath = await resolveScriptPath(episode);
  const { ayahs } = await effectiveAyahTexts(scriptPath);
  const a = ayahs.find((x) => x.key === key);
  if (!a) throw Error("لا نص يدوي لهذه الآية في السكريبت؛ لا يُقابَل شيء.");
  const diffs = compareAyahToReference(a.text, referenceText);
  const check: AyahCheck = {
    textSha256: a.sha256, source: a.source, referenceSha256: sha(referenceText.normalize("NFC").trim()), referenceSource: referenceSource.trim(),
    checkedAt: new Date().toISOString(), checkedBy: checkedBy.trim(), status: diffs.length ? "differs" : "match", diffs,
  };
  const ledger = await loadAyahTextLedger(scriptPath);
  ledger.checks[key] = check;
  // مقابلة جديدة تُسقط أي اعتماد سابق لهذه الآية: الاعتماد يُعطى لنتيجة مقابلة بعينها
  delete ledger.approvals[key];
  await saveLedger(scriptPath, ledger);
  return check;
};

/** اعتماد بشري لنص آية: يُرفض إن لم يوجد نص يدوي، أو لم يُقابَل، أو اختلف عن المرجع، أو تغيّر بعد المقابلة. */
export const approveAyahText = async (episode: string, key: string, approvedBy: string, note: string): Promise<AyahApproval> => {
  if (!approvedBy?.trim()) throw Error("اذكر اسم من يعتمد نص الآية.");
  if (!note?.trim() || note.trim().length < 8) throw Error("اكتب ملاحظة المراجعة (ما الذي قوبل وبأي مصحف).");
  const scriptPath = await resolveScriptPath(episode);
  const { ayahs } = await effectiveAyahTexts(scriptPath);
  const a = ayahs.find((x) => x.key === key);
  if (!a) throw Error("لا نص يدوي لهذه الآية؛ لا يُعتمد شيء.");
  const ledger = await loadAyahTextLedger(scriptPath);
  const check = ledger.checks[key];
  if (!check) throw Error("لم يُقابَل النص بالمصحف المعتمد بعد؛ لا اعتماد قبل المقابلة.");
  if (check.textSha256 !== a.sha256) throw Error("تغيّر نص الآية بعد المقابلة؛ أعد المقابلة أولًا.");
  if (check.status !== "match") throw Error(`النص يختلف عن المرجع في ${check.diffs.length} موضع؛ صحّحه يدويًا في السكريبت ثم أعد المقابلة.`);
  const approval: AyahApproval = { textSha256: a.sha256, source: a.source, referenceSha256: check.referenceSha256, referenceSource: check.referenceSource, approvedBy: approvedBy.trim(), note: note.trim(), approvedAt: new Date().toISOString() };
  ledger.approvals[key] = approval;
  await saveLedger(scriptPath, ledger);
  return approval;
};

/** بوابة النسخة النهائية: كل آية في النطاق لها نص يدوي مقابَل ومعتمد ببصمة النص الحالي. */
export const unapprovedAyahTexts = async (scriptPath: string, keys?: Set<string>): Promise<AyahTextStatus[]> =>
  (await ayahTextStatuses(scriptPath)).filter((s) => (!keys || keys.has(s.key)) && s.state !== "approved");

/** النص الفعّال لآية واحدة (للتلاوة وبصمتها). */
export const effectiveAyahText = async (scriptPath: string, key: string): Promise<EffectiveAyah | undefined> =>
  (await effectiveAyahTexts(scriptPath)).ayahs.find((a) => a.key === key);
