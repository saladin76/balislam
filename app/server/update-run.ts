/** يستخدمه start-studio.command: نفس منطق «حدّث الآن» قبل تشغيل الاستوديو. */
import path from "node:path";
import { applyUpdate, updateStatus } from "./update.ts";

const root = path.resolve(import.meta.dirname, "..", "..");
const st = await updateStatus(root, true);
if (st.error) console.log(st.error);
else if (!st.available) console.log("الاستوديو محدّث.");
else {
  console.log(`تحديث جديد (${st.behind}): ${st.changes[0] ?? ""}`);
  const r = await applyUpdate(root);
  console.log(r.ok ? r.message : `⚠️ ${r.message}`);
}
