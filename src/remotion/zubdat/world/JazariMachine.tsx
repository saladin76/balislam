/**
 * قالب «آلات الجزري» (jazari-machine) لـ«زبدة الكتب» — العالم المعتمد «الأفكار آلات» بأسلوب مخطوطة الجزري (D188، D190)
 * بمعايير «الحِرفة» (D189) قالبًا يُستعمل مشهدًا مشهدًا. D201. الآلة نفسها (MachineStage في
 * src/remotion/zubdat/directions/IdeaMachine.tsx): حوض بعوّامة، وقناة ماء مكشوفة وقطرات، وكفّة على ذراع، وترسان
 * متعشّقان بأسنان حقيقية، وحبل وبكرتان يرفعان لوح الفكرة، ونحاس مستعمل، وماء عميق بلمعة، والأسماء بالحبر الأحمر بالنسخ.
 * الحكاية في الحقول، وكل حدث لحظة نطق كلمته: يبدأ التقطير (dripWord) ويمتلئ الكوب، فيميل الذراع (tipWord)، فيدور
 * الترسان (turnWord)، فيصل لوح الفكرة (riseWord) وعليه الفكرة (idea). كلمة غير موجودة = لا حدث (الفراغ أفضل من عنصر
 * خاطئ). اللقطة تختار الزاوية وحدها. عند ذكر الله والدعاء: الجملة كلها ساكنة. بلا فسفوري في هذا العالم (D188).
 */
