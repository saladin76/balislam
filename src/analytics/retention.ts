/**
 * قارئ الاحتفاظ (خطة «احترافية بلا مثيل»، المرحلة ٢ البند ٥؛ منهج yt-retention): يقرأ تصدير «Audience retention»
 * من YouTube Studio، ويسمّي أكبر تسرب ومكانه في السكريبت (المشهد بتوقيته الحقيقي، والجملة تقريبًا).
 *
 * - أول ٣٠ ثانية وحدها: تسربها يُصلح في السكريبت (وضوح البداية ووعد الحلقة، بلا خطاف: D207)، لا في الرسم.
 * - بعدها: أكبر هبوط في نافذة ثابتة (٢٪ من المدة، ٥ ثوانٍ على الأقل)، بلا آخر ٥٪ (الخاتمة وشاشة النهاية تهبط طبيعيًا).
 * دالة صافية: الملف يُقرأ في retentionFile.ts، والمشاهد من sceneStartsFor (src/package/chapters.ts).
 */
export type RetentionPoint = { t: number; r: number };
export type SceneSpan = { id: string; start: number; narration: string };
export type Spot = { from: number; to: number; drop: number; sceneId?: string; sentence?: string; estimated: boolean };
export type RetentionReport = {
  duration: number;
  at30: number;
  start: number;
  early: Spot;
  biggest?: Spot;
  average: number;
  /** التسرب في أول ٣٠ ث أكبر من الحد: يُصلح في السكريبت */
  earlyFix: boolean;
};

/** تسرب أول ٣٠ ث فوق هذا (نقاط مئوية من البداية) يُعدّ مشكلة في البداية. */
export const EARLY_DROP_LIMIT = 25;

const NUM = (s: string) => Number(s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[٫,](?=\d{1,3}$)/, ".").replace(/[%٪\s]/g, ""));
const clockSec = (s: string) => {
  const p = s.trim().split(":").map(Number);
  return p.some((x) => !Number.isFinite(x)) ? NaN : p.reduce((a, x) => a * 60 + x, 0);
};

/** يقسم سطر CSV (فواصل أو Tab، وحقول بين علامتي تنصيص). */
const splitRow = (line: string, sep: string) => {
  const out: string[] = [];
  let cur = "", q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === sep && !q) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
};

/**
 * من نص التصدير إلى نقاط (ثانية، احتفاظ ٪). عمود الموضع: نسبة مئوية (عنوانه فيه ٪ أو %)، أو كسر (٠–١)، أو وقت
 * («1:05» أو ثوانٍ إن قال العنوان ذلك). عمود الاحتفاظ: «retention» أو «الاحتفاظ» (المطلق قبل النسبي)، بالنسبة أو بالكسر.
 */
export const parseRetention = (text: string, duration?: number): RetentionPoint[] => {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 3) throw new Error("ملف الاحتفاظ بلا بيانات كافية.");
  const sep = lines[0]!.includes("\t") ? "\t" : lines[0]!.includes(";") && !lines[0]!.includes(",") ? ";" : ",";
  const head = splitRow(lines[0]!, sep).map((h) => h.toLowerCase());
  const posI = head.findIndex((h) => /position|موضع|الموضع|time|الوقت|elapsed/.test(h));
  const retCands = head.map((h, i) => ({ h, i })).filter((x) => /retention|الاحتفاظ|احتفاظ/.test(x.h) && x.i !== posI);
  const ret = retCands.find((x) => !/relative|نسبي/.test(x.h)) ?? retCands[0];
  if (posI < 0 || !ret) throw new Error(`لم أجد عمودي «موضع الفيديو» و«الاحتفاظ» في أول سطر: ${lines[0]}`);
  const rows = lines.slice(1).map((l) => splitRow(l, sep)).filter((c) => c[posI] && c[ret.i]);
  const rawPos = rows.map((c) => c[posI]!);
  const rawRet = rows.map((c) => NUM(c[ret.i]!));
  const timeLike = rawPos.some((p) => p.includes(":"));
  const posNums = rawPos.map((p) => (timeLike ? clockSec(p) : NUM(p)));
  const headPos = head[posI]!;
  const isPercent = !timeLike && (/%|٪|percent|نسبة/.test(headPos) || rawPos.some((p) => /[%٪]/.test(p)));
  const isSeconds = timeLike || /second|ثاني|sec\b/.test(headPos);
  const isFraction = !isPercent && !isSeconds && Math.max(...posNums) <= 1;
  if ((isPercent || isFraction) && !(duration && duration > 0)) throw new Error("الموضع في الملف نسبة من الفيديو: يلزم طول الحلقة بالثواني.");
  const retFraction = Math.max(...rawRet.filter(Number.isFinite)) <= 1.5 && !rows.some((c) => /[%٪]/.test(c[ret.i]!));
  const pts = rows.map((_, k) => ({
    t: isPercent ? (posNums[k]! / 100) * duration! : isFraction ? posNums[k]! * duration! : posNums[k]!,
    r: retFraction ? rawRet[k]! * 100 : rawRet[k]!,
  })).filter((p) => Number.isFinite(p.t) && Number.isFinite(p.r)).sort((a, b) => a.t - b.t);
  if (pts.length < 3) throw new Error("ملف الاحتفاظ بلا نقاط صالحة.");
  return pts;
};

