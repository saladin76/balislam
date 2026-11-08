/**
 * الأجزاء الصوتية في المشهد الواحد — «دفاتر الزمن» (الأمر 025، قرار D5).
 *
 * معزول: يقرأ خريطة النبرة (tone-map.json) ويحسب مهام التوليد وتوزيع الأجزاء داخل المشهد،
 * ولا يستدعيه مسار التوليد ولا الرندر المشترك بعد. المشهد البصري لا ينقسم؛ الصوت وحده أجزاء.
 */

export type ToneMapSegment = { n: number; id: string; key: string; scene: string; text: string; tone: string; audioPart: string; indexInScene: number };
export type ToneMapPart = { id: string; scene: string; segments: number[]; tone: string };
export type ToneMap = { version: string; segments: ToneMapSegment[]; audioParts: ToneMapPart[] };

export type PartJob = {
  partId: string;
  scene: string;
  tone: string;
  /** ترتيب الجزء في مشهده (0، 1، …) */
  index: number;
  segmentIds: string[];
  /** النص المشكول المرسل للتوليد: جمل الجزء موصولة بمسافة */
  text: string;
  /** اسم الملف: المشهد ذو الجزء الواحد يبقى باسمه كما هو اليوم */
  file: string;
};

/** مهام التوليد: جزء لكل مشهد، أو أكثر بقرار. يرفض الخريطة المعيبة بدل أن يخمّن */
export const partJobs = (map: ToneMap): PartJob[] => {
  const bySeg = new Map(map.segments.map((s) => [s.n, s]));
  const seen = new Set<number>();
  const perScene = new Map<string, number>();
  const jobs = map.audioParts.map((p) => {
    if (!p.segments.length) throw new Error(`جزء بلا مقاطع: ${p.id}`);
    const segs = p.segments.map((n) => {
      const s = bySeg.get(n);
      if (!s) throw new Error(`مقطع غير موجود ${n} في ${p.id}`);
      if (s.scene !== p.scene) throw new Error(`المقطع ${s.id} من ${s.scene} لا من ${p.scene}`);
      if (s.audioPart !== p.id) throw new Error(`المقطع ${s.id} منسوب إلى ${s.audioPart} لا ${p.id}`);
      if (seen.has(n)) throw new Error(`المقطع ${s.id} في جزأين`);
      seen.add(n);
      return s;
    });
    for (let i = 1; i < segs.length; i++) if (segs[i]!.n !== segs[i - 1]!.n + 1) throw new Error(`مقاطع ${p.id} غير متتالية`);
    const index = perScene.get(p.scene) ?? 0;
    perScene.set(p.scene, index + 1);
    return { partId: p.id, scene: p.scene, tone: p.tone, index, segmentIds: segs.map((s) => s.id), text: segs.map((s) => s.text).join(" "), file: `${p.id}.mp3` };
  });
  const missing = map.segments.filter((s) => !seen.has(s.n));
  if (missing.length) throw new Error(`مقاطع بلا جزء: ${missing.map((s) => s.id).join("، ")}`);
  // أجزاء المشهد الواحد متتالية في الترتيب
  const order = jobs.map((j) => j.scene);
  for (const sc of new Set(order)) {
    const idx = order.flatMap((x, i) => (x === sc ? [i] : []));
    if (idx[idx.length - 1]! - idx[0]! !== idx.length - 1) throw new Error(`أجزاء ${sc} غير متتالية`);
  }
  return jobs;
};

/** تسجيل جزء بعد قياس حدوده (trim.ts): المدة، وأول صوت وآخره، ونقطتا القص */
export type PartClip = { partId: string; duration: number; speechStart: number; speechEnd: number; start: number; end: number };

export type PlacedPart = {
  partId: string;
  /** موضع بداية المقطع المقصوص داخل المشهد */
  at: number;
  /** نقطتا القص داخل الملف */
  trimStart: number;
  trimEnd: number;
  /** أول صوت وآخره داخل المشهد */
  speechAt: number;
  speechEndAt: number;
};

export type SceneLayout = { scene: string; parts: PlacedPart[]; speechStart: number; speechEnd: number; audioEnd: number };

export const PART_GAP_SEC = 0.7;

/**
 * توزيع أجزاء المشهد: الأول من بداية المشهد، وكل جزء بعده يبدأ كلامه بعد آخر كلام سابقه بفاصل الأجزاء بالضبط
 * (لا يُضاف إليه هامش القص ولا صمت التسجيل).
 */
export const layoutScene = (scene: string, jobs: PartJob[], clips: Record<string, PartClip>, partGap = PART_GAP_SEC): SceneLayout => {
  const mine = jobs.filter((j) => j.scene === scene).sort((a, b) => a.index - b.index);
  if (!mine.length) throw new Error(`لا أجزاء للمشهد ${scene}`);
  const parts: PlacedPart[] = [];
  for (const j of mine) {
    const c = clips[j.partId];
    if (!c) throw new Error(`لا تسجيل للجزء ${j.partId}`);
    if (!(c.start <= c.speechStart && c.speechStart < c.speechEnd && c.speechEnd <= c.end && c.end <= c.duration + 1e-9)) throw new Error(`حدود غير صالحة للجزء ${j.partId}`);
    const lead = c.speechStart - c.start;
    const prev = parts[parts.length - 1];
    const at = prev ? prev.speechEndAt + partGap - lead : 0;
    parts.push({ partId: j.partId, at, trimStart: c.start, trimEnd: c.end, speechAt: at + lead, speechEndAt: at + (c.speechEnd - c.start) });
  }
  const last = parts[parts.length - 1]!;
  return { scene, parts, speechStart: parts[0]!.speechAt, speechEnd: last.speechEndAt, audioEnd: last.at + (last.trimEnd - last.trimStart) };
};

/** محاذاة الحروف كما يعيدها التوليد للنص المرسل: حرف، وبدايته ونهايته بالثواني من بداية الملف */
export type CharAlignment = { characters: string[]; start: number[]; end: number[] };

/**
 * نافذة كل جملة داخل المشهد من محاذاة حروف جزئها: تبقى الجمل مربوطة بمعرّفاتها مهما تغيّر التسجيل.
 * يرفض المحاذاة التي لا تطابق نص الجزء حرفًا.
 */
export const segmentWindows = (job: PartJob, map: ToneMap, alignment: CharAlignment, placed: PlacedPart) => {
  if (alignment.characters.join("") !== job.text) throw new Error(`المحاذاة لا تطابق نص ${job.partId}`);
  const texts = job.segmentIds.map((id) => map.segments.find((s) => s.id === id)!.text);
  let p = 0;
  return texts.map((t, i) => {
    let a = p;
    let b = p + t.length - 1;
    while (a < b && /\s/.test(alignment.characters[a]!)) a++;
    while (b > a && /\s/.test(alignment.characters[b]!)) b--;
    p += t.length + 1;
    const toScene = (x: number) => placed.at + (x - placed.trimStart);
    return { id: job.segmentIds[i]!, start: toScene(alignment.start[a]!), end: toScene(alignment.end[b]!) };
  });
};
