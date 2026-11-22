/**
 * قالب «الحارة» (alley-world) لـ«بالإسلام» — العالم المعتمد (قرار المالك ٢٢ نوفمبر، D193) بمعايير «الحِرفة» (D189)
 * قالبًا يُستعمل مشهدًا مشهدًا. D200. مسرح ورق حقيقي (src/remotion/balislam/directions/PrintedAlley.tsx: AlleyStage).
 * المشهد لقطة واحدة من أربع يختارها حقل shot، وكل حدث لحظة نطق كلمته (حقول «كلمة …»):
 *  - market: الدكاكين تنزل من أعلى المسرح وتستقر عند كلمتها.
 *  - two-figures: شخصية أو اثنتان (بلا وجوه) تدخلان عند كلمتهما، والأولى تمد ذراعها براحة مفتوحة عند «يقول»،
 *    والثانية تعيد كفها إلى صدرها عند «معي».
 *  - lanterns: الفوانيس تُضاء واحدًا واحدًا من كلمتها.
 *  - alley-wide: الحارة كلها (ختام بحركة الكاميرا وحدها).
 * لا يُرسم ما لم تحدده الحقول (القاعدة الثالثة): الدكاكين لا تظهر إلا في السوق (setting=market أو لقطة market)، وكلمة غير
 * موجودة في النص = لا حدث. قاعدة «بالإسلام»: الجملة التي فيها ذكر الله أو دعاء أو آية ساكنة كلها: لا حدث ولا كاميرا ولا
 * تأرجح ولا غبار ولا مؤثر، ولا يُضاف شيء قبلها أو بعدها لتعويضها. بلا وجوه، وبلا موسيقى، والمؤثرات اختيارية (sounds=off).
 * بطاقات الآيات ولوحة الدعاء تبقى ثنائية الأبعاد ساكنة (قوالبها كما هي).
 */
import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useBrandFonts } from "../../useBrandFonts";
import { CAPTION_SHADOW_LIGHT, calmAt, ease, orbit, safeKeys, swing, useAssetTextures, type CamState, type V3, type Window } from "../../three";
import { anchorAt, captionLine, effectiveTime, sceneWords, stillWindows, type TimedWord } from "../../three/anchors";
import type { SceneBase, StringFields } from "../../scenes/types";
import { SceneShell } from "../../scenes/SceneShell";
import { BAA } from "../directions/common";
import { AlleyStage, GESTURES, armPose } from "../directions/PrintedAlley";
import { ALLEY_SHOTS, type AlleyShotId } from "./shots";
export { ALLEY_SHOTS, type AlleyShotId };

export type AlleyWorldProps = SceneBase & StringFields<"shot" | "setting" | "figures" | "stallWord" | "enterWord" | "speakWord" | "selfWord" | "lightWord" | "sounds">;

const span = (t: number, a: number, d: number) => Math.min(1, Math.max(0, (t - a) / d));
type ShotCam = { target: V3; yaw: number; pitch: number; dist: number; fov: number };
type Setup = { size: "detail" | "medium" | "close" | "wide"; from: ShotCam; to: ShotCam; aperture: number };
const SETUPS: Record<AlleyShotId, [Setup, Setup]> = {
  market: [
    { size: "wide", aperture: 0.004, from: { target: [0, 2.2, -1], yaw: -6, pitch: 4, dist: 13.2, fov: 34 }, to: { target: [0, 2.0, -1], yaw: 2, pitch: 3, dist: 11.6, fov: 34 } },
    { size: "medium", aperture: 0.012, from: { target: [-2.6, 1.4, -1.2], yaw: 14, pitch: 6, dist: 7.0, fov: 32 }, to: { target: [-2.2, 1.5, -1.2], yaw: 6, pitch: 5, dist: 6.2, fov: 32 } },
  ],
  "two-figures": [
    { size: "close", aperture: 0.016, from: { target: [0, 1.75, 0], yaw: -10, pitch: 2, dist: 4.6, fov: 32 }, to: { target: [0, 1.75, 0], yaw: -2, pitch: 2, dist: 4.2, fov: 32 } },
    // حافة الورق المقصوص وانزياح حبره على الأولى، والثانية في العمق
    { size: "detail", aperture: 0.03, from: { target: [-1.75, 1.55, 0], yaw: 24, pitch: 4, dist: 2.4, fov: 30 }, to: { target: [-1.6, 1.6, 0], yaw: 16, pitch: 4, dist: 2.1, fov: 30 } },
  ],
  lanterns: [
    // الكاميرا تمشي على حبل الفوانيس من اليمين إلى اليسار مع إضاءتها
    { size: "medium", aperture: 0.014, from: { target: [4.5, 4.6, -2.2], yaw: -8, pitch: -4, dist: 5.4, fov: 32 }, to: { target: [-4.5, 4.6, -2.2], yaw: 8, pitch: -4, dist: 5.4, fov: 32 } },
    { size: "wide", aperture: 0.006, from: { target: [0, 3.2, -1.5], yaw: 4, pitch: 0, dist: 10.6, fov: 34 }, to: { target: [0, 3.6, -1.5], yaw: -4, pitch: -2, dist: 9.6, fov: 34 } },
  ],
  "alley-wide": [
    { size: "wide", aperture: 0.006, from: { target: [0, 1.8, -0.6], yaw: 0, pitch: 3, dist: 9.8, fov: 34 }, to: { target: [0, 2.3, -0.6], yaw: 0, pitch: 6, dist: 8.6, fov: 34 } },
    { size: "wide", aperture: 0.006, from: { target: [0, 2.2, -1], yaw: -10, pitch: 4, dist: 12.4, fov: 34 }, to: { target: [0, 2.0, -1], yaw: 6, pitch: 3, dist: 11.2, fov: 34 } },
  ],
};
export type AlleyCut = Setup & { a: number; b: number };
/** اللقطات داخل المشهد: لقطة واحدة إلى ٨ ث، وفوقها قطع متساوية (≤٧ ث) تتناوب بين زاويتي اللقطة */
export const alleyCuts = (shot: AlleyShotId, dur: number): AlleyCut[] => {
  const n = dur <= 8 ? 1 : Math.ceil(dur / 7);
  return Array.from({ length: n }, (_, i) => ({ ...SETUPS[shot][i % 2]!, a: (i * dur) / n, b: ((i + 1) * dur) / n }));
};
const camOf = (c: AlleyCut, t: number, still: Window[]): CamState & { focus: number } => {
  const p = ease(span(effectiveTime(t, still), effectiveTime(c.a, still), Math.max(0.01, effectiveTime(c.b, still) - effectiveTime(c.a, still))));
  const L = (x: number, y: number) => x + (y - x) * p;
  const s = { target: [L(c.from.target[0], c.to.target[0]), L(c.from.target[1], c.to.target[1]), L(c.from.target[2], c.to.target[2])] as V3, yaw: L(c.from.yaw, c.to.yaw), pitch: L(c.from.pitch, c.to.pitch), dist: L(c.from.dist, c.to.dist), fov: L(c.from.fov, c.to.fov) };
  return { position: orbit(s), target: s.target, fov: s.fov, focus: s.dist };
};

