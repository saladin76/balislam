import React from "react";
import { CLOTH, ID, darken, mix } from "../palette";
import { Figure, LOOKS, POSES, blendPose, handAt, walkPose, type FigureLook, type PoseSpec } from "../Figure";
import { Bench, GROUND, Glow, WallLamp, archPath } from "../world";
import { Courtyard } from "./outdoor";
import { Cafe, CafeTable, Chair } from "./interior";
import { StandardWeight } from "./scale";
import { StallSet, ValueScale, oranges, CH2_CAST } from "./ch2";
import { BRO_DOOR, CARRY, CH3_CAST, END, EnvelopeGlyph, GIVE, KNOCK, Lane, LaneHero, LaneWalker, PAGE, PageGlyph, PageInsert, lanePos, tlPose } from "./ch3";
import { SEAT, SIT_HOLD } from "./ch4";
import { BuzzArcs, MsgCard, flight, seatedPhone } from "./phone";
import { K, Walker, prog, pz, type CamKey, type ShotCtx } from "./kit";

/**
 * الحلقة 001 · الفصل 6 «هل أنت مستعد لأن تكون مخطئًا؟» — ختام الحلقة. التخطيط في storyboard/ch6-plan.md (التوجيه 025).
 * القصة الإطار: البطل عند باب أخيه صباحًا والظرف معه (من c4-s18). الممارسات الثلاث مشاهد قصيرة من يومه:
 * أ. السؤال (c6-s1 → c6-s5): عند باب الأخ، الصفحة المرمَّمة دليل خطئه، فيجلس على عتبة جانبية ولا يطرق بعد.
 * ب. التثبت (c6-s6 → c6-s9): المقهى؛ تصله الرسالة نفسها من المرسِل نفسه فيقلب هاتفه ويسأله عن مصدرها. c6-s8 ساكن، c6-s9 الآية معلّقة.
 * ج. مراجعة النية (c6-s10 → c6-s13): صحن الدار؛ نقاش مع الرجل القاسي، يتوقف إصبعه المرفوع ويستمع ويأخذ منه ورقته.
 * د. تصحيح الموقف (c6-s14 → c6-s18): يطرق الباب، يعترف قائمًا، يمد الظرف فيتأمله أخوه ثم يأخذه (لا مصالحة فورية)؛
 *    الميزان والثقل المعياري (الحق ليس وجهة نظر)؛ والشيخ في صحن الدار (التواضع والرجوع إلى أهل العلم).
 * هـ. الاستماع (c6-s19 → c6-s21): مساءً يجلس أخوه على مصطبة بابه ويتكلم، والبطل يستمع ولا يُعدّ ردًا.
 * و. الختام (c6-s22 → c6-s25): سكون الدعاء، ثم يناوله أخوه كأس شاي، ثم تبتعد الكاميرا على الزقاق والبابان مضيئان.
 * لا حوار جديد ولا لافتات؛ كل فعل (الوصول، الاعتراف، رد المال، القبول) يقع في مشهد مستقل على كلمته.
 */

const INK = darken(ID.night, 0.55);
const hero = LOOKS.hero as FigureLook;
const brother = CH3_CAST.brother;
type Ch6Shot = { nameAr: string; place: string; render: (c: ShotCtx) => { cam: CamKey[]; world: React.ReactNode; captionBackdrop?: number } };
const V = (t: number, x: number, z: number, y: number, cut = false): CamKey => ({ t, x, y, z, ...(cut ? { cut } : {}) });

// ———————————————————— الزقاق عند باب الأخ (اللقطة العادية: الباب في صدر الزقاق) ————————————————————
/** البطل أمام باب أخيه، والعتبة الحجرية على يمين الباب حيث يجلس */
const AT_DOOR = 0.86;
const STEP = { x: 1080, w: 110, base: END.base + 4 };
const STEP_S = 0.64;
const DoorStep: React.FC = () => (
  <g>
    <rect x={STEP.x - STEP.w / 2} y={STEP.base - 46} width={STEP.w} height={46} fill={mix(darken(ID.copper, 0.35), ID.night, 0.25)} stroke={INK} strokeWidth={2} />
    <rect x={STEP.x - STEP.w / 2 - 6} y={STEP.base - 52} width={STEP.w + 12} height={8} fill={mix(darken(ID.copper, 0.2), ID.night, 0.2)} stroke={INK} strokeWidth={1.6} />
  </g>
);
/** الأخ في عتبة بابه (صدر الزقاق)، يلتفت إلى البطل */
const BrotherInDoor: React.FC<{ frame: number; pose: PoseSpec; o?: number; envelope?: boolean }> = ({ frame, pose, o = 1, envelope = false }) => {
  const p = { x: BRO_DOOR.x + BRO_DOOR.w / 2 + 22, y: END.base + 2, s: 0.66 };
  const h = handAt(pose, { x: p.x, y: p.y, scale: p.s, flip: true });
  return (
    <g opacity={o}>
      <Figure x={p.x} y={p.y} scale={p.s} pose={pose} look={brother} flip frame={frame + 9} />
      {envelope ? <EnvelopeGlyph x={h.x} y={h.y} s={p.s} /> : null}
    </g>
  );
};
const DOOR_CAM = (t: number, portrait: boolean, z = 2.4, cut = false) => (portrait ? V(t, 930, z * 0.8, 500, cut) : V(t, 930, z, 495, cut));
const SITTING: PoseSpec = { ...SIT_HOLD, head: 16 };
/** مصباح الجدار الأيسر في الزقاق (WallLamp في Lane) */
const PREDAWN_LAMP = { x: 620, y: 330 };
/** c6-s3 (التوجيه 028): متوسطة قريبة على البطل عند الباب، من الرأس إلى الركبتين، ويداه في وسط الإطار */
const S3_CAM = (portrait: boolean) => (portrait ? V(0, 905, 3.3, 480) : V(0, 905, 3.9, 475));

// ———————————————————— مصطبة باب الأخ (اللقطة المقابلة: بابه على الجدار الأيسر القريب) ————————————————————
const BENCH_BRO = { x: SEAT.x - 70, y: SEAT.y };
const BRO_SEAT_X = BENCH_BRO.x - 10;
// مسافة بين الأخوين على المصطبة: متجاوران لا متلاصقان (لا عناق)
const HERO_SEAT_X = BRO_SEAT_X + 310;
const PAIR_S = 1.55;
/** مصطبة أطول قليلًا من مصطبة البطل: تتسع لاثنين */
const PairBench: React.FC = () => {
  const h = SEAT.h * (PAIR_S / 1.75);
  const x0 = BRO_SEAT_X - 90;
  const w = HERO_SEAT_X - BRO_SEAT_X + 180;
  return (
    <g>
      <rect x={x0} y={SEAT.y - h} width={w} height={h} fill={mix(darken(ID.copper, 0.35), ID.night, 0.35)} stroke={INK} strokeWidth={3} />
      <rect x={x0 - 8} y={SEAT.y - h - 12} width={w + 16} height={14} fill={mix(darken(ID.copper, 0.2), ID.night, 0.3)} stroke={INK} strokeWidth={3} />
    </g>
  );
};
const PAIR_CAM = (t: number, portrait: boolean, cut = false) => (portrait ? V(t, 380, 1.1, 760, cut) : V(t, 420, 1.3, 740, cut));
const TALK_A: PoseSpec = { ...POSES.sit, head: 6, armFront: { s: 46, e: 50 } };
const TALK_B: PoseSpec = { ...POSES.sit, head: 12, armFront: { s: 30, e: 66 } };
const LISTEN: PoseSpec = { ...POSES.sit, head: 14, lean: 8 };

