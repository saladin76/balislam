/**
 * يُشغَّل قبل كل ملف اختبار (vitest setupFiles): يزيل من بيئة الاختبارات متغيرات تحديد المستودع
 * (GIT_DIR وأخواته) إن وُرثت من خطّاف git، فكل git يشغّله اختبار يعمل على مجلده المؤقت وحده.
 * خط دفاع ثانٍ بعد البوابة (scripts/gate.mjs) التي لا تورّثها أصلًا.
 */
import { scrubProcessGitEnv } from "../../scripts/git-env.mjs";

scrubProcessGitEnv();
