import os from "node:os";

/**
 * KI-032 (D113): مهلة الاختبارات الثقيلة (رسم مئات الإطارات، حساب خالص بلا شبكة ولا انتظار) تتسع مع حمل الجهاز،
 * فلا يُرفض دفع لا علاقة له بها لأن الجهاز مشغول (بوابة وفحوص أخرى معًا على نواتين). الفحوص نفسها لا تتغير:
 * كل إطار وكل شرط كما هو؛ المهلة وحدها تحمي من التعليق، والتعليق في حساب خالص لا يحدث بالحمل.
 * الأساس للجهاز غير المشغول، ويُضرب في حمل كل نواة الآن (١ حتى ٦)، أو `BAL_TEST_TIMEOUT_SCALE` إن ضُبط.
 */
export const loadScale = (): number => {
  const forced = Number(process.env.BAL_TEST_TIMEOUT_SCALE);
  if (Number.isFinite(forced) && forced >= 1) return Math.min(forced, 10);
  const cores = Math.max(1, typeof os.availableParallelism === "function" ? os.availableParallelism() : os.cpus().length);
  return Math.min(6, Math.max(1, Math.ceil(os.loadavg()[0]! / cores)));
};

export const heavyTimeout = (baseMs: number): number => Math.round(baseMs * loadScale());
