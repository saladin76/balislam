import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { SceneShell } from "./SceneShell";
import { estimateTimings } from "./timing";
import { exit } from "./motion";
import { sentenceGroups } from "../../plan/beats";
import { cameraCuts, parsePoseTimeline } from "../../plan/director";
import { cueFrames, isSacredSentence, parseCues, type CueKind } from "../../plan/sceneCues";
import { Figure, LOOKS, poseAt, walkPose, type PoseName, type Holding } from "../illus/Figure";
import { ID, MOODS, darken, mix, stoneFor, type Mood } from "../illus/palette";
import { Ripples, Workbench, ArchDoor, Bench, Cobbles, GROUND, Glow, HouseRow, NoticeBoard, Skyline, Sky, WallLamp, WordPill, WW, WH, archPath, cameraTransform, clampOpt, rand, rise, type Camera } from "../illus/world";
import { TopCaption, captionLines } from "../illus/TopCaption";
import { Home, Market } from "../illus/places";
import type { SceneBase, StringFields } from "./types";
import { SHOTS } from "../illus/shots";
import { camAt, camTransform, makeAt } from "../illus/shots/kit";
import { Grade, Texture } from "../illus/texture";

/**
 * «حكايات الحارة»: كل جملة لقطة في مكان مرسوم (حارة، سوق، بيت)، وبطل بلا ملامح يمثّل ما يُقال،
 * والضوء يحمل المعنى: نافذة تضيء عند «الحقيقة»، وباب يتسرب منه النور عند «الاعتراف»، ولوحة تتوهج عند «الخبر».
 * كل لقطة (جملة) بتأطير مختلف (واسع، متوسط، قريب) وانتقال ناعم، والأحداث تقع لحظة نطق كلمتها فقط.
 */
export type AlleyTaleProps = SceneBase & StringFields<"place" | "mood" | "moodTo" | "camera" | "cameraMode" | "poseTimeline" | "poses" | "cues" | "look" | "cast" | "shot">;

