/**
 * بوابة D241 على الخطة: جمل الحلقة من مشاهدها بالترتيب، وكل شورت من `plan.shorts` (أو قسم في الخطة القديمة) أجزاءٌ
 * على هذه الجمل، ثم الفحص النقي في src/package/shortIdea.ts. تُستدعى قبل أي رندر أو إرسال لشورت:
 * `package --shorts` (والاستوديو والطابور الليلي من خلاله)، و`worker-submit`/`worker-collect` للويندوز،
 * وقلب الرندر نفسه في src/render/episode.ts لكل رندر عمودي لمقطع (على الماك وعلى العامل)، و`bal shorts-check`.
 */
import type { Plan, PlanScene } from "../plan/types";
import { shortSegments, type ShortSegment } from "../plan/shorts";
import { checkShortIdea, ideaSentencesOf, RULE_LABEL, type IdeaPart, type IdeaSentence, type ShortIdeaResult } from "./shortIdea";

const QURAN = /﴿|﴾|\[آية/;

const sceneSentences = (s: PlanScene): IdeaSentence[] => {
  const text = s.narration.trim();
  if (text) return ideaSentencesOf(text).map((t) => ({ text: t, kind: QURAN.test(t) ? "verse" : "narration", unit: s.id }));
  const ref = String((s.props as { reference?: unknown } | undefined)?.reference ?? "").trim();
  if (s.template === "verse-card") return [{ text: `آية${ref ? `: ${ref}` : ""}`, kind: "verse", unit: s.id }];
  if (s.template === "hadith-card") return [{ text: `حديث${ref ? `: ${ref}` : ""}`, kind: "hadith", unit: s.id }];
  return [];
};

/** جمل الحلقة بالترتيب (بلا شاشة النهاية)، ومدى جمل كل مشهد فيها. المشهد الصامت بلا بطاقة لا جمل له. */
export const planIdeaSentences = (plan: Pick<Plan, "chapters">) => {
  const sentences: IdeaSentence[] = [];
  const range = new Map<string, [number, number]>();
  for (const s of plan.chapters.flatMap((c) => c.scenes).filter((x) => x.template !== "end-screen")) {
    const own = sceneSentences(s);
    if (own.length) range.set(s.id, [sentences.length, sentences.length + own.length - 1]);
    sentences.push(...own);
  }
  return { sentences, range };
};

/** أجزاء المقطع على جمل الحلقة: كل جزء من أول جملة في أول مشهد له جمل إلى آخر جملة في آخره */
const partsOf = (sceneParts: string[][], range: Map<string, [number, number]>): IdeaPart[] =>
  sceneParts.flatMap((ids) => {
    const rs = ids.map((id) => range.get(id)).filter((r): r is [number, number] => Boolean(r));
    return rs.length ? [[rs[0]![0], rs.at(-1)![1]] as IdeaPart] : [];
  });

/** مشاهد متتالية في ترتيب الحلقة تُعدّ جزءًا واحدًا (لمقطع بلا أجزاء مسجلة، كما يصل إلى العامل) */
const runsOf = (plan: Pick<Plan, "chapters">, sceneIds: string[]): string[][] => {
  const order = new Map(plan.chapters.flatMap((c) => c.scenes).map((s, i) => [s.id, i]));
  const out: string[][] = [];
  let prev = -2;
  for (const id of sceneIds) {
    const i = order.get(id) ?? -10;
    if (out.length && i === prev + 1) out.at(-1)!.push(id);
    else out.push([id]);
    prev = i;
  }
  return out;
};

/** يفحص شورتًا من الخطة بالقاعدة D241 */
export const checkPlanShort = (plan: Pick<Plan, "chapters">, seg: Pick<ShortSegment, "sceneIds" | "parts" | "hook" | "closingQuestion">, ctx = planIdeaSentences(plan)): ShortIdeaResult =>
  checkShortIdea(ctx.sentences, {
    parts: partsOf(seg.parts ?? runsOf(plan, seg.sceneIds), ctx.range),
    hook: seg.hook === "line", commentClose: seg.closingQuestion === "comment",
  });

export type PlanShortVerdict = { n: number; title: string; result: ShortIdeaResult };
/** كل شورتس الخطة بأحكامها */
export const checkPlanShorts = (plan: Pick<Plan, "chapters" | "shorts">, segments: ShortSegment[] = shortSegments(plan).segments): PlanShortVerdict[] => {
  const ctx = planIdeaSentences(plan);
  return segments.map((seg) => ({ n: seg.n, title: seg.title, result: checkPlanShort(plan, seg, ctx) }));
};

/** سطر الرفض للمالك: الأسباب بلا تكرار القاعدة نفسها أكثر من مرتين */
export const refusalText = (label: string, r: ShortIdeaResult): string =>
  `${label} مرفوض (D241: الشورت فكرة كاملة وحده): ${r.issues.slice(0, 4).map((i) => `${RULE_LABEL[i.rule]} — ${i.message}`).join(" | ")}${r.issues.length > 4 ? ` | و${r.issues.length - 4} سببًا آخر` : ""}`;

/** يرفض قبل الرندر أو الإرسال إن رُفض شورت واحد (برسالة لكل شورت مرفوض). */
export const assertShortsIdea = (plan: Pick<Plan, "chapters" | "shorts">, segments: ShortSegment[]) => {
  const refused = checkPlanShorts(plan, segments).filter((v) => !v.result.ok);
  if (refused.length)
    throw new Error(`${refused.map((v) => refusalText(`الشورت ${v.n}${v.title ? ` «${v.title}»` : ""}`, v.result)).join("\n")}\nأعد قصه من جمل الحلقة نفسها (بلا جملة جديدة)، ثم: npx bal shorts-check`);
};

/**
 * البوابة في قلب الرندر (src/render/episode.ts) لكل رندر عمودي لمقطع أو قسم: يجد الشورت في الخطة بمشاهده (أو قسمه)
 * ويفحصه بعلاماته؛ ومقطع ليس في الخطة يُفحص بلا علامات (خطافه سؤال، وختامه ليس سؤالًا).
 */
export const assertShortRenderIdea = (plan: Pick<Plan, "chapters" | "shorts">, scope: { sceneIds?: string[]; chapter?: number }) => {
  const segs = shortSegments(plan).segments;
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
  const seg = scope.sceneIds
    ? segs.find((s) => s.chapter === undefined && same(s.sceneIds, scope.sceneIds!)) ?? { n: 0, title: "", sceneIds: scope.sceneIds }
    : segs.find((s) => s.chapter === scope.chapter)
      ?? { n: 0, title: "", sceneIds: plan.chapters.filter((c) => c.number === scope.chapter).flatMap((c) => c.scenes.filter((s) => s.template !== "end-screen").map((s) => s.id)) };
  const r = checkPlanShort(plan, seg);
  if (!r.ok) throw new Error(`${refusalText(seg.n ? `الشورت ${seg.n}${seg.title ? ` «${seg.title}»` : ""}` : "المقطع العمودي", r)}\nلا يُرندر شورت مرفوض.`);
};
