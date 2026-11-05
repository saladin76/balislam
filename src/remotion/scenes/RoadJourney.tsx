import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { SceneShell } from "./SceneShell";
import { estimateTimings } from "./timing";
import { exit } from "./motion";
import { cueFrames, parseCues, type CueKind } from "../../plan/sceneCues";
import { Figure, LOOKS, poseAt, walkPose, type Holding, type PoseName } from "../illus/Figure";
import { ID, darken, mix, type Mood } from "../illus/palette";
import { GROUND, Glow, MihrabGate, NoticeBoard, Signpost, Sky, WordPill, WW, WH, clampOpt, rise } from "../illus/world";
import { RoadLand, type Biome } from "../illus/places";
import { characterAt, GAIT_IDS, type GaitId } from "../illus/gait";
import { AmbientGrade, BackHalo, LitFigure, WorldLight, lightAt, parseLighting } from "../illus/light";
import { TopCaption, captionLines } from "../illus/TopCaption";
import type { SceneBase, StringFields } from "./types";

/**
 * «الطريق»: الحلقة رحلة مسافر واحد. الكاميرا تتبعه من اليمين إلى اليسار (اتجاه القراءة)، والطريق يتغير مع الفصول
 * من أطراف المدينة إلى الحقول فالصحراء فتلة الفجر. ما يقوله الراوي يظهر على جانب الطريق لحظة نطق كلمته:
 * لوحة خبر، ولافتة تشير إلى طريق آخر، ورفاق طريق، وبوابة محراب تضيء في آخره.
 * يتوقف المسافر عند كل محطة ثم يكمل، فالحركة نفسها رحلة لا زينة.
 */
export type RoadJourneyProps = SceneBase &
  StringFields<"biome" | "mood" | "moodTo" | "poses" | "cues" | "look"> & {
    /**
     * حركة المسافر: "legacy" (الافتراضي، كما هو منذ البداية) أو "natural" من طبقة الحركة المشتركة
     * (قدم ثابتة على الطريق المتحرك، وتباطؤ واندفاع عند المحطات، ومتابعة الثوب). اختياري ولا يغير شيئًا قائمًا.
     */
    motion?: string;
    /** المشية مع motion = "natural" (الافتراضي stroll) */
    gait?: string;
    /** الإضاءة والظلال (الأمر 008)، اختيارية؛ نفس صيغة «الحارة» (بلا عمق المجال) */
    lighting?: string;
  };

const MOOD_IDS: Mood[] = ["night", "deep", "dusk", "predawn", "dawn", "day"];
const asMood = (m: string | undefined, d: Mood): Mood => (MOOD_IDS.includes(m as Mood) ? (m as Mood) : d);
const BIOMES: Biome[] = ["city", "fields", "desert", "hill"];

/** المحطات: أحداث يقف عندها المسافر */
const STOPS: CueKind[] = ["news", "door", "decide", "truth", "think", "pain"];

