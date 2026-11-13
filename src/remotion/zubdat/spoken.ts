import React from "react";
import { normalizeArabic } from "../../script/quranMeta";
import type { WordTiming } from "../scenes/timing";
import { Mark, Write } from "./inkKit";
import type { InkShotDef } from "./shots";
import { parseInkArgs } from "./kitShots";

/**
 * مطابقة الكلمة المنطوقة لمشاهد الحبر (زبدة الكتب)، نقية بلا ملفات: يستعملها الفحص الآلي (src/studio/zubdat.ts)،
 * وفحص الخطة (src/plan/shotWords.ts)، وقالب المشهد نفسه (InkShot.tsx) فلا يُكتب على الشاشة ما لا يُنطق.
 */
export const strip = (w: string) => normalizeArabic(w.replace(/[«»"“”'؟?!.,،:؛…ـ()]/g, ""));
export const PRE_AT = ["", "و", "ف", "ب", "ل", "وب", "ول"];
export const PRE_END = ["", "و", "ف", "ب", "ل"];
export const findWord = (timings: WordTiming[], word: string, nth: number, pre: string[]) => {
  const k = strip(word);
  if (!k) return null;
  let n = 0;
  for (const t of timings) {
    const w = strip(t.word);
    if (pre.some((p) => w === p + k)) if (++n === nth) return t;
  }
  return null;
};
/** جذع الكلمة للمقارنة: بلا سابقة (و ف ب ل ك) ولا «ال» ولا ألف التنوين أو التاء المربوطة في آخرها */
export const stem = (w: string) => strip(w).replace(/^(?:[وف]?(?:[بلك])?)(?:ال|ل(?=ل))?/, "").replace(/(?:ا|ة|ه)$/, "");
export const spoken = (timings: WordTiming[], token: string, allow: Set<string>) => {
  const k = stem(token);
  if (!k || !/[ء-ي]/.test(k) || allow.has(k)) return true;
  return timings.some((t) => stem(t.word) === k);
};
/** كلمات اسم القناة: تُكتب على الشاشة (البصمة) ولو لم تُنطق */
export const allowFromName = (name: string | undefined) => new Set(String(name ?? "").split(/\s+/).map(stem).filter(Boolean));

export type Drawn = { id: string; text: string; size: number; p: number; kind: "write" | "mark" };
/** يجمع النصوص المكتوبة (Write) من شجرة المشهد، ويفتح المكوّنات الصغيرة الخالية من الخطافات */
export const collectWrites = (node: React.ReactNode, out: Drawn[], depth = 0) => {
  if (depth > 40 || node == null || typeof node === "boolean") return;
  if (Array.isArray(node)) { for (const n of node) collectWrites(n, out, depth + 1); return; }
  if (!React.isValidElement(node)) return;
  const el = node as React.ReactElement<Record<string, unknown>>;
  const props = el.props ?? {};
  if (el.type === Write) { out.push({ id: String(props.id ?? ""), text: String(props.text ?? ""), size: Number(props.size ?? 0), p: Number(props.p ?? 0), kind: "write" }); return; }
  if (el.type === Mark) { out.push({ id: "mark", text: "", size: 0, p: Number(props.p ?? 0), kind: "mark" }); return; }
  if (typeof el.type === "function") {
    try { collectWrites((el.type as (p: unknown) => React.ReactNode)(props), out, depth + 1); } catch { /* مكوّن بخطافات: لا نص فيه من مشاهد الحبر */ }
    return;
  }
  collectWrites(props.children as React.ReactNode, out, depth + 1);
};

const Z0 = { ink: "#111", paper: "#fff", hl: "#E8F542", alert: "#C2412D", faint: "#888" };

/**
 * هل صُمم المشهد على نص غير نصه الحالي (D-5)؟ كلمات توقيت لم تعد في التعليق (حدث يسقط إلى نسبة تقديرية، فلا يقع
 * على كلمته)، ونصوص على الشاشة لا تُنطق. يُحسب من الكلمات وحدها، فيصلح للتوقيت التقديري والحقيقي معًا.
 * مشهد بلا تعليق (الخاتمة) لا يُحكم عليه هنا.
 */
export const inkShotWordIssue = (
  def: InkShotDef | undefined, scene: { narration?: string; props?: Record<string, unknown> }, timings: WordTiming[], dur: number, allow: Set<string>,
): { missing: string[]; unspoken: string[] } => {
  if (!def || !String(scene.narration ?? "").trim()) return { missing: [], unspoken: [] };
  const missing = new Set<string>();
  const mk = (pre: string[], key: "start" | "end") => (word: string, frac: number, nth = 1) => {
    const hit = findWord(timings, word, nth, pre);
    if (!hit) { if (frac >= 0) missing.add(word); return Math.round(frac * dur); }
    return hit[key];
  };
  const args = parseInkArgs(String(scene.props?.labels ?? ""), String(scene.props?.cues ?? ""));
  const texts = new Set<string>();
  for (const frame of [0, Math.round(dur / 2), Math.max(0, dur - 1)]) {
    let out;
    try {
      out = def.render({ frame, dur, z: Z0, at: mk(PRE_AT, "start"), end: mk(PRE_END, "end"), logo: () => null, reg: () => {}, task: String(scene.props?.task ?? "") || undefined, args });
    } catch { continue; }
    const drawn: Drawn[] = [];
    collectWrites(out.world, drawn);
    for (const d of drawn) if (d.kind === "write" && d.text.trim()) texts.add(d.text);
  }
  const unspoken = [...texts].filter((t) => t.split(/\s+/).some((w) => !spoken(timings, w, allow)));
  return { missing: [...missing], unspoken };
};