// ———————————————————— زوايا المصطبة (التوجيه 028): لقطة ولقطة مقابلة حقيقيتان، لا قص من الأفقي ————————————————————
/**
 * الجلسة نفسها من زاويتين أقرب، كلٌّ في منطقة من العالم بخلفيتها، على خط المحور نفسه (الأخ يسار الإطار والبطل يمينه):
 * - BRO_ANGLE: من وراء كتف البطل الأيمن نحو الأخ؛ خلفه جدار بيته وبابه المضيء ومصباحه، والبطل ظلٌّ كبير في مقدمة اليمين.
 * - HERO_ANGLE: من وراء كتف الأخ الأيسر نحو البطل؛ خلفه الجدار المقابل بنافذته ومصباحه، والأخ ظلٌّ في مقدمة اليسار.
 * الشخصان بزاوية ثلاثة أرباع (view) لا جانبيان، فتُقرأ الإيماءة القائمة (اليد تهمّ ثم تنزل، والسكوت) على الهاتف.
 */
const BRO_ANGLE = { x: 9000, floor: 1000 };
const HERO_ANGLE = { x: 13000, floor: 1000 };
const ANG_S = 2.4;
const FG_S = 3.6;
const ANG_VIEW = 0.45;
const silOf = (look: FigureLook) => mix(darken(CLOTH[look.cloth as keyof typeof CLOTH] ?? ID.night, 0.62), ID.night, 0.3);
const duskWall = mix(mix(ID.copper, ID.paper, 0.5), ID.night, 0.3);
/** مصطبة عريضة بالمنظور القريب: سطح وواجهة، بارتفاع يناسب حجم الجالس */
const NearBench: React.FC<{ x0: number; x1: number; floor: number; s: number }> = ({ x0, x1, floor, s }) => {
  const h = 74 * s;
  return (
    <g>
      <rect x={x0} y={floor - h} width={x1 - x0} height={h} fill={mix(darken(ID.copper, 0.35), ID.night, 0.35)} stroke={INK} strokeWidth={4} />
      <rect x={x0 - 10} y={floor - h - 16} width={x1 - x0 + 20} height={18} fill={mix(darken(ID.copper, 0.2), ID.night, 0.3)} stroke={INK} strokeWidth={4} />
    </g>
  );
};
/** زاوية الأخ: جدار بيته وبابه المضيء (الباب نفسه على يسار المصطبة في لقطة الاثنين) */
const BroAngleSet: React.FC<{ frame: number; broPose: PoseSpec; heroPose: PoseSpec; portrait: boolean }> = ({ frame, broPose, heroPose, portrait }) => {
  const { x, floor } = BRO_ANGLE;
  const wallBase = floor - 120;
  const door = { x: x - 520, w: 230, h: 400 };
  const fgX = x + (portrait ? 600 : 960);
  return (
    <g>
      <rect x={x - 2400} y={-1400} width={4800} height={wallBase + 1400} fill={duskWall} stroke={INK} strokeWidth={4} />
      <rect x={x - 2400} y={wallBase} width={4800} height={1600} fill={mix(darken(ID.copper, 0.4), ID.night, 0.3)} />
      <line x1={x - 2400} y1={wallBase} x2={x + 2400} y2={wallBase} stroke={INK} strokeWidth={4} />
      <Glow cx={door.x + door.w / 2} cy={wallBase - 180} r={420} color={ID.dawn} opacity={0.5} />
      <path d={archPath(door.x - 18, wallBase, door.w + 36, door.h + 20)} fill={darken(ID.copper, 0.45)} stroke={INK} strokeWidth={4} />
      <path d={archPath(door.x, wallBase, door.w, door.h)} fill={mix(darken(ID.copper, 0.25), ID.dawn, 0.55 * 0.7)} stroke={INK} strokeWidth={3} />
      <g transform={`translate(${x + 380} ${wallBase - 560}) scale(1.8) translate(${-620} ${-330})`}>
        <WallLamp x={620} y={330} frame={frame} on={1} />
      </g>
      <NearBench x0={x - 300} x1={x + 1400} floor={floor} s={ANG_S} />
      <Figure x={x} y={floor} scale={ANG_S} pose={broPose} look={brother} view={ANG_VIEW} frame={frame + 9} />
      <Figure x={fgX} y={floor + 300} scale={FG_S} pose={heroPose} look={hero} flip silhouette={silOf(hero)} shadow={false} frame={frame} />
    </g>
  );
};
/** زاوية البطل: الجدار المقابل بنافذته ومصباحه، والأخ ظلٌّ في المقدمة */
const HeroAngleSet: React.FC<{ frame: number; broPose: PoseSpec; heroPose: PoseSpec; portrait: boolean }> = ({ frame, broPose, heroPose, portrait }) => {
  const { x, floor } = HERO_ANGLE;
  const wallBase = floor - 120;
  const fgX = x - (portrait ? 600 : 960);
  const wall = darken(duskWall, 0.12);
  return (
    <g>
      <rect x={x - 2400} y={-1400} width={4800} height={wallBase + 1400} fill={wall} stroke={INK} strokeWidth={4} />
      <rect x={x - 2400} y={wallBase} width={4800} height={1600} fill={mix(darken(ID.copper, 0.4), ID.night, 0.3)} />
      <line x1={x - 2400} y1={wallBase} x2={x + 2400} y2={wallBase} stroke={INK} strokeWidth={4} />
      <Glow cx={x + 470} cy={wallBase - 520} r={260} color={ID.dawn} opacity={0.35} />
      <rect x={x + 380} y={wallBase - 620} width={180} height={200} fill={mix(darken(ID.night, 0.15), ID.dawn, 0.35)} stroke={INK} strokeWidth={4} />
      <line x1={x + 470} y1={wallBase - 620} x2={x + 470} y2={wallBase - 420} stroke={INK} strokeWidth={3} />
      <g transform={`translate(${x - 420} ${wallBase - 560}) scale(1.8) translate(${-620} ${-330})`}>
        <WallLamp x={620} y={330} frame={frame} on={1} />
      </g>
      <NearBench x0={x - 1400} x1={x + 300} floor={floor} s={ANG_S} />
      <Figure x={x} y={floor} scale={ANG_S} pose={heroPose} look={hero} flip view={ANG_VIEW} frame={frame} />
      <Figure x={fgX} y={floor + 300} scale={FG_S} pose={broPose} look={brother} silhouette={silOf(brother)} shadow={false} frame={frame + 9} />
    </g>
  );
};
/** كاميرات الزاويتين: OTS بظل المقدمة، والقريبة على البطل وحده (سؤال النفس) */
const BRO_OTS = (t: number, portrait: boolean, cut = true) => (portrait ? V(t, BRO_ANGLE.x + 160, 0.95, 640, cut) : V(t, BRO_ANGLE.x + 330, 1.2, 600, cut));
const HERO_OTS = (t: number, portrait: boolean, cut = true) => (portrait ? V(t, HERO_ANGLE.x - 160, 0.95, 640, cut) : V(t, HERO_ANGLE.x - 330, 1.2, 600, cut));
const HERO_CLOSE = (t: number, portrait: boolean, cut = true) => (portrait ? V(t, HERO_ANGLE.x - 40, 1.35, 580, cut) : V(t, HERO_ANGLE.x - 10, 1.75, 520, cut));
/** آخر وضعية في c6-s21 (اليد على الصدر)، ويبقى عليها مجمَّدًا في c6-s22: اللقطة نفسها تستمر ساكنة */
const BENCH_ACCEPT: PoseSpec = { ...POSES.sit, head: 20, armFront: { s: 38, e: 118 } };
const broTalking = (frame: number) => blendPose(TALK_A, TALK_B, 0.5 + 0.5 * Math.sin(frame / 8));