export const RoadJourney: React.FC<RoadJourneyProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: dur } = useVideoConfig();
  const portrait = props.orientation === "portrait";
  const narration = props.narration ?? "";
  const timings = narration ? (props.narrationTimings ?? estimateTimings(narration, 6, dur - 12)) : [];
  const mood = asMood(props.mood, "night");
  const moodTo = props.moodTo ? asMood(props.moodTo, mood) : undefined;
  const biome = (BIOMES.includes(props.biome as Biome) ? props.biome : "city") as Biome;
  const cues = cueFrames(parseCues(props.cues), timings);
  const at = (k: CueKind) => cues.find((c) => c.kind === k)?.at;
  const look = LOOKS[(props.look as keyof typeof LOOKS) || "hero"] ?? LOOKS.hero;

  // المشي والتوقف: يتوقف المسافر نحو ثانيتين عند كل محطة، والسرعة تتهادى في البداية والنهاية
  const stops = cues.filter((c) => STOPS.includes(c.kind)).map((c) => c.at);
  const speedAt = (f: number) => {
    let v = 5.2;
    for (const s of stops) if (f >= s - 4 && f < s + 54) v *= interpolate(f, [s - 4, s + 8, s + 40, s + 54], [1, 0, 0, 1], clampOpt);
    if (props.poses?.includes("stand") && !props.poses.includes("walk")) v *= 0.0;
    return v * interpolate(f, [0, 10], [0.6, 1], clampOpt);
  };
  let shift = 0;
  for (let f = 0; f < frame; f++) shift += speedAt(f);
  const v = speedAt(frame);
  const walking = v > 0.4;
  const heroX = 1120;

  // الوضعية عند التوقف من معنى المحطة
  const stopPose: Partial<Record<CueKind, PoseName>> = { news: "hold", door: "turn-away", decide: "cross", truth: "look-up", think: "think", pain: "head-down" };
  const timeline: { at: number; pose: PoseName }[] = [{ at: 0, pose: "stand" }];
  for (const c of cues) {
    const p = stopPose[c.kind];
    if (p && p !== "head-down") timeline.push({ at: c.at + 6, pose: p }, { at: c.at + 46, pose: "stand" });
  }
  const natural = props.motion === "natural";
  const gait: GaitId = GAIT_IDS.includes(props.gait as GaitId) ? (props.gait as GaitId) : "stroll";
  let pose = poseAt(frame, timeline);
  // المسافر ينظر يسارًا ويسير والطريق يمر تحته يمينًا: سرعته على الأرض = سرعة الطريق
  const hero = natural ? characterAt(frame, pose, { x0: heroX, facing0: -1, moves: [], scale: 1.95, fps, velocity: (f) => -speedAt(f), gait }) : null;
  pose = hero ? hero.pose : walkPose(pose, (shift / 260) * Math.PI * 2, Math.min(1, v / 5.2));
  const holding: Holding = at("memory") !== undefined ? "bundle" : at("news") !== undefined && frame > (at("news") ?? 0) ? "paper" : "none";

  // أحداث الطريق: تدخل من يسار الكادر (أمام المسافر) وتمر بجانبه
  const ahead = (cueAt: number | undefined, offset: number) => {
    if (cueAt === undefined) return null;
    // موضع المحطة بحيث تكون بجانب المسافر لحظة الوقوف
    let s = 0;
    for (let f = 0; f < cueAt; f++) s += speedAt(f);
    return heroX - offset - (s - shift);
  };
  const truth = rise(frame, at("truth"), 24);
  const wrong = rise(frame, at("wrong"), 16);
  const just = rise(frame, at("just"), 16);
  const newsX = ahead(at("news"), 330);
  const signX = ahead(at("door") ?? at("decide"), -260);
  const peopleIn = rise(frame, at("people"), 26);
  const memory = cues.filter((c) => c.kind === "memory" || c.kind === "wrong" || c.kind === "just");
  const skyT = moodTo ? interpolate(frame, [dur * 0.35, dur - 10], [0, 1], { ...clampOpt, easing: Easing.inOut(Easing.sin) }) : 0;
  const curMood: Mood = moodTo && skyT > 0.5 ? moodTo : mood;
  const lines = captionLines(timings, portrait ? 6 : 8);
  void lines;

  const rig = parseLighting(props.lighting);
  const light = rig ? lightAt(rig, frame, (w) => cueFrames([{ kind: "truth", word: w }], timings)[0]?.at) : null;
  const out = exit(frame, dur, 8);
  const vb = portrait ? `${heroX - 380} 0 608 1080` : `0 0 ${WW} ${WH}`;
  // افتتاح المشهد بحركة تأسيسية، ثم اقتراب بطيء مع المسير
  const push = interpolate(frame, [0, 28, dur], [0.9, 1.02, 1.08], { ...clampOpt, easing: Easing.inOut(Easing.sin) });
  const cam = `translate(${heroX} ${GROUND - 200}) scale(${push}) translate(${-heroX} ${-(GROUND - 200)})`;

  return (
    <SceneShell {...props} eyebrow={undefined} captions={false} motif={false} background={darken(ID.night, 0.4)} durationInFrames={dur}>
      <AbsoluteFill>
        <svg viewBox={vb} preserveAspectRatio="xMidYMid slice" width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          <g transform={cam}>
            <Sky mood={mood} to={moodTo} t={skyT} frame={frame} />
            {biome === "hill" || truth > 0 ? <MihrabGate x={240} w={150} h={220} base={GROUND - 30} light={biome === "hill" ? 0.6 + 0.4 * truth : truth} /> : null}
            <RoadLand mood={curMood} biome={biome} shift={shift} frame={frame} />
            {light ? (
              <>
                <AmbientGrade light={light} />
                <WorldLight light={light} frame={frame} />
              </>
            ) : null}
            <Glow cx={heroX - 420} cy={GROUND - 180} r={440} color={ID.seal} opacity={wrong * 0.9} />
            <Glow cx={heroX + 420} cy={GROUND - 180} r={440} color={ID.dawn} opacity={just * 0.9} />
            {newsX !== null ? (
              <g>
                <rect x={newsX + 124} y={GROUND - 260} width={16} height={250} fill={darken(ID.copper, 0.55)} />
                <NoticeBoard x={newsX} y={GROUND - 470} glow={rise(frame, at("news"), 14)} mood={curMood} />
              </g>
            ) : null}
            {signX !== null ? (
              <g>
                <Signpost x={signX} dir={1} />
                <path d={`M${signX + 40} ${GROUND + 10} L${signX + 600} ${WH + 60} L${signX + 260} ${WH + 60} Z`} fill={ID.dawn} opacity={0.22 * rise(frame, at("door") ?? at("decide"), 30)} />
              </g>
            ) : null}
            {/* رفاق الطريق */}
            {peopleIn > 0
              ? [LOOKS.woman, LOOKS.elder].map((l, i) => (
                  <Figure key={i} x={heroX + 260 + i * 220} y={GROUND + 10} scale={1.45} pose={walkPose(poseAt(frame, [{ at: 0, pose: "stand" }]), (shift / 260) * Math.PI * 2 + i * 1.7, Math.min(1, v / 5.2))} look={l} flip opacity={0.4 * peopleIn} silhouette={mix(ID.paper, ID.night, 0.4)} shadow={false} frame={frame} />
                ))
              : null}
            {light ? (
              <>
                <BackHalo x={heroX} y={GROUND + 10} scale={1.95} light={light} />
                <LitFigure light={light} x={heroX} y={GROUND + 10} scale={1.95} pose={pose} look={look} flip {...(hero ? { sway: hero.sway } : {})} holding={holding} frame={frame} rim={truth * 0.8} />
              </>
            ) : (
              <Figure x={heroX} y={GROUND + 10} scale={1.95} pose={pose} look={look} flip {...(hero ? { sway: hero.sway } : {})} holding={holding} frame={frame} rim={truth * 0.8} />
            )}
            {memory.map((c, i) => (
              <WordPill key={c.word} x={heroX + (i % 2 ? 330 : -330)} y={GROUND - 480 - i * 60} text={c.word} color={c.kind === "wrong" ? ID.seal : ID.dawn} t={rise(frame, c.at, 12)} />
            ))}
          </g>
        </svg>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 80%, rgba(0,0,0,.35) 100%)" }} />
      </AbsoluteFill>
      <TopCaption frame={frame} fps={fps} timings={timings} keys={cues.map((c) => c.word)} portrait={portrait} out={out} />
    </SceneShell>
  );
};

export const roadJourneySample: Omit<RoadJourneyProps, "themeId" | "orientation"> = {
  narration: "كيف تعرف أنك تسير في طريق الحق؟ قد تصدق خبرًا لأنه يؤكد رأيك. وقد تدافع عن قرار اتخذته، لأن الاعتراف بخطئه مؤلم.",
  biome: "fields",
  mood: "dusk",
  poses: "walk",
  cues: "walk | طريق\nnews | خبرًا\ndecide | تدافع\nwrong | بخطئه",
};
export const roadJourneySampleEn = roadJourneySample;
export const roadJourneySeconds = 14;
