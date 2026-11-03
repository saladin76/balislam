import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { SceneShell } from "./SceneShell";
import { estimateTimings } from "./timing";
import { exit } from "./motion";
import { sentenceGroups } from "../../plan/beats";
import { cueFrames, parseCues, type CueKind } from "../../plan/sceneCues";
import { Figure, LOOKS, poseAt, walkPose, type PoseName, type Holding } from "../illus/Figure";
import { ID, MOODS, darken, mix, stoneFor, type Mood } from "../illus/palette";
import { ArchDoor, Bench, Cobbles, GROUND, Glow, HouseRow, NoticeBoard, Skyline, Sky, WallLamp, WordPill, WW, WH, archPath, cameraTransform, clampOpt, rand, rise, type Camera } from "../illus/world";
import { TopCaption, captionLines } from "../illus/TopCaption";
import { Home, Market } from "../illus/places";
import type { SceneBase, StringFields } from "./types";

/**
 * «حكايات الحارة»: كل جملة لقطة في مكان مرسوم (حارة، سوق، بيت)، وبطل بلا ملامح يمثّل ما يُقال،
 * والضوء يحمل المعنى: نافذة تضيء عند «الحقيقة»، وباب يتسرب منه النور عند «الاعتراف»، ولوحة تتوهج عند «الخبر».
 * كل لقطة (جملة) بتأطير مختلف (واسع، متوسط، قريب) وانتقال ناعم، والأحداث تقع لحظة نطق كلمتها فقط.
 */
export type AlleyTaleProps = SceneBase & StringFields<"place" | "mood" | "moodTo" | "camera" | "poses" | "cues" | "look">;

export type Place = "alley" | "market" | "home";
const MOOD_IDS: Mood[] = ["night", "deep", "dusk", "predawn", "dawn", "day"];
const asMood = (m: string | undefined, d: Mood): Mood => (MOOD_IDS.includes(m as Mood) ? (m as Mood) : d);
const POSE_IDS = ["stand", "think", "sit", "sit-low", "head-down", "hold", "cross", "point", "look-up", "nod", "turn-away", "walk"] as const;
export type ActionId = (typeof POSE_IDS)[number];

/** أطر اللقطات بالتناوب: واسع ← متوسط ← قريب */
const FRAMINGS = [1.08, 1.38, 1.6, 1.24];

