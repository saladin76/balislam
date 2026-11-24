/**
 * D218 (طلب المالك ٢٤ نوفمبر): «لا إطار شبه فارغ أثناء الكلام أكثر من ثانية». في «دفاتر الزمن 001» v15 صفحة الدفتر
 * فارغة نحو ٨ ث والراوي يتكلم (6:16.7–6:24.3، c1-s34)، وأول ثانية بعد قلب الصفحة فارغة.
 *
 * - الحبر: مساحة المشهد نفسها في مقياس التفاعلية (١٢٪–٧٦٪ من الارتفاع، بلا عنوان الفصل والترجمة)، مصغّرة إلى 320×114،
 *   ثم مرشح ffmpeg «edgedetect»، بخمس عينات في الثانية. حواف الدفتر نفسه (حافتا الصفحتين والكعب وخطوط الورق المربّع)
 *   خطوط طويلة تملأ عمودًا أو صفًا (أكثر من ٣٠٪ منه) فتُحذف مع عمودين/صفين حولها؛ وما بقي من نقاط الحواف «حبر» المحتوى
 *   (كلمة، عنوان، رسم، خيط). متوسط الحواف وحده (signalstats YAVG) لم يفرّق: الصفحة الفارغة ١٫٦–١٫٨ وصفحة عليها عنوان صغير
 *   أو رسم «إبليس» ٢٫٢، لأن حواف الدفتر تغلب عليه.
 * - المعايرة على «دفاتر الزمن 001» قبل النهائية v15 (1080p، قراءة فقط): الصفحة الفارغة 6:17–6:25 = ٤٢ نقطة حبر،
 *   وأول ثوانٍ بعد قلب الصفحة ١٠–٥١، وصفحة عليها سطر باهت صغير ٣٧؛ وصفحة عليها خيط الأفق وحده ٧٠، وعنوان صغير «آدم عليه السلام» ٨٢،
 *   وعلامة استفهام ١٨٠، و«إبليس» والساعة الرملية ١٩٠، والصفحات المكتوبة مئات. الحد ٦٠: ما دونه «شبه فارغ».
 * - زمن الكلام: كلمات صوت الراوي لكل مشهد (المقطع المطابق لنص المشهد، كما في intendedStillness) منقولة إلى زمن الملف
 *   ببداية مشهدها في الملف (سجل الوصلات للمجمّعة، وزمن الخطة للنهائية)، والفجوات بين الكلمات حتى SPEECH_GAP_SEC كلام متصل.
 * - البند يذكر كل تقاطع بين «شبه فارغ» والكلام أطول من BLANK_MAX_SEC بزمنه ومشهده، ويمنع كالتفاعلية.
 * - D220 (قرار المالك ٢٤ نوفمبر): «حد الصفحة الفاضية يبقى كما هو، لكن لا تُحسب الصفحة فارغة إن كان فيها عنصر يُرسم أو يتحرك
 *   في تلك اللحظة». مع كل عينة يُقاس تغيّر مساحة المشهد نفسها (رمادية 320×114 قبل edgedetect) عن العينة السابقة (قبل ٠٫٢ ث):
 *   متوسط الفرق المطلق مقسومًا على ٢٥٦ كما يقيسه freezedetect (MAFD)، وما فوق عتبة الضجيج نفسها في مقياس التفاعلية والشاشة
 *   الواقفة (FREEZE_NOISE) «يتحرك» فلا يُحسب فارغًا وإن قلّ حبره: قلب الصفحة، وخيط يُرسم، وعنوان يُكتب. أول عينة بلا سابقة ساكنة.
 */
import { spawn } from "node:child_process";
import type { Plan } from "../../plan/types";
import type { EpisodeMedia } from "../../plan/media";
import { FREEZE_NOISE, mergeIntervals, SCENE_BOTTOM, SCENE_TOP, type Interval } from "./interactivity";
import { pausesOver, type PauseReport, type SceneStart } from "./pauses";

