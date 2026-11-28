/**
 * D242 (قرار المالك ٢٨ نوفمبر، امتداد D218 قبل الرندر): في «دفاتر الزمن» لا مشهد آية ولا حديث صامت. نص الآية أو الحديث
 * يظهر على صفحة لقطة «خط الأفق» المجاورة والراوي مستمر، كما في 001 (verseKey/verseText/verseFrom، وhadithText/hadithRef/
 * hadithFrom). D218 يقيس السكوت بعد الرندر؛ هذا يمنعه قبله: في فحص الخطة (planIssues، خطأ مبكر) وقبل كل رندر أو إرسال
 * لجهاز الرندر (رندر التكوين في src/render/episode.ts، ومهام جهاز الرندر في macJobs.ts: buildSceneJob وfullEpisodeInputs). القناتان الأخريان كما هما.
 * الإصلاح بلا تغيير كلمة: `npx bal -c dafatir-alzaman inline-quotes <الحلقة> --write` (src/plan/fromScenes.ts inlineQuotesInPlan).
 */
import type { Plan, PlanScene } from "./types";

export const SILENT_QUOTE_CHANNELS: ReadonlySet<string> = new Set(["dafatir-alzaman"]);

const isSilentQuote = (s: Pick<PlanScene, "template" | "narration">) =>
  (s.template === "verse-card" || s.template === "hadith-card") && !(s.narration ?? "").trim();

/** مشاهد الآية/الحديث الصامتة في خطة قناة تمنعها، برسالة لكل مشهد */
export const silentQuoteScenes = (plan: Pick<Plan, "channel" | "chapters">, channelId?: string): { sceneId: string; message: string }[] => {
  const ch = channelId ?? plan.channel;
  if (!ch || !SILENT_QUOTE_CHANNELS.has(ch)) return [];
  return plan.chapters.flatMap((c) => c.scenes).filter(isSilentQuote).map((s) => {
    const what = s.template === "verse-card" ? `مشهد آية صامت (${s.props?.reference ?? s.ayahKey ?? ""})` : `مشهد حديث صامت (${s.props?.reference ?? ""})`;
    return {
      sceneId: s.id,
      message: `D242: ${what} في «دفاتر الزمن» مرفوض: النص يظهر داخل لقطة «خط الأفق» المجاورة والراوي مستمر كما في 001، لا مشهد صامت. ` +
        "الإصلاح بلا تغيير كلمة: npx bal -c dafatir-alzaman inline-quotes <الحلقة> --write",
    };
  });
};

/** يمنع الرندر والإرسال لجهاز الرندر إن بقي مشهد آية أو حديث صامت في «دفاتر الزمن» */
export const assertNoSilentQuoteScenes = (plan: Pick<Plan, "channel" | "chapters">, channelId?: string): void => {
  const bad = silentQuoteScenes(plan, channelId);
  if (bad.length) throw new Error(bad.map((b) => `${b.sceneId}: ${b.message}`).join("\n"));
};
