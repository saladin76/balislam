/**
 * يُشغَّل قبل كل ملف اختبار (vitest setupFiles): يزيل من بيئة الاختبارات متغيرات تحديد المستودع
 * (GIT_DIR وأخواته) إن وُرثت من خطّاف git، فكل git يشغّله اختبار يعمل على مجلده المؤقت وحده.
 * خط دفاع ثانٍ بعد البوابة (scripts/gate.mjs) التي لا تورّثها أصلًا.
 */
import { scrubProcessGitEnv } from "../../scripts/git-env.mjs";

scrubProcessGitEnv();

/**
 * KI-029 (D113): مخرجات الاختبارات كانت مليئة بـ «push negotiation failed» و«expected 'acknowledgments',
 * received 'packfile'» من كل دفع إلى مستودع اختبار على القرص، حين يكون `push.negotiate=true` في إعداد git العام
 * للجهاز (جلسات السحابة)، فيختفي الخطأ الحقيقي بينها. التفاوض تحسين للشبكة لا معنى له لمستودع على القرص، والدفع
 * نفسه ينجح بدونه؛ فيُطفأ لكل git تشغّله الاختبارات بمتغيرات GIT_CONFIG_* (تُضاف بعد أي إعداد موروث، لا تحل محله).
 */
export const quietTestGit = (env: NodeJS.ProcessEnv = process.env) => {
  const n = Number(env.GIT_CONFIG_COUNT ?? 0) || 0;
  for (let i = 0; i < n; i++) if (env[`GIT_CONFIG_KEY_${i}`] === "push.negotiate") return;
  env.GIT_CONFIG_COUNT = String(n + 1);
  env[`GIT_CONFIG_KEY_${n}`] = "push.negotiate";
  env[`GIT_CONFIG_VALUE_${n}`] = "false";
};
quietTestGit();

/**
 * D239: نسخة البسملة المعتمدة المثبّتة على جهاز المالك (`assets/recitations/basmala/`) لا تدخل أي اختبار: الاختبارات
 * تقيس السلوك نفسه على كل جهاز، ومن يحتاج نسخة يضع مساره بنفسه (tests/basmala-approved-clip*.test.ts).
 */
process.env.BAL_BASMALA_CLIP = "/nonexistent/bal-test/approved-basmala-v4.mp3";
