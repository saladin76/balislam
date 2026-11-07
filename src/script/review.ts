/**
 * سجل التوثيق والاعتماد لكل حلقة (review.json بجوار السكريبت).
 * كل استشهاد في قسم «## الاستشهادات» (آية، حديث، مصدر، كتاب برقم صفحته…) له حالة مراجعة:
 * بانتظار المراجعة ← موثّق أو مرفوض، مع ملاحظة المراجع وتاريخها.
 * الاعتماد مربوط ببصمة نص الاستشهاد (ونص الحديث في التعليق): إن تغيّر بعد الاعتماد عاد «تغيّر بعد الاعتماد».
 * الفحص البرمجي للصيغ والدرجات لا يغني عن هذه المراجعة، ولا يُولَّد صوت قبل اكتمالها.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
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
    const hasHumanProof = Boolean(e?.reviewer?.trim() && e?.note?.trim() &&
      e.at && Number.isFinite(Date.parse(e.at)) && Date.parse(e.at) <= Date.now() + 60000);
    const status: ReviewStatus = !e ? "pending" : e.hash !== hash ? "changed" :
      hasHumanProof ? e.status : "pending";
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
    const j = JSON.parse(await readFile(f, "utf8")) as ReviewLedger;
    return { version: 1, items: j.items ?? {} };
  } catch {
    return { version: 1, items: {} };
  }
};

/** يسجل قرار المراجع على الاستشهاد بحالته الحالية (البصمة الحالية). */
export const setReview = async (
  scriptPath: string, script: ParsedScript, key: string,
  status: "verified" | "rejected" | "pending", note = "",
  reviewer = "", confirmed = false,
): Promise<ReviewItem[]> => {
  const ledger = await loadLedger(scriptPath);
  const item = reviewItems(script, ledger).find((i) => i.key === key);
  if (!item) throw new Error("الاستشهاد غير موجود في السكريبت الحالي؛ احفظ السكريبت ثم أعد المحاولة.");
  if (status === "pending") delete ledger.items[key];
  else {
    if (confirmed !== true || typeof reviewer !== "string" || reviewer.trim().length < 2 || reviewer.trim().length > 120)
      throw new Error("توثيق الاستشهاد يتطلب تأكيدًا بشريًا واسم المراجع.");
    if (typeof note !== "string" || note.trim().length < 12 || note.length > 2000)
      throw new Error(status === "rejected" ? "اكتب سبب الرفض في الملاحظة." : "اذكر مصدر التحقق وملاحظته قبل توثيق الاستشهاد.");
    // Do not approve a stale in-memory script snapshot after the file changes.
    const liveScript = await readFile(scriptPath, "utf8");
    if (reviewItems((await import("./parse")).parseScript(liveScript, scriptPath), null)
        .find((current) => current.key === key)?.hash !== item.hash)
      throw new Error("تغير الاستشهاد أثناء المراجعة؛ أعد تحميل السكريبت قبل الاعتماد.");
    ledger.items[key] = { hash: item.hash, status, reviewer: reviewer.trim(), note: note.trim(),
      at: new Date().toISOString(), ref: item.ref };
  }
  // لا تبقى في السجل استشهادات حُذفت من السكريبت
  const live = new Set(reviewItems(script, null).map((i) => i.key));
  for (const k of Object.keys(ledger.items)) if (!live.has(k)) delete ledger.items[k];
  await writeFile(reviewFileFor(scriptPath), JSON.stringify(ledger, null, 2) + "\n", "utf8");
  return reviewItems(script, ledger);
};

export const reviewBlockMessage = (s: ReviewSummary) =>
  `سجل التوثيق غير مكتمل: ${s.verified} من ${s.total} استشهادًا موثّقًا${s.pending ? `، ${s.pending} بانتظار المراجعة` : ""}${s.changed ? `، ${s.changed} تغيّر بعد الاعتماد` : ""}${s.rejected ? `، ${s.rejected} مرفوض` : ""}. راجعها من «السكريبت ← سجل التوثيق» قبل توليد الصوت.`;
