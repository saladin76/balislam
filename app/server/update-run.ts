/** يستخدمه start-studio.command: نفس منطق «حدّث الآن» قبل تشغيل الاستوديو. */
import path from "node:path";
import { applyUpdate, updateStatus } from "./update.ts";
import { ensurePreviewFetchExclusion } from "../../src/render/cloudPreviews.ts";

const root = path.resolve(import.meta.dirname, "..", "..");
// قبل أي جلب: فروع المعاينات السحابية previews/* لا تُجلب مع git pull (D75)
await ensurePreviewFetchExclusion(root).catch((e) => console.log(`[studio] cloud previews fetch config: ${(e as Error).message}`));
const st = await updateStatus(root, true);
if (st.error) console.log(st.error);
else if (!st.available) console.log("الاستوديو محدّث.");
else {
  console.log(`تحديث جديد (${st.behind}): ${st.changes[0] ?? ""}`);
  if (st.local) console.log(`تعديلاتك المحلية (${st.local}) تُحفظ نسخة منها وتبقى كما هي.`);
  const r = await applyUpdate(root);
  console.log(r.ok ? r.message : `⚠️ ${r.message}`);
  if (r.conflicts?.length) console.log(`افتح الاستوديو واختر لكل ملف: «أبقِ نسختي» أو «خذ الجديد» (${r.conflicts.map((c) => c.file).join("، ")}).`);
}
