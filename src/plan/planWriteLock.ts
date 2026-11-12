import { withLock } from "../io/processLock";

/**
 * قفل كتابة plan.json الواحد (D105): حفظ الصفحة، واختيار الشورتس، وختم السلسلة عند النقل والتراجع كلها تكتب
 * الخطة تحته، فلا يكتب أحدها فوق قراءة الآخر. ملف القفل `plan.json.write.lock` محلي لا يُرفع (`.gitignore`).
 */
export const planWriteLockFor = (planFile: string) => planFile + ".write.lock";
export const withPlanWrite = <T>(planFile: string, work: () => Promise<T>) => withLock(planWriteLockFor(planFile), {
  purpose: "plan write", waitMs: 5_000, busyMessage: "الخطة تُحفظ الآن؛ تعديلك باقٍ هنا. أعد المحاولة بعد لحظات.",
}, work);