import React from "react";
import { AbsoluteFill, Audio, Sequence, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { CAPTION_GEOMETRY, captionRows, measureCaption, wordTones, type ProbeGrid } from "../../three/captionProbe";
import { useBrandFonts } from "../../useBrandFonts";
import { calmAt, ease, orbit, safeKeys, swing, type CamState, type V3, type Window } from "../../three";
import { CAPTION_BAND, CAPTION_TONES, anchorAt, captionLine, effectiveTime, sceneWords, stillWindows, type TimedWord } from "../../three/anchors";
import type { SceneBase, StringFields } from "../../scenes/types";
import { SceneShell } from "../../scenes/SceneShell";
import { DRIP_PERIOD, JAZARI, MachineStage, type MachineTags } from "../directions/IdeaMachine";
import { JAZARI_PART_SLOTS, JAZARI_SHOTS, type JazariShotId } from "./shots";
export { JAZARI_SHOTS, type JazariShotId };

export type JazariMachineProps = SceneBase & StringFields<"shot" | "idea" | "parts" | "dripWord" | "tipWord" | "turnWord" | "riseWord">;

const span = (t: number, a: number, d: number) => Math.min(1, Math.max(0, (t - a) / d));
type ShotCam = { target: V3; yaw: number; pitch: number; dist: number; fov: number };
type Setup = { size: "detail" | "medium" | "close" | "wide"; from: ShotCam; to: ShotCam; aperture: number };
const SETUPS: Record<JazariShotId, [Setup, Setup]> = {
  drip: [
    { size: "detail", aperture: 0.022, from: { target: [-3.5, 4.1, 0.05], yaw: 20, pitch: 36, dist: 3.1, fov: 30 }, to: { target: [-2.6, 3.0, 0.05], yaw: 10, pitch: 28, dist: 2.7, fov: 30 } },
    { size: "detail", aperture: 0.024, from: { target: [-2.4, 2.6, 0.05], yaw: -14, pitch: 22, dist: 2.6, fov: 30 }, to: { target: [-2.2, 2.4, 0.05], yaw: -6, pitch: 18, dist: 2.3, fov: 30 } },
  ],
  lever: [
    { size: "medium", aperture: 0.014, from: { target: [-1.4, 2.0, 0], yaw: -18, pitch: 10, dist: 4.6, fov: 32 }, to: { target: [-1.0, 2.0, 0], yaw: -8, pitch: 10, dist: 4.2, fov: 32 } },
    { size: "medium", aperture: 0.014, from: { target: [-0.6, 1.8, 0], yaw: 16, pitch: 8, dist: 4.4, fov: 32 }, to: { target: [-0.9, 1.9, 0], yaw: 6, pitch: 9, dist: 4.0, fov: 32 } },
  ],
  gears: [
    // الترسان ثم الحبل: الكاميرا تتبع الحبل صاعدًا إلى البكرتين واللوح (حركة لها سبب)
    { size: "close", aperture: 0.02, from: { target: [1.2, 2.2, 0], yaw: 14, pitch: 4, dist: 3.0, fov: 32 }, to: { target: [2.3, 3.2, 0.1], yaw: 6, pitch: 2, dist: 3.4, fov: 32 } },
    { size: "close", aperture: 0.02, from: { target: [1.0, 1.7, 0], yaw: -12, pitch: 6, dist: 2.8, fov: 32 }, to: { target: [1.3, 1.9, 0], yaw: -4, pitch: 5, dist: 2.5, fov: 32 } },
  ],
  machine: [
    { size: "wide", aperture: 0.006, from: { target: [0, 2.6, 0], yaw: -12, pitch: 8, dist: 10.4, fov: 34 }, to: { target: [0, 2.6, 0], yaw: -6, pitch: 8, dist: 9.7, fov: 34 } },
    { size: "wide", aperture: 0.006, from: { target: [0.4, 2.4, 0], yaw: 10, pitch: 6, dist: 10.0, fov: 34 }, to: { target: [0.2, 2.6, 0], yaw: 4, pitch: 8, dist: 9.4, fov: 34 } },
  ],
};
export type JazariCut = Setup & { a: number; b: number };
/** اللقطات داخل المشهد: لقطة واحدة إلى ٨ ث، وفوقها قطع متساوية (≤٧ ث) تتناوب بين زاويتي اللقطة */
export const jazariCuts = (shot: JazariShotId, dur: number): JazariCut[] => {
  const n = dur <= 8 ? 1 : Math.ceil(dur / 7);
  return Array.from({ length: n }, (_, i) => ({ ...SETUPS[shot][i % 2]!, a: (i * dur) / n, b: ((i + 1) * dur) / n }));
};
const camOf = (c: JazariCut, t: number, still: Window[]): CamState & { focus: number } => {
  const p = ease(span(effectiveTime(t, still), effectiveTime(c.a, still), Math.max(0.01, effectiveTime(c.b, still) - effectiveTime(c.a, still))));
  const L = (x: number, y: number) => x + (y - x) * p;
  const s = { target: [L(c.from.target[0], c.to.target[0]), L(c.from.target[1], c.to.target[1]), L(c.from.target[2], c.to.target[2])] as V3, yaw: L(c.from.yaw, c.to.yaw), pitch: L(c.from.pitch, c.to.pitch), dist: L(c.from.dist, c.to.dist), fov: L(c.from.fov, c.to.fov) };
  return { position: orbit(s), target: s.target, fov: s.fov, focus: s.dist };
};

/** أحداث الآلة بأزمانها (بعد تأخير ما يقع في نافذة سكون)، ولكل حدث صوته (D158) */
export type JazariEvent = { id: "drip" | "tip" | "turn" | "rise"; a: number; b: number; sfx: string };
export const jazariEvents = (p: Record<string, string | undefined>, words: TimedWord[], still: Window[], dur: number): JazariEvent[] => {
  const d = anchorAt(words, p.dripWord), tip = anchorAt(words, p.tipWord), turn = anchorAt(words, p.turnWord), rise = anchorAt(words, p.riseWord);
  const ev: JazariEvent[] = [];
  // التقطير حتى ميل الذراع إن ذُكر بعده، وإلا ثانيتين ونصفًا
  if (d !== null) ev.push({ id: "drip", a: Math.max(0, d - 0.1), b: tip !== null && tip > d + 0.8 ? tip - 0.1 : Math.min(dur, d + 2.5), sfx: "water-drop" });
  if (tip !== null) ev.push({ id: "tip", a: Math.max(0, tip - 0.1), b: tip + 0.6, sfx: "drop-soft" });
  // الدوران حتى وصول اللوح إن ذُكر بعده، وإلا ثانيتين
  if (turn !== null) ev.push({ id: "turn", a: Math.max(0, turn - 0.1), b: rise !== null && rise > turn + 0.6 ? rise + 0.1 : turn + 2.0, sfx: "gears" });
  if (rise !== null && turn === null) ev.push({ id: "rise", a: Math.max(0, rise - 0.6), b: rise + 0.1, sfx: "gears" });
  return ev.map((e) => { const k = safeKeys([{ a: e.a, b: e.b, to: e }], still)[0]!; return { ...e, a: k.a, b: k.b }; });
};
/** أسماء الأجزاء من الحقل (حتى أربعة بالترتيب)، والبكرة بلا اسم في القالب */
export const jazariTags = (parts?: string): MachineTags => {
  const names = (parts ?? "").split("|").map((x) => x.trim()).slice(0, JAZARI_PART_SLOTS.length);
  return Object.fromEntries(JAZARI_PART_SLOTS.map((k, i) => [k, names[i] ?? ""]).filter(([, v]) => v)) as MachineTags;
};

const SFX = (f: string) => staticFile(`three/sfx/${f}.mp3`);

export const JazariMachine: React.FC<JazariMachineProps> = (props) => {
  const ready = useBrandFonts();
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const t = frame / fps, dur = durationInFrames / fps;
  const p = props as unknown as Record<string, string | undefined>;
  const shot: JazariShotId = (props.shot && props.shot in JAZARI_SHOTS ? props.shot : "machine") as JazariShotId;
  const narration = props.narration ?? "";
  const words = React.useMemo(() => sceneWords(narration, props.narrationTimings, fps, durationInFrames), [narration, props.narrationTimings, fps, durationInFrames]);
  const still = React.useMemo(() => stillWindows(narration, words, true), [narration, words]);
  const events = React.useMemo(() => jazariEvents(p, words, still, dur), [words, still, dur, JSON.stringify(p)]); // eslint-disable-line react-hooks/exhaustive-deps
  const ev = (id: JazariEvent["id"]) => events.find((e) => e.id === id);
  const prog = (id: JazariEvent["id"]) => { const e = ev(id); return e ? ease(span(t, e.a, e.b - e.a)) : 0; };
  const calm = calmAt(t, still);
  const tipE = ev("tip"), turnE = ev("turn") ?? ev("rise");
  const lever = -0.28 + prog("tip") * 0.5 + (tipE ? swing(t, tipE.b, 0.06, 1.8) * calm : 0);
  const turn = ev("turn") ? prog("turn") : prog("rise");
  const boardSway = turnE ? swing(t, turnE.b, 0.07, 1.3) * calm : 0;
  const cuts = jazariCuts(shot, dur);
  const cut = cuts.find((c) => t >= c.a && t < c.b) ?? cuts[cuts.length - 1]!;
  const cam = camOf(cut, t, still);
  const drip = ev("drip");
  // الكفّة ممتلئة إن مال الذراع بلا تقطير في هذا المشهد (لا يميل ذراع بكفّة فارغة)
  const fillAt = !drip && tipE ? 1 : 0;
  const line = props.captions === false || !words.length ? null : captionLine(narration, words, t);
  // نبرة كل كلمة من الإطار المرسوم نفسه: القياس يصل بعد رسم المسرح، فيُنتظر (delayRender) حتى يصل قياس هذا الإطار
  const captionBottom = props.orientation === "portrait" ? 460 : 56;
  const rows = React.useMemo(() => captionRows(height, captionBottom), [height, captionBottom]);
  const [probe, setProbe] = React.useState<ProbeGrid | null>(null);
  const onProbe = React.useCallback((g: ProbeGrid) => setProbe((p) => (p?.frame === g.frame ? p : g)), []);
  const waiting = React.useRef<{ frame: number; h: number } | null>(null);
  if (line && ready && probe?.frame !== frame && waiting.current?.frame !== frame) {
    if (waiting.current) continueRender(waiting.current.h);
    waiting.current = { frame, h: delayRender(`قياس ما خلف الترجمة ${frame}`) };
  }
  React.useEffect(() => {
    if (waiting.current && (!line || probe?.frame === waiting.current.frame)) { continueRender(waiting.current.h); waiting.current = null; }
  });
  const tones = React.useMemo(() => (line && ready && probe?.frame === frame ? wordTones(line.text, probe, width, measureCaption) : []), [line?.text, probe, frame, width, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <SceneShell {...props} captions={false} eyebrow={undefined} motif={false} watermark={false} background={JAZARI.paperDeep} durationInFrames={durationInFrames} exitFrames={0} frameless>
      <MachineStage t={t} width={width} height={height} cam={cam} aperture={cut.aperture} still={still} calm={calm} ready={ready}
        drip={drip ? { a: drip.a, b: drip.b } : null} fillAt={fillAt} lever={lever} turn={turn} boardSway={boardSway} idea={props.idea ?? ""} tags={jazariTags(props.parts)} captionBand={line ? CAPTION_BAND : 0}
        probe={line ? { frame, rows, onProbe } : undefined} />
      {/* صوت الورشة الخافت، ومع كل حركة صوتها (D158): كل قطرة، وميل الذراع، ودوران الترس والبكرتين، ووصول اللوح */}
      <Audio src={SFX("silence-room")} volume={0.3} loop />
      {drip && Array.from({ length: 40 }, (_, k) => drip.a + (k + 1) * DRIP_PERIOD).filter((x) => x <= drip.b + DRIP_PERIOD).map((x, i) => <Sequence key={`d${i}`} from={Math.round(x * fps)} durationInFrames={12}><Audio src={SFX("water-drop")} volume={0.32 + (i % 3) * 0.06} /></Sequence>)}
      {tipE && <Sequence from={Math.round(tipE.a * fps)} durationInFrames={25}><Audio src={SFX("drop-soft")} volume={0.5} /></Sequence>}
      {turnE && <Sequence from={Math.round(turnE.a * fps)} durationInFrames={Math.max(15, Math.round((turnE.b - turnE.a) * fps))}><Audio src={SFX("gears")} volume={0.55} /></Sequence>}
      {turnE && <Sequence from={Math.round(turnE.b * fps)} durationInFrames={15}><Audio src={SFX("tick")} volume={0.5} /></Sequence>}
      {line && (
        <AbsoluteFill style={{ pointerEvents: "none" }}>
          {/* الترجمة سطر هادئ (جملة جملة) بلا مستطيل (D187، D192). كل كلمة بنبرة ما خلفها فعلًا في الإطار (قرار المالك ٢٣ نوفمبر):
              حبر داكن بهالة فاتحة على ورق المخطوطة والجص البيج، ونص فاتح بحد داكن على الخشب؛ والسطر الواحد يقع على الاثنين معًا */}
          <div style={{ position: "absolute", bottom: captionBottom, left: CAPTION_GEOMETRY.side, right: CAPTION_GEOMETRY.side, display: "flex", justifyContent: "center" }}>
            <div style={{ opacity: line.fade, padding: `${CAPTION_GEOMETRY.padY}px ${CAPTION_GEOMETRY.padX}px`, fontFamily: "Tajawal", fontWeight: 500, fontSize: CAPTION_GEOMETRY.fontSize, lineHeight: `${CAPTION_GEOMETRY.lineHeight}px`, direction: "rtl", textAlign: "center" }}>
              {line.text.split(" ").filter(Boolean).map((w, i) => {
                const tone = tones[i] ?? "ink";
                return <React.Fragment key={i}>{i ? " " : ""}<span style={{ color: tone === "ink" ? JAZARI.ink : JAZARI.paper, textShadow: CAPTION_TONES[tone].textShadow }}>{w}</span></React.Fragment>;
              })}
            </div>
          </div>
        </AbsoluteFill>
      )}
    </SceneShell>
  );
};

/** نموذج المعاينة (محتوى «زبدة الكتب»، لا يُنشر): الحضور قبل الشعور، ثم جملة الذكر ساكنة */
export const jazariMachineSample: Omit<JazariMachineProps, "themeId" | "orientation"> = {
  shot: "machine",
  idea: "الحضور",
  parts: "الحوض|العوّامة|الكفّة|الدولاب",
  dripWord: "يصلّي",
  tipWord: "ينتظر",
  turnWord: "الشعور",
  riseWord: "الحضور",
  narration: "كثيرٌ منّا يصلّي ولا يشعر، لأنّه ينتظر الشعور قبل الحضور. واللهُ أقربُ إلينا ممّا نظن.",
};
export const jazariMachineSampleEn = jazariMachineSample;
export const jazariMachineSeconds = 10;
