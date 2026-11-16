/**
 * «سرعة الإلقاء» على القرص (src/voice/pace.ts النموذج الصافي):
 *
 * - `pace.json` بجوار السكريبت: إعداد المالك (سرعة الحلقة والمشهد والجملة، والفاصل). محتوى مالك يُحفظ في main (D101)
 *   وتفحصه بوابة المحتوى. حفظه لا يغيّر أي صوت ولا أي مشهد: يصير المشهد «تغيّرت سرعته — أعد إنتاجه» حتى يُعاد إنتاجه.
 * - `voice/paced.json` (محلي، لا يُرفع): لكل مشهد طُبّقت عليه السرعة نسخته المطبَّقة `voice/paced-<…>.wav`، والتسجيل الأصلي
 *   الذي صُنعت منه (اسمه وبصمته). الأصل لا يُمس ولا يُنقل ولا يُحذف أبدًا (تسجيل مدفوع)، والنسخة مجانية تُعاد منه.
 * - `pacedOverlay` (يستعمله loadVoiceIndex وحده): ما يقرؤه الرندر والسجل والمدد = النسخة المطبَّقة ما دامت مصنوعة من
 *   الأصل الحالي نفسه؛ وإلا الأصل كما هو. فما يُعتمد ويُرندر ويُنشر هو ما سُمع، والسجل يعيد فتح المشهد بتغيّر بصمته (D50).
 *   أما مسارات صنع الصوت (الجمل، والتوليد، وأجزاء الخريطة) فتقرأ voice/index.json الخام دائمًا: لا يُمد ممدود مرتين.
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { readJson } from "../plan/io";
import { writeJsonAtomic } from "../io/atomicJson";
import { cleanPace, emptyPace, PACE_NOTE, type PaceDoc } from "./pace";

export const paceFileFor = (scriptPath: string) => path.join(path.dirname(scriptPath), "pace.json");
export const pacedIndexFor = (scriptPath: string) => path.join(path.dirname(scriptPath), "voice", "paced.json");
export const PACED_PREFIX = "paced-";

export const loadPace = async (scriptPath: string): Promise<PaceDoc> =>
  cleanPace(await readJson<unknown>(paceFileFor(scriptPath)).catch(() => null) ?? emptyPace());

export const savePace = async (scriptPath: string, doc: PaceDoc): Promise<void> => {
  const clean = cleanPace(doc);
  await writeJsonAtomic(paceFileFor(scriptPath), { _note: PACE_NOTE, ...clean });
};

/** مقطع المشهد كما في voice/index.json (الحقول التي يحتاجها التطبيق) */
export type RawClip = {
  file: string; hash: string; text: string; duration: number; words: { word: string; start: number; end: number }[];
  timing?: { pre: number; tail: number; seconds: number; speechStart: number; speechEnd: number; toneMap: string; parts: { partId: string; at: number; trimStart: number; trimEnd: number }[] };
  [k: string]: unknown;
};
/** ما صُنعت منه النسخة المطبَّقة وبأي إعداد، يُضاف إلى المقطع الذي يقرؤه الرندر والسجل */
export type PacedInfo = { key: string; from: { file: string; hash: string; duration: number }; speed: number; pause: number; tailSeconds?: number };
export type PacedEntry = { key: string; from: PacedInfo["from"]; clip: RawClip & { paced: PacedInfo } };
export type PacedIndex = Record<string, PacedEntry>;

export const loadPacedIndex = async (scriptPath: string): Promise<PacedIndex> => {
  const d = await readJson<PacedIndex>(pacedIndexFor(scriptPath)).catch(() => null);
  return d && typeof d === "object" && !Array.isArray(d) ? d : {};
};
export const savePacedIndex = (scriptPath: string, d: PacedIndex) => writeJsonAtomic(pacedIndexFor(scriptPath), d);

/** النسخة المطبَّقة صالحة للمقطع الخام الحالي؟ (صُنعت منه نفسه وملفها موجود) */
export const pacedValidFor = (entry: PacedEntry | undefined, raw: RawClip | undefined, voiceDir: string): entry is PacedEntry =>
  Boolean(entry && raw && entry.from.file === raw.file && entry.from.hash === raw.hash && entry.clip?.file?.startsWith(PACED_PREFIX) &&
    path.basename(entry.clip.file) === entry.clip.file && existsSync(path.join(voiceDir, entry.clip.file)));

/** فهرس الصوت كما يقرؤه الرندر والسجل والمدد: النسخة المطبَّقة الصالحة مكان الأصل (بلا أي كتابة) */
export const pacedOverlay = async <T extends RawClip>(scriptPath: string, index: Record<string, T>): Promise<Record<string, T>> => {
  const paced = await loadPacedIndex(scriptPath);
  if (!Object.keys(paced).length) return index;
  const dir = path.join(path.dirname(scriptPath), "voice");
  const out: Record<string, T> = { ...index };
  for (const [id, entry] of Object.entries(paced)) if (pacedValidFor(entry, index[id], dir)) out[id] = entry.clip as unknown as T;
  return out;
};
