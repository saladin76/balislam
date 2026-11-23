/**
 * «الاختلاف عن الحلقة السابقة في السلسلة» (D204، قرار المالك ٢٣ نوفمبر، مرجع «عمود السلاسل» D202 «سادسًا»):
 * كل حلقة تختلف عن التي قبلها داخل السلسلة نفسها. يُقاس من الخطط وحدها، بلا رندر، ولكل قناة سلاسلها:
 * - لقطة الافتتاح (أول مشهد يُرى: القالب واللقطة والتكوين) لا تساوي افتتاح الحلقة السابقة.
 * - نصف التكوينات على الأقل جديدة على السلسلة (لم تظهر في أي حلقة سابقة فيها).
 * - لا تُبنى الحلقة على القوالب نفسها بالترتيب نفسه كالسابقة (تتابع القوالب بعد دمج المتكرر المتجاور).
 * - مكان جديد واحد على الأقل، إن أعلنت المشاهد أماكنها (props.place | setting | location).
 * تنبيه لا يمنع حتى يحدد المالك حدًّا؛ وأول حلقة في سلسلتها ✓ بلا مقارنة.
 * السلسلة من ختم الخطة (plan.series.id)، وبلا ختم «عام» (كما يعدّه جدول D168).
 */
import type { Plan, PlanScene } from "../../plan/types";
import { CLOSING_TEMPLATES, SACRED_TEMPLATES, sceneComposition } from "./diversity";

export const NEW_COMPOSITIONS_MIN = 0.5;
const arDigits = (n: number) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]!);
const PLACE_KEYS = ["place", "setting", "location"] as const;

export type SeriesEpisode = { id: string; plan: Plan };
export type SeriesDiffReport = {
  series: string;
  /** الحلقة السابقة في السلسلة (null: أول حلقة) */
  previous: string | null;
  openingSame: boolean;
  opening: string;
  /** نسبة تكوينات الحلقة الجديدة على السلسلة كلها، وعددها */
  newShare: number;
  newCount: number;
  total: number;
  sameTemplateOrder: boolean;
  /** أماكن جديدة على السلسلة؛ null إن لم تعلن المشاهد أماكنها */
  newPlaces: number | null;
};

export const seriesIdOf = (plan: Plan) => plan.series?.id ?? "general";

const shown = (plan: Plan): PlanScene[] =>
  plan.chapters.flatMap((c) => c.scenes).filter((s) => !CLOSING_TEMPLATES.has(s.template));
const drawn = (plan: Plan) => shown(plan).filter((s) => !SACRED_TEMPLATES.has(s.template));
const key = (s: PlanScene) => sceneComposition(s).composition;
const templateOrder = (plan: Plan) => drawn(plan).map((s) => s.template).filter((t, i, a) => i === 0 || a[i - 1] !== t).join(">");
const places = (plan: Plan) => new Set(shown(plan).flatMap((s) => PLACE_KEYS.map((k) => String(s.props?.[k] ?? "").trim()).filter(Boolean)));

/** earlier: حلقات السلسلة نفسها قبل هذه، بترتيبها (الأخيرة هي السابقة) */
export const compareWithSeries = (plan: Plan, earlier: SeriesEpisode[]): SeriesDiffReport => {
  const prev = earlier[earlier.length - 1];
  const mine = drawn(plan).map(key);
  const before = new Set(earlier.flatMap((e) => drawn(e.plan).map(key)));
  const distinct = [...new Set(mine)];
  const fresh = distinct.filter((k) => !before.has(k));
  const opening = shown(plan)[0] ? key(shown(plan)[0]!) : "";
  const myPlaces = places(plan);
  const oldPlaces = new Set(earlier.flatMap((e) => [...places(e.plan)]));
  return {
    series: seriesIdOf(plan),
    previous: prev?.id ?? null,
    opening,
    openingSame: Boolean(prev && opening && shown(prev.plan)[0] && key(shown(prev.plan)[0]!) === opening),
    newShare: distinct.length ? fresh.length / distinct.length : 1,
    newCount: fresh.length,
    total: distinct.length,
    sameTemplateOrder: Boolean(prev && templateOrder(plan) && templateOrder(plan) === templateOrder(prev.plan)),
    newPlaces: myPlaces.size ? [...myPlaces].filter((p) => !oldPlaces.has(p)).length : null,
  };
};

/** أسباب التنبيه بلغة المالك؛ فارغة = تختلف */
export const seriesDiffIssues = (r: SeriesDiffReport): string[] => {
  if (!r.previous) return [];
  const out: string[] = [];
  if (r.openingSame) out.push(`لقطة الافتتاح نفسها في الحلقة ${r.previous}`);
  if (r.newShare < NEW_COMPOSITIONS_MIN) out.push(`التكوينات الجديدة على السلسلة ${arDigits(Math.round(r.newShare * 100))}٪ (المطلوب النصف على الأقل)`);
  if (r.sameTemplateOrder) out.push(`القوالب نفسها بالترتيب نفسه كالحلقة ${r.previous}`);
  if (r.newPlaces === 0) out.push("لا مكان جديد على السلسلة");
  return out;
};
