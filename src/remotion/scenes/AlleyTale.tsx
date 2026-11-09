import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { SceneShell } from "./SceneShell";
import { estimateTimings } from "./timing";
import { exit } from "./motion";
import { sentenceGroups } from "../../plan/beats";
import { autoCameraPlan, cameraCuts, isComposed, moveFrames, parseCameraPlan, parsePoseTimeline, shotZoom, type CamShot, type CamTarget } from "../../plan/director";
import { cueFrames, isSacredSentence, parseCues, type CueKind } from "../../plan/sceneCues";
import { Figure, LOOKS, poseAt, walkPose, type PoseName, type Holding } from "../illus/Figure";
import { useTransition } from "./transitions";
import { figureSpan, fitFrame } from "../illus/framing";
import { cleanAutoFraming, framingClean } from "../illus/edgeSafety";
import { groupFullyVisible, pillClearOfOwner, requiresFocusCut } from "../illus/compositionSafety";
import { fitDistance, fitDistanceWithin, GAIT_IDS, locomote, withCarry, locoPose, poseAtNatural, type GaitId, type Move, type Turn } from "../illus/gait";
import { ID, MOODS, darken, mix, stoneFor, type Mood } from "../illus/palette";
import { Ripples, Workbench, ArchDoor, Bench, Cobbles, GROUND, Glow, HouseRow, NoticeBoard, Skyline, Sky, WallLamp, WordPill, WW, WH, archPath, cameraTransform, clampOpt, rand, rise, type Camera } from "../illus/world";
import { TopCaption, captionLines } from "../illus/TopCaption";
import { Home, Market } from "../illus/places";
import type { SceneBase, StringFields } from "./types";
import { SHOTS } from "../illus/shots";
import { camAt, camTransform, makeAt } from "../illus/shots/kit";
import { Grade, Texture } from "../illus/texture";
import { AmbientGrade, BackHalo, DepthLayer, ForegroundFrame, LitFigure, SceneFigure, WorldLight, lightAt, parallaxDepth, parseLighting } from "../illus/light";

/**
 * «حكايات الحارة»: كل جملة لقطة في مكان مرسوم (حارة، سوق، بيت)، وبطل بلا ملامح يمثّل ما يُقال،
 * والضوء يحمل المعنى: نافذة تضيء عند «الحقيقة»، وباب يتسرب منه النور عند «الاعتراف»، ولوحة تتوهج عند «الخبر».
 * كل لقطة (جملة) بتأطير مختلف (واسع، متوسط، قريب) وانتقال ناعم، والأحداث تقع لحظة نطق كلمتها فقط.
 */
/** مواضع «الناس حوله» (أطياف شفافة) من البطل. حين يقف رفيق بجواره تبتعد الأطياف عن موضعه فلا تتداخل معه
 * (كان الطيف الأول على بُعد 70 من الرفيق، فيظهر ملتصقًا به: c2-s3 وc2-s4، ٩ نوفمبر). */
export const ghostSlots = (companionDx: number | null, portrait = false): { dx: number; look: (typeof LOOKS)[keyof typeof LOOKS]; d: number; back?: boolean }[] => {
  // العمودي مع رفيق: لا يتسع الإطار الضيق لأطياف على جانبي الاثنين، فطيفان خلفهما في العمق بينهما (أصغر وأبعد)،
  // لا يلتصقان بأحد ولا يُقصّان عند الحافة (c2-s3، c2-s4، ٩ نوفمبر)
  if (portrait && companionDx !== null)
    return [
      { dx: companionDx / 2 - 55, look: LOOKS.woman, d: 0, back: true },
      { dx: companionDx / 2 + 55, look: LOOKS.elder, d: 8, back: true },
    ];
  const base = [
    { dx: -330, look: LOOKS.woman, d: 0 },
    { dx: -560, look: LOOKS.elder, d: 8 },
    { dx: 300, look: LOOKS.friend, d: 16 },
  ];
  if (companionDx === null) return base;
  return [
    { dx: companionDx - 250, look: LOOKS.woman, d: 0 },
    { dx: 300, look: LOOKS.elder, d: 8 },
    { dx: 540, look: LOOKS.friend, d: 16 },
  ];
};

export type AlleyTaleProps = SceneBase & StringFields<"place" | "mood" | "moodTo" | "camera" | "cameraMode" | "cameraPlan" | "cameraPlanPortrait" | "framing" | "gait" | "lighting" | "poseTimeline" | "poses" | "cues" | "look" | "cast" | "shot"> & { continues?: boolean };

export type Place = "alley" | "market" | "home";
const MOOD_IDS: Mood[] = ["night", "deep", "dusk", "predawn", "dawn", "day"];
const asMood = (m: string | undefined, d: Mood): Mood => (MOOD_IDS.includes(m as Mood) ? (m as Mood) : d);
const POSE_IDS = ["stand", "think", "sit", "sit-low", "head-down", "hold", "cross", "point", "look-up", "nod", "turn-away", "walk", "proud", "apologize", "listen", "talk"] as const;

/** إيماءة ثانوية من الوضعية نفسها في منتصف السطر (يومئ، يرفع رأسه، يعتدل). */
const SECOND: Record<string, PoseName> = { stand: "think", think: "stand", nod: "cross", sit: "head-down", "sit-low": "look-up", "head-down": "sit-low", "look-up": "think", hold: "nod", cross: "think", "turn-away": "cross", point: "stand" };

/**
 * وضعيات السطر من s0 إلى s1: وضعيته، ثم إيماءة ثانوية في السطر الطويل وعودة.
 * في جملة فيها ذكر الله أو دعاء أو آية لا إيماءة: البطل ساكن على وضعيته (isSacredSentence).
 */
export const linePoses = (p: PoseName, s0: number, s1: number, o: { directed: boolean; walking: boolean; sacred: boolean }): { at: number; pose: PoseName }[] => {
  const out = [{ at: s0, pose: p }];
  if (o.sacred || o.directed || o.walking) return out;
  if (s1 - s0 > 50) out.push({ at: s0 + Math.round((s1 - s0) * 0.3), pose: SECOND[p] ?? "nod" });
  if (s1 - s0 > 90) out.push({ at: s0 + Math.round((s1 - s0) * 0.78), pose: p });
  return out;
};
export type ActionId = (typeof POSE_IDS)[number];

/** أطر اللقطات بالتناوب: واسع ← متوسط ← قريب */
const FRAMINGS = [1.08, 1.38, 1.6, 1.24];

/** لقطة مصمَّمة لجملتها (shot): مكانها وشخوصها وكاميرتها وأحداثها على توقيت الكلمات */
const ShotScene: React.FC<AlleyTaleProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: dur } = useVideoConfig();
  const portrait = props.orientation === "portrait";
  const narration = props.narration ?? "";
  const timings = narration ? (props.narrationTimings ?? estimateTimings(narration, 6, dur - 12)) : [];
  const shot = SHOTS[props.shot!]!.render({ frame, fps, dur, portrait, at: makeAt(timings, dur) });
  const c = camAt(frame, shot.cam);
  // دفع بطيء متصل للكاميرا طوال اللقطة (فوق مفاتيحها)
  const drift = props.cameraMode === "directed" ? 0 : 0.045 * (frame / dur);
  const vb = portrait ? `${960 - 304} 0 608 1080` : `0 0 ${WW} ${WH}`;
  const out = props.continues ? 1 : exit(frame, dur, 8);
  const keys = cueFrames(parseCues(props.cues), timings).map((k) => k.word);
  return (
    <SceneShell {...props} eyebrow={undefined} captions={false} motif={false} background={darken(ID.night, 0.4)} durationInFrames={dur} exitFrames={props.continues ? 0 : 8}>
      <AbsoluteFill>
        <svg viewBox={vb} preserveAspectRatio="xMidYMid slice" width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          <g transform={camTransform(c, drift)}>{shot.world}</g>
          {shot.overlay && !portrait ? shot.overlay : null}
          <Grade w={WW} h={WH} tint={shot.tint} tintOpacity={shot.tintOpacity} vignette={0.5} />
          <Texture kind="grain" w={WW} h={WH} opacity={0.18} tile={256} blend="overlay" />
        </svg>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.5) 0%, rgba(0,0,0,0) 20%)" }} />
      </AbsoluteFill>
      <TopCaption frame={frame} fps={fps} timings={timings} keys={keys} portrait={portrait} out={out} />
    </SceneShell>
  );
};