/** أحداث المشهد بأزمانها (بعد تأخير ما يقع في نافذة سكون)، ولكل حدث صوته (D158) */
export type AlleyEvent = { id: "stalls" | "enter" | "speak" | "self" | "light"; a: number; b: number; sfx: string };
export const alleyEvents = (shot: AlleyShotId, p: Record<string, string | undefined>, words: TimedWord[], still: Window[]): AlleyEvent[] => {
  const ev: AlleyEvent[] = [];
  const add = (id: AlleyEvent["id"], at: number | null, d: number, sfx: string, lead = 0.1) => { if (at !== null) ev.push({ id, a: Math.max(0, at - lead), b: Math.max(0, at - lead) + d, sfx }); };
  if (shot === "market") add("stalls", anchorAt(words, p.stallWord), 0.7, "drop-soft");
  if (shot === "two-figures") {
    add("enter", anchorAt(words, p.enterWord), 1.0, "swipe-paper", 0.2);
    add("speak", anchorAt(words, p.speakWord), 0.5, "swipe-paper", 0.05);
    if (figureCount(p) >= 2) add("self", anchorAt(words, p.selfWord), 0.5, "swipe-paper", 0.05);
  }
  if (shot === "lanterns") add("light", anchorAt(words, p.lightWord), 1.6, "tick");
  // كل حدث يُؤخَّر عن نافذة السكون إلى ما بعدها (لا حدث في الجملة المقدسة)
  return ev.map((e) => { const k = safeKeys([{ a: e.a, b: e.b, to: e }], still)[0]!; return { ...e, a: k.a, b: k.b }; });
};
export const figureCount = (p: Record<string, string | undefined>) => (p.figures === "1" ? 1 : 2);

const SFX = (f: string) => staticFile(`three/sfx/${f}.mp3`);