/** أطول إطار شبه فارغ مسموح أثناء الكلام بالثواني */
export const BLANK_MAX_SEC = 1;
/** نقاط حبر المحتوى (بعد حذف خطوط الدفتر) في إطار 320×114 تحت هذا = شبه فارغ؛ معاير على v15 (انظر أعلاه) */
export const BLANK_INK_MIN = 60;
/** عينات في الثانية */
export const BLANK_FPS = 5;
/** فجوة بين كلمتين لا تقطع الكلام */
export const SPEECH_GAP_SEC = 0.6;
export const INK_W = 320;
export const INK_H = 114;
/** عمود أو صف حوافه أكثر من هذه النسبة خط من الدفتر نفسه لا محتوى */
const STRUCTURE_FRAC = 0.3;

/** D220: تغيّر الإطار (MAFD) فوق هذا = شيء يُرسم أو يتحرك؛ عتبة ضجيج freezedetect نفسها */
export const BLANK_MOTION_MIN = FREEZE_NOISE;

/** motion: تغيّر مساحة المشهد عن العينة السابقة (MAFD، 0–1)؛ غيابه (قياس قديم أو أول عينة) = ساكن */
export type InkSample = { t: number; ink: number; motion?: number };

/** متوسط الفرق المطلق بين إطارين رماديين مقسومًا على ٢٥٦، كما يحسبه freezedetect */
export const frameChange = (a: Uint8Array, b: Uint8Array): number => {
  let sad = 0;
  for (let i = 0; i < a.length; i++) sad += Math.abs(a[i]! - b[i]!);
  return sad / (a.length * 256);
};

/** عينة «شبه فارغة»: حبرها تحت الحد، ولا شيء يُرسم أو يتحرك فيها (D220) */
export const isBlankSample = (s: InkSample, min = BLANK_INK_MIN) => s.ink < min && !((s.motion ?? 0) > BLANK_MOTION_MIN);

/** نقاط حبر المحتوى في إطار حواف (0/255): كل الحواف بلا الأعمدة والصفوف التي يملؤها خط طويل (±٢) */
export const contentInk = (f: Uint8Array, w = INK_W, h = INK_H): number => {
  const col = new Array<number>(w).fill(0), row = new Array<number>(h).fill(0);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (f[y * w + x]! > 127) { col[x]!++; row[y]!++; }
  const skipC = new Uint8Array(w), skipR = new Uint8Array(h);
  col.forEach((v, x) => { if (v / h > STRUCTURE_FRAC) for (let d = -2; d <= 2; d++) if (x + d >= 0 && x + d < w) skipC[x + d] = 1; });
  row.forEach((v, y) => { if (v / w > STRUCTURE_FRAC) for (let d = -2; d <= 2; d++) if (y + d >= 0 && y + d < h) skipR[y + d] = 1; });
  let n = 0;
  for (let y = 0; y < h; y++) if (!skipR[y]) for (let x = 0; x < w; x++) if (!skipC[x] && f[y * w + x]! > 127) n++;
  return n;
};

/** فترات «شبه فارغ»: كل عينة تحت الحد تغطي 1/fps بعدها، والمتلاصق يُدمج */
export const blankIntervals = (samples: readonly InkSample[], min = BLANK_INK_MIN, fps = BLANK_FPS, end = Infinity): Interval[] =>
  // ‎+1 ms: عينتان متتاليتان تتلاصقان رغم كسور الفاصلة العائمة (376.6 + 0.2 = 376.79999…)
  mergeIntervals(samples.filter((s) => isBlankSample(s, min)).map((s) => ({ from: s.t, to: s.t + 1 / fps + 0.001 })), end);

/** يفصل إطارًا مكدّسًا أفقيًا (الحواف يسارًا والرمادي يمينًا، كل منهما INK_W×INK_H) */
export const splitStacked = (f: Uint8Array, w = INK_W, h = INK_H): { edges: Uint8Array; gray: Uint8Array } => {
  const edges = new Uint8Array(w * h), gray = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    edges.set(f.subarray(y * 2 * w, y * 2 * w + w), y * w);
    gray.set(f.subarray(y * 2 * w + w, (y + 1) * 2 * w), y * w);
  }
  return { edges, gray };
};