export const AlleyTale: React.FC<AlleyTaleProps> = (props) => (props.shot && SHOTS[props.shot] ? <ShotScene {...props} /> : <AlleyTaleBase {...props} />);

const AlleyTaleBase: React.FC<AlleyTaleProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: dur } = useVideoConfig();
  const portrait = props.orientation === "portrait";
  const narration = props.narration ?? "";
  const timings = narration ? (props.narrationTimings ?? estimateTimings(narration, 6, dur - 12)) : [];
  const place = (["alley", "market", "home"].includes(props.place ?? "") ? props.place : "alley") as Place;
  const mood = asMood(props.mood, "night");
  const moodTo = props.moodTo ? asMood(props.moodTo, mood) : undefined;
  // composed: كاميرا مؤلَّفة بحركات قليلة لها سبب؛ ومثل directed: لا تأطير آلي متكرر، ولا خطوات بين علامات ثابتة، ولا إيماءات حشو
  const composed = isComposed(props.cameraMode);
  const directed = props.cameraMode === "directed" || composed;
  const camera = (composed ? "still" : directed ? (props.camera || "still") : (props.camera || "push")) as Camera;
  const cues = cueFrames(parseCues(props.cues), timings);
  const at = (k: CueKind) => cues.find((c) => c.kind === k)?.at;
  const look = LOOKS[(props.look as keyof typeof LOOKS) || "hero"] ?? LOOKS.hero;
  // من في المشهد: البطل وحده، أو شخص أمامه (خلاف، اعتذار، إصغاء، كلمة جارحة)، أو شاهدان على موقف واحد
  const has = (k: CueKind) => cues.some((c) => c.kind === k);
  const stage: "solo" | "companion" | "witnesses" =
    props.cast === "witnesses" || has("witnesses") ? "witnesses" : props.cast === "companion" || has("companion") || has("harsh") || has("apologize") || has("listen") || has("debate") ? "companion" : "solo";

  // اللقطات: سطر الكابشن لقطة (نحو 3–4 ثوانٍ)، بتأطير مختلف لكل لقطة وانتقال ناعم بينها.
  // وحركة البطل من poses بحسب الجملة التي يقع فيها السطر.
  const groups = sentenceGroups(narration, 3);
  const groupStarts: number[] = [];
  let wi = 0;
  for (const g of groups) {
    groupStarts.push(Math.max(0, (timings[wi]?.start ?? 0) - 6));
    wi += g.split(/\s+/).filter(Boolean).length;
  }
  groupStarts[0] = 0;
  const lines = captionLines(timings, portrait ? 6 : 8);
  const starts = lines.map((l, i) => (i === 0 ? 0 : Math.max(0, (l[0]?.start ?? 0) - 6)));
  if (!starts.length) starts.push(0);
  const shot = Math.max(0, starts.filter((s) => frame >= s).length - 1);
  // لقطات التأطير: كل سطر لقطة، والسطر الطويل (أكثر من ثانيتين ونصف) لقطتان، فلا يسكن الكادر أكثر من ثانيتين
  const cuts = cameraCuts(starts, dur, directed);
  const cut = Math.max(0, cuts.filter((s) => frame >= s).length - 1);
  const groupOf = (f: number) => Math.max(0, groupStarts.filter((s) => f >= s).length - 1);
  const poses = (props.poses || "stand").split(",").map((p) => p.trim()).filter((p): p is ActionId => (POSE_IDS as readonly string[]).includes(p));
  const actionOf = (g: number): ActionId => poses[Math.min(g, poses.length - 1)] ?? "stand";
  const action = actionOf(groupOf(frame));
  const sitting = poses.some((p) => p === "sit" || p === "sit-low" || p === "head-down");

  // موضع البطل في إطار ما (كما يُحسب أدناه لإطار المشهد الحالي)، لتصحيح تأطير كل لقطة سلفًا
  const MARKS = [1060, 880, 1180, 960];
  const heroAt = (f: number): number => {
    if (stage !== "solo") return stage === "witnesses" ? 640 : 1160;
    let x = 1060;
    let walk = false;
    const gf = groupOf(f);
    for (let g = 0; g <= gf; g++) {
      if (actionOf(g) !== "walk") continue;
      const s0 = groupStarts[g]!;
      const s1 = groupStarts[g + 1] ?? dur;
      const d = Math.min(f, s1) - s0;
      if (d > 0) x -= d * 3.4;
      if (g === gf) walk = true;
    }
    if (!directed && !walk && !sitting && !poses.includes("walk") && !isSacredSentence(narration)) {
      const sh = Math.max(0, starts.filter((st) => f >= st).length - 1);
      const m0 = MARKS[Math.max(0, sh - 1) % MARKS.length]!;
      const m1 = MARKS[sh % MARKS.length]!;
      const tm = sh === 0 ? 1 : interpolate(f, [starts[sh]! + 8, starts[sh]! + 36], [0, 1], { ...clampOpt, easing: Easing.inOut(Easing.sin) });
      x = m0 + (m1 - m0) * tm;
    }
    return Math.max(420, x);
  };

  // البطل: يمشي في لقطات المشي من اليمين إلى اليسار (اتجاه القراءة)
  // البطل: في المشي يعبر الحارة، وفي الوقوف ينتقل بخطوات قليلة إلى علامة جديدة مع كل سطر (كممثل على خشبة)
  let heroX = 1060;
  let walking = false;
  let stepping = false;
  for (let g = 0; g <= groupOf(frame); g++) {
    if (actionOf(g) !== "walk") continue;
    const s0 = groupStarts[g]!;
    const s1 = groupStarts[g + 1] ?? dur;
    const f = Math.min(frame, s1) - s0;
    if (f > 0) heroX -= f * 3.4;
    if (g === groupOf(frame)) walking = true;
  }
  if (stage !== "solo") heroX = stage === "witnesses" ? 640 : 1160;
  // جملة فيها ذكر الله: البطل ساكن في مكانه، والكاميرا وحدها تتحرك
  else if (!directed && !walking && !sitting && !poses.includes("walk") && !isSacredSentence(narration)) {
    const m0 = MARKS[Math.max(0, shot - 1) % MARKS.length]!;
    const m1 = MARKS[shot % MARKS.length]!;
    const tm = shot === 0 ? 1 : interpolate(frame, [starts[shot]! + 8, starts[shot]! + 36], [0, 1], { ...clampOpt, easing: Easing.inOut(Easing.sin) });
    heroX = m0 + (m1 - m0) * tm;
    stepping = tm > 0 && tm < 1;
  }
  heroX = Math.max(420, heroX);
  const stepDir = MARKS[shot % MARKS.length]! < MARKS[Math.max(0, shot - 1) % MARKS.length]!;
  const facingLeft = stage === "companion" ? action !== "turn-away" : stage === "witnesses" ? false : walking || action === "turn-away" || (stepping && stepDir);

  // الحركة الطبيعية (الكاميرا المؤلَّفة، الأمر 006): مشية بحسب الحالة، تسارع وتباطؤ، قدم ثابتة،
  // والتفاتة بالجسد نحو ما يحدث (الباب) بدل الانقلاب الفوري، وثوب يتابع الجسد
  const gait: GaitId = (GAIT_IDS as readonly string[]).includes(props.gait ?? "") ? (props.gait as GaitId) : "walk";
  const HERO_SCALE = 1.75;
  const tc = useTransition();
  let loco: ReturnType<typeof locomote> | null = null;
  let locoOpts: Parameters<typeof locomote>[1] | null = null;
  if (composed && stage === "solo" && !sitting) {
    const moves: Move[] = [];
    const turns: Turn[] = [];
    let room = 1060 - 420;
    for (let g = 0; g < groupStarts.length; g++) {
      const s0 = groupStarts[g]!;
      const s1 = groupStarts[g + 1] ?? dur;
      if (actionOf(g) === "walk") {
        const available = Math.max(0, s1 - s0 - 6);
        // New contained scenes stop walking before their next cue. Legacy authored
        // locomotion keeps its original distance and duration.
        const bounded = props.framing === "fit";
        const d = Math.min(room, bounded
          ? fitDistanceWithin(gait, available, HERO_SCALE, fps)
          : fitDistance(gait, available, HERO_SCALE, fps));
        if (d > 4) moves.push({ start: s0 + 2, dx: -d, gait, ...(bounded ? { durationFrames: available } : {}) });
        room -= d;
      } else if (actionOf(g) === "turn-away") turns.push({ at: s0 + 2, to: -1 });
    }
    const firstWalk = moves[0]?.start ?? Infinity;
    // يلتفت نحو الباب حين يُذكر، إن كان ظهره إليه
    const doorAt = at("door");
    if (doorAt !== undefined) turns.push({ at: Math.max(0, doorAt - 6), to: 1, dur: 20 });
    // استمرار الحركة عبر حد المشهد (الأمر 011، الانتقال carry)؛ بدونه الخطة كما كانت حرفيًا
    const { x0, facing0, moves: planned } = withCarry({ x0: 1060, facing0: firstWalk <= 2 ? -1 : 1, moves, turns, gait, dur, fps, scale: HERO_SCALE, worldW: WW, ...(tc.carryIn ? { carryIn: tc.carryIn } : {}), ...(tc.carryOut ? { carryOut: tc.carryOut } : {}) });
    locoOpts = { x0, facing0, moves: planned, turns, scale: HERO_SCALE, fps };
    loco = locomote(frame, locoOpts);
    heroX = loco.x;
    walking = loco.moving;
  }

  // وضعية كل لقطة، وفي منتصف السطر إيماءة ثانوية من الوضعية نفسها (يومئ، يرفع رأسه، يعتدل)
  const timeline: { at: number; pose: PoseName }[] = [];
  // جملة فيها ذكر الله أو دعاء أو آية: لا إيماءة ثانوية؛ البطل ساكن على وضعيته (القاعدة الثالثة)
  const sacredGroups = groups.map((g) => isSacredSentence(g));
  lines.forEach((l, i) => {
    const g = groupOf((l[0]?.start ?? 0) + 1);
    const a = actionOf(g);
    const p = (a === "walk" ? "stand" : a) as PoseName;
    const s0 = starts[i] ?? 0;
    const s1 = starts[i + 1] ?? dur;
    timeline.push(...linePoses(p, s0, s1, { directed, walking: a === "walk", sacred: Boolean(sacredGroups[g]) }));
  });
  // إيماءة عند الكلمة المفتاحية في اللقطة: يتأمل/يومئ
  const thinkAt = at("think");
  if (thinkAt !== undefined && !sitting) timeline.push({ at: thinkAt, pose: "think" });
  const newsAt = at("news");
  if (newsAt !== undefined && !sitting) timeline.push({ at: newsAt + 10, pose: "nod" }, { at: newsAt + 34, pose: "hold" });
  // أحداث المعاني الجديدة على البطل
  const ev = (k: CueKind, p: PoseName, back?: PoseName, hold = 50) => {
    const t = at(k);
    if (t === undefined || sitting) return;
    timeline.push({ at: t, pose: p });
    if (back) timeline.push({ at: t + hold, pose: back });
  };
  ev("proud", "proud", "stand", 60);
  ev("apologize", "apologize", "nod", 70);
  ev("listen", "listen");
  ev("debate", "talk", "point", 40);
  ev("harsh", "talk", "cross", 50);
  ev("spread", "hold");
  ev("money", "hold");
  ev("evidence", "hold");
  // Apply authored poses after automatic/semantic events: at the same frame the director wins.
  for (const event of parsePoseTimeline(props.poseTimeline)) {
    if ((POSE_IDS as readonly string[]).includes(event.pose)) timeline.push({ at: event.at, pose: event.pose as PoseName });
  }
  let pose = composed ? poseAtNatural(frame, timeline) : poseAt(frame, timeline);
  if (loco) pose = locoPose(pose, loco);
  else if (walking) pose = walkPose(pose, (frame / fps) * Math.PI * 2 * 0.95);
  else if (stepping) pose = walkPose(pose, (frame / fps) * Math.PI * 2 * 0.95, 0.85);
  const holding: Holding = has("spread") ? "phone" : has("money") && frame >= (at("money") ?? 0) - 6 ? "coins" : has("evidence") && frame >= (at("evidence") ?? 0) - 6 ? "book" : action === "hold" || newsAt !== undefined ? "paper" : "none";

  // الشخص الذي أمامه: يتألم من الكلمة الجارحة، ويُصغي للاعتذار، ويتكلم حين يُصغي البطل
  const compTimeline: { at: number; pose: PoseName }[] = [{ at: 0, pose: "stand" }];
  const ct = (k: CueKind, p: PoseName, back?: PoseName, d = 4) => {
    const t = at(k);
    if (t === undefined) return;
    compTimeline.push({ at: t + d, pose: p });
    if (back) compTimeline.push({ at: t + d + 60, pose: back });
  };
  ct("harsh", "flinch", "head-down" as PoseName);
  ct("apologize", "listen", "nod", 20);
  ct("listen", "talk", "talk");
  ct("debate", "point", "talk", 24);
  ct("companion", "nod", "stand", 8);
  // المسافة بين البطل والرفيق: في العمودي أقرب (330) ليتسع الإطار الضيق للاثنين (c2-s3، ٩ نوفمبر)،
  // لكن لا تلتقي يداهما أبدًا: المسافة لا تقل عن مجموع امتداد أطول وضعيتين متقابلتين وفراغ بينهما.
  // (حين التقت اليدان في «اختلفت» بدا الجدال مصافحة: c3-s1 بالعمودي، المعاينة المباشرة ٩ نوفمبر)
  const heroFront = -figureSpan(0, [...new Set<PoseName>([...timeline.map((x) => x.pose), "stand"])], "left", 1.75).lo;
  const compFront = figureSpan(0, [...new Set<PoseName>(compTimeline.map((x) => (x.pose === "head-down" ? "nod" : x.pose)))], "right", 1.7).hi;
  const compGap = Math.max(portrait ? 330 : 400, Math.round(heroFront + compFront + 70));
  const compPose = poseAt(frame, compTimeline.map((x) => ({ ...x, pose: x.pose === "head-down" ? "nod" : x.pose })));
  const compIn = rise(frame, 0, 14);

  // الأحداث
  const truth = rise(frame, at("truth"), 22);
  const wrong = rise(frame, at("wrong"), 16);
  const just = rise(frame, at("just"), 16);
  const news = rise(frame, newsAt, 16);
  const door = rise(frame, at("door"), 30);
  const people = rise(frame, at("people"), 24);
  const spread = rise(frame, at("spread"), 10);
  const success = rise(frame, at("success"), 24);
  const hasBench = has("work") || has("success");
  const memory = cues.filter((c) => c.kind === "memory" || c.kind === "wrong" || c.kind === "just");
  const skyT = moodTo ? interpolate(frame, [dur * 0.35, dur - 10], [0, 1], { ...clampOpt, easing: Easing.inOut(Easing.sin) }) : 0;
  // انتقال المزاج داخل المشهد: يُرسم المكان بمزاج البداية، وفوقه المكان نفسه بمزاج النهاية بشفافية skyT،
  // فتتدرّج ألوانه مع السماء. (كان يتبدّل دفعة واحدة عند skyT = 0.5، فيومض المكان في إطار واحد: c2-s16، ٩ نوفمبر)
  const moodLayers = (draw: (m: Mood) => React.ReactNode) => (
    <>
      {draw(mood)}
      {moodTo && skyT > 0 ? <g opacity={skyT}>{draw(moodTo)}</g> : null}
    </>
  );

  // النوافذ: ربع مضاء في الليل، و«الحقيقة» تضيء النوافذ القريبة من البطل واحدة بعد الأخرى
  const r = rand(11);
  const base = Array.from({ length: 200 }, () => r());
  const litRatio = mood === "day" ? 0 : mood === "dawn" ? 0.08 : mood === "deep" ? 0.1 : 0.24;
  const lit = (i: number) => {
    const b = (base[i] ?? 1) < litRatio ? 1 : 0;
    const wave = truth > 0 ? interpolate(truth * 12 - (i % 12), [0, 1], [0, 1], clampOpt) : 0;
    return Math.max(b, (base[i] ?? 0) < 0.6 ? wave : 0);
  };

  const out = exit(frame, dur, 8);
  const keys = cues.map((c) => c.word);
  const focusX = heroX;
  // عناصر المكان (الباب واللوحة) ثابتة في موضع البطل المعتاد حين يدخل أو يخرج ماشيًا عبر الحد (carry)، فلا تتبعه خارج الإطار
  // التأطير المحتوي (الأمر 013): الباب واللوحة ثابتان في مكانهما من العالم، حيث يقف البطل لحظة ذكرهما،
  // لا ينزلقان معه وهو يمشي (عيب قائم في التأطير القديم يبقى فيه كما هو)
  const propAnchor = props.cameraMode === "composed" && props.framing === "fit" && locoOpts ? locomote(Math.max(0, (at("door") ?? at("news") ?? dur - 1)), locoOpts).x : null;
  const propX = propAnchor !== null ? Math.max(420, Math.min(1060, propAnchor)) : tc.carryIn || tc.carryOut ? Math.max(420, Math.min(1060, heroX)) : heroX;
  // الكاميرا المؤلَّفة: مفاتيح قليلة (افتتاح + حركة أو اثنتان) على كلمات المعنى، بانتقال طويل هادئ
  const sacredScene = isSacredSentence(narration);
  // التأطير المحتوي (الأمر 013، framing = fit): الكاميرا تحتوي ما يلزم لفهم اللقطة ولا تقص غيره نصف قص.
  // بلا الحقل تبقى الكاميرا المؤلَّفة كما كانت حرفيًا
  const fitMode = composed && props.framing === "fit";
  const fit = fitMode ? fitFor({ heroX, propX, stage, portrait, sitting, walking, timeline, compTimeline, compX: heroX - compGap, hasDoor: at("door") !== undefined, hasBoard: newsAt !== undefined && place !== "home", ghosts: at("people") !== undefined, facingLeft, turnsAway: poses.includes("turn-away"), verdicts: { wrong: cues.find((c) => c.kind === "wrong")?.word, just: cues.find((c) => c.kind === "just")?.word } }) : undefined;
  const composedCam = composed ? composedCamera({ frame, dur, fps, heroX, stage, sacred: sacredScene, portrait, plan: portrait && props.cameraPlanPortrait ? props.cameraPlanPortrait : props.cameraPlan, cues, timings, ...(fit ? { fit, alternate: portrait } : {}) }) : null;
  // Visual QA at 7s found one of the two background actors cut at the left edge.
  // In opt-in contained portrait witnesses only, cut to a clean reaction shot:
  // show the two-person central action together or omit it together, never as half-figures.
  // Their visibility can change only when the existing authored camera framing changes.
  const showSituation = !fitMode || !portrait || stage !== "witnesses" || !composedCam ||
    groupFullyVisible({
      camera: composedCam, portrait, margin: 12,
      spans: [
        figureSpan(920, ["point", "talk"], "right", 1.15),
        figureSpan(1010, ["hold", "flinch"], "left", 1.15),
      ],
    });
  // الإضاءة والظلال والعمق (الأمر 008): اختيارية بحقل lighting، وبدونه لا يتغير شيء
  const rig = parseLighting(props.lighting);
  const light = rig ? lightAt(rig, frame, (w) => cueFrames([{ kind: "truth", word: w }], timings)[0]?.at) : null;
  // التأطير: لكل لقطة تكبير وجهة، وانتقال ناعم سريع بينها
  const rawFraming = (i: number) => directed ? { z: 1.08, dx: 0 } : ({ z: FRAMINGS[i % FRAMINGS.length]!, dx: [0, 260, -230, 140][i % 4]! });
  // لا شخص مقصوص عند حافة الإطار (٩ نوفمبر): كل لقطة تُصحَّح بأقل إزاحة حتى يكون كل شخص كاملًا داخلها أو خارجها كله
  // سياق فحص اللقطة عند الإطار at0 من نافذة اللقطة [w0, w1): الوضعيات والأطياف كلها التي تظهر في النافذة
  const edgeCtx = (at0: number, win?: [number, number]) => {
    const hx = heroAt(at0);
    const gap = compGap;
    const i = Math.max(0, cuts.filter((c) => at0 >= c).length - 1);
    const w0 = win ? win[0] : cuts[i] ?? 0;
    const w1 = win ? win[1] : cuts[i + 1] ?? dur;
    // الوضعيات التي تقع في نافذة اللقطة (ومعها ما قبلها مباشرة)، لا أوسع وضعية في المشهد كله
    const posesIn = (tl0: { at: number; pose: PoseName }[]): PoseName[] => {
      const tl = [...tl0].sort((a, b) => a.at - b.at);
      const before = tl.filter((x) => x.at <= w0).slice(-1);
      return [...before, ...tl.filter((x) => x.at > w0 && x.at < w1)].map((x) => x.pose);
    };
    const heroPoses = timeline.length ? posesIn(timeline) : (["stand"] as PoseName[]);
    const heroFacing = stage === "companion" ? (poses.includes("turn-away") ? "both" : "left") : "both";
    // هامش 12% فوق امتداد الوضعية: اليد في منتصف الانتقال بين وضعيتين قد تمتد أبعد من كلتيهما
    const span = (x: number, sc: number, ps: readonly PoseName[] = ["stand"], facing: "left" | "right" | "both" = "both") => {
      const r = figureSpan(x, ps.length ? ps : ["stand"], facing, sc);
      return { lo: x - (x - r.lo) * 1.12, hi: x + (r.hi - x) * 1.12 };
    };
    const optional = [] as { lo: number; hi: number }[];
    if (stage === "companion") optional.push(span(hx - gap, 1.7, posesIn(compTimeline), "right"));
    if (stage === "witnesses") optional.push({ lo: span(920, 1.15).lo, hi: span(1010, 1.15).hi }, span(1300, 1.75));
    const peopleAt = at("people");
    if (peopleAt !== undefined && peopleAt < w1) for (const g of ghostSlots(stage === "companion" ? -gap : null, portrait)) optional.push(span(hx + g.dx, g.back ? 0.95 : 1.25));
    const pf = stage === "companion" ? hx - gap / 2 : hx;
    const v0 = Math.max(0, Math.min(WW - 608, pf - 304));
    return { focusX: hx, view: (portrait ? [v0, v0 + 608] : [0, WW]) as [number, number], required: [span(hx, 1.75, sitting ? [...heroPoses, "sit"] : walking ? [...heroPoses, "walk" as PoseName] : heroPoses, heroFacing)], optional, margin: portrait ? 40 : 36, zMin: portrait ? 0.84 : undefined, layers: [0.6, 0.9].map((depth) => ({ depth, lo: -200, hi: WW + 200 })) };
  };
  // اللقطة كلها: سياقات عند بدايتها ووسطها ونهايتها (البطل قد ينتقل بين مواضعه، أو يمشي)
  const cutCtxs = (i: number) => {
    const w0 = cuts[i] ?? 0;
    const w1 = Math.min(dur, cuts[i + 1] ?? dur);
    const n = Math.max(2, Math.ceil((w1 - w0) / 12));
    return Array.from({ length: n + 1 }, (_, k) => edgeCtx(Math.min(dur - 1, Math.round(w0 + ((w1 - 1 - w0) * k) / n)), [w0, w1]));
  };
  const edgeSafe = (f: { z: number; dx: number }, i: number) => cleanAutoFraming(f, cutCtxs(i));
  const framing = (i: number) => (composed ? rawFraming(i) : edgeSafe(rawFraming(i), i));
  // افتتاح كل مشهد بحركة تأسيسية من لقطة واسعة، ثم انتقال ناعم بين اللقطات
  const fa = directed ? framing(cut) : cut === 0 ? (composed ? { z: 0.96, dx: -240 } : edgeSafe({ z: 0.96, dx: -240 }, 0)) : framing(cut - 1);
  const fb = framing(cut);
  // إن مرّ الانتقال الناعم بين لقطتين بإطار يقص شخصًا، فالانتقال قطع مباشر (لا يظهر نصف شخص ولو لحظة)
  const tweenLen = cut === 0 ? 26 : 16;
  const tweenClean = composed || directed || [0.1, 0.25, 0.4, 0.55, 0.7, 0.85].every((t) => {
    const e = Easing.inOut(Easing.cubic)(t);
    const ctx = edgeCtx(Math.min(dur - 1, cuts[cut]! + Math.round(t * tweenLen)));
    return framingClean({ z: fa.z + (fb.z - fa.z) * e, dx: fa.dx + (fb.dx - fa.dx) * e }, ctx);
  });
  const tShot = tweenClean
    ? interpolate(frame, [cuts[cut]!, cuts[cut]! + (cut === 0 ? 26 : 16)], [0, 1], { ...clampOpt, easing: Easing.inOut(Easing.cubic) })
    : frame >= cuts[cut]! ? 1 : 0;
  const zoom = fa.z + (fb.z - fa.z) * tShot;
  const offX = fa.dx + (fb.dx - fa.dx) * tShot;
  const cam = (d: number) => camRaw(light ? parallaxDepth(d, light) : d);
  const camRaw = (depth: number) =>
    composedCam
      ? composedLayer(composedCam, depth)
      : `${cameraTransform(camera, frame, dur, depth, focusX)} translate(${-offX * (0.4 + depth * 0.6)} 0) translate(${focusX} ${GROUND - 330}) scale(${1 + (zoom - 1) * (0.55 + depth * 0.45)}) translate(${-focusX} ${-(GROUND - 330)})`;
  // العمودي في الكاميرا المؤلَّفة: الهدف في منتصف الإطار دائمًا، فلا يُقص ما تنظر إليه الكاميرا
  // ومع رفيق بجواره (كاميرا تلقائية): الإطار العمودي على منتصف الاثنين، فلا يُقص الرفيق نصفين (c2-s3، ٩ نوفمبر)
  const portraitFocus = stage === "companion" ? heroX - compGap / 2 : focusX;
  // مِجَسّ الاختبار (tests/edge-safety-episode.test.tsx): التأطير الفعلي لهذا الإطار وسياق فحصه، ولا أثر له في الرندر
  const probe = (globalThis as { __BAL_EDGE_PROBE__?: unknown[] }).__BAL_EDGE_PROBE__;
  if (probe && !composedCam) probe.push({ frame, zoom, offX, ctx: edgeCtx(frame, [cuts[cut]!, cuts[cut + 1] ?? dur]) });
  const vb = portrait ? (composedCam ? `${960 - 304} 0 608 1080` : `${Math.max(0, Math.min(WW - 608, portraitFocus - 304))} 0 608 1080`) : `0 0 ${WW} ${WH}`;

  // حافتا الإطار الظاهر في طبقة المقدمة (عمق 1.3) عند بداية المشهد، فيقع العمود على طرفه في الأفقي والعمودي معًا،
  // ثم يتحرك مع الكاميرا بسرعة طبقته (منظور حقيقي)
  const fgEdges = (() => {
    if (!light?.rig.depth.fg || !portrait) return {};
    if (!composedCam) return { x0: Math.max(0, Math.min(WW - 608, focusX - 304)), w: 608 };
    const c0 = composedCamera({ frame: 0, dur, fps, heroX, stage, sacred: sacredScene, portrait, plan: props.cameraPlanPortrait || props.cameraPlan, cues, timings });
    const k = 0.4 + parallaxDepth(1.3, light) * 0.6;
    const z = 1 + (c0.z - 1) * (0.55 + parallaxDepth(1.3, light) * 0.45);
    const toWorld = (sx: number) => (sx - 960) / z + 960 + (c0.x - 960) * k;
    return { x0: toWorld(656), w: toWorld(1264) - toWorld(656) };
  })();
  const hasBoard = newsAt !== undefined && place !== "home";
  const hasDoor = at("door") !== undefined;
  const ghosts = at("people") !== undefined;

  return (
    <SceneShell {...props} eyebrow={undefined} captions={false} motif={false} background={darken(ID.night, 0.4)} durationInFrames={dur}>
      <AbsoluteFill>
        <svg viewBox={vb} preserveAspectRatio="xMidYMid slice" width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          <g transform={cam(0)}>
            <DepthLayer depth={0} light={light}>
              <Sky mood={mood} to={moodTo} t={skyT} frame={frame} />
            </DepthLayer>
          </g>
          {place === "alley" ? (
            <>
              <g transform={cam(0.25)}>
                <DepthLayer depth={0.25} light={light}>
                  {moodLayers((m) => <Skyline mood={m} dome={760} minaret={1260} seed={5} />)}
                </DepthLayer>
              </g>
              <g transform={cam(0.6)}>
                <DepthLayer depth={0.6} light={light}>
                  {moodLayers((m) => (
                    <>
                      <HouseRow mood={m} seed={place === "alley" ? 4 : 9} lit={lit} />
                      {hasDoor ? <ArchDoor x={propX + 250} w={190} h={310} light={door} mood={m} /> : null}
                      {hasBoard ? <NoticeBoard x={propX - 430} y={GROUND - 470} glow={news} mood={m} /> : null}
                    </>
                  ))}
                  {/* المصباح إلى جانب الجالس لا فوق رأسه (كان يبدو شيئًا على رأسه: c3-s4، c6-s1، c6-s5) */}
                  {sitting ? <WallLamp x={heroX + 200} y={GROUND - 440} on={1} frame={frame} /> : null}
                </DepthLayer>
              </g>
            </>
          ) : place === "market" ? (
            <g transform={cam(0.6)}>
              <DepthLayer depth={0.6} light={light}>
                {moodLayers((m) => (
                  <>
                    <Market mood={m} frame={frame} lit={truth} />
                    {hasBoard ? <NoticeBoard x={propX - 430} y={GROUND - 470} glow={news} mood={m} /> : null}
                  </>
                ))}
              </DepthLayer>
            </g>
          ) : (
            <g transform={cam(0.6)}>
              <DepthLayer depth={0.6} light={light}>
                {moodLayers((m) => <Home mood={m} frame={frame} lit={truth} />)}
              </DepthLayer>
            </g>
          )}
          <g transform={cam(0.9)}>
            {moodLayers((m) => (
              <>
                {place !== "home" ? <Cobbles mood={m} tint={wrong > just ? ID.seal : ID.dawn} tintOpacity={0.1 * Math.max(wrong, just)} /> : null}
                {sitting ? <Bench x={heroX - 60} w={240} mood={m} /> : null}
              </>
            ))}
            {/* لون الحكم: الخطأ أحمر الختم، والعدل فجر */}
            <Glow cx={stage === "witnesses" ? 640 : heroX - 520} cy={GROUND - 160} r={420} color={ID.seal} opacity={wrong * 0.9} />
            <Glow cx={stage === "witnesses" ? 1300 : heroX + 520} cy={GROUND - 160} r={420} color={ID.dawn} opacity={just * 0.9} />
            <Glow cx={heroX} cy={GROUND - 260} r={460} color={ID.dawn} opacity={truth * 0.45} />
          </g>
          {light ? (
            <>
              <AmbientGrade light={light} />
              <g transform={cam(0.6)}>
                <WorldLight light={light} frame={frame} drawLamp={place !== "home"} room={place === "home"} window={{ x: 1200, w: 320, h: 440 }} />
              </g>
            </>
          ) : null}
          <g transform={cam(1)}>
            {/* الناس حوله: أطياف شفافة لمن يؤثرون فيه */}
            {ghosts
              ? ghostSlots(stage === "companion" ? -compGap : null, portrait).map((g, i) => (
                  <Figure key={i} x={heroX + g.dx} y={g.back ? GROUND - 60 : GROUND + 6} scale={g.back ? 0.95 : 1.25} pose={poseAt(frame, [{ at: 0, pose: "stand" }])} look={g.look} opacity={0.32 * rise(frame, (at("people") ?? 0) + g.d, 20)} silhouette={mix(ID.paper, ID.night, 0.35)} shadow={false} frame={frame + i * 9} />
                ))
              : null}
            {hasBench ? moodLayers((m) => <Workbench x={propX + 120} mood={m} done={success} />) : null}
            {stage === "companion" ? (
              light ? (
                <LitFigure light={light} x={heroX - compGap} y={GROUND + 6} scale={1.7} pose={compPose} look={look === LOOKS.woman ? LOOKS.elder : LOOKS.friend} opacity={compIn} frame={frame + 17} />
              ) : (
                <Figure x={heroX - compGap} y={GROUND + 6} scale={1.7} pose={compPose} look={look === LOOKS.woman ? LOOKS.elder : LOOKS.friend} opacity={compIn} frame={frame + 17} />
              )
            ) : null}
            {stage === "witnesses" ? (
              <g>
                {/* الموقف نفسه في الوسط، والشاهدان على طرفيه */}
                <Glow cx={960} cy={GROUND - 200} r={300} color={ID.paper} opacity={0.35} />
                {showSituation ? (
                  <>
                    <SceneFigure light={light} x={920} y={GROUND + 6} scale={1.15} pose={poseAt(frame, [{ at: 0, pose: "point" }, { at: 50, pose: "talk" }])} look={LOOKS.stranger} opacity={0.85} frame={frame + 5} />
                    <SceneFigure light={light} x={1010} y={GROUND + 6} scale={1.15} pose={poseAt(frame, [{ at: 0, pose: "hold" }, { at: 60, pose: "flinch" }])} look={LOOKS.elder} flip opacity={0.85} frame={frame + 9} />
                  </>
                ) : null}
                <SceneFigure light={light} x={1300} y={GROUND + 6} scale={1.75} pose={poseAt(frame, [{ at: 0, pose: "stand" }, { at: 40, pose: "think" }])} look={LOOKS.woman} flip frame={frame + 3} />
              </g>
            ) : null}
            <Ripples x={heroX - 70} y={GROUND - 300} t={spread} frame={frame} at={at("spread") ?? 0} />
            {light ? (
              <>
                <BackHalo x={heroX} y={GROUND + 6} scale={1.75} light={light} />
                <LitFigure light={light} x={heroX} y={GROUND + 6} scale={1.75} pose={pose} look={look} flip={facingLeft} {...(loco ? { facing: loco.facing, view: loco.view, sway: loco.sway } : {})} holding={holding} frame={frame} rim={Math.max(truth, door) * 0.8} />
              </>
            ) : (
              <Figure x={heroX} y={GROUND + 6} scale={1.75} pose={pose} look={look} flip={facingLeft} {...(loco ? { facing: loco.facing, view: loco.view, sway: loco.sway } : {})} holding={holding} frame={frame} rim={Math.max(truth, door) * 0.8} />
            )}
            {memory.map((c, i) => {
              const col = c.kind === "wrong" ? ID.seal : ID.dawn;
              const side = i % 2 ? 1 : -1;
              const witnessPill = stage === "witnesses" && c.kind !== "memory";
              const x0 = witnessPill ? (c.kind === "wrong" ? 640 : 1300) : heroX + side * (300 + i * 40);
              if (fitMode && witnessPill && composedCam) {
                // التأطير المحتوي: حكم كل شاهد بجوار رأسه من جهة الموقف (لا فوق رأسه)، ويخرج معه إن خرج من الإطار
                const p = witnessPillAt(x0, c.kind === "wrong" ? 1 : -1, c.word, composedCam, portrait, 46, witnessClear(c.kind));
                return p === null ? null : <WordPill key={c.word} x={p} y={GROUND - 420 - 40} text={c.word} color={col} t={rise(frame, c.at, 12)} />;
              }
              // الكاميرا المؤلَّفة: الكلمة داخل الإطار الظاهر كاملة (لا تُقص على حافته، خاصة في العمودي)
              const x = composedCam ? pillInView(x0, c.word, composedCam, portrait) : x0;
              return <WordPill key={c.word} x={x} y={GROUND - 420 - (stage === "witnesses" ? 40 : i * 56)} text={c.word} color={col} t={rise(frame, c.at, 12)} />;
            })}
          </g>
          {light?.rig.depth.fg ? (
            <g transform={cam(1.3)}>
              <DepthLayer depth={1.3} light={light}>
                <ForegroundFrame light={light} {...fgEdges} />
              </DepthLayer>
            </g>
          ) : null}
        </svg>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 78%, rgba(0,0,0,.4) 100%)" }} />
      </AbsoluteFill>
      <TopCaption frame={frame} fps={fps} timings={timings} keys={keys} portrait={portrait} out={out} safeWrap={fitMode} />
    </SceneShell>
  );
};

