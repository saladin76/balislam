/**
 * D199 (owner decision 22 Nov): «اعتمد المشاهد التي شاهدتها كاملة في المعاينة قبل النهائية» — the pure part.
 * Three conditions, each enforced here and again on the server before any approval:
 *  (1) only a scene whose cut INSIDE the watched pre-final is its CURRENT cut (same bytes) and whose inputs are current;
 *  (2) only a scene whose whole span in the pre-final was actually played, at normal speed, without seeking over any of it;
 *  (3) the list is shown before confirming, and a scene with an open owner note is excluded (as are scenes already
 *      approved and verse scenes waiting for their recitation, which keep their own rules, D35).
 * Nothing here approves anything: approvals go through the same «اعتمد» path, one scene at a time (preFinalApprove.ts).
 */

export type Span = [number, number];

/** Longest step between two player ticks still counted as continuous playback (timeupdate fires every ~0.25 s). */
export const PLAYBACK_STEP_MAX = 1.0;
/** At each end of a scene's span, this much may be missed (the first and last tick of a scene). */
export const SPAN_EDGE = 0.3;
/** A hole inside a scene's span up to this long is a tick gap, not skipped content. */
export const SPAN_HOLE = 0.05;

/** Union of spans, sorted, touching spans joined. */
export const mergeSpans = (spans: readonly Span[]): Span[] => {
  const s = spans.filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b > a).map(([a, b]) => [a, b] as Span).sort((x, y) => x[0] - y[0]);
  const out: Span[] = [];
  for (const [a, b] of s) {
    const last = out[out.length - 1];
    if (last && a <= last[1] + 1e-6) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
};

/**
 * Player-side tracking: each tick while playing at 1× adds [previous tick, now] if the step is a small forward one.
 * A seek (or a jump forward bigger than PLAYBACK_STEP_MAX, or any speed other than 1×, or a pause) breaks the chain,
 * so content that was seeked over or skipped is never counted.
 */
export const playbackTracker = () => {
  let last: number | null = null;
  return {
    tick(t: number, o: { paused: boolean; rate: number; seeking?: boolean }): Span | null {
      if (o.paused || o.seeking || o.rate !== 1 || !Number.isFinite(t)) { last = null; return null; }
      const prev = last;
      last = t;
      if (prev === null) return null;
      const step = t - prev;
      return step > 0 && step <= PLAYBACK_STEP_MAX ? [prev, t] : null;
    },
    seek() { last = null; },
  };
};

export type PreFinalRecordLite = { sceneSeconds: Record<string, number>; sceneSha256?: Record<string, string>; fileSha256?: string };
/** Each scene's span in the pre-final file, in file order (the record keeps the cut order; the first is already head-trimmed). */
export const sceneSpansOf = (rec: PreFinalRecordLite): { id: string; from: number; to: number }[] => {
  let t = 0;
  return Object.entries(rec.sceneSeconds).map(([id, sec]) => {
    const from = t;
    t += Math.max(0, sec);
    return { id, from, to: t };
  });
};

/** Condition (2): the whole span was played (edges and tick gaps tolerated, nothing else). */
export const fullyWatched = (watched: readonly Span[], from: number, to: number): boolean => {
  const a = from + SPAN_EDGE, b = to - SPAN_EDGE;
  if (b <= a) return mergeSpans(watched).some(([x, y]) => x <= from + SPAN_EDGE && y >= to - SPAN_EDGE);
  let at = a;
  for (const [x, y] of mergeSpans(watched)) {
    if (y <= at) continue;
    if (x > at + SPAN_HOLE) return false;
    at = Math.max(at, y);
    if (at >= b) return true;
  }
  return at >= b;
};

export type BulkReason = "approved" | "stale" | "recitation" | "note" | "unwatched";
export const BULK_REASON_AR: Record<BulkReason, string> = {
  approved: "معتمد من قبل",
  stale: "نسخته في المعاينة ليست نسخته الحالية (أعد صنع المعاينة)",
  recitation: "آية تنتظر تلاوتها: تُعتمد وحدها «مشروطة بالتلاوة»",
  note: "عليه ملاحظة مفتوحة",
  unwatched: "لم يُشاهد كاملًا حتى نهايته في المشغّل",
};
export type BulkSceneState = {
  id: string;
  /** approved unconditionally already */
  approved: boolean;
  /** the scene's current cut bytes (approved/in-review preview or a ready draft bound to its current inputs), null if none */
  currentSha256: string | null;
  recitationPending: boolean;
};
export type BulkPlan = { fileSha256: string; eligible: string[]; excluded: { id: string; reason: BulkReason }[] };

/** The list shown before confirming (condition 3), in episode order. */
export const bulkPlan = (rec: PreFinalRecordLite & { fileSha256: string }, watched: readonly Span[], scenes: readonly BulkSceneState[],
  openNoteScenes: ReadonlySet<string>): BulkPlan => {
  const spans = new Map(sceneSpansOf(rec).map((s) => [s.id, s]));
  const eligible: string[] = [];
  const excluded: { id: string; reason: BulkReason }[] = [];
  for (const s of scenes) {
    const span = spans.get(s.id);
    const inFile = rec.sceneSha256?.[s.id];
    const reason: BulkReason | null =
      s.approved ? "approved"
      : !span || !inFile || !s.currentSha256 || inFile !== s.currentSha256 ? "stale"
      : s.recitationPending ? "recitation"
      : openNoteScenes.has(s.id) ? "note"
      : !fullyWatched(watched, span.from, span.to) ? "unwatched"
      : null;
    if (reason) excluded.push({ id: s.id, reason }); else eligible.push(s.id);
  }
  return { fileSha256: rec.fileSha256, eligible, excluded };
};

/** The note recorded in the signed log for each scene approved this way. */
export const PREFINAL_APPROVAL_NOTE = "اعتمد بعد مشاهدة المعاينة قبل النهائية كاملة";
