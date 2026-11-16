/**
 * سرد واحد بعلوّ واحد (شكوى المالك ١٦ نوفمبر): كل مشهد تُوحَّد جمله داخله (src/voice/sentenceStitch.ts)، لكن مشهدًا قد
 * يخرج أعلى أو أخفض من جاره فيُسمع التجميع كأنه قطع. هنا يُقاس علوّ تعليق كل مشهد بـ EBU R128 (كقياس التلاوة،
 * src/quran/recitationPolish.ts)، ويُعطى كل مشهد ربحًا خطيًا واحدًا يبلغ به وسيط علوّ تعليق الحلقة نفسها (فتبقى التلاوات
 * التي ضُبطت على علوّ التعليق متناسقة معه). بحد ±6 dB. لا يمس: مشهد الآية وتلاوته، والمشهد الذي فيه البسملة (تسجيل المالك).
 * لا يُكتب أي ملف صوت: الربح يُطبَّق عند التجميع وفي Master وحدهما.
 */
import path from "node:path";
import { stat } from "node:fs/promises";
import type { Plan } from "../plan/types";
import type { EpisodeMedia } from "../plan/media";
import { hasBasmala } from "../voice/basmala";

export const NARRATION_GAIN_LIMIT_DB = 6;
/** فرق علوّ دونه لا يُغيَّر شيء (لا ربح بلا حاجة) */
const NEGLIGIBLE_LU = 0.05;

const cache = new Map<string, number | null>();

const measure = async (file: string): Promise<number | null> => {
  let key: string;
  try { const st = await stat(file); key = `${file}:${st.size}:${st.mtimeMs}`; }
  catch { return null; }
  if (cache.has(key)) return cache.get(key)!;
  const { measureLoudness } = await import("../quran/recitationPolish");
  let v: number | null = null;
  try {
    const m = await measureLoudness(file);
    v = Number.isFinite(m.integrated) && m.integrated > -70 ? m.integrated : null;
  } catch { v = null; }
  cache.set(key, v);
  return v;
};

/** الربح الخطي من فرق العلوّ (LU)، بالحد */
export const gainFor = (lufs: number, target: number) => {
  const db = Math.max(-NARRATION_GAIN_LIMIT_DB, Math.min(NARRATION_GAIN_LIMIT_DB, target - lufs));
  return Math.abs(db) < NEGLIGIBLE_LU ? 1 : Math.round(10 ** (db / 20) * 10000) / 10000;
};

/** الهدف: وسيط علوّ تعليق المشاهد المقيسة */
export const narrationTarget = (values: number[]) => {
  const v = [...values].sort((a, b) => a - b);
  if (!v.length) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m]! : (v[m - 1]! + v[m]!) / 2;
};

export type NarrationLoudness = { target: number | null; lufs: Record<string, number>; gain: Record<string, number> };

export const narrationLoudness = async (scriptPath: string, plan: Plan, media: Pick<EpisodeMedia, "voice">): Promise<NarrationLoudness> => {
  const dir = path.join(path.dirname(scriptPath), "voice");
  const lufs: Record<string, number> = {};
  for (const s of plan.chapters.flatMap((c) => c.scenes)) {
    const clip = media.voice[s.id];
    if (s.template === "verse-card" || !clip || clip.text !== s.narration.trim()) continue;
    if (clip.basmala || hasBasmala(s.narration)) continue;
    if (path.basename(clip.file) !== clip.file) continue;
    const v = await measure(path.join(dir, clip.file));
    if (v !== null) lufs[s.id] = Math.round(v * 100) / 100;
  }
  const target = narrationTarget(Object.values(lufs));
  const gain: Record<string, number> = {};
  if (target !== null) for (const [id, v] of Object.entries(lufs)) { const g = gainFor(v, target); if (g !== 1) gain[id] = g; }
  return { target: target === null ? null : Math.round(target * 100) / 100, lufs, gain };
};