/** موضع الهدف في عالم المشهد */
const targetX = (t: CamTarget, heroX: number, stage: "solo" | "companion" | "witnesses") =>
  t === "hero" ? heroX : t === "pair" ? (stage === "companion" ? heroX - 200 : heroX) : t === "door" ? heroX + 250 : t === "board" ? heroX - 430 : 960;
/** المسافة بين البطل والهدف حين يجب أن يظهرا معًا (الباب واللوحة ومن أمامه) */
const targetSpan = (t: CamTarget, stage: "solo" | "companion" | "witnesses") => (t === "door" ? 250 : t === "board" ? 430 : t === "pair" && stage === "companion" ? 400 : 0);
/** عرض الإطار العمودي في عالم المشهد، والهامش المتروك على الجانبين */
const PORTRAIT_W = 608;
const PORTRAIT_KEEP = PORTRAIT_W - 160;
/**
 * هدف اللقطة: في الأفقي الهدف نفسه؛ وفي العمودي إن كان الهدف شيئًا مع البطل (باب، لوحة، من أمامه)
 * تؤطّر الكاميرا الاثنين معًا وتحدّ التكبير حتى يتسعا، فلا يُقص البطل خارج الإطار الضيق.
 */
export const shotFrame = (t: CamTarget, shot: CamShot, heroX: number, stage: "solo" | "companion" | "witnesses", portrait: boolean): CamState => {
  const span = targetSpan(t, stage);
  if (!portrait || span === 0) return frameOn(targetX(t, heroX, stage), shotZoom(shot), portrait);
  const tx = targetX(t, heroX, stage);
  const mid = t === "pair" ? tx : (heroX + tx) / 2;
  return frameOn(mid, Math.max(1, Math.min(shotZoom(shot), PORTRAIT_KEEP / span)), true);
};

