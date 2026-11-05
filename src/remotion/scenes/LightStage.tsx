import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { SceneShell } from "./SceneShell";
import { estimateTimings } from "./timing";
import { exit } from "./motion";
import { sentenceGroups } from "../../plan/beats";
import { cueFrames, parseCues, type CueKind } from "../../plan/sceneCues";
import { Figure, LOOKS, poseAt, walkPose, type Holding, type PoseName } from "../illus/Figure";
import { ID, darken, mix, type Mood } from "../illus/palette";
import { GROUND, Glow, WordPill, WW, WH, clampOpt, rise, useSvgId } from "../illus/world";
import { StageFloor } from "../illus/places";
import { TopCaption, captionLines } from "../illus/TopCaption";
import type { SceneBase, StringFields } from "./types";
import { fitDistance, GAIT_IDS, locomote, locoPose, poseAtNatural, type GaitId, type LocoState, type Move } from "../illus/gait";

/**
 * «ظل ونور»: مسرح مظلم وبقعة ضوء. البطل وحده تقريبًا، والمعنى يُروى بالضوء:
 * يتحرك البطل إلى علامة جديدة مع كل سطر وتتبعه البقعة، و«الحقيقة» تفتح ضوء الفجر واسعًا،
 * و«الخطأ» يغمر جانبًا بلون الختم، و«الناس» يظهرون في بقع صغيرة حوله، و«الخبر» ورقة تضيئه من أسفل.
 */
export type LightStageProps = SceneBase &
  StringFields<"mood" | "poses" | "cues" | "look"> & {
    /**
     * حركة البطل بين العلامات: "legacy" (الافتراضي، كما هو منذ البداية: انتقال 26 إطارًا) أو "natural"
     * من طبقة الحركة المشتركة (مشية حقيقية بقدم ثابتة، تسارع وتباطؤ، التفاتة بالجسد، ومتابعة الثوب).
     * المسافة تُقصَّر إن لم يتسع السطر لها، فلا يسرع البطل أبدًا فوق مشيته. اختياري ولا يغير شيئًا قائمًا.
     */
    motion?: string;
    /** المشية مع motion = "natural" (الافتراضي walk) */
    gait?: string;
  };

const MARKS = [960, 700, 1220, 860, 1080];

const Cone: React.FC<{ x: number; w: number; color: string; opacity: number }> = ({ x, w, color, opacity }) => {
  const id = useSvgId("cone");
  if (opacity <= 0.001) return null;
  return (
    <g opacity={opacity}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity={0.02} />
          <stop offset="1" stopColor={color} stopOpacity={0.3} />
        </linearGradient>
      </defs>
      <path d={`M${x - 46} -60 L${x + 46} -60 L${x + w / 2} ${GROUND + 34} L${x - w / 2} ${GROUND + 34} Z`} fill={`url(#${id})`} />
      <ellipse cx={x} cy={GROUND + 34} rx={w / 2} ry={30} fill={color} opacity={0.22} />
    </g>
  );
};