/** الاحتفاظ عند ثانية t (خطي بين نقطتين). */
export const retentionAt = (pts: RetentionPoint[], t: number) => {
  if (t <= pts[0]!.t) return pts[0]!.r;
  for (let i = 1; i < pts.length; i++) if (pts[i]!.t >= t) {
    const a = pts[i - 1]!, b = pts[i]!;
    return a.r + ((b.r - a.r) * (t - a.t)) / (b.t - a.t || 1);
  }
  return pts.at(-1)!.r;
};

/** المشهد الذي يقع فيه t، والجملة تقريبًا بموضعها النسبي في نص المشهد. */
export const locate = (t: number, scenes: SceneSpan[], total: number) => {
  const sorted = [...scenes].sort((a, b) => a.start - b.start);
  let i = -1;
  sorted.forEach((x, k) => { if (x.start <= t) i = k; });
  const s = sorted[i];
  if (!s) return {};
  const end = sorted[i + 1]?.start ?? total;
  const frac = Math.min(Math.max((t - s.start) / Math.max(end - s.start, 0.001), 0), 1);
  const sentences = s.narration.split(/(?<=[.!؟?…])\s+/).map((x) => x.trim()).filter(Boolean);
  if (!sentences.length) return { sceneId: s.id };
  const lengths = sentences.map((x) => x.length);
  const sum = lengths.reduce((a, b) => a + b, 0);
  let acc = 0;
  const k = lengths.findIndex((L) => (acc += L) / sum >= frac);
  return { sceneId: s.id, sentence: sentences[k < 0 ? sentences.length - 1 : k] };
};

export const analyseRetention = (pts: RetentionPoint[], o: { duration: number; scenes: SceneSpan[]; estimated: boolean }): RetentionReport => {
  const D = o.duration;
  const start = pts[0]!.r;
  const t30 = Math.min(30, D);
  const at30 = retentionAt(pts, t30);
  const spot = (from: number, to: number): Spot => ({ from, to, drop: retentionAt(pts, from) - retentionAt(pts, to), ...locate(from, o.scenes, D), estimated: o.estimated });
  // أشد هبوط داخل أول ٣٠ ث (نافذة ٥ ث)
  let early = spot(0, Math.min(5, t30));
  for (let a = 0.5; a + 5 <= t30; a += 0.5) { const s = spot(a, a + 5); if (s.drop > early.drop) early = s; }
  const w = Math.max(5, D * 0.02);
  let biggest: Spot | undefined;
  for (let a = t30; a + w <= D * 0.95; a += Math.max(0.5, w / 10)) {
    const s = spot(a, a + w);
    if (!biggest || s.drop > biggest.drop) biggest = s;
  }
  // متوسط نسبة المشاهدة: مساحة المنحنى على طول الحلقة
  let area = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!;
    const lo = Math.max(0, a.t), hi = Math.min(D, b.t);
    if (hi > lo) area += ((retentionAt(pts, lo) + retentionAt(pts, hi)) / 2) * (hi - lo);
  }
  return { duration: D, at30, start, early, biggest: biggest && biggest.drop > 0 ? biggest : undefined, average: area / Math.max(D, 1), earlyFix: start - at30 > EARLY_DROP_LIMIT };
};

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const pct = (x: number) => `${Math.round(x)}٪`;
const where = (s: Spot) => (s.sceneId ? ` في المشهد ${s.sceneId}${s.sentence ? `، عند «${s.sentence.length > 90 ? `${s.sentence.slice(0, 90)}…` : s.sentence}» (تقريبًا)` : ""}` : "");

export const retentionMarkdown = (title: string, r: RetentionReport) => [
  `# الاحتفاظ · ${title}`,
  "",
  `- متوسط ما يُشاهَد: ${pct(r.average)} من ${clock(r.duration)}.`,
  `- أول ٣٠ ثانية: من ${pct(r.start)} إلى ${pct(r.at30)} (−${Math.round(r.start - r.at30)} نقطة). أشد هبوط فيها ${clock(r.early.from)}–${clock(r.early.to)} (−${Math.round(r.early.drop)})${where(r.early)}.`,
  r.earlyFix
    ? `  - **يُصلح في السكريبت:** التسرب أكبر من ${EARLY_DROP_LIMIT} نقطة؛ البداية أو وعد الحلقة لا يمسك المشاهد. راجع وضوح الجمل الأولى (من أول السكريبت بشكله الطبيعي، بلا خطاف) حتى هذا الموضع.`
    : "  - البداية تمسك المشاهد (التسرب في الحد).",
  r.biggest
    ? `- **أكبر تسرب بعدها:** ${clock(r.biggest.from)}–${clock(r.biggest.to)} (−${Math.round(r.biggest.drop)} نقطة)${where(r.biggest)}.`
    : "- لا تسرب يُذكر بعد أول ٣٠ ثانية.",
  ...(r.early.estimated ? ["", "التوقيتات تقديرية من الخطة: المشاهد لم تُجمَّع في هذا الجهاز."] : []),
  "",
].join("\n");
