/**
 * Shared probes for the episode-001 designed story shots (order 032): renders each shot's own data
 * (camera keys and declared spans) at every 3rd frame with the silent timing estimate, in both orientations.
 */
import fs from "node:fs";
import { SHOTS } from "../../src/remotion/illus/shots";
import { camAt, makeAt } from "../../src/remotion/illus/shots/kit";
import { estimateTimings } from "../../src/remotion/scenes/timing";
import { sceneFrames } from "../../src/plan/duration";

export type PlanScene = { id: string; template: string; narration: string; props: Record<string, string> };
// The 163-scene design (command 032) these checks were written for; the live plan is the ~5-minute episode since
// 19 Nov (owner decision), its own checks in tests/balislam-001-short-plan.test.ts
export const PLAN_FILE = "channels/balislam/episodes/001-know-the-truth/versions/2026-11-19-before-5min/plan.json";
export const planScenes = (): PlanScene[] =>
  (JSON.parse(fs.readFileSync(PLAN_FILE, "utf8")).chapters as { scenes: PlanScene[] }[]).flatMap((c) => c.scenes);
export const shotScenes = () => planScenes().filter((s) => s.template === "alley-tale" && s.props.shot?.startsWith("ep001-"));

export const ctxFor = (s: PlanScene, portrait: boolean) => {
  const dur = sceneFrames(s as never);
  const timings = estimateTimings(s.narration, 6, dur - 12);
  return { dur, at: makeAt(timings, dur), portrait, fps: 30, timings };
};

/** فحص الإطار: الكاميرا داخل المكان، والمطلوب كامل، والاختياري كامل أو غائب (العابر مستثنى وهو يمشي) */
export const framingIssues = (s: PlanScene, portrait: boolean, step = 3, margin = 20): string[] => {
  const def = SHOTS[s.props.shot!]!;
  const c0 = ctxFor(s, portrait);
  const out: string[] = [];
  for (let frame = 0; frame < c0.dur; frame += step) {
    const shot = def.render({ frame, fps: 30, dur: c0.dur, portrait, at: c0.at });
    const c = camAt(frame, shot.cam);
    const z = c.z * (1 + 0.045 * (frame / c0.dur));
    const half = (portrait ? 304 : 960) / z;
    const v0 = c.x - half, v1 = c.x + half;
    if (v0 < -1 || v1 > 1921) out.push(`${s.id}@${frame} view ${v0.toFixed(0)}..${v1.toFixed(0)}`);
    // أثناء انتقال الكاميرا بين تأطيرين سليمين (22 إطارًا بعد كل مفتاح) حركةُ كاميرا لا قص ثابت؛ تُفحص الأطراف لا العبور
    const transit = shot.cam.some((k) => frame > k.t && frame < k.t + 22);
    for (const sp of shot.spans ?? []) {
      if (sp.moving || transit) continue;
      const inside = sp.lo >= v0 + margin && sp.hi <= v1 - margin;
      const outside = sp.hi <= v0 - margin / 2 || sp.lo >= v1 + margin / 2;
      if (sp.must ? !inside : !(inside || outside)) out.push(`${s.id}@${frame} ${sp.id}${sp.must ? "" : "?"} ${sp.lo.toFixed(0)}..${sp.hi.toFixed(0)} in ${v0.toFixed(0)}..${v1.toFixed(0)}`);
    }
  }
  return out;
};