/** منحنى كاميرا ثقيلة: بداية متأنية واستقرار طويل */
const camEase = Easing.bezier(0.42, 0, 0.18, 1);

type CamState = { x: number; y: number; z: number };
/** أعلى رأس البطل في العالم (الشخصية بمقياس 1.75 نحو 530 وحدة فوق الأرض) */
const HEAD_Y = GROUND - 540;
/** أقرب مسافة لأعلى الرأس من أعلى الإطار: تحت منطقة الترجمة العلوية */
const HEADROOM = 230;
/**
 * تأطير على هدف: الأرض عند 80% من الإطار ما دام الرأس تحت منطقة الترجمة، وإلا تنزل الأرض
 * (في اللقطة القريبة قد تقترب القدمان من الحافة السفلى، ولا يُقص الرأس أبدًا). ولا يظهر ما وراء حدود العالم.
 */
export const frameOn = (x: number, z: number, portrait = false): CamState => {
  // في العمودي يُرى من العالم 608 وحدات فقط في العرض
  const halfW = (portrait ? 304 : WW / 2) / z;
  const halfH = WH / 2 / z;
  const y = Math.min(GROUND - 320 / z, HEAD_Y + (540 - HEADROOM) / z);
  return { x: Math.max(halfW, Math.min(WW - halfW, x)), y: Math.max(halfH, Math.min(WH - halfH, y)), z };
};
/** موضع نقطة من العالم على الشاشة بتأطير ما (لاختبار الرأس والحدود) */
export const screenY = (c: CamState, worldY: number) => 540 + c.z * (worldY - c.y);
export const HERO_HEAD_Y = HEAD_Y;