/**
 * رسالة ثانية من المرسِل نفسه (التوجيه 026): ليست إعادة تداول رسالة c4-s9، فرأسها بلون الختم لا بلون الفجر،
 * ولا نص ولا مضمون لها (لا يضيف السكريبت مضمونًا).
 */
const SECOND_MSG = mix(ID.seal, ID.copper, 0.35);

// ———————————————————— صحن الدار ————————————————————
const COURT = { bench: 420, benchW: 470, harsh: 530, hero: 790 };

export const CH6_SHOTS: Record<string, Ch6Shot> = {
  // ——— أ. السؤال ———
  "lane-before-brother-door": {
    nameAr: "الزقاق صباحًا: البطل أمام باب أخيه والظرف في يده، يرفع رأسه إلى الباب",
    place: "الزقاق عند باب الأخ صباحًا",
    render: ({ frame, at, portrait }) => {
      // استمرار c4-s18: بلغ الآن باب أخيه. عند «يجتهد» يرفع رأسه إلى الباب ولا يطرق
      const tJ = at("يجتهد", 0.5);
      return {
        cam: portrait ? [V(0, 800, 1.1, 600), DOOR_CAM(tJ - 10, portrait)] : [V(0, 860, 1.5, 560), DOOR_CAM(tJ - 10, portrait)],
        world: (
          <g>
            <Lane frame={frame} mood="dawn" lit={1} heroDoor={0.5} brotherDoor={0.3} />
            <DoorStep />
            <LaneHero d={AT_DOOR} pose={{ ...CARRY, head: frame >= tJ ? -12 : 8 }} frame={frame} />
          </g>
        ),
      };
    },
  },
  "page-mended-insert": {
    nameAr: "لقطة قريبة: الصفحة المرمَّمة بقطعتها في يده، وآثار المخالب تضيء (دليل خطئه)",
    place: "لقطة قريبة للصفحة",
    render: ({ frame, at, portrait }) => {
      const tS = at("صحيحة", 0.73);
      return {
        cam: portrait ? [V(0, PAGE.x, 0.85, PAGE.y), V(tS - 10, PAGE.x, 0.95, PAGE.y)] : [V(0, PAGE.x, 1.3, PAGE.y), V(tS - 10, PAGE.x, 1.5, PAGE.y)],
        world: <PageInsert paws={prog(frame, tS - 4, tS + 12)} />,
      };
    },
  },
  "lane-weighs-evidence": {
    nameAr: "الزقاق: الصفحة في يد والظرف في الأخرى، ثم يضع الصفحة في جيبه ويضم الظرف ويخطو نحو الباب",
    place: "الزقاق عند باب الأخ صباحًا",
    render: ({ frame, at, portrait }) => {
      // «يزنها بالدليل»: الصفحة (الدليل) مرفوعة أمامه والظرف في يده الأخرى؛ «مستعدًا»: يطوي الصفحة في جيبه ويضم الظرف؛
      // «خطؤه»: يخطو خطوة نحو الباب
      const tW = at("يزنها", 0.12);
      const tR = at("مستعدا", 0.49);
      const tE = at("خطؤه", 0.85);
      const SHOW_PAGE: PoseSpec = { ...POSES.stand, head: 18, armFront: { s: 70, e: 20 }, armBack: { s: 20, e: 40 } };
      const READY: PoseSpec = { ...POSES.stand, head: 4, armFront: { s: 64, e: 86 } };
      const pose = tlPose(frame, [[0, { ...CARRY, head: 6 }], [tW - 6, SHOW_PAGE], [tR - 4, { ...SHOW_PAGE, armFront: { s: 40, e: 100 } }], [tR + 10, READY]]);
      const stepping = frame >= tE && frame < tE + 18;
      const p = lanePos(AT_DOOR);
      const h = handAt(pose, { x: p.x, y: p.y, scale: p.s });
      const pageOn = frame >= tW - 2 && frame < tR + 6;
      return {
        // التوجيه 028: تأطير مختلف عن c6-s1 وc6-s4: لقطة متوسطة قريبة ثابتة على يديه (الصفحة ثم الظرف) والباب بجانبه،
        // فيُقرأ الاستعداد للتصحيح من اليدين. الزمن والمكان وحركة الظرف والخطوة كما هي
        cam: [S3_CAM(portrait)],
        world: (
          <g>
            <Lane frame={frame} mood="dawn" lit={1} heroDoor={0.5} brotherDoor={0.3} />
            <DoorStep />
            {stepping ? (
              <LaneWalker frame={frame} d0={AT_DOOR} d1={0.9} start={tE} end={tE + 18} />
            ) : (
              <LaneHero d={frame < tE ? AT_DOOR : 0.9} pose={frame < tE ? pose : READY} frame={frame} carry={!pageOn} />
            )}
            {pageOn ? <PageGlyph x={h.x} y={h.y - 4} s={0.16} piece={1} /> : null}
          </g>
        ),
      };
    },
  },
  "lane-sits-at-door": {
    nameAr: "الزقاق: ينظر إلى الباب المغلق، يطرق رأسه، ثم يجلس على العتبة الجانبية ولا يطرق",
    place: "الزقاق عند باب الأخ صباحًا",
    render: ({ frame, at, portrait }) => {
      const tM = at("معصوم", 0.72);
      const tE = at("الخطأ", 0.84);
      const sat = frame >= tE + 14;
      const moving = frame >= tE && frame < tE + 14;
      const p0 = lanePos(0.9);
      const x = moving ? p0.x + (STEP.x - p0.x) * prog(frame, tE, tE + 14, (v) => v) : p0.x;
      return {
        // العمودي: الكاميرا تتبعه إلى العتبة على يمين الباب حتى لا يخرج من الإطار
        cam: portrait ? [DOOR_CAM(0, portrait, 2.1), DOOR_CAM(tM, portrait, 2.3), V(tE, 1010, 1.85, 500)] : [DOOR_CAM(0, portrait, 2.4), DOOR_CAM(tM, portrait, 2.6)],
        world: (
          <g>
            <Lane frame={frame} mood="dawn" lit={1} heroDoor={0.5} brotherDoor={0.3} />
            <DoorStep />
            {sat ? (
              <g>
                <Figure x={STEP.x} y={STEP.base} scale={STEP_S} pose={SITTING} look={hero} frame={frame} />
              </g>
            ) : moving ? (
              <Figure x={x} y={p0.y + (STEP.base - p0.y) * prog(frame, tE, tE + 14)} scale={p0.s + (STEP_S - p0.s) * prog(frame, tE, tE + 14)} pose={walkPose(CARRY, (frame / 30) * Math.PI * 2)} look={hero} frame={frame} />
            ) : (
              <LaneHero d={0.9} pose={{ ...CARRY, head: frame >= tM ? 24 : 2 }} frame={frame} />
            )}
          </g>
        ),
      };
    },
  },
  "lane-sits-wide": {
    nameAr: "الزقاق (عريضة): يقوم عن العتبة ويمضي عائدًا في الطريق والظرف معه، ولم يطرق",
    place: "الزقاق عند باب الأخ صباحًا",
    render: ({ frame, at, portrait }) => {
      // التوجيه 026 (الترتيب الزمني): الكاميرا تبتعد إلى الزقاق كله عند «ثلاث»، فيقوم عند «ممارسات» ويمشي عائدًا
      // نحو بيته: يغادر الباب في اليوم نفسه، فالمقهى وصحن الدار بعده أحداث تقع فعلًا قبل عودته في c6-s14.
      const tT = at("ثلاث", 0.2);
      const tP = at("ممارسات", 0.31);
      const READY: PoseSpec = { ...POSES.stand, head: 10, armFront: { s: 34, e: 52 } };
      const rising = frame >= tP && frame < tP + 10;
      const walking = frame >= tP + 10;
      return {
        cam: portrait ? [V(0, 1010, 1.85, 500), V(tT, 840, 0.75, 600)] : [DOOR_CAM(0, portrait, 2.6), V(tT, 960, 1.0, 540)],
        world: (
          <g>
            <Lane frame={frame} mood="dawn" lit={1} heroDoor={0.5} brotherDoor={0.3} />
            <DoorStep />
            {walking ? (
              <LaneWalker frame={frame} d0={0.9} d1={0.55} start={tP + 10} end={tP + 10 + 90} flip />
            ) : (
              <Figure x={STEP.x} y={STEP.base} scale={STEP_S} pose={rising ? blendPose(SITTING, READY, prog(frame, tP, tP + 10)) : SITTING} look={hero} frame={frame} />
            )}
          </g>
        ),
      };
    },
  },
  "cafe-message-again": {
    nameAr: "المقهى: يرسل الرجل نفسه رسالة إلى البطل، فيرفع هاتفه وينظر",
    place: "مقهى الحارة",
    render: ({ frame, at, portrait }) => {
      const tSend = at("الأولى", 0.05) + 2;
      const tT = at("التثبت", 0.24);
      const tH = at("الحكم", 0.5);
      const SENDER = { x: 560, flip: false };
      const from = seatedPhone(SENDER.x, SENDER.flip);
      const to = seatedPhone(1120, true);
      const fly = prog(frame, tSend, tT, (v) => v);
      const f = flight(from, to, fly);
      return {
        cam: portrait ? [K(0, 840, 0.9), K(tH - 6, 1100, 1.4)] : [K(0, 860, 1.25), K(tH - 6, 1060, 1.75)],
        world: (
          <g>
            <Cafe frame={frame} />
            <Chair x={SENDER.x - 20} />
            <CafeTable x={700} frame={frame} />
            <Chair x={1140} flip />
            <CafeTable x={960} frame={frame} />
            <Figure x={SENDER.x} y={GROUND} scale={1.04} pose={pz(frame, [[0, "sit-show"], [tSend - 4, "sit-nod"], [tSend + 8, "sit-show"]])} look={LOOKS.stranger as FigureLook} holding="phone" frame={frame + 7} />
            {fly > 0 && fly < 1 ? <MsgCard x={f.x} y={f.y - 20} s={1.1} tone={SECOND_MSG} /> : null}
            <BuzzArcs x={to.x} y={to.y} p={prog(frame, tT - 2, tT + 24, (t) => t)} />
            <MsgCard x={to.x} y={to.y - 34} s={0.8} o={prog(frame, tT, tT + 6)} tone={SECOND_MSG} />
            <Figure x={1120} y={GROUND} scale={1.1} pose={pz(frame, [[0, "sit"], [tT + 4, "sit-show"]])} look={hero} flip holding="phone" frame={frame} />
          </g>
        ),
      };
    },
  },
  "cafe-checks-source": {
    nameAr: "المقهى: لا يعيد إرسالها؛ يقلب هاتفه على الطاولة، ثم يقوم إلى المرسِل ويسأله عن مصدرها فيُطرق",
    place: "مقهى الحارة",
    render: ({ frame, at, portrait }) => {
      // «لا تصدق خبرًا… يوافق رأيك»: ينظر إلى الرسالة طويلًا ولا يومئ؛ «تنشر»: يقلب الهاتف على الطاولة (لا إرسال)؛
      // «التحقق»: يقوم ويمشي إلى المرسِل؛ «منها»: يسأله بكف مفتوحة، فيخفض الرجل هاتفه ورأسه (لا مصدر عنده)
      const tN = at("تنشر", 0.55);
      const tV = at("التحقق", 0.76);
      const tM = at("منها", 0.86);
      const down = frame >= tN + 8;
      const walking = frame >= tV && frame < tM;
      const ASK: PoseSpec = { ...POSES.talk, head: 14, armFront: { s: 50, e: 30 } };
      const to = seatedPhone(1120, true);
      return {
        cam: portrait ? [K(0, 1100, 1.4), K(tN - 4, 1040, 1.6), K(tV, 800, 0.95)] : [K(0, 1060, 1.75), K(tN - 4, 1020, 1.9), K(tV, 860, 1.3)],
        world: (
          <g>
            <Cafe frame={frame} />
            <Chair x={540} />
            <CafeTable x={700} frame={frame} />
            <Chair x={1140} flip />
            <CafeTable x={960} frame={frame} />
            {down ? <rect x={990} y={GROUND - 186} width={46} height={12} rx={3} fill={darken(ID.night, 0.3)} stroke="#1a1208" strokeWidth={2} /> : null}
            {!down ? <MsgCard x={to.x} y={to.y - 34} s={0.8} o={1 - prog(frame, tN, tN + 8)} tone={SECOND_MSG} /> : null}
            <Figure x={560} y={GROUND} scale={1.04} pose={pz(frame, [[0, "sit-show"], [tM + 10, "sit-low"]])} look={LOOKS.stranger as FigureLook} holding={frame < tM + 10 ? "phone" : "none"} frame={frame + 7} />
            {walking ? (
              <Walker frame={frame} from={1120} to={790} y={GROUND} start={tV} end={tM} look={hero} scale={1.1} />
            ) : frame >= tM ? (
              <Figure x={790} y={GROUND} scale={1.1} pose={tlPose(frame, [[tM, ASK], [tM + 30, { ...POSES.stand, head: 12 }]])} look={hero} flip frame={frame} />
            ) : (
              <Figure x={1120} y={GROUND} scale={1.1} pose={pz(frame, [[0, "sit-show"], [tN + 2, "sit"]])} look={hero} flip holding={down ? "none" : "phone"} frame={frame} />
            )}
          </g>
        ),
      };
    },
  },
  "cafe-still": {
    nameAr: "المقهى ساكنًا: البطل واقف عند طاولة المرسِل، والرجل مطرق والهاتف مقلوب على الطاولة الأخرى (تمهيد الآية)",
    place: "مقهى الحارة",
    // c6-s8 تمهيد الآية (ذكر الله): كاميرا واحدة والعالم مجمَّد
    render: ({ portrait }) => ({
      cam: portrait ? [K(0, 840, 0.95)] : [K(0, 880, 1.3)],
      world: (
        <g>
          <Cafe frame={0} />
          <Chair x={540} />
          <CafeTable x={700} frame={0} />
          <Chair x={1140} flip />
          <CafeTable x={960} frame={0} />
          <rect x={990} y={GROUND - 186} width={46} height={12} rx={3} fill={darken(ID.night, 0.3)} stroke="#1a1208" strokeWidth={2} />
          <Figure x={560} y={GROUND} scale={1.04} pose={POSES["sit-low"]} look={LOOKS.stranger as FigureLook} frame={0} />
          <Figure x={790} y={GROUND} scale={1.1} pose={{ ...POSES.stand, head: 12 }} look={hero} flip frame={0} />
        </g>
      ),
    }),
  },

  // ——— ج. مراجعة النية ———
  "court-debate-finger": {
    nameAr: "صحن الدار ليلًا: نقاش على مصطبة؛ الرجل القاسي يتكلم والبطل إصبعه مرفوع ينتظر دوره",
    place: "صحن دار بنافورة ليلًا",
    render: ({ frame, at, portrait }) => {
      const tN = at("النية", 0.4);
      return {
        cam: portrait ? [K(0, 640, 1.05), K(tN - 4, 760, 1.4)] : [K(0, 660, 1.45), K(tN - 4, 740, 1.9)],
        world: (
          <g>
            <Courtyard frame={frame} />
            <Bench x={COURT.bench} w={COURT.benchW} mood="night" />
            <Figure x={COURT.harsh} y={GROUND} scale={1.1} pose={blendPose(TALK_A, TALK_B, 0.5 + 0.5 * Math.sin(frame / 7))} look={CH2_CAST.harsh} holding="paper" frame={frame + 5} />
            <Figure x={COURT.hero} y={GROUND} scale={1.1} pose={{ ...POSES.sit, head: 2, lean: -4, armFront: { s: 110, e: -6 } }} look={hero} flip frame={frame} />
          </g>
        ),
      };
    },
  },
  "court-debate-pause": {
    nameAr: "صحن الدار: يهمّ بالرد عند «تختلف»، ثم يتوقف إصبعه في الهواء عند «اسأل نفسك»",
    place: "صحن دار بنافورة ليلًا",
    render: ({ frame, at, portrait }) => {
      const tX = at("تختلف", 0.16);
      const tA = at("اسأل", 0.56);
      const UP: PoseSpec = { ...POSES.sit, head: 2, lean: -4, armFront: { s: 110, e: -6 } };
      const JAB: PoseSpec = { ...POSES.sit, head: 0, lean: 6, armFront: { s: 84, e: -4 } };
      const pose = frame < tA ? (frame >= tX ? blendPose(UP, JAB, 0.5 + 0.5 * Math.sin((frame - tX) / 3)) : UP) : tlPose(frame, [[tA, JAB], [tA + 12, { ...JAB, head: 22 }]]);
      return {
        cam: portrait ? [K(0, 760, 1.4), K(tA - 4, 790, 1.7)] : [K(0, 740, 1.9), K(tA - 4, 790, 2.3)],
        world: (
          <g>
            <Courtyard frame={frame} />
            <Bench x={COURT.bench} w={COURT.benchW} mood="night" />
            <Figure x={COURT.harsh} y={GROUND} scale={1.1} pose={blendPose(TALK_A, TALK_B, 0.5 + 0.5 * Math.sin(frame / 7))} look={CH2_CAST.harsh} holding="paper" frame={frame + 5} />
            <Figure x={COURT.hero} y={GROUND} scale={1.1} pose={pose} look={hero} flip frame={frame} />
          </g>
        ),
      };
    },
  },
  "court-debate-listens": {
    nameAr: "صحن الدار: يُنزل إصبعه عند «الصواب» ويميل مستمعًا، ولا يرفعه عند «الانتصار»",
    place: "صحن دار بنافورة ليلًا",
    render: ({ frame, at, portrait }) => {
      const tS = at("الصواب", 0.33);
      const JAB: PoseSpec = { ...POSES.sit, head: 22, lean: 6, armFront: { s: 84, e: -4 } };
      const LISTEN_C: PoseSpec = { ...POSES.sit, head: 14, lean: 12, armFront: { s: 26, e: 60 } };
      return {
        cam: portrait ? [K(0, 790, 1.7), K(tS + 10, 650, 1.05)] : [K(0, 790, 2.3), K(tS + 10, 660, 1.5)],
        world: (
          <g>
            <Courtyard frame={frame} />
            <Bench x={COURT.bench} w={COURT.benchW} mood="night" />
            <Figure x={COURT.harsh} y={GROUND} scale={1.1} pose={blendPose(TALK_A, TALK_B, 0.5 + 0.5 * Math.sin(frame / 7))} look={CH2_CAST.harsh} holding="paper" frame={frame + 5} />
            <Figure x={COURT.hero} y={GROUND} scale={1.1} pose={tlPose(frame, [[0, JAB], [tS - 4, JAB], [tS + 10, LISTEN_C]])} look={hero} flip frame={frame} />
          </g>
        ),
      };
    },
  },
  "court-debate-receives": {
    nameAr: "صحن الدار: يستمع، ثم يناقش بكف هادئة، ثم يأخذ ورقة الرجل وينظر فيها",
    place: "صحن دار بنافورة ليلًا",
    render: ({ frame, at, portrait }) => {
      // «نستمع»: يميل أكثر؛ «ونناقش»: كف مفتوحة منخفضة؛ «ونستقبل»: يناوله الرجل ورقته؛ «الأدلة»: يأخذها وينظر فيها
      const tL = at("نستمع", 0.49);
      const tD = at("ونناقش", 0.6);
      const tR = at("ونستقبل", 0.73);
      const tE = at("الأدلة", 0.86);
      const LISTEN_C: PoseSpec = { ...POSES.sit, head: 14, lean: 12, armFront: { s: 26, e: 60 } };
      const OPEN: PoseSpec = { ...POSES.sit, head: 6, lean: 4, armFront: { s: 52, e: 20 } };
      const TAKE: PoseSpec = { ...POSES.sit, head: 20, lean: 8, armFront: { s: 56, e: 30 } };
      const READ: PoseSpec = { ...POSES.sit, head: 26, lean: 6, armFront: { s: 46, e: 70 } };
      const harshPose = frame < tR ? blendPose(TALK_A, TALK_B, 0.5 + 0.5 * Math.sin(frame / 7)) : tlPose(frame, [[tR, { ...POSES.sit, head: 10, armFront: { s: 62, e: 12 } }], [tE + 10, { ...POSES.sit, head: 12 }]]);
      const handed = frame >= tE;
      return {
        cam: portrait ? [K(0, 660, 1.05), K(tR - 6, 660, 1.4)] : [K(0, 660, 1.5), K(tR - 6, 660, 1.95)],
        world: (
          <g>
            <Courtyard frame={frame} />
            <Bench x={COURT.bench} w={COURT.benchW} mood="night" />
            <Figure x={COURT.harsh} y={GROUND} scale={1.1} pose={harshPose} look={CH2_CAST.harsh} holding={handed ? "none" : "paper"} frame={frame + 5} />
            <Figure x={COURT.hero} y={GROUND} scale={1.1} pose={tlPose(frame, [[0, LISTEN_C], [tL, { ...LISTEN_C, lean: 16 }], [tD, OPEN], [tR + 4, TAKE], [tE + 8, READ]])} look={hero} flip holding={handed ? "paper" : "none"} frame={frame} />
          </g>
        ),
      };
    },
  },

  // ——— د. تصحيح الموقف ———
  "lane-returns-at-dawn": {
    nameAr: "الزقاق قبيل الفجر التالي: المصابيح مضاءة، يعود ماشيًا إلى باب أخيه والظرف معه، ويقف أمامه",
    place: "الزقاق عند باب الأخ قبيل الفجر",
    render: ({ frame, at, portrait }) => {
      // التوجيه 026: العودة في يوم تالٍ تُفهم من الضوء لا من لافتة: مصابيح الزقاق مضاءة (قبيل الفجر، كما في c3-s22)
      // ثم يطلع الضوء، والعتبة خالية (لم يبت عندها). يمشي من وسط الطريق إلى الباب؛ «لتصحيح»: يضم الظرف؛ «الموقف»: يقف.
      const tR = at("لتصحيح", 0.39);
      const tM = at("الموقف", 0.52);
      const READY: PoseSpec = { ...POSES.stand, head: 4, armFront: { s: 64, e: 86 } };
      const day = prog(frame, tR - 6, tM + 40, (t) => t);
      const arriving = frame < tR;
      return {
        // التوجيه 028 (الأفقي): قبيل الفجر أبرد قليلًا، والمصباح المضاء على الجدار الأيسر داخل الإطار وواضح،
        // ثم يدفأ الضوء مع «day» كما كان. حركة العودة نفسها
        cam: portrait ? [V(0, 720, 1.1, 640), DOOR_CAM(tR, portrait, 2.3)] : [V(0, 800, 1.5, 560), V(tR, 860, 2.3, 470)],
        world: (
          <g>
            <Lane frame={frame} mood="predawn" lit={1} heroDoor={0.5} brotherDoor={0.3} />
            {portrait ? null : (
              <g opacity={1 - day}>
                <rect x={-400} y={-400} width={2800} height={1900} fill={ID.night} opacity={0.22} />
                <Glow cx={PREDAWN_LAMP.x} cy={PREDAWN_LAMP.y} r={170} color={ID.dawn} opacity={0.75} />
                <WallLamp x={PREDAWN_LAMP.x} y={PREDAWN_LAMP.y} frame={frame} on={1} />
              </g>
            )}
            <g opacity={day}>
              <Lane frame={frame} mood="dawn" lit={1} heroDoor={0.5} brotherDoor={0.3} />
            </g>
            <DoorStep />
            {arriving ? (
              <LaneWalker frame={frame} d0={0.45} d1={0.9} start={0} end={tR} />
            ) : (
              <LaneHero d={0.9} pose={tlPose(frame, [[tR, CARRY], [tR + 10, READY]])} frame={frame} />
            )}
          </g>
        ),
      };
    },
  },
  "lane-knock-confess": {
    nameAr: "الزقاق: يطرق، يُفتح الباب ويقف أخوه في عتبته، فيضع يده على صدره قائمًا (اعتراف بلا انكسار)",
    place: "الزقاق عند باب الأخ صباحًا",
    render: ({ frame, at, portrait }) => {
      // «أخطأت»: طرقتان؛ ينفتح الباب؛ يظهر الأخ؛ «الاعتراف»: يده على صدره ورأسه منخفض قليلًا؛ «هزيمة»: يرفع رأسه قائمًا
      const tW = at("أخطأت", 0.26);
      const tC = at("الاعتراف", 0.52);
      const tD = at("هزيمة", 0.81);
      const knock = frame >= tW && frame < tW + 18 ? Math.abs(Math.sin(((frame - tW) / 9) * Math.PI)) : 0;
      const open = prog(frame, tW + 16, tW + 30);
      const CONFESS: PoseSpec = { ...POSES.sincere, head: 14 };
      const heroPose = tlPose(frame, [[0, { ...POSES.stand, head: 4, armFront: { s: 64, e: 86 } }], [tW - 8, KNOCK], [tW + 20, { ...POSES.stand, head: 6 }], [tC - 4, CONFESS], [tD, { ...CONFESS, head: 0 }]]);
      return {
        cam: portrait ? [DOOR_CAM(0, portrait, 2.5), DOOR_CAM(tC - 6, portrait, 2.9)] : [DOOR_CAM(0, portrait, 2.8), DOOR_CAM(tC - 6, portrait, 3.2)],
        world: (
          <g>
            <Lane frame={frame} mood="dawn" lit={1} heroDoor={0.5} brotherDoor={0.3 + 0.6 * open} />
            <DoorStep />
            {open > 0.3 ? <BrotherInDoor frame={frame} pose={{ ...POSES.stand, head: 6 }} o={prog(frame, tW + 22, tW + 34)} /> : null}
            <g transform={`translate(${knock * 3} 0)`}>
              <LaneHero d={0.87} pose={heroPose} frame={frame} carry={frame >= tW + 20} />
            </g>
          </g>
        ),
      };
    },
  },
  "lane-returns-envelope": {
    nameAr: "الزقاق: يمد الظرف إلى أخيه؛ يتأمله الأخ لحظة ثم يأخذه، ويبقى في عتبته",
    place: "الزقاق عند باب الأخ صباحًا",
    render: ({ frame, at, portrait }) => {
      // «الحق»: يمد الظرف؛ الأخ ينظر إليه ولا يمد يده فورًا؛ «الباطل»: يأخذه. لا عناق ولا ابتسامة: رد المال حدث مستقل عن القبول
      const tH = at("الحق", 0.28);
      const tB = at("الباطل", 0.76);
      const p = lanePos(0.87);
      const heroPose = tlPose(frame, [[0, { ...POSES.sincere, head: 0 }], [tH - 6, { ...GIVE, head: 6 }], [tB + 10, { ...POSES.stand, head: 8 }]]);
      const h = handAt(heroPose, { x: p.x, y: p.y, scale: p.s });
      const taken = frame >= tB + 6;
      const broPose = tlPose(frame, [[0, { ...POSES.stand, head: 6 }], [tH + 8, { ...POSES.stand, head: 24 }], [tB - 6, { ...GIVE, head: 20 }], [tB + 12, { ...POSES.hold, head: 22 }]]);
      return {
        cam: portrait ? [DOOR_CAM(0, portrait, 2.9), V(tH, 930, 2.6, 510)] : [DOOR_CAM(0, portrait, 3.2), V(tH, 925, 3.4, 510)],
        world: (
          <g>
            <Lane frame={frame} mood="dawn" lit={1} heroDoor={0.5} brotherDoor={0.9} />
            <DoorStep />
            <BrotherInDoor frame={frame} pose={broPose} envelope={taken} />
            <LaneHero d={0.87} pose={heroPose} frame={frame} carry={false} />
            {!taken && frame >= tH - 2 ? <EnvelopeGlyph x={h.x} y={h.y} s={p.s} /> : null}
          </g>
        ),
      };
    },
  },
  "stall-two-views-one-weight": {
    nameAr: "دكان الميزان: رجلان ينظران إلى الميزان من جهتين، والكاميرا تستقر على الثقل المعياري",
    place: "دكان الميزان",
    render: ({ frame, at, portrait }) => {
      // «نشك في كل شيء»: يميل أحدهما برأسه مستغربًا؛ «وجهات نظر»: الكاميرا على الثقل المعياري الواحد (الميزان مستوٍ لا يتغير)
      const tS = at("نشك", 0.22);
      const tV = at("وجهات", 0.8);
      return {
        cam: portrait ? [V(0, 1040, 0.95, 540), V(tV - 6, 1112, 1.9, 580)] : [K(0, 1020, 1.3, 30), V(tV - 6, 1112, 2.6, 560)],
        world: (
          <g>
            <StallSet frame={frame} />
            <Glow cx={1112} cy={560} r={120} opacity={0.6 * prog(frame, tV, tV + 16)} />
            <ValueScale x={1020} tilt={0} left={(p) => <g>{oranges(p, 5)}</g>} right={(p) => <StandardWeight x={p.x} y={p.y} />} />
            <Figure x={720} y={GROUND + 6} scale={1.2} pose={tlPose(frame, [[0, { ...POSES.stand, head: 10 }], [tS, { ...POSES.think, head: 20 }]])} look={LOOKS.friend as FigureLook} frame={frame + 3} />
            <Figure x={1400} y={GROUND + 6} scale={1.2} pose={{ ...POSES.stand, head: 14 }} look={LOOKS.womanSand as FigureLook} flip frame={frame + 8} />
          </g>
        ),
      };
    },
  },
  "court-elder-humble": {
    nameAr: "صحن الدار: يأتي الصبي (من c5-s1) إلى الشيخ ويجلس عند طرف المصطبة مطرقًا، ويفتح الشيخ كتابه له",
    place: "صحن دار بنافورة ليلًا",
    render: ({ frame, at, portrait }) => {
      // التوجيه 026: الشيخ مع الصبي الذي كان يستمع له في c5-s1، لا البطل: مثال عام للضابط لا حلقة في يوم البطل،
      // فلا يتعارض زمنه مع الطرق صباحًا (c6-s15) والجلسة مساءً (c6-s19).
      // «نثبت»: يصل؛ «ونتواضع»: يجلس عند طرف المصطبة مطرقًا؛ «الوحي»: سكون (لا حدث)؛ «العلم»: يفتح الشيخ كتابه نحوه
      const tT = at("نثبت", 0.07);
      const tH = at("ونتواضع", 0.4);
      const tW = at("الوحي", 0.7);
      const tI = at("العلم", 0.8);
      const arrive = tH - 6;
      const OPEN: PoseSpec = { ...POSES.sit, head: 14, armFront: { s: 60, e: 30 } };
      const boy = LOOKS.boy as FigureLook;
      return {
        cam: portrait ? [K(0, 900, 0.95), K(tH, 700, 1.3)] : [K(0, 900, 1.25), K(tH, 700, 1.75)],
        world: (
          <g>
            <Courtyard frame={frame} />
            <Bench x={460} w={380} mood="night" />
            <Figure x={590} y={GROUND} scale={1.1} pose={tlPose(frame, [[0, { ...POSES.sit, head: 16 }], [tW - 14, { ...POSES.sit, head: 16 }], [tI, OPEN]])} look={LOOKS.elder as FigureLook} holding="book" frame={frame} />
            {frame < arrive ? (
              <Walker frame={frame} from={1400} to={770} y={GROUND} start={tT} end={arrive} look={boy} scale={1.0} />
            ) : (
              <Figure x={770} y={GROUND} scale={1.0} pose={tlPose(frame, [[arrive, { ...POSES.stand, head: 14 }], [tH + 4, { ...POSES["sit-low"], head: 30 }], [tI + 8, { ...POSES.sit, head: 18, lean: 10 }]])} look={boy} flip frame={frame} />
            )}
          </g>
        ),
      };
    },
  },
  "brother-bench-talks": {
    nameAr: "مساءً عند باب الأخ: لقطة الاثنين، ثم الأخ يتكلم من وراء كتف البطل، ثم البطل يستمع وتهمّ يده بالرد فيُنزلها",
    place: "الزقاق عند باب الأخ مساءً",
    render: ({ frame, at, portrait }) => {
      // التوجيه 028: ثلاث زوايا بقطعات، والأحداث القائمة نفسها. «حاول»: الأخ يتكلم (OTS)؛ «دون»: البطل يستمع، ويده تهمّ عند «بإعداد» ثم تنزل
      const tA = at("حاول", 0.3);
      const tD = at("دون", 0.62);
      const tL = at("تستمع", 0.45);
      const tB = Math.max(at("بإعداد", 0.85), tD + 12);
      const RISE: PoseSpec = { ...LISTEN, armFront: { s: 62, e: 10 }, head: 6 };
      const heroPose = tlPose(frame, [[0, { ...POSES.sit, head: 10 }], [tL, LISTEN], [tB - 4, RISE], [tB + 10, LISTEN]]);
      const broPose = broTalking(frame);
      return {
        cam: [PAIR_CAM(0, portrait), BRO_OTS(tA - 4, portrait), HERO_OTS(tD - 4, portrait)],
        world: (
          <g>
            <Lane frame={frame} mood="dusk" lit={0.6} heroDoor={0.6} brotherDoor={0.7} reverse />
            <PairBench />
            <Figure x={BRO_SEAT_X} y={SEAT.y} scale={PAIR_S} pose={broPose} look={brother} frame={frame + 9} />
            <Figure x={HERO_SEAT_X} y={SEAT.y} scale={PAIR_S} pose={heroPose} look={hero} flip frame={frame} />
            <BroAngleSet frame={frame} broPose={broPose} heroPose={heroPose} portrait={portrait} />
            <HeroAngleSet frame={frame} broPose={broPose} heroPose={heroPose} portrait={portrait} />
          </g>
        ),
      };
    },
  },
  "brother-bench-asks-self": {
    nameAr: "عند باب الأخ: البطل يستمع من وراء كتف أخيه، ثم تقترب الكاميرا منه وحده عند «بصدق»",
    place: "الزقاق عند باب الأخ مساءً",
    render: ({ frame, at, portrait }) => {
      // التوجيه 028: يستمر تأطير آخر c6-s19 (البطل من وراء كتف الأخ)، ثم الحدث القائم نفسه: تقترب الكاميرا منه عند «بصدق»
      // فيخرج كتف الأخ من الإطار ويبقى البطل وحده مع سؤاله
      const tS = at("بصدق", 0.45);
      const broPose = broTalking(frame);
      const heroPose: PoseSpec = { ...LISTEN, head: 18 };
      return {
        cam: [HERO_OTS(0, portrait, false), HERO_CLOSE(tS - 6, portrait, false)],
        world: (
          <g>
            <HeroAngleSet frame={frame} broPose={broPose} heroPose={heroPose} portrait={portrait} />
          </g>
        ),
      };
    },
  },
  "brother-bench-accepts": {
    nameAr: "عند باب الأخ: البطل، ثم الأخ يسكت عند «معه»، ثم لقطة الاثنين: يومئ البطل ويده على صدره (مستعد لقبول الحق)",
    place: "الزقاق عند باب الأخ مساءً",
    render: ({ frame, at, portrait }) => {
      // التوجيه 028: «الحق»: عودة قصيرة إلى الأخ (OTS) فيسكت عند «معه»؛ «مستعدًا»: يجمعهما الإطار من جديد عند القبول،
      // بتأطير c6-s22 نفسه فيستمر ساكنًا بلا قفز
      const tH = at("الحق", 0.2);
      const tM = at("معه", 0.31);
      const tR = Math.max(at("مستعدا", 0.55), tM + 24);
      const tQ = Math.max(at("لقبوله", 0.74), tR + 12);
      const broPose = frame < tM ? broTalking(frame) : tlPose(frame, [[tM, TALK_B], [tM + 12, { ...POSES.sit, head: 10 }]]);
      const heroPose = tlPose(frame, [[0, { ...LISTEN, head: 18 }], [tQ - 6, { ...LISTEN, head: 26 }], [tQ + 6, BENCH_ACCEPT]]);
      return {
        cam: [HERO_CLOSE(0, portrait, false), BRO_OTS(tH - 4, portrait), PAIR_CAM(tR - 4, portrait, true)],
        world: (
          <g>
            <Lane frame={frame} mood="dusk" lit={0.6} heroDoor={0.6} brotherDoor={0.7} reverse />
            <PairBench />
            <Figure x={BRO_SEAT_X} y={SEAT.y} scale={PAIR_S} pose={broPose} look={brother} frame={frame + 9} />
            <Figure x={HERO_SEAT_X} y={SEAT.y} scale={PAIR_S} pose={heroPose} look={hero} flip frame={frame} />
            <BroAngleSet frame={frame} broPose={broPose} heroPose={heroPose} portrait={portrait} />
            <HeroAngleSet frame={frame} broPose={broPose} heroPose={heroPose} portrait={portrait} />
          </g>
        ),
      };
    },
  },

  // ——— و. الختام ———
  "brother-bench-still": {
    nameAr: "عند باب الأخ ساكنًا: الأخوان على المصطبة والمصابيح مضاءة (سكون الدعاء)",
    place: "الزقاق عند باب الأخ مساءً",
    // c6-s22 ذكر الدعاء: كاميرا واحدة والعالم مجمَّد
    render: ({ portrait }) => ({
      cam: [PAIR_CAM(0, portrait)],
      world: (
        <g>
          <Lane frame={0} mood="dusk" lit={0.6} heroDoor={0.6} brotherDoor={0.7} reverse />
          <PairBench />
          <Figure x={BRO_SEAT_X} y={SEAT.y} scale={PAIR_S} pose={{ ...POSES.sit, head: 10 }} look={brother} frame={0} />
          <Figure x={HERO_SEAT_X} y={SEAT.y} scale={PAIR_S} pose={BENCH_ACCEPT} look={hero} flip frame={0} />
        </g>
      ),
    }),
  },
  "brother-bench-tea": {
    nameAr: "عند باب الأخ: يناول الأخ أخاه كأس شاي فيأخذه",
    place: "الزقاق عند باب الأخ مساءً",
    render: ({ frame, at, portrait }) => {
      // «نثبت»: يمد الأخ كأسه؛ «حق»: يأخذه البطل. قبول هادئ بفعل صغير، بعد الاستماع، لا عناق
      const tP = at("نثبت", 0.4);
      const tH = at("حق", 0.84);
      const OFFER: PoseSpec = { ...POSES.sit, head: 12, armFront: { s: 62, e: 18 } };
      const TAKE: PoseSpec = { ...POSES.sit, head: 16, armFront: { s: 62, e: 20 } };
      const taken = frame >= tH;
      return {
        cam: portrait ? [PAIR_CAM(0, portrait), V(tP, 380, 1.3, 740)] : [PAIR_CAM(0, portrait), V(tP, 420, 1.55, 720)],
        world: (
          <g>
            <Lane frame={frame} mood="dusk" lit={0.6} heroDoor={0.6} brotherDoor={0.7} reverse />
            <PairBench />
            <Figure x={BRO_SEAT_X} y={SEAT.y} scale={PAIR_S} pose={tlPose(frame, [[0, { ...POSES.sit, head: 10 }], [tP - 6, OFFER], [tH + 10, { ...POSES.sit, head: 10 }]])} look={brother} holding={taken ? "none" : "cup"} frame={frame + 9} />
            <Figure x={HERO_SEAT_X} y={SEAT.y} scale={PAIR_S} pose={tlPose(frame, [[0, { ...POSES.sit, head: 14 }], [tH - 8, TAKE], [tH + 12, { ...POSES.sit, head: 12, armFront: { s: 40, e: 70 } }]])} look={hero} flip holding={taken ? "cup" : "none"} frame={frame} />
          </g>
        ),
      };
    },
  },
  "lane-dusk-wide-end": {
    nameAr: "الختام: تبتعد الكاميرا عن الأخوين على المصطبة إلى الزقاق كله، والبابان مضيئان والطريق بينهما",
    place: "الزقاق بين البيتين مساءً",
    render: ({ frame, at, portrait }) => {
      const tW = at("نكون", 0.3);
      return {
        cam: portrait ? [V(0, 380, 1.3, 740), V(tW, 640, 0.72, 600)] : [V(0, 420, 1.55, 720), V(tW, 960, 0.95, 540)],
        world: (
          <g>
            <Lane frame={frame} mood="dusk" lit={0.6 + 0.4 * prog(frame, tW, tW + 30)} heroDoor={0.6 + 0.3 * prog(frame, tW, tW + 30)} brotherDoor={0.8} reverse />
            <PairBench />
            <Figure x={BRO_SEAT_X} y={SEAT.y} scale={PAIR_S} pose={{ ...POSES.sit, head: 10 }} look={brother} frame={frame + 9} />
            <Figure x={HERO_SEAT_X} y={SEAT.y} scale={PAIR_S} pose={{ ...POSES.sit, head: 12, armFront: { s: 40, e: 70 } }} look={hero} flip holding="cup" frame={frame} />
          </g>
        ),
      };
    },
  },
};