export type Place = "alley" | "market" | "home";
const MOOD_IDS: Mood[] = ["night", "deep", "dusk", "predawn", "dawn", "day"];
const asMood = (m: string | undefined, d: Mood): Mood => (MOOD_IDS.includes(m as Mood) ? (m as Mood) : d);
const POSE_IDS = ["stand", "think", "sit", "sit-low", "head-down", "hold", "cross", "point", "look-up", "nod", "turn-away", "walk", "proud", "apologize", "listen", "talk"] as const;
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
  const out = exit(frame, dur, 8);
  const keys = cueFrames(parseCues(props.cues), timings).map((k) => k.word);
  return (
    <SceneShell {...props} eyebrow={undefined} captions={false} motif={false} background={darken(ID.night, 0.4)} durationInFrames={dur}>
      <AbsoluteFill>
        <svg viewBox={vb} preserveAspectRatio="xMidYMid slice" width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          <g transform={camTransform(c, drift)}>{shot.world}</g>
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
  const directed = props.cameraMode === "directed";
  const camera = (directed ? (props.camera || "still") : (props.camera || "push")) as Camera;
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

  // التأطير: لكل لقطة تكبير وجهة، وانتقال ناعم سريع بينها
  const framing = (i: number) => directed ? { z: 1.08, dx: 0 } : ({ z: FRAMINGS[i % FRAMINGS.length]!, dx: [0, 260, -230, 140][i % 4]! });
  // افتتاح كل مشهد بحركة تأسيسية من لقطة واسعة، ثم انتقال ناعم بين اللقطات
  const tShot = interpolate(frame, [cuts[cut]!, cuts[cut]! + (cut === 0 ? 26 : 16)], [0, 1], { ...clampOpt, easing: Easing.inOut(Easing.cubic) });
  const fa = directed ? framing(cut) : cut === 0 ? { z: 0.96, dx: -240 } : framing(cut - 1);
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

  // وضعية كل لقطة، وفي منتصف السطر إيماءة ثانوية من الوضعية نفسها (يومئ، يرفع رأسه، يعتدل)
  const SECOND: Record<string, PoseName> = { stand: "think", think: "stand", nod: "cross", sit: "head-down", "sit-low": "look-up", "head-down": "sit-low", "look-up": "think", hold: "nod", cross: "think", "turn-away": "cross", point: "stand" };
  const timeline: { at: number; pose: PoseName }[] = [];
  lines.forEach((l, i) => {
    const a = actionOf(groupOf((l[0]?.start ?? 0) + 1));
    const p = (a === "walk" ? "stand" : a) as PoseName;
    const s0 = starts[i] ?? 0;
    const s1 = starts[i + 1] ?? dur;
    timeline.push({ at: s0, pose: p });
    if (!directed && s1 - s0 > 50 && a !== "walk") timeline.push({ at: s0 + Math.round((s1 - s0) * 0.3), pose: SECOND[p] ?? "nod" });
    if (!directed && s1 - s0 > 90 && a !== "walk") timeline.push({ at: s0 + Math.round((s1 - s0) * 0.78), pose: p });
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
  let pose = poseAt(frame, timeline);
  if (walking) pose = walkPose(pose, (frame / fps) * Math.PI * 2 * 0.95);
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
            <Glow cx={stage === "witnesses" ? 640 : heroX - 520} cy={GROUND - 160} r={420} color={ID.seal} opacity={wrong * 0.9} />
            <Glow cx={stage === "witnesses" ? 1300 : heroX + 520} cy={GROUND - 160} r={420} color={ID.dawn} opacity={just * 0.9} />
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
            {hasBench ? <Workbench x={heroX + 120} mood={curMood} done={success} /> : null}
            {stage === "companion" ? (
              <Figure x={heroX - 400} y={GROUND + 6} scale={1.7} pose={compPose} look={look === LOOKS.woman ? LOOKS.elder : LOOKS.friend} opacity={compIn} frame={frame + 17} />
            ) : null}
            {stage === "witnesses" ? (
              <g>
                {/* الموقف نفسه في الوسط، والشاهدان على طرفيه */}
                <Glow cx={960} cy={GROUND - 200} r={300} color={ID.paper} opacity={0.35} />
                <Figure x={920} y={GROUND + 6} scale={1.15} pose={poseAt(frame, [{ at: 0, pose: "point" }, { at: 50, pose: "talk" }])} look={LOOKS.stranger} opacity={0.85} frame={frame + 5} />
                <Figure x={1010} y={GROUND + 6} scale={1.15} pose={poseAt(frame, [{ at: 0, pose: "hold" }, { at: 60, pose: "flinch" }])} look={LOOKS.elder} flip opacity={0.85} frame={frame + 9} />
                <Figure x={1300} y={GROUND + 6} scale={1.75} pose={poseAt(frame, [{ at: 0, pose: "stand" }, { at: 40, pose: "think" }])} look={LOOKS.woman} flip frame={frame + 3} />
              </g>
            ) : null}
            <Ripples x={heroX - 70} y={GROUND - 300} t={spread} frame={frame} at={at("spread") ?? 0} />
            <Figure x={heroX} y={GROUND + 6} scale={1.75} pose={pose} look={look} flip={facingLeft} holding={holding} frame={frame} rim={Math.max(truth, door) * 0.8} />
            {memory.map((c, i) => {
              const col = c.kind === "wrong" ? ID.seal : ID.dawn;
              const side = i % 2 ? 1 : -1;
              const x = stage === "witnesses" && c.kind !== "memory" ? (c.kind === "wrong" ? 640 : 1300) : heroX + side * (300 + i * 40);
              return <WordPill key={c.word} x={x} y={GROUND - 420 - (stage === "witnesses" ? 40 : i * 56)} text={c.word} color={col} t={rise(frame, c.at, 12)} />;
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
  narration: "قد نصدق خبرًا لأنه يؤكد رأينا.",
  shot: "cafe-news-agrees",
  cues: "news | خبرًا",
};
export const alleyTaleSampleEn = alleyTaleSample;
export const alleyTaleSeconds = 6;