export const AlleyWorld: React.FC<AlleyWorldProps> = (props) => {
  useBrandFonts();
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const t = frame / fps, dur = durationInFrames / fps;
  const p = props as unknown as Record<string, string | undefined>;
  const shot: AlleyShotId = (props.shot && props.shot in ALLEY_SHOTS ? props.shot : "alley-wide") as AlleyShotId;
  const narration = props.narration ?? "";
  const words = React.useMemo(() => sceneWords(narration, props.narrationTimings, fps, durationInFrames), [narration, props.narrationTimings, fps, durationInFrames]);
  const still = React.useMemo(() => stillWindows(narration, words, true), [narration, words]);
  const events = React.useMemo(() => alleyEvents(shot, p, words, still), [shot, words, still, JSON.stringify(p)]); // eslint-disable-line react-hooks/exhaustive-deps
  const ev = (id: AlleyEvent["id"]) => events.find((e) => e.id === id);
  const prog = (id: AlleyEvent["id"]) => { const e = ev(id); return e ? ease(span(t, e.a, e.b - e.a)) : 0; };
  const nor = useAssetTextures(["balislam-plaster-nor"], [0.25, 0.25]);
  const calm = calmAt(t, still);
  const cuts = alleyCuts(shot, dur);
  const cut = cuts.find((c) => t >= c.a && t < c.b) ?? cuts[cuts.length - 1]!;
  const cam = camOf(cut, t, still);
  // الدكاكين: تنزل في لقطة السوق عند كلمتها، وثابتة في مكانها إن كان المكان سوقًا، ولا تظهر في غيره
  const stallsE = ev("stalls");
  const market = shot === "market" ? (stallsE ? prog("stalls") : 1) : p.setting === "market" ? 1 : null;
  const settle = stallsE ? swing(t, stallsE.b, 0.05, 1.6) * calm : 0;
  const enterE = ev("enter");
  const figures = shot === "two-figures" ? figureCount(p) : 0;
  const enter = shot !== "two-figures" ? 0 : enterE ? prog("enter") : 1;
  const walking = enterE && enter > 0 && enter < 1;
  const wobA = ((enterE ? swing(t, enterE.b, 0.035, 1.8) : 0) + (walking ? 0.02 * Math.sin(t * 14) : 0)) * calm;
  const wobB = ((enterE ? swing(t, enterE.b, -0.03, 1.5) : 0) + (walking ? 0.02 * Math.sin(t * 13 + 1) : 0)) * calm;
  const rest = { shoulder: 0, elbow: 0, wrist: 0 };
  const sp = ev("speak"), se = ev("self");
  const pose1 = sp ? armPose(t, sp, GESTURES.speak, calm) : rest, pose2 = se ? armPose(t, se, GESTURES.self, calm) : rest;
  const lightE = ev("light");
  const lit = shot === "lanterns" ? (lightE ? 7 * span(t, lightE.a, lightE.b - lightE.a) : 0) : 7;
  const sounds = p.sounds !== "off";
  const line = props.captions === false || !words.length ? null : captionLine(narration, words, t);
  if (!nor) return null;
  return (
    <SceneShell {...props} captions={false} eyebrow={undefined} motif={false} watermark={false} background={BAA.paper} durationInFrames={durationInFrames} exitFrames={0} frameless>
      <AlleyStage t={t} width={width} height={height} cam={cam} aperture={cut.aperture} still={still} calm={calm} nor={nor} market={market} settle={settle}
        figures={figures} enter={enter} wobA={wobA} wobB={wobB} pose1={pose1} pose2={pose2} lit={lit} />
      {/* صوت الحارة الخافت، ومع كل حركة صوتها (D158)؛ وفي «بالإسلام» المؤثرات لا تُفرض: sounds=off يطفئها */}
      {sounds && <Audio src={SFX("silence-room")} volume={0.3} loop />}
      {sounds && events.flatMap((e) => e.id === "light"
        ? Array.from({ length: 7 }, (_, i) => <Sequence key={`${e.id}${i}`} from={Math.round((e.a + (i * (e.b - e.a)) / 7) * fps)} durationInFrames={12}><Audio src={SFX("tick")} volume={0.22} /></Sequence>)
        : [<Sequence key={e.id} from={Math.round(e.a * fps)} durationInFrames={Math.max(15, Math.round((e.b - e.a + 0.4) * fps))}><Audio src={SFX(e.sfx)} volume={e.id === "enter" ? 0.4 : 0.25} /></Sequence>,
          ...(e.id === "stalls" ? [<Sequence key="stalls-in" from={Math.round(e.a * fps)} durationInFrames={20}><Audio src={SFX("paper-crumple")} volume={0.25} /></Sequence>] : [])])}
      {line && (
        <AbsoluteFill style={{ pointerEvents: "none" }}>
          {/* الترجمة سطر هادئ (جملة جملة) بحبر الليل وظل فاتح خفيف، بلا مستطيل (D187، D192) */}
          <div style={{ position: "absolute", bottom: props.orientation === "portrait" ? 460 : 56, left: 40, right: 40, display: "flex", justifyContent: "center" }}>
            <div style={{ opacity: line.fade, color: BAA.night, textShadow: CAPTION_SHADOW_LIGHT, padding: "8px 28px", fontFamily: "IBM Plex Sans Arabic", fontWeight: 500, fontSize: 52, direction: "rtl", textAlign: "center" }}>{line.text}</div>
          </div>
        </AbsoluteFill>
      )}
    </SceneShell>
  );
};

/** نموذج المعاينة (محتوى «بالإسلام»، لا يُنشر): رجلان في السوق، كلٌّ يقول الحق معي، ثم جملة الذكر ساكنة */
export const alleyWorldSample: Omit<AlleyWorldProps, "themeId" | "orientation"> = {
  shot: "two-figures",
  setting: "market",
  figures: "2",
  enterWord: "رجلان",
  speakWord: "يقول",
  selfWord: "معي",
  narration: "وقف رجلان في السوق، كلٌّ منهما يقول: الحقُّ معي. واللهُ يعلمُ ما في القلوب.",
};
export const alleyWorldSampleEn = alleyWorldSample;
export const alleyWorldSeconds = 9;