/**
 * عينات الحبر والحركة من الملف: كل عينة إطار واحد فيه الحواف (لحساب الحبر كما عُويِر الحد) والرمادي قبلها (لحساب التغيّر)
 * جنبًا إلى جنب، تُقرأ تباعًا (لا يُحفظ الفيديو كله في الذاكرة).
 */
export const detectInkSamples = (file: string): Promise<InkSample[]> => new Promise((resolve, reject) => {
  const fc = `[0:v:0]fps=${BLANK_FPS},crop=iw:trunc(ih*${(SCENE_BOTTOM - SCENE_TOP).toFixed(2)}/2)*2:0:trunc(ih*${SCENE_TOP}/2)*2,scale=${INK_W}:${INK_H},format=gray,split[g1][g2];[g1]edgedetect=low=0.08:high=0.2[e];[e][g2]hstack=inputs=2[out]`;
  const p = spawn("ffmpeg", ["-hide_banner", "-nostats", "-nostdin", "-loglevel", "error", "-i", file, "-an", "-filter_complex", fc, "-map", "[out]", "-f", "rawvideo", "-pix_fmt", "gray", "-"]);
  const size = 2 * INK_W * INK_H, out: InkSample[] = [];
  let pending: Buffer = Buffer.alloc(0), err = "", prev: Uint8Array | null = null;
  p.stdout.on("data", (chunk: Buffer) => {
    pending = pending.length ? Buffer.concat([pending, chunk]) : chunk;
    while (pending.length >= size) {
      const { edges, gray } = splitStacked(pending.subarray(0, size));
      out.push({ t: out.length / BLANK_FPS, ink: contentInk(edges), ...(prev ? { motion: frameChange(prev, gray) } : {}) });
      prev = gray;
      pending = pending.subarray(size);
    }
  });
  p.stderr.on("data", (c: Buffer) => { err += String(c); });
  p.on("error", reject);
  p.on("close", (code) => (code === 0 ? resolve(out) : reject(Error(`تعذّر قياس الإطار الفارغ: ${err.slice(-300)}`))));
});

/** تقاطع قائمتي فترات */
export const intersectIntervals = (a: readonly Interval[], b: readonly Interval[]): Interval[] => {
  const x = mergeIntervals(a), y = mergeIntervals(b), out: Interval[] = [];
  let i = 0, j = 0;
  while (i < x.length && j < y.length) {
    const from = Math.max(x[i]!.from, y[j]!.from), to = Math.min(x[i]!.to, y[j]!.to);
    if (to > from) out.push({ from, to });
    if (x[i]!.to < y[j]!.to) i++; else j++;
  }
  return out;
};

/** زمن كلام الراوي في الملف: كلمات مقطع كل مشهد (إن طابق نصه) من بداية المشهد في الملف */
export const speechSpans = (plan: Plan, media: Pick<EpisodeMedia, "voice">, fileStarts: readonly SceneStart[]): Interval[] => {
  const at = new Map(fileStarts.map((s) => [s.id, s.start]));
  const words: Interval[] = [];
  for (const s of plan.chapters.flatMap((c) => c.scenes)) {
    const clip = media.voice[s.id];
    const start = at.get(s.id);
    if (!clip || start === undefined || clip.text !== s.narration.trim()) continue;
    for (const w of clip.words) words.push({ from: start + w.start, to: start + w.end });
  }
  // الفجوة القصيرة بين كلمتين كلام متصل: تُمد كل كلمة بنصف الفجوة المسموحة من الجانبين ثم يُرد الطرفان
  const joined = mergeIntervals(words.map((w) => ({ from: w.from - SPEECH_GAP_SEC / 2, to: w.to + SPEECH_GAP_SEC / 2 })));
  return joined.map((x) => ({ from: x.from + SPEECH_GAP_SEC / 2, to: x.to - SPEECH_GAP_SEC / 2 })).filter((x) => x.to > x.from);
};

/** الإطار شبه الفارغ أثناء الكلام، أطول من ثانية (لا تُحسب عينة يُرسم فيها أو يتحرك شيء، D220) */
export const blankReport = (samples: readonly InkSample[], speech: readonly Interval[], starts: readonly SceneStart[] = []): PauseReport =>
  pausesOver(intersectIntervals(blankIntervals(samples), speech), BLANK_MAX_SEC, starts);
