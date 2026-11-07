/**
 * سجل التوثيق والاعتماد لكل حلقة (review.json بجوار السكريبت).
 * كل استشهاد في قسم «## الاستشهادات» (آية، حديث، مصدر، كتاب برقم صفحته…) له حالة مراجعة:
 * بانتظار المراجعة ← موثّق أو مرفوض، مع ملاحظة المراجع وتاريخها.
 * الاعتماد مربوط ببصمة نص الاستشهاد (ونص الحديث في التعليق): إن تغيّر بعد الاعتماد عاد «تغيّر بعد الاعتماد».
 * الفحص البرمجي للصيغ والدرجات لا يغني عن هذه المراجعة، ولا يُولَّد صوت قبل اكتمالها.
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { lstat, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import config from "../../config.json";
import { normalizeArabic, parseAyahRef } from "./quranMeta";
import { quranFromScript } from "../quran/scriptText";
import type { ParsedScript } from "./types";

export type ReviewStatus = "pending" | "changed" | "verified" | "rejected";
export type ReviewEntry = { hash: string; status: "verified" | "rejected"; reviewer?: string; note?: string; at: string; ref: string };
export type ReviewLedger = { version: 1; items: Record<string, ReviewEntry> };
export type ReviewItem = {
  key: string;
  kind: "ayah" | "hadith" | "other";
  /** نوع الاستشهاد كما كُتب: آية، حديث، مصدر، كتاب… */
  label: string;
  ref: string;
  /** بقية الحقول (الدرجة، الصفحة، مصدر التحقق…) */
  detail: string;
  /** نص الحديث كما في التعليق، إن وُجد */
  text?: string;
  line: number;
  hash: string;
  status: ReviewStatus;
  note?: string;
  at?: string;
  reviewer?: string;
};
export type ReviewSummary = { total: number; verified: number; pending: number; changed: number; rejected: number; ok: boolean };

export const REVIEW = { required: true, ...((config as { review?: { required?: boolean } }).review ?? {}) };
export const reviewFileFor = (scriptPath: string) => path.join(path.dirname(scriptPath), "review.json");

const norm = (s: string) => normalizeArabic(s).replace(/\s+/g, " ").trim();
const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

export const reviewItems = (script: ParsedScript, ledger: ReviewLedger | null): ReviewItem[] => {
  // نصوص الأحاديث في التعليق: [حديث: المرجع | النص | الراوي]
  const ayahTexts = quranFromScript(script).texts;
  const hadithText = new Map<string, string>();
  for (const ch of script.chapters)
    for (const b of ch.blocks) if (b.kind === "hadith" && b.text) hadithText.set(norm(b.ref), [b.text, b.narrator ?? ""].join(" | "));
  const seen = new Map<string, number>();
  return script.citations.map((c) => {
    const label = c.raw.replace(/^\s*[-*]\s*/, "").split("|")[0]!.trim();
    const ref = (c.fields[0] ?? "").trim();
    const base = `${c.kind}:${norm(label)}:${norm(ref)}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const key = n > 1 ? `${base}#${n}` : base;
    const text = c.kind === "hadith" ? hadithText.get(norm(ref)) : undefined;
    const ayah = c.kind === "ayah" ? parseAyahRef(ref) : null;
    const sourceText = ayah?.ok ? (ayahTexts[ayah.ref.key] ?? "") : "";
    // Exact tashkeel and Quranic markers must invalidate prior human review.
    const hash = sha([c.raw, text ?? "", c.kind === "ayah" ? sourceText : ""].join("\n"));
    const e = ledger?.items[key];
    // Legacy status without a named reviewer/note is historical evidence only;
    // it is NOT a current approval and must be explicitly re-reviewed.
    const hasHumanProof = Boolean(e && e.status === "verified" || e?.status === "rejected");
    const hasValidHumanProof = hasHumanProof && typeof e?.reviewer === "string" &&
      e.reviewer.trim().length >= 2 && typeof e.note === "string" &&
      e.note.trim().length >= 12 && typeof e.at === "string" &&
      Number.isFinite(Date.parse(e.at)) && Date.parse(e.at) <= Date.now() + 60000;
    const status: ReviewStatus = !e ? "pending" : e.hash !== hash ? "changed" :
      hasValidHumanProof ? e.status : "pending";
    return { key, kind: c.kind, label, ref, detail: c.fields.slice(1).join(" | "), text, line: c.line, hash, status, note: e?.note, at: e?.at, reviewer: e?.reviewer };
  });
};

export const reviewSummary = (items: ReviewItem[]): ReviewSummary => {
  const count = (s: ReviewStatus) => items.filter((i) => i.status === s).length;
  const verified = count("verified");
  return { total: items.length, verified, pending: count("pending"), changed: count("changed"), rejected: count("rejected"), ok: !REVIEW.required || verified === items.length };
};