/**
 * التأطير المحتوي لكل هدف (الأمر 013): ما يلزم لفهم اللقطة «مطلوب» يُحتوى كاملًا، وما سواه «اختياري»
 * يظهر كاملًا أو يخرج كاملًا. الحدود من وضعيات الشخصية في المشهد كله (غلاف ثابت).
 */
export const fitFor = (s: {
  heroX: number;
  propX: number;
  stage: "solo" | "companion" | "witnesses";
  portrait: boolean;
  sitting: boolean;
  walking: boolean;
  timeline: { pose: PoseName }[];
  compTimeline: { pose: PoseName }[];
  compX: number;
  hasDoor: boolean;
  hasBoard: boolean;
  ghosts: boolean;
  facingLeft: boolean;
  turnsAway: boolean;
  /** كلمتا حكم الشاهدين: تُحتويان مع صاحبيهما بجوار رأسيهما */
  verdicts?: { wrong?: string; just?: string };
}) => (t: CamTarget, shot: CamShot): CamState => {
  const heroPoses = [...new Set(s.timeline.map((e) => e.pose))] as (PoseName | "walk")[];
  if (s.walking) heroPoses.push("walk");
  const heroFacing = s.stage === "companion" ? (s.turnsAway ? "both" : "left") : s.stage === "witnesses" ? "right" : s.sitting ? (s.facingLeft ? "left" : "right") : "both";
  const hero = figureSpan(s.heroX, heroPoses, heroFacing, 1.75, "hero");
  // المقعد جزء من البطل الجالس
  // حكم كل شاهد بجواره جزء منه في التأطير (ليتسع الاثنان معًا)
  const vw = (w?: string) => (w ? pillWidth(w) : 0);
  const heroSeat = s.sitting ? { lo: Math.min(hero.lo, s.heroX - 60), hi: Math.max(hero.hi, s.heroX + 180), name: "hero" } : hero;
  const heroAll = s.stage === "witnesses" && s.verdicts?.wrong ? { ...heroSeat, hi: Math.max(heroSeat.hi, s.heroX + 48 + vw(s.verdicts.wrong)) } : heroSeat;
  const comp = s.stage === "companion" ? figureSpan(s.compX, [...new Set(s.compTimeline.map((e) => e.pose))], "right", 1.7, "companion") : null;
  const door = s.hasDoor ? { lo: s.propX + 250 - 16, hi: s.propX + 250 + 190 + 16, name: "door" } : null;
  const board = s.hasBoard ? { lo: s.propX - 430, hi: s.propX - 430 + 266, name: "board" } : null;
  const situation = s.stage === "witnesses" ? { lo: figureSpan(920, ["point", "talk"], "right", 1.15).lo, hi: figureSpan(1010, ["hold", "flinch"], "left", 1.15).hi, name: "situation" } : null;
  const second0 = s.stage === "witnesses" ? figureSpan(1300, ["stand", "think"], "left", 1.75, "witness2") : null;
  const second = second0 && s.verdicts?.just ? { ...second0, lo: Math.min(second0.lo, 1300 - witnessClear("just") - vw(s.verdicts.just)) } : second0;
  const ghosts = s.ghosts ? [-330, -560, 300].map((dx, i) => figureSpan(s.heroX + dx, ["stand"], "both", 1.25, `ghost${i}`)) : [];
  const all = [heroAll, comp, door, board, situation, second, ...ghosts].filter((x): x is NonNullable<typeof x> => Boolean(x));
  const pick = (req: (typeof all)[number] | null | undefined, ...more: ((typeof all)[number] | null | undefined)[]) => [req, ...more].filter((x): x is NonNullable<typeof x> => Boolean(x));
  const required =
    t === "pair" && comp ? pick(heroAll, comp)
    : t === "door" && door ? pick(heroAll, door)
    : t === "board" && board ? pick(heroAll, board)
    : t === "center" && situation ? pick(situation)
    : t === "other" && second ? pick(second)
    : t === "other" && comp ? pick(comp)
    : t === "center" ? []
    : pick(heroAll);
  const optional = all.filter((x) => !required.includes(x));
  const want = required.length ? (Math.min(...required.map((r) => r.lo)) + Math.max(...required.map((r) => r.hi))) / 2 : 960;
  const r = fitFrame({ x: want, z: shotZoom(shot), required, optional, portrait: s.portrait, worldW: WW });
  return frameOn(r.x, r.z, s.portrait);
};