export const AlleyTale: React.FC<AlleyTaleProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: dur } = useVideoConfig();
  const portrait = props.orientation === "portrait";
  const narration = props.narration ?? "";
  const timings = narration ? (props.narrationTimings ?? estimateTimings(narration, 6, dur - 12)) : [];
  const place = (["alley", "market", "home"].includes(props.place ?? "") ? props.place : "alley") as Place;
  const mood = asMood(props.mood, "night");
  const moodTo = props.moodTo ? asMood(props.moodTo, mood) : undefined;
  const camera = (props.camera || "push") as Camera;
  const cues = cueFrames(parseCues(props.cues), timings);
  const at = (k: CueKind) => cues.find((c) => c.kind === k)?.at;
  const look = LOOKS[(props.look as keyof typeof LOOKS) || "hero"] ?? LOOKS.hero;

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
  const cuts: number[] = [];
  starts.forEach((s0, i) => {
    const s1 = starts[i + 1] ?? dur;
    cuts.push(s0);
    if (s1 - s0 > 75) cuts.push(s0 + Math.round((s1 - s0) / 2));
  });
  const cut = Math.max(0, cuts.filter((s) => frame >= s).length - 1);
  const groupOf = (f: number) => Math.max(0, groupStarts.filter((s) => f >= s).length - 1);
  const poses = (props.poses || "stand").split(",").map((p) => p.trim()).filter((p): p is ActionId => (POSE_IDS as readonly string[]).includes(p));
  const actionOf = (g: number): ActionId => poses[Math.min(g, poses.length - 1)] ?? "stand";
  const action = actionOf(groupOf(frame));
  const sitting = poses.some((p) => p === "sit" || p === "sit-low" || p === "head-down");

  // التأطير: لكل لقطة تكبير وجهة، وانتقال ناعم سريع بينها
  const framing = (i: number) => ({ z: FRAMINGS[i % FRAMINGS.length]!, dx: [0, 260, -230, 140][i % 4]! });
  // افتتاح كل مشهد بحركة تأسيسية من لقطة واسعة، ثم انتقال ناعم بين اللقطات
  const tShot = interpolate(frame, [cuts[cut]!, cuts[cut]! + (cut === 0 ? 26 : 16)], [0, 1], { ...clampOpt, easing: Easing.inOut(Easing.cubic) });
  const fa = cut === 0 ? { z: 0.96, dx: -240 } : framing(cut - 1);
  const fb = framing(cut);
  const zoom = fa.z + (fb.z - fa.z) * tShot;
  const offX = fa.dx + (fb.dx - fa.dx) * tShot;

  // البطل: يمشي في لقطات المشي من اليمين إلى اليسار (اتجاه القراءة)
  // البطل: في المشي يعبر الحارة، وفي الوقوف ينتقل بخطوات قليلة إلى علامة جديدة مع كل سطر (كممثل على خشبة)
  const MARKS = [1060, 880, 1180, 960];
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
  if (!walking && !sitting && !poses.includes("walk")) {
    const m0 = MARKS[Math.max(0, shot - 1) % MARKS.length]!;
    const m1 = MARKS[shot % MARKS.length]!;
    const tm = shot === 0 ? 1 : interpolate(frame, [starts[shot]! + 8, starts[shot]! + 36], [0, 1], { ...clampOpt, easing: Easing.inOut(Easing.sin) });
    heroX = m0 + (m1 - m0) * tm;
    stepping = tm > 0 && tm < 1;
  }
  heroX = Math.max(420, heroX);
  const stepDir = MARKS[shot % MARKS.length]! < MARKS[Math.max(0, shot - 1) % MARKS.length]!;
  const facingLeft = walking || action === "turn-away" || (stepping && stepDir);

  // وضعية كل لقطة، وفي منتصف السطر إيماءة ثانوية من الوضعية نفسها (يومئ، يرفع رأسه، يعتدل)
  const SECOND: Record<string, PoseName> = { stand: "think", think: "stand", nod: "cross", sit: "head-down", "sit-low": "look-up", "head-down": "sit-low", "look-up": "think", hold: "nod", cross: "think", "turn-away": "cross", point: "stand" };
  const timeline: { at: number; pose: PoseName }[] = [];
  lines.forEach((l, i) => {
    const a = actionOf(groupOf((l[0]?.start ?? 0) + 1));
    const p = (a === "walk" ? "stand" : a) as PoseName;
    const s0 = starts[i] ?? 0;
    const s1 = starts[i + 1] ?? dur;
    timeline.push({ at: s0, pose: p });
    if (s1 - s0 > 50 && a !== "walk") timeline.push({ at: s0 + Math.round((s1 - s0) * 0.3), pose: SECOND[p] ?? "nod" });
    if (s1 - s0 > 90 && a !== "walk") timeline.push({ at: s0 + Math.round((s1 - s0) * 0.78), pose: p });
  });
  // إيماءة عند الكلمة المفتاحية في اللقطة: يتأمل/يومئ
  const thinkAt = at("think");
  if (thinkAt !== undefined && !sitting) timeline.push({ at: thinkAt, pose: "think" });
  const newsAt = at("news");
  if (newsAt !== undefined && !sitting) timeline.push({ at: newsAt + 10, pose: "nod" }, { at: newsAt + 34, pose: "hold" });
  let pose = poseAt(frame, timeline);
  if (walking) pose = walkPose(pose, (frame / fps) * Math.PI * 2 * 0.95);
  else if (stepping) pose = walkPose(pose, (frame / fps) * Math.PI * 2 * 0.95, 0.85);
  const holding: Holding = action === "hold" || newsAt !== undefined ? "paper" : "none";

  // الأحداث
  const truth = rise(frame, at("truth"), 22);
  const wrong = rise(frame, at("wrong"), 16);
  const just = rise(frame, at("just"), 16);
  const news = rise(frame, newsAt, 16);
  const door = rise(frame, at("door"), 30);
  const people = rise(frame, at("people"), 24);
  const memory = cues.filter((c) => c.kind === "memory" || c.kind === "wrong" || c.kind === "just");
  const skyT = moodTo ? interpolate(frame, [dur * 0.35, dur - 10], [0, 1], { ...clampOpt, easing: Easing.inOut(Easing.sin) }) : 0;
  const curMood: Mood = moodTo && skyT > 0.5 ? moodTo : mood;

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
  const cam = (depth: number) => `${cameraTransform(camera, frame, dur, depth, focusX)} translate(${-offX * (0.4 + depth * 0.6)} 0) translate(${focusX} ${GROUND - 330}) scale(${1 + (zoom - 1) * (0.55 + depth * 0.45)}) translate(${-focusX} ${-(GROUND - 330)})`;
  const vb = portrait ? `${Math.max(0, Math.min(WW - 608, focusX - 304))} 0 608 1080` : `0 0 ${WW} ${WH}`;

  const hasBoard = newsAt !== undefined && place !== "home";
  const hasDoor = at("door") !== undefined;
  const ghosts = at("people") !== undefined;

  return (
    <SceneShell {...props} eyebrow={undefined} captions={false} motif={false} background={darken(ID.night, 0.4)} durationInFrames={dur}>
      <AbsoluteFill>
        <svg viewBox={vb} preserveAspectRatio="xMidYMid slice" width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          <g transform={cam(0)}>
            <Sky mood={mood} to={moodTo} t={skyT} frame={frame} />
          </g>
          {place === "alley" ? (
            <>
              <g transform={cam(0.25)}>
                <Skyline mood={curMood} dome={760} minaret={1260} seed={5} />
              </g>
              <g transform={cam(0.6)}>
                <HouseRow mood={curMood} seed={place === "alley" ? 4 : 9} lit={lit} />
                {hasDoor ? <ArchDoor x={heroX + 250} w={190} h={310} light={door} mood={curMood} /> : null}
                {hasBoard ? <NoticeBoard x={heroX - 430} y={GROUND - 470} glow={news} mood={curMood} /> : null}
                {sitting ? <WallLamp x={heroX + 30} y={GROUND - 420} on={1} frame={frame} /> : null}
              </g>
            </>
          ) : place === "market" ? (
            <g transform={cam(0.6)}>
              <Market mood={curMood} frame={frame} lit={truth} />
              {hasBoard ? <NoticeBoard x={heroX - 430} y={GROUND - 470} glow={news} mood={curMood} /> : null}
            </g>
          ) : (
            <g transform={cam(0.6)}>
              <Home mood={curMood} frame={frame} lit={truth} />
            </g>
          )}
          <g transform={cam(0.9)}>
            {place !== "home" ? <Cobbles mood={curMood} tint={wrong > just ? ID.seal : ID.dawn} tintOpacity={0.1 * Math.max(wrong, just)} /> : null}
            {sitting ? <Bench x={heroX - 60} w={240} mood={curMood} /> : null}
            {/* لون الحكم: الخطأ أحمر الختم، والعدل فجر */}
            <Glow cx={heroX - 520} cy={GROUND - 160} r={420} color={ID.seal} opacity={wrong * 0.9} />
            <Glow cx={heroX + 520} cy={GROUND - 160} r={420} color={ID.dawn} opacity={just * 0.9} />
            <Glow cx={heroX} cy={GROUND - 260} r={460} color={ID.dawn} opacity={truth * 0.45} />
          </g>
          <g transform={cam(1)}>
            {/* الناس حوله: أطياف شفافة لمن يؤثرون فيه */}
            {ghosts
              ? [
                  { dx: -330, look: LOOKS.woman, d: 0 },
                  { dx: -560, look: LOOKS.elder, d: 8 },
                  { dx: 300, look: LOOKS.friend, d: 16 },
                ].map((g, i) => (
                  <Figure key={i} x={heroX + g.dx} y={GROUND + 6} scale={1.25} pose={poseAt(frame, [{ at: 0, pose: "stand" }])} look={g.look} opacity={0.32 * rise(frame, (at("people") ?? 0) + g.d, 20)} silhouette={mix(ID.paper, ID.night, 0.35)} shadow={false} frame={frame + i * 9} />
                ))
              : null}
            <Figure x={heroX} y={GROUND + 6} scale={1.75} pose={pose} look={look} flip={facingLeft} holding={holding} frame={frame} rim={Math.max(truth, door) * 0.8} />
            {memory.map((c, i) => {
              const col = c.kind === "wrong" ? ID.seal : ID.dawn;
              const side = i % 2 ? 1 : -1;
              return <WordPill key={c.word} x={heroX + side * (300 + i * 40)} y={GROUND - 420 - i * 56} text={c.word} color={col} t={rise(frame, c.at, 12)} />;
            })}
          </g>
        </svg>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 78%, rgba(0,0,0,.4) 100%)" }} />
      </AbsoluteFill>
      <TopCaption frame={frame} fps={fps} timings={timings} keys={keys} portrait={portrait} out={out} />
    </SceneShell>
  );
};

export const alleyTaleSample: Omit<AlleyTaleProps, "themeId" | "orientation"> = {
  narration: "هل فكرت يومًا أنك قد تكون مخطئًا في شيء تؤمن تمامًا أنه صحيح؟ قد تصدق خبرًا لأنه يؤكد رأيك. فليس كل ما نقتنع به صحيحًا.",
  place: "alley",
  mood: "night",
  moodTo: "predawn",
  camera: "push",
  poses: "sit,head-down,look-up",
  cues: "wrong | مخطئًا\nnews | خبرًا\ntruth | صحيحًا",
};
export const alleyTaleSampleEn = alleyTaleSample;
export const alleyTaleSeconds = 14;