export const LightStage: React.FC<LightStageProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: dur } = useVideoConfig();
  const portrait = props.orientation === "portrait";
  const narration = props.narration ?? "";
  const timings = narration ? (props.narrationTimings ?? estimateTimings(narration, 6, dur - 12)) : [];
  const cues = cueFrames(parseCues(props.cues), timings);
  const at = (k: CueKind) => cues.find((c) => c.kind === k)?.at;
  const look = LOOKS[(props.look as keyof typeof LOOKS) || "hero"] ?? LOOKS.hero;
  const mood = (props.mood || "night") as Mood;

  // العلامات: سطر لكل علامة، يمشي البطل إليها في أول ثانية من السطر
  const lines = captionLines(timings, portrait ? 6 : 8);
  const starts = lines.map((l, i) => (i === 0 ? 0 : Math.max(0, (l[0]?.start ?? 0) - 6)));
  if (!starts.length) starts.push(0);
  const shot = Math.max(0, starts.filter((s) => frame >= s).length - 1);
  const markOf = (i: number) => MARKS[i % MARKS.length]!;
  const tMove = interpolate(frame, [starts[shot]!, starts[shot]! + 26], [0, 1], { ...clampOpt, easing: Easing.inOut(Easing.sin) });
  const fromX = shot === 0 ? markOf(0) : markOf(shot - 1);
  const sittingScene = /sit|head-down/.test(props.poses ?? "");
  // الحركة الطبيعية (اختيارية): مشية إلى كل علامة تبدأ مع سطرها، بطول يتسع له السطر
  const natural = props.motion === "natural" && !sittingScene;
  const gait: GaitId = (GAIT_IDS as readonly string[]).includes(props.gait ?? "") ? (props.gait as GaitId) : "walk";
  const SCALE = 1.8;
  let loco: LocoState | null = null;
  if (natural) {
    const moves: Move[] = [];
    let x = markOf(0);
    for (let i = 1; i < starts.length; i++) {
      const s0 = starts[i]!;
      const s1 = starts[i + 1] ?? dur;
      const room = fitDistance(gait, s1 - s0 - 8, SCALE, fps);
      const d = Math.max(-room, Math.min(room, markOf(i) - x));
      if (Math.abs(d) > 4) moves.push({ start: s0, dx: d, gait });
      x += d;
    }
    loco = locomote(frame, { x0: markOf(0), facing0: 1, moves, scale: SCALE, fps });
  }
  const heroX = loco ? loco.x : sittingScene ? MARKS[0]! : fromX + (markOf(shot) - fromX) * tMove;
  const moving = !natural && !sittingScene && shot > 0 && tMove > 0 && tMove < 1;
  const facingLeft = markOf(shot) < fromX;

  const groups = sentenceGroups(narration, 3);
  const gStarts: number[] = [];
  let wi = 0;
  for (const g of groups) {
    gStarts.push(Math.max(0, (timings[wi]?.start ?? 0) - 6));
    wi += g.split(/\s+/).filter(Boolean).length;
  }
  const poses = (props.poses || "stand").split(",").map((p) => p.trim());
  const timeline: { at: number; pose: PoseName }[] = gStarts.map((s, i) => ({ at: s, pose: (poses[Math.min(i, poses.length - 1)] === "walk" ? "stand" : poses[Math.min(i, poses.length - 1)] ?? "stand") as PoseName }));
  lines.forEach((_, i) => {
    const s0 = starts[i] ?? 0;
    const s1 = starts[i + 1] ?? dur;
    if (s1 - s0 > 80) timeline.push({ at: Math.round((s0 + s1) / 2) + 10, pose: "nod" }, { at: Math.round((s0 + s1) / 2) + 34, pose: timeline.filter((x) => x.at <= s0).pop()?.pose ?? "stand" });
  });
  const newsAt = at("news");
  if (newsAt !== undefined) timeline.push({ at: newsAt + 4, pose: "hold" });
  let pose = loco ? locoPose(poseAtNatural(frame, timeline), loco) : poseAt(frame, timeline);
  if (moving) pose = walkPose(pose, (frame / fps) * Math.PI * 2, Math.sin(tMove * Math.PI));
  const sitting = /sit|head-down/.test(props.poses ?? "");
  const holding: Holding = newsAt !== undefined && frame >= newsAt ? "paper" : "none";

  const truth = rise(frame, at("truth"), 26);
  const wrong = rise(frame, at("wrong"), 16);
  const just = rise(frame, at("just"), 16);
  const people = at("people");
  const pain = rise(frame, at("pain"), 20);
  const news = rise(frame, newsAt, 12);
  const door = rise(frame, at("door"), 30);
  const memory = cues.filter((c) => c.kind === "memory" || c.kind === "wrong" || c.kind === "just");
  const intro = interpolate(frame, [0, 14], [0, 1], clampOpt);
  const out = exit(frame, dur, 8);

  const vb = portrait ? `${Math.max(0, Math.min(WW - 608, heroX - 304))} 0 608 1080` : `0 0 ${WW} ${WH}`;
  // لقطات: كل سطر لقطة، والطويل لقطتان؛ تقترب الكاميرا وتبتعد بين لقطة وأخرى
  const cuts: number[] = [];
  starts.forEach((s0, i) => {
    const s1 = starts[i + 1] ?? dur;
    cuts.push(s0);
    if (s1 - s0 > 75) cuts.push(s0 + Math.round((s1 - s0) / 2));
  });
  const cut = Math.max(0, cuts.filter((s) => frame >= s).length - 1);
  const Z = [1.05, 1.4, 1.2, 1.6];
  const tz = interpolate(frame, [cuts[cut]!, cuts[cut]! + (cut === 0 ? 26 : 16)], [0, 1], { ...clampOpt, easing: Easing.inOut(Easing.cubic) });
  const za = cut === 0 ? 0.92 : Z[(cut - 1) % Z.length]!;
  const zoom = za + (Z[cut % Z.length]! - za) * tz;
  const cam = `translate(${heroX} ${GROUND - 220}) scale(${zoom}) translate(${-heroX} ${-(GROUND - 220)})`;
  const coneW = 360 + 560 * truth;
  const coneCol = truth > 0 ? mix(ID.paper, ID.dawn, truth) : mood === "dawn" ? ID.dawn : ID.paper;

  return (
    <SceneShell {...props} eyebrow={undefined} captions={false} motif={false} background={darken(ID.night, 0.62)} durationInFrames={dur}>
      <AbsoluteFill>
        <svg viewBox={vb} preserveAspectRatio="xMidYMid slice" width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          <g transform={cam}>
            <StageFloor />
            {/* بقعة الباب خلفه: نور يُدار له الظهر */}
            <Cone x={heroX + 380} w={420} color={ID.dawn} opacity={door * 0.9} />
            <Glow cx={heroX - 520} cy={GROUND - 200} r={520} color={ID.seal} opacity={wrong} />
            <Glow cx={heroX + 520} cy={GROUND - 200} r={520} color={ID.dawn} opacity={just} />
            <Cone x={heroX} w={coneW} color={coneCol} opacity={intro * (1 - 0.55 * pain)} />
            <Glow cx={heroX} cy={GROUND - 240} r={380 + 300 * truth} color={ID.dawn} opacity={truth * 0.7} />
            {people !== undefined
              ? [-560, -330, 380].map((dx, i) => {
                  const t = rise(frame, people + i * 10, 18);
                  return (
                    <g key={i}>
                      <Cone x={heroX + dx} w={220} color={ID.paper} opacity={t * 0.6} />
                      <Figure x={heroX + dx} y={GROUND + 30} scale={1.2} pose={poseAt(frame, [{ at: 0, pose: "stand" }])} look={[LOOKS.woman, LOOKS.elder, LOOKS.friend][i]!} flip={dx > 0} opacity={0.75 * t} frame={frame + i * 11} />
                    </g>
                  );
                })
              : null}
            {news > 0 ? <Glow cx={heroX + 40} cy={GROUND - 250} r={300} color={ID.dawn} opacity={news * 0.8} /> : null}
            {sitting ? <g><rect x={heroX - 70} y={GROUND + 30 - 112} width={150} height={112} fill={darken(ID.night, 0.2)} /><rect x={heroX - 76} y={GROUND + 30 - 120} width={162} height={12} fill={mix(ID.night, ID.copper, 0.3)} /></g> : null}
            <Figure x={heroX} y={GROUND + 30} scale={sitting ? 1.75 : 1.8} pose={pose} look={look} flip={facingLeft} {...(loco ? { facing: loco.facing, view: loco.view, sway: loco.sway } : {})} holding={holding} frame={frame} rim={Math.max(truth, news) * 0.9} />
            {memory.map((c, i) => (
              <WordPill key={c.word} x={heroX + (i % 2 ? 360 : -360)} y={GROUND - 470 - i * 60} text={c.word} color={c.kind === "wrong" ? ID.seal : ID.dawn} t={rise(frame, c.at, 12)} />
            ))}
          </g>
        </svg>
      </AbsoluteFill>
      <TopCaption frame={frame} fps={fps} timings={timings} keys={cues.map((c) => c.word)} portrait={portrait} out={out} />
    </SceneShell>
  );
};

export const lightStageSample: Omit<LightStageProps, "themeId" | "orientation"> = {
  narration: "تخيل شخصين يشاهدان الموقف نفسه. الأول يراه ظلمًا، والثاني يراه عدلًا. كل واحد منهما مقتنع أنه يرى الحقيقة.",
  mood: "night",
  poses: "think,stand,look-up",
  cues: "think | تخيل\npeople | شخصين\nwrong | ظلمًا\njust | عدلًا\ntruth | الحقيقة",
};
export const lightStageSampleEn = lightStageSample;
export const lightStageSeconds = 12;
