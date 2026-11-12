import type { Plan, PlanScene } from "./types";
import type { PlanIssue } from "./validate";
import { INK_SHOTS } from "../remotion/zubdat/shots";
import { allowFromName, inkShotWordIssue } from "../remotion/zubdat/spoken";
import { estimateTimings } from "../remotion/scenes/timing";
import { HZ_SCENES } from "../remotion/dafatir/horizon/episode001";
import { HZ_LEAD, HZ_META, hzSentences } from "../remotion/dafatir/horizon/meta";
import { buildTimeline, isMissingWord } from "../remotion/dafatir/horizon/timeline";

/**
 * اللقطة المصمَّمة تطابق النص الحالي؟ (D-5 في زبدة الكتب، M4 في دفاتر الزمن)
 * اللقطة تُصمَّم على كلمات جملتها؛ وإن عُدّل النص بعدها فقد يبقى فيها كلام لا يُنطق أو حدث على كلمة لم تعد فيه.
 * القالب لا ينهار ولا يرسم الخطأ: يعرض المشهد بالكلمات وحدها (القاعدة الثالثة: الفراغ أفضل من عنصر خاطئ)،
 * وهذا الفحص يقول للمالك ذلك صراحةً في «قبل أن تعتمد» وفي ملاحظات المشهد. نقي بلا ملفات (الواجهة والخادم).
 */
export type ShotWordIssue = { sceneId: string; shot: string; missing: string[]; unspoken: string[] };

const FPS = 30;

/** مشهد «خط الأفق»: تُستدعى دالة المشهد نفسها على التوقيت التقديري، وأي كلمة صُمم عليها ولم تعد في النص تظهر هنا. */
export const horizonShotWordIssue = (scene: Pick<PlanScene, "id" | "narration" | "props">): ShotWordIssue | null => {
  const shot = String(scene.props?.shot ?? "");
  const fn = HZ_SCENES[shot] as unknown as ((p: unknown) => unknown) & { inner?: (p: unknown) => unknown } | undefined;
  if (!fn || !scene.narration?.trim()) return null;
  const tl = buildTimeline(hzSentences(scene.narration), HZ_LEAD);
  const dur = tl.end + 2;
  const exit = (scene.props?.exit as string) || HZ_META[shot]?.exit || "none";
  const missing = new Set<string>();
  // مشاهد «legacy» تقرأ سياقًا قبل رسم اللقطة الداخلية: تُستدعى الداخلية مباشرة (بلا خطافات)
  const call = fn.inner ? (t: number) => fn.inner!({ t, tl, refText: scene.props?.ref }) : (t: number) => fn({ t, tl, dur, exit, p: scene.props ?? {} });
  for (const t of [0, tl.end / 3, (2 * tl.end) / 3, tl.end, dur - 0.1]) {
    try { call(t); } catch (e) { if (isMissingWord(e)) missing.add(e.word); }
  }
  return missing.size ? { sceneId: scene.id, shot, missing: [...missing], unspoken: [] } : null;
};

/** مشهد حبر (زبدة الكتب) على التوقيت التقديري من نصه الحالي. */
export const inkShotSceneIssue = (scene: Pick<PlanScene, "id" | "narration" | "props">, channelName?: string): ShotWordIssue | null => {
  const shot = String(scene.props?.shot ?? "");
  const def = INK_SHOTS[shot];
  if (!def || shot.startsWith("kit-") || !scene.narration?.trim()) return null;
  const dur = 20 * FPS;
  const timings = estimateTimings(scene.narration, 6, dur - 12);
  const r = inkShotWordIssue(def, scene, timings, dur, allowFromName(channelName));
  return r.missing.length || r.unspoken.length ? { sceneId: scene.id, shot, ...r } : null;
};

// نتيجة كل مشهد بمدخلاته (الفحص يُستدعى مع كل تعديل في الواجهة): لا يُعاد حساب مشهد لم يتغير
const memo = new Map<string, ShotWordIssue | null>();
export const shotWordIssues = (plan: Pick<Plan, "chapters">, channelName?: string): ShotWordIssue[] =>
  plan.chapters.flatMap((c) => c.scenes).flatMap((s) => {
    if (s.template !== "horizon-shot" && s.template !== "ink-shot") return [];
    const key = JSON.stringify([s.id, s.template, s.narration, s.props?.shot, s.props?.labels, s.props?.cues, s.props?.task, s.props?.exit, s.props?.ref, channelName]);
    let r = memo.get(key);
    if (r === undefined) {
      r = s.template === "horizon-shot" ? horizonShotWordIssue(s) : inkShotSceneIssue(s, channelName);
      if (memo.size > 2000) memo.clear();
      memo.set(key, r);
    }
    return r ? [r] : [];
  });

const list = (ws: string[]) => ws.slice(0, 5).map((w) => `«${w}»`).join("، ") + (ws.length > 5 ? "…" : "");

/** رسالة المالك: تنبيه لا يمنع (المشهد بالكلمات وحدها صالح بالقاعدة الثالثة)، ويدعو إلى تحديث اللقطة. */
export const shotWordPlanIssues = (plan: Pick<Plan, "chapters">, channelName?: string): PlanIssue[] =>
  shotWordIssues(plan, channelName).map((i) => ({
    level: "warning",
    sceneId: i.sceneId,
    message: `رسم اللقطة المصمَّمة لا يطابق نص المشهد الحالي${i.missing.length ? `: صُمم على ${list(i.missing)} ولم تعد في النص` : ""}${i.unspoken.length ? `${i.missing.length ? "، و" : ": "}فيه كتابة لا تُنطق ${list(i.unspoken)}` : ""}. ${i.missing.length
      ? "يُعرض المشهد بالكلمات وحدها حتى تُحدَّث اللقطة على النص الجديد."
      : "لا تُكتب على الشاشة الكلمات التي لا تُنطق حتى تُحدَّث اللقطة."}`,
  }));