export const composedCamera = (o: {
  frame: number;
  dur: number;
  fps: number;
  heroX: number;
  stage: "solo" | "companion" | "witnesses";
  sacred: boolean;
  portrait?: boolean;
  plan?: string;
  cues: { kind: string; word: string; at: number }[];
  timings: { word: string; start: number }[];
  /** التأطير المحتوي (framing = fit): يحل محل shotFrame لكل هدف */
  fit?: (t: CamTarget, s: CamShot) => CamState;
  /** في العمودي مع fit: الانتقال بين الشاهدين عند كلمتي حكمهما */
  alternate?: boolean;
}): CamState & { keys: number; still: boolean } => {
  const authored = parseCameraPlan(o.plan);
  const still = authored.some((b) => b.still);
  type Beat = { frame: number; shot: CamShot; target: CamTarget; dur?: number };
  const beats: Beat[] = still
    ? [{ frame: 0, shot: "wide", target: o.stage === "companion" ? "pair" : o.stage === "witnesses" ? "center" : "hero" }]
    : authored.length
      ? authored
          .map((b): Beat | null => {
            const base = "frame" in b.at ? b.at.frame : cueFrames([{ kind: "truth", word: b.at.word }], o.timings)[0]?.at;
            if (base === undefined) return null;
            return { frame: Math.max(0, base + (b.offset ?? 0)), shot: b.shot, target: b.target, ...(b.dur ? { dur: b.dur } : {}) };
          })
          .filter((b): b is Beat => b !== null)
          .sort((a, b) => a.frame - b.frame)
      : autoCameraPlan({ cues: o.cues, duration: o.dur, fps: o.fps, stage: o.stage, sacred: o.sacred, ...(o.alternate ? { alternate: true } : {}) });
  if (!beats.length || beats[0]!.frame > 0) beats.unshift({ frame: 0, shot: "wide", target: "hero" });
  const pt = Boolean(o.portrait);
  const frameFor = (t: CamTarget, s: CamShot) => (o.fit ? o.fit(t, s) : shotFrame(t, s, o.heroX, o.stage, pt));
  let cur = frameFor(beats[0]!.target, beats[0]!.shot);
  let free = 0;
  for (let i = 1; i < beats.length; i++) {
    const b = beats[i]!;
    const to = frameFor(b.target, b.shot);
    // In a contained portrait two-witness scene, crossing the gap by a moving camera
    // briefly reveals partial people/labels. A speech-timed hard cut preserves composition.
    // Existing scenes and landscape motion keep their original interpolation.
    if (requiresFocusCut({ portrait: pt, contained: Boolean(o.fit), stage: o.stage, from: beats[i - 1]!.target, to: b.target })) {
      if (o.frame < b.frame) break;
      cur = to;
      free = b.frame;
      continue;
    }
    const len = b.dur ?? moveFrames(to.z - cur.z, to.x - cur.x);
    // تصل الكاميرا مع الحدث تقريبًا: تبدأ قبله بنحو 40% من مدة الحركة (والإزاحة في الخطة تضبط موضع الحدث)
    const start = Math.max(free, b.frame - Math.round(len * 0.4));
    if (o.frame < start) break;
    const p = interpolate(o.frame, [start, start + len], [0, 1], { ...clampOpt, easing: camEase });
    cur = { x: cur.x + (to.x - cur.x) * p, y: cur.y + (to.y - cur.y) * p, z: cur.z + (to.z - cur.z) * p };
    free = start + len;
    if (p < 1) break;
  }
  // تنفس خفيف للكاميرا (1.5% على طول المشهد) إلا في المشهد الثابت ومشهد الذكر والآية
  const breath = o.sacred || still || (pt && Boolean(o.fit)) ? 0 : 0.015 * (o.frame / Math.max(1, o.dur));
  return { ...frameOn(cur.x, cur.z * (1 + breath), pt), keys: beats.length, still };
};