export const loadLedger = async (scriptPath: string): Promise<ReviewLedger> => {
  const f = reviewFileFor(scriptPath);
  if (!existsSync(f)) return { version: 1, items: {} };
  try {
    if (!(await lstat(f)).isFile()) throw new Error("سجل التوثيق يجب أن يكون ملفًا محليًا عاديًا.");
    const j = JSON.parse(await readFile(f, "utf8")) as ReviewLedger;
    if (j?.version !== 1 || !j.items || typeof j.items !== "object" || Array.isArray(j.items))
      throw new Error("صيغة سجل التوثيق التاريخي غير صالحة.");
    return { version: 1, items: j.items };
  } catch (error) {
    // Do not erase historical reviewer evidence on malformed JSON or permission
    // errors: the operator must repair the file intentionally.
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return { version: 1, items: {} };
    throw new Error("تعذّر قراءة سجل التوثيق التاريخي؛ لم يُستبدل أو يُحذف.", { cause: error });
  }
};

/** يسجل قرار المراجع على الاستشهاد بحالته الحالية (البصمة الحالية). */
export const setReview = async (
  scriptPath: string, script: ParsedScript, key: string,
  status: "verified" | "rejected" | "pending", note = "",
  reviewer = "", confirmed = false,
): Promise<ReviewItem[]> => {
  const target = reviewFileFor(scriptPath);
  const lockFile = target + ".lock";
  // One ledger transaction at a time. A concurrent reviewer must retry and
  // evaluate the current record, never overwrite another human decision.
  const lock = await open(lockFile, "wx", 0o600).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "EEXIST")
      throw new Error("هناك قرار مراجعة آخر قيد الحفظ؛ أعد المحاولة بعد انتهائه.");
    throw error;
  });
  try {
    const ledger = await loadLedger(scriptPath);
    const item = reviewItems(script, ledger).find((entry) => entry.key === key);
    if (!item) throw new Error("الاستشهاد غير موجود في السكريبت الحالي؛ احفظ السكريبت ثم أعد المحاولة.");
    // Re-evaluate the live script for all changes including an explicit revoke.
    const liveScript = await readFile(scriptPath, "utf8");
    const current = (await import("./parse")).parseScript(liveScript, scriptPath);
    const liveItems = reviewItems(current, null);
    if (liveItems.find((entry) => entry.key === key)?.hash !== item.hash)
      throw new Error("تغير الاستشهاد أثناء المراجعة؛ أعد تحميل السكريبت قبل الاعتماد.");
    if (status === "pending") {
      delete ledger.items[key];
    } else {
      if (confirmed !== true || typeof reviewer !== "string" || reviewer.trim().length < 2 ||
          reviewer.trim().length > 120)
        throw new Error("توثيق الاستشهاد يتطلب تأكيدًا بشريًا واسم المراجع.");
      if (typeof note !== "string" || note.trim().length < 12 || note.length > 2000)
        throw new Error(status === "rejected" ? "اكتب سبب الرفض في الملاحظة." :
          "اذكر مصدر التحقق وملاحظته قبل توثيق الاستشهاد.");
      ledger.items[key] = { hash: item.hash, status, reviewer: reviewer.trim(), note: note.trim(),
        at: new Date().toISOString(), ref: item.ref };
    }
    // Do not prune source evidence for other citations in the same ledger.
    // Removed citations remain historical but cannot be current: reviewItems
    // derives only the live script's citations and their exact fingerprints.
    const temp = target + "." + randomUUID() + ".tmp";
    try {
      await writeFile(temp, JSON.stringify(ledger, null, 2) + "\n", { flag: "wx", mode: 0o600 });
      if (await readFile(scriptPath, "utf8") !== liveScript)
        throw new Error("تغيّر السكريبت أثناء حفظ الاعتماد؛ لن تُثبّت الموافقة.");
      await rename(temp, target);
    } finally { await rm(temp, { force: true }); }
    return reviewItems(current, ledger);
  } finally {
    await lock.close();
    await rm(lockFile, { force: true });
  }
};

export const reviewBlockMessage = (s: ReviewSummary) =>
  `سجل التوثيق غير مكتمل: ${s.verified} من ${s.total} استشهادًا موثّقًا${s.pending ? `، ${s.pending} بانتظار المراجعة` : ""}${s.changed ? `، ${s.changed} تغيّر بعد الاعتماد` : ""}${s.rejected ? `، ${s.rejected} مرفوض` : ""}. راجعها من «السكريبت ← سجل التوثيق» قبل توليد الصوت.`;
