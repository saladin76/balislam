import type { PlanScene } from "../plan/types";
import { ACTIVE_PCT, type MotionReport } from "./motionMeter";

/**
 * قياس الحركة مفصولًا: مشاهد النص المقدس (الآيات، ونص الدعاء نفسه) تُقاس وحدها وتُسجَّل نتيجتها،
 * ولا تُخلط بمشاهد السرد والشرح التي يبقى حدها 80%. لا يُعفى مشهد من القياس؛ يُفصل فقط.
 */
export type MotionKind = "sacred" | "narrative";

export const motionKindOf = (scene: Pick<PlanScene, "template" | "props">): MotionKind => {
  if (scene.template === "verse-card") return "sacred";
  if (scene.template === "dua-board" && /^\s*dua\s*\|/m.test(String(scene.props?.cues ?? ""))) return "sacred";
  return "narrative";
};

export type SegmentResult = { kind: MotionKind; seconds: number; activeSeconds: number; percent: number; still: { from: number; to: number }[] };

/** spans: بداية كل مشهد ونهايته بالثواني ونوعه، بترتيب الفيديو */
export const motionBySegments = (r: MotionReport, spans: { from: number; to: number; kind: MotionKind }[]): Record<MotionKind, SegmentResult> => {
  const out = {} as Record<MotionKind, SegmentResult>;
  for (const kind of ["sacred", "narrative"] as MotionKind[]) {
    const secs = r.perSecond.map((v, s) => ({ s, v })).filter(({ s }) => spans.some((sp) => sp.kind === kind && s + 0.5 >= sp.from && s + 0.5 < sp.to));
    const active = secs.filter((x) => x.v >= ACTIVE_PCT).length;
    const still: { from: number; to: number }[] = [];
    let run: number[] = [];
    const flush = () => {
      if (run.length >= 2) still.push({ from: run[0]!, to: run[run.length - 1]! + 1 });
      run = [];
    };
    for (const x of secs) {
      if (x.v < ACTIVE_PCT && (run.length === 0 || run[run.length - 1] === x.s - 1)) run.push(x.s);
      else {
        flush();
        if (x.v < ACTIVE_PCT) run.push(x.s);
      }
    }
    flush();
    out[kind] = { kind, seconds: secs.length, activeSeconds: active, percent: secs.length ? Math.round((active / secs.length) * 100) : 0, still };
  }
  return out;
};