/** موضع كلمة في طبقة العمق 1 بحيث تقع كاملة داخل الإطار الظاهر (بهامش)، وإلا في منتصفه */
export const pillInView = (x: number, word: string, c: CamState, portrait: boolean, size = 46) => {
  const half = (portrait ? 304 : 960) / c.z;
  const w = word.length * size * 0.58 + 64;
  const lo = c.x - half + w / 2 + 24;
  const hi = c.x + half - w / 2 - 24;
  return lo > hi ? c.x : Math.max(lo, Math.min(hi, x));
};
/**
 * حكم الشاهد (framing = fit، الأمر 013): بجوار رأسه من جهة الموقف بلا تداخل مع الرأس، داخل الإطار إن كان
 * الشاهد ظاهرًا، ولا يُرسم (null) إن كان الشاهد خارج الإطار، فلا تُسحب كلمته إلى غير صاحبها.
 */
export const witnessPillAt = (wx: number, inward: 1 | -1, word: string, c: CamState, portrait: boolean, size = 46, clear = 48) => {
  const half = (portrait ? 304 : 960) / c.z;
  if (wx < c.x - half || wx > c.x + half) return null;
  const w = pillWidth(word, size);
  // clear: امتداد الرأس واليد المرفوعة من جهة الموقف حول محور الشخصية
  const beside = wx + inward * (clear + w / 2);
  const x = pillInView(beside, word, c, portrait, size);
  // A safe label may disappear with its owner; it must never slide over the owner's
  // head or raised hand when the portrait crop is too narrow.
  return pillClearOfOwner({ x, ownerX: wx, direction: inward, width: w, clearance: clear, camera: c, portrait }) ? x : null;
};
/**
 * امتداد الشاهد من جهة الموقف عند مستوى رأسه (الأمر 014): الأول واقف (الرأس نحو 45)، والثاني في وضعية
 * التفكير ويده مرفوعة إلى ذقنه من جهة الموقف ومعها طرف الخمار (نحو 98 بمقياس 1.75، `figureSpan`)، فتُبعد
 * كلمته عنها ولا تغطي يده ولا تلامس رأسه.
 */
export const witnessClear = (kind: string) => (kind === "just" ? 108 : 48);
/** عرض بطاقة كلمة (كما في WordPill) */
export const pillWidth = (word: string, size = 46) => word.length * size * 0.58 + 64;
/** تحويل طبقة بعمق depth: الطبقات البعيدة تتحرك وتكبر أقل (منظور) */
const composedLayer = (c: CamState, depth: number) => {
  const k = 0.4 + depth * 0.6;
  const z = 1 + (c.z - 1) * (0.55 + depth * 0.45);
  return `translate(960 540) scale(${z}) translate(${-(960 + (c.x - 960) * k)} ${-(540 + (c.y - 540) * k)})`;
};

export const alleyTaleSample: Omit<AlleyTaleProps, "themeId" | "orientation"> = {
  narration: "قد نصدق خبرًا لأنه يؤكد رأينا.",
  shot: "cafe-news-agrees",
  cues: "news | خبرًا",
};
export const alleyTaleSampleEn = alleyTaleSample;
export const alleyTaleSeconds = 6;
